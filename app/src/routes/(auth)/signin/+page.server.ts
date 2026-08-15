import { fail, redirect, type Actions, type Cookies } from '@sveltejs/kit';
import { parseSetCookieHeader } from 'better-auth/cookies';
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

function copyAuthCookies(cookies: Cookies, headers: Headers): void {
	const setCookieHeader = headers.get('set-cookie');
	if (!setCookieHeader) return;

	const parsed = parseSetCookieHeader(setCookieHeader);
	for (const [name, { value, ...options }] of parsed) {
		cookies.set(name, value, {
			path: options.path || '/',
			httpOnly: options.httponly,
			secure: options.secure,
			sameSite: options.samesite as 'lax' | 'strict' | 'none' | undefined,
			expires: options.expires,
			domain: options.domain,
			maxAge: options['max-age'],
			encode: (cookieValue) => cookieValue
		});
	}
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
	default: async ({ request, url, cookies }) => {
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

		let authResponse: Response;
		try {
			authResponse = await auth.api.signInEmail({
				body: {
					email,
					password,
					rememberMe: true
				},
				headers: request.headers,
				asResponse: true
			});
		} catch (cause) {
			console.error('[NuBlox auth] Server-side sign-in failed.', cause);
			return fail(500, {
				email,
				message: 'Sign-in could not be completed. Check the application terminal for the server error.'
			});
		}

		if (!authResponse.ok) {
			let serverMessage = '';
			try {
				const body = (await authResponse.json()) as { message?: unknown };
				serverMessage = typeof body.message === 'string' ? body.message : '';
			} catch {
				// Keep the user-facing fallback below when Better Auth returns a non-JSON error.
			}

			return fail(authResponse.status >= 400 && authResponse.status < 600 ? authResponse.status : 400, {
				email,
				message:
					authResponse.status === 403
						? 'Verify your email address before signing in.'
						: serverMessage || 'The email address or password is incorrect.'
			});
		}

		copyAuthCookies(cookies, authResponse.headers);
		throw redirect(303, returnTo ?? '/select-organisation');
	}
};
