import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { AccountingService } from '$lib/server/finance/accounting-service';
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
		return fail(404, { actionError: 'The requested accounting record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function back(): never {
	throw redirect(303, '/finance/accounting');
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new AccountingService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Accounting access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createAccount: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).createAccount(actor, {
				accountCode: String(data.get('accountCode') ?? ''),
				name: String(data.get('name') ?? ''),
				accountType: String(data.get('accountType') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	assignMapping: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).assignMapping(actor, {
				mappingKey: String(data.get('mappingKey') ?? ''),
				accountPublicId: String(data.get('accountPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	postSource: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).postSource(actor, {
				sourceType: String(data.get('sourceType') ?? ''),
				sourcePublicId: String(data.get('sourcePublicId') ?? ''),
				accountingDate: String(data.get('accountingDate') ?? ''),
				memo: String(data.get('memo') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseJournal: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).reverseJournal(actor, {
				journalPublicId: String(data.get('journalPublicId') ?? ''),
				accountingDate: String(data.get('accountingDate') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	createExport: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).createExport(actor, {
				periodStart: String(data.get('periodStart') ?? ''),
				periodEnd: String(data.get('periodEnd') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	},
	reverseExport: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new AccountingService(getDatabase()).reverseExport(actor, {
				exportPublicId: String(data.get('exportPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return back();
	}
};
