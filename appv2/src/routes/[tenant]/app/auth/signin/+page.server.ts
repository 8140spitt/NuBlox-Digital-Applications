import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes, safeTenantAppReturnTo } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, url }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	const returnTo = safeTenantAppReturnTo(url.searchParams.get('returnTo'), params.tenant);
	const session = await getAuth().api.getSession({ headers: request.headers });

	if (session) {
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) {
			redirect(303, routes.appNoAccess(params.tenant));
		}
		redirect(303, returnTo ?? routes.dashboard(access.organisationRouteSlug));
	}

	return {
		tenant: params.tenant,
		returnTo,
		destination: returnTo ?? routes.app(params.tenant),
		forgotPasswordHref: routes.appForgotPassword(params.tenant),
		startHref: routes.start
	};
};
