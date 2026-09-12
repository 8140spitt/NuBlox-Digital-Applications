import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { parseCanonicalRoute, portalLoginPath } from '$lib/routing/route-contract';
import { getDatabase } from '$lib/server/db/database';
import { RouteContextService } from '$lib/server/routing/route-context-service';

export const load: PageServerLoad = async ({ locals, url }) => {
	const canonical = parseCanonicalRoute(url.pathname);
	if (canonical?.kind !== 'portal') {
		if (!locals.actor) throw redirect(303, '/signin');
		const dashboard = await new RouteContextService(getDatabase()).defaultPortalDashboard(
			locals.actor.authUserId
		);
		if (dashboard) throw redirect(303, dashboard);
		throw redirect(303, '/select-organisation');
	}
	if (!locals.actor) {
		throw redirect(
			303,
			`${portalLoginPath(canonical.tenantSlug, canonical.partySlug)}?returnTo=${encodeURIComponent(url.pathname)}`
		);
	}

	const service = new RouteContextService(getDatabase());
	const context = await service.findPortalContext(
		locals.actor.authUserId,
		canonical.tenantSlug,
		canonical.partySlug
	);
	if (!context) throw error(404, 'Portal context not found.');
	const [externalProjects, externalWork] = await Promise.all([
		service.listPortalProjects(locals.actor.authUserId, context),
		service.listPortalWork(locals.actor.authUserId, context, { includeCompleted: true })
	]);

	return {
		mode: 'external' as const,
		party: {
			publicId: context.partyPublicId,
			name: context.partyName,
			routeSlug: context.partySlug
		},
		canView: true,
		canRespond: externalWork.some((item) => item.state === 'open'),
		canManage: false,
		projects: [],
		rfis: [],
		submittals: [],
		instructions: [],
		transmittals: [],
		invitations: [],
		externalProjects,
		externalWork: externalWork.map((item) => ({
			...item,
			dueAt: item.dueAt?.toISOString() ?? null,
			completedAt: item.completedAt?.toISOString() ?? null
		}))
	};
};
