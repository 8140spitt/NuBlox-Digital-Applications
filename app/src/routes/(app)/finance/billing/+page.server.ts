import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { BillingSettingsService } from '$lib/server/finance/billing-settings-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return { organisationId: locals.tenant.organisationId, userId: locals.actor.userId, memberId: locals.tenant.memberId, correlationId: locals.correlationId };
}

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The requested billing record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function redirectHere(): never {
	throw redirect(303, '/finance/billing');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new BillingSettingsService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Accounts-receivable access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createTerm: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BillingSettingsService(getDatabase()).createPaymentTerm(actor, {
				name: String(data.get('name') ?? ''),
				calculationBasis: String(data.get('calculationBasis') ?? ''),
				daysOffset: Number(String(data.get('daysOffset') ?? '0')),
				isDefault: data.get('isDefault') === 'on'
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere();
	},
	updateParty: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BillingSettingsService(getDatabase()).setPartyBillingSettings(actor, {
				partyPublicId: String(data.get('partyPublicId') ?? ''),
				defaultPaymentTermPublicId: String(data.get('defaultPaymentTermPublicId') ?? ''),
				defaultCurrencyCode: String(data.get('defaultCurrencyCode') ?? ''),
				customerAccountReference: String(data.get('customerAccountReference') ?? ''),
				purchaseOrderRequired: data.get('purchaseOrderRequired') === 'on'
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectHere();
	}
};
