import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialLifecycleService } from '$lib/server/commercial/commercial-lifecycle-service';
import { ContractService, ContractValidationError } from '$lib/server/contracts/contract-service';
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

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const db = getDatabase();
		const [workspace, mobilisation] = await Promise.all([
			new ContractService(db).getWorkspace(actor, params.contractPublicId),
			new CommercialLifecycleService(db).getContractMobilisationState(actor, params.contractPublicId)
		]);
		if (mobilisation.project) {
			throw redirect(303, `/projects/${encodeURIComponent(mobilisation.project.publicId)}`);
		}
		return {
			contract: workspace.contract,
			version: workspace.version,
			mobilisation
		};
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Contract not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Contract access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	default: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { mobilisationError: 'Authentication and organisation context are required.' });
		try {
			const project = await new CommercialLifecycleService(getDatabase()).mobiliseProjectFromContract(
				actor,
				params.contractPublicId
			);
			throw redirect(303, `/projects/${encodeURIComponent(project.publicId)}`);
		} catch (cause) {
			if (cause instanceof ContractValidationError)
				return fail(400, { mobilisationError: cause.message });
			if (cause instanceof RecordNotFoundError)
				return fail(404, { mobilisationError: 'Contract not found.' });
			if (cause instanceof TenantAccessError)
				return fail(403, { mobilisationError: 'Project mobilisation is not permitted.' });
			throw cause;
		}
	}
};
