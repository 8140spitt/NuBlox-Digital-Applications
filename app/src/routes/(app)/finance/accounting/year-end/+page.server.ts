import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingYearEndService } from '$lib/server/finance/accounting-year-end-service';
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

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The requested year-end accounting record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/accounting/year-end');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new AccountingYearEndService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Year-end accounting access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	prepare: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingYearEndService(getDatabase()).prepare(actor, {
				financialYearPublicId: String(data.get('financialYearPublicId') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	authorise: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingYearEndService(getDatabase()).authorise(actor, {
				preparationPublicId: String(data.get('preparationPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverse: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingYearEndService(getDatabase()).reverse(actor, {
				closePublicId: String(data.get('closePublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
