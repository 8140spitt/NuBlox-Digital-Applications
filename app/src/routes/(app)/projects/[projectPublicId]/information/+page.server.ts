import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	ProjectInformationRequirementsService,
	ProjectInformationRequirementValidationError,
	type InformationRequirementType,
	type InformationResponsibilityCode,
	type InformationResponsibilityInput
} from '$lib/server/information/project-information-requirements-service';
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

function actionFailure(informationAction: string, informationError: string) {
	return { informationAction, informationError };
}

function handleActionError(cause: unknown, informationAction: string) {
	if (cause instanceof RecordNotFoundError)
		return fail(404, actionFailure(informationAction, cause.message));
	if (cause instanceof TenantAccessError)
		return fail(403, actionFailure(informationAction, cause.message));
	if (cause instanceof ProjectInformationRequirementValidationError)
		return fail(400, actionFailure(informationAction, cause.message));
	throw cause;
}

function redirectToRequirement(projectPublicId: string, requirementPublicId?: string | null): never {
	const suffix = requirementPublicId
		? `?requirement=${encodeURIComponent(requirementPublicId)}`
		: '';
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/information${suffix}`);
}

function parseDate(value: FormDataEntryValue | null, label: string): Date | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new ProjectInformationRequirementValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T12:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new ProjectInformationRequirementValidationError(`${label} is invalid.`);
	}
	return parsed;
}

function parseResponsibilityValues(
	values: FormDataEntryValue[],
	responsibilityCode: InformationResponsibilityCode
): InformationResponsibilityInput[] {
	return values.map((raw) => {
		const [organisationPublicId = '', roleKey = ''] = String(raw).split('|', 2);
		return { organisationPublicId, roleKey, responsibilityCode };
	});
}

function requirementInput(data: FormData, projectPublicId: string) {
	return {
		projectPublicId,
		requirementCode: String(data.get('requirementCode') ?? ''),
		requirementType: String(data.get('requirementType') ?? '') as InformationRequirementType,
		title: String(data.get('title') ?? ''),
		description: String(data.get('description') ?? ''),
		containerTypeCode: String(data.get('containerTypeCode') ?? ''),
		requiredPurposeCode: String(data.get('requiredPurposeCode') ?? ''),
		requiredSuitabilityCode: String(data.get('requiredSuitabilityCode') ?? ''),
		requiredByOn: parseDate(data.get('requiredByOn'), 'Required by date')
	};
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const workspace = await new ProjectInformationRequirementsService(getDatabase()).getWorkspace(
			actor,
			params.projectPublicId
		);
		const requestedRequirement = url.searchParams.get('requirement')?.trim() ?? '';
		const selectedRequirementPublicId = workspace.requirements.some(
			(requirement) => requirement.publicId === requestedRequirement
		)
			? requestedRequirement
			: (workspace.requirements[0]?.publicId ?? null);
		return { ...workspace, selectedRequirementPublicId };
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project information requirements not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	createRequirement: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('create-requirement', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const publicId = await new ProjectInformationRequirementsService(
				getDatabase()
			).createRequirement(actor, requirementInput(data, params.projectPublicId));
			redirectToRequirement(params.projectPublicId, publicId);
		} catch (cause) {
			return handleActionError(cause, 'create-requirement');
		}
	},

	updateRequirement: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('update-requirement', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		try {
			await new ProjectInformationRequirementsService(getDatabase()).updateRequirement(actor, {
				...requirementInput(data, params.projectPublicId),
				requirementPublicId
			});
		} catch (cause) {
			return handleActionError(cause, 'update-requirement');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	},

	saveResponsibilities: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('save-responsibilities', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		const responsibilities = [
			...parseResponsibilityValues(data.getAll('responsible'), 'responsible'),
			...parseResponsibilityValues(data.getAll('accountable'), 'accountable'),
			...parseResponsibilityValues(data.getAll('consulted'), 'consulted'),
			...parseResponsibilityValues(data.getAll('informed'), 'informed')
		];
		try {
			await new ProjectInformationRequirementsService(getDatabase()).replaceResponsibilities(
				actor,
				{ projectPublicId: params.projectPublicId, requirementPublicId, responsibilities }
			);
		} catch (cause) {
			return handleActionError(cause, 'save-responsibilities');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	},

	approveRequirement: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('approve-requirement', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		try {
			await new ProjectInformationRequirementsService(getDatabase()).approveRequirement(
				actor,
				params.projectPublicId,
				requirementPublicId
			);
		} catch (cause) {
			return handleActionError(cause, 'approve-requirement');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	},

	withdrawRequirement: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('withdraw-requirement', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		try {
			await new ProjectInformationRequirementsService(getDatabase()).withdrawRequirement(
				actor,
				params.projectPublicId,
				requirementPublicId,
				String(data.get('reason') ?? '')
			);
		} catch (cause) {
			return handleActionError(cause, 'withdraw-requirement');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	},

	linkContainer: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('link-container', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		try {
			await new ProjectInformationRequirementsService(getDatabase()).linkContainer(
				actor,
				params.projectPublicId,
				requirementPublicId,
				String(data.get('containerPublicId') ?? '')
			);
		} catch (cause) {
			return handleActionError(cause, 'link-container');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	},

	unlinkContainer: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, actionFailure('unlink-container', 'Authentication is required.'));
		const data = await request.formData();
		const requirementPublicId = String(data.get('requirementPublicId') ?? '');
		try {
			await new ProjectInformationRequirementsService(getDatabase()).unlinkContainer(
				actor,
				params.projectPublicId,
				requirementPublicId,
				String(data.get('containerPublicId') ?? '')
			);
		} catch (cause) {
			return handleActionError(cause, 'unlink-container');
		}
		redirectToRequirement(params.projectPublicId, requirementPublicId);
	}
};