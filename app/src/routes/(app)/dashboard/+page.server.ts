import type { PageServerLoad } from './$types';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { OrganisationRoleRepository } from '$lib/server/organisations/role-repository';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) {
		return { canInviteMembers: false, canAssignRoles: false, roles: [] };
	}

	const actor = {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
	const decisions = await new PermissionService(getDatabase()).decideMany(actor, [
		'organisation.manage',
		'member.invite',
		'member.manage'
	]);
	const canManageOrganisation = decisions.get('organisation.manage')?.allowed ?? false;
	const canInviteMembers =
		canManageOrganisation || (decisions.get('member.invite')?.allowed ?? false);
	const canAssignRoles =
		canManageOrganisation || (decisions.get('member.manage')?.allowed ?? false);
	const roles =
		canInviteMembers && canAssignRoles
			? await new OrganisationRoleRepository(getDatabase()).listActiveForOrganisation(
					locals.tenant.organisationId
				)
			: [];

	return {
		canInviteMembers,
		canAssignRoles,
		roles
	};
};
