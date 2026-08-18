import { createHash, randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, cleanFinanceText, insertedId, validateCurrencyCode } from './finance-common';

type CloseLine = {
	accountId: string;
	accountPublicId: string;
	accountCode: string;
	accountName: string;
	accountType: 'revenue' | 'expense';
	debit: bigint;
	credit: bigint;
};

type CloseSnapshot = {
	revenueTotal: bigint;
	expenseTotal: bigint;
	profitLoss: bigint;
	closingDebitTotal: bigint;
	closingCreditTotal: bigint;
	fingerprint: string;
	lines: CloseLine[];
};

function money(value: unknown): bigint {
	return parseScaledDecimal(String(value), 4, 'Year-end amount', true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, 4);
}

function abs(value: bigint): bigint {
	return value < 0n ? -value : value;
}

async function lockOrganisation(db: DatabaseExecutor, organisationId: string): Promise<void> {
	await db.selectFrom('organisations').select('id').where('id', '=', organisationId).forUpdate().executeTakeFirstOrThrow();
}

async function nextJournalNumber(db: DatabaseExecutor, organisationId: string): Promise<string> {
	const rows = await db
		.selectFrom('accounting_journal_entries')
		.select('journal_number as journalNumber')
		.where('organisation_id', '=', organisationId)
		.orderBy('id')
		.forUpdate()
		.execute();
	let max = 0;
	for (const row of rows) {
		const match = /^JRN-(\d+)$/.exec(row.journalNumber);
		if (match) max = Math.max(max, Number(match[1]));
	}
	return `JRN-${String(max + 1).padStart(6, '0')}`;
}

async function deriveSnapshot(
	db: DatabaseExecutor,
	organisationId: string,
	year: { id: string; startsOn: Date; endsOn: Date },
	currencyCode: string
): Promise<CloseSnapshot> {
	const periods = await db
		.selectFrom('accounting_periods')
		.select(['id', 'period_number as periodNumber', 'starts_on as startsOn', 'ends_on as endsOn', 'status'])
		.where('organisation_id', '=', organisationId)
		.where('financial_year_id', '=', year.id)
		.orderBy('period_number')
		.forUpdate()
		.execute();
	if (periods.length === 0) throw new FinanceValidationError('The financial year has no configured accounting periods.');
	if (periods.some((period) => period.status !== 'hard_closed')) {
		throw new FinanceValidationError('Every accounting period in the financial year must be hard closed before year-end close.');
	}
	if (periods[0]!.startsOn.getTime() !== year.startsOn.getTime() || periods.at(-1)!.endsOn.getTime() !== year.endsOn.getTime()) {
		throw new FinanceValidationError('Accounting periods must cover the complete financial year before year-end close.');
	}
	for (let index = 1; index < periods.length; index += 1) {
		const previous = periods[index - 1]!;
		const current = periods[index]!;
		const expected = new Date(previous.endsOn);
		expected.setUTCDate(expected.getUTCDate() + 1);
		if (expected.getTime() !== current.startsOn.getTime()) {
			throw new FinanceValidationError('Accounting periods must cover the financial year without gaps before year-end close.');
		}
	}

	const rows = await db
		.selectFrom('accounting_journal_lines as line')
		.innerJoin('accounting_journal_entries as journal', (join) =>
			join.onRef('journal.id', '=', 'line.journal_entry_id').onRef('journal.organisation_id', '=', 'line.organisation_id')
		)
		.innerJoin('accounting_accounts as account', (join) =>
			join.onRef('account.id', '=', 'line.accounting_account_id').onRef('account.organisation_id', '=', 'line.organisation_id')
		)
		.select([
			'account.id as accountId',
			'account.public_id as accountPublicId',
			'account.account_code as accountCode',
			'account.name as accountName',
			'account.account_type as accountType',
			'line.debit_amount as debitAmount',
			'line.credit_amount as creditAmount',
			'journal.public_id as journalPublicId',
			'journal.accounting_date as accountingDate',
			'journal.source_fingerprint as sourceFingerprint'
		])
		.where('journal.organisation_id', '=', organisationId)
		.where('journal.currency_code', '=', currencyCode)
		.where('journal.accounting_date', '>=', year.startsOn)
		.where('journal.accounting_date', '<=', year.endsOn)
		.where('account.account_type', 'in', ['revenue', 'expense'])
		.orderBy('journal.id')
		.orderBy('line.line_number')
		.forUpdate()
		.execute();
	if (rows.length === 0) throw new FinanceValidationError('No revenue or expense journal movement exists for this financial year and currency.');

	const accounts = new Map<string, { publicId: string; code: string; name: string; type: 'revenue' | 'expense'; debit: bigint; credit: bigint }>();
	for (const row of rows) {
		const key = String(row.accountId);
		const existing = accounts.get(key) ?? {
			publicId: row.accountPublicId,
			code: row.accountCode,
			name: row.accountName,
			type: row.accountType as 'revenue' | 'expense',
			debit: 0n,
			credit: 0n
		};
		existing.debit += money(row.debitAmount);
		existing.credit += money(row.creditAmount);
		accounts.set(key, existing);
	}

	const lines: CloseLine[] = [];
	let revenueTotal = 0n;
	let expenseTotal = 0n;
	let closingDebitTotal = 0n;
	let closingCreditTotal = 0n;
	for (const [accountId, account] of [...accounts.entries()].sort((a, b) => a[1].code.localeCompare(b[1].code))) {
		const natural = account.type === 'revenue' ? account.credit - account.debit : account.debit - account.credit;
		if (natural === 0n) continue;
		if (account.type === 'revenue') revenueTotal += natural;
		else expenseTotal += natural;
		const debit = account.type === 'revenue' ? (natural > 0n ? natural : 0n) : (natural < 0n ? -natural : 0n);
		const credit = account.type === 'expense' ? (natural > 0n ? natural : 0n) : (natural < 0n ? -natural : 0n);
		closingDebitTotal += debit;
		closingCreditTotal += credit;
		lines.push({ accountId, accountPublicId: account.publicId, accountCode: account.code, accountName: account.name, accountType: account.type, debit, credit });
	}
	const profitLoss = revenueTotal - expenseTotal;
	if (profitLoss > 0n) closingCreditTotal += profitLoss;
	else if (profitLoss < 0n) closingDebitTotal += -profitLoss;
	if (closingDebitTotal <= 0n || closingDebitTotal !== closingCreditTotal) {
		throw new FinanceValidationError('Derived year-end close is not a non-zero balanced journal.');
	}

	const fingerprintPayload = {
		year: [year.startsOn.toISOString().slice(0, 10), year.endsOn.toISOString().slice(0, 10)],
		currencyCode,
		periods: periods.map((period) => [Number(period.periodNumber), period.startsOn.toISOString().slice(0, 10), period.endsOn.toISOString().slice(0, 10), period.status]),
		sources: rows.map((row) => [row.journalPublicId, row.accountingDate.toISOString().slice(0, 10), row.sourceFingerprint, row.accountPublicId, String(row.debitAmount), String(row.creditAmount)])
	};
	return {
		revenueTotal,
		expenseTotal,
		profitLoss,
		closingDebitTotal,
		closingCreditTotal,
		fingerprint: createHash('sha256').update(JSON.stringify(fingerprintPayload)).digest('hex'),
		lines
	};
}

export class AccountingYearEndService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertView(actor: TenantActorContext): Promise<void> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const [financeView, accountingView] = await Promise.all([policy.viewDecision(actor), policy.accountingViewDecision(actor)]);
		if (!financeView.allowed || !accountingView.allowed) throw new TenantAccessError('Year-end accounting viewing is not permitted.');
	}

	async getWorkspace(actor: TenantActorContext) {
		await this.assertView(actor);
		const permissions = new PermissionService(this.db);
		const [prepareDecision, authoriseDecision, reverseDecision, years, preparations, closes] = await Promise.all([
			permissions.decideWithUmbrella(actor, 'finance.accounting.year_end.prepare', 'finance.manage'),
			permissions.decideWithUmbrella(actor, 'finance.accounting.year_end.authorise', 'finance.manage'),
			permissions.decideWithUmbrella(actor, 'finance.accounting.year_end.reverse', 'finance.manage'),
			this.db.selectFrom('accounting_financial_years').select(['public_id as publicId', 'year_code as yearCode', 'name', 'starts_on as startsOn', 'ends_on as endsOn']).where('organisation_id', '=', actor.organisationId).orderBy('ends_on', 'desc').execute(),
			this.db.selectFrom('accounting_year_end_close_preparations').select(['public_id as publicId', 'financial_year_id as financialYearId', 'currency_code as currencyCode', 'preparation_sequence as preparationSequence', 'revenue_total as revenueTotal', 'expense_total as expenseTotal', 'profit_loss_amount as profitLossAmount', 'source_fingerprint as sourceFingerprint', 'prepared_by_member_id as preparedByMemberId', 'prepared_at as preparedAt', 'reason']).where('organisation_id', '=', actor.organisationId).orderBy('prepared_at', 'desc').limit(100).execute(),
			this.db.selectFrom('accounting_year_end_closes as close').leftJoin('accounting_year_end_close_reversals as reversal', (join) => join.onRef('reversal.year_end_close_id', '=', 'close.id').onRef('reversal.organisation_id', '=', 'close.organisation_id')).select(['close.public_id as publicId', 'close.financial_year_id as financialYearId', 'close.preparation_id as preparationId', 'close.currency_code as currencyCode', 'close.close_sequence as closeSequence', 'close.authorised_at as authorisedAt', 'reversal.reversed_at as reversedAt']).where('close.organisation_id', '=', actor.organisationId).orderBy('close.authorised_at', 'desc').limit(100).execute()
		]);
		return {
			financialYears: years,
			preparations,
			closes,
			canPrepare: prepareDecision.allowed,
			canAuthorise: authoriseDecision.allowed,
			canReverse: reverseDecision.allowed
		};
	}

	async prepare(actor: TenantActorContext, input: { financialYearPublicId: string; currencyCode: string; reason: string }) {
		const financialYearPublicId = cleanFinanceText(input.financialYearPublicId, 64, 'Financial year ID', true)!;
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Year-end currency');
		if (!currencyCode) throw new FinanceValidationError('Year-end currency is required.');
		const reason = cleanFinanceText(input.reason, 1000, 'Preparation reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await new PermissionService(trx).decideWithUmbrella(actor, 'finance.accounting.year_end.prepare', 'finance.manage')).allowed) throw new TenantAccessError('Year-end close preparation is not permitted.');
			await lockOrganisation(trx, actor.organisationId);
			const year = await trx.selectFrom('accounting_financial_years').select(['id', 'public_id as publicId', 'starts_on as startsOn', 'ends_on as endsOn']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', financialYearPublicId).forUpdate().executeTakeFirst();
			if (!year) throw new RecordNotFoundError('Financial year not found.');
			const active = await trx.selectFrom('accounting_year_end_closes as close').leftJoin('accounting_year_end_close_reversals as reversal', (join) => join.onRef('reversal.year_end_close_id', '=', 'close.id').onRef('reversal.organisation_id', '=', 'close.organisation_id')).select('close.id').where('close.organisation_id', '=', actor.organisationId).where('close.financial_year_id', '=', year.id).where('close.currency_code', '=', currencyCode).where('reversal.year_end_close_id', 'is', null).forUpdate().executeTakeFirst();
			if (active) throw new FinanceValidationError('An active authorised year-end close already exists for this financial year and currency.');
			const retained = await trx.selectFrom('accounting_account_mappings as mapping').innerJoin('accounting_accounts as account', (join) => join.onRef('account.id', '=', 'mapping.accounting_account_id').onRef('account.organisation_id', '=', 'mapping.organisation_id')).select(['account.id', 'account.account_type as accountType', 'account.is_active as isActive']).where('mapping.organisation_id', '=', actor.organisationId).where('mapping.mapping_key', '=', 'retained_earnings').forUpdate().executeTakeFirst();
			if (!retained || retained.accountType !== 'equity' || retained.isActive !== 1) throw new FinanceValidationError('An active equity account must be mapped to retained earnings before year-end close.');
			const snapshot = await deriveSnapshot(trx, actor.organisationId, year, currencyCode);
			const prior = await trx.selectFrom('accounting_year_end_close_preparations').select('preparation_sequence as sequence').where('organisation_id', '=', actor.organisationId).where('financial_year_id', '=', year.id).where('currency_code', '=', currencyCode).orderBy('preparation_sequence', 'desc').forUpdate().executeTakeFirst();
			const publicId = this.publicIdFactory();
			await trx.insertInto('accounting_year_end_close_preparations').values({ organisation_id: actor.organisationId, public_id: publicId, financial_year_id: year.id, preparation_sequence: Number(prior?.sequence ?? 0) + 1, currency_code: currencyCode, revenue_total: moneyText(snapshot.revenueTotal), expense_total: moneyText(snapshot.expenseTotal), profit_loss_amount: moneyText(snapshot.profitLoss), closing_debit_total: moneyText(snapshot.closingDebitTotal), closing_credit_total: moneyText(snapshot.closingCreditTotal), source_fingerprint: snapshot.fingerprint, prepared_by_member_id: membership.id, prepared_at: this.now(), reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.accounting.year_end.prepared', subjectType: 'accounting_year_end_close_preparation', subjectPublicId: publicId, correlationId: actor.correlationId, changeSummary: { financialYearPublicId, currencyCode, revenueTotal: moneyText(snapshot.revenueTotal), expenseTotal: moneyText(snapshot.expenseTotal), profitLossAmount: moneyText(snapshot.profitLoss), sourceFingerprint: snapshot.fingerprint, reason } });
			return { publicId, sourceFingerprint: snapshot.fingerprint };
		});
	}

	async authorise(actor: TenantActorContext, input: { preparationPublicId: string; reason: string }) {
		const preparationPublicId = cleanFinanceText(input.preparationPublicId, 64, 'Preparation ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Authorisation reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await new PermissionService(trx).decideWithUmbrella(actor, 'finance.accounting.year_end.authorise', 'finance.manage')).allowed) throw new TenantAccessError('Year-end close authorisation is not permitted.');
			await lockOrganisation(trx, actor.organisationId);
			const preparation = await trx.selectFrom('accounting_year_end_close_preparations as preparation').innerJoin('accounting_financial_years as year', (join) => join.onRef('year.id', '=', 'preparation.financial_year_id').onRef('year.organisation_id', '=', 'preparation.organisation_id')).select(['preparation.id', 'preparation.public_id as publicId', 'preparation.financial_year_id as financialYearId', 'preparation.currency_code as currencyCode', 'preparation.source_fingerprint as sourceFingerprint', 'preparation.prepared_by_member_id as preparedByMemberId', 'year.public_id as financialYearPublicId', 'year.starts_on as startsOn', 'year.ends_on as endsOn']).where('preparation.organisation_id', '=', actor.organisationId).where('preparation.public_id', '=', preparationPublicId).forUpdate().executeTakeFirst();
			if (!preparation) throw new RecordNotFoundError('Year-end close preparation not found.');
			if (preparation.preparedByMemberId === membership.id) throw new FinanceValidationError('The member who prepared a year-end close cannot authorise the same preparation.');
			if (await trx.selectFrom('accounting_year_end_closes').select('id').where('organisation_id', '=', actor.organisationId).where('preparation_id', '=', preparation.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('This year-end preparation has already been authorised.');
			const active = await trx.selectFrom('accounting_year_end_closes as close').leftJoin('accounting_year_end_close_reversals as reversal', (join) => join.onRef('reversal.year_end_close_id', '=', 'close.id').onRef('reversal.organisation_id', '=', 'close.organisation_id')).select('close.id').where('close.organisation_id', '=', actor.organisationId).where('close.financial_year_id', '=', preparation.financialYearId).where('close.currency_code', '=', preparation.currencyCode).where('reversal.year_end_close_id', 'is', null).forUpdate().executeTakeFirst();
			if (active) throw new FinanceValidationError('An active authorised year-end close already exists for this financial year and currency.');
			const retained = await trx.selectFrom('accounting_account_mappings as mapping').innerJoin('accounting_accounts as account', (join) => join.onRef('account.id', '=', 'mapping.accounting_account_id').onRef('account.organisation_id', '=', 'mapping.organisation_id')).select(['account.id', 'account.public_id as publicId', 'account.account_code as accountCode', 'account.name', 'account.account_type as accountType', 'account.is_active as isActive']).where('mapping.organisation_id', '=', actor.organisationId).where('mapping.mapping_key', '=', 'retained_earnings').forUpdate().executeTakeFirst();
			if (!retained || retained.accountType !== 'equity' || retained.isActive !== 1) throw new FinanceValidationError('An active equity account must be mapped to retained earnings before authorisation.');
			const snapshot = await deriveSnapshot(trx, actor.organisationId, { id: preparation.financialYearId, startsOn: preparation.startsOn, endsOn: preparation.endsOn }, preparation.currencyCode);
			if (snapshot.fingerprint !== preparation.sourceFingerprint) throw new FinanceValidationError('The preparation is stale because governed accounting evidence changed; prepare the year-end close again.');
			const journalNumber = await nextJournalNumber(trx, actor.organisationId);
			const journalPublicId = this.publicIdFactory();
			const journalResult = await trx.insertInto('accounting_journal_entries').values({ organisation_id: actor.organisationId, public_id: journalPublicId, journal_number: journalNumber, source_type: 'year_end_close', source_public_id: preparation.publicId, source_event_at: this.now(), source_amount: moneyText(snapshot.closingDebitTotal), source_fingerprint: snapshot.fingerprint, accounting_date: preparation.endsOn, currency_code: preparation.currencyCode, memo: `Year-end close ${preparation.financialYearPublicId}: ${reason}`, posted_by_member_id: membership.id, posted_at: this.now() }).executeTakeFirstOrThrow();
			const journalId = insertedId(journalResult);
			const journalLines = snapshot.lines.map((line, index) => ({ organisation_id: actor.organisationId, journal_entry_id: journalId, accounting_account_id: line.accountId, line_number: index + 1, description: `Year-end close ${line.accountCode} · ${line.accountName}`, debit_amount: moneyText(line.debit), credit_amount: moneyText(line.credit) }));
			journalLines.push({ organisation_id: actor.organisationId, journal_entry_id: journalId, accounting_account_id: retained.id, line_number: journalLines.length + 1, description: `Year-end retained earnings · ${retained.accountCode} · ${retained.name}`, debit_amount: moneyText(snapshot.profitLoss < 0n ? -snapshot.profitLoss : 0n), credit_amount: moneyText(snapshot.profitLoss > 0n ? snapshot.profitLoss : 0n) });
			await trx.insertInto('accounting_journal_lines').values(journalLines).execute();
			const prior = await trx.selectFrom('accounting_year_end_closes').select('close_sequence as sequence').where('organisation_id', '=', actor.organisationId).where('financial_year_id', '=', preparation.financialYearId).where('currency_code', '=', preparation.currencyCode).orderBy('close_sequence', 'desc').forUpdate().executeTakeFirst();
			const closePublicId = this.publicIdFactory();
			await trx.insertInto('accounting_year_end_closes').values({ organisation_id: actor.organisationId, public_id: closePublicId, financial_year_id: preparation.financialYearId, preparation_id: preparation.id, close_sequence: Number(prior?.sequence ?? 0) + 1, currency_code: preparation.currencyCode, closing_journal_entry_id: journalId, authorised_by_member_id: membership.id, authorised_at: this.now(), reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.accounting.year_end.authorised', subjectType: 'accounting_year_end_close', subjectPublicId: closePublicId, correlationId: actor.correlationId, changeSummary: { preparationPublicId, journalPublicId, journalNumber, currencyCode: preparation.currencyCode, sourceFingerprint: snapshot.fingerprint, reason } });
			return { publicId: closePublicId, journalPublicId, journalNumber };
		});
	}

	async reverse(actor: TenantActorContext, input: { closePublicId: string; reason: string }) {
		const closePublicId = cleanFinanceText(input.closePublicId, 64, 'Year-end close ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Year-end reversal reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await new PermissionService(trx).decideWithUmbrella(actor, 'finance.accounting.year_end.reverse', 'finance.manage')).allowed) throw new TenantAccessError('Year-end close reversal is not permitted.');
			await lockOrganisation(trx, actor.organisationId);
			const close = await trx.selectFrom('accounting_year_end_closes as close').innerJoin('accounting_journal_entries as journal', (join) => join.onRef('journal.id', '=', 'close.closing_journal_entry_id').onRef('journal.organisation_id', '=', 'close.organisation_id')).select(['close.id', 'close.public_id as publicId', 'journal.id as journalId', 'journal.public_id as journalPublicId', 'journal.journal_number as journalNumber', 'journal.currency_code as currencyCode', 'journal.accounting_date as accountingDate', 'journal.source_amount as sourceAmount', 'journal.source_fingerprint as sourceFingerprint']).where('close.organisation_id', '=', actor.organisationId).where('close.public_id', '=', closePublicId).forUpdate().executeTakeFirst();
			if (!close) throw new RecordNotFoundError('Year-end close not found.');
			if (await trx.selectFrom('accounting_year_end_close_reversals').select('year_end_close_id').where('organisation_id', '=', actor.organisationId).where('year_end_close_id', '=', close.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('The year-end close is already reversed.');
			const lines = await trx.selectFrom('accounting_journal_lines').select(['accounting_account_id as accountId', 'line_number as lineNumber', 'description', 'debit_amount as debitAmount', 'credit_amount as creditAmount']).where('organisation_id', '=', actor.organisationId).where('journal_entry_id', '=', close.journalId).orderBy('line_number').forUpdate().execute();
			const journalNumber = await nextJournalNumber(trx, actor.organisationId);
			const journalPublicId = this.publicIdFactory();
			const reversalFingerprint = createHash('sha256').update(JSON.stringify({ closePublicId, sourceFingerprint: close.sourceFingerprint, reason })).digest('hex');
			const result = await trx.insertInto('accounting_journal_entries').values({ organisation_id: actor.organisationId, public_id: journalPublicId, journal_number: journalNumber, source_type: 'journal_reversal', source_public_id: close.journalPublicId, source_event_at: this.now(), source_amount: close.sourceAmount, source_fingerprint: reversalFingerprint, accounting_date: close.accountingDate, currency_code: close.currencyCode, memo: `Reverse ${close.journalNumber}: ${reason}`, posted_by_member_id: membership.id, posted_at: this.now() }).executeTakeFirstOrThrow();
			const reversalJournalId = insertedId(result);
			await trx.insertInto('accounting_journal_lines').values(lines.map((line) => ({ organisation_id: actor.organisationId, journal_entry_id: reversalJournalId, accounting_account_id: line.accountId, line_number: Number(line.lineNumber), description: `Reverse: ${line.description}`, debit_amount: line.creditAmount, credit_amount: line.debitAmount }))).execute();
			await trx.insertInto('accounting_year_end_close_reversals').values({ year_end_close_id: close.id, organisation_id: actor.organisationId, reversal_journal_entry_id: reversalJournalId, reversed_by_member_id: membership.id, reversed_at: this.now(), reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.accounting.year_end.reversed', subjectType: 'accounting_year_end_close', subjectPublicId: close.publicId, correlationId: actor.correlationId, changeSummary: { originalJournalPublicId: close.journalPublicId, reversalJournalPublicId: journalPublicId, reversalJournalNumber: journalNumber, reason } });
			return { journalPublicId, journalNumber };
		});
	}
}
