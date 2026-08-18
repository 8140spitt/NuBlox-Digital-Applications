import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingPeriodService, type AccountingPeriodState } from '$lib/server/finance/accounting-period-service';
import { FinanceAccessPolicy, FinanceValidationError } from '$lib/server/finance/finance-common';
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
	const db = getDatabase();
	try {
		const service = new AccountingPeriodService(db);
		const policy = new FinanceAccessPolicy(db);
		const [periods, financialYears, configure, softClose, hardClose, reopen] = await Promise.all([
			service.list(actor),
			db.selectFrom('accounting_financial_years')
				.select(['public_id as publicId', 'name', 'starts_on as startsOn', 'ends_on as endsOn'])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('starts_on', 'desc')
				.execute(),
			policy.mutationDecision(actor, 'finance.accounting.period.configure'),
			policy.mutationDecision(actor, 'finance.accounting.period.soft-close'),
			policy.mutationDecision(actor, 'finance.accounting.period.hard-close'),
			policy.mutationDecision(actor, 'finance.accounting.period.reopen')
		]);
		return {
			periods,
			financialYears,
			canConfigure: configure.allowed,
			canSoftClose: softClose.allowed,
			canHardClose: hardClose.allowed,
			canReopen: reopen.allowed
		};
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
	transition: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingPeriodService(getDatabase()).transition(actor, {
				periodPublicId: String(data.get('periodPublicId') ?? ''),
				toState: String(data.get('toState') ?? '') as AccountingPeriodState,
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
