import { fail, redirect, type Actions } from '@sveltejs/kit';
import { isAPIError } from 'better-auth/api';
import type { PageServerLoad } from './$types';

import { auth } from '$lib/server/auth/better-auth';
import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';

function safeReturnTo(value: string | null): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
	return value;
}

function field(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	const verified = url.searchParams.get('verified') === '1';
	const passwordReset = url.searchParams.get('reset') === '1';
	if (verified) {
		cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
		cookies.delete(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE, { path: '/' });
	}
	if (locals.actor) {
		throw redirect(
			303,
			returnTo ?? (locals.tenant.membershipVerified ? '/dashboard' : '/select-organisation')
		);
	}

	return { returnTo, verified, passwordReset };
};

export const actions: Actions = {
	default: async ({ request, url }) => {
		const formData = await request.formData();
		const email = field(formData, 'email').trim();
		const password = field(formData, 'password');
		const returnTo = safeReturnTo(url.searchParams.get('returnTo'));

		if (!email || !password) {
			return fail(400, {
				email,
				message: 'Enter your email address and password.'
			});
		}

		console.info('[NuBlox auth] Sign-in started.', { email });

		try {
			await auth.api.signInEmail({
				body: {
					email,
					password,
					rememberMe: true
				},
				headers: request.headers
			});
		} catch (cause) {
			if (isAPIError(cause)) {
				console.warn('[NuBlox auth] Sign-in rejected.', {
				email,
					status: cause.status,
					message: cause.message
				});
				return fail(cause.statusCode >= 400 && cause.statusCode < 600 ? cause.statusCode : 400, {
					email,
					message:
						cause.statusCode === 403
							? 'Verify your email address before signing in.'
							: cause.message || 'The email address or password is incorrect.'
				});
			}

			console.error('[NuBlox auth] Sign-in failed unexpectedly.', cause);
			return fail(500, {
				email,
				message: 'Sign-in could not be completed. Check the application terminal for the server error.'
			});
		}

		console.info('[NuBlox auth] Sign-in accepted; redirecting.', { email });
		throw redirect(303, returnTo ?? '/select-organisation');
	}
};
