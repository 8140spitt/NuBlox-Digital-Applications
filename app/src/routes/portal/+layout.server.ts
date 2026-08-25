import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';

function returnTo(pathname: string): string {
	return `/signin?returnTo=${encodeURIComponent(pathname)}`;
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.actor) throw redirect(303, returnTo(url.pathname));

	const db = getDatabase();
	if (
		locals.tenant.membershipVerified &&
		locals.tenant.organisationId &&
		locals.tenant.memberId
	) {
		const actor = {
			organisationId: locals.tenant.organisationId,
			userId: locals.actor.userId,
			memberId: locals.tenant.memberId,
			correlationId: locals.correlationId
		};
		const [organisation, decisions] = await Promise.all([
			new OrganisationRepository(db).findActiveById(locals.tenant.organisationId),
			new PermissionService(db).decideMany(actor, ['portal.view', 'portal.manage'])
		]);
		if (!organisation) throw redirect(303, '/select-organisation');
		if (!(decisions.get('portal.view')?.allowed ?? false)) {
			throw error(403, 'The collaboration portal is not available for this membership.');
		}

		return {
			mode: 'member' as const,
			actor: {
				displayName: locals.actor.displayName,
				email: locals.actor.email
			},
			organisation: {
				publicId: organisation.publicId,
				name: organisation.tradingName ?? organisation.legalName
			},
			canManage: decisions.get('portal.manage')?.allowed ?? false
		};
	}

	const externalProjects = await new ProjectExternalCollaborationService(
		db
	).listExternalPortalProjects(locals.actor.authUserId);
	if (externalProjects.length === 0) throw redirect(303, '/select-organisation');

	return {
		mode: 'external' as const,
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		organisation: null,
		canManage: false
	};
};