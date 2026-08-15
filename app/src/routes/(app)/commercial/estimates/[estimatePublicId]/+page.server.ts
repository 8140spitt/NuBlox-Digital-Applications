import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialService, CommercialValidationError } from '$lib/server/commercial/commercial-service';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return { organisationId: locals.tenant.organisationId, userId: locals.actor.userId, memberId: locals.tenant.memberId, correlationId: locals.correlationId };
}

function positiveInt(value: FormDataEntryValue | null, label: string): number {
	const parsed = Number(String(value ?? ''));
	if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new CommercialValidationError(`${label} is invalid.`);
	return parsed;
}

function optionalPositiveInt(value: FormDataEntryValue | null): number | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	return positiveInt(value, 'Unit of measure');
}

function versionFromUrl(url: URL): number | undefined {
	const text = url.searchParams.get('version');
	if (!text) return undefined;
	const parsed = Number(text);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function actionError(error: unknown, permissionMessage: string) {
	if (error instanceof CommercialValidationError) return fail(400, { actionError: error.message });
	if (error instanceof RecordNotFoundError) return fail(404, { actionError: 'The requested commercial record is unavailable.' });
	if (error instanceof TenantAccessError) return fail(403, { actionError: permissionMessage });
	throw error;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CommercialService(getDatabase()).getEstimate(actor, params.estimatePublicId, versionFromUrl(url));
	} catch (error) {
		if (error instanceof RecordNotFoundError) throw httpError(404, 'Estimate not found.');
		if (error instanceof TenantAccessError) throw httpError(403, 'Commercial access is not permitted.');
		throw error;
	}
};

export const actions: Actions = {
	addItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).addEstimateItem(actor, {
				estimatePublicId: params.estimatePublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				salesItemTypeId: positiveInt(data.get('salesItemTypeId'), 'Sales item type'),
				unitOfMeasureId: optionalPositiveInt(data.get('unitOfMeasureId')),
				description: String(data.get('description') ?? ''),
				quantity: String(data.get('quantity') ?? ''),
				sellUnitRate: String(data.get('sellUnitRate') ?? ''),
				isOptional: data.get('isOptional') === 'on'
			});
			throw redirect(303, `/commercial/estimates/${encodeURIComponent(params.estimatePublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to manage estimates.');
		}
	},
	addCostComponent: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).addEstimateCostComponent(actor, {
				estimatePublicId: params.estimatePublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				lineNumber: positiveInt(data.get('lineNumber'), 'Line number'),
				salesItemTypeId: positiveInt(data.get('salesItemTypeId'), 'Sales item type'),
				unitOfMeasureId: optionalPositiveInt(data.get('unitOfMeasureId')),
				description: String(data.get('description') ?? ''),
				quantity: String(data.get('quantity') ?? ''),
				unitCost: String(data.get('unitCost') ?? ''),
				wastePercent: String(data.get('wastePercent') ?? '0'),
				markupPercent: String(data.get('markupPercent') ?? '0')
			});
			throw redirect(303, `/commercial/estimates/${encodeURIComponent(params.estimatePublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to manage estimates.');
		}
	},
	removeItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).removeEstimateItem(actor, params.estimatePublicId, positiveInt(data.get('versionNumber'), 'Version number'), positiveInt(data.get('lineNumber'), 'Line number'));
			throw redirect(303, `/commercial/estimates/${encodeURIComponent(params.estimatePublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to manage estimates.');
		}
	},
	finalise: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).finaliseEstimate(actor, params.estimatePublicId, positiveInt(data.get('versionNumber'), 'Version number'));
			throw redirect(303, `/commercial/estimates/${encodeURIComponent(params.estimatePublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to finalise estimates.');
		}
	},
	createQuotation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const quotation = await new CommercialService(getDatabase()).createQuotationFromEstimate(actor, {
				estimatePublicId: params.estimatePublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				title: String(data.get('title') ?? ''),
				customerReference: String(data.get('customerReference') ?? ''),
				validUntil: String(data.get('validUntil') ?? '')
			});
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(quotation.publicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to create quotations.');
		}
	}
};
