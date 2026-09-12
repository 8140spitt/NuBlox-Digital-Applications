import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectResourceCapacityService,
	ProjectResourceCapacityValidationError
} from '$lib/server/projects/project-resource-capacity-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function resourceFailure(resourceAction: string, resourceError: string) {
	return { resourceAction, resourceError };
}

function parseDateText(value: string | null, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		throw new ProjectResourceCapacityValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
		throw new ProjectResourceCapacityValidationError(`${label} is invalid.`);
	}
	return date;
}

function parseRequiredDate(value: FormDataEntryValue | null, label: string): Date {
	const parsed = parseDateText(String(value ?? ''), label);
	if (!parsed) throw new ProjectResourceCapacityValidationError(`${label} is required.`);
	return parsed;
}

function handleResourceActionError(cause: unknown, resourceAction: string) {
	if (cause instanceof RecordNotFoundError) {
		return fail(404, resourceFailure(resourceAction, cause.message));
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, resourceFailure(resourceAction, cause.message));
	}
	if (cause instanceof ProjectResourceCapacityValidationError) {
		return fail(400, resourceFailure(resourceAction, cause.message));
	}
	throw cause;
}

function redirectToResources(projectPublicId: string): never {
	throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}/resources`);
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		const fromOn = parseDateText(url.searchParams.get('from'), 'Capacity start');
		const toOn = parseDateText(url.searchParams.get('to'), 'Capacity finish');
		return await new ProjectResourceCapacityService(getDatabase()).getCapacity(
			actor,
			params.projectPublicId,
			{ fromOn, toOn }
		);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project resource capacity not found.');
		}
		if (cause instanceof ProjectResourceCapacityValidationError) {
			throw httpError(400, cause.message);
		}
		throw cause;
	}
};

export const actions: Actions = {
	createAllocation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) {
			return fail(401, resourceFailure('create-allocation', 'Authentication is required.'));
		}
		const data = await request.formData();
		try {
			await new ProjectResourceCapacityService(getDatabase()).createAllocation(actor, {
				projectPublicId: params.projectPublicId,
				activityPublicId: String(data.get('activityPublicId') ?? ''),
				resourceAssignmentPublicId: String(data.get('resourceAssignmentPublicId') ?? ''),
				plannedEffortHours: String(data.get('plannedEffortHours') ?? ''),
				loadStartOn: parseRequiredDate(data.get('loadStartOn'), 'Load start'),
				loadFinishOn: parseRequiredDate(data.get('loadFinishOn'), 'Load finish'),
				notes: String(data.get('notes') ?? '')
			});
		} catch (cause) {
			return handleResourceActionError(cause, 'create-allocation');
		}
		redirectToResources(params.projectPublicId);
	},

	removeAllocation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) {
			return fail(401, resourceFailure('remove-allocation', 'Authentication is required.'));
		}
		const data = await request.formData();
		try {
			await new ProjectResourceCapacityService(getDatabase()).removeAllocation(
				actor,
				params.projectPublicId,
				String(data.get('allocationPublicId') ?? '')
			);
		} catch (cause) {
			return handleResourceActionError(cause, 'remove-allocation');
		}
		redirectToResources(params.projectPublicId);
	}
};
