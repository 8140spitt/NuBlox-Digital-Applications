import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { getDatabase } from '$lib/server/db/database';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) throw redirect(303, '/signin');

	const db = getDatabase();
	const memberships = await new OrganisationMembershipRepository(db).listActiveMembershipsForUser(
		locals.actor.userId
	);
	if (memberships.length === 0) {
		const externalProjects = await new ProjectExternalCollaborationService(
			db
		).listExternalPortalProjects(locals.actor.authUserId);
		if (externalProjects.length > 0) throw redirect(303, '/portal');
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
