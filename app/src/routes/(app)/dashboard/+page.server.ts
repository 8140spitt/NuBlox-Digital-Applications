import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return {
		context: {
			actor: locals.actor,
			correlationId: locals.correlationId,
			tenant: locals.tenant
		}
	};
};
