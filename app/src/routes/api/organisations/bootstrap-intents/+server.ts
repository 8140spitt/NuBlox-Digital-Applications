import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	OrganisationBootstrapService,
	OrganisationBootstrapValidationError
} from '$lib/server/organisations/bootstrap-service';

type BootstrapIntentBody = {
	email?: unknown;
	legalName?: unknown;
	tradingName?: unknown;
	defaultTimezone?: unknown;
	defaultCurrencyCode?: unknown;
};

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	if (locals.actor) {
		throw error(
			409,
			'You are already signed in. Create the organisation from the organisation setup page.'
		);
	}

	const body = (await request.json()) as BootstrapIntentBody;
	if (typeof body.email !== 'string' || typeof body.legalName !== 'string') {
		throw error(400, 'Email and legal name are required.');
	}
	if (
		body.tradingName !== undefined &&
		body.tradingName !== null &&
		typeof body.tradingName !== 'string'
	) {
		throw error(400, 'Trading name must be text.');
	}
	if (body.defaultTimezone !== undefined && typeof body.defaultTimezone !== 'string') {
		throw error(400, 'Timezone must be text.');
	}
	if (body.defaultCurrencyCode !== undefined && typeof body.defaultCurrencyCode !== 'string') {
		throw error(400, 'Currency code must be text.');
	}

	try {
		const intent = await new OrganisationBootstrapService(getDatabase()).createIntent({
			email: body.email,
			details: {
				legalName: body.legalName,
				tradingName: body.tradingName as string | null | undefined,
				defaultTimezone: body.defaultTimezone as string | undefined,
				defaultCurrencyCode: body.defaultCurrencyCode as string | undefined
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
			{
				publicId: intent.publicId,
				email: intent.email,
				expiresAt: intent.expiresAt.toISOString()
			},
			{ status: 201 }
		);
	} catch (cause) {
		if (cause instanceof OrganisationBootstrapValidationError) throw error(400, cause.message);
		throw cause;
	}
};
