import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
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

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError)
		return fail(404, { actionError: 'The requested tax category is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/tax');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new TaxSettingsService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Tax settings access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createCategory: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new TaxSettingsService(getDatabase()).createCategory(actor, {
				code: String(data.get('code') ?? ''),
				name: String(data.get('name') ?? ''),
				treatment: String(data.get('treatment') ?? ''),
				ratePercent: String(data.get('ratePercent') ?? ''),
				validFrom: String(data.get('validFrom') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	addRate: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new TaxSettingsService(getDatabase()).addRate(actor, {
				categoryPublicId: String(data.get('categoryPublicId') ?? ''),
				ratePercent: String(data.get('ratePercent') ?? ''),
				validFrom: String(data.get('validFrom') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
