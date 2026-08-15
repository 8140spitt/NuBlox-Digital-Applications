import { redirect, type PageServerLoad } from '@sveltejs/kit';

function safeReturnTo(value: string | null): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
	return value;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	if (locals.actor) {
		throw redirect(303, returnTo ?? (locals.tenant.membershipVerified ? '/dashboard' : '/select-organisation'));
	}

	return {
		returnTo,
		verified: url.searchParams.get('verified') === '1'
	};
};
