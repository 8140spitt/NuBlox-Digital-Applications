import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { BadDebtService } from '$lib/server/finance/bad-debt-service';
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
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The requested invoice, write-off, recovery or payment is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/bad-debt');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new BadDebtService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Bad-debt access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	writeOff: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtService(getDatabase()).writeOff(actor, {
				invoicePublicId: String(data.get('invoicePublicId') ?? ''),
				amount: String(data.get('amount') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseWriteOff: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtService(getDatabase()).reverseWriteOff(actor, {
				writeOffPublicId: String(data.get('writeOffPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	recordRecovery: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtService(getDatabase()).recordRecovery(actor, {
				writeOffPublicId: String(data.get('writeOffPublicId') ?? ''),
				paymentPublicId: String(data.get('paymentPublicId') ?? ''),
				amount: String(data.get('amount') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseRecovery: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtService(getDatabase()).reverseRecovery(actor, {
				recoveryPublicId: String(data.get('recoveryPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};