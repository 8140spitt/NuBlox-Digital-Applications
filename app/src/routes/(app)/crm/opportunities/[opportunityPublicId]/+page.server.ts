import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CrmOpportunityService,
	CrmOpportunityValidationError
} from '$lib/server/crm/crm-opportunity-service';
import type { ActivityDirection, OpportunityStatus } from '$lib/server/crm/crm-opportunity-repository';
import { getDatabase } from '$lib/server/db/database';
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

function stageSelection(value: FormDataEntryValue | null): { pipelinePublicId: string; stageName: string } {
	const raw = String(value ?? '');
	const separator = raw.indexOf('::');
	if (separator <= 0 || separator >= raw.length - 2) {
		throw new CrmOpportunityValidationError('Choose a pipeline stage.');
	}
	return { pipelinePublicId: raw.slice(0, separator), stageName: raw.slice(separator + 2) };
}

function statusValue(value: FormDataEntryValue | null): OpportunityStatus {
	const status = String(value ?? '');
	if (status === 'open' || status === 'won' || status === 'lost' || status === 'cancelled') return status;
	throw new CrmOpportunityValidationError('Choose a valid opportunity status.');
}

function directionValue(value: FormDataEntryValue | null): ActivityDirection {
	const direction = String(value ?? '');
	if (!direction) return null;
	if (direction === 'inbound' || direction === 'outbound' || direction === 'internal') return direction;
	throw new CrmOpportunityValidationError('Choose a valid activity direction.');
}

function actionError(error: unknown, key: string) {
	if (error instanceof CrmOpportunityValidationError) return fail(400, { [key]: error.message });
	if (error instanceof TenantAccessError) return fail(403, { [key]: 'You do not have permission for this CRM action.' });
	if (error instanceof RecordNotFoundError) return fail(404, { [key]: error.message });
	throw error;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CrmOpportunityService(getDatabase()).getWorkspace(actor, params.opportunityPublicId);
	} catch (error) {
		if (error instanceof RecordNotFoundError) throw httpError(404, 'CRM opportunity not found.');
		if (error instanceof TenantAccessError) throw httpError(403, 'CRM viewing is not permitted.');
		throw error;
	}
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { updateError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const selectedStage = stageSelection(data.get('stageSelection'));
			await new CrmOpportunityService(getDatabase()).updateOpportunity(actor, {
				opportunityPublicId: params.opportunityPublicId,
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				pipelinePublicId: selectedStage.pipelinePublicId,
				stageName: selectedStage.stageName,
				estimatedValue: String(data.get('estimatedValue') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? 'GBP'),
				expectedCloseDate: String(data.get('expectedCloseDate') ?? ''),
				primaryPartyPublicId: String(data.get('primaryPartyPublicId') ?? ''),
				status: statusValue(data.get('status'))
			});
			throw redirect(303, `/crm/opportunities/${encodeURIComponent(params.opportunityPublicId)}`);
		} catch (error) {
			return actionError(error, 'updateError');
		}
	},

	addParticipant: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { participantError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CrmOpportunityService(getDatabase()).addParticipant(actor, {
				opportunityPublicId: params.opportunityPublicId,
				partyPublicId: String(data.get('partyPublicId') ?? ''),
				roleCode: String(data.get('roleCode') ?? '')
			});
			throw redirect(303, `/crm/opportunities/${encodeURIComponent(params.opportunityPublicId)}#participants`);
		} catch (error) {
			return actionError(error, 'participantError');
		}
	},

	removeParticipant: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { participantError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CrmOpportunityService(getDatabase()).removeParticipant(actor, {
				opportunityPublicId: params.opportunityPublicId,
				partyPublicId: String(data.get('partyPublicId') ?? ''),
				roleCode: String(data.get('roleCode') ?? '')
			});
			throw redirect(303, `/crm/opportunities/${encodeURIComponent(params.opportunityPublicId)}#participants`);
		} catch (error) {
			return actionError(error, 'participantError');
		}
	},

	createActivity: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { activityError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CrmOpportunityService(getDatabase()).createActivity(actor, {
				opportunityPublicId: params.opportunityPublicId,
				activityTypeCode: String(data.get('activityTypeCode') ?? ''),
				subject: String(data.get('subject') ?? ''),
				body: String(data.get('body') ?? ''),
				direction: directionValue(data.get('direction')),
				partyPublicIds: data.getAll('partyPublicId').map(String)
			});
			throw redirect(303, `/crm/opportunities/${encodeURIComponent(params.opportunityPublicId)}#timeline`);
		} catch (error) {
			return actionError(error, 'activityError');
		}
	}
};
