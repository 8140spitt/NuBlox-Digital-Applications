import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CrmOpportunityService,
	CrmOpportunityValidationError
} from '$lib/server/crm/crm-opportunity-service';
import type { OpportunityStatus } from '$lib/server/crm/crm-opportunity-repository';
import { CrmPipelineProvisioningService } from '$lib/server/crm/crm-pipeline-provisioning';
import { CrmRepository, type CrmPartySummary } from '$lib/server/crm/crm-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';

const OPPORTUNITY_CUSTOMER_ROLE_CODES = new Set(['prospect', 'client']);

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function isOpportunityCustomer(party: CrmPartySummary): boolean {
	return (
		party.status === 'active' &&
		party.kind === 'organisation' &&
		party.roles.some((role) => OPPORTUNITY_CUSTOMER_ROLE_CODES.has(role.code))
	);
}

async function assertOpportunityCustomer(
	db: Database,
	actor: TenantActorContext,
	partyPublicId: string
): Promise<void> {
	const party = await new CrmRepository(db).findPartyByPublicId(
		actor.organisationId,
		partyPublicId.trim()
	);
	if (!party || !isOpportunityCustomer(party)) {
		throw new CrmOpportunityValidationError(
			'Choose an active CRM organisation classified as a prospect or client.'
		);
	}
}

function parseStatus(value: string | null): OpportunityStatus | undefined {
	return value === 'open' || value === 'won' || value === 'lost' || value === 'cancelled'
		? value
		: undefined;
}

function stageSelection(value: FormDataEntryValue | null): {
	pipelinePublicId: string;
	stageName: string;
} {
	const raw = String(value ?? '');
	const separator = raw.indexOf('::');
	if (separator <= 0 || separator >= raw.length - 2) {
		throw new CrmOpportunityValidationError('Choose a pipeline stage.');
	}
	return {
		pipelinePublicId: raw.slice(0, separator),
		stageName: raw.slice(separator + 2)
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	const search = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	const filters = {
		search: search || undefined,
		status: parseStatus(url.searchParams.get('status'))
	};
	const db = getDatabase();
	const service = new CrmOpportunityService(db);
	let workspace = await service.listWorkspace(actor, filters);
	if (workspace.canManageOpportunities && workspace.pipelines.length === 0) {
		await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
		workspace = await service.listWorkspace(actor, filters);
	}
	return {
		...workspace,
		partyCandidates: workspace.partyCandidates.filter(isOpportunityCustomer)
	};
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { createError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			const selectedStage = stageSelection(data.get('stageSelection'));
			const primaryPartyPublicId = String(data.get('primaryPartyPublicId') ?? '');
			const db = getDatabase();
			await assertOpportunityCustomer(db, actor, primaryPartyPublicId);
			const opportunity = await new CrmOpportunityService(db).createOpportunity(actor, {
				title: String(data.get('title') ?? ''),
				description: String(data.get('description') ?? ''),
				pipelinePublicId: selectedStage.pipelinePublicId,
				stageName: selectedStage.stageName,
				estimatedValue: String(data.get('estimatedValue') ?? ''),
				currencyCode: String(data.get('currencyCode') ?? 'GBP'),
				expectedCloseDate: String(data.get('expectedCloseDate') ?? ''),
				primaryPartyPublicId
			});
			throw redirect(303, `/crm/opportunities/${encodeURIComponent(opportunity.publicId)}`);
		} catch (error) {
			if (error instanceof CrmOpportunityValidationError)
				return fail(400, { createError: error.message });
			if (error instanceof TenantAccessError) {
				return fail(403, {
					createError: 'You do not have permission to manage CRM opportunities.'
				});
			}
			throw error;
		}
	}
};
