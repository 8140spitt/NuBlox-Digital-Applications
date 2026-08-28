import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { SupplierPaymentService } from '$lib/server/finance/supplier-payment-service';
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
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: cause.message });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return {
			...(await new SupplierPaymentService(getDatabase()).getWorkspace(actor)),
			currentMemberId: actor.memberId,
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) {
			throw httpError(403, 'Supplier-payment access is not permitted.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			const created = await new SupplierPaymentService(getDatabase()).createPayment(actor, {
				paymentMethodCode: String(data.get('paymentMethodCode') ?? ''),
				requestedPaymentDate: String(data.get('requestedPaymentDate') ?? ''),
				paymentReference: String(data.get('paymentReference') ?? '') || null,
				allocations: [
					{
						documentPublicId: String(data.get('documentPublicId') ?? ''),
						amount: String(data.get('amount') ?? '')
					}
				]
			});
			throw redirect(303, `/finance/supplier-payments#payment-${encodeURIComponent(created)}`);
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	approve: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new SupplierPaymentService(getDatabase()).approvePayment(
				actor,
				String(data.get('paymentPublicId') ?? '')
			);
			throw redirect(303, '/finance/supplier-payments');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	execute: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new SupplierPaymentService(getDatabase()).executePayment(
				actor,
				String(data.get('paymentPublicId') ?? ''),
				{ paymentReference: String(data.get('paymentReference') ?? '') || null }
			);
			throw redirect(303, '/finance/supplier-payments');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	cancel: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new SupplierPaymentService(getDatabase()).cancelPayment(
				actor,
				String(data.get('paymentPublicId') ?? ''),
				{ reason: String(data.get('reason') ?? '') }
			);
			throw redirect(303, '/finance/supplier-payments');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	reverse: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new SupplierPaymentService(getDatabase()).reversePayment(
				actor,
				String(data.get('paymentPublicId') ?? ''),
				{ reason: String(data.get('reason') ?? '') }
			);
			throw redirect(303, '/finance/supplier-payments');
		} catch (cause) {
			return actionFailure(cause);
		}
	}
};
