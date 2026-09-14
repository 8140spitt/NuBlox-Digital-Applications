import { error } from '@sveltejs/kit';
import { getEnterpriseFunctionBlueprint } from '$lib/server/enterprise-function-catalogue';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { tenant } = await parent();
	const blueprint = getEnterpriseFunctionBlueprint(params.function.toUpperCase());
	if (!blueprint || blueprint.id === 'F01') {
		error(404, 'Enterprise function not found.');
	}

	return {
		tenant,
		blueprint
	};
};
