import { error, redirect } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { decidePermissions } from '$lib/server/auth/permission-service';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, request, url }) => {
	if (!isRouteSlug(params.tenant)) {
		error(404, 'Tenant not found');
	}

	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
	}

	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) {
		redirect(303, routes.appNoAccess(params.tenant));
	}

	const toolPermissions = await decidePermissions({
		organisationId: access.organisationId,
		memberId: access.memberId,
		permissionKeys: ['lifecycle.view']
	});

	return {
		tenant: {
			slug: access.organisationRouteSlug,
			displayName: access.organisationName,
			organisationId: access.organisationId,
			organisationPublicId: access.organisationPublicId,
			memberId: access.memberId,
			memberPublicId: access.memberPublicId
		},
		user: {
			id: session.user.id,
			name: session.user.name,
			email: session.user.email
		},
		toolAccess: {
			lifecycle: toolPermissions.get('lifecycle.view')?.allowed === true
		}
	};
};
