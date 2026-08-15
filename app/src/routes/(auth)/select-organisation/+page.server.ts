import { redirect, type PageServerLoad } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/database';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor) throw redirect(303, '/signin');

	const memberships = await new OrganisationMembershipRepository(
		getDatabase()
	).listActiveMembershipsForUser(locals.actor.userId);

	return {
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		currentOrganisationPublicId: locals.tenant.organisationPublicId,
		memberships
	};
};
