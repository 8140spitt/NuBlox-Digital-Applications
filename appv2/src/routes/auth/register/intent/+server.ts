import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';
import { getAuth } from '$lib/server/auth/auth';
import {
	createTenantBootstrapIntent,
	TENANT_BOOTSTRAP_COOKIE,
	TenantBootstrapValidationError
} from '$lib/server/auth/tenant-bootstrap';

type RegistrationIntentBody = {
	email?: unknown;
	legalName?: unknown;
	tradingName?: unknown;
	defaultTimezone?: unknown;
	defaultCurrencyCode?: unknown;
};

export const POST: RequestHandler = async ({ request, cookies }) => {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (session) throw error(409, 'You are already signed in.');

	const body = (await request.json()) as RegistrationIntentBody;
	if (typeof body.email !== 'string' || typeof body.legalName !== 'string') {
		throw error(400, 'Email and legal name are required.');
	}
	if (body.tradingName !== undefined && body.tradingName !== null && typeof body.tradingName !== 'string') {
		throw error(400, 'Trading name must be text.');
	}
	if (body.defaultTimezone !== undefined && typeof body.defaultTimezone !== 'string') {
		throw error(400, 'Timezone must be text.');
	}
	if (body.defaultCurrencyCode !== undefined && typeof body.defaultCurrencyCode !== 'string') {
		throw error(400, 'Currency code must be text.');
	}

	try {
		const intent = await createTenantBootstrapIntent({
			email: body.email,
			legalName: body.legalName,
			tradingName: body.tradingName as string | null | undefined,
			defaultTimezone: body.defaultTimezone as string | undefined,
			defaultCurrencyCode: body.defaultCurrencyCode as string | undefined
		});

		const remainingSeconds = Math.max(
			60,
			Math.floor((intent.expiresAt.getTime() - Date.now()) / 1000)
		);
		cookies.set(TENANT_BOOTSTRAP_COOKIE, intent.token, {
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
		if (cause instanceof TenantBootstrapValidationError) throw error(400, cause.message);
		throw cause;
	}
};
