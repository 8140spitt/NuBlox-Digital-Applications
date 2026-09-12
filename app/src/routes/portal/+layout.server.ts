import { error, redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import {
	parseCanonicalRoute,
	portalDashboardPath,
	portalLoginPath,
	tenantPath
} from '$lib/routing/route-contract';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessService } from '$lib/server/external-access/external-access-service';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';
import { RouteContextService } from '$lib/server/routing/route-context-service';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	const canonical = parseCanonicalRoute(url.pathname);
	if (canonical?.kind === 'portal') {
		if (!locals.actor) {
			throw redirect(
				303,
				`${portalLoginPath(canonical.tenantSlug, canonical.partySlug)}?returnTo=${encodeURIComponent(url.pathname)}`
			);
		}
		const context = await new RouteContextService(getDatabase()).findPortalContext(
			locals.actor.authUserId,
			canonical.tenantSlug,
			canonical.partySlug
		);
		if (!context) throw error(404, 'Portal context not found.');
		return {
			mode: 'external' as const,
			actor: {
				displayName: locals.actor.displayName,
				email: locals.actor.email
			},
			organisation: {
				publicId: context.organisationPublicId,
				name: context.organisationName,
				routeSlug: context.tenantSlug
			},
			party: {
				publicId: context.partyPublicId,
				name: context.partyName,
				routeSlug: context.partySlug
			},
			portalBase: `/${context.tenantSlug}/portal/${context.partySlug}`,
			dashboardHref: portalDashboardPath(context.tenantSlug, context.partySlug),
			backToAppHref: null,
			canManage: false,
			hasNetworkAccess: true
		};
	}

	if (!locals.actor) throw redirect(303, `/signin?returnTo=${encodeURIComponent(url.pathname)}`);
	const db = getDatabase();
	const [hasNetworkAccess, externalProjects] = await Promise.all([
		new ExternalAccessService(db).hasActiveAccess(locals.actor.authUserId),
		new ProjectExternalCollaborationService(db).listExternalPortalProjects(locals.actor.authUserId)
	]);
	const hasExternalWorkspace = hasNetworkAccess || externalProjects.length > 0;

	if (
		locals.tenant.membershipVerified &&
		locals.tenant.organisationId &&
		locals.tenant.memberId &&
		locals.tenant.routeSlug
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
		const tenantSlug = locals.tenant.routeSlug;
		if (decisions.get('portal.view')?.allowed) {
			return {
				mode: 'member' as const,
				actor: {
					displayName: locals.actor.displayName,
					email: locals.actor.email
				},
				organisation: {
					publicId: organisation.publicId,
					name: organisation.tradingName ?? organisation.legalName,
					routeSlug: tenantSlug
				},
				party: null,
				portalBase: tenantPath(tenantSlug, '/portal/manage'),
				dashboardHref: tenantPath(tenantSlug, '/portal/manage'),
				backToAppHref: tenantPath(tenantSlug, '/dashboard'),
				canManage: decisions.get('portal.manage')?.allowed ?? false,
				hasNetworkAccess: hasExternalWorkspace
			};
		}
		if (!hasExternalWorkspace) throw error(403, 'Portal access is not available.');
	}

	const externalDashboard = await new RouteContextService(db).defaultPortalDashboard(
		locals.actor.authUserId
	);
	if (externalDashboard) throw redirect(303, externalDashboard);
	throw redirect(303, '/select-organisation');
};
