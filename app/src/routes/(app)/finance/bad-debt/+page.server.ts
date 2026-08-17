import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { BadDebtMutationService } from '$lib/server/finance/bad-debt-mutation-service';
import { BadDebtQueryService } from '$lib/server/finance/bad-debt-query-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return { organisationId: locals.tenant.organisationId, userId: locals.actor.userId, memberId: locals.tenant.memberId, correlationId: locals.correlationId };
}
function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The invoice is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try { return await new BadDebtQueryService(getDatabase()).getPortfolio(actor); }
	catch (cause) { if (cause instanceof TenantAccessError) throw httpError(403, 'Bad-debt access is not permitted.'); throw cause; }
};

export const actions: Actions = {
	start: async ({ request, locals }) => {
		const actor = actorFromLocals(locals); if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			const created = await new BadDebtMutationService(getDatabase()).startCase(actor, { invoicePublicId: String(data.get('invoicePublicId') ?? ''), reason: String(data.get('reason') ?? '') });
			throw redirect(303, `/finance/bad-debt/${encodeURIComponent(created.publicId)}`);
		} catch (cause) { if (cause instanceof Response) throw cause; return actionFailure(cause); }
	}
};
