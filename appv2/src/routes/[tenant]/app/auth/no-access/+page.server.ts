import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getActiveTenantRouteContextBySlug } from '$lib/server/tenancy/tenant-route-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	const tenant = await getActiveTenantRouteContextBySlug(params.tenant);
	if (!tenant) {
		error(404, 'Tenant not found');
	}

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		redirect(303, routes.appSignIn(tenant.routeSlug));
	}

	const access = await resolveActiveInternalTenant(session.user.id, tenant.routeSlug);
	if (access) {
		redirect(303, routes.dashboard(access.organisationRouteSlug));
	}

	return {
		tenant: {
			slug: tenant.routeSlug,
			displayName: tenant.displayName
		},
		startHref: routes.start,
		signInHref: routes.appSignIn(tenant.routeSlug),
		user: {
			name: session.user.name,
			email: session.user.email
		}
	};
};
