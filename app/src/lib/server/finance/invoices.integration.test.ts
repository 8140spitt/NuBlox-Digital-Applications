import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { BillingSettingsService } from './billing-settings-service';
import { FinanceValidationError } from './finance-common';
import { InvoiceService } from './invoice-service';

const PREFIX = 'AR Invoice Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let readOnlyAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let readOnlyAMemberId = '';
let ownerBMemberId = '';
let customerPartyId = '';
let customerPartyPublicId = '';
let billingContactPartyId = '';
let executedContractPublicId = '';
let draftContractPublicId = '';
let taxCategoryPublicId = '';
let salesItemTypeCode = '';
let unitCode = '';
let paymentTermPublicId = '';
let firstInvoicePublicId = '';
let secondInvoicePublicId = '';
let actorOwnerA: TenantActorContext;
let actorReadOnlyA: TenantActorContext;
let actorOwnerB: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('financial_document_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_party_snapshot_addresses').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_party_snapshots').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_item_taxes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_billing_settings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_terms').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_version_value_components').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_version_parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_versions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contracts').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisation_contacts').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_addresses').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('addresses').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_email_addresses').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_category_rates').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_categories').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_persons').where('organisation_id', 'in', ids).execute();
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
	return insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: new Date('2026-08-16T08:00:00.000Z') }).executeTakeFirstOrThrow());
}

async function assignRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

async function createOrganisationParty(): Promise<void> {
	customerPartyPublicId = randomUUID();
	customerPartyId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationAId, public_id: customerPartyPublicId, party_kind: 'organisation', account_owner_member_id: ownerAMemberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerPartyId, organisation_id: organisationAId, legal_name: `${PREFIX}Client Ltd`, trading_name: null }).executeTakeFirstOrThrow();
	await db.insertInto('party_email_addresses').values({ party_id: customerPartyId, organisation_id: organisationAId, email: 'billing-client@example.test', label: 'Billing', is_primary: 1, is_verified: 1 }).executeTakeFirstOrThrow();
	const addressId = insertedId(await db.insertInto('addresses').values({ organisation_id: organisationAId, line_1: '10 Invoice Street', city: 'London', postal_code: 'EC1A 1AA', country_code: 'GB' }).executeTakeFirstOrThrow());
	await db.insertInto('party_addresses').values({ organisation_id: organisationAId, party_id: customerPartyId, address_id: addressId, address_role: 'billing', is_primary: 1 }).executeTakeFirstOrThrow();

	const contactPublicId = randomUUID();
	billingContactPartyId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationAId, public_id: contactPublicId, party_kind: 'person', account_owner_member_id: ownerAMemberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_persons').values({ party_id: billingContactPartyId, organisation_id: organisationAId, given_names: 'Alex', family_name: 'Accounts', preferred_name: 'Alex' }).executeTakeFirstOrThrow();
	await db.insertInto('party_email_addresses').values({ party_id: billingContactPartyId, organisation_id: organisationAId, email: 'accounts@example.test', label: 'Work', is_primary: 1, is_verified: 1 }).executeTakeFirstOrThrow();
	await db.insertInto('party_organisation_contacts').values({ organisation_id: organisationAId, organisation_party_id: customerPartyId, person_party_id: billingContactPartyId, job_title: 'Accounts Payable', department: 'Finance', is_primary_contact: 1, started_on: new Date('2026-01-01T00:00:00.000Z'), ended_on: null }).executeTakeFirstOrThrow();
}

async function createContract(contractNumber: string, executed: boolean): Promise<string> {
	const contractType = await db.selectFrom('contract_types').select('id').where('code', '=', 'construction_contract').executeTakeFirstOrThrow();
	const clientRole = await db.selectFrom('contract_party_role_types').select('id').where('code', '=', 'client').executeTakeFirstOrThrow();
	const baseScope = await db.selectFrom('contract_value_component_types').select('id').where('code', '=', 'base_scope').executeTakeFirstOrThrow();
	const publicId = randomUUID();
	const contractId = insertedId(await db.insertInto('contracts').values({ organisation_id: organisationAId, public_id: publicId, contract_number: contractNumber, contract_type_id: contractType.id, project_id: null, opportunity_id: null, source_quotation_response_id: null, owner_member_id: ownerAMemberId, title: `${PREFIX}${contractNumber}`, currency_code: 'GBP', lifecycle_status: executed ? 'active' : 'draft', started_on: executed ? new Date('2026-08-01T00:00:00.000Z') : null }).executeTakeFirstOrThrow());
	const versionId = insertedId(await db.insertInto('contract_versions').values({ organisation_id: organisationAId, contract_id: contractId, version_number: 1, title: `${PREFIX}${contractNumber}`, customer_reference: null, version_status: executed ? 'executed' : 'draft', created_by_member_id: ownerAMemberId, locked_by_member_id: executed ? ownerAMemberId : null, locked_at: executed ? new Date('2026-08-01T09:00:00.000Z') : null }).executeTakeFirstOrThrow());
	await db.insertInto('contract_version_parties').values({ organisation_id: organisationAId, contract_version_id: versionId, source_party_id: customerPartyId, contract_party_role_type_id: clientRole.id, display_name: `${PREFIX}Client Ltd`, reference_identifier: null, sort_order: 1 }).executeTakeFirstOrThrow();
	if (executed) {
		await db.insertInto('contract_version_value_components').values({ organisation_id: organisationAId, contract_version_id: versionId, contract_value_component_type_id: baseScope.id, description: 'Executed scope', amount: '1000.0000', sort_order: 1 }).executeTakeFirstOrThrow();
	}
	return publicId;
}

async function createTaxFixture(): Promise<void> {
	taxCategoryPublicId = randomUUID();
	const taxCategoryId = insertedId(await db.insertInto('tax_categories').values({ organisation_id: organisationAId, public_id: taxCategoryPublicId, code: `${PREFIX.replaceAll(' ', '_').toUpperCase()}VAT`, name: `${PREFIX}VAT`, treatment: 'taxable', is_active: 1 }).executeTakeFirstOrThrow());
	await db.insertInto('tax_category_rates').values([
		{ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '20.0000', valid_from: new Date('2026-01-01T00:00:00.000Z'), valid_to: new Date('2026-08-15T00:00:00.000Z') },
		{ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '21.0000', valid_from: new Date('2026-08-16T00:00:00.000Z'), valid_to: null }
	]).execute();
	const salesType = await db.selectFrom('sales_item_types').select('code').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow();
	const unit = await db.selectFrom('units_of_measure').select('code').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow();
	salesItemTypeCode = salesType.code;
	unitCode = unit.code;
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	readOnlyAUserId = await createUser('Read A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	readOnlyAMemberId = await createMember(organisationAId, readOnlyAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', ['contract.view', 'finance.view', 'finance.manage']);
	await assignRole(organisationAId, readOnlyAMemberId, 'Read A', ['contract.view', 'finance.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['contract.view', 'finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorReadOnlyA = { organisationId: organisationAId, userId: readOnlyAUserId, memberId: readOnlyAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };
	await createOrganisationParty();
	executedContractPublicId = await createContract('CON-AR-001', true);
	draftContractPublicId = await createContract('CON-AR-002', false);
	await createTaxFixture();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004 operational accounts receivable invoices', () => {
	it('manages payment terms and customer billing defaults through the finance umbrella', async () => {
		const service = new BillingSettingsService(db, randomUUID);
		paymentTermPublicId = await service.createPaymentTerm(actorOwnerA, { name: 'Net 30', calculationBasis: 'invoice_date', daysOffset: 30, isDefault: true });
		await service.setPartyBillingSettings(actorOwnerA, { partyPublicId: customerPartyPublicId, defaultPaymentTermPublicId: paymentTermPublicId, defaultCurrencyCode: 'GBP', customerAccountReference: 'CUST-AR-001', purchaseOrderRequired: true });
		const workspace = await service.getWorkspace(actorOwnerA);
		expect(workspace.paymentTerms).toHaveLength(1);
		expect(workspace.paymentTerms[0]).toMatchObject({ name: 'Net 30', calculationBasis: 'invoice_date', daysOffset: 30, isDefault: true });
		expect(workspace.parties.find((party) => party.partyPublicId === customerPartyPublicId)).toMatchObject({ defaultPaymentTermPublicId: paymentTermPublicId, defaultCurrencyCode: 'GBP', customerAccountReference: 'CUST-AR-001', purchaseOrderRequired: true });
		await expect(service.createPaymentTerm(actorReadOnlyA, { name: 'Forbidden', calculationBasis: 'manual', daysOffset: 0, isDefault: false })).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('creates only from an active executed contract and keeps draft invoices unnumbered', async () => {
		const service = new InvoiceService(db, randomUUID, () => new Date('2026-08-15T10:00:00.000Z'));
		await expect(service.createFromContract(actorOwnerA, { contractPublicId: draftContractPublicId, invoiceType: 'standard' })).rejects.toBeInstanceOf(FinanceValidationError);
		const created = await service.createFromContract(actorOwnerA, { contractPublicId: executedContractPublicId, invoiceType: 'interim' });
		firstInvoicePublicId = created.publicId;
		expect(created).toMatchObject({ documentNumber: null, lifecycleStatus: 'draft', invoiceType: 'interim', currencyCode: 'GBP', contractNumber: 'CON-AR-001' });
		const workspace = await service.getWorkspace(actorOwnerA, firstInvoicePublicId);
		expect(workspace.invoice.paymentTermPublicId).toBe(paymentTermPublicId);
		expect(workspace.invoice.purchaseOrderRequired).toBe(true);
		expect(workspace.invoice.billingContactPartyId).toBe(billingContactPartyId);
		expect(workspace.contractCurrentValue).toBe('1000.0000');
		expect(workspace.issuedContractNetBeforeThisInvoice).toBe('0.0000');
	});

	it('refreshes tax at issue, enforces customer PO policy, snapshots evidence and freezes the invoice', async () => {
		const draftService = new InvoiceService(db, randomUUID, () => new Date('2026-08-15T10:00:00.000Z'));
		await draftService.addLine(actorOwnerA, { invoicePublicId: firstInvoicePublicId, salesItemTypeCode, unitCode, description: 'Interim works valuation', quantity: '1', unitRate: '500.0000', taxCategoryPublicId });
		let draft = await draftService.getWorkspace(actorOwnerA, firstInvoicePublicId);
		expect(draft.lines[0]).toMatchObject({ netAmount: '500.0000', taxAmount: '100.0000', grossAmount: '600.0000' });
		const issueService = new InvoiceService(db, randomUUID, () => new Date('2026-08-16T11:00:00.000Z'));
		await expect(issueService.issue(actorOwnerA, { invoicePublicId: firstInvoicePublicId, deliveryChannel: 'manual' })).rejects.toThrow('purchase order/reference');
		await draftService.updateDraft(actorOwnerA, { invoicePublicId: firstInvoicePublicId, invoiceType: 'interim', paymentTermPublicId, customerPurchaseOrderReference: 'PO-CLIENT-1001' });
		await issueService.issue(actorOwnerA, { invoicePublicId: firstInvoicePublicId, deliveryChannel: 'manual', note: 'Issued by controlled AR workflow.' });
		const issued = await issueService.getWorkspace(actorOwnerA, firstInvoicePublicId);
		expect(issued.invoice).toMatchObject({ documentNumber: 'INV-000001', lifecycleStatus: 'issued', customerPurchaseOrderReference: 'PO-CLIENT-1001' });
		expect(issued.invoice.dueDate?.toISOString().slice(0, 10)).toBe('2026-09-15');
		expect(issued.lines[0]).toMatchObject({ netAmount: '500.0000', taxAmount: '105.0000', grossAmount: '605.0000' });
		expect(issued.partySnapshots.map((snapshot) => snapshot.snapshotRole).sort()).toEqual(['billing', 'customer']);
		expect(issued.partySnapshots.find((snapshot) => snapshot.snapshotRole === 'customer')).toMatchObject({ displayName: `${PREFIX}Client Ltd`, referenceIdentifier: 'CUST-AR-001' });
		expect(issued.issueEvents[0]).toMatchObject({ issueSequence: 1, deliveryChannel: 'manual', recipientName: 'Alex Accounts', recipientEmail: 'accounts@example.test', deliveryStatus: 'acknowledged' });
		const address = await db.selectFrom('financial_document_party_snapshot_addresses').select(['line_1 as line1', 'city', 'postal_code as postalCode']).where('organisation_id', '=', organisationAId).executeTakeFirstOrThrow();
		expect(address).toEqual({ line1: '10 Invoice Street', city: 'London', postalCode: 'EC1A 1AA' });
		await expect(draftService.addLine(actorOwnerA, { invoicePublicId: firstInvoicePublicId, salesItemTypeCode, description: 'Forbidden issued line', quantity: '1', unitRate: '1.0000', taxCategoryPublicId })).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('lets an explicit granular deny override finance.manage and allocates the next number after the deny is removed', async () => {
		const service = new InvoiceService(db, randomUUID, () => new Date('2026-08-16T12:00:00.000Z'));
		const created = await service.createFromContract(actorOwnerA, { contractPublicId: executedContractPublicId, invoiceType: 'standard' });
		secondInvoicePublicId = created.publicId;
		await service.addLine(actorOwnerA, { invoicePublicId: secondInvoicePublicId, salesItemTypeCode, unitCode, description: 'Second invoice', quantity: '1', unitRate: '100.0000', taxCategoryPublicId });
		await service.updateDraft(actorOwnerA, { invoicePublicId: secondInvoicePublicId, invoiceType: 'standard', paymentTermPublicId, customerPurchaseOrderReference: 'PO-CLIENT-1002' });
		const issuePermission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.invoice.issue').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({ organisation_id: organisationAId, organisation_member_id: ownerAMemberId, permission_id: issuePermission.id, effect: 'deny' }).executeTakeFirstOrThrow();
		await expect(service.issue(actorOwnerA, { invoicePublicId: secondInvoicePublicId, deliveryChannel: 'manual' })).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationAId).where('organisation_member_id', '=', ownerAMemberId).where('permission_id', '=', issuePermission.id).execute();
		await service.issue(actorOwnerA, { invoicePublicId: secondInvoicePublicId, deliveryChannel: 'manual' });
		const issued = await service.getWorkspace(actorOwnerA, secondInvoicePublicId);
		expect(issued.invoice.documentNumber).toBe('INV-000002');
		expect(issued.issuedContractNetBeforeThisInvoice).toBe('500.0000');
	});

	it('separates read authority from mutation and masks foreign-tenant invoice identity', async () => {
		const service = new InvoiceService(db);
		await expect(service.addLine(actorReadOnlyA, { invoicePublicId: secondInvoicePublicId, salesItemTypeCode, description: 'Forbidden', quantity: '1', unitRate: '1.0000', taxCategoryPublicId })).rejects.toBeInstanceOf(TenantAccessError);
		await expect(service.getWorkspace(actorOwnerB, firstInvoicePublicId)).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
