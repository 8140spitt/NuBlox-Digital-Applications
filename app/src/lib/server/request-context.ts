import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

import { parseCanonicalRoute } from '$lib/routing/route-contract';
import { getDatabase } from '$lib/server/db/database';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import type { TenantContext } from '$lib/types/request-context';

const CORRELATION_HEADER = 'x-correlation-id';
const ORGANISATION_COOKIE = 'nublox_organisation';
const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,128}$/;

export function resolveCorrelationId(event: RequestEvent): string {
	const inbound = event.request.headers.get(CORRELATION_HEADER)?.trim() ?? '';
	return CORRELATION_ID_PATTERN.test(inbound) ? inbound : randomUUID();
}

function emptyTenant(): TenantContext {
	return {
		organisationId: null,
		organisationPublicId: null,
		routeSlug: null,
		memberId: null,
		membershipVerified: false
	};
}

export async function resolveTenantContext(event: RequestEvent): Promise<TenantContext> {
	const actor = event.locals.actor;
	if (!actor) return emptyTenant();

	const repository = new OrganisationMembershipRepository(getDatabase());
	const pathname = event.url?.pathname;
	const canonical = pathname ? parseCanonicalRoute(pathname) : null;
	if (canonical && canonical.kind !== 'portal') {
		const membership = await repository.findActiveMembershipByOrganisationRouteSlug(
			actor.userId,
			canonical.tenantSlug
		);
		if (membership?.organisationPublicId && membership.organisationRouteSlug) {
			return {
				organisationId: membership.organisationId,
				organisationPublicId: membership.organisationPublicId,
				routeSlug: membership.organisationRouteSlug,
				memberId: membership.id,
				membershipVerified: true
			};
		}
		return emptyTenant();
	}

	const requestedOrganisation = event.cookies.get(ORGANISATION_COOKIE)?.trim();
	if (!requestedOrganisation) return emptyTenant();
	const membership = await repository.findActiveMembershipByOrganisationPublicId(
		actor.userId,
		requestedOrganisation
	);
	if (!membership?.organisationPublicId) return emptyTenant();

	return {
		organisationId: membership.organisationId,
		organisationPublicId: membership.organisationPublicId,
		routeSlug: membership.organisationRouteSlug ?? null,
		memberId: membership.id,
		membershipVerified: true
	};
}

export { CORRELATION_HEADER, ORGANISATION_COOKIE };
