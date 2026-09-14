import { fail, redirect } from '@sveltejs/kit';
import { appPath, routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	createWorkflowTemplate,
	WorkflowAdministrationAccessError,
	WorkflowAdministrationValidationError
} from '$lib/server/platform/workflow-admin-service';
import type { Actions } from './$types';

export const actions = {
	default: async ({ request, params, url }) => {
		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));
		const formData = await request.formData();
		const values = {
			templateKey: String(formData.get('templateKey') ?? ''),
			name: String(formData.get('name') ?? ''),
			description: String(formData.get('description') ?? '')
		};
		try {
			const created = await createWorkflowTemplate({
				actor: {
					organisationId: access.organisationId,
					userId: access.userId,
					memberId: access.memberId
				},
				...values
			});
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
