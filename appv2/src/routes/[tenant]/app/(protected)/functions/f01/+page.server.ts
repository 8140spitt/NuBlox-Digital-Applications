import { error } from '@sveltejs/kit';
import { getStrategyWorkspace, StrategyAccessError } from '$lib/server/strategy/f01-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant } = await parent();
	try {
		return {
			workspace: await getStrategyWorkspace({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId
			})
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy & Enterprise Planning is not available in this scope.');
		}
		throw cause;
	}
};
