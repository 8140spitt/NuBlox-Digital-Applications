import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		redirect(303, routes.appSignIn(params.tenant));
	}

	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) {
		redirect(303, routes.appNoAccess(params.tenant));
	}

	redirect(303, routes.dashboard(access.organisationPublicId));
};
