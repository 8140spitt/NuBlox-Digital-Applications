import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { approveStrategyFramework } from '$lib/server/strategy/approval-service';
import { approveStrategyBusinessPlan } from '$lib/server/strategy/business-plan-approval-service';
import { getStrategyExecutionReviewWorkspace } from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

async function actorFor(request: Request, params: { tenant: string }, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(params.tenant, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) redirect(303, routes.appNoAccess(params.tenant));
	return {
		access,
		actor: {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		}
	};
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		return await getStrategyExecutionReviewWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy
		});
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Business planning is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	approveStrategy: async ({ request, params, url }) => {
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await approveStrategyFramework({ actor, frameworkPublicId: params.strategy });
			redirect(303, routes.strategyBusinessPlanning(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	approvePlan: async ({ request, params, url }) => {
		const formData = await request.formData();
		const planPublicId = String(formData.get('planPublicId') ?? '').trim();
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await approveStrategyBusinessPlan({
				actor,
				frameworkPublicId: params.strategy,
				planPublicId
			});
			redirect(303, routes.strategyBusinessPlanning(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, { planPublicId, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, { planPublicId, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
