import type { DatabaseExecutor } from '$lib/server/db/executor';

export class AuthEmailVerificationError extends Error {
	readonly code = 'AUTH_EMAIL_NOT_VERIFIED';

	constructor() {
		super('The authentication identity has not completed email verification.');
		this.name = 'AuthEmailVerificationError';
	}
}

export async function assertVerifiedAuthUser(
	db: DatabaseExecutor,
	authUserId: string,
	email: string
): Promise<void> {
	const row = await db
		.selectFrom('auth_users')
		.select('id')
		.where('id', '=', authUserId)
		.where('email', '=', email.trim().toLowerCase())
		.where('email_verified', '=', 1)
		.executeTakeFirst();

	if (!row) throw new AuthEmailVerificationError();
}
