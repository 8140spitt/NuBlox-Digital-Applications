import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { WorkforceService, WorkforceValidationError } from '$lib/server/workforce/workforce-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function actionFailure(error: unknown, fallbackPermissionMessage: string) {
	if (error instanceof WorkforceValidationError) return fail(400, { error: error.message });
	if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
	if (error instanceof ConcurrentUpdateError) return fail(409, { error: error.message });
	if (error instanceof TenantAccessError) return fail(403, { error: fallbackPermissionMessage });
	throw error;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canManageOwn: false,
			canSubmitOwn: false,
			canApprove: false,
			currentWorker: null,
			ownTimesheets: [],
			approvalQueue: [],
			projectAssignments: [],
			assignedScheduleEvents: []
		};
	}
	return new WorkforceService(getDatabase()).getTimeWorkspace(actor);
};

export const actions: Actions = {
	createTimesheet: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).createTimesheet(actor, {
				periodStart: String(data.get('periodStart') ?? ''),
				periodEnd: String(data.get('periodEnd') ?? '')
			});
		} catch (error) {
			return actionFailure(error, 'You do not have permission to create your own timesheets.');
		}
		throw redirect(303, '/time');
	},

	addEntry: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).addTimesheetEntry(actor, {
				timesheetPublicId: String(data.get('timesheetPublicId') ?? ''),
				workDate: String(data.get('workDate') ?? ''),
				workedMinutes: String(data.get('workedMinutes') ?? ''),
				projectPublicId: String(data.get('projectPublicId') ?? ''),
				scheduleEventPublicId: String(data.get('scheduleEventPublicId') ?? ''),
				description: String(data.get('description') ?? ''),
				isBillable: data.get('isBillable') === 'on'
			});
		} catch (error) {
			return actionFailure(error, 'You do not have permission to edit your own timesheets.');
		}
		throw redirect(303, '/time');
	},

	submit: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).submitTimesheet(
				actor,
				String(data.get('timesheetPublicId') ?? '')
			);
		} catch (error) {
			return actionFailure(error, 'You do not have permission to submit this timesheet.');
		}
		throw redirect(303, '/time');
	},

	approve: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).decideTimesheet(actor, {
				timesheetPublicId: String(data.get('timesheetPublicId') ?? ''),
				decision: 'approve',
				comment: String(data.get('comment') ?? '')
			});
		} catch (error) {
			return actionFailure(error, 'You do not have permission to approve this timesheet.');
		}
		throw redirect(303, '/time');
	},

	reject: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new WorkforceService(getDatabase()).decideTimesheet(actor, {
				timesheetPublicId: String(data.get('timesheetPublicId') ?? ''),
				decision: 'reject',
				comment: String(data.get('comment') ?? '')
			});
		} catch (error) {
			return actionFailure(error, 'You do not have permission to reject this timesheet.');
		}
		throw redirect(303, '/time');
	}
};
