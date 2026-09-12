import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { SUPPLIER_RFQ_SIGNUP_COOKIE } from '$lib/server/auth/supplier-rfq-cookie';
import { getDatabase } from '$lib/server/db/database';
import { ConcurrentUpdateError } from '$lib/server/kernel/errors';
import {
	SupplierRfqPortalAccessError,
	SupplierRfqPortalService,
	SupplierRfqPortalValidationError
} from '$lib/server/procurement/supplier-rfq-portal-service';

function field(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
}

function quoteLines(data: FormData) {
	const lines: Array<{
		itemId: string;
		offeredQuantity: string;
		unitRate: string;
		leadTimeDays: string;
		qualificationNote: string;
	}> = [];
	for (const [name, value] of data.entries()) {
		if (!name.startsWith('offeredQuantity:') || typeof value !== 'string') continue;
		const itemId = name.slice('offeredQuantity:'.length);
		if (!itemId) continue;
		lines.push({
			itemId,
			offeredQuantity: value,
			unitRate: field(data, `unitRate:${itemId}`),
			leadTimeDays: field(data, `leadTimeDays:${itemId}`),
			qualificationNote: field(data, `qualificationNote:${itemId}`)
		});
	}
	return lines;
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.actor) throw redirect(303, '/signin?returnTo=%2Fportal%2Fsupplier-quotes');
	cookies.delete(SUPPLIER_RFQ_SIGNUP_COOKIE, { path: '/' });
	return {
		actor: { displayName: locals.actor.displayName, email: locals.actor.email },
		quotes: await new SupplierRfqPortalService(getDatabase()).listPortalQuotes(locals.actor.email)
	};
};

export const actions: Actions = {
	submit: async ({ request, locals }) => {
		if (!locals.actor) return fail(401, { message: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new SupplierRfqPortalService(getDatabase()).submitQuote(locals.actor, {
				quoteRef: field(data, 'quoteRef'),
				supplierReference: field(data, 'supplierReference'),
				validUntil: field(data, 'validUntil'),
				lines: quoteLines(data)
			});
		} catch (error) {
			if (error instanceof SupplierRfqPortalAccessError) return fail(403, { message: error.message });
			if (error instanceof SupplierRfqPortalValidationError) return fail(400, { message: error.message });
			if (error instanceof ConcurrentUpdateError) {
				return fail(409, { message: 'The quotation changed while it was being submitted. Refresh and try again.' });
			}
			throw error;
		}
		throw redirect(303, '/portal/supplier-quotes?submitted=1');
	}
};
