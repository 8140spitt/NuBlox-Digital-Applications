import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { ConcurrentUpdateError, RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectPlanService,
	ProjectPlanValidationError
} from '$lib/server/projects/project-plan-service';
import type {
	ProjectPlanActivityKind,
	ProjectPlanDependencyType
} from '$lib/server/projects/project-plan-repository';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function planFailure(planAction: string, planError: string) {
	return { planAction, planError };
}

function parseDate(value: FormDataEntryValue | null, label: string): Date {
	const raw = String(value ?? '').trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		throw new ProjectPlanValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${raw}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new ProjectPlanValidationError(`${label} is invalid.`);
	return date;
}

function handlePlanActionError(cause: unknown, planAction: string) {
	if (cause instanceof RecordNotFoundError) return fail(404, planFailure(planAction, cause.message));
	if (cause instanceof TenantAccessError) return fail(403, planFailure(planAction, cause.message));
	if (cause instanceof ProjectPlanValidationError) return fail(400, planFailure(planAction, cause.message));
	if (cause instanceof ConcurrentUpdateError) {
		return fail(409, planFailure(planAction, 'The project plan changed concurrently. Reload and try again.'));
	}
	throw cause;
}

function redirectToPlan(projectPublicId: string): never {
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/plan`);
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ProjectPlanService(getDatabase()).getPlan(actor, params.projectPublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project plan not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	createWbs: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, planFailure('create-wbs', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectPlanService(getDatabase()).createWbsNode(actor, {
				projectPublicId: params.projectPublicId,
				parentWbsNodePublicId: String(data.get('parentWbsNodePublicId') ?? ''),
				wbsCode: String(data.get('wbsCode') ?? ''),
				name: String(data.get('wbsName') ?? ''),
				description: String(data.get('wbsDescription') ?? ''),
				sortOrder: Number(data.get('sortOrder') ?? 0)
			});
		} catch (cause) {
			return handlePlanActionError(cause, 'create-wbs');
		}
		redirectToPlan(params.projectPublicId);
	},

	createActivity: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, planFailure('create-activity', 'Authentication is required.'));
		const data = await request.formData();
		const activityKind = String(data.get('activityKind') ?? '') as ProjectPlanActivityKind;
		try {
			await new ProjectPlanService(getDatabase()).createActivity(actor, {
				projectPublicId: params.projectPublicId,
				wbsNodePublicId: String(data.get('wbsNodePublicId') ?? ''),
				activityCode: String(data.get('activityCode') ?? ''),
				name: String(data.get('activityName') ?? ''),
				description: String(data.get('activityDescription') ?? ''),
				activityKind,
				plannedStartOn: parseDate(data.get('plannedStartOn'), 'Planned start'),
				plannedFinishOn: parseDate(data.get('plannedFinishOn'), 'Planned finish'),
				plannedDurationDays: String(data.get('plannedDurationDays') ?? '')
			});
		} catch (cause) {
			return handlePlanActionError(cause, 'create-activity');
		}
		redirectToPlan(params.projectPublicId);
	},

	addDependency: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, planFailure('add-dependency', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectPlanService(getDatabase()).addDependency(actor, {
				projectPublicId: params.projectPublicId,
				predecessorActivityPublicId: String(data.get('predecessorActivityPublicId') ?? ''),
				successorActivityPublicId: String(data.get('successorActivityPublicId') ?? ''),
				dependencyType: String(data.get('dependencyType') ?? '') as ProjectPlanDependencyType,
				lagDays: String(data.get('lagDays') ?? '0')
			});
		} catch (cause) {
			return handlePlanActionError(cause, 'add-dependency');
		}
		redirectToPlan(params.projectPublicId);
	},

	removeDependency: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, planFailure('remove-dependency', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectPlanService(getDatabase()).removeDependency(
				actor,
				params.projectPublicId,
				String(data.get('dependencyPublicId') ?? '')
			);
		} catch (cause) {
			return handlePlanActionError(cause, 'remove-dependency');
		}
		redirectToPlan(params.projectPublicId);
	},

	captureBaseline: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, planFailure('capture-baseline', 'Authentication is required.'));
		const data = await request.formData();
		try {
			await new ProjectPlanService(getDatabase()).captureBaseline(actor, {
				projectPublicId: params.projectPublicId,
				name: String(data.get('baselineName') ?? ''),
				description: String(data.get('baselineDescription') ?? '')
			});
		} catch (cause) {
			return handlePlanActionError(cause, 'capture-baseline');
		}
		redirectToPlan(params.projectPublicId);
	}
};
