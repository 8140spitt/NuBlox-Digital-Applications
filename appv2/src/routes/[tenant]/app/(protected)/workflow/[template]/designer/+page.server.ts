import { fail, redirect } from '@sveltejs/kit';
import { appPath, routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	addWorkflowLink,
	addWorkflowNode,
	deleteWorkflowLink,
	deleteWorkflowNode,
	getWorkflowTemplate,
	publishWorkflowTemplate,
	reviseWorkflowTemplate,
	WorkflowAdministrationAccessError,
	WorkflowAdministrationValidationError
} from '$lib/server/platform/workflow-admin-service';
import type { WorkflowNodeType } from '$lib/server/platform/workflow-kernel';
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

function handled(cause: unknown) {
	if (cause instanceof WorkflowAdministrationValidationError) {
		return fail(400, { formError: cause.message });
	}
	if (cause instanceof WorkflowAdministrationAccessError) {
		return fail(403, { formError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant, user } = await parent();
	try {
		return {
			template: await getWorkflowTemplate(
				{ organisationId: tenant.organisationId, userId: user.id, memberId: tenant.memberId },
				params.template
			)
		};
	} catch (cause) {
		if (cause instanceof WorkflowAdministrationAccessError)
			redirect(303, routes.dashboard(tenant.slug));
		if (cause instanceof WorkflowAdministrationValidationError) {
			redirect(303, appPath(tenant.slug, 'workflow'));
		}
		throw cause;
	}
};

export const actions = {
	addNode: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowNode({
				actor,
				publicId: params.template,
				nodeKey: String(data.get('nodeKey') ?? ''),
				label: String(data.get('label') ?? ''),
				nodeType: String(data.get('nodeType') ?? 'activity') as WorkflowNodeType,
				displayOrder: Number(data.get('displayOrder') ?? 50)
			});
			return { success: 'Process step added.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	addLink: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addWorkflowLink({
				actor,
				publicId: params.template,
				fromNodeKey: String(data.get('fromNodeKey') ?? ''),
				toNodeKey: String(data.get('toNodeKey') ?? ''),
				eventKey: String(data.get('eventKey') ?? ''),
				loop: data.get('loop') === 'on',
				terminateOpenPredecessors: data.get('terminateOpenPredecessors') === 'on',
				displayOrder: Number(data.get('displayOrder') ?? 50)
			});
			return { success: 'Process route connected.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	deleteLink: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteWorkflowLink({
				actor,
				publicId: params.template,
				linkPublicId: String(data.get('linkPublicId') ?? '')
			});
			return { success: 'Process route removed.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	deleteNode: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteWorkflowNode({
				actor,
				publicId: params.template,
				nodeKey: String(data.get('nodeKey') ?? '')
			});
			return { success: 'Process step removed.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	publish: async ({ request, params, url }) => {
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await publishWorkflowTemplate({ actor, publicId: params.template });
			return { success: 'Workflow published and frozen as an immutable major version.' };
		} catch (cause) {
			return handled(cause);
		}
	},
	revise: async ({ request, params, url }) => {
		const { actor, access } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const revision = await reviseWorkflowTemplate({ actor, publicId: params.template });
			redirect(
				303,
				`${appPath(access.organisationRouteSlug, 'workflow')}/${revision.publicId}/designer`
			);
		} catch (cause) {
			return handled(cause);
		}
	}
} satisfies Actions;
