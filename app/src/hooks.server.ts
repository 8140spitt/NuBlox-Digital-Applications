import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

import { isLegacyTenantAppPath, portalPath, tenantPath } from '$lib/routing/route-contract';
import { auth } from '$lib/server/auth/better-auth';
import { getSessionActor } from '$lib/server/auth/session';
import {
	CORRELATION_HEADER,
	resolveCorrelationId,
	resolveTenantContext
} from '$lib/server/request-context';
import { getDatabase } from '$lib/server/db/database';
import { RouteContextService } from '$lib/server/routing/route-context-service';

function redirectResponse(location: string): Response {
	return new Response(null, { status: 307, headers: { location } });
}

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.correlationId = resolveCorrelationId(event);
	event.locals.actor = await getSessionActor(event);
	event.locals.tenant = await resolveTenantContext(event);

	const pathname = event.url.pathname;
	const suffix = event.url.search;
	if (event.locals.actor) {
		if (pathname === '/portal' || pathname.startsWith('/portal/')) {
			const legacyTaskMatch = pathname.match(
				/^\/portal\/(?:project-actions|supplier-quotes)\/([^/]+)$/
			);
			const workItemPublicId = legacyTaskMatch?.[1] ?? null;
			const isExternalTask = workItemPublicId !== null;
			if (isExternalTask || !event.locals.tenant.membershipVerified) {
				const routing = new RouteContextService(getDatabase());
				const context = workItemPublicId
					? await routing.findPortalContextForWorkItem(
							event.locals.actor.authUserId,
							workItemPublicId
						)
					: await routing.findDefaultPortalContext(event.locals.actor.authUserId);
				if (context) {
					const externalPath =
						pathname === '/portal' ? '/dashboard' : pathname.slice('/portal'.length);
					return redirectResponse(
						`${portalPath(context.tenantSlug, context.partySlug, externalPath)}${suffix}`
					);
				}
			}
			if (pathname === '/portal' && event.locals.tenant.routeSlug) {
				return redirectResponse(
					`${tenantPath(event.locals.tenant.routeSlug, '/portal/manage')}${suffix}`
				);
			}
		}

		if (isLegacyTenantAppPath(pathname) && event.locals.tenant.routeSlug) {
			return redirectResponse(`${tenantPath(event.locals.tenant.routeSlug, pathname)}${suffix}`);
		}
	}

	return svelteKitHandler({
		event,
		resolve: async (resolvedEvent) => {
			const response = await resolve(resolvedEvent);
			response.headers.set(CORRELATION_HEADER, event.locals.correlationId);
			return response;
		},
		auth,
		building
	});
};
