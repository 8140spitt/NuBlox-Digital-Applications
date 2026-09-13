import { error, fail, redirect } from '@sveltejs/kit';
import {
	routes,
	type StrategyBusinessPlanningRecordKind
} from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyBusinessPlan,
	createStrategyInitiative,
	createStrategyResourceRequirement,
	getStrategyExecutionReviewWorkspace,
	requestStrategyInitiativeHandoff,
	type HandoffType,
	type RequirementType
} from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

const recordKinds: StrategyBusinessPlanningRecordKind[] = [
	'plan',
	'initiative',
	'requirement',
	'handoff'
];

function recordKind(value: string): StrategyBusinessPlanningRecordKind {
	if (!recordKinds.includes(value as StrategyBusinessPlanningRecordKind)) {
		error(404, 'Business planning record type not found.');
	}
	return value as StrategyBusinessPlanningRecordKind;
}

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

function submittedValues(formData: FormData): Record<string, string> {
	const values: Record<string, string> = {};
	for (const [key, value] of formData.entries()) {
		if (typeof value === 'string') values[key] = value;
	}
	return values;
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	const kind = recordKind(params.record);
	try {
		const workspace = await getStrategyExecutionReviewWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy
		});
		if (!workspace.permissions.canManage || workspace.framework.lifecycleStatus !== 'approved') {
			error(403, 'This strategy cycle is not available for business planning changes.');
		}
		return {
			recordKind: kind,
			framework: workspace.framework,
			objectives: workspace.objectives,
			plans: workspace.plans,
			initiatives: workspace.initiatives,
			resourceRequirements: workspace.resourceRequirements
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Business planning is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	create: async ({ request, params, url }) => {
		const kind = recordKind(params.record);
		const formData = await request.formData();
		const values = submittedValues(formData);
		const errors: Record<string, string> = {};
		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));
		const actor = {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		};

		try {
			if (kind === 'plan') {
				await createStrategyBusinessPlan({
					actor,
					frameworkPublicId: params.strategy,
					title: text(formData, 'title'),
					periodStart: text(formData, 'periodStart'),
					periodEnd: text(formData, 'periodEnd'),
					narrative: text(formData, 'narrative'),
					currencyCode: text(formData, 'currencyCode'),
					plannedRevenueAmount: text(formData, 'plannedRevenueAmount'),
					plannedOpexAmount: text(formData, 'plannedOpexAmount'),
					plannedCapexAmount: text(formData, 'plannedCapexAmount'),
					objectivePublicIds: formData.getAll('objectivePublicIds').map(String)
				});
			} else if (kind === 'initiative') {
				await createStrategyInitiative({
					actor,
					frameworkPublicId: params.strategy,
					planPublicId: text(formData, 'planPublicId'),
					objectivePublicId: text(formData, 'objectivePublicId'),
					title: text(formData, 'title'),
					outcomeText: text(formData, 'outcomeText'),
					benefitStatement: text(formData, 'benefitStatement'),
					priorityRank: text(formData, 'priorityRank'),
					startDate: text(formData, 'startDate'),
					endDate: text(formData, 'endDate'),
					plannedInvestmentAmount: text(formData, 'plannedInvestmentAmount'),
					plannedFte: text(formData, 'plannedFte'),
					currencyCode: text(formData, 'currencyCode')
				});
			} else if (kind === 'requirement') {
				await createStrategyResourceRequirement({
					actor,
					frameworkPublicId: params.strategy,
					initiativePublicId: text(formData, 'initiativePublicId'),
					requirementType: text(formData, 'requirementType') as RequirementType,
					title: text(formData, 'title'),
					description: text(formData, 'description'),
					amount: text(formData, 'amount'),
					currencyCode: text(formData, 'currencyCode'),
					quantity: text(formData, 'quantity'),
					unitLabel: text(formData, 'unitLabel'),
					targetFunctionCode: text(formData, 'targetFunctionCode'),
					needBy: text(formData, 'needBy')
				});
			} else {
				await requestStrategyInitiativeHandoff({
					actor,
					frameworkPublicId: params.strategy,
					initiativePublicId: text(formData, 'initiativePublicId'),
					resourceRequirementPublicId: text(formData, 'resourceRequirementPublicId'),
					handoffType: text(formData, 'handoffType') as HandoffType,
					targetFunctionCode: text(formData, 'targetFunctionCode'),
					requestSummary: text(formData, 'requestSummary')
				});
			}
			redirect(
				303,
				routes.strategyBusinessPlanning(access.organisationRouteSlug, params.strategy)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, { values, errors, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, { values, errors, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
