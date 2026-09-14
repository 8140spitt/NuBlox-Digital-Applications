import { fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	cancelWorkflowOperation,
	getWorkflowOperation,
	reassignWorkflowWorkItem,
	setWorkflowPriority,
	setWorkflowWorkStatus,
	WorkflowOperationsAccessError,
	WorkflowOperationsValidationError
} from '$lib/server/platform/workflow-operations-service';
import type { Actions, PageServerLoad } from './$types';

async function actorFor(request: Request, params: { tenant: string }, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(params.tenant, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) redirect(303, routes.appNoAccess(params.tenant));
	return {
		organisationId: access.organisationId,
		userId: access.userId,
		memberId: access.memberId
	};
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant, user } = await parent();
	try {
		return {
			operation: await getWorkflowOperation(
				{ organisationId: tenant.organisationId, userId: user.id, memberId: tenant.memberId },
				params.request
			)
		};
	} catch (cause) {
		if (cause instanceof WorkflowOperationsAccessError)
			redirect(303, routes.dashboard(tenant.slug));
		if (cause instanceof WorkflowOperationsValidationError)
			redirect(303, `/${tenant.slug}/app/workflow/operations`);
		throw cause;
	}
};

function handled(cause: unknown) {
	if (cause instanceof WorkflowOperationsValidationError)
		return fail(400, { formError: cause.message });
	if (cause instanceof WorkflowOperationsAccessError)
		return fail(403, { formError: cause.message });
	throw cause;
}

export const actions = {
	priority: async ({ request, params, url }) => {
		const actor = await actorFor(request, params, `${url.pathname}${url.search}`);
		const data = await request.formData();
		try {
			await setWorkflowPriority({
				actor,
				requestPublicId: params.request,
				priority: String(data.get('priority')) as 'low' | 'normal' | 'high' | 'urgent' | 'critical',
				reason: String(data.get('reason') ?? '')
			});
			return { success: 'Workflow priority updated.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	status: async ({ request, params, url }) => {
		const actor = await actorFor(request, params, `${url.pathname}${url.search}`);
		const data = await request.formData();
		try {
			await setWorkflowWorkStatus({
				actor,
				requestPublicId: params.request,
				status: String(data.get('status')) as 'open' | 'in_progress' | 'blocked',
				reason: String(data.get('reason') ?? '')
			});
			return { success: 'Workflow operational status updated.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	reassign: async ({ request, params, url }) => {
		const actor = await actorFor(request, params, `${url.pathname}${url.search}`);
		const data = await request.formData();
		try {
			await reassignWorkflowWorkItem({
				actor,
				requestPublicId: params.request,
				memberId: Number(data.get('memberId')),
				reason: String(data.get('reason') ?? '')
			});
			return { success: 'Workflow work reassigned.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	cancel: async ({ request, params, url }) => {
		const actor = await actorFor(request, params, `${url.pathname}${url.search}`);
		const data = await request.formData();
		try {
			await cancelWorkflowOperation({
				actor,
				requestPublicId: params.request,
				reason: String(data.get('reason') ?? '')
			});
			return { success: 'Workflow cancelled with audit evidence.' };
		} catch (cause) {
			return handled(cause);
		}
	}
} satisfies Actions;
