import { randomUUID } from 'node:crypto';
import type { RequestEvent } from '@sveltejs/kit';
import type { TenantContext } from '$lib/types/request-context';

const CORRELATION_HEADER = 'x-correlation-id';

export function resolveCorrelationId(event: RequestEvent): string {
	const inbound = event.request.headers.get(CORRELATION_HEADER);
	return inbound && inbound.length > 0 ? inbound : randomUUID();
}

export async function resolveTenantContext(event: RequestEvent): Promise<TenantContext> {
	const requestedOrganisation = event.request.headers.get('x-organisation-id');

	// Never trust browser-supplied organisation identifiers for write access.
	if (requestedOrganisation) {
		return {
			organisationId: null,
			membershipVerified: false
		};
	}

	return {
		organisationId: null,
		membershipVerified: false
	};
}

export { CORRELATION_HEADER };
