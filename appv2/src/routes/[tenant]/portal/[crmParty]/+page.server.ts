import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}
	if (!isRouteSlug(params.crmParty)) {
		error(404, 'CRM Party not found');
	}

	redirect(307, routes.portalDashboard(params.tenant, params.crmParty));
};
