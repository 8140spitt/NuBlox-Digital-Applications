import type { RequestEvent } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/database';
import { OrganisationBootstrapService } from '$lib/server/organisations/bootstrap-service';
import { OrganisationInvitationService } from '$lib/server/organisations/invitation-service';
import type { Actor } from '$lib/types/request-context';
import { AuthIdentityRepository } from './auth-identity-repository';
import { auth } from './better-auth';
import { assertVerifiedAuthUser } from './verified-auth-user';

export async function getSessionActor(event: RequestEvent): Promise<Actor | null> {
	const cookieNames = (event.request.headers.get('cookie') ?? '')
		.split(';')
		.map((part) => part.split('=', 1)[0]?.trim())
		.filter(Boolean);

	const session = await auth.api.getSession({ headers: event.request.headers });
	if (!session) {
		if (cookieNames.some((name) => name?.startsWith('nublox.'))) {
			console.warn('[NuBlox auth] Auth cookie present but no Better Auth session was resolved.', {
				pathname: event.url.pathname,
				cookieNames
			});
		}
		return null;
	}

	const db = getDatabase();
	const identities = new AuthIdentityRepository(db);
	let linkedUser = await identities.findActivePlatformUser(session.user.id);

	if (!linkedUser) {
		console.warn('[NuBlox auth] Session resolved but no active NuBlox platform user was found; reconciling.', {
			pathname: event.url.pathname,
			authUserId: session.user.id,
			email: session.user.email
		});

		try {
			await assertVerifiedAuthUser(db, session.user.id, session.user.email);
			const correlationId = event.locals.correlationId;

			await new OrganisationInvitationService(db).activateVerifiedAuthUser({
				authUserId: session.user.id,
				email: session.user.email,
				displayName: session.user.name,
				correlationId
			});
			await new OrganisationBootstrapService(db).activateVerifiedAuthUser({
				authUserId: session.user.id,
				email: session.user.email,
				displayName: session.user.name,
				correlationId
			});

			linkedUser = await identities.findActivePlatformUser(session.user.id);
		} catch (cause) {
			console.error('[NuBlox auth] Verified-session reconciliation failed.', cause);
		}
	}

	if (!linkedUser) {
		console.error('[NuBlox auth] Better Auth session exists but NuBlox platform user is still unavailable.', {
			pathname: event.url.pathname,
			authUserId: session.user.id,
			email: session.user.email
		});
		return null;
	}

	console.info('[NuBlox auth] Session resolved to active NuBlox user.', {
		pathname: event.url.pathname,
		authUserId: session.user.id,
		userId: linkedUser.userId
	});

	return {
		authUserId: session.user.id,
		userId: linkedUser.userId,
		email: session.user.email,
		displayName: linkedUser.displayName
	};
}
