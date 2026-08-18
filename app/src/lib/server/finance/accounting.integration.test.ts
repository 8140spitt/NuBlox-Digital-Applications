import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { AccountingPeriodService } from './accounting-period-service';
import { AccountingService } from './accounting-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Accounting Integration ';
const NOW = new Date('2026-08-18T12:00:00.000Z');
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
let periodAPublicId = '';
let invoicePublicId = '';
let journalPublicId = '';
let reversalJournalPublicId = '';
let repostJournalPublicId = '';
let exportPublicId = '';
let salesItemTypeId = 0;

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
	await db.deleteFrom('financial_document_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_item_taxes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_category_rates').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_categories').where('organisation_id', 'in', ids).execute();
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

async function createOpenDayPeriod(actor: TenantActorContext, code: string): Promise<string> {
	const service = new AccountingPeriodService(db, randomUUID, () => NOW);
	const year = await service.createFinancialYear(actor, { yearCode: code, name: `${code} year`, startsOn: '2026-08-18', endsOn: '2026-08-18' });
	const period = await service.createPeriod(actor, { financialYearPublicId: year.publicId, periodNumber: 1, name: '18 Aug 2026', startsOn: '2026-08-18', endsOn: '2026-08-18' });
	return period.publicId;
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
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorFinanceA = { organisationId: organisationAId, userId: financeAUserId, memberId: financeAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };
	periodAPublicId = await createOpenDayPeriod(actorOwnerA, 'FY26-A');
	await createOpenDayPeriod(actorOwnerB, 'FY26-B');

	salesItemTypeId = Number((await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id);
	const customerId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationAId, public_id: randomUUID(), party_kind: 'organisation', account_owner_member_id: ownerAMemberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerId, organisation_id: organisationAId, legal_name: `${PREFIX}Customer Ltd`, trading_name: `${PREFIX}Customer` }).executeTakeFirstOrThrow();
	const taxCategoryId = insertedId(await db.insertInto('tax_categories').values({ organisation_id: organisationAId, public_id: randomUUID(), code: 'VAT_ACCOUNTING_20', name: 'Accounting VAT 20%', treatment: 'taxable', is_active: 1 }).executeTakeFirstOrThrow());
	await db.insertInto('tax_category_rates').values({ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '20.0000', valid_from: new Date('2025-01-01T00:00:00.000Z'), valid_to: null }).executeTakeFirstOrThrow();

	invoicePublicId = randomUUID();
	const invoiceId = insertedId(await db.insertInto('financial_documents').values({ organisation_id: organisationAId, public_id: invoicePublicId, document_kind: 'invoice', document_number: 'INV-ACC-001', customer_party_id: customerId, billing_contact_party_id: null, project_id: null, contract_id: null, currency_code: 'GBP', lifecycle_status: 'issued', created_by_member_id: ownerAMemberId, voided_by_member_id: null, voided_at: null, void_reason: null }).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({ financial_document_id: invoiceId, organisation_id: organisationAId, payment_term_id: null, invoice_type: 'standard', due_date: new Date('2026-08-31T00:00:00.000Z'), customer_purchase_order_reference: null }).executeTakeFirstOrThrow();
	const itemId = insertedId(await db.insertInto('financial_document_items').values({ organisation_id: organisationAId, financial_document_id: invoiceId, source_quotation_item_id: null, sales_item_type_id: salesItemTypeId, sales_catalog_item_id: null, unit_of_measure_id: null, line_number: 1, description: 'Accounting test invoice', quantity: '1.000000', unit_rate: '100.0000' }).executeTakeFirstOrThrow());
	await db.insertInto('financial_document_item_taxes').values({ organisation_id: organisationAId, financial_document_item_id: itemId, tax_category_id: taxCategoryId, sort_order: 1, applied_rate_percent: '20.0000', taxable_amount: '100.0000', tax_amount: '20.0000' }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_issue_events').values({ organisation_id: organisationAId, financial_document_id: invoiceId, issue_sequence: 1, issued_by_member_id: ownerAMemberId, delivery_channel: 'manual', issued_at: new Date('2026-08-18T10:00:00.000Z'), note: null }).executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004L controlled accounting posting and export evidence', () => {
	it('keeps Finance/Commercial view-only while Owner configures typed semantic account mappings', async () => {
		const financeService = new AccountingService(db, randomUUID, () => NOW);
		const initial = await financeService.getWorkspace(actorFinanceA);
		expect(initial.canConfigure).toBe(false);
		expect(initial.canPost).toBe(false);
		await expect(financeService.createAccount(actorFinanceA, { accountCode: '1100', name: 'Trade Receivables', accountType: 'asset' })).rejects.toBeInstanceOf(TenantAccessError);
		const ownerService = new AccountingService(db, randomUUID, () => NOW);
		const accountSpecs = [
			['1100', 'Trade Receivables', 'asset', 'accounts_receivable'], ['4000', 'Sales Revenue', 'revenue', 'sales_revenue'],
			['2200', 'VAT Control', 'liability', 'vat_control'], ['1000', 'Bank / Cash Receipts', 'asset', 'cash_receipts'],
			['2100', 'Customer Unapplied Cash', 'liability', 'customer_unapplied_cash'], ['6100', 'Bad Debt Expense', 'expense', 'bad_debt_expense'],
			['4900', 'Bad Debt Recovery Income', 'revenue', 'bad_debt_recovery_income']
		] as const;
		for (const [accountCode, name, accountType, mappingKey] of accountSpecs) {
			const account = await ownerService.createAccount(actorOwnerA, { accountCode, name, accountType });
			await ownerService.assignMapping(actorOwnerA, { mappingKey, accountPublicId: account.publicId, reason: 'Package 004L integration mapping.' });
		}
		const workspace = await ownerService.getWorkspace(actorOwnerA);
		expect(workspace.mappings).toHaveLength(7);
		const invoice = workspace.candidates.find((candidate) => candidate.sourceType === 'invoice_issue' && candidate.sourcePublicId === invoicePublicId);
		expect(invoice?.sourceAmount).toBe('120.0000');
		expect(invoice?.missingMappings).toEqual([]);
		expect(invoice?.lines).toEqual([
			expect.objectContaining({ mappingKey: 'accounts_receivable', debitAmount: '120.0000', creditAmount: '0.0000' }),
			expect.objectContaining({ mappingKey: 'sales_revenue', debitAmount: '0.0000', creditAmount: '100.0000' }),
			expect.objectContaining({ mappingKey: 'vat_control', debitAmount: '0.0000', creditAmount: '20.0000' })
		]);
	});

	it('honours explicit granular post deny above finance.manage then posts one balanced source-derived journal', async () => {
		const service = new AccountingService(db, randomUUID, () => NOW);
		const permission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.accounting.post').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({ organisation_id: organisationAId, organisation_member_id: ownerAMemberId, permission_id: permission.id, effect: 'deny', reason: 'Accounting integration explicit deny.' }).executeTakeFirstOrThrow();
		await expect(service.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId })).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationAId).where('organisation_member_id', '=', ownerAMemberId).where('permission_id', '=', permission.id).execute();
		const posted = await service.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId });
		journalPublicId = posted.publicId;
		expect(posted.journalNumber).toBe('JRN-000001');
		const journal = await db.selectFrom('accounting_journal_entries').select(['id', 'source_amount as sourceAmount', 'source_fingerprint as fingerprint']).where('organisation_id', '=', organisationAId).where('public_id', '=', journalPublicId).executeTakeFirstOrThrow();
		expect(journal.sourceAmount).toBe('120.0000');
		expect(journal.fingerprint).toMatch(/^[a-f0-9]{64}$/);
		const lines = await db.selectFrom('accounting_journal_lines').select(['debit_amount as debitAmount', 'credit_amount as creditAmount']).where('organisation_id', '=', organisationAId).where('journal_entry_id', '=', journal.id).execute();
		expect(lines.reduce((sum, line) => sum + Number(line.debitAmount), 0)).toBe(120);
		expect(lines.reduce((sum, line) => sum + Number(line.creditAmount), 0)).toBe(120);
		await expect(service.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId })).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('reverses journals additively, preserves the original and permits a controlled repost', async () => {
		const service = new AccountingService(db, randomUUID, () => NOW);
		const reversed = await service.reverseJournal(actorOwnerA, { journalPublicId, accountingDate: '2026-08-18', reason: 'Correct accounting mapping after review.' });
		reversalJournalPublicId = reversed.publicId;
		expect(reversed.journalNumber).toBe('JRN-000002');
		const original = await db.selectFrom('accounting_journal_entries').select(['id', 'journal_number as journalNumber']).where('organisation_id', '=', organisationAId).where('public_id', '=', journalPublicId).executeTakeFirstOrThrow();
		const reversalLink = await db.selectFrom('accounting_journal_entry_reversals').select('reversal_journal_entry_id as reversalJournalId').where('organisation_id', '=', organisationAId).where('journal_entry_id', '=', original.id).executeTakeFirstOrThrow();
		const reversalJournal = await db.selectFrom('accounting_journal_entries').select(['id', 'source_type as sourceType']).where('organisation_id', '=', organisationAId).where('public_id', '=', reversalJournalPublicId).executeTakeFirstOrThrow();
		expect(reversalLink.reversalJournalId).toBe(reversalJournal.id);
		expect(reversalJournal.sourceType).toBe('journal_reversal');
		expect(original.journalNumber).toBe('JRN-000001');
		const reposted = await service.postSource(actorOwnerA, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId, memo: 'Repost after additive reversal.' });
		repostJournalPublicId = reposted.publicId;
		expect(reposted.journalNumber).toBe('JRN-000003');
	});

	it('creates checksum-backed generic CSV export evidence, prevents duplicate active export, then re-enables after additive export reversal', async () => {
		const service = new AccountingService(db, randomUUID, () => NOW);
		await new AccountingPeriodService(db, randomUUID, () => NOW).softClose(actorOwnerA, periodAPublicId, 'Ready for accounting export.');
		const created = await service.createExport(actorOwnerA, { periodStart: '2026-08-18', periodEnd: '2026-08-18', reason: 'Export posted accounting evidence for external review.' });
		exportPublicId = created.publicId;
		expect(created.exportNumber).toBe('AEX-000001');
		expect(created.content).toContain('journal_number,accounting_date,source_type');
		expect(createHash('sha256').update(created.content).digest('hex')).toMatch(/^[a-f0-9]{64}$/);
		const fetched = await service.getExportContent(actorOwnerA, exportPublicId);
		expect(fetched.content).toBe(created.content);
		expect(fetched.contentSha256).toBe(createHash('sha256').update(created.content).digest('hex'));
		await expect(service.createExport(actorOwnerA, { periodStart: '2026-08-18', periodEnd: '2026-08-18', reason: 'No duplicate active export.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await service.reverseExport(actorOwnerA, { exportPublicId, reason: 'External export was withdrawn before import.' });
		const replacement = await service.createExport(actorOwnerA, { periodStart: '2026-08-18', periodEnd: '2026-08-18', reason: 'Replacement export after explicit reversal.' });
		expect(replacement.exportNumber).toBe('AEX-000002');
	});

	it('masks accounting journal and export identities across tenants', async () => {
		const serviceB = new AccountingService(db, randomUUID, () => NOW);
		await expect(serviceB.getExportContent(actorOwnerB, exportPublicId)).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(serviceB.reverseJournal(actorOwnerB, { journalPublicId: repostJournalPublicId, accountingDate: '2026-08-18', reason: 'Foreign tenant must not see journal.' })).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
