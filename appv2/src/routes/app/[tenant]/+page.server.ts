import { redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	redirect(307, routes.dashboard(params.tenant));
};
