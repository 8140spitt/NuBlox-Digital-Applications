import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	BusinessPlanningService,
	BusinessPlanningValidationError
} from '$lib/server/strategy/business-planning-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '');
}

function nullableText(data: FormData, name: string): string | null {
	const value = text(data, name).trim();
	return value || null;
}

async function runAction(
	locals: App.Locals,
	operation: (
		service: BusinessPlanningService,
		actor: TenantActorContext
	) => Promise<{ public_id?: string } | void>,
	fallbackPlanPublicId?: string | null
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		const result = await operation(new BusinessPlanningService(getDatabase()), actor);
		const planPublicId = fallbackPlanPublicId ?? result?.public_id ?? null;
		throw redirect(
			303,
			planPublicId
				? `/strategy/planning?plan=${encodeURIComponent(planPublicId)}`
				: '/strategy/planning'
		);
	} catch (error) {
		if (error instanceof BusinessPlanningValidationError)
			return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this business-planning action.' });
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
			new BusinessPlanningService(db).getWorkspace(actor, url.searchParams.get('plan')),
			db
				.selectFrom('organisation_members as member')
				.innerJoin('users as user', 'user.id', 'member.user_id')
				.select(['member.id as id', 'user.display_name as display_name'])
				.where('member.organisation_id', '=', actor.organisationId)
				.where('member.status', '=', 'active')
				.orderBy('user.display_name', 'asc')
				.execute()
		]);
		return { ...workspace, members };
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			throw httpError(404, 'Business planning workspace not found in the active scope.');
		}
		if (error instanceof TenantAccessError) {
			throw httpError(403, 'You do not have access to the business planning workspace.');
		}
		throw error;
	}
};

export const actions: Actions = {
	createPlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createPlan(actor, {
				frameworkPublicId: text(data, 'frameworkPublicId'),
				planCode: text(data, 'planCode'),
				title: text(data, 'title'),
				periodStart: text(data, 'periodStart'),
				periodEnd: text(data, 'periodEnd'),
				narrative: text(data, 'narrative'),
				currencyCode: text(data, 'currencyCode'),
				plannedRevenueAmount: nullableText(data, 'plannedRevenueAmount'),
				plannedOpexAmount: nullableText(data, 'plannedOpexAmount'),
				plannedCapexAmount: nullableText(data, 'plannedCapexAmount'),
				ownerMemberId: nullableText(data, 'ownerMemberId')
			})
		);
	},
	addInitiative: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addInitiative(actor, {
					planPublicId,
					objectivePublicId: text(data, 'objectivePublicId'),
					initiativeCode: text(data, 'initiativeCode'),
					title: text(data, 'title'),
					outcomeText: text(data, 'outcomeText'),
					benefitStatement: nullableText(data, 'benefitStatement'),
					resourceAssumptions: nullableText(data, 'resourceAssumptions'),
					riskSummary: nullableText(data, 'riskSummary'),
					priorityRank: text(data, 'priorityRank'),
					startDate: text(data, 'startDate'),
					endDate: text(data, 'endDate'),
					ownerMemberId: nullableText(data, 'ownerMemberId'),
					sponsorMemberId: nullableText(data, 'sponsorMemberId'),
					plannedInvestmentAmount: nullableText(data, 'plannedInvestmentAmount'),
					plannedFte: nullableText(data, 'plannedFte'),
					currencyCode: text(data, 'currencyCode'),
					projectPublicId: nullableText(data, 'projectPublicId'),
					projectBudgetPublicId: nullableText(data, 'projectBudgetPublicId')
				}),
			planPublicId
		);
	},
	addMilestone: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addMilestone(actor, {
					planPublicId,
					initiativePublicId: text(data, 'initiativePublicId'),
					milestoneCode: text(data, 'milestoneCode'),
					title: text(data, 'title'),
					targetDate: text(data, 'targetDate'),
					ownerMemberId: nullableText(data, 'ownerMemberId')
				}),
			planPublicId
		);
	},
	addDependency: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addDependency(actor, {
					planPublicId,
					initiativePublicId: text(data, 'initiativePublicId'),
					dependsOnInitiativePublicId: text(data, 'dependsOnInitiativePublicId'),
					dependencyType: text(data, 'dependencyType') as
						| 'finish_to_start'
						| 'start_to_start'
						| 'finish_to_finish'
						| 'start_to_finish'
						| 'governance'
						| 'resource'
						| 'external'
				}),
			planPublicId
		);
	},
	addComponent: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addOperatingModelComponent(actor, {
					planPublicId,
					componentCode: text(data, 'componentCode'),
					parentComponentPublicId: nullableText(data, 'parentComponentPublicId'),
					componentType: text(data, 'componentType') as
						| 'business_capability'
						| 'value_stream'
						| 'organisation_design'
						| 'process'
						| 'governance'
						| 'information'
						| 'technology'
						| 'partner_ecosystem'
						| 'location',
					title: text(data, 'title'),
					currentStateText: nullableText(data, 'currentStateText'),
					targetStateText: text(data, 'targetStateText')
				}),
			planPublicId
		);
	},
	addAccountability: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addAccountability(actor, {
					planPublicId,
					componentPublicId: text(data, 'componentPublicId'),
					accountabilityType: text(data, 'accountabilityType') as
						'accountable' | 'responsible' | 'consulted' | 'informed' | 'assured',
					positionLabel: text(data, 'positionLabel'),
					memberId: nullableText(data, 'memberId'),
					notes: nullableText(data, 'notes')
				}),
			planPublicId
		);
	},
	linkInitiativeComponent: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.linkInitiativeToOperatingModel(actor, {
					planPublicId,
					initiativePublicId: text(data, 'initiativePublicId'),
					componentPublicId: text(data, 'componentPublicId'),
					changeRole: text(data, 'changeRole') as
						'create' | 'transform' | 'enable' | 'consume' | 'retire'
				}),
			planPublicId
		);
	},
	approvePlan: async ({ request, locals }) => {
		const data = await request.formData();
		const planPublicId = text(data, 'planPublicId');
		return runAction(
			locals,
			(service, actor) => service.approvePlan(actor, planPublicId),
			planPublicId
		);
	},
	revisePlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.revisePlan(actor, text(data, 'planPublicId'))
		);
	}
};
