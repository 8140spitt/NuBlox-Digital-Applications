import { error } from '@sveltejs/kit';
import { getStrategyWorkspace, StrategyAccessError } from '$lib/server/strategy/f01-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		const workspace = await getStrategyWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId
		});
		const framework = workspace.frameworks.find((item) => item.publicId === params.strategy);
		if (!framework) error(404, 'Strategy cycle not found.');
		return { framework, permissions: workspace.permissions };
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy & Enterprise Planning is not available in this scope.');
		}
		throw cause;
	}
};
