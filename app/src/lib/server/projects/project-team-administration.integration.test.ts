import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { ProjectWorkspaceService } from './project-workspace-service';
import { ProjectTeamService, ProjectTeamValidationError } from './project-team-service';

const PREFIX = 'Project Team Integration ';
const PROJECT_PREFIX = 'PTI-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let organisationCId = '';
let memberAId = '';
let memberBManagerId = '';
let memberBTeammateId = '';
let memberCId = '';
let userAId = '';
let userBManagerId = '';
let userBTeammateId = '';
let userCId = '';
let memberBManagerPublicId = '';
let memberBTeammatePublicId = '';
let memberCPublicId = '';
let organisationBPublicId = '';
let crmOrganisationBPublicId = '';
let actorA: TenantActorContext;
let actorBManager: TenantActorContext;
let actorBTeammate: TenantActorContext;
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
			.deleteFrom('party_organisations')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('parties').where('organisation_id', 'in', organisationIds).execute();
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

async function createOrganisation(name: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: publicId, legal_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function createMember(
	organisationId: string,
	userId: string
): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: publicId,
				status: 'active',
				joined_at: new Date('2026-08-15T20:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	roleName: string,
	permissionKeys: string[]
): Promise<void> {
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

	userAId = await createUser('Owner Manager');
	userBManagerId = await createUser('External Manager');
	userBTeammateId = await createUser('External Teammate');
	userCId = await createUser('Unrelated Member');
	const organisationA = await createOrganisation('Organisation A');
	const organisationB = await createOrganisation('Organisation B');
	const organisationC = await createOrganisation('Organisation C');
	organisationAId = organisationA.id;
	organisationBId = organisationB.id;
	organisationBPublicId = organisationB.publicId;
	organisationCId = organisationC.id;

	const memberA = await createMember(organisationAId, userAId);
	const memberBManager = await createMember(organisationBId, userBManagerId);
	const memberBTeammate = await createMember(organisationBId, userBTeammateId);
	const memberC = await createMember(organisationCId, userCId);
	memberAId = memberA.id;
	memberBManagerId = memberBManager.id;
	memberBManagerPublicId = memberBManager.publicId;
	memberBTeammateId = memberBTeammate.id;
	memberBTeammatePublicId = memberBTeammate.publicId;
	memberCId = memberC.id;
	memberCPublicId = memberC.publicId;

	await assignPermissionRole(organisationAId, memberAId, 'Owner', [
		'project.create',
		'project.view',
		'project.manage',
		'crm.view'
	]);

	crmOrganisationBPublicId = randomUUID();
	const crmOrganisationBPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: crmOrganisationBPublicId,
				party_kind: 'organisation',
				account_owner_member_id: memberAId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: crmOrganisationBPartyId,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}Organisation B CRM`,
			trading_name: null,
			linked_organisation_id: organisationBId
		})
		.executeTakeFirstOrThrow();
	await assignPermissionRole(organisationBId, memberBManagerId, 'External Manager', [
		'project.view',
		'project.manage'
	]);
	await assignPermissionRole(organisationBId, memberBTeammateId, 'External Viewer', [
		'project.view'
	]);
	await assignPermissionRole(organisationCId, memberCId, 'Unrelated Viewer', ['project.view']);

	actorA = {
		organisationId: organisationAId,
		userId: userAId,
		memberId: memberAId,
		correlationId: `project-team-${randomUUID()}`
	};
	actorBManager = {
		organisationId: organisationBId,
		userId: userBManagerId,
		memberId: memberBManagerId,
		correlationId: `project-team-${randomUUID()}`
	};
	actorBTeammate = {
		organisationId: organisationBId,
		userId: userBTeammateId,
		memberId: memberBTeammateId,
		correlationId: `project-team-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actorA, {
		projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
		name: 'Participant administration project'
	});
	projectId = project.id;
	projectPublicId = project.publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project participant and team administration', () => {
	it('invites a linked CRM organisation without granting project scope before acceptance', async () => {
		const service = new ProjectTeamService(db);
		const team = await service.getTeamView(actorA, projectPublicId);
		expect(team.invitationCandidates).toContainEqual(
			expect.objectContaining({
				partyPublicId: crmOrganisationBPublicId,
				linkedOrganisationPublicId: organisationBPublicId,
				linkedOrganisationStatus: 'active'
			})
		);
		await service.inviteCrmParticipant(actorA, {
			projectPublicId,
			crmPartyPublicId: crmOrganisationBPublicId,
			roleKeys: ['main_contractor']
		});

		const invitations = await service.listPendingInvitations(actorBManager);
		expect(invitations).toHaveLength(1);
		expect(invitations[0]).toMatchObject({
			projectPublicId,
			projectName: 'Participant administration project'
		});
		expect(invitations[0]?.roles.map((role) => role.roleKey)).toEqual(['main_contractor']);
		await expect(
			new ProjectWorkspaceService(db).getWorkspace(actorBManager, projectPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('records an explicit decline and permits a later controlled re-invitation', async () => {
		const service = new ProjectTeamService(db);
		await service.respondToInvitation(actorBManager, { projectPublicId, response: 'decline' });
		const declined = await db
			.selectFrom('project_organisations')
			.select('status')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.executeTakeFirstOrThrow();
		expect(declined.status).toBe('declined');
		expect(await service.listPendingInvitations(actorBManager)).toHaveLength(0);

		await service.inviteParticipant(actorA, {
			projectPublicId,
			organisationPublicId: organisationBPublicId,
			roleKeys: ['main_contractor', 'project_manager']
		});
		const reinvited = await service.listPendingInvitations(actorBManager);
		expect(reinvited).toHaveLength(1);
		expect(reinvited[0]?.roles.map((role) => role.roleKey).sort()).toEqual([
			'main_contractor',
			'project_manager'
		]);
	});

	it('accepts at organisation level and atomically establishes the accepting member project scope', async () => {
		const service = new ProjectTeamService(db);
		await service.respondToInvitation(actorBManager, { projectPublicId, response: 'accept' });
		const participation = await db
			.selectFrom('project_organisations')
			.select(['status', 'joined_at'])
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.executeTakeFirstOrThrow();
		expect(participation.status).toBe('active');
		expect(participation.joined_at).not.toBeNull();

		const projectMember = await db
			.selectFrom('project_members')
			.select('status')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.where('organisation_member_id', '=', memberBManagerId)
			.executeTakeFirstOrThrow();
		expect(projectMember.status).toBe('active');

		const workspace = await new ProjectWorkspaceService(db).getWorkspace(
			actorBManager,
			projectPublicId
		);
		expect(workspace.isOwningOrganisation).toBe(false);
		expect(workspace.canManageLifecycle).toBe(false);
		const team = await service.getTeamView(actorBManager, projectPublicId);
		expect(team.canManageTeam).toBe(true);
		expect(team.canManageParticipants).toBe(false);
		expect(team.canLeaveParticipation).toBe(true);
	});

	it('lets a participant manager add only active members from their own organisation and assign contextual roles', async () => {
		const service = new ProjectTeamService(db);
		await service.addMember(actorBManager, {
			projectPublicId,
			memberPublicId: memberBTeammatePublicId,
			roleKeys: ['engineer']
		});
		const team = await service.getTeamView(actorBManager, projectPublicId);
		expect(team.teamMembers.map((member) => member.publicId).sort()).toEqual(
			[memberBManagerPublicId, memberBTeammatePublicId].sort()
		);
		expect(
			team.teamMembers
				.find((member) => member.publicId === memberBTeammatePublicId)
				?.roles.map((role) => role.roleKey)
		).toEqual(['engineer']);

		await expect(
			service.addMember(actorBManager, {
				projectPublicId,
				memberPublicId: memberCPublicId,
				roleKeys: ['engineer']
			})
		).rejects.toBeInstanceOf(ProjectTeamValidationError);
	});

	it('prevents removal of the final scoped project manager, then permits handover to another manager', async () => {
		const service = new ProjectTeamService(db);
		await expect(
			service.removeMember(actorBManager, {
				projectPublicId,
				memberPublicId: memberBManagerPublicId
			})
		).rejects.toBeInstanceOf(ProjectTeamValidationError);

		await assignPermissionRole(organisationBId, memberBTeammateId, 'Project Manager Handover', [
			'project.view',
			'project.manage'
		]);
		const removed = await service.removeMember(actorBManager, {
			projectPublicId,
			memberPublicId: memberBManagerPublicId
		});
		expect(removed.removedSelf).toBe(true);
		await expect(
			new ProjectWorkspaceService(db).getWorkspace(actorBManager, projectPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
		const teammateWorkspace = await new ProjectWorkspaceService(db).getWorkspace(
			actorBTeammate,
			projectPublicId
		);
		expect(teammateWorkspace.isOwningOrganisation).toBe(false);
	});

	it('lets a participating organisation leave and removes all of its active member scope', async () => {
		const service = new ProjectTeamService(db);
		await service.leaveProject(actorBTeammate, projectPublicId);
		const participation = await db
			.selectFrom('project_organisations')
			.select('status')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.executeTakeFirstOrThrow();
		expect(participation.status).toBe('left');
		const activeMembers = await db
			.selectFrom('project_members')
			.select('organisation_member_id')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.where('status', '=', 'active')
			.execute();
		expect(activeMembers).toHaveLength(0);
		await expect(
			new ProjectWorkspaceService(db).getWorkspace(actorBTeammate, projectPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('allows owner re-invitation after leaving and owner removal revokes every participant member scope', async () => {
		const service = new ProjectTeamService(db);
		await service.inviteParticipant(actorA, {
			projectPublicId,
			organisationPublicId: organisationBPublicId,
			roleKeys: ['main_contractor']
		});
		await service.respondToInvitation(actorBManager, { projectPublicId, response: 'accept' });
		await service.addMember(actorBManager, {
			projectPublicId,
			memberPublicId: memberBTeammatePublicId,
			roleKeys: ['engineer']
		});
		await service.removeParticipant(actorA, {
			projectPublicId,
			organisationPublicId: organisationBPublicId
		});
		const participation = await db
			.selectFrom('project_organisations')
			.select('status')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.executeTakeFirstOrThrow();
		expect(participation.status).toBe('removed');
		const activeMembers = await db
			.selectFrom('project_members')
			.select('organisation_member_id')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', organisationBId)
			.where('status', '=', 'active')
			.execute();
		expect(activeMembers).toHaveLength(0);
		await expect(
			new ProjectWorkspaceService(db).getWorkspace(actorBManager, projectPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
