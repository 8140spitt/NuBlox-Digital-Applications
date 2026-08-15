import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { auth, authPool } from '$lib/server/auth/better-auth';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import {
	hashInvitationToken,
	OrganisationInvitationService
} from './invitation-service';

const PREFIX = 'Provisioning Integration ';
const PASSWORD = 'NuBlox-Provisioning-Test-2026!';

let db: Database;
let inviterUserId: string;
let organisationId: string;
let organisationPublicId: string;
let inviterMemberId: string;
let roleId: string;
let rolePublicId: string;
let inviteEmail: string;
let activeInvitationPublicId: string;
let activeToken: string;
let invitedAuthUserId: string;
let invitedPlatformUserId: string;
let invitedMemberId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

class CaptureEmailDelivery implements EmailDelivery {
	readonly messages: TransactionalEmail[] = [];

	async send(message: TransactionalEmail): Promise<void> {
		this.messages.push(message);
	}

	latestInvitationToken(): string {
		const message = this.messages.at(-1);
		if (!message) throw new Error('Expected an invitation email.');
		const match = message.text.match(/\/invite\/([^\s]+)/);
		if (!match?.[1]) throw new Error('Expected an invitation URL in the captured email.');
		return decodeURIComponent(match[1]);
	}
}

const emailDelivery = new CaptureEmailDelivery();

async function cleanup(): Promise<void> {
	if (!db) return;

	if (organisationId) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', 'in', ['organisation.invitation.create', 'organisation.invitation.accept'])
			.execute();
	}

	if (invitedMemberId && roleId && organisationId) {
		await db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', invitedMemberId)
			.where('organisation_role_id', '=', roleId)
			.execute();
	}

	if (organisationId) {
		await db
			.deleteFrom('organisation_invitation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_invitations')
			.where('organisation_id', '=', organisationId)
			.execute();
	}

	if (invitedAuthUserId) {
		await db.deleteFrom('auth_sessions').where('auth_user_id', '=', invitedAuthUserId).execute();
		await db.deleteFrom('auth_accounts').where('auth_user_id', '=', invitedAuthUserId).execute();
		await db.deleteFrom('auth_user_links').where('auth_user_id', '=', invitedAuthUserId).execute();
	}

	if (invitedPlatformUserId) {
		await db.deleteFrom('user_emails').where('user_id', '=', invitedPlatformUserId).execute();
		if (invitedMemberId) {
			await db.deleteFrom('organisation_members').where('id', '=', invitedMemberId).execute();
		}
		await db.deleteFrom('users').where('id', '=', invitedPlatformUserId).execute();
	}

	if (invitedAuthUserId) await db.deleteFrom('auth_users').where('id', '=', invitedAuthUserId).execute();
	if (roleId) await db.deleteFrom('organisation_roles').where('id', '=', roleId).execute();
	if (inviterMemberId) await db.deleteFrom('organisation_members').where('id', '=', inviterMemberId).execute();
	if (organisationId) await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	if (inviterUserId) await db.deleteFrom('users').where('id', '=', inviterUserId).execute();
}

async function createFixture(): Promise<void> {
	inviterUserId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}Inviter`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

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

	inviterMemberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: inviterUserId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);

	rolePublicId = randomUUID();
	roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: rolePublicId,
				name: `${PREFIX}Member Role`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

	inviteEmail = `invite-${randomUUID()}@example.test`;
}

function inviteActor() {
	return {
		organisationId,
		userId: inviterUserId,
		memberId: inviterMemberId,
		correlationId: `provisioning-it-${randomUUID()}`
	};
}

async function createCapturedInvitation(): Promise<void> {
	const invitation = await new OrganisationInvitationService(db, emailDelivery).createInvitation({
		actor: inviteActor(),
		email: inviteEmail,
		rolePublicIds: [rolePublicId]
	});
	activeInvitationPublicId = invitation.publicId;
	activeToken = emailDelivery.latestInvitationToken();
}

describe('account provisioning and invitation lifecycle', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
		await authPool.end();
	});

	it('stores only an invitation token hash and revokes an earlier pending invitation on re-invite', async () => {
		await createCapturedInvitation();
		const firstPublicId = activeInvitationPublicId;
		const firstToken = activeToken;

		const first = await db
			.selectFrom('organisation_invitations')
			.select(['token_hash', 'status'])
			.where('public_id', '=', firstPublicId)
			.executeTakeFirstOrThrow();
		expect(first.token_hash).toBe(hashInvitationToken(firstToken));
		expect(first.token_hash).not.toBe(firstToken);
		expect(first.status).toBe('pending');

		await createCapturedInvitation();
		const oldInvitation = await db
			.selectFrom('organisation_invitations')
			.select(['status', 'revoked_at'])
			.where('public_id', '=', firstPublicId)
			.executeTakeFirstOrThrow();
		expect(oldInvitation.status).toBe('revoked');
		expect(oldInvitation.revoked_at).not.toBeNull();
	});

	it('rejects arbitrary or mismatched Better Auth email sign-up and accepts the matching invited email', async () => {
		await expect(
			auth.api.signUpEmail({
				body: {
					name: `${PREFIX}No Invite`,
					email: `no-invite-${randomUUID()}@example.test`,
					password: PASSWORD
				}
			})
		).rejects.toBeDefined();

		const invitationCookie = `${INVITATION_SIGNUP_COOKIE}=${activeToken}`;
		await expect(
			auth.api.signUpEmail({
				headers: new Headers({ cookie: invitationCookie }),
				body: {
					name: `${PREFIX}Wrong Email`,
					email: `wrong-${randomUUID()}@example.test`,
					password: PASSWORD
				}
			})
		).rejects.toBeDefined();

		await auth.api.signUpEmail({
			headers: new Headers({ cookie: invitationCookie }),
			body: {
				name: `${PREFIX}Invited User`,
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
		invitedAuthUserId = authUser.id;
		expect(authUser.email_verified).toBe(0);

		const invitation = await db
			.selectFrom('organisation_invitations')
			.select(['auth_user_id', 'status'])
			.where('public_id', '=', activeInvitationPublicId)
			.executeTakeFirstOrThrow();
		expect(invitation.auth_user_id).toBe(invitedAuthUserId);
		expect(invitation.status).toBe('pending');
	});

	it('activates the verified auth identity into one linked NuBlox user, membership and intended role', async () => {
		await db
			.updateTable('auth_users')
			.set({ email_verified: 1, updated_at: new Date() })
			.where('id', '=', invitedAuthUserId)
			.executeTakeFirstOrThrow();

		const accepted = await new OrganisationInvitationService(db, emailDelivery).activateVerifiedAuthUser({
			authUserId: invitedAuthUserId,
			email: inviteEmail,
			displayName: `${PREFIX}Invited User`,
			correlationId: `provisioning-it-${randomUUID()}`
		});
		expect(accepted).not.toBeNull();
		expect(accepted?.organisationPublicId).toBe(organisationPublicId);
		invitedPlatformUserId = accepted!.userId;
		invitedMemberId = accepted!.memberId;

		const link = await db
			.selectFrom('auth_user_links')
			.select('user_id')
			.where('auth_user_id', '=', invitedAuthUserId)
			.executeTakeFirstOrThrow();
		expect(link.user_id).toBe(invitedPlatformUserId);

		const verifiedEmail = await db
			.selectFrom('user_emails')
			.select(['email', 'is_primary', 'is_verified'])
			.where('user_id', '=', invitedPlatformUserId)
			.where('email', '=', inviteEmail)
			.executeTakeFirstOrThrow();
		expect(verifiedEmail).toMatchObject({ email: inviteEmail, is_primary: 1, is_verified: 1 });

		const membership = await db
			.selectFrom('organisation_members')
			.select('status')
			.where('id', '=', invitedMemberId)
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(membership.status).toBe('active');

		const memberRole = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', invitedMemberId)
			.where('organisation_role_id', '=', roleId)
			.executeTakeFirst();
		expect(memberRole?.organisation_role_id).toBe(roleId);

		const invitation = await db
			.selectFrom('organisation_invitations')
			.select(['status', 'accepted_user_id', 'accepted_at'])
			.where('public_id', '=', activeInvitationPublicId)
			.executeTakeFirstOrThrow();
		expect(invitation.status).toBe('accepted');
		expect(invitation.accepted_user_id).toBe(invitedPlatformUserId);
		expect(invitation.accepted_at).not.toBeNull();

		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('subject_public_id', '=', activeInvitationPublicId)
			.where('action_key', '=', 'organisation.invitation.accept')
			.executeTakeFirst();
		expect(audit?.action_key).toBe('organisation.invitation.accept');
	});
});
