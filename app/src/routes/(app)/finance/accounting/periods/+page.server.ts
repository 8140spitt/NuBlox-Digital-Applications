import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingPeriodService } from '$lib/server/finance/accounting-period-service';
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
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The requested accounting-period record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/accounting/periods');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new AccountingPeriodService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Accounting-period access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createFinancialYear: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).createFinancialYear(actor, {
				yearCode: String(data.get('yearCode') ?? ''),
				name: String(data.get('name') ?? ''),
				startsOn: String(data.get('startsOn') ?? ''),
				endsOn: String(data.get('endsOn') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	createPeriod: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).createPeriod(actor, {
				financialYearPublicId: String(data.get('financialYearPublicId') ?? ''),
				periodNumber: Number(data.get('periodNumber') ?? 0),
				name: String(data.get('name') ?? ''),
				startsOn: String(data.get('startsOn') ?? ''),
				endsOn: String(data.get('endsOn') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	softClose: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).softClose(
				actor,
				String(data.get('periodPublicId') ?? ''),
				String(data.get('reason') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	hardClose: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).hardClose(
				actor,
				String(data.get('periodPublicId') ?? ''),
				String(data.get('reason') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reopen: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).reopen(
				actor,
				String(data.get('periodPublicId') ?? ''),
				String(data.get('reason') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
