import { createHash, randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	assertAccountingExportPeriod,
	assertAccountingExportReversalAllowed,
	assertOpenAccountingPeriod
} from './accounting-period-service';
import {
	ACCOUNTING_SOURCE_TYPES,
	listAccountingSourceReferences,
	resolveAccountingSourceCandidate,
	type AccountingMappingKey,
	type AccountingSourceCandidate,
	type AccountingSourceType
} from './accounting-source-service';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateFinanceDate
} from './finance-common';

const ACCOUNT_TYPES = new Set(['asset', 'liability', 'equity', 'revenue', 'expense']);
const MAPPING_KEYS = new Set<AccountingMappingKey>([
	'accounts_receivable',
	'sales_revenue',
	'vat_control',
	'cash_receipts',
	'customer_unapplied_cash',
	'bad_debt_expense',
	'bad_debt_recovery_income',
	'accounts_payable',
	'purchase_expense',
	'cash_disbursements',
	'retained_earnings'
]);
const EXPECTED_MAPPING_ACCOUNT_TYPES: Record<AccountingMappingKey, string> = {
	accounts_receivable: 'asset',
	sales_revenue: 'revenue',
	vat_control: 'liability',
	cash_receipts: 'asset',
	customer_unapplied_cash: 'liability',
	bad_debt_expense: 'expense',
	bad_debt_recovery_income: 'revenue',
	accounts_payable: 'liability',
	purchase_expense: 'expense',
	cash_disbursements: 'asset',
	retained_earnings: 'equity'
};

function cleanSourceType(value: string): AccountingSourceType {
	if (!ACCOUNTING_SOURCE_TYPES.includes(value as AccountingSourceType)) {
		throw new FinanceValidationError('Accounting source type is invalid.');
	}
	return value as AccountingSourceType;
}

function cleanMappingKey(value: string): AccountingMappingKey {
	if (!MAPPING_KEYS.has(value as AccountingMappingKey))
		throw new FinanceValidationError('Accounting mapping key is invalid.');
	return value as AccountingMappingKey;
}

function cleanAccountCode(value: string): string {
	const code = cleanFinanceText(value, 32, 'Account code', true)!;
	if (!/^[A-Za-z0-9._/-]+$/.test(code))
		throw new FinanceValidationError('Account code contains unsupported characters.');
	return code;
}

function accountNormalBalance(accountType: string): 'debit' | 'credit' {
	return accountType === 'asset' || accountType === 'expense' ? 'debit' : 'credit';
}

function dateOnly(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextNumber(prefix: string, rows: string[]): string {
	let max = 0;
	const pattern = new RegExp(`^${prefix}-(\\d+)$`);
	for (const value of rows) {
		const match = pattern.exec(value);
		if (!match) continue;
		max = Math.max(max, Number(match[1]));
	}
	return `${prefix}-${String(max + 1).padStart(6, '0')}`;
}

async function nextJournalNumber(db: DatabaseExecutor, organisationId: string): Promise<string> {
	const rows = await db
		.selectFrom('accounting_journal_entries')
		.select('journal_number as number')
		.where('organisation_id', '=', organisationId)
		.forUpdate()
		.execute();
	return nextNumber(
		'JRN',
		rows.map((row) => row.number)
	);
}

async function nextExportNumber(db: DatabaseExecutor, organisationId: string): Promise<string> {
	const rows = await db
		.selectFrom('accounting_export_batches')
		.select('export_number as number')
		.where('organisation_id', '=', organisationId)
		.forUpdate()
		.execute();
	return nextNumber(
		'AEX',
		rows.map((row) => row.number)
	);
}

async function activeJournalForSource(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: string,
	sourcePublicId: string
) {
	return db
		.selectFrom('accounting_journal_entries as journal')
		.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
			join
				.onRef('reversal.journal_entry_id', '=', 'journal.id')
				.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
		)
		.select([
			'journal.id',
			'journal.public_id as publicId',
			'journal.source_fingerprint as fingerprint'
		])
		.where('journal.organisation_id', '=', organisationId)
		.where('journal.source_type', '=', sourceType)
		.where('journal.source_public_id', '=', sourcePublicId)
		.where('reversal.journal_entry_id', 'is', null)
		.forUpdate()
		.executeTakeFirst();
}

function csvEscape(value: string): string {
	if (!/[",\r\n]/.test(value)) return value;
	return `"${value.replaceAll('"', '""')}"`;
}

export type AccountingWorkspace = {
	accounts: Array<{
		publicId: string;
		accountCode: string;
		name: string;
		accountType: string;
		normalBalance: string;
		isActive: boolean;
	}>;
	mappings: Array<{
		mappingKey: string;
		accountPublicId: string;
		accountCode: string;
		accountName: string;
	}>;
	candidates: Array<AccountingSourceCandidate & { missingMappings: string[] }>;
	journals: Array<{
		publicId: string;
		journalNumber: string;
		sourceType: string;
		sourcePublicId: string;
		accountingDate: Date;
		currencyCode: string;
		sourceAmount: string;
		memo: string;
		postedAt: Date;
		reversedAt: Date | null;
		lines: Array<{
			accountCode: string;
			accountName: string;
			description: string;
			debitAmount: string;
			creditAmount: string;
		}>;
	}>;
	exports: Array<{
		publicId: string;
		exportNumber: string;
		periodStart: Date;
		periodEnd: Date;
		rowCount: number;
		contentSha256: string;
		createdAt: Date;
		reversedAt: Date | null;
	}>;
	canConfigure: boolean;
	canPost: boolean;
	canReverse: boolean;
	canExport: boolean;
	canReverseExport: boolean;
};

export class AccountingService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertView(actor: TenantActorContext): Promise<FinanceAccessPolicy> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (
			!(await policy.viewDecision(actor)).allowed ||
			!(await policy.accountingViewDecision(actor)).allowed
		) {
			throw new TenantAccessError('Accounting viewing is not permitted.');
		}
		return policy;
	}

	async getWorkspace(actor: TenantActorContext): Promise<AccountingWorkspace> {
		const policy = await this.assertView(actor);
		const [configure, post, reverse, exportDecision, reverseExport] = await Promise.all([
			policy.mutationDecision(actor, 'finance.accounting.configure'),
			policy.mutationDecision(actor, 'finance.accounting.post'),
			policy.mutationDecision(actor, 'finance.accounting.reverse'),
			policy.mutationDecision(actor, 'finance.accounting.export'),
			policy.mutationDecision(actor, 'finance.accounting.export.reverse')
		]);
		const accountRows = await this.db
			.selectFrom('accounting_accounts')
			.select([
				'public_id as publicId',
				'account_code as accountCode',
				'name',
				'account_type as accountType',
				'normal_balance as normalBalance',
				'is_active as isActive'
			])
			.where('organisation_id', '=', actor.organisationId)
			.orderBy('account_code')
			.execute();
		const mappingRows = await this.db
			.selectFrom('accounting_account_mappings as mapping')
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'mapping.accounting_account_id')
					.onRef('account.organisation_id', '=', 'mapping.organisation_id')
			)
			.select([
				'mapping.mapping_key as mappingKey',
				'account.public_id as accountPublicId',
				'account.account_code as accountCode',
				'account.name as accountName'
			])
			.where('mapping.organisation_id', '=', actor.organisationId)
			.orderBy('mapping.mapping_key')
			.execute();
		const mappingKeys = new Set(mappingRows.map((row) => row.mappingKey));
		const candidates: Array<AccountingSourceCandidate & { missingMappings: string[] }> = [];
		for (const source of await listAccountingSourceReferences(this.db, actor.organisationId)) {
			if (
				await activeJournalForSource(
					this.db,
					actor.organisationId,
					source.sourceType,
					source.sourcePublicId
				)
			)
				continue;
			try {
				const candidate = await resolveAccountingSourceCandidate(
					this.db,
					actor.organisationId,
					source.sourceType,
					source.sourcePublicId
				);
				const missingMappings = [
					...new Set(
						candidate.lines.map((entry) => entry.mappingKey).filter((key) => !mappingKeys.has(key))
					)
				];
				candidates.push({ ...candidate, missingMappings });
			} catch (cause) {
				if (cause instanceof RecordNotFoundError || cause instanceof FinanceValidationError)
					continue;
				throw cause;
			}
		}
		const journalRows = await this.db
			.selectFrom('accounting_journal_entries as journal')
			.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
				join
					.onRef('reversal.journal_entry_id', '=', 'journal.id')
					.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
			)
			.select([
				'journal.id',
				'journal.public_id as publicId',
				'journal.journal_number as journalNumber',
				'journal.source_type as sourceType',
				'journal.source_public_id as sourcePublicId',
				'journal.accounting_date as accountingDate',
				'journal.currency_code as currencyCode',
				'journal.source_amount as sourceAmount',
				'journal.memo',
				'journal.posted_at as postedAt',
				'reversal.reversed_at as reversedAt'
			])
			.where('journal.organisation_id', '=', actor.organisationId)
			.orderBy('journal.posted_at', 'desc')
			.limit(100)
			.execute();
		const journals: AccountingWorkspace['journals'] = [];
		for (const journal of journalRows) {
			const lines = await this.db
				.selectFrom('accounting_journal_lines as line')
				.innerJoin('accounting_accounts as account', (join) =>
					join
						.onRef('account.id', '=', 'line.accounting_account_id')
						.onRef('account.organisation_id', '=', 'line.organisation_id')
				)
				.select([
					'account.account_code as accountCode',
					'account.name as accountName',
					'line.description',
					'line.debit_amount as debitAmount',
					'line.credit_amount as creditAmount'
				])
				.where('line.organisation_id', '=', actor.organisationId)
				.where('line.journal_entry_id', '=', journal.id)
				.orderBy('line.line_number')
				.execute();
			journals.push({ ...journal, lines });
		}
		const exports = await this.db
			.selectFrom('accounting_export_batches as batch')
			.leftJoin('accounting_export_reversals as reversal', (join) =>
				join
					.onRef('reversal.accounting_export_batch_id', '=', 'batch.id')
					.onRef('reversal.organisation_id', '=', 'batch.organisation_id')
			)
			.select([
				'batch.public_id as publicId',
				'batch.export_number as exportNumber',
				'batch.period_start as periodStart',
				'batch.period_end as periodEnd',
				'batch.row_count as rowCount',
				'batch.content_sha256 as contentSha256',
				'batch.created_at as createdAt',
				'reversal.reversed_at as reversedAt'
			])
			.where('batch.organisation_id', '=', actor.organisationId)
			.orderBy('batch.created_at', 'desc')
			.limit(50)
			.execute();
		return {
			accounts: accountRows.map((row) => ({ ...row, isActive: row.isActive === 1 })),
			mappings: mappingRows,
			candidates,
			journals,
			exports,
			canConfigure: configure.allowed,
			canPost: post.allowed,
			canReverse: reverse.allowed,
			canExport: exportDecision.allowed,
			canReverseExport: reverseExport.allowed
		};
	}

	async createAccount(
		actor: TenantActorContext,
		input: { accountCode: string; name: string; accountType: string }
	): Promise<{ publicId: string }> {
		const accountCode = cleanAccountCode(input.accountCode);
		const name = cleanFinanceText(input.name, 160, 'Account name', true)!;
		const accountType = input.accountType.trim();
		if (!ACCOUNT_TYPES.has(accountType))
			throw new FinanceValidationError('Account type is invalid.');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.configure', trx)).allowed)
				throw new TenantAccessError('Accounting configuration is not permitted.');
			const existing = await trx
				.selectFrom('accounting_accounts')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('account_code', '=', accountCode)
				.forUpdate()
				.executeTakeFirst();
			if (existing) return { publicId: existing.publicId };
			const publicId = this.publicIdFactory();
			await trx
				.insertInto('accounting_accounts')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					account_code: accountCode,
					name,
					account_type: accountType,
					normal_balance: accountNormalBalance(accountType),
					is_active: 1,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.account.created',
				subjectType: 'accounting_account',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					accountCode,
					name,
					accountType,
					normalBalance: accountNormalBalance(accountType)
				}
			});
			return { publicId };
		});
	}

	async assignMapping(
		actor: TenantActorContext,
		input: { mappingKey: string; accountPublicId: string; reason: string }
	): Promise<void> {
		const mappingKey = cleanMappingKey(input.mappingKey);
		const accountPublicId = cleanFinanceText(
			input.accountPublicId,
			64,
			'Accounting account ID',
			true
		)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Mapping reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.configure', trx)).allowed)
				throw new TenantAccessError('Accounting configuration is not permitted.');
			const account = await trx
				.selectFrom('accounting_accounts')
				.select([
					'id',
					'account_type as accountType',
					'is_active as isActive',
					'account_code as accountCode'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', accountPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!account) throw new RecordNotFoundError('Accounting account not found.');
			if (account.isActive !== 1)
				throw new FinanceValidationError('Only an active accounting account can be mapped.');
			if (account.accountType !== EXPECTED_MAPPING_ACCOUNT_TYPES[mappingKey])
				throw new FinanceValidationError(
					`${mappingKey} must map to an ${EXPECTED_MAPPING_ACCOUNT_TYPES[mappingKey]} account.`
				);
			await trx
				.insertInto('accounting_account_mappings')
				.values({
					organisation_id: actor.organisationId,
					mapping_key: mappingKey,
					accounting_account_id: account.id,
					assigned_by_member_id: membership.id,
					assigned_at: this.now(),
					reason
				})
				.onDuplicateKeyUpdate({
					accounting_account_id: account.id,
					assigned_by_member_id: membership.id,
					assigned_at: this.now(),
					reason
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.mapping.assigned',
				subjectType: 'accounting_mapping',
				subjectPublicId: mappingKey,
				correlationId: actor.correlationId,
				changeSummary: { mappingKey, accountPublicId, accountCode: account.accountCode, reason }
			});
		});
	}

	async postSource(
		actor: TenantActorContext,
		input: {
			sourceType: string;
			sourcePublicId: string;
			accountingDate?: string | null;
			memo?: string | null;
		}
	): Promise<{ publicId: string; journalNumber: string }> {
		const sourceType = cleanSourceType(input.sourceType);
		const sourcePublicId = cleanFinanceText(
			input.sourcePublicId,
			64,
			'Accounting source ID',
			true
		)!;
		const suppliedAccountingDate = validateFinanceDate(input.accountingDate, 'Accounting date');
		const suppliedMemo = cleanFinanceText(input.memo, 1000, 'Journal memo');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.post', trx)).allowed)
				throw new TenantAccessError('Accounting journal posting is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const candidate = await resolveAccountingSourceCandidate(
				trx,
				actor.organisationId,
				sourceType,
				sourcePublicId,
				true
			);
			const active = await activeJournalForSource(
				trx,
				actor.organisationId,
				sourceType,
				candidate.sourcePublicId
			);
			if (active)
				throw new FinanceValidationError(
					'This source event already has an active accounting journal.'
				);
			const accountingDate = suppliedAccountingDate ?? dateOnly(candidate.sourceEventAt);
			await assertOpenAccountingPeriod(trx, actor.organisationId, accountingDate);
			const mappings = new Map<string, { id: string; code: string; active: number }>();
			for (const key of [...new Set(candidate.lines.map((entry) => entry.mappingKey))]) {
				const mapping = await trx
					.selectFrom('accounting_account_mappings as mapping')
					.innerJoin('accounting_accounts as account', (join) =>
						join
							.onRef('account.id', '=', 'mapping.accounting_account_id')
							.onRef('account.organisation_id', '=', 'mapping.organisation_id')
					)
					.select(['account.id', 'account.account_code as code', 'account.is_active as active'])
					.where('mapping.organisation_id', '=', actor.organisationId)
					.where('mapping.mapping_key', '=', key)
					.forUpdate()
					.executeTakeFirst();
				if (!mapping || mapping.active !== 1)
					throw new FinanceValidationError(`Accounting mapping ${key} is missing or inactive.`);
				mappings.set(key, mapping);
			}
			const journalNumber = await nextJournalNumber(trx, actor.organisationId);
			const publicId = this.publicIdFactory();
			const result = await trx
				.insertInto('accounting_journal_entries')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					journal_number: journalNumber,
					source_type: candidate.sourceType,
					source_public_id: candidate.sourcePublicId,
					source_event_at: candidate.sourceEventAt,
					source_amount: candidate.sourceAmount,
					source_fingerprint: candidate.fingerprint,
					accounting_date: accountingDate,
					currency_code: candidate.currencyCode,
					memo: suppliedMemo ?? candidate.memo,
					posted_by_member_id: membership.id,
					posted_at: this.now()
				})
				.executeTakeFirstOrThrow();
			const journalId = insertedId(result);
			await trx
				.insertInto('accounting_journal_lines')
				.values(
					candidate.lines.map((entry, index) => ({
						organisation_id: actor.organisationId,
						journal_entry_id: journalId,
						accounting_account_id: mappings.get(entry.mappingKey)!.id,
						line_number: index + 1,
						description: entry.description,
						debit_amount: entry.debitAmount,
						credit_amount: entry.creditAmount
					}))
				)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.journal.posted',
				subjectType: 'accounting_journal',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					journalNumber,
					sourceType: candidate.sourceType,
					sourcePublicId: candidate.sourcePublicId,
					sourceAmount: candidate.sourceAmount,
					currencyCode: candidate.currencyCode,
					sourceFingerprint: candidate.fingerprint,
					accountingDate,
					lineCount: candidate.lines.length
				}
			});
			return { publicId, journalNumber };
		});
	}

	async reverseJournal(
		actor: TenantActorContext,
		input: { journalPublicId: string; accountingDate?: string | null; reason: string }
	): Promise<{ publicId: string; journalNumber: string }> {
		const journalPublicId = cleanFinanceText(input.journalPublicId, 64, 'Journal ID', true)!;
		const accountingDate =
			validateFinanceDate(input.accountingDate, 'Accounting date') ?? dateOnly(this.now());
		const reason = cleanFinanceText(input.reason, 1000, 'Journal reversal reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.reverse', trx)).allowed)
				throw new TenantAccessError('Accounting journal reversal is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			await assertOpenAccountingPeriod(trx, actor.organisationId, accountingDate);
			const original = await trx
				.selectFrom('accounting_journal_entries')
				.select([
					'id',
					'public_id as publicId',
					'journal_number as journalNumber',
					'currency_code as currencyCode',
					'source_amount as sourceAmount'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', journalPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!original) throw new RecordNotFoundError('Accounting journal not found.');
			if (
				await trx
					.selectFrom('accounting_journal_entry_reversals')
					.select('journal_entry_id')
					.where('organisation_id', '=', actor.organisationId)
					.where('journal_entry_id', '=', original.id)
					.forUpdate()
					.executeTakeFirst()
			)
				throw new FinanceValidationError('The accounting journal is already reversed.');
			const lines = await trx
				.selectFrom('accounting_journal_lines')
				.select([
					'accounting_account_id as accountId',
					'line_number as lineNumber',
					'description',
					'debit_amount as debitAmount',
					'credit_amount as creditAmount'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('journal_entry_id', '=', original.id)
				.orderBy('line_number')
				.forUpdate()
				.execute();
			if (lines.length === 0)
				throw new FinanceValidationError('The accounting journal has no lines to reverse.');
			const fingerprint = createHash('sha256')
				.update(
					JSON.stringify({
						originalJournalPublicId: original.publicId,
						originalJournalNumber: original.journalNumber,
						lines
					})
				)
				.digest('hex');
			const journalNumber = await nextJournalNumber(trx, actor.organisationId);
			const publicId = this.publicIdFactory();
			const result = await trx
				.insertInto('accounting_journal_entries')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					journal_number: journalNumber,
					source_type: 'journal_reversal',
					source_public_id: original.publicId,
					source_event_at: this.now(),
					source_amount: original.sourceAmount,
					source_fingerprint: fingerprint,
					accounting_date: accountingDate,
					currency_code: original.currencyCode,
					memo: `Reverse ${original.journalNumber}: ${reason}`,
					posted_by_member_id: membership.id,
					posted_at: this.now()
				})
				.executeTakeFirstOrThrow();
			const reversalId = insertedId(result);
			await trx
				.insertInto('accounting_journal_lines')
				.values(
					lines.map((entry) => ({
						organisation_id: actor.organisationId,
						journal_entry_id: reversalId,
						accounting_account_id: entry.accountId,
						line_number: entry.lineNumber,
						description: `Reverse: ${entry.description}`,
						debit_amount: entry.creditAmount,
						credit_amount: entry.debitAmount
					}))
				)
				.execute();
			await trx
				.insertInto('accounting_journal_entry_reversals')
				.values({
					journal_entry_id: original.id,
					organisation_id: actor.organisationId,
					reversal_journal_entry_id: reversalId,
					reversed_by_member_id: membership.id,
					reversed_at: this.now(),
					reason
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.journal.reversed',
				subjectType: 'accounting_journal',
				subjectPublicId: original.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					originalJournalNumber: original.journalNumber,
					reversalJournalPublicId: publicId,
					reversalJournalNumber: journalNumber,
					accountingDate,
					reason
				}
			});
			return { publicId, journalNumber };
		});
	}

	private async exportRows(db: DatabaseExecutor, organisationId: string, journalIds: string[]) {
		if (journalIds.length === 0) return [];
		return db
			.selectFrom('accounting_journal_entries as journal')
			.innerJoin('accounting_journal_lines as line', (join) =>
				join
					.onRef('line.journal_entry_id', '=', 'journal.id')
					.onRef('line.organisation_id', '=', 'journal.organisation_id')
			)
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'line.accounting_account_id')
					.onRef('account.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'journal.id as journalId',
				'journal.journal_number as journalNumber',
				'journal.accounting_date as accountingDate',
				'journal.source_type as sourceType',
				'journal.source_public_id as sourcePublicId',
				'journal.currency_code as currencyCode',
				'journal.memo',
				'line.line_number as lineNumber',
				'account.account_code as accountCode',
				'account.name as accountName',
				'line.description',
				'line.debit_amount as debitAmount',
				'line.credit_amount as creditAmount'
			])
			.where('journal.organisation_id', '=', organisationId)
			.where('journal.id', 'in', journalIds)
			.orderBy('journal.accounting_date')
			.orderBy('journal.journal_number')
			.orderBy('line.line_number')
			.execute();
	}

	private csvContent(rows: Awaited<ReturnType<AccountingService['exportRows']>>): string {
		const header = [
			'journal_number',
			'accounting_date',
			'source_type',
			'source_public_id',
			'currency_code',
			'account_code',
			'account_name',
			'description',
			'debit',
			'credit',
			'memo'
		];
		const data = rows.map((row) =>
			[
				row.journalNumber,
				row.accountingDate.toISOString().slice(0, 10),
				row.sourceType,
				row.sourcePublicId,
				row.currencyCode,
				row.accountCode,
				row.accountName,
				row.description,
				row.debitAmount,
				row.creditAmount,
				row.memo
			]
				.map(csvEscape)
				.join(',')
		);
		return `${header.join(',')}\n${data.join('\n')}\n`;
	}

	async createExport(
		actor: TenantActorContext,
		input: { periodStart: string; periodEnd: string; reason: string }
	): Promise<{ publicId: string; exportNumber: string; content: string }> {
		const periodStart = validateFinanceDate(input.periodStart, 'Export period start');
		const periodEnd = validateFinanceDate(input.periodEnd, 'Export period end');
		if (!periodStart || !periodEnd || periodEnd < periodStart)
			throw new FinanceValidationError('Accounting export period is invalid.');
		const reason = cleanFinanceText(input.reason, 1000, 'Accounting export reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.export', trx)).allowed)
				throw new TenantAccessError('Accounting export is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			await assertAccountingExportPeriod(trx, actor.organisationId, periodStart, periodEnd);
			const journalRows = await trx
				.selectFrom('accounting_journal_entries as journal')
				.select(['journal.id', 'journal.accounting_date as accountingDate'])
				.where('journal.organisation_id', '=', actor.organisationId)
				.where('journal.accounting_date', '>=', periodStart)
				.where('journal.accounting_date', '<=', periodEnd)
				.orderBy('journal.accounting_date')
				.orderBy('journal.journal_number')
				.forUpdate()
				.execute();
			const eligible: string[] = [];
			for (const journal of journalRows) {
				const activeExport = await trx
					.selectFrom('accounting_export_batch_entries as item')
					.innerJoin('accounting_export_batches as batch', (join) =>
						join
							.onRef('batch.id', '=', 'item.accounting_export_batch_id')
							.onRef('batch.organisation_id', '=', 'item.organisation_id')
					)
					.leftJoin('accounting_export_reversals as reversal', (join) =>
						join
							.onRef('reversal.accounting_export_batch_id', '=', 'batch.id')
							.onRef('reversal.organisation_id', '=', 'batch.organisation_id')
					)
					.select('batch.id')
					.where('item.organisation_id', '=', actor.organisationId)
					.where('item.journal_entry_id', '=', journal.id)
					.where('reversal.accounting_export_batch_id', 'is', null)
					.executeTakeFirst();
				if (!activeExport) eligible.push(journal.id);
			}
			if (eligible.length === 0)
				throw new FinanceValidationError(
					'No unexported accounting journals exist in the selected period.'
				);
			const rows = await this.exportRows(trx, actor.organisationId, eligible);
			if (rows.length === 0)
				throw new FinanceValidationError(
					'No accounting journal lines exist in the selected period.'
				);
			const content = this.csvContent(rows);
			const contentSha256 = createHash('sha256').update(content).digest('hex');
			const exportNumber = await nextExportNumber(trx, actor.organisationId);
			const publicId = this.publicIdFactory();
			const result = await trx
				.insertInto('accounting_export_batches')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					export_number: exportNumber,
					export_format: 'generic_csv',
					period_start: periodStart,
					period_end: periodEnd,
					row_count: rows.length,
					content_sha256: contentSha256,
					created_by_member_id: membership.id,
					created_at: this.now(),
					reason
				})
				.executeTakeFirstOrThrow();
			const exportId = insertedId(result);
			await trx
				.insertInto('accounting_export_batch_entries')
				.values(
					eligible.map((journalId, index) => ({
						accounting_export_batch_id: exportId,
						organisation_id: actor.organisationId,
						journal_entry_id: journalId,
						sequence_number: index + 1
					}))
				)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.export.created',
				subjectType: 'accounting_export',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					exportNumber,
					periodStart,
					periodEnd,
					journalCount: eligible.length,
					rowCount: rows.length,
					contentSha256,
					reason
				}
			});
			return { publicId, exportNumber, content };
		});
	}

	async getExportContent(
		actor: TenantActorContext,
		exportPublicId: string
	): Promise<{ filename: string; content: string; contentSha256: string }> {
		await this.assertView(actor);
		const publicId = cleanFinanceText(exportPublicId, 64, 'Accounting export ID', true)!;
		const batch = await this.db
			.selectFrom('accounting_export_batches')
			.select(['id', 'export_number as exportNumber', 'content_sha256 as contentSha256'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		if (!batch) throw new RecordNotFoundError('Accounting export not found.');
		const items = await this.db
			.selectFrom('accounting_export_batch_entries')
			.select(['journal_entry_id as journalId'])
			.where('organisation_id', '=', actor.organisationId)
			.where('accounting_export_batch_id', '=', batch.id)
			.orderBy('sequence_number')
			.execute();
		const content = this.csvContent(
			await this.exportRows(
				this.db,
				actor.organisationId,
				items.map((item) => item.journalId)
			)
		);
		const actual = createHash('sha256').update(content).digest('hex');
		if (actual !== batch.contentSha256)
			throw new FinanceValidationError(
				'Accounting export content no longer matches its persisted checksum evidence.'
			);
		return { filename: `${batch.exportNumber}.csv`, content, contentSha256: actual };
	}

	async reverseExport(
		actor: TenantActorContext,
		input: { exportPublicId: string; reason: string }
	): Promise<void> {
		const exportPublicId = cleanFinanceText(
			input.exportPublicId,
			64,
			'Accounting export ID',
			true
		)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Accounting export reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.accounting.export.reverse', trx)).allowed)
				throw new TenantAccessError('Accounting export reversal is not permitted.');
			await trx
				.selectFrom('organisations')
				.select('id')
				.where('id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const batch = await trx
				.selectFrom('accounting_export_batches')
				.select([
					'id',
					'export_number as exportNumber',
					'content_sha256 as contentSha256',
					'period_start as periodStart',
					'period_end as periodEnd'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', exportPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!batch) throw new RecordNotFoundError('Accounting export not found.');
			await assertAccountingExportReversalAllowed(
				trx,
				actor.organisationId,
				batch.periodStart,
				batch.periodEnd
			);
			if (
				await trx
					.selectFrom('accounting_export_reversals')
					.select('accounting_export_batch_id')
					.where('organisation_id', '=', actor.organisationId)
					.where('accounting_export_batch_id', '=', batch.id)
					.forUpdate()
					.executeTakeFirst()
			)
				throw new FinanceValidationError('The accounting export is already reversed.');
			const reversedAt = this.now();
			await trx
				.insertInto('accounting_export_reversals')
				.values({
					accounting_export_batch_id: batch.id,
					organisation_id: actor.organisationId,
					reversed_by_member_id: membership.id,
					reversed_at: reversedAt,
					reason
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.accounting.export.reversed',
				subjectType: 'accounting_export',
				subjectPublicId: exportPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					exportNumber: batch.exportNumber,
					contentSha256: batch.contentSha256,
					reversedAt,
					reason
				}
			});
		});
	}
}
