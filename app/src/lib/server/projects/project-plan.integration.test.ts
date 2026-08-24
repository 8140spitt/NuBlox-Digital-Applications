import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectPlanService, ProjectPlanValidationError } from './project-plan-service';

const PREFIX = 'Project Plan Integration ';
const PROJECT_PREFIX = 'PPI-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let externalMemberId = '';
let ownerUserId = '';
let viewerUserId = '';
let externalUserId = '';
let projectId = '';
let projectPublicId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;
let external: TenantActorContext;
let rootWbsPublicId = '';
let tradeWbsPublicId = '';
let activityAPublicId = '';
let milestoneBPublicId = '';
let dependencyPublicId = '';
let baselinePublicId = '';

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
			.deleteFrom('project_plan_baseline_dependencies')
			.where('project_id', 'in', projectIds)
			.execute();
		await db
			.deleteFrom('project_plan_baseline_activities')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_plan_baselines').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_plan_dependencies')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_plan_activities').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_wbs_nodes').where('project_id', 'in', projectIds).execute();
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
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}${label}`, status: 'active' })
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

	await assignPermissionRole(organisationAId, ownerMemberId, 'Plan owner', [
		'project.view',
		'project.plan.view',
		'project.plan.manage',
		'project.plan.baseline.manage'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'Plan viewer', [
		'project.view',
		'project.plan.view'
	]);
	await assignPermissionRole(organisationBId, externalMemberId, 'External plan manager', [
		'project.view',
		'project.plan.view',
		'project.plan.manage',
		'project.plan.baseline.manage'
	]);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
				name: `${PREFIX}Controlled delivery project`,
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
		correlationId: `project-plan-owner-${randomUUID()}`
	};
	viewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `project-plan-viewer-${randomUUID()}`
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: `project-plan-external-${randomUUID()}`
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('governed project-controls plan', () => {
	it('creates WBS, activity, milestone and dependency records with audit evidence', async () => {
		const service = new ProjectPlanService(db);
		const root = await service.createWbsNode(owner, {
			projectPublicId,
			wbsCode: '1',
			name: 'Delivery works',
			sortOrder: 10
		});
		rootWbsPublicId = root.publicId;
		const trade = await service.createWbsNode(owner, {
			projectPublicId,
			parentWbsNodePublicId: root.publicId,
			wbsCode: '1.1',
			name: 'Substructure',
			sortOrder: 20
		});
		tradeWbsPublicId = trade.publicId;

		const activity = await service.createActivity(owner, {
			projectPublicId,
			wbsNodePublicId: trade.publicId,
			activityCode: 'A100',
			name: 'Excavate foundations',
			activityKind: 'activity',
			plannedStartOn: new Date('2026-09-01T00:00:00.000Z'),
			plannedFinishOn: new Date('2026-09-05T00:00:00.000Z'),
			plannedDurationDays: 5
		});
		activityAPublicId = activity.publicId;
		const milestone = await service.createActivity(owner, {
			projectPublicId,
			wbsNodePublicId: root.publicId,
			activityCode: 'M200',
			name: 'Foundations complete',
			activityKind: 'milestone',
			plannedStartOn: new Date('2026-09-05T00:00:00.000Z'),
			plannedFinishOn: new Date('2026-09-05T00:00:00.000Z'),
			plannedDurationDays: 0
		});
		milestoneBPublicId = milestone.publicId;
		const dependency = await service.addDependency(owner, {
			projectPublicId,
			predecessorActivityPublicId: activity.publicId,
			successorActivityPublicId: milestone.publicId,
			dependencyType: 'FS',
			lagDays: 0
		});
		dependencyPublicId = dependency.publicId;

		const plan = await service.getPlan(owner, projectPublicId);
		expect(plan.wbsNodes.map((node) => node.wbsCode)).toEqual(['1', '1.1']);
		expect(plan.activities.map((item) => item.activityCode)).toEqual(['A100', 'M200']);
		expect(plan.dependencies).toHaveLength(1);
		expect(plan.dependencies[0]).toMatchObject({
			predecessorActivityCode: 'A100',
			successorActivityCode: 'M200',
			dependencyType: 'FS'
		});

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('project_id', '=', projectId)
			.where('action_key', 'in', [
				'project.wbs_node.created',
				'project.plan.activity_created',
				'project.plan.dependency_created'
			])
			.orderBy('id', 'asc')
			.execute();
		expect(auditActions.map((row) => row.action_key)).toEqual([
			'project.wbs_node.created',
			'project.wbs_node.created',
			'project.plan.activity_created',
			'project.plan.activity_created',
			'project.plan.dependency_created'
		]);
	});

	it('rejects dependency cycles and owner-only mutations from external participants', async () => {
		const service = new ProjectPlanService(db);
		await expect(
			service.addDependency(owner, {
				projectPublicId,
				predecessorActivityPublicId: milestoneBPublicId,
				successorActivityPublicId: activityAPublicId,
				dependencyType: 'FS'
			})
		).rejects.toThrow(ProjectPlanValidationError);

		const externalView = await service.getPlan(external, projectPublicId);
		expect(externalView.activities).toHaveLength(2);
		expect(externalView.canManage).toBe(false);
		expect(externalView.canCaptureBaseline).toBe(false);
		await expect(
			service.createWbsNode(external, {
				projectPublicId,
				wbsCode: 'EXT',
				name: 'External mutation'
			})
		).rejects.toThrow(TenantAccessError);
	});

	it('permits project-scoped read access without granting mutation authority', async () => {
		const service = new ProjectPlanService(db);
		const view = await service.getPlan(viewer, projectPublicId);
		expect(view.canManage).toBe(false);
		expect(view.canCaptureBaseline).toBe(false);
		expect(view.wbsNodes).toHaveLength(2);
		expect(view.activities).toHaveLength(2);
		await expect(
			service.addDependency(viewer, {
				projectPublicId,
				predecessorActivityPublicId: activityAPublicId,
				successorActivityPublicId: milestoneBPublicId,
				dependencyType: 'SS'
			})
		).rejects.toThrow(TenantAccessError);
	});

	it('captures immutable activity and dependency snapshots', async () => {
		const service = new ProjectPlanService(db);
		const baseline = await service.captureBaseline(owner, {
			projectPublicId,
			name: 'Contract baseline',
			description: 'Approved planning basis before current-plan development continues.'
		});
		baselinePublicId = baseline.publicId;
		expect(baseline.baselineNumber).toBe(1);
		expect(baseline.activities.map((activity) => activity.activityCode)).toEqual(['A100', 'M200']);
		expect(baseline.dependencies).toEqual([
			expect.objectContaining({
				predecessorActivityCode: 'A100',
				successorActivityCode: 'M200',
				dependencyType: 'FS'
			})
		]);

		await service.createActivity(owner, {
			projectPublicId,
			wbsNodePublicId: tradeWbsPublicId,
			activityCode: 'A300',
			name: 'Cast foundations',
			activityKind: 'activity',
			plannedStartOn: new Date('2026-09-06T00:00:00.000Z'),
			plannedFinishOn: new Date('2026-09-10T00:00:00.000Z'),
			plannedDurationDays: 5
		});
		await service.removeDependency(owner, projectPublicId, dependencyPublicId);

		const current = await service.getPlan(owner, projectPublicId);
		expect(current.activities).toHaveLength(3);
		expect(current.dependencies).toHaveLength(0);
		const historical = await service.getBaselineSnapshot(owner, projectPublicId, baselinePublicId);
		expect(historical.activities.map((activity) => activity.activityCode)).toEqual([
			'A100',
			'M200'
		]);
		expect(historical.dependencies).toHaveLength(1);

		const baselineAudit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_public_id'])
			.where('project_id', '=', projectId)
			.where('action_key', '=', 'project.plan.baseline_captured')
			.executeTakeFirstOrThrow();
		expect(baselineAudit.subject_public_id).toBe(baselinePublicId);
	});
});
