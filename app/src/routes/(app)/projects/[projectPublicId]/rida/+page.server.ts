import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import type {
	IssueSeverity,
	ProjectRidaItemType,
	ProjectRidaLifecycleStatus,
	ProjectRidaPriority,
	RiskDirection,
	RiskResponseStrategy
} from '$lib/server/projects/project-rida-repository';
import {
	ProjectRidaService,
	ProjectRidaValidationError
} from '$lib/server/projects/project-rida-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function actionFailure(ridaAction: string, ridaError: string) {
	return { ridaAction, ridaError };
}

function parseDate(value: FormDataEntryValue | null, label: string): Date | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ProjectRidaValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new ProjectRidaValidationError(`${label} is invalid.`);
	}
	return parsed;
}

function parseScore(value: FormDataEntryValue | null): number | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	const numeric = Number(text);
	return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function handleActionError(cause: unknown, ridaAction: string) {
	if (cause instanceof RecordNotFoundError) return fail(404, actionFailure(ridaAction, cause.message));
	if (cause instanceof TenantAccessError) return fail(403, actionFailure(ridaAction, cause.message));
	if (cause instanceof ProjectRidaValidationError || cause instanceof InvalidLifecycleTransitionError) {
		return fail(400, actionFailure(ridaAction, cause.message));
	}
	if (cause instanceof ConcurrentUpdateError) return fail(409, actionFailure(ridaAction, cause.message));
	throw cause;
}

function redirectToRida(projectPublicId: string): never {
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/rida`);
}

function createInput(data: FormData, projectPublicId: string) {
	return {
		projectPublicId,
		itemType: String(data.get('itemType') ?? '') as ProjectRidaItemType,
		title: String(data.get('title') ?? ''),
		description: String(data.get('description') ?? ''),
		priority: String(data.get('priority') ?? 'normal') as ProjectRidaPriority,
		ownerMemberId: String(data.get('ownerMemberId') ?? '') || null,
		dueOn: parseDate(data.get('dueOn'), 'Due date'),
		riskDirection: (String(data.get('riskDirection') ?? '') || null) as RiskDirection | null,
		probabilityScore: parseScore(data.get('probabilityScore')),
		impactScore: parseScore(data.get('impactScore')),
		responseStrategy: (String(data.get('responseStrategy') ?? '') || null) as RiskResponseStrategy | null,
		responsePlan: String(data.get('responsePlan') ?? ''),
		residualProbabilityScore: parseScore(data.get('residualProbabilityScore')),
		residualImpactScore: parseScore(data.get('residualImpactScore')),
		severity: (String(data.get('severity') ?? '') || null) as IssueSeverity | null,
		impactSummary: String(data.get('impactSummary') ?? ''),
		resolutionPlan: String(data.get('resolutionPlan') ?? ''),
		decisionRequiredOn: parseDate(data.get('decisionRequiredOn'), 'Decision required date')
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ProjectRidaService(getDatabase()).getWorkspace(actor, params.projectPublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project controls register not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	createItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('create-item', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectRidaService(getDatabase()).createItem(actor, createInput(data, params.projectPublicId));
		} catch (cause) {
			return handleActionError(cause, 'create-item');
		}
		redirectToRida(params.projectPublicId);
	},

	updateItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('update-item', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const input = createInput(data, params.projectPublicId);
			await new ProjectRidaService(getDatabase()).updateItem(actor, {
				...input,
				itemPublicId: String(data.get('itemPublicId') ?? '')
			});
		} catch (cause) {
			return handleActionError(cause, 'update-item');
		}
		redirectToRida(params.projectPublicId);
	},

	transitionItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('transition-item', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectRidaService(getDatabase()).transitionItem(
				actor,
				params.projectPublicId,
				String(data.get('itemPublicId') ?? ''),
				String(data.get('toStatus') ?? '') as ProjectRidaLifecycleStatus
			);
		} catch (cause) {
			return handleActionError(cause, 'transition-item');
		}
		redirectToRida(params.projectPublicId);
	},

	decideItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('decide-item', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectRidaService(getDatabase()).decideItem(
				actor,
				params.projectPublicId,
				String(data.get('itemPublicId') ?? ''),
				String(data.get('outcome') ?? ''),
				String(data.get('rationale') ?? '')
			);
		} catch (cause) {
			return handleActionError(cause, 'decide-item');
		}
		redirectToRida(params.projectPublicId);
	},

	closeItem: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('close-item', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectRidaService(getDatabase()).closeItem(
				actor,
				params.projectPublicId,
				String(data.get('itemPublicId') ?? '')
			);
		} catch (cause) {
			return handleActionError(cause, 'close-item');
		}
		redirectToRida(params.projectPublicId);
	},

	createAction: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('create-action', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectRidaService(getDatabase()).createAction(actor, {
				projectPublicId: params.projectPublicId,
				itemPublicId: String(data.get('itemPublicId') ?? ''),
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				priority: String(data.get('priority') ?? 'normal') as 'low' | 'normal' | 'high' | 'critical',
				dueAt: parseDate(data.get('dueOn'), 'Action due date')
			});
		} catch (cause) {
			return handleActionError(cause, 'create-action');
		}
		redirectToRida(params.projectPublicId);
	}
};
