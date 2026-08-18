import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
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

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	const projectPublicId = url.searchParams.get('project')?.trim();
	if (!projectPublicId) throw httpError(400, 'A source project is required.');
	try {
		return await new ContractService(getDatabase()).getFormationWorkspace(actor, projectPublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Project not found.');
		if (cause instanceof TenantAccessError)
			throw httpError(403, 'Contract formation is not permitted.');
		if (cause instanceof ContractValidationError) throw httpError(409, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { actionError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const contract = await new ContractService(getDatabase()).createFromProject(actor, {
				projectPublicId: String(data.get('projectPublicId') ?? ''),
				contractTypeCode: String(data.get('contractTypeCode') ?? ''),
				title: String(data.get('title') ?? ''),
				customerReference: String(data.get('customerReference') ?? '')
			});
			throw redirect(303, `/contracts/${encodeURIComponent(contract.publicId)}`);
		} catch (cause) {
			if (cause instanceof ContractValidationError)
				return fail(400, { actionError: cause.message });
			if (cause instanceof RecordNotFoundError) {
				return fail(404, { actionError: 'The source project or quotation is unavailable.' });
			}
			if (cause instanceof TenantAccessError)
				return fail(403, { actionError: 'Contract creation is not permitted.' });
			throw cause;
		}
	}
};
