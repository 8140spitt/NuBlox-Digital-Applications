import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { PaymentControlService } from '$lib/server/finance/payment-control-service';
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
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The payment, allocation or invoice is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new PaymentControlService(getDatabase()).getWorkspace(actor, params.paymentPublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Payment not found.');
		if (cause instanceof TenantAccessError) throw httpError(403, 'Payment access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	allocate: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new PaymentControlService(getDatabase()).allocate(actor, {
				paymentPublicId: params.paymentPublicId,
				invoicePublicId: String(data.get('invoicePublicId') ?? ''),
				amount: String(data.get('amount') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, `/finance/payments/${encodeURIComponent(params.paymentPublicId)}`);
	},
	reverseAllocation: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new PaymentControlService(getDatabase()).reverseAllocation(actor, {
				paymentPublicId: params.paymentPublicId,
				allocationId: String(data.get('allocationId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, `/finance/payments/${encodeURIComponent(params.paymentPublicId)}`);
	},
	reversePayment: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new PaymentControlService(getDatabase()).reversePayment(actor, {
				paymentPublicId: params.paymentPublicId,
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, `/finance/payments/${encodeURIComponent(params.paymentPublicId)}`);
	}
};
