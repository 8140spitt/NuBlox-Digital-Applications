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
import type { ProjectLifecycleStatus } from '$lib/server/projects/project-repository';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';

const PROJECT_STATUSES = new Set<ProjectLifecycleStatus>([
	'proposed',
	'active',
	'on_hold',
	'completed',
	'cancelled',
	'archived'
]);

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function parseEffectiveDate(value: FormDataEntryValue | null): Date | undefined {
	if (typeof value !== 'string' || !value.trim()) return undefined;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
		throw new InvalidLifecycleTransitionError('invalid-date', 'invalid-date');
	}
	const parsed = new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) {
		throw new InvalidLifecycleTransitionError('invalid-date', 'invalid-date');
	}
	return parsed;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');

	try {
		return await new ProjectWorkspaceService(getDatabase()).getWorkspace(actor, params.projectPublicId);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw httpError(404, 'Project not found.');
		}
		throw cause;
	}
};

export const actions: Actions = {
	transition: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { transitionError: 'Authentication and organisation context are required.' });

		const data = await request.formData();
		const rawStatus = String(data.get('toStatus') ?? '');
		if (!PROJECT_STATUSES.has(rawStatus as ProjectLifecycleStatus)) {
			return fail(400, { transitionError: 'The requested project status is invalid.' });
		}

		let effectiveDate: Date | undefined;
		try {
			effectiveDate = parseEffectiveDate(data.get('effectiveDate'));
		} catch {
			return fail(400, { transitionError: 'The effective date is invalid.' });
		}

		try {
			await new ProjectWorkspaceService(getDatabase()).transitionProject(actor, {
				projectPublicId: params.projectPublicId,
				toStatus: rawStatus as ProjectLifecycleStatus,
				effectiveDate
			});
		} catch (cause) {
			if (cause instanceof RecordNotFoundError) {
				return fail(404, { transitionError: 'Project not found.' });
			}
			if (cause instanceof TenantAccessError) {
				return fail(403, { transitionError: 'You do not have permission to manage this project lifecycle.' });
			}
			if (cause instanceof InvalidLifecycleTransitionError) {
				return fail(409, { transitionError: 'That lifecycle transition is not allowed from the current project state.' });
			}
			if (cause instanceof ConcurrentUpdateError) {
				return fail(409, { transitionError: 'The project changed concurrently. Reload and try again.' });
			}
			throw cause;
		}

		throw redirect(303, `/projects/${encodeURIComponent(params.projectPublicId)}`);
	}
};
