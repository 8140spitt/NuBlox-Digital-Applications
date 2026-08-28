import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	FinanceValidationError,
	cleanFinanceText,
	formatDateOnly,
	insertedId,
	validateCurrencyCode,
	validateFinanceDate,
	validateMoneyAmount
} from './finance-common';

const BANK_PERMISSIONS = {
	view: 'finance.bank.view',
	accountManage: 'finance.bank.account.manage',
	statementRecord: 'finance.bank.statement.record',
	reconcile: 'finance.bank.reconcile',
	reconcileReverse: 'finance.bank.reconcile.reverse'
} as const;

export type BankStatementLineInput = {
	externalTransactionId: string;
	bookedOn: string;
	valueOn?: string | null;
	direction: 'debit' | 'credit';
	amount: string;
	description: string;
	bankReference?: string | null;
};

export type BankReconciliationWorkspace = {
	accounts: Array<{
		publicId: string;
		accountingAccountPublicId: string;
		accountingAccountCode: string;
		accountName: string;
		institutionName: string;
		accountIdentifierLast4: string;
		currencyCode: string;
		status: string;
	}>;
	statements: Array<{
		publicId: string;
		bankAccountPublicId: string;
		accountName: string;
		statementReference: string;
		periodStart: string;
		periodEnd: string;
		openingBalance: string;
		closingBalance: string;
		createdAt: Date;
	}>;
	unmatchedLines: Array<{
		publicId: string;
		bankAccountPublicId: string;
		accountName: string;
		currencyCode: string;
		statementReference: string;
		externalTransactionId: string;
		bookedOn: string;
		direction: string;
		amount: string;
		description: string;
		bankReference: string | null;
	}>;
	unsettledSupplierPayments: Array<{
		publicId: string;
		supplierName: string;
		paymentReference: string | null;
		currencyCode: string;
		paymentAmount: string;
		executedAt: Date;
	}>;
	matches: Array<{
		publicId: string;
		statementLinePublicId: string;
		supplierPaymentPublicId: string;
		supplierName: string;
		statementReference: string;
		bankReference: string | null;
		currencyCode: string;
		matchedAmount: string;
		matchedAt: Date;
		reversalPublicId: string | null;
		reversalReason: string | null;
		reversedAt: Date | null;
	}>;
	cashAccountingAccounts: Array<{
		publicId: string;
		accountCode: string;
		name: string;
	}>;
	canManageAccounts: boolean;
	canRecordStatements: boolean;
	canReconcile: boolean;
	canReverseReconciliation: boolean;
};

function checkedPublicId(value: string, label: string): string {
	const text = value.trim();
	if (!/^[0-9a-f-]{36}$/i.test(text)) throw new FinanceValidationError(`${label} is invalid.`);
	return text;
}

function requiredDate(value: string | null | undefined, label: string): Date {
	const parsed = validateFinanceDate(value, label);
	if (!parsed) throw new FinanceValidationError(`${label} is required.`);
	return parsed;
}

function signedMoney(value: string, label: string): string {
	try {
		return formatScaledDecimal(parseScaledDecimal(value, 4, label, true), 4);
	} catch (cause) {
		throw new FinanceValidationError(
			cause instanceof Error ? cause.message : `${label} is invalid.`
		);
	}
}

function asciiReference(value: string, label: string): string {
	const text = cleanFinanceText(value, 160, label, true)!;
	if (!/^[\x20-\x7e]+$/.test(text)) {
		throw new FinanceValidationError(`${label} must use printable ASCII characters.`);
	}
	return text;
}

function last4(value: string): string {
	const text = value.trim();
	if (!/^[A-Za-z0-9]{4}$/.test(text)) {
		throw new FinanceValidationError(
			'Account identifier must contain exactly four letters or digits.'
		);
	}
	return text.toUpperCase();
}

function direction(value: string): 'debit' | 'credit' {
	if (value === 'debit' || value === 'credit') return value;
	throw new FinanceValidationError('Bank statement direction is invalid.');
}

async function lockOrganisation(db: DatabaseExecutor, organisationId: string): Promise<void> {
	await db
		.selectFrom('organisations')
		.select('id')
		.where('id', '=', organisationId)
		.forUpdate()
		.executeTakeFirstOrThrow();
}

async function activeSupplierPaymentExecutionJournal(
	db: DatabaseExecutor,
	organisationId: string,
	paymentPublicId: string
) {
	return db
		.selectFrom('accounting_journal_entries as journal')
		.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
			join
				.onRef('reversal.journal_entry_id', '=', 'journal.id')
				.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
		)
		.select(['journal.id', 'journal.accounting_date as accountingDate'])
		.where('journal.organisation_id', '=', organisationId)
		.where('journal.source_type', '=', 'supplier_payment_execution')
		.where('journal.source_public_id', '=', paymentPublicId)
		.where('reversal.journal_entry_id', 'is', null)
		.executeTakeFirst();
}

async function activeMatchForPayment(
	db: DatabaseExecutor,
	organisationId: string,
	paymentId: string
) {
	return db
		.selectFrom('bank_reconciliation_matches as match')
		.leftJoin('bank_reconciliation_match_reversals as reversal', (join) =>
			join
				.onRef('reversal.bank_reconciliation_match_id', '=', 'match.id')
				.onRef('reversal.organisation_id', '=', 'match.organisation_id')
		)
		.select(['match.id', 'match.public_id as publicId'])
		.where('match.organisation_id', '=', organisationId)
		.where('match.supplier_payment_id', '=', paymentId)
		.where('reversal.bank_reconciliation_match_id', 'is', null)
		.executeTakeFirst();
}

async function activeMatchForLine(db: DatabaseExecutor, organisationId: string, lineId: string) {
	return db
		.selectFrom('bank_reconciliation_matches as match')
		.leftJoin('bank_reconciliation_match_reversals as reversal', (join) =>
			join
				.onRef('reversal.bank_reconciliation_match_id', '=', 'match.id')
				.onRef('reversal.organisation_id', '=', 'match.organisation_id')
		)
		.select(['match.id', 'match.public_id as publicId'])
		.where('match.organisation_id', '=', organisationId)
		.where('match.bank_statement_line_id', '=', lineId)
		.where('reversal.bank_reconciliation_match_id', 'is', null)
		.executeTakeFirst();
}

export async function unreconciledSupplierPaymentJournalCount(
	db: DatabaseExecutor,
	organisationId: string,
	periodStart: Date,
	periodEnd: Date
): Promise<number> {
	const rows = await db
		.selectFrom('accounting_journal_entries as journal')
		.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
			join
				.onRef('payment.public_id', '=', 'journal.source_public_id')
				.onRef('payment.organisation_id', '=', 'journal.organisation_id')
		)
		.leftJoin('accounting_journal_entry_reversals as journal_reversal', (join) =>
			join
				.onRef('journal_reversal.journal_entry_id', '=', 'journal.id')
				.onRef('journal_reversal.organisation_id', '=', 'journal.organisation_id')
		)
		.leftJoin('accounts_payable_supplier_payment_reversals as payment_reversal', (join) =>
			join
				.onRef('payment_reversal.supplier_payment_id', '=', 'payment.id')
				.onRef('payment_reversal.organisation_id', '=', 'payment.organisation_id')
		)
		.select('payment.id')
		.where('journal.organisation_id', '=', organisationId)
		.where('journal.source_type', '=', 'supplier_payment_execution')
		.where('journal.accounting_date', '>=', periodStart)
		.where('journal.accounting_date', '<=', periodEnd)
		.where('journal_reversal.journal_entry_id', 'is', null)
		.where('payment_reversal.supplier_payment_id', 'is', null)
		.where(
			sql<boolean>`not exists (
				select 1
				from bank_reconciliation_matches as bank_match
				left join bank_reconciliation_match_reversals as bank_reversal
					on bank_reversal.bank_reconciliation_match_id = bank_match.id
					and bank_reversal.organisation_id = bank_match.organisation_id
				where bank_match.organisation_id = ${organisationId}
					and bank_match.supplier_payment_id = payment.id
					and bank_reversal.bank_reconciliation_match_id is null
			)`
		)
		.execute();
	return rows.length;
}

export class BankReconciliationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async decision(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'finance.manage');
	}

	private async requireView(actor: TenantActorContext): Promise<void> {
		await this.assertActiveActor(actor);
		if (!(await this.decision(actor, BANK_PERMISSIONS.view)).allowed) {
			throw new TenantAccessError('Bank reconciliation access is not permitted.');
		}
	}

	private async requireMutation(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor
	) {
		const membership = await this.assertActiveActor(actor, db);
		if (!(await this.decision(actor, permissionKey, db)).allowed) {
			throw new TenantAccessError('This bank reconciliation action is not permitted.');
		}
		return membership;
	}

	async getWorkspace(actor: TenantActorContext): Promise<BankReconciliationWorkspace> {
		await this.requireView(actor);
		const [accountManage, statementRecord, reconcile, reconcileReverse] = await Promise.all([
			this.decision(actor, BANK_PERMISSIONS.accountManage),
			this.decision(actor, BANK_PERMISSIONS.statementRecord),
			this.decision(actor, BANK_PERMISSIONS.reconcile),
			this.decision(actor, BANK_PERMISSIONS.reconcileReverse)
		]);

		const accounts = await this.db
			.selectFrom('bank_accounts as bank')
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'bank.accounting_account_id')
					.onRef('account.organisation_id', '=', 'bank.organisation_id')
			)
			.select([
				'bank.public_id as publicId',
				'account.public_id as accountingAccountPublicId',
				'account.account_code as accountingAccountCode',
				'bank.account_name as accountName',
				'bank.institution_name as institutionName',
				'bank.account_identifier_last4 as accountIdentifierLast4',
				'bank.currency_code as currencyCode',
				'bank.lifecycle_status as status'
			])
			.where('bank.organisation_id', '=', actor.organisationId)
			.orderBy('bank.account_name')
			.execute();

		const statements = await this.db
			.selectFrom('bank_statements as statement')
			.innerJoin('bank_accounts as bank', (join) =>
				join
					.onRef('bank.id', '=', 'statement.bank_account_id')
					.onRef('bank.organisation_id', '=', 'statement.organisation_id')
			)
			.select([
				'statement.public_id as publicId',
				'bank.public_id as bankAccountPublicId',
				'bank.account_name as accountName',
				'statement.statement_reference as statementReference',
				'statement.period_start as periodStart',
				'statement.period_end as periodEnd',
				'statement.opening_balance as openingBalance',
				'statement.closing_balance as closingBalance',
				'statement.created_at as createdAt'
			])
			.where('statement.organisation_id', '=', actor.organisationId)
			.orderBy('statement.period_end', 'desc')
			.orderBy('statement.id', 'desc')
			.limit(100)
			.execute();

		const lineRows = await this.db
			.selectFrom('bank_statement_lines as line')
			.innerJoin('bank_statements as statement', (join) =>
				join
					.onRef('statement.id', '=', 'line.bank_statement_id')
					.onRef('statement.organisation_id', '=', 'line.organisation_id')
			)
			.innerJoin('bank_accounts as bank', (join) =>
				join
					.onRef('bank.id', '=', 'line.bank_account_id')
					.onRef('bank.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'line.id',
				'line.public_id as publicId',
				'bank.public_id as bankAccountPublicId',
				'bank.account_name as accountName',
				'bank.currency_code as currencyCode',
				'statement.statement_reference as statementReference',
				'line.external_transaction_id as externalTransactionId',
				'line.booked_on as bookedOn',
				'line.direction',
				'line.amount',
				'line.description',
				'line.bank_reference as bankReference'
			])
			.where('line.organisation_id', '=', actor.organisationId)
			.where(
				sql<boolean>`not exists (
					select 1 from bank_reconciliation_matches as active_match
					left join bank_reconciliation_match_reversals as active_reversal
						on active_reversal.bank_reconciliation_match_id = active_match.id
						and active_reversal.organisation_id = active_match.organisation_id
					where active_match.organisation_id = ${actor.organisationId}
						and active_match.bank_statement_line_id = line.id
						and active_reversal.bank_reconciliation_match_id is null
				)`
			)
			.orderBy('line.booked_on', 'desc')
			.orderBy('line.id', 'desc')
			.limit(500)
			.execute();

		const matchRows = await this.db
			.selectFrom('bank_reconciliation_matches as match')
			.innerJoin('bank_statement_lines as line', (join) =>
				join
					.onRef('line.id', '=', 'match.bank_statement_line_id')
					.onRef('line.organisation_id', '=', 'match.organisation_id')
			)
			.innerJoin('bank_statements as statement', (join) =>
				join
					.onRef('statement.id', '=', 'line.bank_statement_id')
					.onRef('statement.organisation_id', '=', 'line.organisation_id')
			)
			.innerJoin('bank_accounts as bank', (join) =>
				join
					.onRef('bank.id', '=', 'line.bank_account_id')
					.onRef('bank.organisation_id', '=', 'line.organisation_id')
			)
			.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
				join
					.onRef('payment.id', '=', 'match.supplier_payment_id')
					.onRef('payment.organisation_id', '=', 'match.organisation_id')
			)
			.innerJoin('party_organisations as supplier', (join) =>
				join
					.onRef('supplier.party_id', '=', 'payment.supplier_party_id')
					.onRef('supplier.organisation_id', '=', 'payment.organisation_id')
			)
			.leftJoin('bank_reconciliation_match_reversals as reversal', (join) =>
				join
					.onRef('reversal.bank_reconciliation_match_id', '=', 'match.id')
					.onRef('reversal.organisation_id', '=', 'match.organisation_id')
			)
			.select([
				'match.public_id as publicId',
				'line.public_id as statementLinePublicId',
				'payment.public_id as supplierPaymentPublicId',
				'supplier.legal_name as supplierName',
				'statement.statement_reference as statementReference',
				'line.bank_reference as bankReference',
				'bank.currency_code as currencyCode',
				'match.matched_amount as matchedAmount',
				'match.matched_at as matchedAt',
				'reversal.public_id as reversalPublicId',
				'reversal.reason as reversalReason',
				'reversal.reversed_at as reversedAt'
			])
			.where('match.organisation_id', '=', actor.organisationId)
			.orderBy('match.matched_at', 'desc')
			.limit(200)
			.execute();

		const paymentRows = await this.db
			.selectFrom('accounts_payable_supplier_payments as payment')
			.innerJoin('party_organisations as supplier', (join) =>
				join
					.onRef('supplier.party_id', '=', 'payment.supplier_party_id')
					.onRef('supplier.organisation_id', '=', 'payment.organisation_id')
			)
			.leftJoin('accounts_payable_supplier_payment_reversals as reversal', (join) =>
				join
					.onRef('reversal.supplier_payment_id', '=', 'payment.id')
					.onRef('reversal.organisation_id', '=', 'payment.organisation_id')
			)
			.select([
				'payment.public_id as publicId',
				'supplier.legal_name as supplierName',
				'payment.payment_reference as paymentReference',
				'payment.currency_code as currencyCode',
				'payment.payment_amount as paymentAmount',
				'payment.executed_at as executedAt'
			])
			.where('payment.organisation_id', '=', actor.organisationId)
			.where('payment.lifecycle_status', '=', 'executed')
			.where('payment.executed_at', 'is not', null)
			.where('reversal.supplier_payment_id', 'is', null)
			.where(
				sql<boolean>`exists (
					select 1
					from accounting_journal_entries as journal
					left join accounting_journal_entry_reversals as journal_reversal
						on journal_reversal.journal_entry_id = journal.id
						and journal_reversal.organisation_id = journal.organisation_id
					where journal.organisation_id = ${actor.organisationId}
						and journal.source_type = 'supplier_payment_execution'
						and journal.source_public_id = payment.public_id
						and journal_reversal.journal_entry_id is null
				)`
			)
			.where(
				sql<boolean>`not exists (
					select 1 from bank_reconciliation_matches as active_match
					left join bank_reconciliation_match_reversals as active_reversal
						on active_reversal.bank_reconciliation_match_id = active_match.id
						and active_reversal.organisation_id = active_match.organisation_id
					where active_match.organisation_id = ${actor.organisationId}
						and active_match.supplier_payment_id = payment.id
						and active_reversal.bank_reconciliation_match_id is null
				)`
			)
			.orderBy('payment.executed_at', 'desc')
			.limit(200)
			.execute();

		const cashAccountingAccounts = await this.db
			.selectFrom('accounting_account_mappings as mapping')
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'mapping.accounting_account_id')
					.onRef('account.organisation_id', '=', 'mapping.organisation_id')
			)
			.select([
				'account.public_id as publicId',
				'account.account_code as accountCode',
				'account.name'
			])
			.where('mapping.organisation_id', '=', actor.organisationId)
			.where('mapping.mapping_key', '=', 'cash_disbursements')
			.where('account.is_active', '=', 1)
			.execute();

		return {
			accounts,
			statements: statements.map((statement) => ({
				...statement,
				periodStart: formatDateOnly(statement.periodStart),
				periodEnd: formatDateOnly(statement.periodEnd)
			})),
			unmatchedLines: lineRows.map((line) => ({
				...line,
				bookedOn: formatDateOnly(line.bookedOn)
			})),
			unsettledSupplierPayments: paymentRows.map((payment) => ({
				...payment,
				executedAt: payment.executedAt!
			})),
			matches: matchRows,
			cashAccountingAccounts,
			canManageAccounts: accountManage.allowed,
			canRecordStatements: statementRecord.allowed,
			canReconcile: reconcile.allowed,
			canReverseReconciliation: reconcileReverse.allowed
		};
	}

	async createBankAccount(
		actor: TenantActorContext,
		input: {
			accountingAccountPublicId: string;
			accountName: string;
			institutionName: string;
			accountIdentifierLast4: string;
			currencyCode: string;
		}
	): Promise<string> {
		const accountingAccountPublicId = checkedPublicId(
			input.accountingAccountPublicId,
			'Accounting account'
		);
		const accountName = cleanFinanceText(input.accountName, 160, 'Bank account name', true)!;
		const institutionName = cleanFinanceText(input.institutionName, 160, 'Institution name', true)!;
		const accountIdentifierLast4 = last4(input.accountIdentifierLast4);
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Bank account currency');
		if (!currencyCode) throw new FinanceValidationError('Bank account currency is required.');

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireMutation(actor, BANK_PERMISSIONS.accountManage, trx);
			await lockOrganisation(trx, actor.organisationId);
			const accountingAccount = await trx
				.selectFrom('accounting_accounts')
				.select(['id', 'account_type as accountType', 'is_active as isActive'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', accountingAccountPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!accountingAccount || !accountingAccount.isActive) {
				throw new RecordNotFoundError('Active accounting cash account not found.');
			}
			if (accountingAccount.accountType !== 'asset') {
				throw new FinanceValidationError('A bank account must be linked to an asset account.');
			}
			const cashMapping = await trx
				.selectFrom('accounting_account_mappings')
				.select('accounting_account_id as accountId')
				.where('organisation_id', '=', actor.organisationId)
				.where('mapping_key', '=', 'cash_disbursements')
				.executeTakeFirst();
			if (!cashMapping || cashMapping.accountId !== accountingAccount.id) {
				throw new FinanceValidationError(
					'Bank settlement account must be the active cash_disbursements accounting mapping.'
				);
			}
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('bank_accounts')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					accounting_account_id: accountingAccount.id,
					account_name: accountName,
					institution_name: institutionName,
					account_identifier_last4: accountIdentifierLast4,
					currency_code: currencyCode,
					lifecycle_status: 'active',
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.bank.account.created',
				subjectType: 'bank_account',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { accountName, institutionName, accountIdentifierLast4, currencyCode }
			});
			return publicId;
		});
	}

	async recordStatement(
		actor: TenantActorContext,
		input: {
			bankAccountPublicId: string;
			statementReference: string;
			periodStart: string;
			periodEnd: string;
			openingBalance: string;
			closingBalance: string;
			lines: BankStatementLineInput[];
		}
	): Promise<string> {
		const bankAccountPublicId = checkedPublicId(input.bankAccountPublicId, 'Bank account');
		const statementReference = asciiReference(input.statementReference, 'Statement reference');
		const periodStart = requiredDate(input.periodStart, 'Statement period start');
		const periodEnd = requiredDate(input.periodEnd, 'Statement period end');
		if (periodEnd < periodStart) {
			throw new FinanceValidationError('Statement period end must be on or after its start.');
		}
		const openingBalance = signedMoney(input.openingBalance, 'Opening balance');
		const closingBalance = signedMoney(input.closingBalance, 'Closing balance');
		if (input.lines.length === 0)
			throw new FinanceValidationError('Statement must contain at least one line.');
		if (input.lines.length > 2000)
			throw new FinanceValidationError('Statement must not exceed 2,000 lines.');

		const seen = new Set<string>();
		let movement = 0n;
		const lines = input.lines.map((entry) => {
			const externalTransactionId = asciiReference(
				entry.externalTransactionId,
				'External transaction ID'
			);
			if (seen.has(externalTransactionId)) {
				throw new FinanceValidationError('Statement contains a duplicate external transaction ID.');
			}
			seen.add(externalTransactionId);
			const bookedOn = requiredDate(entry.bookedOn, 'Booked date');
			if (bookedOn < periodStart || bookedOn > periodEnd) {
				throw new FinanceValidationError(
					'Every bank line booked date must fall within the statement period.'
				);
			}
			const valueOn = entry.valueOn ? requiredDate(entry.valueOn, 'Value date') : null;
			const lineDirection = direction(entry.direction);
			const amount = validateMoneyAmount(entry.amount, 'Bank statement amount');
			const scaled = parseScaledDecimal(amount, 4, 'Bank statement amount');
			movement += lineDirection === 'credit' ? scaled : -scaled;
			return {
				externalTransactionId,
				bookedOn,
				valueOn,
				direction: lineDirection,
				amount,
				description: cleanFinanceText(entry.description, 500, 'Bank line description', true)!,
				bankReference: cleanFinanceText(entry.bankReference, 160, 'Bank reference')
			};
		});
		const expectedClose = parseScaledDecimal(openingBalance, 4, 'Opening balance', true) + movement;
		if (expectedClose !== parseScaledDecimal(closingBalance, 4, 'Closing balance', true)) {
			throw new FinanceValidationError(
				`Statement balances do not reconcile: expected closing balance ${formatScaledDecimal(expectedClose, 4)}.`
			);
		}

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireMutation(actor, BANK_PERMISSIONS.statementRecord, trx);
			await lockOrganisation(trx, actor.organisationId);
			const bankAccount = await trx
				.selectFrom('bank_accounts')
				.select(['id', 'lifecycle_status as status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', bankAccountPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!bankAccount || bankAccount.status !== 'active') {
				throw new RecordNotFoundError('Active bank account not found.');
			}
			const publicId = this.publicIdFactory();
			const statementId = insertedId(
				await trx
					.insertInto('bank_statements')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						bank_account_id: bankAccount.id,
						statement_reference: statementReference,
						period_start: periodStart,
						period_end: periodEnd,
						opening_balance: openingBalance,
						closing_balance: closingBalance,
						created_by_member_id: membership.id
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('bank_statement_lines')
				.values(
					lines.map((entry) => ({
						organisation_id: actor.organisationId,
						public_id: this.publicIdFactory(),
						bank_statement_id: statementId,
						bank_account_id: bankAccount.id,
						external_transaction_id: entry.externalTransactionId,
						booked_on: entry.bookedOn,
						value_on: entry.valueOn,
						direction: entry.direction,
						amount: entry.amount,
						description: entry.description,
						bank_reference: entry.bankReference
					}))
				)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.bank.statement.recorded',
				subjectType: 'bank_statement',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					bankAccountPublicId,
					statementReference,
					periodStart,
					periodEnd,
					openingBalance,
					closingBalance,
					lineCount: lines.length
				}
			});
			return publicId;
		});
	}

	async matchSupplierPayment(
		actor: TenantActorContext,
		input: { statementLinePublicId: string; supplierPaymentPublicId: string }
	): Promise<string> {
		const statementLinePublicId = checkedPublicId(
			input.statementLinePublicId,
			'Bank statement line'
		);
		const supplierPaymentPublicId = checkedPublicId(
			input.supplierPaymentPublicId,
			'Supplier payment'
		);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireMutation(actor, BANK_PERMISSIONS.reconcile, trx);
			await lockOrganisation(trx, actor.organisationId);
			const line = await trx
				.selectFrom('bank_statement_lines as line')
				.innerJoin('bank_accounts as bank', (join) =>
					join
						.onRef('bank.id', '=', 'line.bank_account_id')
						.onRef('bank.organisation_id', '=', 'line.organisation_id')
				)
				.select([
					'line.id',
					'line.public_id as publicId',
					'line.booked_on as bookedOn',
					'line.direction',
					'line.amount',
					'line.bank_reference as bankReference',
					'bank.currency_code as currencyCode'
				])
				.where('line.organisation_id', '=', actor.organisationId)
				.where('line.public_id', '=', statementLinePublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!line) throw new RecordNotFoundError('Bank statement line not found.');
			if (line.direction !== 'debit') {
				throw new FinanceValidationError('Supplier payments can only match bank debit lines.');
			}
			if (await activeMatchForLine(trx, actor.organisationId, line.id)) {
				throw new FinanceValidationError('The bank statement line is already actively reconciled.');
			}

			const payment = await trx
				.selectFrom('accounts_payable_supplier_payments')
				.select([
					'id',
					'public_id as publicId',
					'currency_code as currencyCode',
					'payment_amount as paymentAmount',
					'payment_reference as paymentReference',
					'lifecycle_status as status',
					'executed_at as executedAt'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', supplierPaymentPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!payment || payment.status !== 'executed' || !payment.executedAt) {
				throw new RecordNotFoundError('Executed supplier payment not found.');
			}
			if (
				await trx
					.selectFrom('accounts_payable_supplier_payment_reversals')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('supplier_payment_id', '=', payment.id)
					.executeTakeFirst()
			) {
				throw new FinanceValidationError('A reversed supplier payment cannot be bank reconciled.');
			}
			if (
				!(await activeSupplierPaymentExecutionJournal(trx, actor.organisationId, payment.publicId))
			) {
				throw new FinanceValidationError(
					'Supplier payment execution must have an active accounting journal before bank reconciliation.'
				);
			}
			if (await activeMatchForPayment(trx, actor.organisationId, payment.id)) {
				throw new FinanceValidationError(
					'The supplier payment already has active bank settlement evidence.'
				);
			}
			if (line.currencyCode !== payment.currencyCode) {
				throw new FinanceValidationError('Bank line and supplier payment currencies do not match.');
			}
			if (
				parseScaledDecimal(line.amount, 4, 'Bank amount') !==
				parseScaledDecimal(payment.paymentAmount, 4, 'Supplier payment amount')
			) {
				throw new FinanceValidationError(
					'Bank line amount must exactly match the supplier payment amount.'
				);
			}
			const executedDate = new Date(
				Date.UTC(
					payment.executedAt.getUTCFullYear(),
					payment.executedAt.getUTCMonth(),
					payment.executedAt.getUTCDate()
				)
			);
			if (line.bookedOn < executedDate) {
				throw new FinanceValidationError(
					'Bank settlement cannot pre-date supplier payment execution.'
				);
			}

			const publicId = this.publicIdFactory();
			await trx
				.insertInto('bank_reconciliation_matches')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					bank_statement_line_id: line.id,
					supplier_payment_id: payment.id,
					matched_amount: payment.paymentAmount,
					matched_by_member_id: membership.id,
					matched_at: this.now()
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.bank.supplier_payment.reconciled',
				subjectType: 'supplier_payment',
				subjectPublicId: payment.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					bankReconciliationMatchPublicId: publicId,
					statementLinePublicId: line.publicId,
					bankReference: line.bankReference,
					paymentReference: payment.paymentReference,
					amount: payment.paymentAmount,
					currencyCode: payment.currencyCode
				}
			});
			return publicId;
		});
	}

	async reverseMatch(
		actor: TenantActorContext,
		matchPublicIdInput: string,
		reasonInput: string
	): Promise<string> {
		const matchPublicId = checkedPublicId(matchPublicIdInput, 'Bank reconciliation match');
		const reason = cleanFinanceText(reasonInput, 1000, 'Reconciliation reversal reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireMutation(actor, BANK_PERMISSIONS.reconcileReverse, trx);
			await lockOrganisation(trx, actor.organisationId);
			const match = await trx
				.selectFrom('bank_reconciliation_matches as match')
				.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
					join
						.onRef('payment.id', '=', 'match.supplier_payment_id')
						.onRef('payment.organisation_id', '=', 'match.organisation_id')
				)
				.select(['match.id', 'match.public_id as publicId', 'payment.public_id as paymentPublicId'])
				.where('match.organisation_id', '=', actor.organisationId)
				.where('match.public_id', '=', matchPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!match) throw new RecordNotFoundError('Bank reconciliation match not found.');
			if (
				await trx
					.selectFrom('bank_reconciliation_match_reversals')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('bank_reconciliation_match_id', '=', match.id)
					.executeTakeFirst()
			) {
				throw new FinanceValidationError('The bank reconciliation match is already reversed.');
			}
			const executionJournal = await activeSupplierPaymentExecutionJournal(
				trx,
				actor.organisationId,
				match.paymentPublicId
			);
			if (executionJournal) {
				const period = await trx
					.selectFrom('accounting_periods')
					.select(['name', 'status'])
					.where('organisation_id', '=', actor.organisationId)
					.where('starts_on', '<=', executionJournal.accountingDate)
					.where('ends_on', '>=', executionJournal.accountingDate)
					.executeTakeFirst();
				if (period?.status === 'hard_closed') {
					throw new FinanceValidationError(
						`Reopen accounting period ${period.name} before reversing its supplier-payment bank settlement evidence.`
					);
				}
			}
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('bank_reconciliation_match_reversals')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					bank_reconciliation_match_id: match.id,
					reason,
					reversed_by_member_id: membership.id,
					reversed_at: this.now()
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.bank.reconciliation.reversed',
				subjectType: 'bank_reconciliation_match',
				subjectPublicId: match.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					reversalPublicId: publicId,
					supplierPaymentPublicId: match.paymentPublicId,
					reason
				}
			});
			return publicId;
		});
	}
}
