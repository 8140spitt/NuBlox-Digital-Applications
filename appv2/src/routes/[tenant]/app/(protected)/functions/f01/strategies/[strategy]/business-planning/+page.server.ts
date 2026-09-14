import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	WorkflowAccessError,
	WorkflowValidationError
} from '$lib/server/platform/workflow-request-service';
import { getStrategyApprovalReadiness } from '$lib/server/strategy/approval-readiness-service';
import { getStrategyExecutionReviewWorkspace } from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import { submitF01WorkflowTransition } from '$lib/server/strategy/f01-workflow-service';
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

function workflowRedirect(base: string, requestPublicId: string): string {
	return `${base}?workflowSubmitted=1&workflowRequest=${encodeURIComponent(requestPublicId)}`;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		const [workspace, approvalReadiness] = await Promise.all([
			getStrategyExecutionReviewWorkspace({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				frameworkPublicId: params.strategy
			}),
			getStrategyApprovalReadiness({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				frameworkPublicId: params.strategy
			})
		]);
		return { ...workspace, approvalReadiness };
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
			const workflow = await submitF01WorkflowTransition({
				actor,
				frameworkPublicId: params.strategy,
				kind: 'framework',
				recordPublicId: params.strategy,
				targetStatus: 'approved'
			});
			if (!workflow) {
				throw new StrategyValidationError('Strategy approval workflow is not configured.');
			}
			redirect(
				303,
				workflowRedirect(
					routes.strategyBusinessPlanning(access.organisationRouteSlug, params.strategy),
					workflow.requestPublicId
				)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError || cause instanceof WorkflowValidationError) {
				return fail(400, { formError: cause.message });
			}
			if (cause instanceof StrategyAccessError || cause instanceof WorkflowAccessError) {
				return fail(403, { formError: cause.message });
			}
			throw cause;
		}
	},
	approvePlan: async ({ request, params, url }) => {
		const formData = await request.formData();
		const planPublicId = String(formData.get('planPublicId') ?? '').trim();
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const workflow = await submitF01WorkflowTransition({
				actor,
				frameworkPublicId: params.strategy,
				kind: 'plan',
				recordPublicId: planPublicId,
				targetStatus: 'approved'
			});
			if (!workflow) {
				throw new StrategyValidationError('Business plan approval workflow is not configured.');
			}
			redirect(
				303,
				workflowRedirect(
					routes.strategyBusinessPlanning(access.organisationRouteSlug, params.strategy),
					workflow.requestPublicId
				)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError || cause instanceof WorkflowValidationError) {
				return fail(400, { planPublicId, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError || cause instanceof WorkflowAccessError) {
				return fail(403, { planPublicId, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
