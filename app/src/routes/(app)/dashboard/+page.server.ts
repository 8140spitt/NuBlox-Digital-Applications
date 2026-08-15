import type { PageServerLoad } from './$types';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { OrganisationRoleRepository } from '$lib/server/organisations/role-repository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) {
		return { canInviteMembers: false, roles: [] };
	}

	const actor = {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
	const invitationPermission = await new PermissionService(getDatabase()).decide(actor, 'member.invite');
	const roles = invitationPermission.allowed
		? await new OrganisationRoleRepository(getDatabase()).listActiveForOrganisation(
				locals.tenant.organisationId
			)
		: [];

	return {
		canInviteMembers: invitationPermission.allowed,
		roles
	};
};
