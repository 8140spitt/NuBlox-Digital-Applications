import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { ContractAmendmentService } from '$lib/server/contracts/contract-amendment-service';
import { ContractService, ContractValidationError } from '$lib/server/contracts/contract-service';
import { getDatabase } from '$lib/server/db/database';
import { contractCreditControlPreview } from '$lib/server/finance/credit-control-context';
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
	if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new ContractValidationError(`${label} is invalid.`);
	return parsed;
}

function actionFailure(cause: unknown) {
	if (cause instanceof ContractValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: 'The contract or requested record is unavailable.' });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

function redirectTo(contractPublicId: string): never {
	throw redirect(303, `/contracts/${encodeURIComponent(contractPublicId)}`);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const db = getDatabase();
		const workspace = await new ContractService(db).getWorkspace(actor, params.contractPublicId);
		const [amendments, creditControl] = await Promise.all([
			new ContractAmendmentService(db).listForContract(actor, params.contractPublicId),
			contractCreditControlPreview(actor, params.contractPublicId, db)
		]);
		return { ...workspace, amendments, creditControl };
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Contract not found.');
		if (cause instanceof TenantAccessError) throw httpError(403, 'Contract access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createAmendment: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		let amendment;
		try {
			amendment = await new ContractAmendmentService(getDatabase()).create(actor, {
				contractPublicId: params.contractPublicId,
				typeCode: String(data.get('typeCode') ?? ''),
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				effectiveOn: String(data.get('effectiveOn') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(
			303,
			`/contracts/${encodeURIComponent(params.contractPublicId)}/amendments/${encodeURIComponent(amendment.publicId)}`
		);
	},
	updateDraft: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).updateDraft(actor, {
				contractPublicId: params.contractPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Contract version'),
				title: String(data.get('title') ?? ''),
				customerReference: String(data.get('customerReference') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	addValue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).addValueComponent(actor, {
				contractPublicId: params.contractPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Contract version'),
				typeCode: String(data.get('typeCode') ?? ''),
				description: String(data.get('description') ?? ''),
				amount: String(data.get('amount') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	removeValue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).removeValueComponent(
				actor,
				params.contractPublicId,
				positiveInt(data.get('versionNumber'), 'Contract version'),
				positiveInt(data.get('sortOrder'), 'Value component')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	addKeyDate: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).addKeyDate(actor, {
				contractPublicId: params.contractPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Contract version'),
				typeCode: String(data.get('typeCode') ?? ''),
				label: String(data.get('label') ?? ''),
				dateValue: String(data.get('dateValue') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	removeKeyDate: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).removeKeyDate(
				actor,
				params.contractPublicId,
				positiveInt(data.get('versionNumber'), 'Contract version'),
				positiveInt(data.get('sortOrder'), 'Key date')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	issue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).issue(actor, {
				contractPublicId: params.contractPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Contract version'),
				deliveryChannel: String(data.get('deliveryChannel') ?? ''),
				recipientName: String(data.get('recipientName') ?? ''),
				recipientEmail: String(data.get('recipientEmail') ?? ''),
				note: String(data.get('note') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	},
	execute: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new ContractService(getDatabase()).execute(actor, {
				contractPublicId: params.contractPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Contract version'),
				executionMethod: String(data.get('executionMethod') ?? ''),
				executedAt: String(data.get('executedAt') ?? ''),
				signatoryName: String(data.get('signatoryName') ?? ''),
				signatoryEmail: String(data.get('signatoryEmail') ?? ''),
				signingRole: String(data.get('signingRole') ?? ''),
				externalTransactionReference: String(data.get('externalTransactionReference') ?? ''),
				note: String(data.get('note') ?? ''),
				creditOverrideReason: String(data.get('creditOverrideReason') ?? '')
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		return redirectTo(params.contractPublicId);
	}
};
