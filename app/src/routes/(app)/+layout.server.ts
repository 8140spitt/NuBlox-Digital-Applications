import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import { resolveAppNavigation, resolveQuickActions } from '$lib/navigation/app-navigation';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';

function returnTo(pathname: string): string {
	return `/signin?returnTo=${encodeURIComponent(pathname)}`;
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.actor) throw redirect(303, returnTo(url.pathname));
	if (
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.organisationPublicId ||
		!locals.tenant.memberId
	) {
		throw redirect(303, '/select-organisation');
	}

	const db = getDatabase();
	const [organisation, allowedPermissionKeys] = await Promise.all([
		new OrganisationRepository(db).findActiveById(locals.tenant.organisationId),
		new PermissionService(db).listAllowedPermissionKeys(locals.actor)
	]);
	if (!organisation) throw redirect(303, '/select-organisation');

	return {
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		organisation: {
			publicId: organisation.publicId,
			name: organisation.tradingName ?? organisation.legalName
		},
		navigation: resolveAppNavigation(allowedPermissionKeys),
		quickActions: resolveQuickActions(allowedPermissionKeys)
	};
};
