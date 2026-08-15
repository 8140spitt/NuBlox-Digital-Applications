import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { Database } from '$lib/server/db/database';
import type { Actor } from '$lib/types/request-context';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import {
	OrganisationInvitationRepository,
	type PendingOrganisationInvitation
} from './invitation-repository';
import { decideOrganisationRoleDelegation } from './role-delegation-policy';

const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export class InvitationAccessError extends Error {
	readonly code = 'INVITATION_ACCESS_DENIED';
	constructor(message = 'The invitation is invalid, expired or cannot be accepted.') {
		super(message);
		this.name = 'InvitationAccessError';
	}
}

export class InvitationRoleError extends Error {
	readonly code = 'INVITATION_ROLE_INVALID';
	constructor(message = 'One or more selected roles are not active roles in this organisation.') {
		super(message);
		this.name = 'InvitationRoleError';
	}
}

export type InvitationSummary = {
	publicId: string;
	organisationPublicId: string;
	organisationName: string;
	email: string;
	expiresAt: Date;
};

export type AcceptedInvitation = {
	organisationId: string;
	organisationPublicId: string;
	memberId: string;
	userId: string;
};

export function normaliseInvitationEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

function applicationBaseUrl(): string {
	const value = env.BETTER_AUTH_URL?.trim();
	if (!value) throw new Error('BETTER_AUTH_URL is required to build invitation links.');
	return value;
}

export class OrganisationInvitationService {
	constructor(
		private readonly db: Database,
		private readonly emailDelivery: EmailDelivery = getEmailDelivery()
	) {}

	async getPendingInvitation(rawToken: string): Promise<InvitationSummary | null> {
		const invitation = await new OrganisationInvitationRepository(this.db).findPendingByTokenHash(
			hashInvitationToken(rawToken)
		);
		return invitation ? this.toSummary(invitation) : null;
	}

	async createInvitation(input: {
		actor: TenantActorContext;
		email: string;
		rolePublicIds: readonly string[];
	}): Promise<InvitationSummary> {
		const email = normaliseInvitationEmail(input.email);
		if (!email || email.length > 320 || !email.includes('@')) {
			throw new InvitationAccessError('A valid email address is required.');
		}

		const rolePublicIds = [...new Set(input.rolePublicIds.map((role) => role.trim()).filter(Boolean))];
		const token = randomBytes(32).toString('base64url');
		const tokenHash = hashInvitationToken(token);
		const publicId = randomUUID();
		const expiresAt = new Date(Date.now() + INVITATION_LIFETIME_MS);

		const summary = await this.db.transaction().execute(async (trx) => {
			const invitations = new OrganisationInvitationRepository(trx);
			const roleIds = await invitations.findActiveRoleIdsByPublicIds(
				input.actor.organisationId,
				rolePublicIds
			);
			if (roleIds.length !== rolePublicIds.length) throw new InvitationRoleError();

			const delegation = await decideOrganisationRoleDelegation(trx, input.actor, rolePublicIds);
			if (!delegation.allowed) {
				throw new InvitationRoleError(
					`You cannot delegate role permissions you do not hold: ${delegation.deniedPermissionKeys.join(', ')}.`
				);
			}
			if (await invitations.hasActiveMemberByEmail(input.actor.organisationId, email)) {
				throw new InvitationAccessError('This email already belongs to an active member of the organisation.');
			}

			await invitations.revokePendingForEmail(input.actor.organisationId, email);
			const invitationId = await invitations.insertInvitation({
				publicId,
				organisationId: input.actor.organisationId,
				email,
				tokenHash,
				invitedByMemberId: input.actor.memberId,
				expiresAt
			});
			await invitations.insertRoles(input.actor.organisationId, invitationId, roleIds);

			const organisation = await trx
				.selectFrom('organisations')
				.select(['public_id', 'legal_name'])
				.where('id', '=', input.actor.organisationId)
				.where('status', '=', 'active')
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: input.actor.organisationId,
				actorUserId: input.actor.userId,
				actorMemberId: input.actor.memberId,
				actionKey: 'organisation.invitation.create',
				subjectType: 'organisation_invitation',
				subjectPublicId: publicId,
				correlationId: input.actor.correlationId,
				changeSummary: { email, roleCount: roleIds.length, expiresAt: expiresAt.toISOString() }
			});

			return {
				publicId,
				organisationPublicId: organisation.public_id,
				organisationName: organisation.legal_name,
				email,
				expiresAt
			};
		});

		const inviteUrl = new URL(`/invite/${encodeURIComponent(token)}`, applicationBaseUrl()).toString();
		await this.emailDelivery.send({
			to: email,
			subject: `You're invited to ${summary.organisationName} on NuBlox`,
			text: `You have been invited to join ${summary.organisationName} on NuBlox.\n\nAccept your invitation: ${inviteUrl}\n\nThis invitation expires on ${expiresAt.toISOString()}.`
		});

		return summary;
	}

	async validateSignup(rawToken: string, email: string): Promise<PendingOrganisationInvitation> {
		const invitation = await new OrganisationInvitationRepository(this.db).findPendingByTokenHash(
			hashInvitationToken(rawToken)
		);
		if (!invitation || normaliseInvitationEmail(invitation.email) !== normaliseInvitationEmail(email)) {
			throw new InvitationAccessError();
		}
		return invitation;
	}

	async bindSignupAuthUser(rawToken: string, email: string, authUserId: string): Promise<void> {
		const invitation = await this.validateSignup(rawToken, email);
		if (invitation.authUserId && invitation.authUserId !== authUserId) throw new InvitationAccessError();
		await new OrganisationInvitationRepository(this.db).bindAuthUser(invitation.id, authUserId);
	}

	async acceptExistingUser(
		rawToken: string,
		actor: Actor,
		correlationId: string
	): Promise<AcceptedInvitation> {
		if (normaliseInvitationEmail(actor.email) === '') throw new InvitationAccessError();
		return this.finaliseInvitation({
			lookup: { tokenHash: hashInvitationToken(rawToken) },
			authUserId: actor.authUserId,
			email: actor.email,
			displayName: actor.displayName,
			correlationId
		});
	}

	async activateVerifiedAuthUser(input: {
		authUserId: string;
		email: string;
		displayName: string;
		correlationId?: string;
	}): Promise<AcceptedInvitation | null> {
		const invitation = await new OrganisationInvitationRepository(this.db).findPendingByAuthUser(
			input.authUserId,
			normaliseInvitationEmail(input.email)
		);
		if (!invitation) return null;

		return this.finaliseInvitation({
			lookup: { authUserId: input.authUserId },
			authUserId: input.authUserId,
			email: input.email,
			displayName: input.displayName,
			correlationId: input.correlationId ?? randomUUID()
		});
	}

	private async finaliseInvitation(input: {
		lookup: { tokenHash: string } | { authUserId: string };
		authUserId: string;
		email: string;
		displayName: string;
		correlationId: string;
	}): Promise<AcceptedInvitation> {
		const email = normaliseInvitationEmail(input.email);
		return this.db.transaction().execute(async (trx) => {
			const invitations = new OrganisationInvitationRepository(trx);
			const invitation =
				'tokenHash' in input.lookup
					? await invitations.findPendingByTokenHash(input.lookup.tokenHash, new Date(), true)
					: await invitations.findPendingByAuthUser(input.lookup.authUserId, email, new Date(), true);

			if (!invitation || normaliseInvitationEmail(invitation.email) !== email) {
				throw new InvitationAccessError();
			}
			if (invitation.authUserId && invitation.authUserId !== input.authUserId) {
				throw new InvitationAccessError();
			}

			if (!invitation.authUserId) {
				await invitations.bindAuthUser(invitation.id, input.authUserId);
			}

			const existingEmailOwner = await trx
				.selectFrom('user_emails')
				.select('user_id')
				.where('email', '=', email)
				.executeTakeFirst();

			const existingLink = await trx
				.selectFrom('auth_user_links')
				.select('user_id')
				.where('auth_user_id', '=', input.authUserId)
				.executeTakeFirst();

			let userId = existingLink?.user_id ?? null;
			if (existingEmailOwner && userId && existingEmailOwner.user_id !== userId) {
				throw new InvitationAccessError('The verified email is already linked to another NuBlox user.');
			}
			if (existingEmailOwner && !userId) {
				throw new InvitationAccessError('The verified email already belongs to another NuBlox identity.');
			}

			if (!userId) {
				const userInsert = await trx
					.insertInto('users')
					.values({
						public_id: randomUUID(),
						display_name: input.displayName.trim() || email,
						status: 'active'
					})
					.executeTakeFirstOrThrow();
				if (userInsert.insertId === undefined) throw new Error('User insert did not return an ID.');
				userId = userInsert.insertId.toString();

				await trx
					.insertInto('user_emails')
					.values({
						user_id: userId,
						email,
						is_primary: 1,
						is_verified: 1,
						verified_at: new Date()
					})
					.executeTakeFirstOrThrow();

				await trx
					.insertInto('auth_user_links')
					.values({ auth_user_id: input.authUserId, user_id: userId })
					.executeTakeFirstOrThrow();
			} else if (!existingEmailOwner) {
				const primaryEmail = await trx
					.selectFrom('user_emails')
					.select('id')
					.where('user_id', '=', userId)
					.where('is_primary', '=', 1)
					.executeTakeFirst();
				await trx
					.insertInto('user_emails')
					.values({
						user_id: userId,
						email,
						is_primary: primaryEmail ? 0 : 1,
						is_verified: 1,
						verified_at: new Date()
					})
					.executeTakeFirstOrThrow();
			}

			const currentUser = await trx
				.selectFrom('users')
				.select('status')
				.where('id', '=', userId)
				.executeTakeFirstOrThrow();
			if (currentUser.status !== 'active') throw new InvitationAccessError('The NuBlox user is not active.');

			const existingMembership = await trx
				.selectFrom('organisation_members')
				.select(['id', 'status'])
				.where('organisation_id', '=', invitation.organisationId)
				.where('user_id', '=', userId)
				.executeTakeFirst();

			let memberId: string;
			if (!existingMembership) {
				const memberInsert = await trx
					.insertInto('organisation_members')
					.values({
						organisation_id: invitation.organisationId,
						user_id: userId,
						public_id: randomUUID(),
						status: 'active',
						joined_at: new Date()
					})
					.executeTakeFirstOrThrow();
				if (memberInsert.insertId === undefined) throw new Error('Membership insert did not return an ID.');
				memberId = memberInsert.insertId.toString();
			} else {
				memberId = existingMembership.id;
				if (existingMembership.status === 'invited') {
					await trx
						.updateTable('organisation_members')
						.set({ status: 'active', joined_at: new Date(), disabled_at: null })
						.where('id', '=', memberId)
						.where('organisation_id', '=', invitation.organisationId)
						.executeTakeFirstOrThrow();
				} else if (existingMembership.status !== 'active') {
					throw new InvitationAccessError('This membership cannot be reactivated by invitation.');
				}
			}

			const roleIds = await invitations.listRoleIds(invitation.id, invitation.organisationId);
			if (roleIds.length > 0) {
				await trx
					.insertInto('member_roles')
					.ignore()
					.values(
						roleIds.map((roleId) => ({
							organisation_id: invitation.organisationId,
							organisation_member_id: memberId,
							organisation_role_id: roleId
						}))
					)
					.execute();
			}

			const acceptedAt = new Date();
			await trx
				.updateTable('organisation_invitations')
				.set({
					status: 'accepted',
					auth_user_id: input.authUserId,
					accepted_user_id: userId,
					accepted_at: acceptedAt
				})
				.where('id', '=', invitation.id)
				.where('status', '=', 'pending')
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: invitation.organisationId,
				actorUserId: userId,
				actorMemberId: memberId,
				actionKey: 'organisation.invitation.accept',
				subjectType: 'organisation_invitation',
				subjectPublicId: invitation.publicId,
				correlationId: input.correlationId,
				changeSummary: { email, roleCount: roleIds.length }
			});

			return {
				organisationId: invitation.organisationId,
				organisationPublicId: invitation.organisationPublicId,
				memberId,
				userId
			};
		});
	}

	private toSummary(invitation: PendingOrganisationInvitation): InvitationSummary {
		return {
			publicId: invitation.publicId,
			organisationPublicId: invitation.organisationPublicId,
			organisationName: invitation.organisationName,
			email: invitation.email,
			expiresAt: invitation.expiresAt
		};
	}
}
