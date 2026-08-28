import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { BankReconciliationService } from '$lib/server/finance/bank-reconciliation-service';
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
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: cause.message });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return {
			...(await new BankReconciliationService(getDatabase()).getWorkspace(actor)),
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) {
			throw httpError(403, 'Bank reconciliation access is not permitted.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	createAccount: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BankReconciliationService(getDatabase()).createBankAccount(actor, {
				accountingAccountPublicId: String(data.get('accountingAccountPublicId') ?? ''),
				accountName: String(data.get('accountName') ?? ''),
				institutionName: String(data.get('institutionName') ?? ''),
				accountIdentifierLast4: String(data.get('accountIdentifierLast4') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? '')
			});
			throw redirect(303, '/finance/bank-reconciliation');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	recordStatement: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BankReconciliationService(getDatabase()).recordStatement(actor, {
				bankAccountPublicId: String(data.get('bankAccountPublicId') ?? ''),
				statementReference: String(data.get('statementReference') ?? ''),
				periodStart: String(data.get('periodStart') ?? ''),
				periodEnd: String(data.get('periodEnd') ?? ''),
				openingBalance: String(data.get('openingBalance') ?? ''),
				closingBalance: String(data.get('closingBalance') ?? ''),
				lines: [
					{
						externalTransactionId: String(data.get('externalTransactionId') ?? ''),
						bookedOn: String(data.get('bookedOn') ?? ''),
						valueOn: String(data.get('valueOn') ?? '') || null,
						direction: String(data.get('direction') ?? '') as 'debit' | 'credit',
						amount: String(data.get('amount') ?? ''),
						description: String(data.get('description') ?? ''),
						bankReference: String(data.get('bankReference') ?? '') || null
					}
				]
			});
			throw redirect(303, '/finance/bank-reconciliation');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	reconcile: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BankReconciliationService(getDatabase()).matchSupplierPayment(actor, {
				statementLinePublicId: String(data.get('statementLinePublicId') ?? ''),
				supplierPaymentPublicId: String(data.get('supplierPaymentPublicId') ?? '')
			});
			throw redirect(303, '/finance/bank-reconciliation');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	reverseMatch: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BankReconciliationService(getDatabase()).reverseMatch(
				actor,
				String(data.get('matchPublicId') ?? ''),
				String(data.get('reason') ?? '')
			);
			throw redirect(303, '/finance/bank-reconciliation');
		} catch (cause) {
			return actionFailure(cause);
		}
	}
};
