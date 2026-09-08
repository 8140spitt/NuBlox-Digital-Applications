import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	PerformanceForesightService,
	PerformanceForesightValidationError
} from '$lib/server/strategy/performance-foresight-service';

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
	frameworkPublicId: string | null,
	operation: (service: PerformanceForesightService, actor: TenantActorContext) => Promise<unknown>
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		await operation(new PerformanceForesightService(getDatabase()), actor);
		throw redirect(
			303,
			frameworkPublicId
				? `/strategy/performance?framework=${encodeURIComponent(frameworkPublicId)}`
				: '/strategy/performance'
		);
	} catch (error) {
		if (error instanceof PerformanceForesightValidationError)
			return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this strategy performance action.' });
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
			new PerformanceForesightService(db).getWorkspace(actor, url.searchParams.get('framework')),
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
		if (error instanceof RecordNotFoundError)
			throw httpError(404, 'Strategy performance workspace not found in the active scope.');
		if (error instanceof TenantAccessError)
			throw httpError(403, 'You do not have access to the strategy performance workspace.');
		throw error;
	}
};

export const actions: Actions = {
	createKpi: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(locals, frameworkPublicId, (service, actor) =>
			service.createKpi(actor, {
				frameworkPublicId,
				objectivePublicId: text(data, 'objectivePublicId'),
				kpiCode: text(data, 'kpiCode'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				unitLabel: text(data, 'unitLabel'),
				direction: text(data, 'direction') as
					'higher_is_better' | 'lower_is_better' | 'target_is_best' | 'band',
				aggregationMethod: text(data, 'aggregationMethod') as
					'latest' | 'sum' | 'average' | 'minimum' | 'maximum' | 'ratio',
				baselineValue: text(data, 'baselineValue'),
				targetValue: text(data, 'targetValue'),
				warningThreshold: nullableText(data, 'warningThreshold'),
				criticalThreshold: nullableText(data, 'criticalThreshold'),
				targetDate: nullableText(data, 'targetDate'),
				sourceMode: text(data, 'sourceMode') as 'manual' | 'canonical',
				sourceDomain: nullableText(data, 'sourceDomain'),
				sourceRecordType: nullableText(data, 'sourceRecordType'),
				sourceMeasureKey: nullableText(data, 'sourceMeasureKey'),
				ownerMemberId: text(data, 'ownerMemberId')
			})
		);
	},
	approveKpi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.approveKpi(actor, text(data, 'kpiPublicId'))
		);
	},
	reviseKpi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.reviseKpi(actor, text(data, 'kpiPublicId'))
		);
	},
	recordObservation: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.recordObservation(actor, {
				kpiPublicId: text(data, 'kpiPublicId'),
				observedOn: text(data, 'observedOn'),
				actualValue: text(data, 'actualValue'),
				forecastValue: nullableText(data, 'forecastValue'),
				commentary: nullableText(data, 'commentary'),
				sourceMode: text(data, 'sourceMode') as 'manual' | 'canonical',
				sourceDomain: nullableText(data, 'sourceDomain'),
				sourceRecordType: nullableText(data, 'sourceRecordType'),
				sourcePublicId: nullableText(data, 'sourcePublicId'),
				sourceMeasureKey: nullableText(data, 'sourceMeasureKey')
			})
		);
	},
	createAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.createAction(actor, {
				kpiPublicId: text(data, 'kpiPublicId'),
				observationPublicId: nullableText(data, 'observationPublicId'),
				actionCode: text(data, 'actionCode'),
				title: text(data, 'title'),
				actionText: text(data, 'actionText'),
				ownerMemberId: text(data, 'ownerMemberId'),
				dueDate: text(data, 'dueDate')
			})
		);
	},
	completeAction: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.completeAction(actor, text(data, 'actionPublicId'), text(data, 'completionNote'))
		);
	},
	createReview: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(locals, frameworkPublicId, (service, actor) =>
			service.createReview(actor, {
				frameworkPublicId,
				reviewCode: text(data, 'reviewCode'),
				reviewDate: text(data, 'reviewDate'),
				title: text(data, 'title'),
				summary: text(data, 'summary'),
				decisionsText: nullableText(data, 'decisionsText')
			})
		);
	},
	addReviewKpi: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.addReviewKpi(
				actor,
				text(data, 'reviewPublicId'),
				text(data, 'kpiPublicId'),
				text(data, 'observationPublicId'),
				text(data, 'assessment') as 'on_track' | 'watch' | 'off_track' | 'not_measured',
				nullableText(data, 'commentary')
			)
		);
	},
	approveReview: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.approveReview(actor, text(data, 'reviewPublicId'))
		);
	},
	createScenario: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(locals, frameworkPublicId, (service, actor) =>
			service.createScenario(actor, {
				frameworkPublicId,
				scenarioCode: text(data, 'scenarioCode'),
				title: text(data, 'title'),
				scenarioType: text(data, 'scenarioType') as
					'baseline' | 'upside' | 'downside' | 'stress' | 'custom',
				horizonStart: text(data, 'horizonStart'),
				horizonEnd: text(data, 'horizonEnd'),
				narrative: text(data, 'narrative')
			})
		);
	},
	addScenarioAssumption: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.addScenarioAssumption(actor, text(data, 'scenarioPublicId'), {
				assumptionCode: text(data, 'assumptionCode'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				variableKey: text(data, 'variableKey'),
				unitLabel: text(data, 'unitLabel'),
				baselineValue: text(data, 'baselineValue'),
				scenarioValue: text(data, 'scenarioValue'),
				sensitivityPercent: nullableText(data, 'sensitivityPercent')
			})
		);
	},
	addScenarioProjection: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.addScenarioProjection(
				actor,
				text(data, 'scenarioPublicId'),
				text(data, 'kpiPublicId'),
				text(data, 'projectionDate'),
				text(data, 'projectedValue'),
				text(data, 'rationale')
			)
		);
	},
	approveScenario: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.approveScenario(actor, text(data, 'scenarioPublicId'))
		);
	},
	reviseScenario: async ({ request, locals }) => {
		const data = await request.formData();
		return runAction(locals, text(data, 'frameworkPublicId'), (service, actor) =>
			service.reviseScenario(actor, text(data, 'scenarioPublicId'))
		);
	}
};
