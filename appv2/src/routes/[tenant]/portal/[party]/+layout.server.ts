import { error } from '@sveltejs/kit';
import { isRouteSlug } from '$lib/routing/route-contract';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, parent }) => {
	if (!isRouteSlug(params.party)) {
		error(404, 'Portal party not found');
	}

	const parentData = await parent();

	return {
		...parentData,
		party: {
			slug: params.party
		}
	};
};
