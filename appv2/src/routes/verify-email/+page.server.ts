import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { listActiveInternalAccessContexts } from '$lib/server/auth/access-context';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request, url }) => {
	const verified = url.searchParams.get('verified') === '1';
	if (!verified) {
		return { continueHref: null };
	}

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		return { continueHref: null };
	}

	const contexts = await listActiveInternalAccessContexts(session.user.id);
	const context = contexts.length === 1 ? contexts[0] : null;
	return {
		continueHref: context ? routes.app(context.organisationRouteSlug) : null
	};
};
