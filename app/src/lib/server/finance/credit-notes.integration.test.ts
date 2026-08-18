import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { lineAmount, percentageAmount } from '$lib/server/commercial/commercial-decimal';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CreditNoteService } from './credit-note-service';
import { FinanceValidationError } from './finance-common';

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
let salesItemTypeId = 0;
let taxCategoryId = '';
let firstInvoicePublicId = '';
let secondInvoicePublicId = '';
let thirdInvoicePublicId = '';
let thirdInvoiceDocumentId = '';
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
	await db
		.deleteFrom('financial_document_issue_recipients')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('financial_document_issue_events')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('financial_document_party_snapshot_addresses')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('financial_document_party_snapshots')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('credit_note_item_sources').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('financial_document_item_taxes')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_notes').where('organisation_id', 'in', ids).execute();
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

async function createCustomer(): Promise<void> {
	customerPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				party_kind: 'organisation',
				account_owner_member_id: ownerAMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: customerPartyId,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}Client Ltd`,
			trading_name: null
		})
		.executeTakeFirstOrThrow();
}

async function createTaxCategory(): Promise<void> {
	taxCategoryId = insertedId(
		await db
			.insertInto('tax_categories')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				code: 'CORR_VAT',
				name: `${PREFIX}VAT`,
				treatment: 'taxable',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	// A current 25% rate deliberately differs from the historical 20% rate
	// snapshotted on the source invoices below. Credit notes must use the source rate.
	await db
		.insertInto('tax_category_rates')
		.values({
			organisation_id: organisationAId,
			tax_category_id: taxCategoryId,
			rate_percent: '25.0000',
			valid_from: new Date('2026-08-16T00:00:00.000Z'),
			valid_to: null
		})
		.executeTakeFirstOrThrow();
}

async function createIssuedInvoice(
	documentNumber: string,
	description: string,
	quantity: string,
	unitRate: string
): Promise<{ publicId: string; documentId: string }> {
	const publicId = randomUUID();
	const documentId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationAId,
				public_id: publicId,
				document_kind: 'invoice',
				document_number: documentNumber,
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
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('invoices')
		.values({
			financial_document_id: documentId,
			organisation_id: organisationAId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: new Date('2026-09-15T00:00:00.000Z'),
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	const itemId = insertedId(
		await db
			.insertInto('financial_document_items')
			.values({
				organisation_id: organisationAId,
				financial_document_id: documentId,
				source_quotation_item_id: null,
				sales_item_type_id: salesItemTypeId,
				sales_catalog_item_id: null,
				unit_of_measure_id: null,
				line_number: 1,
				description,
				quantity,
				unit_rate: unitRate
			})
			.executeTakeFirstOrThrow()
	);
	const net = lineAmount(quantity, unitRate);
	await db
		.insertInto('financial_document_item_taxes')
		.values({
			organisation_id: organisationAId,
			financial_document_item_id: itemId,
			tax_category_id: taxCategoryId,
			sort_order: 1,
			applied_rate_percent: '20.0000',
			taxable_amount: net,
			tax_amount: percentageAmount(net, '20.0000')
		})
		.executeTakeFirstOrThrow();
	const snapshotId = insertedId(
		await db
			.insertInto('financial_document_party_snapshots')
			.values({
				organisation_id: organisationAId,
				financial_document_id: documentId,
				source_party_id: customerPartyId,
				snapshot_role: 'customer',
				display_name: `${PREFIX}Client Ltd`,
				email: 'credit-control@example.test',
				phone: null,
				reference_identifier: 'CUST-CORR-001',
				sort_order: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('financial_document_party_snapshot_addresses')
		.values({
			organisation_id: organisationAId,
			financial_document_party_snapshot_id: snapshotId,
			financial_document_id: documentId,
			address_role: 'billing',
			line_1: '20 Correction Road',
			line_2: null,
			line_3: null,
			locality: null,
			city: 'London',
			region: null,
			postal_code: 'EC2A 2AA',
			country_code: 'GB'
		})
		.executeTakeFirstOrThrow();
	const issueId = insertedId(
		await db
			.insertInto('financial_document_issue_events')
			.values({
				organisation_id: organisationAId,
				financial_document_id: documentId,
				issue_sequence: 1,
				issued_by_member_id: ownerAMemberId,
				delivery_channel: 'manual',
				issued_at: new Date('2026-08-15T12:00:00.000Z'),
				note: 'Historical source invoice.'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('financial_document_issue_recipients')
		.values({
			organisation_id: organisationAId,
			financial_document_issue_event_id: issueId,
			financial_document_id: documentId,
			source_party_id: customerPartyId,
			recipient_name: 'AR Customer',
			recipient_email: 'credit-control@example.test',
			delivery_status: 'acknowledged',
			delivered_at: new Date('2026-08-15T12:00:00.000Z')
		})
		.executeTakeFirstOrThrow();
	return { publicId, documentId };
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
	await assignRole(organisationAId, financeAMemberId, 'Finance A', [
		'finance.view',
		'finance.credit_note.create',
		'finance.credit_note.draft.manage',
		'finance.credit_note.issue'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
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
	await createCustomer();
	const salesType = await db
		.selectFrom('sales_item_types')
		.select('id')
		.where('is_active', '=', 1)
		.orderBy('id', 'asc')
		.executeTakeFirstOrThrow();
	salesItemTypeId = salesType.id;
	await createTaxCategory();
	const first = await createIssuedInvoice(
		'INV-000001',
		'Two units of corrected work',
		'2.000000',
		'100.0000'
	);
	const second = await createIssuedInvoice(
		'INV-000002',
		'Invoice eligible for controlled void',
		'1.000000',
		'50.0000'
	);
	const third = await createIssuedInvoice(
		'INV-000003',
		'Invoice with payment allocation',
		'1.000000',
		'75.0000'
	);
	firstInvoicePublicId = first.publicId;
	secondInvoicePublicId = second.publicId;
	thirdInvoicePublicId = third.publicId;
	thirdInvoiceDocumentId = third.documentId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004D receivable corrections', () => {
	it('creates an unnumbered source-linked credit-note draft without requiring contract authority', async () => {
		const service = new CreditNoteService(
			db,
			randomUUID,
			() => new Date('2026-08-17T09:00:00.000Z')
		);
		const created = await service.createFromInvoice(actorFinanceA, {
			invoicePublicId: firstInvoicePublicId,
			reason: 'Partial scope correction'
		});
		firstCreditNotePublicId = created.publicId;
		expect(created).toMatchObject({
			documentNumber: null,
			lifecycleStatus: 'draft',
			reason: 'Partial scope correction',
			originalInvoiceNumber: 'INV-000001'
		});
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
		await expect(
			service.addLine(actorFinanceA, {
				creditNotePublicId: firstCreditNotePublicId,
				originalInvoiceLineNumber: 1,
				quantity: '1'
			})
		).rejects.toThrow('already included');
	});

	it('lets an explicit granular deny override finance authority, then issues with original tax and immutable snapshots', async () => {
		const service = new CreditNoteService(
			db,
			randomUUID,
			() => new Date('2026-08-17T09:15:00.000Z')
		);
		const issuePermission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.credit_note.issue')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: financeAMemberId,
				permission_id: issuePermission.id,
				effect: 'deny'
			})
			.executeTakeFirstOrThrow();
		await expect(
			service.issue(actorFinanceA, {
				creditNotePublicId: firstCreditNotePublicId,
				deliveryChannel: 'manual'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', financeAMemberId)
			.where('permission_id', '=', issuePermission.id)
			.execute();
		await service.issue(actorFinanceA, {
			creditNotePublicId: firstCreditNotePublicId,
			deliveryChannel: 'manual',
			note: 'Issued against original invoice tax evidence.'
		});
		const issued = await service.getWorkspace(actorFinanceA, firstCreditNotePublicId);
		expect(issued.creditNote).toMatchObject({
			documentNumber: 'CN-000001',
			lifecycleStatus: 'issued',
			netTotal: '100.0000',
			taxTotal: '20.0000',
			grossTotal: '120.0000'
		});
		expect(issued.partySnapshots.map((snapshot) => snapshot.snapshotRole)).toEqual(['customer']);
		expect(issued.issueEvents[0]).toMatchObject({
			deliveryChannel: 'manual',
			recipientName: 'AR Customer',
			recipientEmail: 'credit-control@example.test',
			deliveryStatus: 'acknowledged'
		});
		const address = await db
			.selectFrom('financial_document_party_snapshot_addresses as address')
			.innerJoin('financial_document_party_snapshots as snapshot', (join) =>
				join
					.onRef('snapshot.id', '=', 'address.financial_document_party_snapshot_id')
					.onRef('snapshot.organisation_id', '=', 'address.organisation_id')
			)
			.innerJoin('financial_documents as document', (join) =>
				join
					.onRef('document.id', '=', 'snapshot.financial_document_id')
					.onRef('document.organisation_id', '=', 'snapshot.organisation_id')
			)
			.select(['address.line_1 as line1', 'address.postal_code as postalCode'])
			.where('address.organisation_id', '=', organisationAId)
			.where('document.public_id', '=', firstCreditNotePublicId)
			.executeTakeFirstOrThrow();
		expect(address).toEqual({ line1: '20 Correction Road', postalCode: 'EC2A 2AA' });
		await expect(
			service.updateDraftReason(actorFinanceA, {
				creditNotePublicId: firstCreditNotePublicId,
				reason: 'Forbidden rewrite'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('prevents over-crediting and derives remaining receivable from issued credit notes', async () => {
		const service = new CreditNoteService(
			db,
			randomUUID,
			() => new Date('2026-08-17T09:30:00.000Z')
		);
		const second = await service.createFromInvoice(actorFinanceA, {
			invoicePublicId: firstInvoicePublicId,
			reason: 'Credit remaining unit'
		});
		await expect(
			service.addLine(actorFinanceA, {
				creditNotePublicId: second.publicId,
				originalInvoiceLineNumber: 1,
				quantity: '1.100000'
			})
		).rejects.toThrow('exceeds the remaining');
		await service.addLine(actorFinanceA, {
			creditNotePublicId: second.publicId,
			originalInvoiceLineNumber: 1,
			quantity: '1'
		});
		await service.issue(actorFinanceA, {
			creditNotePublicId: second.publicId,
			deliveryChannel: 'manual'
		});
		const issued = await service.getWorkspace(actorFinanceA, second.publicId);
		expect(issued.creditNote.documentNumber).toBe('CN-000002');
		const portfolio = await service.getPortfolio(actorFinanceA);
		const invoice = portfolio.invoices.find(
			(candidate) => candidate.invoicePublicId === firstInvoicePublicId
		);
		expect(invoice).toMatchObject({
			invoiceGross: '240.0000',
			issuedCreditGross: '240.0000',
			remainingGross: '0.0000',
			canCredit: false
		});
		await expect(
			service.createFromInvoice(actorFinanceA, {
				invoicePublicId: firstInvoicePublicId,
				reason: 'Over-credit forbidden'
			})
		).rejects.toThrow('no remaining amount');
	});

	it('keeps invoice voiding as stronger authority and blocks void after credit or active allocation history', async () => {
		const service = new CreditNoteService(
			db,
			randomUUID,
			() => new Date('2026-08-17T09:45:00.000Z')
		);
		await expect(
			service.voidInvoice(actorFinanceA, {
				invoicePublicId: secondInvoicePublicId,
				reason: 'Finance role cannot void'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await service.voidInvoice(actorOwnerA, {
			invoicePublicId: secondInvoicePublicId,
			reason: 'Duplicate invoice issued in error'
		});
		const voided = await db
			.selectFrom('financial_documents')
			.select([
				'lifecycle_status as lifecycleStatus',
				'void_reason as voidReason',
				'voided_by_member_id as voidedByMemberId'
			])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', secondInvoicePublicId)
			.executeTakeFirstOrThrow();
		expect(voided).toMatchObject({
			lifecycleStatus: 'void',
			voidReason: 'Duplicate invoice issued in error',
			voidedByMemberId: ownerAMemberId
		});
		await expect(
			service.voidInvoice(actorOwnerA, {
				invoicePublicId: firstInvoicePublicId,
				reason: 'Would double-correct'
			})
		).rejects.toThrow('credit note');

		const paymentMethod = await db
			.selectFrom('payment_methods')
			.select('id')
			.where('is_active', '=', 1)
			.orderBy('id', 'asc')
			.executeTakeFirstOrThrow();
		const paymentId = insertedId(
			await db
				.insertInto('payments')
				.values({
					organisation_id: organisationAId,
					public_id: randomUUID(),
					payer_party_id: customerPartyId,
					payment_method_id: paymentMethod.id,
					received_at: new Date('2026-08-17T09:00:00.000Z'),
					amount: '90.0000',
					currency_code: 'GBP',
					payment_reference: 'PAY-CORR-001',
					created_by_member_id: ownerAMemberId
				})
				.executeTakeFirstOrThrow()
		);
		const allocationId = insertedId(
			await db
				.insertInto('payment_allocations')
				.values({
					organisation_id: organisationAId,
					payment_id: paymentId,
					invoice_document_id: thirdInvoiceDocumentId,
					allocated_amount: '90.0000',
					allocated_by_member_id: ownerAMemberId,
					allocated_at: new Date('2026-08-17T09:05:00.000Z')
				})
				.executeTakeFirstOrThrow()
		);
		await expect(
			service.voidInvoice(actorOwnerA, {
				invoicePublicId: thirdInvoicePublicId,
				reason: 'Active allocation blocks void'
			})
		).rejects.toThrow('payment allocation');
		await db
			.insertInto('payment_allocation_reversals')
			.values({
				payment_allocation_id: allocationId,
				organisation_id: organisationAId,
				reversed_by_member_id: ownerAMemberId,
				reversed_at: new Date('2026-08-17T09:10:00.000Z'),
				reason: 'Test reversal before invoice void'
			})
			.executeTakeFirstOrThrow();
		await service.voidInvoice(actorOwnerA, {
			invoicePublicId: thirdInvoicePublicId,
			reason: 'Allocation was reversed before void'
		});
	});

	it('masks foreign-tenant invoice and credit-note identities', async () => {
		const service = new CreditNoteService(db);
		await expect(service.getWorkspace(actorOwnerB, firstCreditNotePublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
		await expect(
			service.createFromInvoice(actorOwnerB, {
				invoicePublicId: firstInvoicePublicId,
				reason: 'Foreign source'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
