import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { AccountingPeriodService } from './accounting-period-service';
import { AccountingReportDrillthroughService } from './accounting-report-drillthrough-service';
import { AccountingService } from './accounting-service';

const PREFIX = 'Accounting Drillthrough Integration ';
const NOW = new Date('2026-09-06T12:00:00.000Z');
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let viewerAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let viewerAMemberId = '';
let ownerBMemberId = '';
let actorOwnerA: TenantActorContext;
let actorViewerA: TenantActorContext;
let actorOwnerB: TenantActorContext;
let januaryPublicId = '';
let februaryPublicId = '';
let foreignPeriodPublicId = '';
let receivablePublicId = '';
let receivableAccountId = '';
let revenueAccountId = '';
let foreignAccountPublicId = '';
let originalJournalPublicId = '';
let invoiceSourcePublicId = '';
let journalSequence = 0;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
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
	if (permissions.length > 0) {
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
	}
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

async function accountId(organisationId: string, publicId: string): Promise<string> {
	return (
		await db
			.selectFrom('accounting_accounts')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirstOrThrow()
	).id;
}

async function insertJournal(input: {
	currency: string;
	accountingDate: string;
	lines: Array<{ accountId: string; debit?: string; credit?: string }>;
	sourceType?: 'invoice_issue' | 'payment_receipt';
	sourcePublicId?: string;
}) {
	journalSequence += 1;
	const publicId = randomUUID();
	const sourcePublicId = input.sourcePublicId ?? randomUUID();
	const totalDebit = input.lines.reduce((sum, line) => sum + Number(line.debit ?? '0'), 0);
	const result = await db
		.insertInto('accounting_journal_entries')
		.values({
			organisation_id: organisationAId,
			public_id: publicId,
			journal_number: `JRN-DRILL-${String(journalSequence).padStart(3, '0')}`,
			source_type: input.sourceType ?? 'invoice_issue',
			source_public_id: sourcePublicId,
			source_event_at: NOW,
			source_amount: totalDebit.toFixed(4),
			source_fingerprint: String(journalSequence).padStart(64, '0'),
			accounting_date: new Date(`${input.accountingDate}T00:00:00.000Z`),
			currency_code: input.currency,
			memo: `${PREFIX}journal ${journalSequence}`,
			posted_by_member_id: ownerAMemberId,
			posted_at: NOW
		})
		.executeTakeFirstOrThrow();
	const journalId = insertedId(result);
	await db
		.insertInto('accounting_journal_lines')
		.values(
			input.lines.map((line, index) => ({
				organisation_id: organisationAId,
				journal_entry_id: journalId,
				accounting_account_id: line.accountId,
				line_number: index + 1,
				description: `${PREFIX}line ${index + 1}`,
				debit_amount: line.debit ?? '0.0000',
				credit_amount: line.credit ?? '0.0000'
			}))
		)
		.execute();
	return { id: journalId, publicId, sourcePublicId };
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();

	ownerAUserId = await createUser('Owner A');
	viewerAUserId = await createUser('Viewer A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	viewerAMemberId = await createMember(organisationAId, viewerAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	await assignRole(organisationAId, ownerAMemberId, 'Owner', ['finance.view', 'finance.manage']);
	await assignRole(organisationAId, viewerAMemberId, 'Viewer', ['finance.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner', ['finance.view', 'finance.manage']);

	actorOwnerA = {
		organisationId: organisationAId,
		userId: ownerAUserId,
		memberId: ownerAMemberId,
		correlationId: randomUUID()
	};
	actorViewerA = {
		organisationId: organisationAId,
		userId: viewerAUserId,
		memberId: viewerAMemberId,
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
		yearCode: 'FY26-D',
		name: 'Drillthrough FY26',
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
		yearCode: 'FY26-DB',
		name: 'Foreign Drillthrough FY26',
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
		accountCode: '1100-D',
		name: 'Trade receivables',
		accountType: 'asset'
	});
	const revenue = await accounting.createAccount(actorOwnerA, {
		accountCode: '4000-D',
		name: 'Sales revenue',
		accountType: 'revenue'
	});
	const foreign = await accounting.createAccount(actorOwnerB, {
		accountCode: '1100-DB',
		name: 'Foreign receivables',
		accountType: 'asset'
	});
	receivablePublicId = receivable.publicId;
	foreignAccountPublicId = foreign.publicId;
	receivableAccountId = await accountId(organisationAId, receivable.publicId);
	revenueAccountId = await accountId(organisationAId, revenue.publicId);

	invoiceSourcePublicId = randomUUID();
	const original = await insertJournal({
		currency: 'GBP',
		accountingDate: '2026-01-15',
		sourceType: 'invoice_issue',
		sourcePublicId: invoiceSourcePublicId,
		lines: [
			{ accountId: receivableAccountId, debit: '100.0000' },
			{ accountId: revenueAccountId, credit: '100.0000' }
		]
	});
	originalJournalPublicId = original.publicId;
	await insertJournal({
		currency: 'EUR',
		accountingDate: '2026-01-20',
		lines: [
			{ accountId: receivableAccountId, debit: '50.0000' },
			{ accountId: revenueAccountId, credit: '50.0000' }
		]
	});
	await accounting.reverseJournal(actorOwnerA, {
		journalPublicId: originalJournalPublicId,
		accountingDate: '2026-02-10',
		reason: 'Prove additive historical drill-through.'
	});
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('accounting report source drill-through', () => {
	it('reconciles opening, period and closing account balances to journal and source evidence', async () => {
		const workspace = await new AccountingReportDrillthroughService(db).getAccountWorkspace(
			actorOwnerA,
			{
				accountPublicId: receivablePublicId,
				periodPublicId: februaryPublicId,
				currencyCode: 'GBP'
			}
		);

		expect(workspace.account.accountCode).toBe('1100-D');
		expect(workspace.period.name).toBe('February 2026');
		expect(workspace.summary).toEqual({
			openingDebit: '100.0000',
			openingCredit: '0.0000',
			periodDebit: '0.0000',
			periodCredit: '100.0000',
			closingDebit: '0.0000',
			closingCredit: '0.0000'
		});
		expect(workspace.entries).toHaveLength(2);
		expect(workspace.entries[0]).toMatchObject({
			journalPublicId: originalJournalPublicId,
			sourceType: 'invoice_issue',
			sourcePublicId: invoiceSourcePublicId,
			phase: 'opening',
			debitAmount: '100.0000',
			creditAmount: '0.0000',
			runningDebit: '100.0000',
			runningCredit: '0.0000'
		});
		expect(workspace.entries[0]?.sourceReference).toEqual({
			href: `/finance/invoices/${invoiceSourcePublicId}`,
			label: 'Customer invoice'
		});
		expect(workspace.entries[0]?.reversedAt).toBeInstanceOf(Date);
		expect(workspace.entries[1]).toMatchObject({
			sourceType: 'journal_reversal',
			sourcePublicId: originalJournalPublicId,
			phase: 'period',
			debitAmount: '0.0000',
			creditAmount: '100.0000',
			runningDebit: '0.0000',
			runningCredit: '0.0000'
		});
		expect(workspace.entries[1]?.sourceReference).toEqual({
			href: '/finance/accounting',
			label: 'Accounting journals'
		});
	});

	it('preserves earlier-period reporting while exposing later reversal provenance', async () => {
		const january = await new AccountingReportDrillthroughService(db).getAccountWorkspace(actorOwnerA, {
			accountPublicId: receivablePublicId,
			periodPublicId: januaryPublicId,
			currencyCode: 'GBP'
		});
		expect(january.summary.periodDebit).toBe('100.0000');
		expect(january.summary.periodCredit).toBe('0.0000');
		expect(january.summary.closingDebit).toBe('100.0000');
		expect(january.entries).toHaveLength(1);
		expect(january.entries[0]?.sourceType).toBe('invoice_issue');
		expect(january.entries[0]?.reversedAt).toBeInstanceOf(Date);
	});

	it('keeps reporting currency, tenant and accounting-view boundaries authoritative', async () => {
		const gbp = await new AccountingReportDrillthroughService(db).getAccountWorkspace(actorOwnerA, {
			accountPublicId: receivablePublicId,
			periodPublicId: januaryPublicId,
			currencyCode: 'GBP'
		});
		expect(gbp.entries).toHaveLength(1);
		await expect(
			new AccountingReportDrillthroughService(db).getAccountWorkspace(actorViewerA, {
				accountPublicId: receivablePublicId,
				periodPublicId: januaryPublicId,
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(
			new AccountingReportDrillthroughService(db).getAccountWorkspace(actorOwnerA, {
				accountPublicId: foreignAccountPublicId,
				periodPublicId: januaryPublicId,
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(
			new AccountingReportDrillthroughService(db).getAccountWorkspace(actorOwnerA, {
				accountPublicId: receivablePublicId,
				periodPublicId: foreignPeriodPublicId,
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
