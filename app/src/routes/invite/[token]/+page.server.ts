import { dev } from '$app/environment';
import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	InvitationAccessError,
	normaliseInvitationEmail,
	OrganisationInvitationService
} from '$lib/server/organisations/invitation-service';
import { ORGANISATION_COOKIE } from '$lib/server/request-context';

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const invitation = await new OrganisationInvitationService(getDatabase()).getPendingInvitation(
		params.token
	);
	if (!invitation) throw error(404, 'This invitation is invalid or has expired.');

	const remainingSeconds = Math.max(
		60,
		Math.floor((invitation.expiresAt.getTime() - Date.now()) / 1000)
	);
	cookies.set(INVITATION_SIGNUP_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	return {
		invitation: {
			organisationName: invitation.organisationName,
			email: invitation.email,
			expiresAt: invitation.expiresAt.toISOString()
		},
		returnTo: `/invite/${encodeURIComponent(params.token)}`,
		actor: locals.actor
			? {
				email: locals.actor.email,
				displayName: locals.actor.displayName
			}
			: null,
		canAcceptExisting:
			Boolean(locals.actor) &&
			normaliseInvitationEmail(locals.actor?.email ?? '') === normaliseInvitationEmail(invitation.email)
	};
};

export const actions: Actions = {
	accept: async ({ params, locals, cookies }) => {
		if (!locals.actor) throw error(401, 'Sign in before accepting this invitation.');

		try {
			const accepted = await new OrganisationInvitationService(getDatabase()).acceptExistingUser(
				params.token,
				locals.actor,
				locals.correlationId
			);

			cookies.set(ORGANISATION_COOKIE, accepted.organisationPublicId, {
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				path: '/',
				maxAge: 60 * 60 * 24 * 30
			});
			cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
		} catch (cause) {
			if (cause instanceof InvitationAccessError) throw error(403, cause.message);
			throw cause;
		}

		throw redirect(303, '/dashboard');
	}
};
