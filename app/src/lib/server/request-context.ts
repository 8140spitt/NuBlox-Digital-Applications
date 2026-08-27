import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';

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
