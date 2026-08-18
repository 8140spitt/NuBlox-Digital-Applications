import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { lineAmount, percentageAmount } from '$lib/server/commercial/commercial-decimal';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceValidationError } from './finance-common';
import { PaymentService } from './payment-service';

const PREFIX = 'Payment Allocation Integration ';

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
let salesItemTypeId = 0;
let taxCategoryId = '';
let firstInvoicePublicId = '';
let firstInvoiceDocumentId = '';
let firstInvoiceItemId = '';
let secondInvoicePublicId = '';
let euroInvoicePublicId = '';
let paymentPublicId = '';
let secondaryPaymentPublicId = '';
let firstAllocationId = '';
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
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${name}`,
				default_currency_code: 'GBP',
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
				code: `PAY_${randomUUID().slice(0, 8).toUpperCase()}`,
				name: `${PREFIX}VAT`,
				treatment: 'taxable',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
}

async function createIssuedInvoice(
	documentNumber: string,
	currencyCode: string,
	quantity: string,
	unitRate: string
): Promise<{ publicId: string; documentId: string; itemId: string }> {
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
				currency_code: currencyCode,
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
				description: `${PREFIX}${documentNumber}`,
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
	await db
		.insertInto('financial_document_party_snapshots')
		.values({
			organisation_id: organisationAId,
			financial_document_id: documentId,
			source_party_id: customerPartyId,
			snapshot_role: 'customer',
			display_name: `${PREFIX}Client Ltd`,
			email: 'payments@example.test',
			phone: null,
			reference_identifier: 'PAY-CUST-001',
			sort_order: 1
		})
		.executeTakeFirstOrThrow();
	return { publicId, documentId, itemId };
}

async function createIssuedCredit(
	invoiceDocumentId: string,
	invoiceItemId: string,
	quantity: string,
	unitRate: string
): Promise<void> {
	const creditDocumentId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				document_kind: 'credit_note',
				document_number: 'CN-PAY-001',
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
		.insertInto('credit_notes')
		.values({
			financial_document_id: creditDocumentId,
			organisation_id: organisationAId,
			original_invoice_document_id: invoiceDocumentId,
			reason: 'Payment allocation fixture credit'
		})
		.executeTakeFirstOrThrow();
	const creditItemId = insertedId(
		await db
			.insertInto('financial_document_items')
			.values({
				organisation_id: organisationAId,
				financial_document_id: creditDocumentId,
				source_quotation_item_id: null,
				sales_item_type_id: salesItemTypeId,
				sales_catalog_item_id: null,
				unit_of_measure_id: null,
				line_number: 1,
				description: `${PREFIX}Credit`,
				quantity,
				unit_rate: unitRate
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('credit_note_item_sources')
		.values({
			organisation_id: organisationAId,
			credit_note_document_id: creditDocumentId,
			credit_note_item_id: creditItemId,
			original_invoice_document_id: invoiceDocumentId,
			original_invoice_item_id: invoiceItemId
		})
		.executeTakeFirstOrThrow();
	const net = lineAmount(quantity, unitRate);
	await db
		.insertInto('financial_document_item_taxes')
		.values({
			organisation_id: organisationAId,
			financial_document_item_id: creditItemId,
			tax_category_id: taxCategoryId,
			sort_order: 1,
			applied_rate_percent: '20.0000',
			taxable_amount: net,
			tax_amount: percentageAmount(net, '20.0000')
		})
		.executeTakeFirstOrThrow();
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
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', [
		'finance.view',
		'finance.manage',
		'crm.view'
	]);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', [
		'finance.view',
		'crm.view',
		'finance.payment.create',
		'finance.payment.allocate',
		'finance.payment.allocation.reverse',
		'finance.payment.reverse'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', [
		'finance.view',
		'finance.manage',
		'crm.view'
	]);
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
	const first = await createIssuedInvoice('INV-PAY-001', 'GBP', '2.000000', '100.0000');
	const second = await createIssuedInvoice('INV-PAY-002', 'GBP', '1.000000', '150.0000');
	const euro = await createIssuedInvoice('INV-PAY-EUR', 'EUR', '1.000000', '100.0000');
	firstInvoicePublicId = first.publicId;
	firstInvoiceDocumentId = first.documentId;
	firstInvoiceItemId = first.itemId;
	secondInvoicePublicId = second.publicId;
	euroInvoicePublicId = euro.publicId;
	await createIssuedCredit(first.documentId, first.itemId, '0.500000', '100.0000');
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004E payment receipt and controlled allocation', () => {
	it('records an immutable same-tenant payment receipt with an optional CRM payer', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T10:35:00.000Z'));
		const created = await service.recordPayment(actorFinanceA, {
			payerPartyPublicId: customerPartyPublicId,
			paymentMethodCode: 'bank_transfer',
			receivedOn: '2026-08-17',
			amount: '300',
			currencyCode: 'gbp',
			paymentReference: 'BANK-PAY-001'
		});
		paymentPublicId = created.publicId;
		const workspace = await service.getWorkspace(actorFinanceA, paymentPublicId);
		expect(workspace.payment).toMatchObject({
			publicId: paymentPublicId,
			payerPartyPublicId: customerPartyPublicId,
			payerDisplayName: `${PREFIX}Client Ltd`,
			paymentMethodCode: 'bank_transfer',
			amount: '300.0000',
			currencyCode: 'GBP',
			paymentReference: 'BANK-PAY-001',
			allocatedAmount: '0.0000',
			unallocatedAmount: '300.0000',
			isReversed: false
		});
		expect(
			workspace.invoiceCandidates.find(
				(candidate) => candidate.invoicePublicId === firstInvoicePublicId
			)
		).toMatchObject({
			invoiceGross: '240.0000',
			issuedCreditGross: '60.0000',
			activeAllocatedAmount: '0.0000',
			outstandingAmount: '180.0000',
			payerMatches: true
		});
	});

	it('allocates only within both usable-payment and invoice-outstanding boundaries', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T10:40:00.000Z'));
		await service.allocate(actorFinanceA, {
			paymentPublicId,
			invoicePublicId: firstInvoicePublicId,
			amount: '100'
		});
		let workspace = await service.getWorkspace(actorFinanceA, paymentPublicId);
		firstAllocationId = workspace.allocations[0]!.id;
		expect(workspace.payment).toMatchObject({
			allocatedAmount: '100.0000',
			unallocatedAmount: '200.0000'
		});
		expect(
			workspace.invoiceCandidates.find(
				(candidate) => candidate.invoicePublicId === firstInvoicePublicId
			)?.outstandingAmount
		).toBe('80.0000');
		await expect(
			service.allocate(actorFinanceA, {
				paymentPublicId,
				invoicePublicId: firstInvoicePublicId,
				amount: '90'
			})
		).rejects.toThrow('invoice outstanding balance');
		await service.allocate(actorFinanceA, {
			paymentPublicId,
			invoicePublicId: secondInvoicePublicId,
			amount: '180'
		});
		workspace = await service.getWorkspace(actorFinanceA, paymentPublicId);
		expect(workspace.payment).toMatchObject({
			allocatedAmount: '280.0000',
			unallocatedAmount: '20.0000'
		});
		await expect(
			service.allocate(actorFinanceA, {
				paymentPublicId,
				invoicePublicId: firstInvoicePublicId,
				amount: '30'
			})
		).rejects.toThrow('remaining 20.0000 available on the payment');
	});

	it('lets an explicit granular deny override the finance.manage umbrella', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T10:45:00.000Z'));
		const created = await service.recordPayment(actorOwnerA, {
			payerPartyPublicId: customerPartyPublicId,
			paymentMethodCode: 'bank_transfer',
			receivedOn: '2026-08-17',
			amount: '50',
			currencyCode: 'GBP',
			paymentReference: 'BANK-PAY-002'
		});
		secondaryPaymentPublicId = created.publicId;
		const allocationPermission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.payment.allocate')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: ownerAMemberId,
				permission_id: allocationPermission.id,
				effect: 'deny'
			})
			.executeTakeFirstOrThrow();
		await expect(
			service.allocate(actorOwnerA, {
				paymentPublicId: secondaryPaymentPublicId,
				invoicePublicId: firstInvoicePublicId,
				amount: '20'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', allocationPermission.id)
			.execute();
		await service.allocate(actorOwnerA, {
			paymentPublicId: secondaryPaymentPublicId,
			invoicePublicId: firstInvoicePublicId,
			amount: '20'
		});
		const workspace = await service.getWorkspace(actorOwnerA, secondaryPaymentPublicId);
		expect(workspace.payment).toMatchObject({
			allocatedAmount: '20.0000',
			unallocatedAmount: '30.0000'
		});
	});

	it('blocks FX allocation and masks foreign-tenant payment identities', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T10:50:00.000Z'));
		await expect(
			service.allocate(actorFinanceA, {
				paymentPublicId: secondaryPaymentPublicId,
				invoicePublicId: euroInvoicePublicId,
				amount: '10'
			})
		).rejects.toThrow('currency must match');
		await expect(service.getWorkspace(actorOwnerB, paymentPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
		await expect(
			service.allocate(actorOwnerB, {
				paymentPublicId,
				invoicePublicId: firstInvoicePublicId,
				amount: '10'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('reverses one allocation immutably and restores both usable payment and invoice outstanding', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T10:55:00.000Z'));
		await service.reverseAllocation(actorFinanceA, {
			paymentPublicId,
			allocationId: firstAllocationId,
			reason: 'Allocated to the wrong invoice'
		});
		const workspace = await service.getWorkspace(actorFinanceA, paymentPublicId);
		expect(workspace.payment).toMatchObject({
			allocatedAmount: '180.0000',
			unallocatedAmount: '120.0000'
		});
		expect(
			workspace.allocations.find((allocation) => allocation.id === firstAllocationId)
		).toMatchObject({
			isReversed: true,
			reversalReason: 'Allocated to the wrong invoice'
		});
		expect(
			workspace.invoiceCandidates.find(
				(candidate) => candidate.invoicePublicId === firstInvoicePublicId
			)?.outstandingAmount
		).toBe('160.0000');
		await expect(
			service.reverseAllocation(actorFinanceA, {
				paymentPublicId,
				allocationId: firstAllocationId,
				reason: 'Duplicate reversal'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('reverses a payment only after atomically reversing every still-active allocation', async () => {
		const service = new PaymentService(db, randomUUID, () => new Date('2026-08-17T11:00:00.000Z'));
		await service.reversePayment(actorFinanceA, {
			paymentPublicId,
			reason: 'Bank returned the customer funds'
		});
		const workspace = await service.getWorkspace(actorFinanceA, paymentPublicId);
		expect(workspace.payment).toMatchObject({
			isReversed: true,
			allocatedAmount: '0.0000',
			unallocatedAmount: '0.0000',
			reversalReason: 'Bank returned the customer funds'
		});
		expect(workspace.allocations.every((allocation) => allocation.isReversed)).toBe(true);
		const payment = await db
			.selectFrom('payments')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', paymentPublicId)
			.executeTakeFirstOrThrow();
		const activeAllocations = await db
			.selectFrom('payment_allocations as allocation')
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join
					.onRef('reversal.payment_allocation_id', '=', 'allocation.id')
					.onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
			)
			.select('allocation.id')
			.where('allocation.organisation_id', '=', organisationAId)
			.where('allocation.payment_id', '=', payment.id)
			.where('reversal.payment_allocation_id', 'is', null)
			.execute();
		expect(activeAllocations).toHaveLength(0);
		await expect(
			service.allocate(actorFinanceA, {
				paymentPublicId,
				invoicePublicId: firstInvoicePublicId,
				amount: '10'
			})
		).rejects.toThrow('reversed payment');
		await expect(
			service.reversePayment(actorFinanceA, {
				paymentPublicId,
				reason: 'Duplicate payment reversal'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});
});
