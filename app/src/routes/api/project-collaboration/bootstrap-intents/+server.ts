import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { PROJECT_COLLABORATION_SIGNUP_COOKIE } from '$lib/server/auth/project-collaboration-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	OrganisationBootstrapService,
	OrganisationBootstrapValidationError
} from '$lib/server/organisations/bootstrap-service';
import { ProjectCollaborationInvitationService } from '$lib/server/projects/project-collaboration-invitation-service';

type Body = {
	defaultTimezone?: unknown;
	defaultCurrencyCode?: unknown;
};

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (locals.actor) {
		throw error(409, 'You are already signed in. Accept this invitation with an existing organisation or create another organisation from the invitation page.');
	}
	const collaborationToken = cookies.get(PROJECT_COLLABORATION_SIGNUP_COOKIE)?.trim() ?? '';
	if (!collaborationToken) throw error(403, 'A valid project collaboration invitation is required.');

	const body = (await request.json()) as Body;
	if (body.defaultTimezone !== undefined && typeof body.defaultTimezone !== 'string') {
		throw error(400, 'Timezone must be text.');
	}
	if (body.defaultCurrencyCode !== undefined && typeof body.defaultCurrencyCode !== 'string') {
		throw error(400, 'Currency code must be text.');
	}

	const db = getDatabase();
	const invitation = await new ProjectCollaborationInvitationService(db).getPendingInvitation(
		collaborationToken
	);
	if (!invitation) throw error(403, 'This project collaboration invitation is invalid or expired.');

	try {
		const intent = await new OrganisationBootstrapService(db).createIntent({
			email: invitation.email,
			details: {
				legalName: invitation.crmLegalName,
				tradingName: invitation.crmTradingName,
				defaultTimezone:
					typeof body.defaultTimezone === 'string' ? body.defaultTimezone : 'Europe/London',
				defaultCurrencyCode:
					typeof body.defaultCurrencyCode === 'string' ? body.defaultCurrencyCode : 'GBP'
			}
		});
		const remainingSeconds = Math.max(
			60,
			Math.floor((intent.expiresAt.getTime() - Date.now()) / 1000)
		);
		cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
		cookies.set(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE, intent.token, {
			httpOnly: true,
			secure: !dev,
			sameSite: 'lax',
			path: '/',
			maxAge: remainingSeconds
		});
		return json(
			{ email: intent.email, expiresAt: intent.expiresAt.toISOString() },
			{ status: 201 }
		);
	} catch (cause) {
		if (cause instanceof OrganisationBootstrapValidationError) throw error(400, cause.message);
		throw cause;
	}
};
