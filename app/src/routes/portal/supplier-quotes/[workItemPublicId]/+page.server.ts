import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { parseCanonicalRoute, portalLoginPath } from '$lib/routing/route-contract';
import { getDatabase } from '$lib/server/db/database';
import { ExternalAccessDeniedError } from '$lib/server/external-access/external-access-service';
import { ProcurementValidationError } from '$lib/server/procurement/procurement-service';
import { SupplierRfqNetworkService } from '$lib/server/procurement/supplier-rfq-network-service';
import { RouteContextService } from '$lib/server/routing/route-context-service';

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '');
}

async function requirePortalQuote(locals: App.Locals, url: URL, workItemPublicId: string) {
	const canonical = parseCanonicalRoute(url.pathname);
	if (canonical?.kind !== 'portal') {
		throw error(404, 'This supplier quotation request is unavailable.');
	}
	if (!locals.actor) {
		throw redirect(
			303,
			`${portalLoginPath(canonical.tenantSlug, canonical.partySlug)}?returnTo=${encodeURIComponent(url.pathname)}`
		);
	}
	const routing = new RouteContextService(getDatabase());
	const context = await routing.findPortalContext(
		locals.actor.authUserId,
		canonical.tenantSlug,
		canonical.partySlug
	);
	if (
		!context ||
		!(await routing.workItemBelongsToPortal(locals.actor.authUserId, workItemPublicId, context))
	) {
		throw error(404, 'This supplier quotation request is unavailable.');
	}
	return context;
}

export const load: PageServerLoad = async ({ params, locals, url }) => {
	await requirePortalQuote(locals, url, params.workItemPublicId);
	const quote = await new SupplierRfqNetworkService(getDatabase()).getQuote(
		locals.actor!.authUserId,
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
	submit: async ({ params, locals, request, url }) => {
		await requirePortalQuote(locals, url, params.workItemPublicId);
		const service = new SupplierRfqNetworkService(getDatabase());
		const current = await service.getQuote(locals.actor!.authUserId, params.workItemPublicId);
		if (!current) return fail(404, { message: 'This supplier quotation request is unavailable.' });
		if (current.state !== 'open') {
			return fail(409, { message: 'This quotation has already been submitted.' });
		}
		const data = await request.formData();
		try {
			await service.submitQuote(
				locals.actor!,
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
		throw redirect(303, url.pathname);
	}
};
