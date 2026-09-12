import { redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { listActiveInternalAccessContexts } from '$lib/server/auth/access-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		redirect(303, routes.auth());
	}

	const contexts = await listActiveInternalAccessContexts(session.user.id);
	if (contexts.length === 1) {
		redirect(303, routes.dashboard(contexts[0].organisationPublicId));
	}
	if (contexts.length > 1) {
		redirect(303, routes.authSelectContext);
	}

	redirect(303, routes.authNoAccess);
};
