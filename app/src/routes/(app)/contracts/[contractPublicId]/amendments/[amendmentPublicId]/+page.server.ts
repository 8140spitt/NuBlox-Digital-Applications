import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	ContractAmendmentService,
	ContractAmendmentValidationError
} from '$lib/server/contracts/contract-amendment-service';
import { ContractValidationError } from '$lib/server/contracts/contract-service';
import { getDatabase } from '$lib/server/db/database';
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
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new ContractAmendmentValidationError(`${label} is invalid.`);
	}
	return parsed;
}

function actionFailure(cause: unknown) {
	if (cause instanceof ContractValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) {
		return fail(404, { actionError: 'The contract amendment or requested record is unavailable.' });
	}
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function redirectTo(contractPublicId: string, amendmentPublicId: string): never {
	throw redirect(
		303,
		`/contracts/${encodeURIComponent(contractPublicId)}/amendments/${encodeURIComponent(amendmentPublicId)}`
	);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ContractAmendmentService(getDatabase()).getWorkspace(
			actor,
			params.contractPublicId,
			params.amendmentPublicId
		);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Contract amendment not found.');
		if (cause instanceof TenantAccessError) throw httpError(403, 'Contract access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	updateDraft: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractAmendmentService(getDatabase()).updateDraft(actor, {
				contractPublicId: params.contractPublicId,
				amendmentPublicId: params.amendmentPublicId,
				typeCode: String(data.get('typeCode') ?? ''),
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				effectiveOn: String(data.get('effectiveOn') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	addValue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractAmendmentService(getDatabase()).addValueAdjustment(actor, {
				contractPublicId: params.contractPublicId,
				amendmentPublicId: params.amendmentPublicId,
				typeCode: String(data.get('typeCode') ?? ''),
				description: String(data.get('description') ?? ''),
				adjustmentAmount: String(data.get('adjustmentAmount') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	removeValue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractAmendmentService(getDatabase()).removeValueAdjustment(
				actor,
				params.contractPublicId,
				params.amendmentPublicId,
				positiveInt(data.get('sortOrder'), 'Value adjustment')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	addKeyDate: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractAmendmentService(getDatabase()).addKeyDateChange(actor, {
				contractPublicId: params.contractPublicId,
				amendmentPublicId: params.amendmentPublicId,
				typeCode: String(data.get('typeCode') ?? ''),
				label: String(data.get('label') ?? ''),
				newDate: String(data.get('newDate') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	removeKeyDate: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractAmendmentService(getDatabase()).removeKeyDateChange(
				actor,
				params.contractPublicId,
				params.amendmentPublicId,
				positiveInt(data.get('sortOrder'), 'Key date change')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	issue: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		try {
			await new ContractAmendmentService(getDatabase()).issue(
				actor,
				params.contractPublicId,
				params.amendmentPublicId
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	agree: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		try {
			await new ContractAmendmentService(getDatabase()).decide(
				actor,
				params.contractPublicId,
				params.amendmentPublicId,
				'agreed'
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	reject: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		try {
			await new ContractAmendmentService(getDatabase()).decide(
				actor,
				params.contractPublicId,
				params.amendmentPublicId,
				'rejected'
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	},
	withdraw: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		try {
			await new ContractAmendmentService(getDatabase()).withdraw(
				actor,
				params.contractPublicId,
				params.amendmentPublicId
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId, params.amendmentPublicId);
	}
};
