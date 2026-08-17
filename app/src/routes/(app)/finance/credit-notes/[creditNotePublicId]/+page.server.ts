import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { CreditNoteService } from '$lib/server/finance/credit-note-service';
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

function positiveInt(value: FormDataEntryValue | null, label: string): number {
	const parsed = Number(String(value ?? ''));
	if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new FinanceValidationError(`${label} is invalid.`);
	return parsed;
}

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The credit note or invoice line is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function redirectHere(publicId: string): never {
	throw redirect(303, `/finance/credit-notes/${encodeURIComponent(publicId)}`);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CreditNoteService(getDatabase()).getWorkspace(actor, params.creditNotePublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Credit note not found.');
		if (cause instanceof TenantAccessError) throw httpError(403, 'Accounts-receivable access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	updateReason: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CreditNoteService(getDatabase()).updateDraftReason(actor, {
				creditNotePublicId: params.creditNotePublicId,
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.creditNotePublicId);
	},
	addLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CreditNoteService(getDatabase()).addLine(actor, {
				creditNotePublicId: params.creditNotePublicId,
				originalInvoiceLineNumber: positiveInt(data.get('originalInvoiceLineNumber'), 'Original invoice line'),
				quantity: String(data.get('quantity') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.creditNotePublicId);
	},
	removeLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CreditNoteService(getDatabase()).removeLine(
				actor,
				params.creditNotePublicId,
				positiveInt(data.get('lineNumber'), 'Credit-note line')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.creditNotePublicId);
	},
	issue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CreditNoteService(getDatabase()).issue(actor, {
				creditNotePublicId: params.creditNotePublicId,
				deliveryChannel: String(data.get('deliveryChannel') ?? ''),
				recipientName: String(data.get('recipientName') ?? ''),
				recipientEmail: String(data.get('recipientEmail') ?? ''),
				note: String(data.get('note') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere(params.creditNotePublicId);
	}
};
