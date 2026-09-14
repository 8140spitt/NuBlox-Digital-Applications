import { fail, redirect } from '@sveltejs/kit';
import { appPath, routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	createWorkflowTemplate,
	listWorkflowTemplates,
	WorkflowAdministrationAccessError,
	WorkflowAdministrationValidationError
} from '$lib/server/platform/workflow-admin-service';
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

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant, user } = await parent();
	const actor = {
		organisationId: tenant.organisationId,
		userId: user.id,
		memberId: tenant.memberId
	};
	try {
		return { templates: await listWorkflowTemplates(actor) };
	} catch (cause) {
		if (cause instanceof WorkflowAdministrationAccessError) redirect(303, routes.dashboard(tenant.slug));
		throw cause;
	}
};

export const actions = {
	create: async ({ request, params, url }) => {
		const formData = await request.formData();
		const values = {
			templateKey: String(formData.get('templateKey') ?? ''),
			name: String(formData.get('name') ?? ''),
			description: String(formData.get('description') ?? '')
		};
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const created = await createWorkflowTemplate({ actor, ...values });
			redirect(303, `${appPath(access.organisationRouteSlug, 'workflow')}/${created.publicId}`);
		} catch (cause) {
			if (cause instanceof WorkflowAdministrationValidationError) {
				return fail(400, { values, formError: cause.message });
			}
			if (cause instanceof WorkflowAdministrationAccessError) {
				return fail(403, { values, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
