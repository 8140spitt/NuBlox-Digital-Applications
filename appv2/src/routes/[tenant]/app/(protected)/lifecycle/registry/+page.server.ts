import { fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	installObjectTemplatePack,
	listObjectTemplateLibrary,
	ObjectTemplateLibraryAccessError,
	ObjectTemplateLibraryValidationError
} from '$lib/server/platform/object-template-library-service';
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
		return { groups: await listObjectTemplateLibrary(actor) };
	} catch (cause) {
		if (cause instanceof ObjectTemplateLibraryAccessError) {
			redirect(303, routes.dashboard(tenant.slug));
		}
		throw cause;
	}
};

export const actions = {
	install: async ({ request, params, url }) => {
		const formData = await request.formData();
		const objectType = String(formData.get('objectType') ?? '');
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const installed = await installObjectTemplatePack({ actor, objectType });
			redirect(
				303,
				routes.lifecycleTemplate(access.organisationRouteSlug, installed.lifecyclePublicId)
			);
		} catch (cause) {
			if (cause instanceof ObjectTemplateLibraryValidationError) {
				return fail(400, { objectType, formError: cause.message });
			}
			if (cause instanceof ObjectTemplateLibraryAccessError) {
				return fail(403, { objectType, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
