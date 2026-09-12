import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	WorkforceService,
	WorkforceValidationError
} from '$lib/server/workforce/workforce-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManage: false,
			currentWorker: null,
			events: [],
			workers: [],
			projects: [],
			eventTypes: [],
			from: new Date(),
			to: new Date()
		};
	}
	return new WorkforceService(getDatabase()).getScheduleWorkspace(actor);
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).createScheduleEvent(actor, {
				eventTypeCode: String(data.get('eventTypeCode') ?? ''),
				projectPublicId: String(data.get('projectPublicId') ?? ''),
				workerPublicIds: data.getAll('workerPublicIds').map(String),
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				startsAtLocal: String(data.get('startsAtLocal') ?? ''),
				endsAtLocal: String(data.get('endsAtLocal') ?? ''),
				timezone: String(data.get('timezone') ?? 'Europe/London')
			});
		} catch (error) {
			if (error instanceof WorkforceValidationError) return fail(400, { error: error.message });
			if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
			if (error instanceof TenantAccessError)
				return fail(403, { error: 'You do not have permission to manage the schedule.' });
			throw error;
		}
		throw redirect(303, '/schedule');
	}
};
