import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes, safePortalReturnTo } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, request, url }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}
	if (!isRouteSlug(params.crmParty)) {
		error(404, 'CRM Party not found');
	}

	const returnTo = safePortalReturnTo(
		url.searchParams.get('returnTo'),
		params.tenant,
		params.crmParty
	);
	const session = await getAuth().api.getSession({ headers: request.headers });

	if (session) {
		redirect(303, returnTo ?? routes.portal(params.tenant, params.crmParty));
	}

	return {
		contextName: `${params.tenant} / ${params.crmParty}`,
		destination: returnTo ?? routes.portal(params.tenant, params.crmParty),
		forgotPasswordHref: routes.portalForgotPassword(params.tenant, params.crmParty),
		startHref: routes.start
	};
};
