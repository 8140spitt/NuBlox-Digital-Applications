import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessDeniedError } from '$lib/server/external-access/external-access-service';
import { ProcurementValidationError } from '$lib/server/procurement/procurement-service';
import { SupplierRfqNetworkService } from '$lib/server/procurement/supplier-rfq-network-service';

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '');
}

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.actor)
		throw redirect(
			303,
			`/signin?returnTo=${encodeURIComponent(`/portal/supplier-quotes/${params.workItemPublicId}`)}`
		);
	const quote = await new SupplierRfqNetworkService(getDatabase()).getQuote(
		locals.actor.authUserId,
		params.workItemPublicId
	);
	if (!quote) throw error(404, 'This supplier quotation request is unavailable.');
	return {
		quote: {
			...quote,
			responseDeadlineAt: quote.responseDeadlineAt?.toISOString() ?? null,
			validUntil: quote.validUntil?.toISOString().slice(0, 10) ?? null,
			submittedAt: quote.submittedAt?.toISOString() ?? null
		}
	};
};

export const actions: Actions = {
	submit: async ({ params, locals, request }) => {
		if (!locals.actor) return fail(401, { message: 'Sign in to submit this quotation.' });
		const service = new SupplierRfqNetworkService(getDatabase());
		const current = await service.getQuote(locals.actor.authUserId, params.workItemPublicId);
		if (!current) return fail(404, { message: 'This supplier quotation request is unavailable.' });
		if (current.state !== 'open')
			return fail(409, { message: 'This quotation has already been submitted.' });
		const data = await request.formData();
		try {
			await service.submitQuote(
				locals.actor,
				{
					workItemPublicId: params.workItemPublicId,
					supplierReference: text(data, 'supplierReference'),
					validUntil: text(data, 'validUntil'),
					lines: current.lines.map((line) => ({
						rfqItemId: line.rfqItemId,
						offeredQuantity: text(data, `quantity:${line.rfqItemId}`),
						unitRate: text(data, `rate:${line.rfqItemId}`),
						leadTimeDays: text(data, `lead:${line.rfqItemId}`),
						qualificationNote: text(data, `note:${line.rfqItemId}`)
					}))
				},
				locals.correlationId
			);
		} catch (cause) {
			if (cause instanceof ProcurementValidationError) return fail(400, { message: cause.message });
			if (cause instanceof ExternalAccessDeniedError) return fail(403, { message: cause.message });
			throw cause;
		}
		throw redirect(303, `/portal/supplier-quotes/${encodeURIComponent(params.workItemPublicId)}`);
	}
};
