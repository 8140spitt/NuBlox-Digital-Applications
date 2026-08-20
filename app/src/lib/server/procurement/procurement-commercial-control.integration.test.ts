import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	ProjectCommercialControlService,
	ProjectCommercialControlValidationError
} from '$lib/server/commercial/project-commercial-control-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ensureProcurementCommercialStandardRoleDefaults } from './procurement-commercial-bootstrap';
import { ProcurementRepository } from './procurement-repository';
import { ProcurementService, ProcurementValidationError } from './procurement-service';

const PREFIX = 'Slice 4 Integration ';
const PROJECT_PREFIX = 'S4-';

const ALL_SLICE4_PERMISSIONS = [
	'procurement.view',
	'procurement.package.manage',
	'procurement.rfq.manage',
	'procurement.rfq.issue',
	'procurement.po.manage',
	'procurement.po.approve',
	'procurement.po.issue',
	'procurement.receipt.manage',
	'commercial.cost_control.view',
	'commercial.cost_code.manage',
	'commercial.budget.manage',
	'commercial.budget.approve',
	'commercial.variation.manage',
	'commercial.variation.issue',
	'commercial.variation.decide'
] as const;

let db: Database;
let organisationId = '';
let ownerUserId = '';
let procurementViewerUserId = '';
let outsiderUserId = '';
let ownerMemberId = '';
let procurementViewerMemberId = '';
let outsiderMemberId = '';
let actorOwner: TenantActorContext;
let actorProcurementViewer: TenantActorContext;
let actorOutsider: TenantActorContext;
let projectId = '';
let projectPublicId = '';
let supplierPartyId = '';
let supplierPublicId = '';
let packagePublicId = '';
let rfqPublicId = '';
let purchaseOrderPublicId = '';
let costCodePublicId = '';
let budgetPublicId = '';
let acceptedVariationPublicId = '';
let pendingVariationPublicId = '';

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

async function createMember(userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-20T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	memberId: string,
	name: string,
	permissionKeys: readonly string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisationId, public_id: randomUUID(), name, is_active: 1 })
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

async function createSupplierParty(): Promise<void> {
	const supplierRole = await db
		.selectFrom('party_role_types')
		.select(['id', 'code'])
		.where('code', '=', 'supplier')
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	supplierPublicId = randomUUID();
	supplierPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: supplierPublicId,
				party_kind: 'organisation',
				account_owner_member_id: ownerMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: supplierPartyId,
			organisation_id: organisationId,
			legal_name: `${PREFIX}Supplier Ltd`,
			trading_name: `${PREFIX}Supplier`
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_email_addresses')
		.values({
			organisation_id: organisationId,
			party_id: supplierPartyId,
			email: `slice4-${randomUUID().slice(0, 8)}@example.test`,
			label: 'Commercial',
			is_primary: 1,
			is_verified: 0,
			verified_at: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_role_assignments')
		.values({
			organisation_id: organisationId,
			party_id: supplierPartyId,
			party_role_type_id: supplierRole.id,
			is_active: 1
		})
		.executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	ownerUserId = await createUser('Owner');
	procurementViewerUserId = await createUser('Procurement viewer');
	outsiderUserId = await createUser('Outsider');
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	ownerMemberId = await createMember(ownerUserId);
	procurementViewerMemberId = await createMember(procurementViewerUserId);
	outsiderMemberId = await createMember(outsiderUserId);

	await assignPermissionRole(ownerMemberId, `${PREFIX}Owner role`, [
		'project.create',
		'project.view',
		'project.manage',
		...ALL_SLICE4_PERMISSIONS
	]);
	await assignPermissionRole(procurementViewerMemberId, `${PREFIX}Procurement viewer role`, [
		'project.view',
		'procurement.view'
	]);
	await assignPermissionRole(outsiderMemberId, `${PREFIX}Outsider role`, [
		'project.view',
		...ALL_SLICE4_PERMISSIONS
	]);

	actorOwner = {
		organisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `slice4-owner-${randomUUID()}`
	};
	actorProcurementViewer = {
		organisationId,
		userId: procurementViewerUserId,
		memberId: procurementViewerMemberId,
		correlationId: `slice4-viewer-${randomUUID()}`
	};
	actorOutsider = {
		organisationId,
		userId: outsiderUserId,
		memberId: outsiderMemberId,
		correlationId: `slice4-outsider-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actorOwner, {
		projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
		name: 'Procurement and commercial-control project'
	});
	projectId = project.id;
	projectPublicId = project.publicId;
	await new ProjectRepository(db).insertProjectMember(
		project.id,
		organisationId,
		procurementViewerMemberId,
		new Date('2026-08-20T08:15:00.000Z')
	);
	await createSupplierParty();
});

afterAll(async () => {
	await closeDatabase();
});

describe('V1 procurement and project commercial-control activation', () => {
	it('keeps standard procurement visibility broader than confidential commercial visibility', async () => {
		const readOnlyRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Read Only',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		const financeRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Finance/Commercial',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		await ensureProcurementCommercialStandardRoleDefaults(db, organisationId);

		const grantsFor = async (roleId: string) =>
			(
				await db
					.selectFrom('role_permissions as grant')
					.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
					.select('permission.permission_key as permissionKey')
					.where('grant.organisation_id', '=', organisationId)
					.where('grant.organisation_role_id', '=', roleId)
					.where('permission.permission_key', 'in', [...ALL_SLICE4_PERMISSIONS])
					.orderBy('permission.permission_key')
					.execute()
			).map((row) => row.permissionKey);

		expect(await grantsFor(readOnlyRoleId)).toEqual(['procurement.view']);
		expect(await grantsFor(financeRoleId)).toEqual([...ALL_SLICE4_PERMISSIONS].sort());
	});

	it('reuses the CRM supplier party and controls package and RFQ issue evidence', async () => {
		const service = new ProcurementService(db);
		const workspace = await service.getWorkspace(actorOwner);
		const packageType = workspace.packageTypes[0];
		const salesItemType = workspace.salesItemTypes[0];
		const unit = workspace.units[0];
		expect(packageType).toBeTruthy();
		expect(salesItemType).toBeTruthy();
		expect(workspace.suppliers).toContainEqual(
			expect.objectContaining({ id: supplierPartyId, publicId: supplierPublicId })
		);

		packagePublicId = await service.createPackage(actorOwner, {
			projectPublicId,
			packageTypeCode: packageType!.code,
			title: 'Containment materials package',
			description: 'Controlled enquiry package for containment materials.',
			currencyCode: 'GBP',
			requiredByDate: '2026-10-15',
			salesItemTypeId: salesItemType!.id,
			unitOfMeasureId: unit?.id ?? null,
			lineDescription: 'Galvanised containment installation package',
			quantity: '10',
			targetUnitCost: '120.00'
		});
		rfqPublicId = await service.createRfq(actorOwner, {
			packagePublicId,
			title: 'Containment supply enquiry',
			responseDeadlineAt: '2026-09-01T12:00'
		});
		await service.issueRfq(actorOwner, rfqPublicId, supplierPublicId);

		const repository = new ProcurementRepository(db);
		const rfq = await repository.findRfqByPublicId(organisationId, rfqPublicId);
		const version = (await repository.listRfqVersions(organisationId, rfq!.id))[0];
		expect(version).toMatchObject({ versionNumber: 1, status: 'issued' });
		expect(version?.lockedAt).toBeInstanceOf(Date);
		const invitation = await db
			.selectFrom('rfq_invitations')
			.select(['supplier_party_id as supplierPartyId', 'rfq_version_id as versionId'])
			.where('organisation_id', '=', organisationId)
			.where('rfq_version_id', '=', version!.id)
			.executeTakeFirstOrThrow();
		expect(invitation).toEqual({ supplierPartyId, versionId: version!.id });
		await expect(
			service.issueRfq(actorOwner, rfqPublicId, supplierPublicId)
		).rejects.toBeInstanceOf(ProcurementValidationError);
	});

	it('enforces effective project membership independently from organisation permission grants', async () => {
		const procurement = new ProcurementService(db);
		const outsiderWorkspace = await procurement.getWorkspace(actorOutsider);
		expect(outsiderWorkspace.canView).toBe(true);
		expect(outsiderWorkspace.projects).toHaveLength(0);
		expect(outsiderWorkspace.packages).toHaveLength(0);
		await expect(
			procurement.createPackage(actorOutsider, {
				projectPublicId,
				packageTypeCode: 'materials',
				title: 'Out-of-scope package',
				currencyCode: 'GBP',
				salesItemTypeId: 1,
				lineDescription: 'Out-of-scope requirement',
				quantity: '1'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('controls purchase-order approval, immutable issue evidence and receipt quantities', async () => {
		const service = new ProcurementService(db);
		const workspace = await service.getWorkspace(actorOwner);
		const orderType = workspace.purchaseOrderTypes[0];
		const salesItemType = workspace.salesItemTypes[0];
		const unit = workspace.units[0];
		expect(orderType).toBeTruthy();
		expect(salesItemType).toBeTruthy();

		purchaseOrderPublicId = await service.createPurchaseOrder(actorOwner, {
			projectPublicId,
			packagePublicId,
			supplierPublicId,
			purchaseOrderTypeCode: orderType!.code,
			title: 'Containment materials purchase order',
			supplierReference: 'SUP-Q-001',
			currencyCode: 'GBP',
			orderDate: '2026-08-20',
			requiredByDate: '2026-10-15',
			salesItemTypeId: salesItemType!.id,
			unitOfMeasureId: unit?.id ?? null,
			lineDescription: 'Galvanised containment installation package',
			quantity: '10',
			unitRate: '125.00'
		});
		await service.approvePurchaseOrder(actorOwner, purchaseOrderPublicId);
		await service.issuePurchaseOrder(actorOwner, purchaseOrderPublicId);

		const repository = new ProcurementRepository(db);
		const order = await repository.findPurchaseOrderByPublicId(
			organisationId,
			purchaseOrderPublicId
		);
		const version = (await repository.listPurchaseOrderVersions(organisationId, order!.id))[0];
		expect(version).toMatchObject({ versionNumber: 1, status: 'issued' });
		expect(version?.approvedAt).toBeInstanceOf(Date);
		expect(version?.lockedAt).toBeInstanceOf(Date);
		const supplierSnapshot = await db
			.selectFrom('purchase_order_party_snapshots')
			.select(['source_party_id as sourcePartyId', 'display_name as displayName'])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_version_id', '=', version!.id)
			.where('snapshot_role', '=', 'supplier')
			.executeTakeFirstOrThrow();
		expect(supplierSnapshot).toMatchObject({ sourcePartyId: supplierPartyId });
		const issueEvent = await db
			.selectFrom('purchase_order_issue_events')
			.select('issue_sequence as issueSequence')
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_version_id', '=', version!.id)
			.executeTakeFirstOrThrow();
		expect(issueEvent.issueSequence).toBe(1);

		await expect(
			service.approvePurchaseOrder(actorOwner, purchaseOrderPublicId)
		).rejects.toBeInstanceOf(ProcurementValidationError);
		await expect(
			service.issuePurchaseOrder(actorOwner, purchaseOrderPublicId)
		).rejects.toBeInstanceOf(ProcurementValidationError);

		await service.recordReceipt(actorOwner, {
			purchaseOrderPublicId,
			lineNumber: 10,
			receiptType: 'goods',
			quantityReceived: '4',
			quantityRejected: '0',
			supplierDeliveryReference: 'DN-001'
		});
		await expect(
			service.recordReceipt(actorOwner, {
				purchaseOrderPublicId,
				lineNumber: 10,
				receiptType: 'goods',
				quantityReceived: '7'
			})
		).rejects.toBeInstanceOf(ProcurementValidationError);
	});

	it('keeps commercial data hidden from ordinary project procurement viewers', async () => {
		const procurement = await new ProcurementService(db).getWorkspace(actorProcurementViewer);
		expect(procurement.canView).toBe(true);
		expect(procurement.packages.some((row) => row.publicId === packagePublicId)).toBe(true);

		const commercial = new ProjectCommercialControlService(db);
		const workspace = await commercial.getWorkspace(actorProcurementViewer, projectPublicId);
		expect(workspace.canView).toBe(false);
		expect(workspace.position).toBeNull();
		expect(workspace.costCodes).toHaveLength(0);
		await expect(
			commercial.createCostCode(actorProcurementViewer, {
				projectPublicId,
				categoryCode: 'material',
				code: 'MAT-001',
				name: 'Materials'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('derives the project commercial position from controlled source facts without duplicate balances', async () => {
		const service = new ProjectCommercialControlService(db);
		costCodePublicId = await service.createCostCode(actorOwner, {
			projectPublicId,
			categoryCode: 'material',
			code: `MAT-${randomUUID().slice(0, 6).toUpperCase()}`,
			name: 'Containment materials',
			description: 'Cost classification for containment procurement.'
		});
		budgetPublicId = await service.createBudget(actorOwner, {
			projectPublicId,
			costCodePublicId,
			name: 'Approved project cost baseline',
			currencyCode: 'GBP',
			effectiveOn: '2026-08-20',
			description: 'Initial materials baseline',
			budgetAmount: '5000.00'
		});
		await service.approveBudget(actorOwner, budgetPublicId);
		await service.allocatePurchaseOrderLine(
			actorOwner,
			purchaseOrderPublicId,
			10,
			costCodePublicId
		);

		acceptedVariationPublicId = await service.createVariation(actorOwner, {
			projectPublicId,
			costCodePublicId,
			purchaseOrderPublicId,
			variationTypeCode: 'supplier_change',
			commercialSide: 'cost',
			title: 'Additional containment supports',
			currencyCode: 'GBP',
			description: 'Additional support steel required by coordinated design.',
			quantity: '2',
			unitRate: '125.00'
		});
		await service.issueVariation(actorOwner, acceptedVariationPublicId);
		await service.decideVariation(actorOwner, acceptedVariationPublicId, 'accepted');

		pendingVariationPublicId = await service.createVariation(actorOwner, {
			projectPublicId,
			costCodePublicId,
			purchaseOrderPublicId,
			variationTypeCode: 'supplier_change',
			commercialSide: 'cost',
			title: 'Pending riser adjustment',
			currencyCode: 'GBP',
			description: 'Potential additional riser adjustment under review.',
			quantity: '1',
			unitRate: '100.00'
		});
		await service.issueVariation(actorOwner, pendingVariationPublicId);

		const workspace = await service.getWorkspace(actorOwner, projectPublicId);
		expect(workspace.position).toEqual({
			projectPublicId,
			currencyCode: 'GBP',
			approvedBaselineBudget: '5000.0000',
			issuedPurchaseOrderCommitment: '1250.0000',
			classifiedCommitment: '1250.0000',
			acceptedReceiptCost: '500.0000',
			approvedChange: '250.0000',
			pendingChangeExposure: '100.0000',
			budgetHeadroom: '3750.0000',
			exposedHeadroom: '3650.0000'
		});

		await expect(service.approveBudget(actorOwner, budgetPublicId)).rejects.toBeInstanceOf(
			ProjectCommercialControlValidationError
		);
		await expect(
			service.issueVariation(actorOwner, acceptedVariationPublicId)
		).rejects.toBeInstanceOf(ProjectCommercialControlValidationError);

		const auditKeys = (
			await db
				.selectFrom('audit_events')
				.select('action_key as actionKey')
				.where('acting_organisation_id', '=', organisationId)
				.where('project_id', '=', projectId)
				.where('action_key', 'in', [
					'procurement.rfq.issued',
					'procurement.purchase_order.issued',
					'procurement.receipt.recorded',
					'commercial.budget.approved',
					'commercial.commitment.classified',
					'commercial.variation.issued',
					'commercial.variation.decision_recorded'
				])
				.execute()
		).map((row) => row.actionKey);
		expect(new Set(auditKeys)).toEqual(
			new Set([
				'procurement.rfq.issued',
				'procurement.purchase_order.issued',
				'procurement.receipt.recorded',
				'commercial.budget.approved',
				'commercial.commitment.classified',
				'commercial.variation.issued',
				'commercial.variation.decision_recorded'
			])
		);
	});
});
