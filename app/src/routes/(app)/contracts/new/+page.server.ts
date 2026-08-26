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

function optionalVersion(value: string | null): number | undefined {
	if (!value) return undefined;
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed <= 0)
		throw new ContractValidationError('Quotation version is invalid.');
	return parsed;
}

function positiveInt(value: FormDataEntryValue | null, label: string): number {
	const parsed = Number(String(value ?? ''));
	if (!Number.isSafeInteger(parsed) || parsed <= 0)
		throw new ContractValidationError(`${label} is invalid.`);
	return parsed;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	const quotationPublicId = url.searchParams.get('quotation')?.trim();
	const projectPublicId = url.searchParams.get('project')?.trim();
	try {
		if (quotationPublicId) {
			return {
				mode: 'accepted-quotation' as const,
				...(await new CommercialLifecycleService(
					getDatabase()
				).getAcceptedQuotationContractFormationWorkspace(
					actor,
					quotationPublicId,
					optionalVersion(url.searchParams.get('version'))
				))
			};
		}
		if (projectPublicId) {
			const legacy = await new ContractService(getDatabase()).getFormationWorkspace(
				actor,
				projectPublicId
			);
			return {
				mode: 'legacy-project' as const,
				quotation: legacy.quotation,
				legacyProject: {
					publicId: legacy.project.publicId,
					projectNumber: legacy.project.projectNumber,
					name: legacy.project.name
				},
				contractTypes: legacy.contractTypes,
				existingContract: legacy.existingContract,
				canCreate: legacy.canCreate
			};
		}
		throw httpError(400, 'An accepted quotation is required to form a contract.');
	} catch (cause) {
		if (cause instanceof RecordNotFoundError) throw httpError(404, 'Source record not found.');
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
			const quotationPublicId = String(data.get('quotationPublicId') ?? '').trim();
			const projectPublicId = String(data.get('projectPublicId') ?? '').trim();
			const common = {
				contractTypeCode: String(data.get('contractTypeCode') ?? ''),
				title: String(data.get('title') ?? ''),
				customerReference: String(data.get('customerReference') ?? '')
			};
			const contract = quotationPublicId
				? await new CommercialLifecycleService(getDatabase()).formContractFromAcceptedQuotation(
						actor,
						{
							quotationPublicId,
							versionNumber: positiveInt(data.get('versionNumber'), 'Quotation version'),
							...common
						}
					)
				: await new ContractService(getDatabase()).createFromProject(actor, {
						projectPublicId,
						...common
					});
			throw redirect(303, `/contracts/${encodeURIComponent(contract.publicId)}`);
		} catch (cause) {
			if (cause instanceof ContractValidationError)
				return fail(400, { actionError: cause.message });
			if (cause instanceof RecordNotFoundError)
				return fail(404, { actionError: 'The source quotation or project is unavailable.' });
			if (cause instanceof TenantAccessError)
				return fail(403, { actionError: 'Contract creation is not permitted.' });
			throw cause;
		}
	}
};
