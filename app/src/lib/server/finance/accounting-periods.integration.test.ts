import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { AccountingPeriodService } from './accounting-period-service';
import { AccountingService } from './accounting-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Accounting Period Integration ';
const NOW = new Date('2026-08-18T14:00:00.000Z');
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
let yearPublicId = '';
let periodPublicId = '';
let invoicePublicId = '';
let journalPublicId = '';
let exportPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const orgs = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const ids = orgs.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('accounting_export_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_export_batch_entries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_export_batches').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entry_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_lines').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_journal_entries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_account_mappings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_accounts').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_period_status_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_periods').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('accounting_financial_years').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
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
	return insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, default_currency_code: 'GBP', default_timezone: 'Europe/London', status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: NOW }).executeTakeFirstOrThrow());
}

async function assignRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]) {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
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
	await assignRole(organisationAId, financeAMemberId, 'Finance', ['finance.view', 'finance.accounting.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner', ['finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorFinanceA = { organisationId: organisationAId, userId: financeAUserId, memberId: financeAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };

	const accounting = new AccountingService(db, randomUUID, () => NOW);
	const receivable = await accounting.createAccount(actorOwnerA, { accountCode: '1100-P', name: 'Period Trade Receivables', accountType: 'asset' });
	const revenue = await accounting.createAccount(actorOwnerA, { accountCode: '4000-P', name: 'Period Sales Revenue', accountType: 'revenue' });
	await accounting.assignMapping(actorOwnerA, { mappingKey: 'accounts_receivable', accountPublicId: receivable.publicId, reason: 'Period integration fixture.' });
	await accounting.assignMapping(actorOwnerA, { mappingKey: 'sales_revenue', accountPublicId: revenue.publicId, reason: 'Period integration fixture.' });

	const customerId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationAId, public_id: randomUUID(), party_kind: 'organisation', account_owner_member_id: ownerAMemberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerId, organisation_id: organisationAId, legal_name: `${PREFIX}Customer`, trading_name: null }).executeTakeFirstOrThrow();
	const salesItemTypeId = Number((await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id);
	invoicePublicId = randomUUID();
	const invoiceId = insertedId(await db.insertInto('financial_documents').values({ organisation_id: organisationAId, public_id: invoicePublicId, document_kind: 'invoice', document_number: 'INV-PERIOD-001', customer_party_id: customerId, billing_contact_party_id: null, project_id: null, contract_id: null, currency_code: 'GBP', lifecycle_status: 'issued', created_by_member_id: ownerAMemberId, voided_by_member_id: null, voided_at: null, void_reason: null }).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({ financial_document_id: invoiceId, organisation_id: organisationAId, payment_term_id: null, invoice_type: 'standard', due_date: new Date('2026-08-31T00:00:00.000Z'), customer_purchase_order_reference: null }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_items').values({ organisation_id: organisationAId, financial_document_id: invoiceId, source_quotation_item_id: null, sales_item_type_id: salesItemTypeId, sales_catalog_item_id: null, unit_of_measure_id: null, line_number: 1, description: 'Period governed invoice', quantity: '1.000000', unit_rate: '50.0000' }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_issue_events').values({ organisation_id: organisationAId, financial_document_id: invoiceId, issue_sequence: 1, issued_by_member_id: ownerAMemberId, delivery_channel: 'manual', issued_at: NOW, note: null }).executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004M controlled accounting periods and close governance', () => {
	it('keeps Finance/Commercial view-only while Owner creates non-overlapping year and period configuration', async () => {
		const service = new AccountingPeriodService(db, randomUUID, () => NOW);
		const financeWorkspace = await service.getWorkspace(actorFinanceA);
		expect(financeWorkspace.canConfigure).toBe(false);
		expect(financeWorkspace.canClose).toBe(false);
		expect(financeWorkspace.canReopen).toBe(false);
		await expect(service.createFinancialYear(actorFinanceA, { yearCode: 'FY26', name: 'FY26', startsOn: '2026-01-01', endsOn: '2026-12-31' })).rejects.toBeInstanceOf(TenantAccessError);

		const year = await service.createFinancialYear(actorOwnerA, { yearCode: 'FY26', name: 'Financial Year 2026', startsOn: '2026-01-01', endsOn: '2026-12-31' });
		yearPublicId = year.publicId;
		await expect(service.createFinancialYear(actorOwnerA, { yearCode: 'FY26-OVERLAP', name: 'Overlap', startsOn: '2026-06-01', endsOn: '2027-05-31' })).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(service.createPeriod(actorOwnerA, { financialYearPublicId: year.publicId, periodNumber: 1, name: 'Outside year', startsOn: '2025-12-31', endsOn: '2026-01-31' })).rejects.toBeInstanceOf(FinanceValidationError);
		const period = await service.createPeriod(actorOwnerA, { financialYearPublicId: year.publicId, periodNumber: 8, name: 'August 2026', startsOn: '2026-08-01', endsOn: '2026-08-31' });
		periodPublicId = period.publicId;
		await expect(service.createPeriod(actorOwnerA, { financialYearPublicId: year.publicId, periodNumber: 9, name: 'Overlap August', startsOn: '2026-08-15', endsOn: '2026-09-15' })).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('requires an open configured period for source posting and blocks accounting dates outside configured periods', async () => {
		const accounting = new AccountingService(db, randomUUID, () => NOW);
		await expect(accounting.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId, accountingDate: '2026-07-31' })).rejects.toBeInstanceOf(FinanceValidationError);
		const posted = await accounting.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId, accountingDate: '2026-08-18' });
		journalPublicId = posted.publicId;
		expect(posted.journalNumber).toBe('JRN-000001');
	});

	it('blocks export while open, blocks hard close while journals are unexported, then allows exact soft-closed export and hard close', async () => {
		const periods = new AccountingPeriodService(db, randomUUID, () => NOW);
		const accounting = new AccountingService(db, randomUUID, () => NOW);
		await expect(accounting.createExport(actorOwnerA, { periodStart: '2026-08-01', periodEnd: '2026-08-31', reason: 'Open period export must fail.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await periods.softClose(actorOwnerA, periodPublicId, 'August posting complete for review.');
		await expect(accounting.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId, accountingDate: '2026-08-18' })).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(periods.hardClose(actorOwnerA, periodPublicId, 'Attempt before export.')).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(accounting.createExport(actorOwnerA, { periodStart: '2026-08-01', periodEnd: '2026-08-30', reason: 'Non-exact range must fail.' })).rejects.toBeInstanceOf(FinanceValidationError);
		const created = await accounting.createExport(actorOwnerA, { periodStart: '2026-08-01', periodEnd: '2026-08-31', reason: 'August controlled accounting export.' });
		exportPublicId = created.publicId;
		expect(created.exportNumber).toBe('AEX-000001');
		await periods.hardClose(actorOwnerA, periodPublicId, 'All August journals have active export evidence.');
		const workspace = await periods.getWorkspace(actorOwnerA);
		expect(workspace.financialYears.find((year) => year.publicId === yearPublicId)?.periods.find((period) => period.publicId === periodPublicId)?.status).toBe('hard_closed');
	});

	it('blocks export reversal under hard close, then permits it only after reasoned reopen', async () => {
		const periods = new AccountingPeriodService(db, randomUUID, () => NOW);
		const accounting = new AccountingService(db, randomUUID, () => NOW);
		await expect(accounting.reverseExport(actorOwnerA, { exportPublicId, reason: 'Cannot alter hard-closed export evidence.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await periods.reopen(actorOwnerA, periodPublicId, 'Correction identified after hard close.');
		await accounting.reverseExport(actorOwnerA, { exportPublicId, reason: 'Withdraw export after controlled period reopen.' });
		const reversal = await db.selectFrom('accounting_export_reversals').select('accounting_export_batch_id').where('organisation_id', '=', organisationAId).executeTakeFirst();
		expect(reversal).toBeTruthy();
	});

	it('retains additive period transition evidence for soft close, hard close and reopen', async () => {
		const period = await db.selectFrom('accounting_periods').select('id').where('organisation_id', '=', organisationAId).where('public_id', '=', periodPublicId).executeTakeFirstOrThrow();
		const events = await db.selectFrom('accounting_period_status_events').select(['from_status as fromStatus', 'to_status as toStatus', 'reason', 'changed_by_member_id as memberId']).where('organisation_id', '=', organisationAId).where('accounting_period_id', '=', period.id).orderBy('id').execute();
		expect(events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
			['open', 'soft_closed'],
			['soft_closed', 'hard_closed'],
			['hard_closed', 'open']
		]);
		expect(events.every((event) => event.memberId === ownerAMemberId && event.reason.length > 0)).toBe(true);
	});

	it('keeps explicit period-reopen deny above finance.manage and tenant-masks foreign period IDs', async () => {
		const service = new AccountingPeriodService(db, randomUUID, () => NOW);
		await service.softClose(actorOwnerA, periodPublicId, 'Prepare explicit deny check.');
		const permission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.accounting.period.reopen').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({ organisation_id: organisationAId, organisation_member_id: ownerAMemberId, permission_id: permission.id, effect: 'deny', reason: 'Package 004M explicit deny test.' }).executeTakeFirstOrThrow();
		await expect(service.reopen(actorOwnerA, periodPublicId, 'Denied reopen.')).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationAId).where('organisation_member_id', '=', ownerAMemberId).where('permission_id', '=', permission.id).execute();
		await service.reopen(actorOwnerA, periodPublicId, 'Remove explicit deny and reopen.');
		await expect(new AccountingPeriodService(db, randomUUID, () => NOW).reopen(actorOwnerB, periodPublicId, 'Foreign tenant must not discover period.')).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
