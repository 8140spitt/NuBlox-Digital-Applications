import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from './project-repository';
import {
	ProjectWorkspaceService,
	ProjectWorkspaceValidationError
} from './project-workspace-service';

const PREFIX = 'Project Workspace Integration ';
const PROJECT_PREFIX = 'PWI-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let memberAId = '';
let memberBId = '';
let memberCId = '';
let userAId = '';
let userBId = '';
let userCId = '';
let actorA: TenantActorContext;
let actorB: TenantActorContext;
let actorC: TenantActorContext;
let projectId = '';
let projectPublicId = '';

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

async function createUser(displayName: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}${displayName}`,
				status: 'active'
			})
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
				joined_at: new Date('2026-08-15T18:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	roleName: string,
	permissionKeys: string[]
): Promise<string> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${roleName}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	if (permissionKeys.length > 0) {
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
	}

	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
	return roleId;
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();

	userAId = await createUser('Owner');
	userBId = await createUser('Viewer');
	userCId = await createUser('External Manager');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	memberAId = await createMember(organisationAId, userAId);
	memberBId = await createMember(organisationAId, userBId);
	memberCId = await createMember(organisationBId, userCId);

	await assignPermissionRole(organisationAId, memberAId, 'Owner', [
		'project.create',
		'project.view',
		'project.manage'
	]);
	await assignPermissionRole(organisationAId, memberBId, 'Viewer', ['project.view']);
	await assignPermissionRole(organisationBId, memberCId, 'External Manager', [
		'project.view',
		'project.manage'
	]);

	actorA = {
		organisationId: organisationAId,
		userId: userAId,
		memberId: memberAId,
		correlationId: `project-workspace-${randomUUID()}`
	};
	actorB = {
		organisationId: organisationAId,
		userId: userBId,
		memberId: memberBId,
		correlationId: `project-workspace-${randomUUID()}`
	};
	actorC = {
		organisationId: organisationBId,
		userId: userCId,
		memberId: memberCId,
		correlationId: `project-workspace-${randomUUID()}`
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('permission-aware project creation and workspace', () => {
	it('creates an owned project, owner participation and creator member scope through project.create', async () => {
		const service = new ProjectWorkspaceService(db);
		const created = await service.createProject(actorA, {
			projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'First project workspace',
			description: 'Created by the permission-aware application service.'
		});
		projectId = created.id;
		projectPublicId = created.publicId;

		const list = await service.listProjects(actorA);
		expect(list.canCreate).toBe(true);
		expect(list.canView).toBe(true);
		expect(list.projects.map((project) => project.publicId)).toContain(projectPublicId);

		const workspace = await service.getWorkspace(actorA, projectPublicId);
		expect(workspace.project.status).toBe('proposed');
		expect(workspace.isOwningOrganisation).toBe(true);
		expect(workspace.canManageLifecycle).toBe(true);
		expect(workspace.allowedTransitions).toEqual(['active', 'cancelled']);
		expect(workspace.participants).toHaveLength(1);
		expect(workspace.participants[0]?.organisationId).toBe(organisationAId);
	});

	it('does not expose a project to a same-organisation user who has project.view but no project membership', async () => {
		const service = new ProjectWorkspaceService(db);
		const listBeforeMembership = await service.listProjects(actorB);
		expect(listBeforeMembership.canView).toBe(true);
		expect(listBeforeMembership.projects).toHaveLength(0);
		await expect(service.getWorkspace(actorB, projectPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);

		await new ProjectRepository(db).insertProjectMember(
			projectId,
			organisationAId,
			memberBId,
			new Date('2026-08-15T18:30:00.000Z')
		);

		const listAfterMembership = await service.listProjects(actorB);
		expect(listAfterMembership.projects.map((project) => project.publicId)).toEqual([
			projectPublicId
		]);
		const workspace = await service.getWorkspace(actorB, projectPublicId);
		expect(workspace.canManageLifecycle).toBe(false);
		await expect(
			service.transitionProject(actorB, { projectPublicId, toStatus: 'active' })
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('rejects duplicate project numbers and permits lifecycle mutation only after project.manage', async () => {
		const service = new ProjectWorkspaceService(db);
		const existing = await new ProjectRepository(db).findOwnedByPublicId(
			organisationAId,
			projectPublicId
		);
		expect(existing).not.toBeNull();
		await expect(
			service.createProject(actorA, {
				projectNumber: existing!.projectNumber,
				name: 'Duplicate number'
			})
		).rejects.toBeInstanceOf(ProjectWorkspaceValidationError);

		await assignPermissionRole(organisationAId, memberBId, 'Project Manager', ['project.manage']);
		const active = await service.transitionProject(actorB, {
			projectPublicId,
			toStatus: 'active',
			effectiveDate: new Date('2026-08-15T00:00:00.000Z')
		});
		expect(active.status).toBe('active');

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'actor_member_id'])
			.where('project_id', '=', projectId)
			.where('action_key', '=', 'project.status_changed')
			.orderBy('id', 'desc')
			.executeTakeFirstOrThrow();
		expect(audit).toMatchObject({
			action_key: 'project.status_changed',
			actor_member_id: memberBId
		});
	});

	it('allows an external participant to view after explicit scope but never to mutate owner lifecycle', async () => {
		await db
			.insertInto('project_organisations')
			.values({
				project_id: projectId,
				participant_organisation_id: organisationBId,
				status: 'active',
				invited_by_member_id: memberAId,
				joined_at: new Date('2026-08-15T19:00:00.000Z'),
				left_at: null
			})
			.executeTakeFirstOrThrow();
		await new ProjectRepository(db).insertProjectMember(
			projectId,
			organisationBId,
			memberCId,
			new Date('2026-08-15T19:00:00.000Z')
		);

		const service = new ProjectWorkspaceService(db);
		const externalWorkspace = await service.getWorkspace(actorC, projectPublicId);
		expect(externalWorkspace.isOwningOrganisation).toBe(false);
		expect(externalWorkspace.canManageLifecycle).toBe(false);
		expect(externalWorkspace.allowedTransitions).toEqual([]);
		expect(
			externalWorkspace.participants.map((participant) => participant.organisationId).sort()
		).toEqual([organisationAId, organisationBId].sort());
		await expect(
			service.transitionProject(actorC, { projectPublicId, toStatus: 'on_hold' })
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
