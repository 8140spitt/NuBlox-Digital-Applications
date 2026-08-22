import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ProcurementService } from '$lib/server/procurement/procurement-service';
import { AccountsPayableRepository } from './accounts-payable-repository';
import { AccountsPayableService } from './accounts-payable-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Wave A AP Integration ';
const AP_PERMISSIONS = [
	'finance.ap.view',
	'finance.ap.invoice.create',
	'finance.ap.invoice.draft.manage',
	'finance.ap.invoice.submit',
	'finance.ap.match.manage',
	'finance.ap.exception.resolve',
	'finance.ap.approve',
	'finance.ap.invoice.void'
] as const;
const PROCUREMENT_PERMISSIONS = [
	'procurement.view',
	'procurement.package.manage',
	'procurement.po.manage',
	'procurement.po.approve',
	'procurement.po.issue',
	'procurement.receipt.manage'
] as const;

let db: Database;
let organisationAId = '';
let organisationBId = '';
let makerUserId = '';
let approverUserId = '';
let viewerUserId = '';
let otherUserId = '';
let makerMemberId = '';
let approverMemberId = '';
let viewerMemberId = '';
let otherMemberId = '';
let actorMaker: TenantActorContext;
let actorApprover: TenantActorContext;
let actorViewer: TenantActorContext;
let actorOtherTenant: TenantActorContext;
let projectPublicId = '';
let supplierPartyId = '';
let supplierPublicId = '';
let packagePublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${label} ${randomUUID().slice(0, 8)}`,
				default_timezone: 'Europe/London',
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
				joined_at: new Date('2026-08-21T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: readonly string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label} ${randomUUID().slice(0, 6)}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [...permissionKeys])
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

async function createSupplier(): Promise<void> {
	const supplierRole = await db
		.selectFrom('party_role_types')
		.select('id')
		.where('code', '=', 'supplier')
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	supplierPublicId = randomUUID();
	supplierPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: supplierPublicId,
				party_kind: 'organisation',
				account_owner_member_id: makerMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: supplierPartyId,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}Supplier Ltd`,
			trading_name: `${PREFIX}Supplier`
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_email_addresses')
		.values({
			organisation_id: organisationAId,
			party_id: supplierPartyId,
			email: `ap-${randomUUID().slice(0, 8)}@example.test`,
			label: 'Accounts',
			is_primary: 1,
			is_verified: 0,
			verified_at: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_role_assignments')
		.values({
			organisation_id: organisationAId,
			party_id: supplierPartyId,
			party_role_type_id: supplierRole.id,
			is_active: 1
		})
		.executeTakeFirstOrThrow();
}

async function createIssuedPurchaseOrder(input: {
	orderedQuantity?: string;
	receivedQuantity?: string;
	unitRate?: string;
}) {
	const procurement = new ProcurementService(db);
	const workspace = await procurement.getWorkspace(actorMaker);
	const orderType = workspace.purchaseOrderTypes[0];
	const salesItemType = workspace.salesItemTypes[0];
	const unit = workspace.units[0];
	if (!orderType || !salesItemType) throw new Error('Procurement reference data is unavailable.');
	const purchaseOrderPublicId = await procurement.createPurchaseOrder(actorMaker, {
		projectPublicId,
		packagePublicId,
		supplierPublicId,
		purchaseOrderTypeCode: orderType.code,
		title: `${PREFIX}PO ${randomUUID().slice(0, 8)}`,
		supplierReference: `SUP-${randomUUID().slice(0, 8)}`,
		currencyCode: 'GBP',
		orderDate: '2026-08-21',
		requiredByDate: '2026-09-30',
		salesItemTypeId: salesItemType.id,
		unitOfMeasureId: unit?.id ?? null,
		lineDescription: 'Construction materials',
		quantity: input.orderedQuantity ?? '10',
		unitRate: input.unitRate ?? '125.00'
	});
	await procurement.approvePurchaseOrder(actorMaker, purchaseOrderPublicId);
	await procurement.issuePurchaseOrder(actorMaker, purchaseOrderPublicId);
	const repository = new AccountsPayableRepository(db);
	const order = await repository.findIssuedPurchaseOrderByPublicId(
		organisationAId,
		purchaseOrderPublicId
	);
	if (!order) throw new Error('Issued purchase order was not found.');
	const items = await repository.listPurchaseOrderItems(organisationAId, order.versionId);
	const line = items[0];
	if (!line) throw new Error('Issued purchase order has no line.');
	if (input.receivedQuantity && input.receivedQuantity !== '0') {
		await procurement.recordReceipt(actorMaker, {
			purchaseOrderPublicId,
			lineNumber: line.lineNumber,
			receiptType: 'goods',
			quantityReceived: input.receivedQuantity,
			quantityRejected: '0',
			supplierDeliveryReference: `DN-${randomUUID().slice(0, 8)}`
		});
	}
	return { purchaseOrderPublicId, lineNumber: line.lineNumber };
}

function invoiceInput(
	purchaseOrderPublicId: string | null,
	lineNumber: number | null,
	input: { reference?: string; quantity?: string; unitRate?: string } = {}
) {
	return {
		documentType: 'invoice' as const,
		supplierPublicId,
		purchaseOrderPublicId,
		supplierDocumentNumber: input.reference ?? `INV-${randomUUID().slice(0, 8)}`,
		invoiceDate: '2026-08-21',
		dueDate: '2026-09-20',
		currencyCode: 'GBP',
		lines: [
			{
				description: 'Construction materials invoice',
				quantity: input.quantity ?? '1',
				unitRate: input.unitRate ?? '125.00',
				purchaseOrderLineNumber: lineNumber
			}
		]
	};
}

beforeAll(async () => {
	db = getDatabase();
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	makerUserId = await createUser('Maker');
	approverUserId = await createUser('Approver');
	viewerUserId = await createUser('Viewer');
	otherUserId = await createUser('Other tenant');
	makerMemberId = await createMember(organisationAId, makerUserId);
	approverMemberId = await createMember(organisationAId, approverUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	otherMemberId = await createMember(organisationBId, otherUserId);

	await assignRole(organisationAId, makerMemberId, 'Maker', [
		'project.create',
		'project.view',
		'project.manage',
		...PROCUREMENT_PERMISSIONS,
		...AP_PERMISSIONS
	]);
	await assignRole(organisationAId, approverMemberId, 'Approver', [
		'finance.ap.view',
		'finance.ap.approve'
	]);
	await assignRole(organisationAId, viewerMemberId, 'No finance', ['project.view']);
	await assignRole(organisationBId, otherMemberId, 'Other finance manager', ['finance.manage']);

	actorMaker = {
		organisationId: organisationAId,
		userId: makerUserId,
		memberId: makerMemberId,
		correlationId: `ap-maker-${randomUUID()}`
	};
	actorApprover = {
		organisationId: organisationAId,
		userId: approverUserId,
		memberId: approverMemberId,
		correlationId: `ap-approver-${randomUUID()}`
	};
	actorViewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `ap-viewer-${randomUUID()}`
	};
	actorOtherTenant = {
		organisationId: organisationBId,
		userId: otherUserId,
		memberId: otherMemberId,
		correlationId: `ap-other-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actorMaker, {
		projectNumber: `AP-${randomUUID().slice(0, 8).toUpperCase()}`,
		name: `${PREFIX}Project`
	});
	projectPublicId = project.publicId;
	await createSupplier();

	const procurement = new ProcurementService(db);
	const workspace = await procurement.getWorkspace(actorMaker);
	const packageType = workspace.packageTypes[0];
	const salesItemType = workspace.salesItemTypes[0];
	const unit = workspace.units[0];
	if (!packageType || !salesItemType) throw new Error('Procurement reference data is unavailable.');
	packagePublicId = await procurement.createPackage(actorMaker, {
		projectPublicId,
		packageTypeCode: packageType.code,
		title: `${PREFIX}Materials package`,
		description: 'Accounts-payable integration procurement package.',
		currencyCode: 'GBP',
		requiredByDate: '2026-09-30',
		salesItemTypeId: salesItemType.id,
		unitOfMeasureId: unit?.id ?? null,
		lineDescription: 'Construction materials',
		quantity: '100',
		targetUnitCost: '125.00'
	});
});

afterAll(async () => {
	await closeDatabase();
});

describe('Wave A native accounts payable foundation', () => {
	it('matches a supplier invoice to issued PO and accepted receipt facts and enforces maker/checker approval', async () => {
		const po = await createIssuedPurchaseOrder({ receivedQuantity: '4' });
		const service = new AccountsPayableService(db);
		const reference = `INV-HAPPY-${randomUUID().slice(0, 8)}`;
		const documentPublicId = await service.createSupplierDocument(
			actorMaker,
			invoiceInput(po.purchaseOrderPublicId, po.lineNumber, {
				reference,
				quantity: '4',
				unitRate: '125.00'
			})
		);
		await service.submitDocument(actorMaker, documentPublicId);

		const repository = new AccountsPayableRepository(db);
		let document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document).toMatchObject({ status: 'submitted', grossAmount: '500.0000' });
		const items = await repository.listDocumentItems(organisationAId, document!.id);
		const allocations = await repository.listAllocationsForDocumentItem(
			organisationAId,
			items[0]!.id
		);
		expect(allocations).toHaveLength(1);
		expect(allocations[0]?.matchedQuantity).toBe('4.000000');

		await expect(service.approveDocument(actorMaker, documentPublicId)).rejects.toBeInstanceOf(
			TenantAccessError
		);
		await service.approveDocument(actorApprover, documentPublicId, 'Independent invoice approval.');
		document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('approved');
		expect(document?.approvedAt).toBeInstanceOf(Date);
		await expect(service.voidDocument(actorMaker, documentPublicId)).rejects.toBeInstanceOf(
			FinanceValidationError
		);
		await expect(service.submitDocument(actorMaker, documentPublicId)).rejects.toBeInstanceOf(
			FinanceValidationError
		);

		await expect(
			service.createSupplierDocument(
				actorMaker,
				invoiceInput(po.purchaseOrderPublicId, po.lineNumber, {
					reference,
					quantity: '1'
				})
			)
		).rejects.toThrow('already recorded');
	});

	it('raises an under-receipt exception and becomes matchable when new receipt evidence arrives', async () => {
		const po = await createIssuedPurchaseOrder({ receivedQuantity: '1' });
		const service = new AccountsPayableService(db);
		const documentPublicId = await service.createSupplierDocument(
			actorMaker,
			invoiceInput(po.purchaseOrderPublicId, po.lineNumber, { quantity: '2' })
		);
		await service.submitDocument(actorMaker, documentPublicId);
		const repository = new AccountsPayableRepository(db);
		let document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('exception');
		let exceptions = await repository.listExceptions(organisationAId, document!.id);
		expect(exceptions).toContainEqual(
			expect.objectContaining({ code: 'INSUFFICIENT_RECEIPT', status: 'open' })
		);

		await new ProcurementService(db).recordReceipt(actorMaker, {
			purchaseOrderPublicId: po.purchaseOrderPublicId,
			lineNumber: po.lineNumber,
			receiptType: 'goods',
			quantityReceived: '1',
			quantityRejected: '0',
			supplierDeliveryReference: `DN-${randomUUID().slice(0, 8)}`
		});
		await service.retryMatch(actorMaker, documentPublicId);
		document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('submitted');
		exceptions = await repository.listExceptions(organisationAId, document!.id);
		expect(exceptions).toContainEqual(
			expect.objectContaining({ code: 'INSUFFICIENT_RECEIPT', status: 'resolved' })
		);
		await service.approveDocument(actorApprover, documentPublicId);
	});

	it('records a purchase-price variance as an explicit waivable exception without losing receipt lineage', async () => {
		const po = await createIssuedPurchaseOrder({ receivedQuantity: '1', unitRate: '100.00' });
		const service = new AccountsPayableService(db);
		const documentPublicId = await service.createSupplierDocument(
			actorMaker,
			invoiceInput(po.purchaseOrderPublicId, po.lineNumber, { quantity: '1', unitRate: '110.00' })
		);
		await service.submitDocument(actorMaker, documentPublicId);
		const repository = new AccountsPayableRepository(db);
		let document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('exception');
		const item = (await repository.listDocumentItems(organisationAId, document!.id))[0]!;
		expect(await repository.listAllocationsForDocumentItem(organisationAId, item.id)).toHaveLength(
			1
		);
		const exception = (await repository.listExceptions(organisationAId, document!.id)).find(
			(row) => row.code === 'UNIT_RATE_MISMATCH' && row.status === 'open'
		);
		expect(exception).toBeTruthy();
		await service.resolveException(actorMaker, exception!.publicId, {
			note: 'Commercial manager accepts the evidenced supplier price variance.',
			waive: true
		});
		document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('submitted');
		await service.approveDocument(actorApprover, documentPublicId);
	});

	it('treats non-PO invoices as controlled exceptions rather than silently matched documents', async () => {
		const service = new AccountsPayableService(db);
		const documentPublicId = await service.createSupplierDocument(
			actorMaker,
			invoiceInput(null, null, { quantity: '1', unitRate: '75.00' })
		);
		await service.submitDocument(actorMaker, documentPublicId);
		const repository = new AccountsPayableRepository(db);
		let document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('exception');
		const exception = (await repository.listExceptions(organisationAId, document!.id)).find(
			(row) => row.code === 'NON_PO_REQUIRES_APPROVAL'
		);
		expect(exception).toMatchObject({ status: 'open', severity: 'blocking' });
		await service.resolveException(actorMaker, exception!.publicId, {
			note: 'Authorised non-PO site utility invoice.',
			waive: true
		});
		document = await repository.findDocumentByPublicId(organisationAId, documentPublicId);
		expect(document?.status).toBe('submitted');
		await service.approveDocument(actorApprover, documentPublicId);
	});

	it('enforces permission and tenant boundaries before AP facts can be created or viewed', async () => {
		const service = new AccountsPayableService(db);
		await expect(service.getWorkspace(actorViewer)).rejects.toBeInstanceOf(TenantAccessError);
		await expect(
			service.createSupplierDocument(actorViewer, invoiceInput(null, null))
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(
			service.createSupplierDocument(actorOtherTenant, invoiceInput(null, null))
		).rejects.toBeInstanceOf(FinanceValidationError);
		const otherWorkspace = await service.getWorkspace(actorOtherTenant);
		expect(otherWorkspace.documents).toHaveLength(0);
		expect(
			otherWorkspace.suppliers.some((supplier) => supplier.publicId === supplierPublicId)
		).toBe(false);
	});
});
