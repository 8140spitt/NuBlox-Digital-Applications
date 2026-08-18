import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { AccountingYearEndConfigurationService } from './accounting-year-end-configuration-service';
import { AccountingYearEndReportingService } from './accounting-year-end-reporting-service';
import { AccountingYearEndService } from './accounting-year-end-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Year End Integration ';
const NOW = new Date('2026-08-18T18:00:00.000Z');
let db: Database;
let organisationId = '';
let preparerUserId = '';
let authoriserUserId = '';
let preparerMemberId = '';
let authoriserMemberId = '';
let actorPreparer: TenantActorContext;
let actorAuthoriser: TenantActorContext;
let yearPublicId = '';
let periodPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const organisations = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('accounting_year_end_close_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_year_end_closes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_year_end_close_preparations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entry_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_lines').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_account_mappings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_accounts').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_period_status_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_periods').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_financial_years').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(name: string) {
	return insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(userId: string) {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: NOW }).executeTakeFirstOrThrow());
}

async function assignRole(memberId: string, name: string, permissionKeys: string[]) {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	preparerUserId = await createUser('Preparer');
	authoriserUserId = await createUser('Authoriser');
	organisationId = insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}Tenant`, default_currency_code: 'GBP', default_timezone: 'Europe/London', status: 'active' }).executeTakeFirstOrThrow());
	preparerMemberId = await createMember(preparerUserId);
	authoriserMemberId = await createMember(authoriserUserId);
	await assignRole(preparerMemberId, 'Preparer role', ['finance.view', 'finance.accounting.view', 'finance.accounting.configure', 'finance.accounting.year_end.prepare']);
	await assignRole(authoriserMemberId, 'Authoriser role', ['finance.view', 'finance.accounting.view', 'finance.accounting.year_end.authorise', 'finance.accounting.year_end.reverse']);
	actorPreparer = { organisationId, userId: preparerUserId, memberId: preparerMemberId, correlationId: randomUUID() };
	actorAuthoriser = { organisationId, userId: authoriserUserId, memberId: authoriserMemberId, correlationId: randomUUID() };

	yearPublicId = randomUUID();
	const yearId = insertedId(await db.insertInto('accounting_financial_years').values({ organisation_id: organisationId, public_id: yearPublicId, year_code: 'FY26-YE', name: 'FY26 Year End', starts_on: new Date('2026-08-18T00:00:00.000Z'), ends_on: new Date('2026-08-18T00:00:00.000Z'), created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow());
	periodPublicId = randomUUID();
	await db.insertInto('accounting_periods').values({ organisation_id: organisationId, public_id: periodPublicId, financial_year_id: yearId, period_number: 1, name: 'Year-end day', starts_on: new Date('2026-08-18T00:00:00.000Z'), ends_on: new Date('2026-08-18T00:00:00.000Z'), status: 'hard_closed', created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow();

	const cashId = insertedId(await db.insertInto('accounting_accounts').values({ organisation_id: organisationId, public_id: randomUUID(), account_code: '1000', name: 'Cash', account_type: 'asset', normal_balance: 'debit', is_active: 1, created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow());
	const revenueId = insertedId(await db.insertInto('accounting_accounts').values({ organisation_id: organisationId, public_id: randomUUID(), account_code: '4000', name: 'Revenue', account_type: 'revenue', normal_balance: 'credit', is_active: 1, created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow());
	const expenseId = insertedId(await db.insertInto('accounting_accounts').values({ organisation_id: organisationId, public_id: randomUUID(), account_code: '6000', name: 'Expense', account_type: 'expense', normal_balance: 'debit', is_active: 1, created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow());
	const retainedPublicId = randomUUID();
	await db.insertInto('accounting_accounts').values({ organisation_id: organisationId, public_id: retainedPublicId, account_code: '3200', name: 'Retained Earnings', account_type: 'equity', normal_balance: 'credit', is_active: 1, created_by_member_id: preparerMemberId }).executeTakeFirstOrThrow();
	await new AccountingYearEndConfigurationService(db).assignRetainedEarnings(actorPreparer, { accountPublicId: retainedPublicId, reason: 'Year-end integration mapping.' });

	const saleJournalId = insertedId(await db.insertInto('accounting_journal_entries').values({ organisation_id: organisationId, public_id: randomUUID(), journal_number: 'JRN-000001', source_type: 'invoice_issue', source_public_id: randomUUID(), source_event_at: NOW, source_amount: '100.0000', source_fingerprint: '1'.repeat(64), accounting_date: new Date('2026-08-18T00:00:00.000Z'), currency_code: 'GBP', memo: 'Sale', posted_by_member_id: preparerMemberId, posted_at: NOW }).executeTakeFirstOrThrow());
	await db.insertInto('accounting_journal_lines').values([
		{ organisation_id: organisationId, journal_entry_id: saleJournalId, accounting_account_id: cashId, line_number: 1, description: 'Cash', debit_amount: '100.0000', credit_amount: '0.0000' },
		{ organisation_id: organisationId, journal_entry_id: saleJournalId, accounting_account_id: revenueId, line_number: 2, description: 'Revenue', debit_amount: '0.0000', credit_amount: '100.0000' }
	]).execute();
	const expenseJournalId = insertedId(await db.insertInto('accounting_journal_entries').values({ organisation_id: organisationId, public_id: randomUUID(), journal_number: 'JRN-000002', source_type: 'payment_receipt', source_public_id: randomUUID(), source_event_at: NOW, source_amount: '60.0000', source_fingerprint: '2'.repeat(64), accounting_date: new Date('2026-08-18T00:00:00.000Z'), currency_code: 'GBP', memo: 'Expense', posted_by_member_id: preparerMemberId, posted_at: NOW }).executeTakeFirstOrThrow());
	await db.insertInto('accounting_journal_lines').values([
		{ organisation_id: organisationId, journal_entry_id: expenseJournalId, accounting_account_id: expenseId, line_number: 1, description: 'Expense', debit_amount: '60.0000', credit_amount: '0.0000' },
		{ organisation_id: organisationId, journal_entry_id: expenseJournalId, accounting_account_id: cashId, line_number: 2, description: 'Cash', debit_amount: '0.0000', credit_amount: '60.0000' }
	]).execute();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004O controlled year-end close', () => {
	it('requires a different authoriser, posts retained earnings and preserves P&L reporting', async () => {
		const service = new AccountingYearEndService(db, randomUUID, () => NOW);
		const prepared = await service.prepare(actorPreparer, { financialYearPublicId: yearPublicId, currencyCode: 'GBP', reason: 'Prepare FY26 close.' });
		await expect(service.authorise(actorPreparer, { preparationPublicId: prepared.publicId, reason: 'Self authorise.' })).rejects.toBeInstanceOf(FinanceValidationError);
		const authorised = await service.authorise(actorAuthoriser, { preparationPublicId: prepared.publicId, reason: 'Independent approval.' });
		expect(authorised.journalNumber).toBe('JRN-000003');
		const closeJournal = await db.selectFrom('accounting_journal_entries').select('id').where('organisation_id', '=', organisationId).where('public_id', '=', authorised.journalPublicId).executeTakeFirstOrThrow();
		const lines = await db.selectFrom('accounting_journal_lines as line').innerJoin('accounting_accounts as account', (join) => join.onRef('account.id', '=', 'line.accounting_account_id').onRef('account.organisation_id', '=', 'line.organisation_id')).select(['account.account_code as accountCode', 'line.debit_amount as debit', 'line.credit_amount as credit']).where('line.organisation_id', '=', organisationId).where('line.journal_entry_id', '=', closeJournal.id).orderBy('line.line_number').execute();
		expect(lines).toEqual([
			expect.objectContaining({ accountCode: '4000', debit: '100.0000', credit: '0.0000' }),
			expect.objectContaining({ accountCode: '6000', debit: '0.0000', credit: '60.0000' }),
			expect.objectContaining({ accountCode: '3200', debit: '0.0000', credit: '40.0000' })
		]);
		const report = await new AccountingYearEndReportingService(db).getWorkspace(actorAuthoriser, { periodPublicId, currencyCode: 'GBP' });
		expect(report.profitAndLoss.yearToDateRevenue).toBe('100.0000');
		expect(report.profitAndLoss.yearToDateExpenses).toBe('60.0000');
		expect(report.profitAndLoss.yearToDateProfit).toBe('40.0000');
		expect(report.balanceSheet.unclosedEarnings).toBe('0.0000');
		expect(report.balanceSheet.equityTotal).toBe('40.0000');
		expect(report.balanceSheet.balanced).toBe(true);
	});

	it('reverses the close additively and restores unclosed earnings without changing P&L', async () => {
		const close = await db.selectFrom('accounting_year_end_closes').select('public_id as publicId').where('organisation_id', '=', organisationId).orderBy('id', 'desc').executeTakeFirstOrThrow();
		const reversed = await new AccountingYearEndService(db, randomUUID, () => NOW).reverse(actorAuthoriser, { closePublicId: close.publicId, reason: 'Controlled correction cycle.' });
		expect(reversed.journalNumber).toBe('JRN-000004');
		const report = await new AccountingYearEndReportingService(db).getWorkspace(actorAuthoriser, { periodPublicId, currencyCode: 'GBP' });
		expect(report.profitAndLoss.yearToDateProfit).toBe('40.0000');
		expect(report.balanceSheet.unclosedEarnings).toBe('40.0000');
		expect(report.balanceSheet.equityTotal).toBe('0.0000');
		expect(report.balanceSheet.balanced).toBe(true);
	});
});
