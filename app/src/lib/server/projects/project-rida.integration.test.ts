import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRidaService, ProjectRidaValidationError } from './project-rida-service';

const PREFIX = 'Project RIDA Integration ';
const PROJECT_PREFIX = 'RIDA-';

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
	if (projectIds.length) {
		await db.deleteFrom('outbox_events').where('aggregate_type', '=', 'project_rida_item').execute();
		await db
			.deleteFrom('outbox_events')
			.where('aggregate_type', '=', 'work_item')
			.where('organisation_id', '=', organisationAId || '0')
			.execute();
		await db
			.deleteFrom('work_item_events')
			.where('work_item_owner_organisation_id', '=', organisationAId || '0')
			.execute();
		await db
			.deleteFrom('work_item_decisions')
			.where('work_item_owner_organisation_id', '=', organisationAId || '0')
			.execute();
		await db
			.deleteFrom('work_item_assignments')
			.where('work_item_owner_organisation_id', '=', organisationAId || '0')
			.execute();
		await db.deleteFrom('work_items').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_control_register_items')
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
	if (organisationIds.length) {
		await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
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
				joined_at: new Date('2026-08-25T08:00:00.000Z')
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

	await assignPermissionRole(organisationAId, ownerMemberId, 'Owner controls', [
		'project.view',
		'project.rida.view',
		'project.rida.manage',
		'project.rida.decide',
		'project.rida.close',
		'work.view',
		'work.create'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'RIDA viewer', [
		'project.view',
		'project.rida.view',
		'work.view'
	]);
	await assignPermissionRole(organisationBId, externalMemberId, 'External RIDA viewer', [
		'project.view',
		'project.rida.view',
		'work.view'
	]);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
				name: `${PREFIX}Controlled delivery`,
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
				joined_at: new Date('2026-08-25T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				status: 'active',
				invited_by_member_id: ownerMemberId,
				joined_at: new Date('2026-08-25T08:35:00.000Z'),
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
				joined_at: new Date('2026-08-25T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: viewerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-25T08:31:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				organisation_member_id: externalMemberId,
				status: 'active',
				joined_at: new Date('2026-08-25T08:35:00.000Z'),
				left_at: null
			}
		])
		.execute();

	owner = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `rida-owner-${randomUUID()}`
	};
	viewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `rida-viewer-${randomUUID()}`
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: `rida-external-${randomUUID()}`
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project risk, issue, decision and action registers', () => {
	it('captures governed risks and issues with controlled lifecycle and closure', async () => {
		const service = new ProjectRidaService(
			db,
			randomUUID,
			() => new Date('2026-08-25T12:00:00.000Z')
		);
		const riskPublicId = await service.createItem(owner, {
			projectPublicId,
			itemType: 'risk',
			title: 'Tower crane availability',
			description: 'Lead-time uncertainty could constrain the structure sequence.',
			priority: 'high',
			riskDirection: 'threat',
			probabilityScore: 4,
			impactScore: 5,
			responseStrategy: 'reduce',
			responsePlan: 'Secure an alternate supplier and preserve float.',
			dueOn: new Date('2026-09-05T00:00:00.000Z')
		});
		const issuePublicId = await service.createItem(owner, {
			projectPublicId,
			itemType: 'issue',
			title: 'Temporary power capacity shortfall',
			priority: 'critical',
			severity: 'high',
			impactSummary: 'Commissioning activities cannot run concurrently.',
			resolutionPlan: 'Add temporary distribution capacity.'
		});

		await service.transitionItem(owner, projectPublicId, riskPublicId, 'monitoring');
		await service.transitionItem(owner, projectPublicId, issuePublicId, 'investigating');
		await service.transitionItem(owner, projectPublicId, issuePublicId, 'resolved');
		await service.closeItem(owner, projectPublicId, issuePublicId);

		const workspace = await service.getWorkspace(viewer, projectPublicId);
		expect(workspace.canManage).toBe(false);
		expect(workspace.items.find((item) => item.publicId === riskPublicId)?.status).toBe('monitoring');
		expect(workspace.items.find((item) => item.publicId === issuePublicId)?.status).toBe('closed');
		expect(workspace.openRiskCount).toBeGreaterThanOrEqual(1);
	});

	it('records authoritative decisions and prevents invalid decision content', async () => {
		const service = new ProjectRidaService(
			db,
			randomUUID,
			() => new Date('2026-08-25T13:00:00.000Z')
		);
		await expect(
			service.createItem(owner, {
				projectPublicId,
				itemType: 'risk',
				title: 'Unscored risk',
				riskDirection: 'threat'
			})
		).rejects.toBeInstanceOf(ProjectRidaValidationError);

		const decisionPublicId = await service.createItem(owner, {
			projectPublicId,
			itemType: 'decision',
			title: 'Approve revised facade installation sequence',
			description: 'Sequence change is required to protect the envelope milestone.',
			priority: 'high',
			decisionRequiredOn: new Date('2026-08-28T00:00:00.000Z')
		});
		await service.transitionItem(owner, projectPublicId, decisionPublicId, 'pending');
		await service.decideItem(
			owner,
			projectPublicId,
			decisionPublicId,
			'Proceed with the revised sequence.',
			'Protects the weather-tight milestone without changing the approved budget.'
		);

		const workspace = await service.getWorkspace(owner, projectPublicId);
		const decision = workspace.items.find((item) => item.publicId === decisionPublicId);
		expect(decision?.status).toBe('decided');
		expect(decision?.decisionOutcome).toContain('Proceed');
		expect(decision?.decidedByMemberId).toBe(ownerMemberId);
	});

	it('uses the Work Kernel as the action register and preserves source lineage', async () => {
		const service = new ProjectRidaService(db);
		const issuePublicId = await service.createItem(owner, {
			projectPublicId,
			itemType: 'issue',
			title: 'Design response overdue',
			severity: 'medium',
			priority: 'high'
		});
		const actionPublicId = await service.createAction(owner, {
			projectPublicId,
			itemPublicId: issuePublicId,
			title: 'Obtain coordinated design response',
			description: 'Coordinate consultant response and close the outstanding design point.',
			priority: 'high',
			dueAt: new Date('2026-08-29T00:00:00.000Z')
		});

		const action = await db
			.selectFrom('work_items')
			.selectAll()
			.where('public_id', '=', actionPublicId)
			.executeTakeFirstOrThrow();
		expect(action.source_domain).toBe('project_controls');
		expect(action.source_type).toBe('project_rida_item');
		expect(action.source_public_id).toBe(issuePublicId);
		expect(action.work_item_kind).toBe('action');

		const workspace = await service.getWorkspace(owner, projectPublicId);
		expect(workspace.actions.some((row) => row.publicId === actionPublicId)).toBe(true);
	});

	it('contains owner-organisation governance records and denies mutations without authority', async () => {
		const service = new ProjectRidaService(db);
		await expect(
			service.createItem(viewer, {
				projectPublicId,
				itemType: 'issue',
				title: 'Viewer mutation attempt',
				severity: 'low'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(service.getWorkspace(external, projectPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
