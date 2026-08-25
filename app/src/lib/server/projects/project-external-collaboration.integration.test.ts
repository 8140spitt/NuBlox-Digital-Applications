import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { auth, authPool } from '$lib/server/auth/better-auth';
import { PROJECT_COLLABORATION_SIGNUP_COOKIE } from '$lib/server/auth/project-collaboration-cookie';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CrmService } from '$lib/server/crm/crm-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import { ProjectWorkspaceService } from './project-workspace-service';
import { ProjectExternalCollaborationService } from './project-external-collaboration-service';

const PREFIX = 'Project External Collaboration Integration ';
const PROJECT_PREFIX = 'PECI-';
const PASSWORD = 'NuBlox-External-Collaboration-2026!';

let db: Database;
let organisationId = '';
let ownerUserId = '';
let ownerMemberId = '';
let projectId = '';
let projectPublicId = '';
let companyPublicId = '';
let personPublicId = '';
let inviteEmail = '';
let invitationPublicId = '';
let invitationToken = '';
let externalAuthUserId = '';
let externalPlatformUserId = '';
let actor: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

class CaptureEmailDelivery implements EmailDelivery {
	readonly messages: TransactionalEmail[] = [];

	async send(message: TransactionalEmail): Promise<void> {
		this.messages.push(message);
	}

	latestCollaborationToken(): string {
		const message = this.messages.at(-1);
		if (!message) throw new Error('Expected a project collaboration email.');
		const match = message.text.match(/\/collaborate\/([^\s]+)/);
		if (!match?.[1]) throw new Error('Expected a collaboration URL in the captured email.');
		return decodeURIComponent(match[1]);
	}
}

const emailDelivery = new CaptureEmailDelivery();

async function assignPermissionRole(permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Owner Role`,
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
			organisation_member_id: ownerMemberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
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
		await db
			.deleteFrom('project_external_collaborator_roles')
			.where('project_id', 'in', projectIds)
			.execute();
		await db
			.deleteFrom('project_external_collaborators')
			.where('project_id', 'in', projectIds)
			.execute();
		await db
			.deleteFrom('project_collaboration_invitation_roles')
			.where('project_id', 'in', projectIds)
			.execute();
		await db
			.deleteFrom('project_collaboration_invitations')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_organisation_roles')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	if (organisationId) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('party_organisation_contacts')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('party_role_assignments')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('party_email_addresses')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('party_persons').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('party_organisations')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('parties').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	}

	if (externalAuthUserId) {
		await db.deleteFrom('auth_sessions').where('auth_user_id', '=', externalAuthUserId).execute();
		await db.deleteFrom('auth_accounts').where('auth_user_id', '=', externalAuthUserId).execute();
		await db.deleteFrom('auth_user_links').where('auth_user_id', '=', externalAuthUserId).execute();
	}
	if (externalPlatformUserId) {
		await db.deleteFrom('user_emails').where('user_id', '=', externalPlatformUserId).execute();
		await db.deleteFrom('users').where('id', '=', externalPlatformUserId).execute();
	}
	if (externalAuthUserId)
		await db.deleteFrom('auth_users').where('id', '=', externalAuthUserId).execute();
	if (ownerUserId) await db.deleteFrom('users').where('id', '=', ownerUserId).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();

	ownerUserId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}Owner`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	ownerMemberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: ownerUserId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-25T17:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	await assignPermissionRole([
		'project.create',
		'project.view',
		'project.manage',
		'crm.view',
		'crm.manage'
	]);
	actor = {
		organisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `project-external-collaboration-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actor, {
		projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
		name: 'Person-level collaboration project'
	});
	projectId = project.id;
	projectPublicId = project.publicId;

	const crm = new CrmService(db);
	const company = await crm.createParty(actor, {
		kind: 'organisation',
		legalName: `${PREFIX}Customer Ltd`,
		roleCodes: ['client']
	});
	companyPublicId = company.publicId;
	inviteEmail = `external-${randomUUID()}@example.test`;
	const person = await crm.createOrganisationContact(actor, company.publicId, {
		givenNames: 'External',
		familyName: 'Collaborator',
		primaryEmail: inviteEmail,
		jobTitle: 'Client representative',
		isPrimaryContact: true
	});
	personPublicId = person.publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
	await authPool.end();
});

describe('person-level external project collaboration', () => {
	it('invites a private CRM person with optional CRM organisation context, never a platform organisation link', async () => {
		const service = new ProjectExternalCollaborationService(db, emailDelivery);
		const invitation = await service.invite(actor, {
			projectPublicId,
			personPartyPublicId: personPublicId,
			organisationPartyPublicId: companyPublicId,
			roleKeys: ['engineer']
		});
		invitationPublicId = invitation.publicId;
		invitationToken = emailDelivery.latestCollaborationToken();

		expect(invitation).toMatchObject({
			projectPublicId,
			personPartyPublicId: personPublicId,
			organisationPartyPublicId: companyPublicId,
			email: inviteEmail
		});
		expect(emailDelivery.messages.at(-1)?.text).toContain(
			'You do not need to create or connect a NuBlox organisation.'
		);

		const management = await service.getManagementView(actor, projectPublicId);
		expect(management.pendingInvitations).toHaveLength(1);
		expect(
			management.candidates.find((candidate) => candidate.personPartyPublicId === personPublicId)
		).toMatchObject({ organisationPartyPublicId: companyPublicId, email: inviteEmail });
	});

	it('allows only the invited email to sign up and binds the auth identity to the pending project invitation', async () => {
		const collaborationCookie = `${PROJECT_COLLABORATION_SIGNUP_COOKIE}=${invitationToken}`;
		await expect(
			auth.api.signUpEmail({
				headers: new Headers({ cookie: collaborationCookie }),
				body: {
					name: `${PREFIX}Wrong Person`,
					email: `wrong-${randomUUID()}@example.test`,
					password: PASSWORD
				}
			})
		).rejects.toBeDefined();

		await auth.api.signUpEmail({
			headers: new Headers({ cookie: collaborationCookie }),
			body: {
				name: `${PREFIX}External Collaborator`,
				email: inviteEmail,
				password: PASSWORD,
				callbackURL: 'http://localhost:5173/signin?verified=1'
			}
		});

		const authUser = await db
			.selectFrom('auth_users')
			.select(['id', 'email_verified'])
			.where('email', '=', inviteEmail)
			.executeTakeFirstOrThrow();
		externalAuthUserId = authUser.id;
		expect(authUser.email_verified).toBe(0);

		const invitation = await db
			.selectFrom('project_collaboration_invitations')
			.select(['auth_user_id', 'status'])
			.where('public_id', '=', invitationPublicId)
			.executeTakeFirstOrThrow();
		expect(invitation).toMatchObject({ auth_user_id: externalAuthUserId, status: 'pending' });
	});

	it('activates verified project access for the person without creating organisation membership', async () => {
		await db
			.updateTable('auth_users')
			.set({ email_verified: 1, updated_at: new Date() })
			.where('id', '=', externalAuthUserId)
			.executeTakeFirstOrThrow();

		const service = new ProjectExternalCollaborationService(db, emailDelivery);
		const activatedProjectPublicId = await service.activateVerifiedAuthUser({
			authUserId: externalAuthUserId,
			email: inviteEmail,
			displayName: `${PREFIX}External Collaborator`,
			correlationId: `project-external-collaboration-${randomUUID()}`
		});
		expect(activatedProjectPublicId).toBe(projectPublicId);

		const link = await db
			.selectFrom('auth_user_links')
			.select('user_id')
			.where('auth_user_id', '=', externalAuthUserId)
			.executeTakeFirstOrThrow();
		externalPlatformUserId = link.user_id;
		const memberships = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('user_id', '=', externalPlatformUserId)
			.execute();
		expect(memberships).toEqual([]);

		const participantOrganisations = await db
			.selectFrom('project_organisations')
			.select(['participant_organisation_id', 'status'])
			.where('project_id', '=', projectId)
			.execute();
		expect(participantOrganisations).toHaveLength(1);
		expect(participantOrganisations[0]).toMatchObject({
			participant_organisation_id: organisationId,
			status: 'active'
		});

		const collaborator = await db
			.selectFrom('project_external_collaborators')
			.select(['id', 'public_id', 'status', 'auth_user_id', 'crm_person_party_id'])
			.where('project_id', '=', projectId)
			.where('auth_user_id', '=', externalAuthUserId)
			.executeTakeFirstOrThrow();
		expect(collaborator.status).toBe('active');
		expect(collaborator.auth_user_id).toBe(externalAuthUserId);

		const assignedRole = await db
			.selectFrom('project_external_collaborator_roles as assigned')
			.innerJoin('project_role_types as role', 'role.id', 'assigned.project_role_type_id')
			.select('role.role_key as roleKey')
			.where('assigned.project_id', '=', projectId)
			.where('assigned.project_external_collaborator_id', '=', collaborator.id)
			.executeTakeFirstOrThrow();
		expect(assignedRole.roleKey).toBe('engineer');

		const portalProjects = await service.listExternalPortalProjects(externalAuthUserId);
		expect(portalProjects).toHaveLength(1);
		expect(portalProjects[0]).toMatchObject({
			projectPublicId,
			projectName: 'Person-level collaboration project',
			crmOrganisationName: `${PREFIX}Customer Ltd`,
			roles: ['Engineer']
		});

		const audit = await db
			.selectFrom('audit_events')
			.select(['actor_member_id', 'external_auth_user_id', 'action_key'])
			.where('project_id', '=', projectId)
			.where('action_key', '=', 'project.external_collaboration.accepted')
			.executeTakeFirstOrThrow();
		expect(audit).toMatchObject({
			actor_member_id: null,
			external_auth_user_id: externalAuthUserId,
			action_key: 'project.external_collaboration.accepted'
		});
	});

	it('revokes only the person-level project access and removes the project from their portal', async () => {
		const service = new ProjectExternalCollaborationService(db, emailDelivery);
		const collaborator = await db
			.selectFrom('project_external_collaborators')
			.select('public_id')
			.where('project_id', '=', projectId)
			.where('auth_user_id', '=', externalAuthUserId)
			.where('status', '=', 'active')
			.executeTakeFirstOrThrow();
		await service.removeCollaborator(actor, projectPublicId, collaborator.public_id);
		expect(await service.listExternalPortalProjects(externalAuthUserId)).toEqual([]);

		const membershipCount = await db
			.selectFrom('organisation_members')
			.select((eb) => eb.fn.countAll<number>().as('count'))
			.where('user_id', '=', externalPlatformUserId)
			.executeTakeFirstOrThrow();
		expect(Number(membershipCount.count)).toBe(0);
	});
});
