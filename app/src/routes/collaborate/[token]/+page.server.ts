import { dev } from '$app/environment';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { PROJECT_COLLABORATION_SIGNUP_COOKIE } from '$lib/server/auth/project-collaboration-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	ProjectExternalCollaborationAccessError,
	ProjectExternalCollaborationService,
	ProjectExternalCollaborationValidationError
} from '$lib/server/projects/project-external-collaboration-service';

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function collaborationFailure(cause: unknown) {
	if (
		cause instanceof ProjectExternalCollaborationAccessError ||
		cause instanceof ProjectExternalCollaborationValidationError
	) {
		return fail(400, { message: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const service = new ProjectExternalCollaborationService(getDatabase());
	const invitation = await service.getPendingInvitation(params.token);
	if (!invitation) throw error(404, 'This project collaboration invitation is invalid or has expired.');

	const remainingSeconds = Math.max(
		60,
		Math.floor((invitation.expiresAt.getTime() - Date.now()) / 1000)
	);
	cookies.set(PROJECT_COLLABORATION_SIGNUP_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	return {
		invitation: { ...invitation, expiresAt: invitation.expiresAt.toISOString() },
		actor: locals.actor
			? { displayName: locals.actor.displayName, email: locals.actor.email }
			: null,
		emailMatchesActor:
			Boolean(locals.actor) &&
			normaliseEmail(locals.actor?.email ?? '') === normaliseEmail(invitation.email),
		returnTo: `/collaborate/${encodeURIComponent(params.token)}`
	};
};

export const actions: Actions = {
	accept: async ({ params, locals, cookies }) => {
		if (!locals.actor) return fail(401, { message: 'Sign in with the invited email address first.' });
		try {
			await new ProjectExternalCollaborationService(getDatabase()).acceptExistingUser(
				params.token,
				locals.actor,
				locals.correlationId
			);
			cookies.delete(PROJECT_COLLABORATION_SIGNUP_COOKIE, { path: '/' });
			throw redirect(303, '/portal');
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'status' in cause && 'location' in cause) throw cause;
			return collaborationFailure(cause);
		}
	}
};
