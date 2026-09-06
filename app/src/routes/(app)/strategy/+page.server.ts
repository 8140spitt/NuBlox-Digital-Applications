import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { StrategyService, StrategyValidationError } from '$lib/server/strategy/strategy-service';

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
	operation: (service: StrategyService, actor: TenantActorContext) => Promise<{ public_id?: string } | void>,
	fallbackFrameworkPublicId?: string | null
) {
	const actor = actorFromLocals(locals);
	if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });
	try {
		const result = await operation(new StrategyService(getDatabase()), actor);
		const frameworkPublicId = result?.public_id ?? fallbackFrameworkPublicId ?? null;
		throw redirect(
			303,
			frameworkPublicId
				? `/strategy?framework=${encodeURIComponent(frameworkPublicId)}`
				: '/strategy'
		);
	} catch (error) {
		if (error instanceof StrategyValidationError) return fail(400, { error: error.message });
		if (error instanceof TenantAccessError)
			return fail(403, { error: 'You do not have access to this strategy action.' });
		if (error instanceof RecordNotFoundError) return fail(404, { error: error.message });
		throw error;
	}
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin');
	try {
		return await new StrategyService(getDatabase()).getWorkspace(actor, url.searchParams.get('framework'));
	} catch (error) {
		if (error instanceof RecordNotFoundError) throw redirect(303, '/strategy');
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
				horizonStart: text(data, 'horizonStart'),
				horizonEnd: text(data, 'horizonEnd'),
				purposeText: text(data, 'purposeText'),
				visionText: text(data, 'visionText'),
				missionText: text(data, 'missionText'),
				ownerMemberId: nullableText(data, 'ownerMemberId')
			})
		);
	},
	updateFramework: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.updateFramework(actor, frameworkPublicId, {
					title: text(data, 'title'),
					horizonStart: text(data, 'horizonStart'),
					horizonEnd: text(data, 'horizonEnd'),
					purposeText: text(data, 'purposeText'),
					visionText: text(data, 'visionText'),
					missionText: text(data, 'missionText'),
					ownerMemberId: nullableText(data, 'ownerMemberId')
				}),
			frameworkPublicId
		);
	},
	addEnvironmentFactor: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addEnvironmentFactor(actor, {
					frameworkPublicId,
					contextScope: text(data, 'contextScope') as 'internal' | 'external',
					dimension: text(data, 'dimension') as
						| 'economic'
						| 'competitive'
						| 'market'
						| 'technology'
						| 'regulatory'
						| 'operational'
						| 'other',
					direction: text(data, 'direction') as
						| 'strength'
						| 'weakness'
						| 'opportunity'
						| 'threat'
						| 'neutral',
					title: text(data, 'title'),
					analysisText: text(data, 'analysisText'),
					evidenceReference: nullableText(data, 'evidenceReference'),
					observedOn: nullableText(data, 'observedOn'),
					likelihoodScore: nullableText(data, 'likelihoodScore'),
					impactScore: nullableText(data, 'impactScore'),
					ownerMemberId: nullableText(data, 'ownerMemberId')
				}),
			frameworkPublicId
		);
	},
	addOption: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addOption(actor, {
					frameworkPublicId,
					title: text(data, 'title'),
					description: text(data, 'description'),
					evaluationSummary: nullableText(data, 'evaluationSummary'),
					priorityRank: nullableText(data, 'priorityRank')
				}),
			frameworkPublicId
		);
	},
	decideOption: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.decideOption(
					actor,
					frameworkPublicId,
					text(data, 'optionPublicId'),
					text(data, 'decisionStatus') as 'selected' | 'rejected',
					text(data, 'decisionRationale')
				),
			frameworkPublicId
		);
	},
	addObjective: async ({ request, locals }) => {
		const data = await request.formData();
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(
			locals,
			(service, actor) =>
				service.addObjective(actor, {
					frameworkPublicId,
					objectiveCode: text(data, 'objectiveCode'),
					title: text(data, 'title'),
					description: text(data, 'description'),
					priorityRank: text(data, 'priorityRank'),
					ownerMemberId: nullableText(data, 'ownerMemberId'),
					targetDate: nullableText(data, 'targetDate')
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
		const frameworkPublicId = text(data, 'frameworkPublicId');
		return runAction(locals, (service, actor) => service.reviseFramework(actor, frameworkPublicId));
	}
};
