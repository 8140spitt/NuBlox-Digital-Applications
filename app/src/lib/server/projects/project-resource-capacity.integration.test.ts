import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectPlanService } from './project-plan-service';
import {
	ProjectResourceCapacityService,
	ProjectResourceCapacityValidationError
} from './project-resource-capacity-service';

const PREFIX = 'Resource Capacity Integration ';
const PROJECT_PREFIX = 'RCI-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerUserId = '';
let viewerUserId = '';
let externalUserId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let externalMemberId = '';
let projectId = '';
let projectPublicId = '';
let ownerWorkerId = '';
let viewerWorkerId = '';
let ownerResourceAssignmentPublicId = '';
let activityPublicId = '';
let activeAllocationPublicId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;
let external: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);
	if (projectIds.length > 0) {
		await db
			.deleteFrom('project_activity_resource_allocations')
			.where('project_id', 'in', projectIds)
			.execute();
		await db
			.deleteFrom('project_plan_dependencies')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_plan_activities').where('project_id', 'in', projectIds).execute();
		await db
			.updateTable('project_wbs_nodes')
			.set({ parent_wbs_node_id: null })
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_wbs_nodes').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_resource_assignments')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('audit_events').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_organisation_roles')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
		await db
			.deleteFrom('worker_unavailability')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('worker_calendar_assignments')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('work_calendar_weekdays')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('work_calendars').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('workers').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
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
				legal_name: `${PREFIX}${label}`,
				default_timezone: 'Europe/London',
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
				joined_at: new Date('2026-08-24T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label}`,
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

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	externalUserId = await createUser('External');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	externalMemberId = await createMember(organisationBId, externalUserId);

	await assignPermissionRole(organisationAId, ownerMemberId, 'Resource owner', [
		'project.view',
		'project.plan.view',
		'project.plan.manage',
		'project.resource.view',
		'project.resource.manage'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'Resource viewer', [
		'project.view',
		'project.resource.view'
	]);
	await assignPermissionRole(organisationBId, externalMemberId, 'External resource viewer', [
		'project.view',
		'project.resource.view'
	]);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
				name: `${PREFIX}Resource-loaded project`,
				status: 'active',
				created_by_member_id: ownerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values([
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				status: 'active',
				invited_by_member_id: null,
				joined_at: new Date('2026-08-24T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				status: 'active',
				invited_by_member_id: ownerMemberId,
				joined_at: new Date('2026-08-24T08:35:00.000Z'),
				left_at: null
			}
		])
		.execute();
	await db
		.insertInto('project_members')
		.values([
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: ownerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: viewerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:31:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				organisation_member_id: externalMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:35:00.000Z'),
				left_at: null
			}
		])
		.execute();

	owner = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `resource-owner-${randomUUID()}`
	};
	viewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `resource-viewer-${randomUUID()}`
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: `resource-external-${randomUUID()}`
	};

	ownerWorkerId = insertedId(
		await db
			.insertInto('workers')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				organisation_member_id: ownerMemberId,
				person_party_id: null,
				worker_number: 'RCI-OWNER',
				display_name: `${PREFIX}Planner`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	viewerWorkerId = insertedId(
		await db
			.insertInto('workers')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				organisation_member_id: viewerMemberId,
				person_party_id: null,
				worker_number: 'RCI-VIEWER',
				display_name: `${PREFIX}Unconfigured`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	ownerResourceAssignmentPublicId = randomUUID();
	await db
		.insertInto('project_resource_assignments')
		.values([
			{
				organisation_id: organisationAId,
				project_id: projectId,
				worker_id: ownerWorkerId,
				project_role_type_id: null,
				public_id: ownerResourceAssignmentPublicId,
				assigned_by_member_id: ownerMemberId,
				starts_on: new Date('2026-09-01T00:00:00.000Z'),
				ends_on: new Date('2026-09-30T00:00:00.000Z'),
				planned_allocation_percent: '50.00',
				assignment_status: 'active',
				notes: null
			},
			{
				organisation_id: organisationAId,
				project_id: projectId,
				worker_id: viewerWorkerId,
				project_role_type_id: null,
				public_id: randomUUID(),
				assigned_by_member_id: ownerMemberId,
				starts_on: new Date('2026-09-01T00:00:00.000Z'),
				ends_on: new Date('2026-09-30T00:00:00.000Z'),
				planned_allocation_percent: '25.00',
				assignment_status: 'active',
				notes: null
			}
		])
		.execute();

	const calendarId = insertedId(
		await db
			.insertInto('work_calendars')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				name: `${PREFIX}Site 37.5h`,
				timezone: 'Europe/London',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('work_calendar_weekdays')
		.values(
			[1, 2, 3, 4, 5].map((weekday) => ({
				organisation_id: organisationAId,
				work_calendar_id: calendarId,
				iso_weekday: weekday,
				local_start_time: '08:00:00',
				local_end_time: '16:00:00',
				unpaid_break_minutes: 30
			}))
		)
		.execute();
	await db
		.insertInto('worker_calendar_assignments')
		.values({
			organisation_id: organisationAId,
			worker_id: ownerWorkerId,
			work_calendar_id: calendarId,
			valid_from: new Date('2026-09-01T00:00:00.000Z'),
			valid_to: new Date('2026-09-30T00:00:00.000Z')
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('worker_unavailability')
		.values({
			organisation_id: organisationAId,
			public_id: randomUUID(),
			worker_id: ownerWorkerId,
			unavailability_type: 'training',
			starts_at: new Date('2026-09-09T07:00:00.000Z'),
			ends_at: new Date('2026-09-09T11:00:00.000Z'),
			status: 'approved',
			notes: 'Half-day training',
			created_by_member_id: ownerMemberId
		})
		.executeTakeFirstOrThrow();

	const planService = new ProjectPlanService(db);
	const wbs = await planService.createWbsNode(owner, {
		projectPublicId,
		wbsCode: '1.1',
		name: 'Substructure',
		sortOrder: 10
	});
	const activity = await planService.createActivity(owner, {
		projectPublicId,
		wbsNodePublicId: wbs.publicId,
		activityCode: 'RC100',
		name: 'Resource-loaded foundations',
		activityKind: 'activity',
		plannedStartOn: new Date('2026-09-07T00:00:00.000Z'),
		plannedFinishOn: new Date('2026-09-11T00:00:00.000Z'),
		plannedDurationDays: 5
	});
	activityPublicId = activity.publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project resource loading and capacity', () => {
	it('loads activity effort and derives capacity, utilisation and overload from workforce facts', async () => {
		const service = new ProjectResourceCapacityService(db);
		const allocation = await service.createAllocation(owner, {
			projectPublicId,
			activityPublicId,
			resourceAssignmentPublicId: ownerResourceAssignmentPublicId,
			plannedEffortHours: '20.00',
			loadStartOn: new Date('2026-09-07T00:00:00.000Z'),
			loadFinishOn: new Date('2026-09-11T00:00:00.000Z'),
			notes: 'Initial labour loading'
		});
		activeAllocationPublicId = allocation.publicId;
		expect(allocation.plannedEffortMinutes).toBe(1200);

		const view = await service.getCapacity(owner, projectPublicId, {
			fromOn: new Date('2026-09-07T00:00:00.000Z'),
			toOn: new Date('2026-09-11T00:00:00.000Z')
		});
		expect(view.canManage).toBe(true);
		expect(view.totals).toMatchObject({
			resourceCount: 2,
			plannedLoadMinutes: 1200,
			projectCapacityMinutes: 1005,
			varianceMinutes: -195,
			overloadedDays: 5,
			unconfiguredResources: 1
		});
		const planner = view.workers.find((worker) => worker.workerId === ownerWorkerId);
		expect(planner).toBeDefined();
		expect(planner).toMatchObject({
			capacityConfigured: true,
			projectCapacityMinutes: 1005,
			plannedLoadMinutes: 1200,
			overloadedDays: 5
		});
		expect(planner?.days.find((day) => day.date === '2026-09-09')).toMatchObject({
			grossCapacityMinutes: 450,
			unavailableMinutes: 240,
			projectCapacityMinutes: 105,
			plannedLoadMinutes: 240,
			overloaded: true
		});
		expect(view.workers.find((worker) => worker.workerId === viewerWorkerId)).toMatchObject({
			capacityConfigured: false,
			plannedLoadMinutes: 0
		});

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_public_id'])
			.where('project_id', '=', projectId)
			.where('subject_public_id', '=', allocation.publicId)
			.executeTakeFirst();
		expect(audit?.action_key).toBe('project.resource_allocation.created');
	});

	it('allows owner-organisation read-only members to inspect capacity but contains external collaborators', async () => {
		const service = new ProjectResourceCapacityService(db);
		const ownerView = await service.getCapacity(viewer, projectPublicId, {
			fromOn: new Date('2026-09-07T00:00:00.000Z'),
			toOn: new Date('2026-09-11T00:00:00.000Z')
		});
		expect(ownerView.canManage).toBe(false);
		expect(ownerView.allocations).toHaveLength(1);
		await expect(
			service.createAllocation(viewer, {
				projectPublicId,
				activityPublicId,
				resourceAssignmentPublicId: ownerResourceAssignmentPublicId,
				plannedEffortHours: '1',
				loadStartOn: new Date('2026-09-07T00:00:00.000Z'),
				loadFinishOn: new Date('2026-09-07T00:00:00.000Z')
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(
			service.getCapacity(external, projectPublicId, {
				fromOn: new Date('2026-09-07T00:00:00.000Z'),
				toOn: new Date('2026-09-11T00:00:00.000Z')
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('protects activity and project-assignment date boundaries and prevents duplicate active loading', async () => {
		const service = new ProjectResourceCapacityService(db);
		await expect(
			service.createAllocation(owner, {
				projectPublicId,
				activityPublicId,
				resourceAssignmentPublicId: ownerResourceAssignmentPublicId,
				plannedEffortHours: '8',
				loadStartOn: new Date('2026-09-06T00:00:00.000Z'),
				loadFinishOn: new Date('2026-09-08T00:00:00.000Z')
			})
		).rejects.toBeInstanceOf(ProjectResourceCapacityValidationError);
		await expect(
			service.createAllocation(owner, {
				projectPublicId,
				activityPublicId,
				resourceAssignmentPublicId: ownerResourceAssignmentPublicId,
				plannedEffortHours: '8',
				loadStartOn: new Date('2026-09-07T00:00:00.000Z'),
				loadFinishOn: new Date('2026-09-11T00:00:00.000Z')
			})
		).rejects.toThrow('already has an active resource load');
	});

	it('uses additive removal evidence and permits a corrected replacement load', async () => {
		const service = new ProjectResourceCapacityService(db);
		await service.removeAllocation(owner, projectPublicId, activeAllocationPublicId);
		const removed = await db
			.selectFrom('project_activity_resource_allocations')
			.select(['allocation_status', 'removed_by_member_id', 'removed_at'])
			.where('public_id', '=', activeAllocationPublicId)
			.executeTakeFirstOrThrow();
		expect(removed.allocation_status).toBe('removed');
		expect(removed.removed_by_member_id).toBe(ownerMemberId);
		expect(removed.removed_at).not.toBeNull();

		const corrected = await service.createAllocation(owner, {
			projectPublicId,
			activityPublicId,
			resourceAssignmentPublicId: ownerResourceAssignmentPublicId,
			plannedEffortHours: '10',
			loadStartOn: new Date('2026-09-07T00:00:00.000Z'),
			loadFinishOn: new Date('2026-09-11T00:00:00.000Z'),
			notes: 'Corrected labour loading'
		});
		const view = await service.getCapacity(owner, projectPublicId, {
			fromOn: new Date('2026-09-07T00:00:00.000Z'),
			toOn: new Date('2026-09-11T00:00:00.000Z')
		});
		expect(view.allocations.map((allocation) => allocation.publicId)).toEqual([corrected.publicId]);
		expect(view.totals).toMatchObject({
			plannedLoadMinutes: 600,
			projectCapacityMinutes: 1005,
			overloadedDays: 1
		});
		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('project_id', '=', projectId)
			.where('action_key', 'in', [
				'project.resource_allocation.created',
				'project.resource_allocation.removed'
			])
			.orderBy('id', 'asc')
			.execute();
		expect(auditActions.map((row) => row.action_key)).toEqual([
			'project.resource_allocation.created',
			'project.resource_allocation.removed',
			'project.resource_allocation.created'
		]);
	});
});
