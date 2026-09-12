import { error } from '@sveltejs/kit';
import { tenantContextFromRoute } from '$lib/context/tenant-context';
import { isRouteSlug } from '$lib/routing/route-contract';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const tenant = tenantContextFromRoute(params.tenant);
	if (!tenant) {
		error(404, 'Tenant not found');
	}
	if (!isRouteSlug(params.crmParty)) {
		error(404, 'CRM Party not found');
	}

	return {
		tenant,
		crmParty: { slug: params.crmParty }
	};
};
