import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountsPayableService } from '$lib/server/finance/accounts-payable-service';
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
			...(await new AccountsPayableService(getDatabase()).getWorkspace(actor)),
			currentMemberId: actor.memberId,
			today: new Date().toISOString().slice(0, 10)
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Accounts-payable access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		const orderLineToken = String(data.get('purchaseOrderLine') ?? '').trim();
		const [purchaseOrderPublicId = '', lineNumberText = ''] = orderLineToken.split('|');
		try {
			const created = await new AccountsPayableService(getDatabase()).createSupplierDocument(
				actor,
				{
					documentType: String(data.get('documentType') ?? 'invoice') as 'invoice' | 'credit_note',
					supplierPublicId: String(data.get('supplierPublicId') ?? ''),
					purchaseOrderPublicId: purchaseOrderPublicId || null,
					supplierDocumentNumber: String(data.get('supplierDocumentNumber') ?? ''),
					invoiceDate: String(data.get('invoiceDate') ?? ''),
					taxDate: String(data.get('taxDate') ?? ''),
					dueDate: String(data.get('dueDate') ?? ''),
					currencyCode: String(data.get('currencyCode') ?? ''),
					lines: [
						{
							description: String(data.get('description') ?? ''),
							quantity: String(data.get('quantity') ?? ''),
							unitRate: String(data.get('unitRate') ?? ''),
							purchaseOrderLineNumber: lineNumberText ? Number(lineNumberText) : null,
							taxCategoryPublicId: String(data.get('taxCategoryPublicId') ?? '') || null
						}
					]
				}
			);
			throw redirect(303, `/finance/accounts-payable#ap-${encodeURIComponent(created)}`);
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	submit: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountsPayableService(getDatabase()).submitDocument(
				actor,
				String(data.get('documentPublicId') ?? '')
			);
			throw redirect(303, '/finance/accounts-payable');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	match: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountsPayableService(getDatabase()).retryMatch(
				actor,
				String(data.get('documentPublicId') ?? '')
			);
			throw redirect(303, '/finance/accounts-payable');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	resolve: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountsPayableService(getDatabase()).resolveException(
				actor,
				String(data.get('exceptionPublicId') ?? ''),
				{
					note: String(data.get('note') ?? ''),
					waive: String(data.get('waive') ?? '') === 'true'
				}
			);
			throw redirect(303, '/finance/accounts-payable');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	approve: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountsPayableService(getDatabase()).approveDocument(
				actor,
				String(data.get('documentPublicId') ?? ''),
				String(data.get('note') ?? '')
			);
			throw redirect(303, '/finance/accounts-payable');
		} catch (cause) {
			return actionFailure(cause);
		}
	},
	void: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountsPayableService(getDatabase()).voidDocument(
				actor,
				String(data.get('documentPublicId') ?? '')
			);
			throw redirect(303, '/finance/accounts-payable');
		} catch (cause) {
			return actionFailure(cause);
		}
	}
};
