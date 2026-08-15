import { error as httpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialService } from '$lib/server/commercial/commercial-service';
import { getDatabase } from '$lib/server/db/database';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return { organisationId: locals.tenant.organisationId, userId: locals.actor.userId, memberId: locals.tenant.memberId, correlationId: locals.correlationId };
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	return new CommercialService(getDatabase()).listQuotations(actor);
};
