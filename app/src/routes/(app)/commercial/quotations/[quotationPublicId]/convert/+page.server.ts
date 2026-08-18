import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialValidationError } from '$lib/server/commercial/commercial-service';
import { QuotationProjectConversionService } from '$lib/server/commercial/quotation-project-conversion-service';
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

function versionFromUrl(url: URL): number | undefined {
	const text = url.searchParams.get('version');
	if (!text) return undefined;
	const parsed = Number(text);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function positiveInt(value: FormDataEntryValue | null): number {
	const parsed = Number(String(value ?? ''));
	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new CommercialValidationError('Quotation version number is invalid.');
	}
	return parsed;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new QuotationProjectConversionService(getDatabase()).getWorkspace(
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
	convert: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const project = await new QuotationProjectConversionService(getDatabase()).convert(
				actor,
				params.quotationPublicId,
				positiveInt(data.get('versionNumber')),
				String(data.get('creditOverrideReason') ?? '')
			);
			throw redirect(303, `/contracts/new?project=${encodeURIComponent(project.publicId)}`);
		} catch (error) {
			if (error instanceof CommercialValidationError)
				return fail(400, { actionError: error.message });
			if (error instanceof RecordNotFoundError)
				return fail(404, { actionError: 'The quotation or accepted response is unavailable.' });
			if (error instanceof TenantAccessError) {
				return fail(403, {
					actionError:
						'Conversion requires quotation-conversion authority and project.create permission.'
				});
			}
			throw error;
		}
	}
};
