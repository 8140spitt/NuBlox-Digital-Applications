import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessService } from '$lib/server/external-access/external-access-service';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';

function returnTo(pathname: string): string {
	return `/signin?returnTo=${encodeURIComponent(pathname)}`;
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.actor) throw redirect(303, returnTo(url.pathname));

	const db = getDatabase();
	const [hasNetworkAccess, externalProjects] = await Promise.all([
		new ExternalAccessService(db).hasActiveAccess(locals.actor.authUserId),
		new ProjectExternalCollaborationService(db).listExternalPortalProjects(locals.actor.authUserId)
	]);
	const hasExternalWorkspace = hasNetworkAccess || externalProjects.length > 0;

	if (locals.tenant.membershipVerified && locals.tenant.organisationId && locals.tenant.memberId) {
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
		const canViewMemberPortal = decisions.get('portal.view')?.allowed ?? false;
		if (canViewMemberPortal) {
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
				canManage: decisions.get('portal.manage')?.allowed ?? false,
				hasNetworkAccess: hasExternalWorkspace
			};
		}
		if (!hasExternalWorkspace) {
			throw error(403, 'NuBlox Network is not available for this identity or membership.');
		}
	}

	if (!hasExternalWorkspace) throw redirect(303, '/select-organisation');

	return {
		mode: 'external' as const,
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		organisation: null,
		canManage: false,
		hasNetworkAccess: true
	};
};
