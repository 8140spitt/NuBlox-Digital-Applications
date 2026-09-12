import { error as httpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { ReceivablesControlReportingService } from '$lib/server/finance/receivables-control-reporting-service';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ReceivablesControlReportingService(getDatabase()).getCustomerStatement(
			actor,
			params.customerPartyPublicId,
			{ from: url.searchParams.get('from'), to: url.searchParams.get('to') }
		);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError)
			throw httpError(404, 'Customer receivable account not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Receivables reporting is not permitted.');
		if (cause instanceof FinanceValidationError) throw httpError(400, cause.message);
		throw cause;
	}
};
