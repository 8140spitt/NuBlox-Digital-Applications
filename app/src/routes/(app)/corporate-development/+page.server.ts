import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	CorporateDevelopmentService,
	CorporateDevelopmentValidationError
} from '$lib/server/corporate-development/corporate-development-service';
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
function text(data: FormData, name: string) {
	return String(data.get(name) ?? '');
}
function nullableText(data: FormData, name: string) {
	const value = text(data, name).trim();
	return value || null;
}
async function runAction(
	locals: App.Locals,
	operation: (service: CorporateDevelopmentService, actor: TenantActorContext) => Promise<unknown>,
	selected?: string | null
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		const result = await operation(new CorporateDevelopmentService(getDatabase()), actor);
		const publicId =
			selected ??
			(typeof result === 'object' && result !== null && 'public_id' in result
				? String(result.public_id)
				: null);
		throw redirect(
			303,
			publicId
				? `/corporate-development?opportunity=${encodeURIComponent(publicId)}`
				: '/corporate-development'
		);
	} catch (error) {
		if (error instanceof CorporateDevelopmentValidationError)
			return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this corporate development action.' });
		if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
		throw error;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin');
	try {
		const db = getDatabase();
		const [workspace, members] = await Promise.all([
			new CorporateDevelopmentService(db).getWorkspace(actor, url.searchParams.get('opportunity')),
			db
				.selectFrom('organisation_members as member')
				.innerJoin('users as user', 'user.id', 'member.user_id')
				.select(['member.id as id', 'user.display_name as display_name'])
				.where('member.organisation_id', '=', actor.organisationId)
				.where('member.status', '=', 'active')
				.where('user.status', '=', 'active')
				.orderBy('user.display_name', 'asc')
				.execute()
		]);
		return { ...workspace, members, actorMemberId: actor.memberId };
	} catch (error) {
		if (error instanceof RecordNotFoundError)
			throw httpError(404, 'Corporate development opportunity not found in the active scope.');
		if (error instanceof TenantAccessError)
			throw httpError(403, 'You do not have access to Corporate Development.');
		throw error;
	}
};

export const actions: Actions = {
	createOpportunity: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createOpportunity(actor, {
				opportunityCode: text(data, 'opportunityCode'),
				title: text(data, 'title'),
				dealType: text(data, 'dealType') as never,
				targetName: text(data, 'targetName'),
				strategicThesis: text(data, 'strategicThesis'),
				strategicRationale: text(data, 'strategicRationale'),
				ownerMemberId: text(data, 'ownerMemberId'),
				priority: text(data, 'priority') as never,
				identifiedOn: text(data, 'identifiedOn'),
				targetDecisionDate: nullableText(data, 'targetDecisionDate'),
				targetSourceDomain: nullableText(data, 'targetSourceDomain'),
				targetSourceRecordType: nullableText(data, 'targetSourceRecordType'),
				targetSourcePublicId: nullableText(data, 'targetSourcePublicId'),
				strategyObjectivePublicId: nullableText(data, 'strategyObjectivePublicId'),
				strategyKpiPublicId: nullableText(data, 'strategyKpiPublicId'),
				performanceEvidencePublicId: nullableText(data, 'performanceEvidencePublicId'),
				sourceReference: nullableText(data, 'sourceReference')
			})
		);
	},
	createValuation: async ({ request, locals }) => {
		const data = await request.formData();
		const opportunityPublicId = text(data, 'opportunityPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createValuation(actor, {
					opportunityPublicId,
					valuationCode: text(data, 'valuationCode'),
					title: text(data, 'title'),
					valuationDate: text(data, 'valuationDate'),
					currencyCode: text(data, 'currencyCode'),
					primaryMethod: text(data, 'primaryMethod') as never,
					enterpriseValueLow: nullableText(data, 'enterpriseValueLow'),
					enterpriseValueBase: nullableText(data, 'enterpriseValueBase'),
					enterpriseValueHigh: nullableText(data, 'enterpriseValueHigh'),
					equityValueLow: nullableText(data, 'equityValueLow'),
					equityValueBase: nullableText(data, 'equityValueBase'),
					equityValueHigh: nullableText(data, 'equityValueHigh'),
					recommendation: text(data, 'recommendation')
				}),
			opportunityPublicId
		);
	},
	approveValuation: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.approveValuation(actor, text(data, 'valuationPublicId')),
			text(data, 'opportunityPublicId')
		);
	}
};
