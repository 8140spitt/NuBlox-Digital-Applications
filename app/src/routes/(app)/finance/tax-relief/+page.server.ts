import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { ControlledTaxReliefService } from '$lib/server/finance/tax-relief-control-service';
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
	if (cause instanceof RecordNotFoundError)
		return fail(404, { actionError: 'The requested VAT bad-debt relief record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/tax-relief');
}

function checked(data: FormData, key: string): boolean {
	return data.get(key) === 'on';
}

function claimLines(data: FormData) {
	const lines: Array<{
		sourceInvoiceItemId: string;
		taxCategoryId: string;
		considerationBasisAmount: string;
	}> = [];
	for (const [key, raw] of data.entries()) {
		if (!key.startsWith('basis:')) continue;
		const [, sourceInvoiceItemId, taxCategoryId] = key.split(':');
		const amount = String(raw ?? '').trim();
		if (!sourceInvoiceItemId || !taxCategoryId || !amount) continue;
		lines.push({ sourceInvoiceItemId, taxCategoryId, considerationBasisAmount: amount });
	}
	return lines;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ControlledTaxReliefService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'VAT bad-debt relief access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	prepare: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ControlledTaxReliefService(getDatabase()).prepareClaim(actor, {
				writeOffPublicId: String(data.get('writeOffPublicId') ?? ''),
				supplyDate: String(data.get('supplyDate') ?? ''),
				paymentDueDate: String(data.get('paymentDueDate') ?? ''),
				originalVatPeriodReference: String(data.get('originalVatPeriodReference') ?? ''),
				reason: String(data.get('reason') ?? ''),
				vatAccountedAndPaid: checked(data, 'vatAccountedAndPaid'),
				debtNotSoldOrFactored: checked(data, 'debtNotSoldOrFactored'),
				sellingPriceConditionMet: checked(data, 'sellingPriceConditionMet'),
				reliefSchemeApplicable: checked(data, 'reliefSchemeApplicable'),
				lines: claimLines(data)
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
			await new ControlledTaxReliefService(getDatabase()).authoriseClaim(actor, {
				claimPublicId: String(data.get('claimPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseClaim: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ControlledTaxReliefService(getDatabase()).reverseClaim(actor, {
				claimPublicId: String(data.get('claimPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	recordRepayment: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ControlledTaxReliefService(getDatabase()).recordRepayment(actor, {
				claimPublicId: String(data.get('claimPublicId') ?? ''),
				recoveryPublicId: String(data.get('recoveryPublicId') ?? ''),
				considerationPaymentAmount: String(data.get('considerationPaymentAmount') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseRepayment: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ControlledTaxReliefService(getDatabase()).reverseRepayment(actor, {
				repaymentPublicId: String(data.get('repaymentPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	post: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		const sourceKind = String(data.get('sourceKind') ?? '');
		if (sourceKind !== 'relief_claim' && sourceKind !== 'relief_repayment') {
			return fail(400, { actionError: 'VAT return posting source is invalid.' });
		}
		try {
			await new ControlledTaxReliefService(getDatabase()).recordReturnPosting(actor, {
				sourceKind,
				sourcePublicId: String(data.get('sourcePublicId') ?? ''),
				vatReturnPeriodReference: String(data.get('vatReturnPeriodReference') ?? ''),
				vatReturnPeriodStart: String(data.get('vatReturnPeriodStart') ?? ''),
				vatReturnPeriodEnd: String(data.get('vatReturnPeriodEnd') ?? ''),
				externalReference: String(data.get('externalReference') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reversePost: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ControlledTaxReliefService(getDatabase()).reverseReturnPosting(actor, {
				postingPublicId: String(data.get('postingPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
