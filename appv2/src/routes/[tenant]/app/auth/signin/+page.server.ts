import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes, safeTenantAppReturnTo } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getActiveTenantRouteContextBySlug } from '$lib/server/tenancy/tenant-route-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, url }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	const tenant = await getActiveTenantRouteContextBySlug(params.tenant);
	if (!tenant) {
		error(404, 'Tenant not found');
	}

	const returnTo = safeTenantAppReturnTo(url.searchParams.get('returnTo'), tenant.routeSlug);
	const session = await getAuth().api.getSession({ headers: request.headers });

	if (session) {
		const access = await resolveActiveInternalTenant(session.user.id, tenant.routeSlug);
		if (!access) {
			redirect(303, routes.appNoAccess(tenant.routeSlug));
		}
		redirect(303, returnTo ?? routes.dashboard(access.organisationRouteSlug));
	}

	return {
		tenant: {
			slug: tenant.routeSlug,
			displayName: tenant.displayName
		},
		returnTo,
		destination: returnTo ?? routes.app(tenant.routeSlug),
		forgotPasswordHref: routes.appForgotPassword(tenant.routeSlug),
		startHref: routes.start
	};
};
