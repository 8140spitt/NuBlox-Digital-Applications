import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessService } from '$lib/server/external-access/external-access-service';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';
import { RouteContextService } from '$lib/server/routing/route-context-service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) throw redirect(303, '/signin');

	const db = getDatabase();
	const memberships = await new OrganisationMembershipRepository(db).listActiveMembershipsForUser(
		locals.actor.userId
	);
	if (memberships.length === 0) {
		const [hasPortalAccess, externalProjects] = await Promise.all([
			new ExternalAccessService(db).hasActiveAccess(locals.actor.authUserId),
			new ProjectExternalCollaborationService(db).listExternalPortalProjects(
				locals.actor.authUserId
			)
		]);
		if (hasPortalAccess || externalProjects.length > 0) {
			const dashboard = await new RouteContextService(db).defaultPortalDashboard(
				locals.actor.authUserId
			);
			if (dashboard) throw redirect(303, dashboard);
		}
	}

	return {
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		currentOrganisationPublicId: locals.tenant.organisationPublicId,
		memberships
	};
};
