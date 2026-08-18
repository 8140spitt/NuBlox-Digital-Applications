import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { InvoiceService } from '$lib/server/finance/invoice-service';
import { ReceivablePositionService } from '$lib/server/finance/receivable-position-service';
import { TaxSettingsService } from '$lib/server/finance/tax-settings-service';
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

function positiveInt(value: FormDataEntryValue | null, label: string): number {
	const parsed = Number(String(value ?? ''));
	if (!Number.isSafeInteger(parsed) || parsed <= 0)
		throw new FinanceValidationError(`${label} is invalid.`);
	return parsed;
}

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError)
		return fail(404, { actionError: 'The invoice or requested record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function redirectHere(invoicePublicId: string): never {
	throw redirect(303, `/finance/invoices/${encodeURIComponent(invoicePublicId)}`);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const db = getDatabase();
		await new TaxSettingsService(db).ensureDefaults(actor);
		const [workspace, receivablePosition] = await Promise.all([
			new InvoiceService(db).getWorkspace(actor, params.invoicePublicId),
			new ReceivablePositionService(db).getInvoicePosition(actor, params.invoicePublicId)
		]);
		return { ...workspace, receivablePosition };
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Invoice not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Accounts-receivable access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	updateDraft: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new InvoiceService(getDatabase()).updateDraft(actor, {
				invoicePublicId: params.invoicePublicId,
				invoiceType: String(data.get('invoiceType') ?? ''),
				paymentTermPublicId: String(data.get('paymentTermPublicId') ?? ''),
				dueDate: String(data.get('dueDate') ?? ''),
				customerPurchaseOrderReference: String(data.get('customerPurchaseOrderReference') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.invoicePublicId);
	},
	addLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new InvoiceService(getDatabase()).addLine(actor, {
				invoicePublicId: params.invoicePublicId,
				salesItemTypeCode: String(data.get('salesItemTypeCode') ?? ''),
				unitCode: String(data.get('unitCode') ?? ''),
				description: String(data.get('description') ?? ''),
				quantity: String(data.get('quantity') ?? ''),
				unitRate: String(data.get('unitRate') ?? ''),
				taxCategoryPublicId: String(data.get('taxCategoryPublicId') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.invoicePublicId);
	},
	removeLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new InvoiceService(getDatabase()).removeLine(
				actor,
				params.invoicePublicId,
				positiveInt(data.get('lineNumber'), 'Invoice line')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.invoicePublicId);
	},
	issue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new InvoiceService(getDatabase()).issue(actor, {
				invoicePublicId: params.invoicePublicId,
				deliveryChannel: String(data.get('deliveryChannel') ?? ''),
				recipientName: String(data.get('recipientName') ?? ''),
				recipientEmail: String(data.get('recipientEmail') ?? ''),
				note: String(data.get('note') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.invoicePublicId);
	}
};
