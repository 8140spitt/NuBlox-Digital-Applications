import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
import { InvoiceService } from '$lib/server/finance/invoice-service';
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

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new InvoiceService(getDatabase()).getPortfolio(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Accounts-receivable access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			const created = await new InvoiceService(getDatabase()).createFromContract(actor, {
				contractPublicId: String(data.get('contractPublicId') ?? ''),
				invoiceType: String(data.get('invoiceType') ?? 'standard')
			});
			throw redirect(303, `/finance/invoices/${encodeURIComponent(created.publicId)}`);
		} catch (cause) {
			if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
			if (cause instanceof RecordNotFoundError)
				return fail(404, { actionError: 'The selected contract is unavailable.' });
			if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
			throw cause;
		}
	}
};
