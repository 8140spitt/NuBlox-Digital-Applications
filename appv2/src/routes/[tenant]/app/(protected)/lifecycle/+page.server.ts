import { fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	createLifecycleTemplate,
	LifecycleAdministrationAccessError,
	LifecycleAdministrationValidationError,
	listLifecycleTemplates
} from '$lib/server/platform/lifecycle-admin-service';
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
		return { templates: await listLifecycleTemplates(actor) };
	} catch (cause) {
		if (cause instanceof LifecycleAdministrationAccessError) {
			redirect(303, routes.dashboard(tenant.slug));
		}
		throw cause;
	}
};

export const actions = {
	create: async ({ request, params, url }) => {
		const formData = await request.formData();
		const values = {
			templateKey: String(formData.get('templateKey') ?? ''),
			name: String(formData.get('name') ?? ''),
			description: String(formData.get('description') ?? ''),
			objectType: String(formData.get('objectType') ?? ''),
			mode: String(formData.get('mode') ?? 'basic')
		};
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const created = await createLifecycleTemplate({
				actor,
				templateKey: values.templateKey,
				name: values.name,
				description: values.description,
				objectType: values.objectType,
				mode: values.mode === 'advanced' ? 'advanced' : 'basic'
			});
			redirect(303, routes.lifecycleTemplate(access.organisationRouteSlug, created.publicId));
		} catch (cause) {
			if (cause instanceof LifecycleAdministrationValidationError) {
				return fail(400, { values, formError: cause.message });
			}
			if (cause instanceof LifecycleAdministrationAccessError) {
				return fail(403, { values, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
