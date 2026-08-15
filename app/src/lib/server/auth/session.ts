import type { RequestEvent } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/database';
import type { Actor } from '$lib/types/request-context';
import { AuthIdentityRepository } from './auth-identity-repository';
import { auth } from './better-auth';

export async function getSessionActor(event: RequestEvent): Promise<Actor | null> {
	const session = await auth.api.getSession({ headers: event.request.headers });
	if (!session) return null;

	const linkedUser = await new AuthIdentityRepository(getDatabase()).findActivePlatformUser(
		session.user.id
	);
	if (!linkedUser) return null;

	return {
		authUserId: session.user.id,
		userId: linkedUser.userId,
		email: session.user.email,
		displayName: linkedUser.displayName
	};
}
