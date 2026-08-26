import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectChangeService,
	ProjectChangeValidationError,
	type ChangeImpactLevel,
	type ProjectChangeDecision
} from '$lib/server/projects/project-change-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function actionFailure(changeAction: string, changeError: string) {
	return { changeAction, changeError };
}

function handleActionError(cause: unknown, changeAction: string) {
	if (cause instanceof RecordNotFoundError) return fail(404, actionFailure(changeAction, cause.message));
	if (cause instanceof TenantAccessError) return fail(403, actionFailure(changeAction, cause.message));
	if (cause instanceof ProjectChangeValidationError) return fail(400, actionFailure(changeAction, cause.message));
	throw cause;
}

function redirectToChange(projectPublicId: string, changePublicId?: string | null): never {
	const suffix = changePublicId ? `?change=${encodeURIComponent(changePublicId)}` : '';
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/changes${suffix}`);
}

function parseDate(value: FormDataEntryValue | null, label: string): Date | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ProjectChangeValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T12:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new ProjectChangeValidationError(`${label} is invalid.`);
	}
	return parsed;
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const workspace = await new ProjectChangeService(getDatabase()).getWorkspace(actor, params.projectPublicId);
		const requestedChange = url.searchParams.get('change')?.trim() ?? '';
		const selectedChangePublicId = workspace.changes.some((change) => change.publicId === requestedChange)
			? requestedChange
			: (workspace.changes[0]?.publicId ?? null);
		return { ...workspace, selectedChangePublicId };
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project change control not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	createChange: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('create-change', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const publicId = await new ProjectChangeService(getDatabase()).createChange(actor, {
				projectPublicId: params.projectPublicId,
				typeCode: String(data.get('typeCode') ?? ''),
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? '')
			});
			redirectToChange(params.projectPublicId, publicId);
		} catch (cause) {
			return handleActionError(cause, 'create-change');
		}
	},

	saveAssessment: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('save-assessment', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).saveAssessment(actor, {
				projectPublicId: params.projectPublicId,
				changePublicId,
				scopeImpactLevel: String(data.get('scopeImpactLevel') ?? 'none') as ChangeImpactLevel,
				programmeImpactLevel: String(data.get('programmeImpactLevel') ?? 'none') as ChangeImpactLevel,
				costImpactLevel: String(data.get('costImpactLevel') ?? 'none') as ChangeImpactLevel,
				contractImpactLevel: String(data.get('contractImpactLevel') ?? 'none') as ChangeImpactLevel,
				informationImpactLevel: String(data.get('informationImpactLevel') ?? 'none') as ChangeImpactLevel,
				scopeSummary: String(data.get('scopeSummary') ?? ''),
				programmeSummary: String(data.get('programmeSummary') ?? ''),
				costSummary: String(data.get('costSummary') ?? ''),
				contractSummary: String(data.get('contractSummary') ?? ''),
				informationSummary: String(data.get('informationSummary') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? ''),
				estimatedCostDelta: String(data.get('estimatedCostDelta') ?? ''),
				estimatedTimeDeltaDays: String(data.get('estimatedTimeDeltaDays') ?? ''),
				wbsPublicIds: data.getAll('wbsPublicIds').map(String),
				activityPublicIds: data.getAll('activityPublicIds').map(String),
				costCodePublicIds: data.getAll('costCodePublicIds').map(String),
				contractPublicIds: data.getAll('contractPublicIds').map(String)
			});
		} catch (cause) {
			return handleActionError(cause, 'save-assessment');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	},

	submitAssessment: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('submit-assessment', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).submitAssessment(actor, params.projectPublicId, changePublicId);
		} catch (cause) {
			return handleActionError(cause, 'submit-assessment');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	},

	decideChange: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('decide-change', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).decideChange(actor, {
				projectPublicId: params.projectPublicId,
				changePublicId,
				decision: String(data.get('decision') ?? '') as ProjectChangeDecision,
				rationale: String(data.get('rationale') ?? ''),
				conditions: String(data.get('conditions') ?? '')
			});
		} catch (cause) {
			return handleActionError(cause, 'decide-change');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	},

	recordImplementation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('record-implementation', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).recordImplementation(actor, {
				projectPublicId: params.projectPublicId,
				changePublicId,
				implementationSummary: String(data.get('implementationSummary') ?? ''),
				implementedAt: parseDate(data.get('implementedAt'), 'Implementation date')
			});
		} catch (cause) {
			return handleActionError(cause, 'record-implementation');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	},

	closeChange: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('close-change', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).closeChange(actor, params.projectPublicId, changePublicId);
		} catch (cause) {
			return handleActionError(cause, 'close-change');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	},

	cancelChange: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('cancel-change', 'Authentication is required.'));
		const data = await request.formData();
		const changePublicId = String(data.get('changePublicId') ?? '');
		try {
			await new ProjectChangeService(getDatabase()).cancelChange(actor, params.projectPublicId, changePublicId);
		} catch (cause) {
			return handleActionError(cause, 'cancel-change');
		}
		redirectToChange(params.projectPublicId, changePublicId);
	}
};
