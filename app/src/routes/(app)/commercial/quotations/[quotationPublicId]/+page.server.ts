import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CommercialService,
	CommercialValidationError
} from '$lib/server/commercial/commercial-service';
import type {
	DeliveryChannel,
	QuotationResponseType
} from '$lib/server/commercial/commercial-repository';
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
	if (!Number.isSafeInteger(parsed) || parsed <= 0)
		throw new CommercialValidationError(`${label} is invalid.`);
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
	if (error instanceof RecordNotFoundError)
		return fail(404, { actionError: 'The requested commercial record is unavailable.' });
	if (error instanceof TenantAccessError) return fail(403, { actionError: permissionMessage });
	throw error;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CommercialService(getDatabase()).getQuotation(
			actor,
			params.quotationPublicId,
			versionFromUrl(url)
		);
	} catch (error) {
		if (error instanceof RecordNotFoundError) throw httpError(404, 'Quotation not found.');
		if (error instanceof TenantAccessError)
			throw httpError(403, 'Commercial access is not permitted.');
		throw error;
	}
};

export const actions: Actions = {
	updateDraft: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).updateQuotationDraft(actor, {
				quotationPublicId: params.quotationPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				title: String(data.get('title') ?? ''),
				customerReference: String(data.get('customerReference') ?? ''),
				validUntil: String(data.get('validUntil') ?? '')
			});
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to edit quotations.');
		}
	},
	addLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).addQuotationLine(actor, {
				quotationPublicId: params.quotationPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				salesItemTypeId: positiveInt(data.get('salesItemTypeId'), 'Sales item type'),
				unitOfMeasureId: optionalPositiveInt(data.get('unitOfMeasureId')),
				description: String(data.get('description') ?? ''),
				quantity: String(data.get('quantity') ?? ''),
				unitRate: String(data.get('unitRate') ?? ''),
				isOptional: data.get('isOptional') === 'on'
			});
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to edit quotations.');
		}
	},
	removeLine: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).removeQuotationLine(
				actor,
				params.quotationPublicId,
				positiveInt(data.get('versionNumber'), 'Version number'),
				positiveInt(data.get('lineNumber'), 'Line number')
			);
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to edit quotations.');
		}
	},
	setTax: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).setQuotationLineTax(
				actor,
				params.quotationPublicId,
				positiveInt(data.get('versionNumber'), 'Version number'),
				positiveInt(data.get('lineNumber'), 'Line number'),
				String(data.get('taxCategoryPublicId') ?? '') || null
			);
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to edit quotation tax treatment.');
		}
	},
	addText: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).addQuotationTextBlock(actor, {
				quotationPublicId: params.quotationPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				blockType: String(data.get('blockType') ?? ''),
				heading: String(data.get('heading') ?? ''),
				body: String(data.get('body') ?? '')
			});
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to edit quotation narrative.');
		}
	},
	issue: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CommercialService(getDatabase()).issueQuotation(actor, {
				quotationPublicId: params.quotationPublicId,
				versionNumber: positiveInt(data.get('versionNumber'), 'Version number'),
				deliveryChannel: String(data.get('deliveryChannel') ?? '') as DeliveryChannel,
				recipientName: String(data.get('recipientName') ?? ''),
				recipientEmail: String(data.get('recipientEmail') ?? ''),
				note: String(data.get('note') ?? '')
			});
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to issue quotations.');
		}
	},
	recordResponse: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const versionNumber = positiveInt(data.get('versionNumber'), 'Version number');
			const responseType = String(data.get('responseType') ?? '') as QuotationResponseType;
			await new CommercialService(getDatabase()).recordQuotationResponse(actor, {
				quotationPublicId: params.quotationPublicId,
				versionNumber,
				responseType,
				respondedAt: String(data.get('respondedAt') ?? ''),
				respondentName: String(data.get('respondentName') ?? ''),
				respondentEmail: String(data.get('respondentEmail') ?? ''),
				notes: String(data.get('notes') ?? '')
			});
			if (responseType === 'accepted') {
				throw redirect(
					303,
					`/contracts/new?quotation=${encodeURIComponent(params.quotationPublicId)}&version=${versionNumber}`
				);
			}
			throw redirect(303, `/commercial/quotations/${encodeURIComponent(params.quotationPublicId)}`);
		} catch (error) {
			return actionError(error, 'You do not have permission to record quotation responses.');
		}
	}
};
