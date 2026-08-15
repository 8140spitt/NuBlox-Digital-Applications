import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/database';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import type { TenantContext } from '$lib/types/request-context';

const CORRELATION_HEADER = 'x-correlation-id';
const ORGANISATION_COOKIE = 'nublox_organisation';

export function resolveCorrelationId(event: RequestEvent): string {
	const inbound = event.request.headers.get(CORRELATION_HEADER);
	return inbound && inbound.length > 0 ? inbound : randomUUID();
}

export async function resolveTenantContext(event: RequestEvent): Promise<TenantContext> {
	const actor = event.locals.actor;
	const requestedOrganisation = event.cookies.get(ORGANISATION_COOKIE)?.trim();

	if (!actor || !requestedOrganisation) {
		return {
			organisationId: null,
			organisationPublicId: null,
			memberId: null,
			membershipVerified: false
		};
	}

	const membership = await new OrganisationMembershipRepository(
		getDatabase()
	).findActiveMembershipByOrganisationPublicId(actor.userId, requestedOrganisation);

	if (!membership?.organisationPublicId) {
		return {
			organisationId: null,
			organisationPublicId: null,
			memberId: null,
			membershipVerified: false
		};
	}

	return {
		organisationId: membership.organisationId,
		organisationPublicId: membership.organisationPublicId,
		memberId: membership.id,
		membershipVerified: true
	};
}

export { CORRELATION_HEADER, ORGANISATION_COOKIE };
