import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ProcurementService } from '$lib/server/procurement/procurement-service';
import { CommercialValuationRepository } from './commercial-valuation-repository';
import { CommercialValuationService, CommercialValuationValidationError } from './commercial-valuation-service';
import { ProjectCommercialControlService } from './project-commercial-control-service';

let db: Database;
let actor: TenantActorContext;
let organisationId = '';
let memberId = '';
let projectPublicId = '';
let supplierPublicId = '';
let purchaseOrderPublicId = '';
let costCodePublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

beforeAll(async () => {
	db = getDatabase();
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: 'Slice 4 Valuation Owner', status: 'active' })
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: 'Slice 4 Valuation Organisation',
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-20T08:30:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: 'Slice 4 Valuation Owner Role',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissionKeys = [
		'project.create',
		'project.view',
		'project.manage',
		'procurement.view',
		'procurement.po.manage',
		'procurement.po.approve',
		'procurement.po.issue',
		'commercial.cost_control.view',
		'commercial.cost_code.manage',
		'commercial.valuation.manage',
		'commercial.valuation.assess'
	];
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
	actor = { organisationId, userId, memberId, correlationId: `valuation-${randomUUID()}` };

	const project = await new ProjectWorkspaceService(db).createProject(actor, {
		projectNumber: `VAL-${randomUUID().slice(0, 8)}`,
		name: 'Supplier valuation project'
	});
	projectPublicId = project.publicId;

	const supplierRole = await db
		.selectFrom('party_role_types')
		.select('id')
		.where('code', '=', 'supplier')
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	supplierPublicId = randomUUID();
	const supplierPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: supplierPublicId,
				party_kind: 'organisation',
				account_owner_member_id: memberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: supplierPartyId,
			organisation_id: organisationId,
			legal_name: 'Valuation Supplier Ltd',
			trading_name: 'Valuation Supplier'
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

	const procurement = new ProcurementService(db);
	const procurementWorkspace = await procurement.getWorkspace(actor);
	purchaseOrderPublicId = await procurement.createPurchaseOrder(actor, {
		projectPublicId,
		supplierPublicId,
		purchaseOrderTypeCode: procurementWorkspace.purchaseOrderTypes[0]!.code,
		title: 'Valuation test order',
		currencyCode: 'GBP',
		salesItemTypeId: procurementWorkspace.salesItemTypes[0]!.id,
		unitOfMeasureId: null,
		lineDescription: 'Valued works',
		quantity: '10',
		unitRate: '100.00'
	});
	await procurement.approvePurchaseOrder(actor, purchaseOrderPublicId);
	await procurement.issuePurchaseOrder(actor, purchaseOrderPublicId);

	costCodePublicId = await new ProjectCommercialControlService(db).createCostCode(actor, {
		projectPublicId,
		categoryCode: 'subcontract',
		code: `SUB-${randomUUID().slice(0, 6).toUpperCase()}`,
		name: 'Valued subcontract works'
	});
});

afterAll(async () => {
	await closeDatabase();
});

describe('controlled supplier valuations', () => {
	it('caps applications at the issued PO and records submit/assess evidence', async () => {
		const service = new CommercialValuationService(db);
		await expect(
			service.createSupplierApplication(actor, {
				projectPublicId,
				purchaseOrderPublicId,
				costCodePublicId,
				valuationDate: '2026-08-20',
				description: 'Impossible over-application',
				grossValueToDate: '1000.01'
			})
		).rejects.toBeInstanceOf(CommercialValuationValidationError);

		const valuationPublicId = await service.createSupplierApplication(actor, {
			projectPublicId,
			purchaseOrderPublicId,
			costCodePublicId,
			valuationDate: '2026-08-20',
			description: 'Supplier application for works completed to date',
			grossValueToDate: '450.00'
		});
		await service.submit(actor, valuationPublicId);
		await service.assess(actor, valuationPublicId);
		await expect(service.assess(actor, valuationPublicId)).rejects.toBeInstanceOf(
			CommercialValuationValidationError
		);

		const repository = new CommercialValuationRepository(db);
		const valuation = await repository.findByPublicId(organisationId, valuationPublicId);
		expect(valuation).toMatchObject({
			kind: 'supplier_application',
			status: 'assessed',
			purchaseOrderPublicId
		});
		expect(valuation?.submittedAt).toBeInstanceOf(Date);
		expect(valuation?.assessedAt).toBeInstanceOf(Date);
		expect(await repository.listItems(organisationId, valuation!.id)).toEqual([
			expect.objectContaining({ lineNumber: 10, grossValueToDate: '450.0000' })
		]);

		const auditKeys = (
			await db
				.selectFrom('audit_events')
				.select('action_key as actionKey')
				.where('acting_organisation_id', '=', organisationId)
				.where('subject_public_id', '=', valuationPublicId)
				.orderBy('id')
				.execute()
		).map((row) => row.actionKey);
		expect(auditKeys).toEqual([
			'commercial.valuation.created',
			'commercial.valuation.submitted',
			'commercial.valuation.assessed'
		]);
	});
});
