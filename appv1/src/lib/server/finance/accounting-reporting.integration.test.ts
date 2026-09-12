import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { AccountingPeriodService } from './accounting-period-service';
import { AccountingReportingService } from './accounting-reporting-service';
import { AccountingService } from './accounting-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Accounting Reporting Integration ';
const NOW = new Date('2026-08-18T13:00:00.000Z');
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let financeAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let financeAMemberId = '';
let ownerBMemberId = '';
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorOwnerB: TenantActorContext;
let januaryPublicId = '';
let februaryPublicId = '';
let foreignPeriodPublicId = '';
let receivableAccountId = '';
let cashAccountId = '';
let revenueAccountId = '';
let originalSaleJournalId = '';
let journalSequence = 0;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const orgs = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = orgs.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('accounting_export_reversals').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('accounting_export_batch_entries')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('accounting_export_batches').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('accounting_journal_entry_reversals')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('accounting_journal_lines').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_account_mappings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_accounts').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('accounting_period_status_events')
		.where('organisation_id', 'in', ids)
		.execute();
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

async function createUser(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${name}`,
				default_currency_code: 'GBP',
				default_timezone: 'Europe/London',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: NOW
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignRole(
	organisationId: string,
	memberId: string,
	name: string,
	permissionKeys: string[]
) {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${name}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

async function accountId(publicId: string): Promise<string> {
	return (
		await db
			.selectFrom('accounting_accounts')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', publicId)
			.executeTakeFirstOrThrow()
	).id;
}

async function insertJournal(input: {
	organisationId?: string;
	memberId?: string;
	currency: string;
	accountingDate: string;
	lines: Array<{ accountId: string; debit?: string; credit?: string }>;
	sourceType?: 'invoice_issue' | 'payment_receipt' | 'journal_reversal';
	sourcePublicId?: string;
}) {
	journalSequence += 1;
	const organisationId = input.organisationId ?? organisationAId;
	const memberId = input.memberId ?? ownerAMemberId;
	const publicId = randomUUID();
	const sourcePublicId = input.sourcePublicId ?? randomUUID();
	const totalDebit = input.lines.reduce((sum, line) => sum + Number(line.debit ?? '0'), 0);
	const result = await db
		.insertInto('accounting_journal_entries')
		.values({
			organisation_id: organisationId,
			public_id: publicId,
			journal_number: `JRN-REPORT-${String(journalSequence).padStart(3, '0')}`,
			source_type: input.sourceType ?? 'invoice_issue',
			source_public_id: sourcePublicId,
			source_event_at: NOW,
			source_amount: totalDebit.toFixed(4),
			source_fingerprint: String(journalSequence).padStart(64, '0'),
			accounting_date: new Date(`${input.accountingDate}T00:00:00.000Z`),
			currency_code: input.currency,
			memo: `${PREFIX}journal ${journalSequence}`,
			posted_by_member_id: memberId,
			posted_at: NOW
		})
		.executeTakeFirstOrThrow();
	const journalId = insertedId(result);
	await db
		.insertInto('accounting_journal_lines')
		.values(
			input.lines.map((line, index) => ({
				organisation_id: organisationId,
				journal_entry_id: journalId,
				accounting_account_id: line.accountId,
				line_number: index + 1,
				description: `${PREFIX}line ${index + 1}`,
				debit_amount: line.debit ?? '0.0000',
				credit_amount: line.credit ?? '0.0000'
			}))
		)
		.execute();
	return { id: journalId, publicId };
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	financeAUserId = await createUser('Finance A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	financeAMemberId = await createMember(organisationAId, financeAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	await assignRole(organisationAId, ownerAMemberId, 'Owner', ['finance.view', 'finance.manage']);
	await assignRole(organisationAId, financeAMemberId, 'Finance', [
		'finance.view',
		'finance.accounting.view'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner', ['finance.view', 'finance.manage']);
	actorOwnerA = {
		organisationId: organisationAId,
		userId: ownerAUserId,
		memberId: ownerAMemberId,
		correlationId: randomUUID()
	};
	actorFinanceA = {
		organisationId: organisationAId,
		userId: financeAUserId,
		memberId: financeAMemberId,
		correlationId: randomUUID()
	};
	actorOwnerB = {
		organisationId: organisationBId,
		userId: ownerBUserId,
		memberId: ownerBMemberId,
		correlationId: randomUUID()
	};

	const periods = new AccountingPeriodService(db, randomUUID, () => NOW);
	const yearA = await periods.createFinancialYear(actorOwnerA, {
		yearCode: 'FY26-R',
		name: 'Reporting FY26',
		startsOn: '2026-01-01',
		endsOn: '2026-12-31'
	});
	januaryPublicId = (
		await periods.createPeriod(actorOwnerA, {
			financialYearPublicId: yearA.publicId,
			periodNumber: 1,
			name: 'January 2026',
			startsOn: '2026-01-01',
			endsOn: '2026-01-31'
		})
	).publicId;
	februaryPublicId = (
		await periods.createPeriod(actorOwnerA, {
			financialYearPublicId: yearA.publicId,
			periodNumber: 2,
			name: 'February 2026',
			startsOn: '2026-02-01',
			endsOn: '2026-02-28'
		})
	).publicId;
	const yearB = await periods.createFinancialYear(actorOwnerB, {
		yearCode: 'FY26-RB',
		name: 'Foreign reporting FY26',
		startsOn: '2026-01-01',
		endsOn: '2026-12-31'
	});
	foreignPeriodPublicId = (
		await periods.createPeriod(actorOwnerB, {
			financialYearPublicId: yearB.publicId,
			periodNumber: 1,
			name: 'Foreign January',
			startsOn: '2026-01-01',
			endsOn: '2026-01-31'
		})
	).publicId;

	const accounting = new AccountingService(db, randomUUID, () => NOW);
	const receivable = await accounting.createAccount(actorOwnerA, {
		accountCode: '1100-R',
		name: 'Trade receivables',
		accountType: 'asset'
	});
	const cash = await accounting.createAccount(actorOwnerA, {
		accountCode: '1000-R',
		name: 'Cash',
		accountType: 'asset'
	});
	const revenue = await accounting.createAccount(actorOwnerA, {
		accountCode: '4000-R',
		name: 'Sales revenue',
		accountType: 'revenue'
	});
	receivableAccountId = await accountId(receivable.publicId);
	cashAccountId = await accountId(cash.publicId);
	revenueAccountId = await accountId(revenue.publicId);

	originalSaleJournalId = (
		await insertJournal({
			currency: 'GBP',
			accountingDate: '2026-01-15',
			lines: [
				{ accountId: receivableAccountId, debit: '100.0000' },
				{ accountId: revenueAccountId, credit: '100.0000' }
			]
		})
	).id;
	await insertJournal({
		currency: 'GBP',
		accountingDate: '2026-02-10',
		sourceType: 'payment_receipt',
		lines: [
			{ accountId: cashAccountId, debit: '100.0000' },
			{ accountId: receivableAccountId, credit: '100.0000' }
		]
	});
	await insertJournal({
		currency: 'EUR',
		accountingDate: '2026-01-20',
		lines: [
			{ accountId: receivableAccountId, debit: '50.0000' },
			{ accountId: revenueAccountId, credit: '50.0000' }
		]
	});
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004N trial balance and financial reporting', () => {
	it('derives balanced opening, period and closing trial-balance columns plus P&L and balance-sheet views', async () => {
		const workspace = await new AccountingReportingService(db).getWorkspace(actorFinanceA, {
			periodPublicId: februaryPublicId,
			currencyCode: 'GBP'
		});
		expect(workspace.selectedPeriod?.name).toBe('February 2026');
		expect(workspace.trialBalance.openingBalanced).toBe(true);
		expect(workspace.trialBalance.periodBalanced).toBe(true);
		expect(workspace.trialBalance.closingBalanced).toBe(true);
		expect(workspace.trialBalance.openingDebit).toBe('100.0000');
		expect(workspace.trialBalance.openingCredit).toBe('100.0000');
		expect(workspace.trialBalance.periodDebit).toBe('100.0000');
		expect(workspace.trialBalance.periodCredit).toBe('100.0000');
		expect(workspace.trialBalance.closingDebit).toBe('100.0000');
		expect(workspace.trialBalance.closingCredit).toBe('100.0000');
		expect(workspace.profitAndLoss.periodProfit).toBe('0.0000');
		expect(workspace.profitAndLoss.yearToDateProfit).toBe('100.0000');
		expect(workspace.balanceSheet.assetsTotal).toBe('100.0000');
		expect(workspace.balanceSheet.unclosedEarnings).toBe('100.0000');
		expect(workspace.balanceSheet.balanced).toBe(true);
	});

	it('keeps currencies isolated and never aggregates GBP and EUR balances', async () => {
		const gbp = await new AccountingReportingService(db).getWorkspace(actorFinanceA, {
			periodPublicId: januaryPublicId,
			currencyCode: 'GBP'
		});
		const eur = await new AccountingReportingService(db).getWorkspace(actorFinanceA, {
			periodPublicId: januaryPublicId,
			currencyCode: 'EUR'
		});
		expect(gbp.trialBalance.periodDebit).toBe('100.0000');
		expect(gbp.profitAndLoss.periodRevenue).toBe('100.0000');
		expect(eur.trialBalance.periodDebit).toBe('50.0000');
		expect(eur.profitAndLoss.periodRevenue).toBe('50.0000');
		expect(eur.balanceSheet.assetsTotal).toBe('50.0000');
	});

	it('preserves historical periods while a later additive reversal changes reporting from its own accounting date onward', async () => {
		const reversal = await insertJournal({
			currency: 'GBP',
			accountingDate: '2026-02-20',
			sourceType: 'journal_reversal',
			sourcePublicId: randomUUID(),
			lines: [
				{ accountId: revenueAccountId, debit: '100.0000' },
				{ accountId: receivableAccountId, credit: '100.0000' }
			]
		});
		await db
			.insertInto('accounting_journal_entry_reversals')
			.values({
				journal_entry_id: originalSaleJournalId,
				organisation_id: organisationAId,
				reversal_journal_entry_id: reversal.id,
				reversed_by_member_id: ownerAMemberId,
				reversed_at: NOW,
				reason: 'Package 004N historical reversal timing proof.'
			})
			.executeTakeFirstOrThrow();

		const january = await new AccountingReportingService(db).getWorkspace(actorFinanceA, {
			periodPublicId: januaryPublicId,
			currencyCode: 'GBP'
		});
		const february = await new AccountingReportingService(db).getWorkspace(actorFinanceA, {
			periodPublicId: februaryPublicId,
			currencyCode: 'GBP'
		});
		expect(january.profitAndLoss.periodRevenue).toBe('100.0000');
		expect(january.trialBalance.closingDebit).toBe('100.0000');
		expect(february.profitAndLoss.periodRevenue).toBe('-100.0000');
		expect(february.profitAndLoss.yearToDateProfit).toBe('0.0000');
		expect(february.balanceSheet.assetsTotal).toBe('0.0000');
		expect(february.balanceSheet.unclosedEarnings).toBe('0.0000');
		expect(february.trialBalance.closingBalanced).toBe(true);
	});

	it('requires accounting read authority, honours explicit granular deny over finance.manage, and tenant-masks period selection', async () => {
		const permission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.accounting.view')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: ownerAMemberId,
				permission_id: permission.id,
				effect: 'deny',
				reason: 'Package 004N explicit accounting-view deny.'
			})
			.executeTakeFirstOrThrow();
		await expect(
			new AccountingReportingService(db).getWorkspace(actorOwnerA, {
				periodPublicId: januaryPublicId,
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', permission.id)
			.execute();
		await expect(
			new AccountingReportingService(db).getWorkspace(actorFinanceA, {
				periodPublicId: foreignPeriodPublicId,
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});
});
