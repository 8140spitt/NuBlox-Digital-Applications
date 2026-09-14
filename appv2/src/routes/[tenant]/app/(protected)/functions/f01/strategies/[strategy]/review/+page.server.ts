import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	WorkflowAccessError,
	WorkflowValidationError
} from '$lib/server/platform/workflow-request-service';
import { getStrategyExecutionReviewWorkspace } from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import { submitF01WorkflowTransition } from '$lib/server/strategy/f01-workflow-service';
import type { Actions, PageServerLoad } from './$types';

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
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
			error(404, 'Strategic review is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	approveReview: async ({ request, params, url }) => {
		const formData = await request.formData();
		const reviewPublicId = text(formData, 'reviewPublicId');
		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));
		try {
			const workflow = await submitF01WorkflowTransition({
				actor: {
					organisationId: access.organisationId,
					userId: access.userId,
					memberId: access.memberId
				},
				frameworkPublicId: params.strategy,
				kind: 'review',
				recordPublicId: reviewPublicId,
				targetStatus: 'approved'
			});
			if (!workflow) {
				throw new StrategyValidationError('Strategic review approval workflow is not configured.');
			}
			redirect(
				303,
				`${routes.strategyReview(access.organisationRouteSlug, params.strategy)}?workflowSubmitted=1&workflowRequest=${encodeURIComponent(workflow.requestPublicId)}`
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError || cause instanceof WorkflowValidationError) {
				return fail(400, { reviewPublicId, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError || cause instanceof WorkflowAccessError) {
				return fail(403, { reviewPublicId, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
