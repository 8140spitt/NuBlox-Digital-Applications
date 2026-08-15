import { randomUUID } from 'node:crypto';

import type { Database } from '$lib/server/db/database';

export type VerifiedIdentityRecoveryResult =
	| { recovered: true; userId: string; outcome: 'linked-existing' | 'activated-pending' | 'created' }
	| { recovered: false; reason: string };

function normaliseEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Rebuild the NuBlox platform-side identity for a Better Auth user whose email
 * has already been verified. Organisation provisioning is deliberately not
 * invented here: if no membership survives, the user lands on
 * /select-organisation and can create an organisation through the normal flow.
 *
 * This recovery is intentionally conservative:
 * - email is the globally unique ownership key in user_emails;
 * - suspended/disabled domain users are never reactivated;
 * - an email/user already linked to another auth identity is never reassigned.
 */
export async function recoverVerifiedPlatformIdentity(
	db: Database,
	input: { authUserId: string; email: string; displayName: string }
): Promise<VerifiedIdentityRecoveryResult> {
	const email = normaliseEmail(input.email);
	if (!email) return { recovered: false, reason: 'Verified auth identity has no email.' };

	return db.transaction().execute(async (trx) => {
		const existingAuthLink = await trx
			.selectFrom('auth_user_links')
			.select('user_id')
			.where('auth_user_id', '=', input.authUserId)
			.executeTakeFirst();

		if (existingAuthLink) {
			const user = await trx
				.selectFrom('users')
				.select('status')
				.where('id', '=', existingAuthLink.user_id)
				.forUpdate()
				.executeTakeFirst();
			const domainEmail = await trx
				.selectFrom('user_emails')
				.select(['id', 'is_verified'])
				.where('user_id', '=', existingAuthLink.user_id)
				.where('email', '=', email)
				.forUpdate()
				.executeTakeFirst();

			if (!user || !domainEmail) {
				return {
					recovered: false,
					reason: 'Auth link exists but its NuBlox user/email record is incomplete.'
				};
			}
			if (user.status === 'suspended' || user.status === 'disabled') {
				return { recovered: false, reason: `NuBlox user is ${user.status}.` };
			}

			const now = new Date();
			if (user.status === 'pending') {
				await trx
					.updateTable('users')
					.set({ status: 'active' })
					.where('id', '=', existingAuthLink.user_id)
					.where('status', '=', 'pending')
					.executeTakeFirstOrThrow();
			}
			if (!domainEmail.is_verified) {
				await trx
					.updateTable('user_emails')
					.set({ is_verified: 1, verified_at: now })
					.where('id', '=', domainEmail.id)
					.executeTakeFirstOrThrow();
			}

			return {
				recovered: true,
				userId: existingAuthLink.user_id,
				outcome: user.status === 'pending' ? 'activated-pending' : 'linked-existing'
			};
		}

		const emailOwner = await trx
			.selectFrom('user_emails as email')
			.innerJoin('users as user', 'user.id', 'email.user_id')
			.select([
				'email.id as emailId',
				'email.user_id as userId',
				'email.is_verified as isVerified',
				'user.status as userStatus'
			])
			.where('email.email', '=', email)
			.forUpdate()
			.executeTakeFirst();

		if (emailOwner) {
			const existingUserLink = await trx
				.selectFrom('auth_user_links')
				.select('auth_user_id')
				.where('user_id', '=', emailOwner.userId)
				.executeTakeFirst();

			if (existingUserLink && existingUserLink.auth_user_id !== input.authUserId) {
				return {
					recovered: false,
					reason: 'The verified email is already linked to another authentication identity.'
				};
			}
			if (emailOwner.userStatus === 'suspended' || emailOwner.userStatus === 'disabled') {
				return { recovered: false, reason: `NuBlox user is ${emailOwner.userStatus}.` };
			}

			if (!existingUserLink) {
				await trx
					.insertInto('auth_user_links')
					.values({ auth_user_id: input.authUserId, user_id: emailOwner.userId })
					.executeTakeFirstOrThrow();
			}
			if (emailOwner.userStatus === 'pending') {
				await trx
					.updateTable('users')
					.set({ status: 'active' })
					.where('id', '=', emailOwner.userId)
					.where('status', '=', 'pending')
					.executeTakeFirstOrThrow();
			}
			if (!emailOwner.isVerified) {
				await trx
					.updateTable('user_emails')
					.set({ is_verified: 1, verified_at: new Date() })
					.where('id', '=', emailOwner.emailId)
					.executeTakeFirstOrThrow();
			}

			return {
				recovered: true,
				userId: emailOwner.userId,
				outcome: emailOwner.userStatus === 'pending' ? 'activated-pending' : 'linked-existing'
			};
		}

		const userInsert = await trx
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: input.displayName.trim() || email,
				status: 'active'
			})
			.executeTakeFirstOrThrow();
		if (userInsert.insertId === undefined) throw new Error('Recovered user insert did not return an ID.');
		const userId = userInsert.insertId.toString();

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

		return { recovered: true, userId, outcome: 'created' };
	});
}
