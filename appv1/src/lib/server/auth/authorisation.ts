import { error } from '@sveltejs/kit';
import type { RequestContext } from '$lib/types/request-context';

export function requireAuthenticated(context: RequestContext): void {
	if (!context.actor) {
		throw error(401, 'Authentication required');
	}
}

export function assertTenantMembership(context: RequestContext): void {
	if (!context.tenant.organisationId || !context.tenant.membershipVerified) {
		throw error(403, 'Tenant membership is required');
	}
}
