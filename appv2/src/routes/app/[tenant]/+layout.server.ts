import { error } from '@sveltejs/kit';
import { tenantContextFromRoute } from '$lib/context/tenant-context';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
	const tenant = tenantContextFromRoute(params.tenant);
	if (!tenant) {
		error(404, 'Tenant not found');
	}

	return { tenant };
};
