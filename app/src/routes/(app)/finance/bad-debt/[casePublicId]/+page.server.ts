import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { BadDebtMutationService } from '$lib/server/finance/bad-debt-mutation-service';
import { BadDebtQueryService } from '$lib/server/finance/bad-debt-query-service';
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
		return fail(404, { actionError: 'The bad-debt case or finance evidence is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}
function back(casePublicId: string): never {
	throw redirect(303, `/finance/bad-debt/${encodeURIComponent(casePublicId)}`);
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new BadDebtQueryService(getDatabase()).getWorkspace(actor, params.casePublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Bad-debt case not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Bad-debt access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	recommend: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).recommendWriteOff(actor, {
				casePublicId: params.casePublicId,
				amount: String(data.get('amount') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	},
	authorise: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).authoriseWriteOff(actor, {
				casePublicId: params.casePublicId,
				recommendationPublicId: String(data.get('recommendationPublicId') ?? ''),
				taxTreatmentPolicy: String(data.get('taxTreatmentPolicy') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	},
	reverseWriteOff: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).reverseWriteOff(actor, {
				casePublicId: params.casePublicId,
				writeOffPublicId: String(data.get('writeOffPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	},
	recover: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).recordRecovery(actor, {
				casePublicId: params.casePublicId,
				writeOffPublicId: String(data.get('writeOffPublicId') ?? ''),
				paymentPublicId: String(data.get('paymentPublicId') ?? ''),
				amount: String(data.get('amount') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	},
	reverseRecovery: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).reverseRecovery(actor, {
				casePublicId: params.casePublicId,
				recoveryPublicId: String(data.get('recoveryPublicId') ?? ''),
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	},
	close: async ({ params, request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new BadDebtMutationService(getDatabase()).closeCase(actor, {
				casePublicId: params.casePublicId,
				reason: String(data.get('reason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		back(params.casePublicId);
	}
};
