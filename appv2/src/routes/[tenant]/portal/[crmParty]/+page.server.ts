import { redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import type { PageServerLoad } from '../[tenant]/[crmParty]/$types';

export const load: PageServerLoad = ({ params }) => {
	redirect(307, routes.portalDashboard(params.tenant, params.crmParty));
};
