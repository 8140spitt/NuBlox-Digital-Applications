import { error as httpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialLifecycleService } from '$lib/server/commercial/commercial-lifecycle-service';
import { ContractService } from '$lib/server/contracts/contract-service';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const db = getDatabase();
		const portfolio = await new ContractService(db).listPortfolio(actor);
		if (!portfolio.canView) {
			return {
				...portfolio,
				canFormContract: false,
				acceptedQuotationsAwaitingContract: []
			};
		}
		const progression = await new CommercialLifecycleService(db).listAcceptedQuotationsAwaitingContract(
			actor
		);
		return { ...portfolio, ...progression };
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Contract access is not permitted.');
		throw cause;
	}
};
