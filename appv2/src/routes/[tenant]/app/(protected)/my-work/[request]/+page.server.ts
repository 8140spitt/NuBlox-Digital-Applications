import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	getPendingWorkflowTask,
	WorkflowAccessError,
	WorkflowValidationError,
	type WorkflowDecision
} from '$lib/server/platform/workflow-request-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import { decideF01WorkflowRequest } from '$lib/server/strategy/f01-workflow-service';
import type { Actions, PageServerLoad } from './$types';

function sourceHref(
	tenant: string,
	task: {
		sourceDomain: string;
		sourceType: string;
		sourcePublicId: string;
		contextPublicId: string;
	}
): string {
	if (task.sourceDomain === 'F01') {
		return `/${tenant}/app/functions/f01/strategies/${task.contextPublicId}/manage/${task.sourceType}/${task.sourcePublicId}`;
	}
	return `/${tenant}/app/my-work`;
}

async function actorFor(request: Request, tenantSlug: string, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(tenantSlug, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, tenantSlug);
	if (!access) redirect(303, routes.appNoAccess(tenantSlug));
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
		const task = await getPendingWorkflowTask({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			requestPublicId: params.request
		});
		return {
			task,
			sourceHref: sourceHref(params.tenant, task)
		};
	} catch (cause) {
		if (cause instanceof WorkflowAccessError) error(403, cause.message);
		if (cause instanceof WorkflowValidationError) error(404, cause.message);
		throw cause;
	}
};

export const actions = {
	decide: async ({ request, params, url }) => {
		const formData = await request.formData();
		const decision = String(formData.get('decision') ?? '') as WorkflowDecision;
		const note = String(formData.get('note') ?? '').trim();
		if (!['approved', 'returned', 'rejected'].includes(decision)) {
			return fail(400, { formError: 'Choose approve, return or reject.', decision, note });
		}
		const { access, actor } = await actorFor(
			request,
			params.tenant,
			`${url.pathname}${url.search}`
		);
		try {
			const result = await decideF01WorkflowRequest({
				actor,
				requestPublicId: params.request,
				decision,
				note
			});
			if (!result.workflowCompleted && decision === 'approved') {
				redirect(303, `${url.pathname}?stepAdvanced=1`);
			}
			const target = `/${access.organisationRouteSlug}/app/functions/f01/strategies/${result.frameworkPublicId}/manage/${result.kind}/${result.recordPublicId}`;
			redirect(303, `${target}?workflowDecision=${decision}`);
		} catch (cause) {
			if (cause instanceof WorkflowValidationError || cause instanceof StrategyValidationError) {
				return fail(400, { formError: cause.message, decision, note });
			}
			if (cause instanceof WorkflowAccessError || cause instanceof StrategyAccessError) {
				return fail(403, { formError: cause.message, decision, note });
			}
			throw cause;
		}
	}
} satisfies Actions;
