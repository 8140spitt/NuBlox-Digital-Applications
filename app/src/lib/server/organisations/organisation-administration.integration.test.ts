import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import { OrganisationInvitationService } from './invitation-service';
import { OrganisationAdminRepository } from './organisation-admin-repository';
import {
	LastOrganisationManagerError,
	OrganisationAdminService,
	OrganisationAdminValidationError
} from './organisation-admin-service';

const PREFIX = 'Organisation Admin Integration ';

let db: Database;
let organisationId: string;
let organisationPublicId: string;
let otherOrganisationId: string;
let actorUserId: string;
let actorMemberId: string;
let actorMemberPublicId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let backupUserId: string;
let backupMemberId: string;
let otherUserId: string;
let otherMemberId: string;
let adminRoleId: string;
let adminRolePublicId: string;
let memberRoleId: string;
let memberRolePublicId: string;
let otherRolePublicId: string;
let organisationManagePermissionId: string;
let memberManagePermissionId: string;
let memberInvitePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

class CaptureEmailDelivery implements EmailDelivery {
	readonly messages: TransactionalEmail[] = [];
	async send(message: TransactionalEmail): Promise<void> {
		this.messages.push(message);
	}
}

const emailDelivery = new CaptureEmailDelivery();

function actor() {
	return {
		organisationId,
		userId: actorUserId,
		memberId: actorMemberId,
		correlationId: `organisation-admin-it-${randomUUID()}`
	};
}

async function createUser(name: string): Promise<{ userId: string; email: string }> {
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	const email = `${name.toLowerCase().replaceAll(' ', '-')}-${randomUUID()}@example.test`;
	await db
		.insertInto('user_emails')
		.values({ user_id: userId, email, is_primary: 1, is_verified: 1, verified_at: new Date() })
		.executeTakeFirstOrThrow();
	return { userId, email };
}

async function createMember(
	orgId: string,
	userId: string
): Promise<{ memberId: string; publicId: string }> {
	const publicId = randomUUID();
	const memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: orgId,
				user_id: userId,
				public_id: publicId,
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	return { memberId, publicId };
}

async function permissionId(permissionKey: string): Promise<string> {
	return (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', permissionKey)
			.executeTakeFirstOrThrow()
	).id;
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisationIds = [organisationId, otherOrganisationId].filter(Boolean);
	if (organisationIds.length > 0) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_invitation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_invitations')
			.where('organisation_id', 'in', organisationIds)
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
	}

	const userIds = [actorUserId, targetUserId, backupUserId, otherUserId].filter(Boolean);
	if (userIds.length > 0) {
		await db.deleteFrom('user_emails').where('user_id', 'in', userIds).execute();
	}
	if (organisationIds.length > 0) {
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	organisationManagePermissionId = await permissionId('organisation.manage');
	memberManagePermissionId = await permissionId('member.manage');
	memberInvitePermissionId = await permissionId('member.invite');

	organisationPublicId = randomUUID();
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
				legal_name: `${PREFIX}Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	otherOrganisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Other Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	actorUserId = (await createUser('Actor')).userId;
	targetUserId = (await createUser('Target')).userId;
	backupUserId = (await createUser('Backup')).userId;
	otherUserId = (await createUser('Other Tenant')).userId;

	({ memberId: actorMemberId, publicId: actorMemberPublicId } = await createMember(
		organisationId,
		actorUserId
	));
	({ memberId: targetMemberId, publicId: targetMemberPublicId } = await createMember(
		organisationId,
		targetUserId
	));
	({ memberId: backupMemberId } = await createMember(organisationId, backupUserId));
	({ memberId: otherMemberId } = await createMember(otherOrganisationId, otherUserId));

	adminRolePublicId = randomUUID();
	adminRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: adminRolePublicId,
				name: `${PREFIX}Administrator`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	memberRolePublicId = randomUUID();
	memberRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: memberRolePublicId,
				name: `${PREFIX}Member`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	otherRolePublicId = randomUUID();
	const otherRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: otherOrganisationId,
				public_id: otherRolePublicId,
				name: `${PREFIX}Other Role`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: adminRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: adminRoleId,
				permission_id: memberManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: adminRoleId,
				permission_id: memberInvitePermissionId
			}
		])
		.execute();

	await db
		.insertInto('member_roles')
		.values([
			{
				organisation_id: organisationId,
				organisation_member_id: actorMemberId,
				organisation_role_id: adminRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: targetMemberId,
				organisation_role_id: memberRoleId
			},
			{
				organisation_id: otherOrganisationId,
				organisation_member_id: otherMemberId,
				organisation_role_id: otherRoleId
			}
		])
		.execute();
}

describe('organisation administration', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('lists only the selected organisation members and roles', async () => {
		const administration = await new OrganisationAdminService(db).load(actor());
		expect(administration.members.map((member) => member.publicId)).toEqual(
			expect.arrayContaining([actorMemberPublicId, targetMemberPublicId])
		);
		expect(administration.members).toHaveLength(3);
		expect(administration.roles.map((role) => role.publicId)).not.toContain(otherRolePublicId);
		expect(administration.permissions.map((permission) => permission.key)).toEqual(
			expect.arrayContaining(['organisation.manage', 'member.manage', 'member.invite'])
		);
	});

	it('blocks self status changes and changes another member status with audit evidence', async () => {
		const service = new OrganisationAdminService(db);
		await expect(
			service.setMemberStatus(actor(), actorMemberPublicId, 'suspended')
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		await service.setMemberStatus(actor(), targetMemberPublicId, 'suspended');
		const suspended = await db
			.selectFrom('organisation_members')
			.select(['status', 'disabled_at'])
			.where('id', '=', targetMemberId)
			.executeTakeFirstOrThrow();
		expect(suspended.status).toBe('suspended');
		expect(suspended.disabled_at).not.toBeNull();

		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('subject_public_id', '=', targetMemberPublicId)
			.where('action_key', '=', 'organisation.member.status.change')
			.executeTakeFirst();
		expect(audit?.action_key).toBe('organisation.member.status.change');

		await service.setMemberStatus(actor(), targetMemberPublicId, 'active');
	});

	it('replaces member roles tenant-safely and rejects a role from another organisation', async () => {
		const service = new OrganisationAdminService(db);
		await expect(
			service.replaceMemberRoles(actor(), targetMemberPublicId, [otherRolePublicId])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		await service.replaceMemberRoles(actor(), targetMemberPublicId, [memberRolePublicId]);
		const roles = await new OrganisationAdminRepository(db).listMembers(organisationId);
		const target = roles.find((member) => member.publicId === targetMemberPublicId);
		expect(target?.roles.map((role) => role.publicId)).toEqual([memberRolePublicId]);
	});

	it('prevents removal of the final organisation manager and allows it once another manager exists', async () => {
		const service = new OrganisationAdminService(db);
		await expect(
			service.updateRole(actor(), {
				rolePublicId: adminRolePublicId,
				name: `${PREFIX}Administrator`,
				isActive: true,
				permissionKeys: ['member.manage', 'member.invite']
			})
		).rejects.toBeInstanceOf(LastOrganisationManagerError);

		const retainedGrant = await db
			.selectFrom('role_permissions')
			.select('permission_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_role_id', '=', adminRoleId)
			.where('permission_id', '=', organisationManagePermissionId)
			.executeTakeFirst();
		expect(retainedGrant).toBeDefined();

		const backupRolePublicId = await service.createRole(actor(), {
			name: `${PREFIX}Backup Administrator`,
			permissionKeys: ['organisation.manage']
		});
		await service.replaceMemberRoles(
			actor(),
			(
				await db
					.selectFrom('organisation_members')
					.select('public_id')
					.where('id', '=', backupMemberId)
					.executeTakeFirstOrThrow()
			).public_id,
			[backupRolePublicId]
		);

		await service.updateRole(actor(), {
			rolePublicId: adminRolePublicId,
			name: `${PREFIX}Administrator`,
			isActive: true,
			permissionKeys: ['member.manage', 'member.invite']
		});
		const removedGrant = await db
			.selectFrom('role_permissions')
			.select('permission_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_role_id', '=', adminRoleId)
			.where('permission_id', '=', organisationManagePermissionId)
			.executeTakeFirst();
		expect(removedGrant).toBeUndefined();

		await service.updateRole(actor(), {
			rolePublicId: adminRolePublicId,
			name: `${PREFIX}Administrator`,
			isActive: true,
			permissionKeys: ['organisation.manage', 'member.manage', 'member.invite']
		});
	});

	it('resends and revokes invitations while preserving tenant role intent and audit evidence', async () => {
		const inviteEmail = `admin-resend-${randomUUID()}@example.test`;
		const original = await new OrganisationInvitationService(db, emailDelivery).createInvitation({
			actor: actor(),
			email: inviteEmail,
			rolePublicIds: [memberRolePublicId]
		});

		const replacement = await new OrganisationAdminService(db).resendInvitation(
			actor(),
			original.publicId,
			emailDelivery
		);
		expect(replacement.publicId).not.toBe(original.publicId);
		const originalRow = await db
			.selectFrom('organisation_invitations')
			.select('status')
			.where('public_id', '=', original.publicId)
			.executeTakeFirstOrThrow();
		expect(originalRow.status).toBe('revoked');

		const replacementRole = await db
			.selectFrom('organisation_invitations as invitation')
			.innerJoin(
				'organisation_invitation_roles as assignment',
				'assignment.organisation_invitation_id',
				'invitation.id'
			)
			.innerJoin('organisation_roles as role', 'role.id', 'assignment.organisation_role_id')
			.select('role.public_id as publicId')
			.where('invitation.public_id', '=', replacement.publicId)
			.executeTakeFirstOrThrow();
		expect(replacementRole.publicId).toBe(memberRolePublicId);

		await new OrganisationAdminService(db).revokeInvitation(actor(), replacement.publicId);
		const replacementRow = await db
			.selectFrom('organisation_invitations')
			.select('status')
			.where('public_id', '=', replacement.publicId)
			.executeTakeFirstOrThrow();
		expect(replacementRow.status).toBe('revoked');

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', 'in', [
				'organisation.invitation.resend',
				'organisation.invitation.revoke'
			])
			.execute();
		expect(auditActions.map((event) => event.action_key)).toEqual(
			expect.arrayContaining(['organisation.invitation.resend', 'organisation.invitation.revoke'])
		);
	});
});
