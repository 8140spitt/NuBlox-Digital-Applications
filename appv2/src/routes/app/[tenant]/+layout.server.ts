import { error, redirect } from '@sveltejs/kit';
import { tenantContextFromRoute } from '$lib/context/tenant-context';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, request, url }) => {
	const tenant = tenantContextFromRoute(params.tenant);
	if (!tenant) {
		error(404, 'Tenant not found');
	}

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		redirect(303, routes.auth(`${url.pathname}${url.search}`));
	}

	return {
		tenant,
		user: {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email
		}
	};
};
