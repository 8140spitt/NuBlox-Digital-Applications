import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { CollectionsAutomationService } from '$lib/server/finance/collections-automation-service';
import { FinanceValidationError } from '$lib/server/finance/finance-common';
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

function actionFailure(cause: unknown) {
	if (cause instanceof FinanceValidationError) return fail(400, { actionError: cause.message });
	if (cause instanceof RecordNotFoundError) return fail(404, { actionError: cause.message });
	if (cause instanceof TenantAccessError) return fail(403, { actionError: cause.message });
	throw cause;
}

const PATH = '/finance/collections/automation';

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CollectionsAutomationService(getDatabase()).getWorkspace(actor);
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw httpError(403, 'Collections automation access is not permitted.');
		throw cause;
	}
};

export const actions: Actions = {
	createDraft: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsAutomationService(getDatabase()).createDraftPolicy(actor, String(data.get('name') ?? ''));
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	},
	saveStage: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsAutomationService(getDatabase()).saveDraftStage(actor, {
				policyPublicId: String(data.get('policyPublicId') ?? ''),
				stagePublicId: String(data.get('stagePublicId') ?? '') || null,
				sequenceNumber: Number(data.get('sequenceNumber')),
				name: String(data.get('name') ?? ''),
				triggerDaysOverdue: Number(data.get('triggerDaysOverdue')),
				subjectTemplate: String(data.get('subjectTemplate') ?? ''),
				bodyTemplate: String(data.get('bodyTemplate') ?? ''),
				suppressOnOpenDispute: data.get('suppressOnOpenDispute') === 'on',
				suppressOnCurrentPromise: data.get('suppressOnCurrentPromise') === 'on'
			});
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	},
	deleteStage: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsAutomationService(getDatabase()).deleteDraftStage(
				actor,
				String(data.get('policyPublicId') ?? ''),
				String(data.get('stagePublicId') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	},
	activatePolicy: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsAutomationService(getDatabase()).activatePolicy(actor, String(data.get('policyPublicId') ?? ''));
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	},
	generateReminder: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			await new CollectionsAutomationService(getDatabase()).generateReminder(
				actor,
				String(data.get('casePublicId') ?? ''),
				String(data.get('stagePublicId') ?? '')
			);
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	},
	dispatchReminder: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { actionError: 'Authentication is required.' });
		const data = await request.formData();
		try {
			const result = await new CollectionsAutomationService(getDatabase()).dispatchReminder(actor, String(data.get('reminderPublicId') ?? ''));
			if (!result.sent) return fail(502, { actionError: result.errorMessage ?? 'Reminder delivery failed.' });
		} catch (cause) {
			return actionFailure(cause);
		}
		throw redirect(303, PATH);
	}
};
