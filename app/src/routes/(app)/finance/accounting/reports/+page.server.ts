import { error as httpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingReportingService } from '$lib/server/finance/accounting-reporting-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new AccountingReportingService(getDatabase()).getWorkspace(actor, {
			periodPublicId: url.searchParams.get('period'),
			currencyCode: url.searchParams.get('currency')
		});
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Accounting reporting access is not permitted.');
		if (cause instanceof FinanceValidationError) throw httpError(400, cause.message);
		throw cause;
	}
};
