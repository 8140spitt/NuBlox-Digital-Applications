import { redirect } from '@sveltejs/kit';
import { safeReturnTo } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url }) => {
	const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
	const session = await getAuth().api.getSession({ headers: request.headers });

	if (session && returnTo) {
		redirect(303, returnTo);
	}

	return {
		returnTo,
		user: session
			? {
					id: session.user.id,
					name: session.user.name,
					email: session.user.email
				}
			: null
	};
};
