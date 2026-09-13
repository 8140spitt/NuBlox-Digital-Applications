import { error } from '@sveltejs/kit';
import {
	getStrategyAnalysisPlanningWorkspace,
	StrategyAccessError
} from '$lib/server/strategy/analysis-planning-service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		const workspace = await getStrategyAnalysisPlanningWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy
		});
		return {
			framework: workspace.framework,
			permissions: workspace.permissions,
			evidence: workspace.evidence,
			factors: workspace.factors,
			assumptions: workspace.assumptions
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Environmental analysis is not available in this strategy scope.');
		}
		throw cause;
	}
};
