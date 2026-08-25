import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialLifecycleService } from '$lib/server/commercial/commercial-lifecycle-service';
import {
	CommercialService,
	CommercialValidationError
} from '$lib/server/commercial/commercial-service';
import { ContractValidationError } from '$lib/server/contracts/contract-common';
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

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	return new CommercialService(getDatabase()).listEstimates(actor);
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { createError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const estimate = await new CommercialLifecycleService(getDatabase()).developEstimate(
				actor,
				String(data.get('opportunityPublicId') ?? '')
			);
			throw redirect(303, `/commercial/estimates/${encodeURIComponent(estimate.publicId)}`);
		} catch (error) {
			if (error instanceof CommercialValidationError || error instanceof ContractValidationError)
				return fail(400, { createError: error.message });
			if (error instanceof RecordNotFoundError)
				return fail(404, { createError: 'The selected CRM opportunity is unavailable.' });
			if (error instanceof TenantAccessError)
				return fail(403, { createError: 'You do not have permission to develop estimates.' });
			throw error;
		}
	}
};
