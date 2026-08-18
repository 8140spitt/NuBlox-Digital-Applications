import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import { InvitationRoleError, OrganisationInvitationService } from './invitation-service';
import {
	OrganisationAdminValidationError,
	OrganisationAdminService
} from './organisation-admin-service';

const PREFIX = 'Role Delegation Integration ';

let db: Database;
let organisationId: string;
let actorUserId: string;
let actorMemberId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let administratorRoleId: string;
let administratorRolePublicId: string;
let delegableRoleId: string;
let delegableRolePublicId: string;
let memberManagePermissionId: string;
let memberInvitePermissionId: string;
let organisationManagePermissionId: string;

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
		correlationId: `role-delegation-it-${randomUUID()}`
	};
}

async function permissionId(key: string): Promise<string> {
	return (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', key)
			.executeTakeFirstOrThrow()
	).id;
}

async function createUser(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_invitation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_invitations')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
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
	const userIds = [actorUserId, targetUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	memberManagePermissionId = await permissionId('member.manage');
	memberInvitePermissionId = await permissionId('member.invite');
	organisationManagePermissionId = await permissionId('organisation.manage');

	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	actorUserId = await createUser('Actor');
	targetUserId = await createUser('Target');
	actorMemberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: actorUserId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	targetMemberPublicId = randomUUID();
	targetMemberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: targetUserId,
				public_id: targetMemberPublicId,
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);

	const actorRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Member Manager`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	delegableRolePublicId = randomUUID();
	delegableRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: delegableRolePublicId,
				name: `${PREFIX}Delegable`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	administratorRolePublicId = randomUUID();
	administratorRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: administratorRolePublicId,
				name: `${PREFIX}Administrator`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: actorRoleId,
				permission_id: memberManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: actorRoleId,
				permission_id: memberInvitePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: delegableRoleId,
				permission_id: memberInvitePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: administratorRoleId,
				permission_id: organisationManagePermissionId
			}
		])
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: actorMemberId,
			organisation_role_id: actorRoleId
		})
		.executeTakeFirstOrThrow();
}

describe('organisation role delegation ceiling', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('allows member managers to assign only roles whose permissions they hold', async () => {
		const service = new OrganisationAdminService(db);
		await service.replaceMemberRoles(actor(), targetMemberPublicId, [delegableRolePublicId]);
		const assigned = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(assigned.map((row) => row.organisation_role_id)).toEqual([delegableRoleId]);

		await expect(
			service.replaceMemberRoles(actor(), targetMemberPublicId, [administratorRolePublicId])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);
		const stillAssigned = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(stillAssigned.map((row) => row.organisation_role_id)).toEqual([delegableRoleId]);
	});

	it('applies the same delegation ceiling when roles are attached to invitations', async () => {
		const service = new OrganisationInvitationService(db, emailDelivery);
		const deniedEmail = `denied-${randomUUID()}@example.test`;
		await expect(
			service.createInvitation({
				actor: actor(),
				email: deniedEmail,
				rolePublicIds: [administratorRolePublicId]
			})
		).rejects.toBeInstanceOf(InvitationRoleError);
		const deniedInvitation = await db
			.selectFrom('organisation_invitations')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('email', '=', deniedEmail)
			.executeTakeFirst();
		expect(deniedInvitation).toBeUndefined();

		const allowedEmail = `allowed-${randomUUID()}@example.test`;
		const invitation = await service.createInvitation({
			actor: actor(),
			email: allowedEmail,
			rolePublicIds: [delegableRolePublicId]
		});
		expect(invitation.email).toBe(allowedEmail);
		expect(emailDelivery.messages.at(-1)?.to).toBe(allowedEmail);
	});

	it('prevents a lower-level member administrator from changing an organisation manager', async () => {
		await db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		await db
			.insertInto('member_roles')
			.values({
				organisation_id: organisationId,
				organisation_member_id: targetMemberId,
				organisation_role_id: administratorRoleId
			})
			.executeTakeFirstOrThrow();

		const service = new OrganisationAdminService(db);
		await expect(
			service.setMemberStatus(actor(), targetMemberPublicId, 'suspended')
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);
		await expect(
			service.replaceMemberRoles(actor(), targetMemberPublicId, [delegableRolePublicId])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		const member = await db
			.selectFrom('organisation_members')
			.select('status')
			.where('id', '=', targetMemberId)
			.executeTakeFirstOrThrow();
		expect(member.status).toBe('active');
		const role = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.executeTakeFirstOrThrow();
		expect(role.organisation_role_id).toBe(administratorRoleId);
	});
});
