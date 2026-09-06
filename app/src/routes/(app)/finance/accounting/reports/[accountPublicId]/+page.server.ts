import { error as httpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingReportDrillthroughService } from '$lib/server/finance/accounting-report-drillthrough-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
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
	const periodPublicId = url.searchParams.get('period');
	if (!periodPublicId)
		throw httpError(400, 'Accounting period is required for report drill-through.');
	try {
		return await new AccountingReportDrillthroughService(getDatabase()).getAccountWorkspace(actor, {
			accountPublicId: params.accountPublicId,
			periodPublicId,
			currencyCode: url.searchParams.get('currency')
		});
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Accounting reporting access is not permitted.');
		if (cause instanceof RecordNotFoundError)
			throw httpError(404, 'Accounting report detail not found.');
		if (cause instanceof FinanceValidationError) throw httpError(400, cause.message);
		throw cause;
	}
};
