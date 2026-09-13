import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	decideStrategyOption,
	getStrategyAnalysisPlanningWorkspace,
	type OptionDecisionStatus
} from '$lib/server/strategy/analysis-planning-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

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
			factors: workspace.factors,
			assumptions: workspace.assumptions,
			options: workspace.options,
			themes: workspace.themes,
			objectives: workspace.objectives
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategic planning is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	decide: async ({ request, params, url }) => {
		const formData = await request.formData();
		const optionPublicId = String(formData.get('optionPublicId') ?? '').trim();
		const decisionStatus = String(formData.get('decisionStatus') ?? '').trim() as OptionDecisionStatus;
		const decisionRationale = String(formData.get('decisionRationale') ?? '').trim();
		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));

		try {
			if (decisionStatus !== 'selected' && decisionStatus !== 'rejected') {
				throw new StrategyValidationError('Choose whether the option is selected or rejected.');
			}
			await decideStrategyOption({
				actor: {
					organisationId: access.organisationId,
					userId: access.userId,
					memberId: access.memberId
				},
				frameworkPublicId: params.strategy,
				optionPublicId,
				decisionStatus,
				decisionRationale
			});
			redirect(303, routes.strategyPlanning(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, {
					values: { optionPublicId, decisionStatus, decisionRationale },
					errors: {} as Record<string, string>,
					formError: cause.message
				});
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, {
					values: { optionPublicId, decisionStatus, decisionRationale },
					errors: {} as Record<string, string>,
					formError: cause.message
				});
			}
			throw cause;
		}
	}
} satisfies Actions;
