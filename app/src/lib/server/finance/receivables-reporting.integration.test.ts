import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceValidationError } from './finance-common';
import { ReceivablesReportingService } from './receivables-reporting-service';

const PREFIX = 'Receivables Reporting Integration ';
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let financeAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let financeAMemberId = '';
let ownerBMemberId = '';
let customerPartyId = '';
let customerPartyPublicId = '';
let foreignCustomerPublicId = '';
let salesItemTypeId = 0;
let paymentMethodId = 0;
let invoiceOnePublicId = '';
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
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
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payments').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_note_item_sources').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_item_taxes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_notes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_billing_settings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
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
	return insertedId(
		await db.insertInto('organisations').values({
			public_id: randomUUID(),
			legal_name: `${PREFIX}${name}`,
			default_currency_code: 'GBP',
			default_timezone: 'Europe/London',
			status: 'active'
		}).executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({
		organisation_id: organisationId,
		user_id: userId,
		public_id: randomUUID(),
		status: 'active',
		joined_at: new Date('2026-05-01T08:00:00.000Z')
	}).executeTakeFirstOrThrow());
}

async function assignRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({
		organisation_id: organisationId,
		public_id: randomUUID(),
		name: `${PREFIX}${name}`,
		is_active: 1
	}).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((permission) => permission.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({
		organisation_id: organisationId,
		organisation_role_id: roleId,
		permission_id: permission.id
	}))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

async function createCustomer(organisationId: string, memberId: string, name: string, accountReference: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(await db.insertInto('parties').values({
		organisation_id: organisationId,
		public_id: publicId,
		party_kind: 'organisation',
		account_owner_member_id: memberId,
		status: 'active'
	}).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: id, organisation_id: organisationId, legal_name: `${PREFIX}${name}`, trading_name: null }).executeTakeFirstOrThrow();
	await db.insertInto('party_billing_settings').values({
		party_id: id,
		organisation_id: organisationId,
		default_payment_term_id: null,
		default_currency_code: 'GBP',
		customer_account_reference: accountReference,
		purchase_order_required: 0
	}).executeTakeFirstOrThrow();
	return { id, publicId };
}

async function createInvoice(input: {
	number: string;
	currency: string;
	amount: string;
	issuedAt: string;
	dueOn: string;
	voidedAt?: string;
	voidReason?: string;
}): Promise<{ id: string; publicId: string; itemId: string }> {
	const publicId = randomUUID();
	const id = insertedId(await db.insertInto('financial_documents').values({
		organisation_id: organisationAId,
		public_id: publicId,
		document_kind: 'invoice',
		document_number: input.number,
		customer_party_id: customerPartyId,
		billing_contact_party_id: null,
		project_id: null,
		contract_id: null,
		currency_code: input.currency,
		lifecycle_status: input.voidedAt ? 'void' : 'issued',
		created_by_member_id: ownerAMemberId,
		voided_by_member_id: input.voidedAt ? ownerAMemberId : null,
		voided_at: input.voidedAt ? new Date(input.voidedAt) : null,
		void_reason: input.voidReason ?? null
	}).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({
		financial_document_id: id,
		organisation_id: organisationAId,
		payment_term_id: null,
		invoice_type: 'standard',
		due_date: new Date(`${input.dueOn}T00:00:00.000Z`),
		customer_purchase_order_reference: null
	}).executeTakeFirstOrThrow();
	const itemId = insertedId(await db.insertInto('financial_document_items').values({
		organisation_id: organisationAId,
		financial_document_id: id,
		source_quotation_item_id: null,
		sales_item_type_id: salesItemTypeId,
		sales_catalog_item_id: null,
		unit_of_measure_id: null,
		line_number: 1,
		description: `${PREFIX}${input.number}`,
		quantity: '1.000000',
		unit_rate: input.amount
	}).executeTakeFirstOrThrow());
	await db.insertInto('financial_document_issue_events').values({
		organisation_id: organisationAId,
		financial_document_id: id,
		issue_sequence: 1,
		issued_by_member_id: ownerAMemberId,
		delivery_channel: 'manual',
		issued_at: new Date(input.issuedAt),
		note: null
	}).executeTakeFirstOrThrow();
	return { id, publicId, itemId };
}

async function createCredit(invoiceId: string, invoiceItemId: string, amount: string, issuedAt: string): Promise<void> {
	const id = insertedId(await db.insertInto('financial_documents').values({
		organisation_id: organisationAId,
		public_id: randomUUID(),
		document_kind: 'credit_note',
		document_number: 'CN-AR-001',
		customer_party_id: customerPartyId,
		billing_contact_party_id: null,
		project_id: null,
		contract_id: null,
		currency_code: 'GBP',
		lifecycle_status: 'issued',
		created_by_member_id: ownerAMemberId,
		voided_by_member_id: null,
		voided_at: null,
		void_reason: null
	}).executeTakeFirstOrThrow());
	await db.insertInto('credit_notes').values({ financial_document_id: id, organisation_id: organisationAId, original_invoice_document_id: invoiceId, reason: 'Historic account correction' }).executeTakeFirstOrThrow();
	const itemId = insertedId(await db.insertInto('financial_document_items').values({
		organisation_id: organisationAId,
		financial_document_id: id,
		source_quotation_item_id: null,
		sales_item_type_id: salesItemTypeId,
		sales_catalog_item_id: null,
		unit_of_measure_id: null,
		line_number: 1,
		description: `${PREFIX}Credit`,
		quantity: '1.000000',
		unit_rate: amount
	}).executeTakeFirstOrThrow());
	await db.insertInto('credit_note_item_sources').values({
		organisation_id: organisationAId,
		credit_note_document_id: id,
		credit_note_item_id: itemId,
		original_invoice_document_id: invoiceId,
		original_invoice_item_id: invoiceItemId
	}).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_issue_events').values({
		organisation_id: organisationAId,
		financial_document_id: id,
		issue_sequence: 1,
		issued_by_member_id: ownerAMemberId,
		delivery_channel: 'manual',
		issued_at: new Date(issuedAt),
		note: null
	}).executeTakeFirstOrThrow();
}

async function createAllocation(input: { invoiceId: string; amount: string; allocatedAt: string; reference: string; reversedAt?: string }): Promise<string> {
	const paymentId = insertedId(await db.insertInto('payments').values({
		organisation_id: organisationAId,
		public_id: randomUUID(),
		payer_party_id: customerPartyId,
		payment_method_id: paymentMethodId,
		received_at: new Date(input.allocatedAt),
		amount: input.amount,
		currency_code: 'GBP',
		payment_reference: input.reference,
		created_by_member_id: ownerAMemberId
	}).executeTakeFirstOrThrow());
	const allocationId = insertedId(await db.insertInto('payment_allocations').values({
		organisation_id: organisationAId,
		payment_id: paymentId,
		invoice_document_id: input.invoiceId,
		allocated_amount: input.amount,
		allocated_by_member_id: ownerAMemberId,
		allocated_at: new Date(input.allocatedAt)
	}).executeTakeFirstOrThrow());
	if (input.reversedAt) {
		await db.insertInto('payment_allocation_reversals').values({
			payment_allocation_id: allocationId,
			organisation_id: organisationAId,
			reversed_by_member_id: ownerAMemberId,
			reversed_at: new Date(input.reversedAt),
			reason: 'Historic allocation correction'
		}).executeTakeFirstOrThrow();
	}
	return allocationId;
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
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', ['finance.view', 'finance.manage']);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', ['finance.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorFinanceA = { organisationId: organisationAId, userId: financeAUserId, memberId: financeAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };
	const customer = await createCustomer(organisationAId, ownerAMemberId, 'Client Ltd', 'AR-001');
	customerPartyId = customer.id;
	customerPartyPublicId = customer.publicId;
	foreignCustomerPublicId = (await createCustomer(organisationBId, ownerBMemberId, 'Foreign Client Ltd', 'AR-B-001')).publicId;
	salesItemTypeId = (await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow()).id;
	paymentMethodId = (await db.selectFrom('payment_methods').select('id').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow()).id;
	const invoiceOne = await createInvoice({ number: 'INV-AR-001', currency: 'GBP', amount: '100.0000', issuedAt: '2026-05-01T09:00:00.000Z', dueOn: '2026-05-15' });
	invoiceOnePublicId = invoiceOne.publicId;
	await createCredit(invoiceOne.id, invoiceOne.itemId, '20.0000', '2026-06-01T10:00:00.000Z');
	await createAllocation({ invoiceId: invoiceOne.id, amount: '30.0000', allocatedAt: '2026-06-15T10:00:00.000Z', reference: 'PAY-AR-001', reversedAt: '2026-08-10T08:00:00.000Z' });
	const invoiceTwo = await createInvoice({ number: 'INV-AR-002', currency: 'GBP', amount: '200.0000', issuedAt: '2026-08-10T09:00:00.000Z', dueOn: '2026-08-31' });
	await createAllocation({ invoiceId: invoiceTwo.id, amount: '50.0000', allocatedAt: '2026-08-12T11:00:00.000Z', reference: 'PAY-AR-002' });
	await createInvoice({ number: 'INV-AR-EUR', currency: 'EUR', amount: '100.0000', issuedAt: '2026-07-01T09:00:00.000Z', dueOn: '2026-07-15' });
	await createInvoice({ number: 'INV-AR-VOID', currency: 'GBP', amount: '60.0000', issuedAt: '2026-05-05T09:00:00.000Z', dueOn: '2026-05-20', voidedAt: '2026-06-20T10:00:00.000Z', voidReason: 'Duplicate invoice' });
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004F customer statements and aged receivables', () => {
	it('derives current aged receivables per currency without cross-currency aggregation', async () => {
		const service = new ReceivablesReportingService(db, () => new Date('2026-08-17T12:00:00.000Z'));
		const portfolio = await service.getPortfolio(actorFinanceA);
		expect(portfolio.asOf).toBe('2026-08-17');
		const account = portfolio.accounts.find((row) => row.customerPartyPublicId === customerPartyPublicId);
		expect(account?.customerAccountReference).toBe('AR-001');
		const gbp = account?.positions.find((position) => position.currencyCode === 'GBP');
		expect(gbp).toMatchObject({ issuedInvoiceCount: 3, openInvoiceCount: 2, totalOutstanding: '230.0000' });
		expect(gbp?.buckets.find((bucket) => bucket.code === 'current')?.amount).toBe('150.0000');
		expect(gbp?.buckets.find((bucket) => bucket.code === '91_plus')?.amount).toBe('80.0000');
		const eur = account?.positions.find((position) => position.currencyCode === 'EUR');
		expect(eur).toMatchObject({ issuedInvoiceCount: 1, openInvoiceCount: 1, totalOutstanding: '100.0000' });
		expect(eur?.buckets.find((bucket) => bucket.code === '31_60')?.amount).toBe('100.0000');
		expect(portfolio.totals.map((total) => total.currencyCode).sort()).toEqual(['EUR', 'GBP']);
	});

	it('reconstructs a historical statement and historical aging before a later allocation reversal', async () => {
		const service = new ReceivablesReportingService(db, () => new Date('2026-08-17T12:00:00.000Z'));
		const workspace = await service.getCustomerStatement(actorFinanceA, customerPartyPublicId, { from: '2026-06-01', to: '2026-07-31' });
		const gbp = workspace.statements.find((statement) => statement.currencyCode === 'GBP');
		expect(gbp?.openingBalance).toBe('160.0000');
		expect(gbp?.movements.map((movement) => movement.kind)).toEqual(['credit_note', 'payment_allocation', 'invoice_void']);
		expect(gbp?.closingBalance).toBe('50.0000');
		const gbpAging = workspace.aging.find((position) => position.currencyCode === 'GBP');
		expect(gbpAging?.totalOutstanding).toBe('50.0000');
		expect(gbpAging?.invoices[0]).toMatchObject({ invoicePublicId: invoiceOnePublicId, outstandingAmount: '50.0000', bucket: '61_90' });
		const eurAging = workspace.aging.find((position) => position.currencyCode === 'EUR');
		expect(eurAging?.invoices[0]).toMatchObject({ outstandingAmount: '100.0000', bucket: '1_30' });
	});

	it('carries opening balances into the current period and reconciles closing balance to current aging', async () => {
		const service = new ReceivablesReportingService(db, () => new Date('2026-08-17T12:00:00.000Z'));
		const workspace = await service.getCustomerStatement(actorFinanceA, customerPartyPublicId, { from: '2026-08-01', to: '2026-08-17' });
		const gbp = workspace.statements.find((statement) => statement.currencyCode === 'GBP');
		expect(gbp?.openingBalance).toBe('50.0000');
		expect(gbp?.movements.map((movement) => movement.kind)).toEqual(['allocation_reversal', 'invoice', 'payment_allocation']);
		expect(gbp?.closingBalance).toBe('230.0000');
		expect(workspace.aging.find((position) => position.currencyCode === 'GBP')?.totalOutstanding).toBe('230.0000');
	});

	it('lets an explicit finance.view deny remove reporting access even when finance.manage is granted', async () => {
		const permission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.view').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({
			organisation_id: organisationAId,
			organisation_member_id: ownerAMemberId,
			permission_id: permission.id,
			effect: 'deny'
		}).executeTakeFirstOrThrow();
		const service = new ReceivablesReportingService(db, () => new Date('2026-08-17T12:00:00.000Z'));
		await expect(service.getPortfolio(actorOwnerA)).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationAId).where('organisation_member_id', '=', ownerAMemberId).where('permission_id', '=', permission.id).execute();
		await expect(service.getPortfolio(actorOwnerA)).resolves.toMatchObject({ asOf: '2026-08-17' });
	});

	it('masks foreign-tenant customer accounts and validates statement periods', async () => {
		const service = new ReceivablesReportingService(db, () => new Date('2026-08-17T12:00:00.000Z'));
		await expect(service.getCustomerStatement(actorFinanceA, foreignCustomerPublicId)).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(service.getCustomerStatement(actorOwnerB, customerPartyPublicId)).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(service.getCustomerStatement(actorFinanceA, customerPartyPublicId, { from: '2026-08-18', to: '2026-08-17' })).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(service.getCustomerStatement(actorFinanceA, customerPartyPublicId, { from: '2026-08-01', to: '2026-08-18' })).rejects.toThrow('cannot be in the future');
	});
});
