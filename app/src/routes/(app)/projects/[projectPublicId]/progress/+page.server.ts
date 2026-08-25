import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectProgressService,
	ProjectProgressValidationError
} from '$lib/server/projects/project-progress-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function actionFailure(progressAction: string, progressError: string) {
	return { progressAction, progressError };
}

function parseDate(value: FormDataEntryValue | string | null, label: string): Date | null {
	const text = String(value ?? '').trim();
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new ProjectProgressValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new ProjectProgressValidationError(`${label} is invalid.`);
	}
	return parsed;
}

function requiredDate(value: FormDataEntryValue | null, label: string): Date {
	const parsed = parseDate(value, label);
	if (!parsed) throw new ProjectProgressValidationError(`${label} is required.`);
	return parsed;
}

function handleActionError(cause: unknown, progressAction: string) {
	if (cause instanceof RecordNotFoundError) return fail(404, actionFailure(progressAction, cause.message));
	if (cause instanceof TenantAccessError) return fail(403, actionFailure(progressAction, cause.message));
	if (cause instanceof ProjectProgressValidationError) return fail(400, actionFailure(progressAction, cause.message));
	throw cause;
}

function redirectToProgress(
	projectPublicId: string,
	options: { period?: string | null; baseline?: string | null } = {}
): never {
	const query = new URLSearchParams();
	if (options.period) query.set('period', options.period);
	if (options.baseline) query.set('baseline', options.baseline);
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/progress${query.size ? `?${query}` : ''}`);
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new ProjectProgressService(getDatabase()).getWorkspace(actor, params.projectPublicId, {
			periodPublicId: url.searchParams.get('period'),
			baselinePublicId: url.searchParams.get('baseline'),
			dataDate: parseDate(url.searchParams.get('dataDate'), 'Data date')
		});
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project progress not found.');
		}
		if (cause instanceof ProjectProgressValidationError) throw httpError(400, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	createPeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('create-period', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const publicId = await new ProjectProgressService(getDatabase()).createProgressPeriod(actor, {
				projectPublicId: params.projectPublicId,
				label: String(data.get('label') ?? ''),
				dataDate: requiredDate(data.get('dataDate'), 'Data date')
			});
			redirectToProgress(params.projectPublicId, { period: publicId });
		} catch (cause) {
			return handleActionError(cause, 'create-period');
		}
	},

	recordProgress: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('record-progress', 'Authentication is required.'));
		const data = await request.formData();
		const periodPublicId = String(data.get('periodPublicId') ?? '');
		try {
			await new ProjectProgressService(getDatabase()).recordActivityProgress(actor, {
				projectPublicId: params.projectPublicId,
				periodPublicId,
				activityPublicId: String(data.get('activityPublicId') ?? ''),
				measurementMethod: String(data.get('measurementMethod') ?? '') as never,
				percentComplete: String(data.get('percentComplete') ?? ''),
				actualStartOn: parseDate(data.get('actualStartOn'), 'Actual start'),
				actualFinishOn: parseDate(data.get('actualFinishOn'), 'Actual finish'),
				remainingDurationDays: String(data.get('remainingDurationDays') ?? ''),
				quantityComplete: String(data.get('quantityComplete') ?? ''),
				quantityTotal: String(data.get('quantityTotal') ?? ''),
				quantityUnit: String(data.get('quantityUnit') ?? ''),
				commentary: String(data.get('commentary') ?? '')
			});
		} catch (cause) {
			return handleActionError(cause, 'record-progress');
		}
		redirectToProgress(params.projectPublicId, { period: periodPublicId });
	},

	submitPeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('submit-period', 'Authentication is required.'));
		const data = await request.formData();
		const periodPublicId = String(data.get('periodPublicId') ?? '');
		try {
			await new ProjectProgressService(getDatabase()).submitProgressPeriod(actor, params.projectPublicId, periodPublicId);
		} catch (cause) {
			return handleActionError(cause, 'submit-period');
		}
		redirectToProgress(params.projectPublicId, { period: periodPublicId });
	},

	approvePeriod: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('approve-period', 'Authentication is required.'));
		const data = await request.formData();
		const periodPublicId = String(data.get('periodPublicId') ?? '');
		try {
			await new ProjectProgressService(getDatabase()).approveProgressPeriod(actor, params.projectPublicId, periodPublicId);
		} catch (cause) {
			return handleActionError(cause, 'approve-period');
		}
		redirectToProgress(params.projectPublicId, { period: periodPublicId });
	},

	createBaseline: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('create-baseline', 'Authentication is required.'));
		const data = await request.formData();
		try {
			const publicId = await new ProjectProgressService(getDatabase()).createEarnedValueBaseline(actor, {
				projectPublicId: params.projectPublicId,
				planBaselinePublicId: String(data.get('planBaselinePublicId') ?? ''),
				name: String(data.get('name') ?? '')
			});
			redirectToProgress(params.projectPublicId, { baseline: publicId });
		} catch (cause) {
			return handleActionError(cause, 'create-baseline');
		}
	},

	setAllocation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('set-allocation', 'Authentication is required.'));
		const data = await request.formData();
		const baselinePublicId = String(data.get('baselinePublicId') ?? '');
		try {
			await new ProjectProgressService(getDatabase()).setEarnedValueAllocation(actor, {
				projectPublicId: params.projectPublicId,
				earnedValueBaselinePublicId: baselinePublicId,
				activityPublicId: String(data.get('activityPublicId') ?? ''),
				budgetAtCompletionAmount: String(data.get('budgetAtCompletionAmount') ?? '')
			});
		} catch (cause) {
			return handleActionError(cause, 'set-allocation');
		}
		redirectToProgress(params.projectPublicId, { baseline: baselinePublicId });
	},

	approveBaseline: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, actionFailure('approve-baseline', 'Authentication is required.'));
		const data = await request.formData();
		const baselinePublicId = String(data.get('baselinePublicId') ?? '');
		try {
			await new ProjectProgressService(getDatabase()).approveEarnedValueBaseline(actor, params.projectPublicId, baselinePublicId);
		} catch (cause) {
			return handleActionError(cause, 'approve-baseline');
		}
		redirectToProgress(params.projectPublicId, { baseline: baselinePublicId });
	}
};
