import { error } from '@sveltejs/kit';
import { isRouteSlug } from '$lib/routing/route-contract';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	return {
		tenant: {
			slug: params.tenant
		}
	};
};
