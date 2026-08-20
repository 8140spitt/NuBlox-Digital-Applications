import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

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
		!locals.tenant.memberId
	) {
		throw redirect(303, '/select-organisation');
	}

	const db = getDatabase();
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
};
