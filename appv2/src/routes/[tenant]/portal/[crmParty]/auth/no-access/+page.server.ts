import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request }) => {
	if (!isRouteSlug(params.tenant)) error(404, 'Tenant not found');
	if (!isRouteSlug(params.crmParty)) error(404, 'CRM Party not found');

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.portalSignIn(params.tenant, params.crmParty));

	return {
		contextName: `${params.tenant} / ${params.crmParty}`,
		signInHref: routes.portalSignIn(params.tenant, params.crmParty),
		startHref: routes.start,
		user: { name: session.user.name, email: session.user.email }
	};
};
