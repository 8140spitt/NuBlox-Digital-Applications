import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';

function safeReturnTo(value: string | null): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
	return value;
}

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	const verified = url.searchParams.get('verified') === '1';
	if (verified) {
		cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
		cookies.delete(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE, { path: '/' });
	}
	if (locals.actor) {
		throw redirect(303, returnTo ?? (locals.tenant.membershipVerified ? '/dashboard' : '/select-organisation'));
	}

	return { returnTo, verified };
};
