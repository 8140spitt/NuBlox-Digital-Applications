import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import { getStrategyApprovalReadiness } from '$lib/server/strategy/approval-readiness-service';
import { getF01BusinessWorkflowStatus } from '$lib/server/strategy/f01-business-workflow-status';
import {
	getStrategyWorkspace,
	StrategyAccessError,
	StrategyValidationError
} from '$lib/server/strategy/f01-service';
import { submitF01WorkflowTransition } from '$lib/server/strategy/f01-workflow-service';
import {
	WorkflowAccessError,
	WorkflowValidationError
} from '$lib/server/platform/workflow-request-service';
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
		const workspace = await getStrategyWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId
		});
		const framework = workspace.frameworks.find((item) => item.publicId === params.strategy);
		if (!framework) error(404, 'Strategy cycle not found.');
		const [readiness, approvalStatus] = await Promise.all([
			getStrategyApprovalReadiness({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				frameworkPublicId: params.strategy
			}),
			getF01BusinessWorkflowStatus({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				kind: 'framework',
				recordPublicId: params.strategy
			})
		]);
		return { framework, permissions: workspace.permissions, readiness, approvalStatus };
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy & Enterprise Planning is not available in this scope.');
		}
		throw cause;
	}
};

export const actions = {
	submitForReview: async ({ request, params, url }) => {
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await submitF01WorkflowTransition({
				actor,
				frameworkPublicId: params.strategy,
				kind: 'framework',
				recordPublicId: params.strategy,
				targetStatus: 'approved'
			});
			redirect(303, routes.strategyFramework(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError || cause instanceof WorkflowValidationError) {
				return fail(400, { formError: cause.message });
			}
			if (cause instanceof StrategyAccessError || cause instanceof WorkflowAccessError) {
				return fail(403, { formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
