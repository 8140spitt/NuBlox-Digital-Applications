import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProductServiceLifecycleService } from '$lib/server/product-service/product-service-lifecycle-service';
import {
	ProductServiceService,
	ProductServiceValidationError
} from '$lib/server/product-service/product-service-service';

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

function numberValue(data: FormData, name: string) {
	const value = nullableText(data, name);
	return value === null ? null : Number(value);
}

function dateValue(data: FormData, name: string) {
	const value = nullableText(data, name);
	return value === null ? null : new Date(`${value}T00:00:00.000Z`);
}

function requiredDate(data: FormData, name: string) {
	const value = dateValue(data, name);
	if (!value || Number.isNaN(value.getTime())) {
		throw new ProductServiceValidationError(`${name} must be a valid date.`);
	}
	return value;
}

function actionError(error: unknown) {
	if (error instanceof ProductServiceValidationError) {
		return fail(400, { error: error.message });
	}
	if (error instanceof TenantAccessError) {
		return fail(403, { error: 'You do not have access to this product/service action.' });
	}
	if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
	throw error;
}

async function runAction(
	locals: App.Locals,
	operation: (service: ProductServiceService, actor: TenantActorContext) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		await operation(new ProductServiceService(getDatabase()), actor);
		throw redirect(303, '/product-service');
	} catch (error) {
		return actionError(error);
	}
}

async function runLifecycleAction(
	locals: App.Locals,
	operation: (
		service: ProductServiceLifecycleService,
		actor: TenantActorContext
	) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		await operation(new ProductServiceLifecycleService(getDatabase()), actor);
		throw redirect(303, '/product-service');
	} catch (error) {
		return actionError(error);
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin');
	try {
		const db = getDatabase();
		const [workspace, lifecycle, members] = await Promise.all([
			new ProductServiceService(db).getWorkspace(actor),
			new ProductServiceLifecycleService(db).getWorkspace(actor),
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
		return { ...workspace, ...lifecycle, members, actorMemberId: actor.memberId };
	} catch (error) {
		if (error instanceof TenantAccessError) {
			throw httpError(403, 'You do not have access to Product, Service & Innovation Management.');
		}
		throw error;
	}
};

export const actions: Actions = {
	createPortfolio: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createPortfolio(actor, {
				portfolioCode: text(data, 'portfolioCode'),
				title: text(data, 'title'),
				portfolioType: text(data, 'portfolioType') as never,
				strategicThesis: text(data, 'strategicThesis'),
				ownerMemberId: text(data, 'ownerMemberId'),
				priority: text(data, 'priority') as never,
				strategyObjectivePublicId: nullableText(data, 'strategyObjectivePublicId'),
				strategyKpiPublicId: nullableText(data, 'strategyKpiPublicId'),
				performanceEvidencePublicId: nullableText(data, 'performanceEvidencePublicId')
			})
		);
	},
	createOffering: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createOffering(actor, {
				portfolioPublicId: text(data, 'portfolioPublicId'),
				offeringCode: text(data, 'offeringCode'),
				title: text(data, 'title'),
				offeringType: text(data, 'offeringType') as never,
				valueProposition: text(data, 'valueProposition'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	createNeed: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createNeed(actor, {
				portfolioPublicId: nullableText(data, 'portfolioPublicId'),
				needCode: text(data, 'needCode'),
				title: text(data, 'title'),
				needType: text(data, 'needType') as never,
				needStatement: text(data, 'needStatement'),
				sourceDomain: text(data, 'sourceDomain'),
				sourceRecordType: nullableText(data, 'sourceRecordType'),
				sourcePublicId: nullableText(data, 'sourcePublicId'),
				sourceReference: nullableText(data, 'sourceReference'),
				customerOrMarketSegment: nullableText(data, 'customerOrMarketSegment'),
				evidenceStrength: text(data, 'evidenceStrength') as never,
				urgency: text(data, 'urgency') as never,
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	createIdea: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createIdea(actor, {
				portfolioPublicId: nullableText(data, 'portfolioPublicId'),
				needPublicId: nullableText(data, 'needPublicId'),
				ideaCode: text(data, 'ideaCode'),
				title: text(data, 'title'),
				ideaType: text(data, 'ideaType') as never,
				problemStatement: text(data, 'problemStatement'),
				proposedValue: text(data, 'proposedValue'),
				provenance: text(data, 'provenance'),
				sourceReference: nullableText(data, 'sourceReference'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	scoreIdea: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.scoreIdea(actor, text(data, 'ideaPublicId'), {
				strategicFit: Number(text(data, 'strategicFit')),
				customerValue: Number(text(data, 'customerValue')),
				feasibility: Number(text(data, 'feasibility')),
				commercialValue: Number(text(data, 'commercialValue')),
				risk: Number(text(data, 'risk'))
			})
		);
	},
	createBusinessCase: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createBusinessCase(actor, {
				ideaPublicId: text(data, 'ideaPublicId'),
				offeringPublicId: nullableText(data, 'offeringPublicId'),
				businessCaseCode: text(data, 'businessCaseCode'),
				title: text(data, 'title'),
				currencyCode: text(data, 'currencyCode'),
				investmentCost: nullableText(data, 'investmentCost'),
				annualOperatingCost: nullableText(data, 'annualOperatingCost'),
				annualRevenueOrValue: nullableText(data, 'annualRevenueOrValue'),
				expectedBenefitValue: nullableText(data, 'expectedBenefitValue'),
				paybackMonths: numberValue(data, 'paybackMonths'),
				riskSummary: text(data, 'riskSummary'),
				recommendation: text(data, 'recommendation'),
				strategyObjectivePublicId: nullableText(data, 'strategyObjectivePublicId'),
				performanceBenefitPublicId: nullableText(data, 'performanceBenefitPublicId')
			})
		);
	},
	approveBusinessCase: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.approveBusinessCase(actor, text(data, 'businessCasePublicId'))
		);
	},
	createDesign: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.createDesign(actor, {
				offeringPublicId: text(data, 'offeringPublicId'),
				businessCasePublicId: nullableText(data, 'businessCasePublicId'),
				designCode: text(data, 'designCode'),
				title: text(data, 'title'),
				designBrief: text(data, 'designBrief'),
				customerOutcomes: text(data, 'customerOutcomes'),
				functionalRequirements: text(data, 'functionalRequirements'),
				nonFunctionalRequirements: nullableText(data, 'nonFunctionalRequirements'),
				acceptanceCriteria: text(data, 'acceptanceCriteria'),
				evidencePublicId: nullableText(data, 'evidencePublicId'),
				evidenceReference: nullableText(data, 'evidenceReference'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	addDesignReview: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.addDesignReview(actor, {
				designPublicId: text(data, 'designPublicId'),
				reviewCode: text(data, 'reviewCode'),
				reviewType: text(data, 'reviewType') as never,
				reviewDate: requiredDate(data, 'reviewDate'),
				outcome: text(data, 'outcome') as never,
				findings: text(data, 'findings'),
				actionsRequired: nullableText(data, 'actionsRequired'),
				evidencePublicId: nullableText(data, 'evidencePublicId'),
				reviewerMemberId: text(data, 'reviewerMemberId')
			})
		);
	},
	approveDesign: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.approveDesign(actor, text(data, 'designPublicId'))
		);
	},
	createDevelopmentPlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.createDevelopmentPlan(actor, {
				designPublicId: text(data, 'designPublicId'),
				developmentCode: text(data, 'developmentCode'),
				title: text(data, 'title'),
				deliveryApproach: text(data, 'deliveryApproach'),
				scopeText: text(data, 'scopeText'),
				definitionOfDone: text(data, 'definitionOfDone'),
				plannedStart: dateValue(data, 'plannedStart'),
				plannedFinish: dateValue(data, 'plannedFinish'),
				projectPublicId: nullableText(data, 'projectPublicId'),
				evidencePublicId: nullableText(data, 'evidencePublicId'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	completeDevelopmentPlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.completeDevelopmentPlan(actor, text(data, 'developmentPublicId'))
		);
	},
	createLaunchPlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.createLaunchPlan(actor, {
				offeringPublicId: text(data, 'offeringPublicId'),
				developmentPlanPublicId: nullableText(data, 'developmentPlanPublicId'),
				launchCode: text(data, 'launchCode'),
				title: text(data, 'title'),
				targetLaunchDate: requiredDate(data, 'targetLaunchDate'),
				targetSegments: text(data, 'targetSegments'),
				commercialReadiness: text(data, 'commercialReadiness'),
				operationalReadiness: text(data, 'operationalReadiness'),
				customerReadiness: text(data, 'customerReadiness'),
				supportReadiness: text(data, 'supportReadiness'),
				readinessEvidencePublicId: nullableText(data, 'readinessEvidencePublicId'),
				governanceDecisionPublicId: nullableText(data, 'governanceDecisionPublicId'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	approveLaunch: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.approveLaunch(actor, text(data, 'launchPublicId'))
		);
	},
	markLaunched: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.markLaunched(actor, text(data, 'launchPublicId'))
		);
	},
	recordLifecycleReview: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.recordLifecycleReview(actor, {
				offeringPublicId: text(data, 'offeringPublicId'),
				reviewCode: text(data, 'reviewCode'),
				reviewDate: requiredDate(data, 'reviewDate'),
				lifecyclePhase: text(data, 'lifecyclePhase') as never,
				performanceSummary: text(data, 'performanceSummary'),
				customerSummary: text(data, 'customerSummary'),
				financialSummary: text(data, 'financialSummary'),
				riskSummary: text(data, 'riskSummary'),
				recommendation: text(data, 'recommendation') as never,
				performanceEvidencePublicId: nullableText(data, 'performanceEvidencePublicId'),
				customerEvidencePublicId: nullableText(data, 'customerEvidencePublicId'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	createRetirementPlan: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.createRetirementPlan(actor, {
				offeringPublicId: text(data, 'offeringPublicId'),
				lifecycleReviewPublicId: nullableText(data, 'lifecycleReviewPublicId'),
				retirementCode: text(data, 'retirementCode'),
				title: text(data, 'title'),
				retirementRationale: text(data, 'retirementRationale'),
				customerTransitionPlan: text(data, 'customerTransitionPlan'),
				operationalTransitionPlan: text(data, 'operationalTransitionPlan'),
				financialImpactSummary: text(data, 'financialImpactSummary'),
				dataRecordRetentionPlan: text(data, 'dataRecordRetentionPlan'),
				targetEndDate: requiredDate(data, 'targetEndDate'),
				governanceDecisionPublicId: nullableText(data, 'governanceDecisionPublicId'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	approveRetirement: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.approveRetirement(actor, text(data, 'retirementPublicId'))
		);
	},
	completeRetirement: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.completeRetirement(actor, text(data, 'retirementPublicId'))
		);
	},
	createInnovationExperiment: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.createInnovationExperiment(actor, {
				portfolioPublicId: nullableText(data, 'portfolioPublicId'),
				ideaPublicId: nullableText(data, 'ideaPublicId'),
				offeringPublicId: nullableText(data, 'offeringPublicId'),
				experimentCode: text(data, 'experimentCode'),
				title: text(data, 'title'),
				hypothesis: text(data, 'hypothesis'),
				experimentMethod: text(data, 'experimentMethod'),
				successMeasure: text(data, 'successMeasure'),
				plannedStart: dateValue(data, 'plannedStart'),
				plannedFinish: dateValue(data, 'plannedFinish'),
				evidencePublicId: nullableText(data, 'evidencePublicId'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	closeInnovationExperiment: async ({ request, locals }) => {
		const data = await request.formData();
		return runLifecycleAction(locals, (service, actor) =>
			service.closeInnovationExperiment(actor, text(data, 'experimentPublicId'), {
				outcome: text(data, 'outcome') as never,
				learningSummary: text(data, 'learningSummary'),
				evidencePublicId: nullableText(data, 'evidencePublicId')
			})
		);
	}
};
