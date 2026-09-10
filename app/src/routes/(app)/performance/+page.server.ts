import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	EnterprisePerformanceService,
	EnterprisePerformanceValidationError
} from '$lib/server/strategy/enterprise-performance-service';

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

function checked(data: FormData, name: string): boolean {
	return data.get(name) !== null;
}

async function runAction(
	locals: App.Locals,
	operation: (service: EnterprisePerformanceService, actor: TenantActorContext) => Promise<unknown>,
	frameworkPublicId?: string | null
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		const result = await operation(new EnterprisePerformanceService(getDatabase()), actor);
		const selected =
			frameworkPublicId ??
			(typeof result === 'object' && result !== null && 'public_id' in result
				? String(result.public_id)
				: null);
		throw redirect(
			303,
			selected ? `/performance?framework=${encodeURIComponent(selected)}` : '/performance'
		);
	} catch (error) {
		if (error instanceof EnterprisePerformanceValidationError)
			return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this performance action.' });
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
			new EnterprisePerformanceService(db).getWorkspace(actor, url.searchParams.get('framework')),
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
			throw httpError(404, 'Enterprise performance workspace not found in the active scope.');
		if (error instanceof TenantAccessError)
			throw httpError(403, 'You do not have access to enterprise performance management.');
		throw error;
	}
};

export const actions: Actions = {
	createFramework: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createFramework(actor, {
				frameworkCode: text(data, 'frameworkCode'),
				title: text(data, 'title'),
				purposeText: text(data, 'purposeText'),
				reportingCadence: text(data, 'reportingCadence') as
					'weekly' | 'monthly' | 'quarterly' | 'annual',
				scopeText: text(data, 'scopeText'),
				ownerMemberId: text(data, 'ownerMemberId'),
				effectiveFrom: text(data, 'effectiveFrom'),
				effectiveTo: nullableText(data, 'effectiveTo')
			})
		);
	},
	addFrameworkKpi: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addFrameworkKpi(actor, {
					frameworkPublicId,
					kpiPublicId: text(data, 'kpiPublicId'),
					displayOrder: text(data, 'displayOrder'),
					materialityThresholdPercent: nullableText(data, 'materialityThresholdPercent'),
					commentaryRequired: checked(data, 'commentaryRequired')
				}),
			frameworkPublicId
		);
	},
	approveFramework: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) => service.approveFramework(actor, frameworkPublicId),
			frameworkPublicId
		);
	},
	reviseFramework: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, (service, actor) =>
			service.createFrameworkRevision(actor, text(data, 'frameworkPublicId'))
		);
	},
	createPeriod: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.createPeriod(actor, {
					frameworkPublicId,
					periodCode: text(data, 'periodCode'),
					title: text(data, 'title'),
					periodStart: text(data, 'periodStart'),
					periodEnd: text(data, 'periodEnd'),
					reportingDate: text(data, 'reportingDate')
				}),
			frameworkPublicId
		);
	},
	createPack: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createPack(actor, {
					periodPublicId: text(data, 'periodPublicId'),
					packCode: text(data, 'packCode'),
					title: text(data, 'title'),
					executiveSummary: text(data, 'executiveSummary')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	approvePack: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.approvePack(actor, text(data, 'packPublicId')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createVariance: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createVariance(actor, {
					packKpiId: text(data, 'packKpiId'),
					varianceCode: text(data, 'varianceCode'),
					materiality: text(data, 'materiality') as 'low' | 'medium' | 'high' | 'critical',
					causeCategory: text(data, 'causeCategory') as
						| 'volume'
						| 'price'
						| 'productivity'
						| 'timing'
						| 'scope'
						| 'quality'
						| 'external'
						| 'forecast'
						| 'other',
					rootCauseText: text(data, 'rootCauseText'),
					impactText: text(data, 'impactText'),
					ownerMemberId: text(data, 'ownerMemberId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createCorrectiveAction(actor, {
					variancePublicId: text(data, 'variancePublicId'),
					actionCode: text(data, 'actionCode'),
					title: text(data, 'title'),
					actionText: text(data, 'actionText'),
					ownerMemberId: text(data, 'ownerMemberId'),
					dueDate: text(data, 'dueDate'),
					sourceDomain: nullableText(data, 'sourceDomain'),
					sourceRecordType: nullableText(data, 'sourceRecordType'),
					sourcePublicId: nullableText(data, 'sourcePublicId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	completeAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.completeCorrectiveAction(
					actor,
					text(data, 'actionPublicId'),
					text(data, 'completionEvidence')
				),
			nullableText(data, 'frameworkPublicId')
		);
	},
	closeVariance: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.closeVariance(actor, text(data, 'variancePublicId'), text(data, 'resolutionText')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createReview: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createReview(actor, {
					packPublicId: text(data, 'packPublicId'),
					reviewCode: text(data, 'reviewCode'),
					reviewDate: text(data, 'reviewDate'),
					title: text(data, 'title'),
					summary: text(data, 'summary'),
					decisionText: nullableText(data, 'decisionText'),
					governanceMeetingPublicId: nullableText(data, 'governanceMeetingPublicId'),
					governanceDecisionPublicId: nullableText(data, 'governanceDecisionPublicId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	approveReview: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) => service.approveReview(actor, text(data, 'reviewPublicId')),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createBenchmark: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createBenchmark(actor, {
					kpiPublicId: text(data, 'kpiPublicId'),
					benchmarkCode: text(data, 'benchmarkCode'),
					benchmarkType: text(data, 'benchmarkType') as
						'internal' | 'external' | 'peer' | 'industry' | 'target',
					title: text(data, 'title'),
					scopeText: text(data, 'scopeText'),
					unitLabel: text(data, 'unitLabel'),
					periodStart: text(data, 'periodStart'),
					periodEnd: text(data, 'periodEnd'),
					benchmarkValue: text(data, 'benchmarkValue'),
					provenanceText: text(data, 'provenanceText'),
					sourceReference: nullableText(data, 'sourceReference')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	compareBenchmark: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.compareBenchmark(
					actor,
					text(data, 'benchmarkPublicId'),
					text(data, 'observationPublicId'),
					text(data, 'interpretation')
				),
			nullableText(data, 'frameworkPublicId')
		);
	},
	createBenefit: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.createBenefit(actor, {
					kpiPublicId: text(data, 'kpiPublicId'),
					benefitCode: text(data, 'benefitCode'),
					title: text(data, 'title'),
					benefitType: text(data, 'benefitType') as
						| 'financial'
						| 'operational'
						| 'customer'
						| 'people'
						| 'risk'
						| 'sustainability'
						| 'other',
					unitLabel: text(data, 'unitLabel'),
					baselineValue: text(data, 'baselineValue'),
					targetValue: text(data, 'targetValue'),
					targetDate: text(data, 'targetDate'),
					ownerMemberId: text(data, 'ownerMemberId'),
					reviewCadence: text(data, 'reviewCadence') as
						'weekly' | 'monthly' | 'quarterly' | 'annual',
					sourceDomain: text(data, 'sourceDomain'),
					sourceRecordType: text(data, 'sourceRecordType'),
					sourcePublicId: text(data, 'sourcePublicId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	},
	measureBenefit: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(
			locals,
			(service, actor) =>
				service.recordBenefitMeasurement(actor, {
					benefitPublicId: text(data, 'benefitPublicId'),
					measuredOn: text(data, 'measuredOn'),
					realisedValue: text(data, 'realisedValue'),
					confidencePercent: text(data, 'confidencePercent'),
					evidenceText: text(data, 'evidenceText'),
					sourceDomain: nullableText(data, 'sourceDomain'),
					sourceRecordType: nullableText(data, 'sourceRecordType'),
					sourcePublicId: nullableText(data, 'sourcePublicId')
				}),
			nullableText(data, 'frameworkPublicId')
		);
	}
};
