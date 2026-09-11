import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
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

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin');
	try {
		const db = getDatabase();
		const [workspace, members] = await Promise.all([
			new ProductServiceService(db).getWorkspace(actor),
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
	}
};
