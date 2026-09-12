import { dev } from '$app/environment';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { EXTERNAL_ACCESS_SIGNUP_COOKIE } from '$lib/server/auth/external-access-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	ExternalInvitationAccessError,
	ExternalInvitationService,
	ExternalInvitationValidationError
} from '$lib/server/external-access/external-invitation-service';

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function invitationFailure(cause: unknown) {
	if (
		cause instanceof ExternalInvitationAccessError ||
		cause instanceof ExternalInvitationValidationError
	) {
		return fail(400, { message: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const service = new ExternalInvitationService(getDatabase());
	const invitation = await service.getPendingInvitation(params.token);
	if (!invitation) throw error(404, 'This NuBlox Network invitation is invalid or has expired.');

	const remainingSeconds = Math.max(
		60,
		Math.floor((invitation.expiresAt.getTime() - Date.now()) / 1000)
	);
	cookies.set(EXTERNAL_ACCESS_SIGNUP_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	return {
		invitation: {
			...invitation,
			dueAt: invitation.dueAt?.toISOString() ?? null,
			expiresAt: invitation.expiresAt.toISOString()
		},
		actor: locals.actor
			? { displayName: locals.actor.displayName, email: locals.actor.email }
			: null,
		emailMatchesActor:
			Boolean(locals.actor) &&
			normaliseEmail(locals.actor?.email ?? '') === normaliseEmail(invitation.email),
		returnTo: `/network/invite/${encodeURIComponent(params.token)}`
	};
};

export const actions: Actions = {
	accept: async ({ params, locals, cookies }) => {
		if (!locals.actor) return fail(401, { message: 'Sign in with the invited email address first.' });
		try {
			await new ExternalInvitationService(getDatabase()).acceptExistingUser(
				params.token,
				locals.actor,
				locals.correlationId
			);
			cookies.delete(EXTERNAL_ACCESS_SIGNUP_COOKIE, { path: '/' });
			throw redirect(303, '/portal');
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'status' in cause && 'location' in cause) {
				throw cause;
			}
			return invitationFailure(cause);
		}
	}
};
