import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CreditNoteService } from './credit-note-service';
import { FinanceValidationError } from './finance-common';
import { InvoiceService } from './invoice-service';

const PREFIX = 'AR Correction Integration ';

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
let billingContactPartyId = '';
let executedContractPublicId = '';
let taxCategoryPublicId = '';
let salesItemTypeCode = '';
let unitCode = '';
let firstInvoicePublicId = '';
let secondInvoicePublicId = '';
let thirdInvoicePublicId = '';
let firstCreditNotePublicId = '';
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorOwnerB: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payments').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_party_snapshot_addresses').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_party_snapshots').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_note_item_sources').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_item_taxes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_notes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
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
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, status: 'active' })
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
				joined_at: new Date('2026-08-17T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignRole(
	organisationId: string,
	memberId: string,
	name: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 })
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
		.values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId })
		.executeTakeFirstOrThrow();
}

async function createCustomer(): Promise<void> {
	customerPartyPublicId = randomUUID();
	customerPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: customerPartyPublicId,
				party_kind: 'organisation',
				account_owner_member_id: ownerAMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({ party_id: customerPartyId, organisation_id: organisationAId, legal_name: `${PREFIX}Client Ltd`, trading_name: null })
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_email_addresses')
		.values({ party_id: customerPartyId, organisation_id: organisationAId, email: 'client-corrections@example.test', label: 'Billing', is_primary: 1, is_verified: 1 })
		.executeTakeFirstOrThrow();
	const addressId = insertedId(
		await db
			.insertInto('addresses')
			.values({ organisation_id: organisationAId, line_1: '20 Correction Road', city: 'London', postal_code: 'EC2A 2AA', country_code: 'GB' })
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_addresses')
		.values({ organisation_id: organisationAId, party_id: customerPartyId, address_id: addressId, address_role: 'billing', is_primary: 1 })
		.executeTakeFirstOrThrow();

	billingContactPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({ organisation_id: organisationAId, public_id: randomUUID(), party_kind: 'person', account_owner_member_id: ownerAMemberId, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_persons')
		.values({ party_id: billingContactPartyId, organisation_id: organisationAId, given_names: 'Casey', family_name: 'Credit', preferred_name: 'Casey' })
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_email_addresses')
		.values({ party_id: billingContactPartyId, organisation_id: organisationAId, email: 'credit-control@example.test', label: 'Work', is_primary: 1, is_verified: 1 })
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_organisation_contacts')
		.values({
			organisation_id: organisationAId,
			organisation_party_id: customerPartyId,
			person_party_id: billingContactPartyId,
			job_title: 'Credit Controller',
			department: 'Finance',
			is_primary_contact: 1,
			started_on: new Date('2026-01-01T00:00:00.000Z'),
			ended_on: null
		})
		.executeTakeFirstOrThrow();
}

async function createContract(): Promise<void> {
	const contractType = await db.selectFrom('contract_types').select('id').where('code', '=', 'construction_contract').executeTakeFirstOrThrow();
	const clientRole = await db.selectFrom('contract_party_role_types').select('id').where('code', '=', 'client').executeTakeFirstOrThrow();
	const baseScope = await db.selectFrom('contract_value_component_types').select('id').where('code', '=', 'base_scope').executeTakeFirstOrThrow();
	executedContractPublicId = randomUUID();
	const contractId = insertedId(
		await db
			.insertInto('contracts')
			.values({
				organisation_id: organisationAId,
				public_id: executedContractPublicId,
				contract_number: 'CON-CORR-001',
				contract_type_id: contractType.id,
				project_id: null,
				opportunity_id: null,
				source_quotation_response_id: null,
				owner_member_id: ownerAMemberId,
				title: `${PREFIX}Executed contract`,
				currency_code: 'GBP',
				lifecycle_status: 'active',
				started_on: new Date('2026-08-01T00:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const versionId = insertedId(
		await db
			.insertInto('contract_versions')
			.values({
				organisation_id: organisationAId,
				contract_id: contractId,
				version_number: 1,
				title: `${PREFIX}Executed contract`,
				customer_reference: null,
				version_status: 'executed',
				created_by_member_id: ownerAMemberId,
				locked_by_member_id: ownerAMemberId,
				locked_at: new Date('2026-08-01T09:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('contract_version_parties')
		.values({
			organisation_id: organisationAId,
			contract_version_id: versionId,
			source_party_id: customerPartyId,
			contract_party_role_type_id: clientRole.id,
			display_name: `${PREFIX}Client Ltd`,
			reference_identifier: null,
			sort_order: 1
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('contract_version_value_components')
		.values({
			organisation_id: organisationAId,
			contract_version_id: versionId,
			contract_value_component_type_id: baseScope.id,
			description: 'Executed scope',
			amount: '1000.0000',
			sort_order: 1
		})
		.executeTakeFirstOrThrow();
}

async function createTaxFixture(): Promise<void> {
	taxCategoryPublicId = randomUUID();
	const taxCategoryId = insertedId(
		await db
			.insertInto('tax_categories')
			.values({ organisation_id: organisationAId, public_id: taxCategoryPublicId, code: 'CORR_VAT', name: `${PREFIX}VAT`, treatment: 'taxable', is_active: 1 })
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('tax_category_rates')
		.values([
			{ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '20.0000', valid_from: new Date('2026-01-01T00:00:00.000Z'), valid_to: new Date('2026-08-15T00:00:00.000Z') },
			{ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '25.0000', valid_from: new Date('2026-08-16T00:00:00.000Z'), valid_to: null }
		])
		.execute();
	const salesType = await db.selectFrom('sales_item_types').select('code').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow();
	const unit = await db.selectFrom('units_of_measure').select('code').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow();
	salesItemTypeCode = salesType.code;
	unitCode = unit.code;
}

async function issueInvoice(description: string, quantity: string, unitRate: string): Promise<string> {
	const draftService = new InvoiceService(db, randomUUID, () => new Date('2026-08-15T10:00:00.000Z'));
	const created = await draftService.createFromContract(actorOwnerA, { contractPublicId: executedContractPublicId, invoiceType: 'standard' });
	await draftService.addLine(actorOwnerA, {
		invoicePublicId: created.publicId,
		salesItemTypeCode,
		unitCode,
		description,
		quantity,
		unitRate,
		taxCategoryPublicId
	});
	await draftService.updateDraft(actorOwnerA, {
		invoicePublicId: created.publicId,
		invoiceType: 'standard',
		dueDate: '2026-09-15'
	});
	await new InvoiceService(db, randomUUID, () => new Date('2026-08-15T12:00:00.000Z')).issue(actorOwnerA, {
		invoicePublicId: created.publicId,
		deliveryChannel: 'manual'
	});
	return created.publicId;
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
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', ['contract.view', 'finance.view', 'finance.manage']);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', ['finance.view', 'finance.credit_note.create', 'finance.credit_note.draft.manage', 'finance.credit_note.issue']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorFinanceA = { organisationId: organisationAId, userId: financeAUserId, memberId: financeAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };
	await createCustomer();
	await createContract();
	await createTaxFixture();
	firstInvoicePublicId = await issueInvoice('Two units of corrected work', '2', '100.0000');
	secondInvoicePublicId = await issueInvoice('Invoice eligible for controlled void', '1', '50.0000');
	thirdInvoicePublicId = await issueInvoice('Invoice with payment allocation', '1', '75.0000');
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004D receivable corrections', () => {
	it('creates an unnumbered source-linked credit-note draft without requiring contract authority', async () => {
		const service = new CreditNoteService(db, randomUUID, () => new Date('2026-08-16T10:00:00.000Z'));
		const created = await service.createFromInvoice(actorFinanceA, {
			invoicePublicId: firstInvoicePublicId,
			reason: 'Partial scope correction'
		});
		firstCreditNotePublicId = created.publicId;
		expect(created).toMatchObject({ documentNumber: null, lifecycleStatus: 'draft', reason: 'Partial scope correction', originalInvoiceNumber: 'INV-000001' });
		await service.addLine(actorFinanceA, {
			creditNotePublicId: firstCreditNotePublicId,
			originalInvoiceLineNumber: 1,
			quantity: '1'
		});
		const workspace = await service.getWorkspace(actorFinanceA, firstCreditNotePublicId);
		expect(workspace.lines[0]).toMatchObject({
			originalInvoiceLineNumber: 1,
			quantity: '1.000000',
			unitRate: '100.0000',
			netAmount: '100.0000',
			taxAmount: '20.0000',
			grossAmount: '120.0000'
		});
		await expect(service.addLine(actorFinanceA, {
			creditNotePublicId: firstCreditNotePublicId,
			originalInvoiceLineNumber: 1,
			quantity: '1'
		})).rejects.toThrow('already included');
	});

	it('lets an explicit granular deny override finance authority, then issues with original tax and immutable snapshots', async () => {
		const service = new CreditNoteService(db, randomUUID, () => new Date('2026-08-16T11:00:00.000Z'));
		const issuePermission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.credit_note.issue').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({
			organisation_id: organisationAId,
			organisation_member_id: financeAMemberId,
			permission_id: issuePermission.id,
			effect: 'deny'
		}).executeTakeFirstOrThrow();
		await expect(service.issue(actorFinanceA, {
			creditNotePublicId: firstCreditNotePublicId,
			deliveryChannel: 'manual'
		})).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', financeAMemberId)
			.where('permission_id', '=', issuePermission.id)
			.execute();
		await service.issue(actorFinanceA, {
			creditNotePublicId: firstCreditNotePublicId,
			deliveryChannel: 'manual',
			note: 'Issued correction against original tax evidence.'
		});
		const issued = await service.getWorkspace(actorFinanceA, firstCreditNotePublicId);
		expect(issued.creditNote).toMatchObject({ documentNumber: 'CN-000001', lifecycleStatus: 'issued', netTotal: '100.0000', taxTotal: '20.0000', grossTotal: '120.0000' });
		expect(issued.partySnapshots.map((snapshot) => snapshot.snapshotRole).sort()).toEqual(['billing', 'customer']);
		expect(issued.issueEvents[0]).toMatchObject({ deliveryChannel: 'manual', recipientName: 'Casey Credit', recipientEmail: 'credit-control@example.test', deliveryStatus: 'acknowledged' });
		const source = await db.selectFrom('credit_note_item_sources').select(['original_invoice_document_id as originalInvoiceDocumentId', 'original_invoice_item_id as originalInvoiceItemId']).where('organisation_id', '=', organisationAId).executeTakeFirstOrThrow();
		expect(source.originalInvoiceDocumentId).toBeDefined();
		expect(source.originalInvoiceItemId).toBeDefined();
		await expect(service.updateDraftReason(actorFinanceA, { creditNotePublicId: firstCreditNotePublicId, reason: 'Forbidden rewrite' })).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('prevents over-crediting and derives remaining receivable from issued credit notes', async () => {
		const service = new CreditNoteService(db, randomUUID, () => new Date('2026-08-16T12:00:00.000Z'));
		const second = await service.createFromInvoice(actorFinanceA, { invoicePublicId: firstInvoicePublicId, reason: 'Credit remaining unit' });
		await expect(service.addLine(actorFinanceA, { creditNotePublicId: second.publicId, originalInvoiceLineNumber: 1, quantity: '1.100000' })).rejects.toThrow('exceeds the remaining');
		await service.addLine(actorFinanceA, { creditNotePublicId: second.publicId, originalInvoiceLineNumber: 1, quantity: '1' });
		await service.issue(actorFinanceA, { creditNotePublicId: second.publicId, deliveryChannel: 'manual' });
		const secondIssued = await service.getWorkspace(actorFinanceA, second.publicId);
		expect(secondIssued.creditNote.documentNumber).toBe('CN-000002');
		const portfolio = await service.getPortfolio(actorFinanceA);
		const invoice = portfolio.invoices.find((candidate) => candidate.invoicePublicId === firstInvoicePublicId);
		expect(invoice).toMatchObject({ invoiceGross: '240.0000', issuedCreditGross: '240.0000', remainingGross: '0.0000', canCredit: false });
		await expect(service.createFromInvoice(actorFinanceA, { invoicePublicId: firstInvoicePublicId, reason: 'Over-credit forbidden' })).rejects.toThrow('no remaining amount');
	});

	it('keeps invoice voiding as stronger authority and blocks void after credit or active allocation history', async () => {
		const service = new CreditNoteService(db, randomUUID, () => new Date('2026-08-17T09:30:00.000Z'));
		await expect(service.voidInvoice(actorFinanceA, { invoicePublicId: secondInvoicePublicId, reason: 'Finance role cannot void' })).rejects.toBeInstanceOf(TenantAccessError);
		await service.voidInvoice(actorOwnerA, { invoicePublicId: secondInvoicePublicId, reason: 'Duplicate invoice issued in error' });
		const voided = await db.selectFrom('financial_documents').select(['lifecycle_status as lifecycleStatus', 'void_reason as voidReason', 'voided_by_member_id as voidedByMemberId']).where('organisation_id', '=', organisationAId).where('public_id', '=', secondInvoicePublicId).executeTakeFirstOrThrow();
		expect(voided).toMatchObject({ lifecycleStatus: 'void', voidReason: 'Duplicate invoice issued in error', voidedByMemberId: ownerAMemberId });
		await expect(service.voidInvoice(actorOwnerA, { invoicePublicId: firstInvoicePublicId, reason: 'Would double-correct' })).rejects.toThrow('credit note');

		const thirdInvoice = await db.selectFrom('financial_documents').select('id').where('organisation_id', '=', organisationAId).where('public_id', '=', thirdInvoicePublicId).executeTakeFirstOrThrow();
		const paymentMethod = await db.selectFrom('payment_methods').select('id').where('is_active', '=', 1).orderBy('id', 'asc').executeTakeFirstOrThrow();
		const paymentId = insertedId(await db.insertInto('payments').values({
			organisation_id: organisationAId,
			public_id: randomUUID(),
			payer_party_id: customerPartyId,
			payment_method_id: paymentMethod.id,
			received_at: new Date('2026-08-17T09:00:00.000Z'),
			amount: '90.0000',
			currency_code: 'GBP',
			payment_reference: 'PAY-CORR-001',
			created_by_member_id: ownerAMemberId
		}).executeTakeFirstOrThrow());
		const allocationId = insertedId(await db.insertInto('payment_allocations').values({
			organisation_id: organisationAId,
			payment_id: paymentId,
			invoice_document_id: thirdInvoice.id,
			allocated_amount: '90.0000',
			allocated_by_member_id: ownerAMemberId,
			allocated_at: new Date('2026-08-17T09:05:00.000Z')
		}).executeTakeFirstOrThrow());
		await expect(service.voidInvoice(actorOwnerA, { invoicePublicId: thirdInvoicePublicId, reason: 'Active allocation blocks void' })).rejects.toThrow('payment allocation');
		await db.insertInto('payment_allocation_reversals').values({
			payment_allocation_id: allocationId,
			organisation_id: organisationAId,
			reversed_by_member_id: ownerAMemberId,
			reversed_at: new Date('2026-08-17T09:10:00.000Z'),
			reason: 'Test reversal before invoice void'
		}).executeTakeFirstOrThrow();
		await service.voidInvoice(actorOwnerA, { invoicePublicId: thirdInvoicePublicId, reason: 'Allocation was reversed before void' });
	});

	it('masks foreign-tenant invoice and credit-note identities', async () => {
		const service = new CreditNoteService(db);
		await expect(service.getWorkspace(actorOwnerB, firstCreditNotePublicId)).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(service.createFromInvoice(actorOwnerB, { invoicePublicId: firstInvoicePublicId, reason: 'Foreign source' })).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
