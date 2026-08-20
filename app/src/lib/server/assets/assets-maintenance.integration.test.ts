import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { InformationService } from '$lib/server/information/information-service';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import {
	ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS,
	ensureAssetsMaintenanceStandardRoleDefaults
} from './assets-maintenance-bootstrap';
import {
	AssetsMaintenanceService,
	AssetsMaintenanceValidationError
} from './assets-maintenance-service';

const PREFIX = 'Slice 6 Integration ';
const OWNER_PERMISSIONS = [
	...ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS.Owner,
	'project.create',
	'project.view',
	'project.manage',
	'information.view',
	'information.manage',
	'information.issue'
] as const;

let db: Database;
let organisationId = '';
let ownerUserId = '';
let ownerMemberId = '';
let viewerUserId = '';
let viewerMemberId = '';
let actorOwner: TenantActorContext;
let actorViewer: TenantActorContext;
let facilityPublicId = '';
let buildingPublicId = '';
let levelPublicId = '';
let spacePublicId = '';
let assetPublicId = '';
let projectPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function createUser(label: string): Promise<string> {
	return insertedId(await db.insertInto('users').values({
		public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active'
	}).executeTakeFirstOrThrow());
}

async function createMember(userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({
		organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: new Date('2026-08-20T13:00:00.000Z')
	}).executeTakeFirstOrThrow());
}

async function assignPermissionRole(memberId: string, name: string, permissionKeys: readonly string[]) {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id','permission_key']).where('permission_key','in',[...permissionKeys]).where('is_active','=',1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	organisationId = insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, default_timezone: 'Europe/London', default_currency_code: 'GBP', status: 'active' }).executeTakeFirstOrThrow());
	ownerMemberId = await createMember(ownerUserId);
	viewerMemberId = await createMember(viewerUserId);
	await assignPermissionRole(ownerMemberId, `${PREFIX}Owner role`, OWNER_PERMISSIONS);
	await assignPermissionRole(viewerMemberId, `${PREFIX}Viewer role`, ['assets.view','facilities.view','maintenance.view','compliance.view']);
	actorOwner = { organisationId, userId: ownerUserId, memberId: ownerMemberId, correlationId: `slice6-owner-${randomUUID()}` };
	actorViewer = { organisationId, userId: viewerUserId, memberId: viewerMemberId, correlationId: `slice6-viewer-${randomUUID()}` };
});

afterAll(async () => { await closeDatabase(); });

describe('V1 assets, facilities and maintenance activation', () => {
	it('keeps read-only defaults separate from field completion and administration permissions', async () => {
		const readOnlyRoleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: 'Read Only', is_active: 1 }).executeTakeFirstOrThrow());
		const fieldRoleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: 'Field Worker', is_active: 1 }).executeTakeFirstOrThrow());
		await ensureAssetsMaintenanceStandardRoleDefaults(db, organisationId);
		const grantsFor = async (roleId: string) => (await db.selectFrom('role_permissions as grant').innerJoin('permissions as permission','permission.id','grant.permission_id').select('permission.permission_key as permissionKey').where('grant.organisation_id','=',organisationId).where('grant.organisation_role_id','=',roleId).where('permission.permission_key','in',[...ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS.Owner]).orderBy('permission.permission_key').execute()).map((row) => row.permissionKey);
		expect(await grantsFor(readOnlyRoleId)).toEqual(['assets.view','compliance.view','facilities.view','maintenance.view']);
		expect(await grantsFor(fieldRoleId)).toEqual([...ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS['Field Worker']].sort());
	});

	it('registers tenant-owned facility hierarchy and prevents cross-facility asset placement', async () => {
		const service = new AssetsMaintenanceService(db);
		facilityPublicId = await service.createFacility(actorOwner, { facilityCode: `FAC-${randomUUID().slice(0,6)}`, name: 'Operations campus', timezone: 'Europe/London', commissionedOn: '2026-01-01', openedOn: '2026-01-15' });
		buildingPublicId = await service.createBuilding(actorOwner, { facilityPublicId, buildingCode: 'BLDG-A', name: 'Main building' });
		levelPublicId = await service.createLevel(actorOwner, { buildingPublicId, levelCode: 'L01', name: 'Level 01', sortOrder: '1' });
		spacePublicId = await service.createSpace(actorOwner, { buildingPublicId, levelPublicId, spaceCode: 'PLANT-01', name: 'Electrical plant room', spaceType: 'plant' });
		const assetTypePublicId = await service.createAssetType(actorOwner, { categoryCode: 'electrical', code: `DB-${randomUUID().slice(0,5)}`, name: 'Distribution board' });
		assetPublicId = await service.createAsset(actorOwner, { facilityPublicId, assetTypePublicId, buildingPublicId, levelPublicId, spacePublicId, assetTag: `DB-${randomUUID().slice(0,6)}`, name: 'Main LV distribution board', criticality: 'high' });
		const secondFacility = await service.createFacility(actorOwner, { facilityCode: `FAC-${randomUUID().slice(0,6)}`, name: 'Remote site' });
		await expect(service.createAsset(actorOwner, { facilityPublicId: secondFacility, assetTypePublicId, buildingPublicId, assetTag: `BAD-${randomUUID().slice(0,6)}`, name: 'Cross-facility asset', criticality: 'medium' })).rejects.toBeInstanceOf(AssetsMaintenanceValidationError);
		const asset = await db.selectFrom('assets').select(['organisation_id','lifecycle_status','facility_space_id']).where('public_id','=',assetPublicId).executeTakeFirstOrThrow();
		expect(asset.organisation_id).toBe(organisationId);
		expect(asset.lifecycle_status).toBe('active');
		expect(asset.facility_space_id).toBeTruthy();
	});

	it('records attributable asset lifecycle, reactive work completion and service history', async () => {
		const service = new AssetsMaintenanceService(db);
		await service.transitionAsset(actorOwner, assetPublicId, 'isolated', 'Safe isolation for inspection.');
		await service.transitionAsset(actorOwner, assetPublicId, 'active', 'Inspection complete and supply restored.');
		const requestPublicId = await service.createMaintenanceRequest(actorOwner, { facilityPublicId, assetPublicId, priorityCode: 'urgent', requestType: 'fault', title: 'Intermittent breaker trip', description: 'Investigate intermittent outgoing breaker trip.' });
		const workOrderPublicId = await service.createReactiveWorkOrder(actorOwner, requestPublicId, assetPublicId);
		await service.completeWorkOrder(actorOwner, workOrderPublicId, 'Breaker tested, termination remade and circuit restored.');
		const serviceEventPublicId = await service.recordServiceEvent(actorOwner, { assetPublicId, workOrderPublicId, serviceTypeCode: 'reactive_repair', performedAt: '2026-08-20T13:30', resultCode: 'completed', conditionRating: 'good', notes: 'Thermal check and functional test passed.', recommendedNextServiceOn: '2027-08-20' });
		const workOrder = await db.selectFrom('work_orders').select(['work_order_status','completed_by_member_id']).where('public_id','=',workOrderPublicId).executeTakeFirstOrThrow();
		expect(workOrder).toEqual({ work_order_status: 'completed', completed_by_member_id: ownerMemberId });
		const lifecycle = await db.selectFrom('asset_lifecycle_events').select(['event_type','acted_by_member_id']).where('organisation_id','=',organisationId).where('asset_id','=',(await db.selectFrom('assets').select('id').where('public_id','=',assetPublicId).executeTakeFirstOrThrow()).id).execute();
		expect(lifecycle.map((row) => row.event_type)).toEqual(expect.arrayContaining(['in_service','isolated','returned_to_service']));
		expect(lifecycle.every((row) => row.acted_by_member_id === ownerMemberId)).toBe(true);
		expect(await db.selectFrom('asset_service_events').select('public_id').where('public_id','=',serviceEventPublicId).executeTakeFirst()).toBeTruthy();
	});

	it('generates planned work from an exact source task and blocks duplicate active generation', async () => {
		const service = new AssetsMaintenanceService(db);
		const planPublicId = await service.createMaintenancePlan(actorOwner, { facilityPublicId, assetPublicId, planTypeCode: 'ppm', name: 'Annual LV inspection', taskTitle: 'Inspect and torque LV terminations', instructions: 'Isolate, inspect, torque and record condition.', intervalValue: '12', intervalUnit: 'month', startsOn: '2026-09-01' });
		const workspace = await service.getWorkspace(actorOwner);
		const plan = workspace.plans.find((row) => row.publicId === planPublicId)!;
		const task = workspace.planTasks.find((row) => row.maintenancePlanId === plan.id)!;
		const workOrderPublicId = await service.generatePlannedWorkOrder(actorOwner, task.id, assetPublicId);
		await expect(service.generatePlannedWorkOrder(actorOwner, task.id, assetPublicId)).rejects.toBeInstanceOf(AssetsMaintenanceValidationError);
		const workOrder = await db.selectFrom('work_orders').select(['source_maintenance_plan_task_id','work_order_status']).where('public_id','=',workOrderPublicId).executeTakeFirstOrThrow();
		expect(workOrder).toMatchObject({ source_maintenance_plan_task_id: task.id, work_order_status: 'open' });
		await service.completeWorkOrder(actorOwner, workOrderPublicId, 'Annual inspection completed.');
	});

	it('binds compliance outcomes to the exact published requirement version', async () => {
		const service = new AssetsMaintenanceService(db);
		const requirementPublicId = await service.createComplianceRequirement(actorOwner, { categoryCode: 'electrical', requirementCode: `ELEC-${randomUUID().slice(0,6)}`, name: 'Periodic LV inspection', requirementText: 'Inspect the LV distribution board and record condition.', intervalValue: '12', intervalUnit: 'month' });
		const assignmentId = await service.assignComplianceToAsset(actorOwner, assetPublicId, requirementPublicId, '2026-08-20');
		const eventPublicId = await service.recordComplianceEvent(actorOwner, { assignmentId, performedAt: '2026-08-20T14:00', outcome: 'pass', findingsSummary: 'Inspection passed with no defects.', recommendedNextDueOn: '2027-08-20' });
		const event = await db.selectFrom('compliance_events as event').innerJoin('compliance_requirement_versions as version','version.id','event.compliance_requirement_version_id').select(['event.public_id as publicId','version.version_number as versionNumber','version.version_status as versionStatus']).where('event.public_id','=',eventPublicId).executeTakeFirstOrThrow();
		expect(event).toEqual({ publicId: eventPublicId, versionNumber: 1, versionStatus: 'published' });
	});

	it('constrains exact information evidence to an explicitly linked facility-project context', async () => {
		const service = new AssetsMaintenanceService(db);
		const project = await new ProjectWorkspaceService(db).createProject(actorOwner, { projectNumber: `S6-${randomUUID().slice(0,7)}`, name: 'Asset upgrade project' });
		projectPublicId = project.publicId;
		await service.linkFacilityProject(actorOwner, facilityPublicId, projectPublicId, 'maintenance');
		const information = new InformationService(db);
		const type = (await information.getWorkspace(actorOwner)).containerTypes[0]!;
		const containerPublicId = await information.createDocument(actorOwner, { projectPublicId, typeCode: type.code, containerNumber: `S6-EVID-${randomUUID().slice(0,6)}`, title: 'LV distribution board service certificate', revisionCode: 'P01' });
		const created = (await information.getWorkspace(actorOwner)).documents.find((row) => row.publicId === containerPublicId)!;
		const versionPublicId = created.versions[0]!.publicId;
		await information.issueRevision(actorOwner, { versionPublicId, channel: 'portal', note: 'Issued asset evidence.' });
		await service.linkEvidence(actorOwner, { subjectType: 'asset', subjectPublicId: assetPublicId, informationVersionPublicId: versionPublicId, linkRole: 'certificate' });
		const link = await db.selectFrom('asset_information_links as link').innerJoin('information_container_versions as version','version.id','link.information_container_version_id').select(['link.link_role as role','version.public_id as versionPublicId']).where('version.public_id','=',versionPublicId).executeTakeFirstOrThrow();
		expect(link).toEqual({ role: 'certificate', versionPublicId });
	});

	it('shows tenant operational visibility without leaking mutation authority', async () => {
		const workspace = await new AssetsMaintenanceService(db).getWorkspace(actorViewer);
		expect(workspace.canViewAssets).toBe(true);
		expect(workspace.canViewFacilities).toBe(true);
		expect(workspace.canViewMaintenance).toBe(true);
		expect(workspace.canViewCompliance).toBe(true);
		expect(workspace.canManageAssets).toBe(false);
		expect(workspace.canManageFacilities).toBe(false);
		expect(workspace.canManageWorkOrders).toBe(false);
		expect(workspace.canCompleteWorkOrders).toBe(false);
		expect(workspace.assets.some((row) => row.publicId === assetPublicId)).toBe(true);
	});
});
