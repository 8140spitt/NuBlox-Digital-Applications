import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	addScenarioAssumption,
	addScenarioProjection,
	approveStrategyScenario,
	getForesightWorkspace,
	reviseStrategyScenario
} from '$lib/server/strategy/operating-foresight-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

function text(data: FormData, key: string): string {
	return String(data.get(key) ?? '').trim();
}

async function actorFor(request: Request, params: { tenant: string }, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(params.tenant, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) redirect(303, routes.appNoAccess(params.tenant));
	return {
		access,
		actor: {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		}
	};
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		return {
			workspace: await getForesightWorkspace({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				frameworkPublicId: params.strategy
			})
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) error(404, cause.message);
		throw cause;
	}
};

export const actions = {
	addAssumption: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addScenarioAssumption({
				actor,
				frameworkPublicId: params.strategy,
				scenarioPublicId: text(data, 'scenarioPublicId'),
				assumptionCode: text(data, 'assumptionCode'),
				title: text(data, 'title'),
				description: text(data, 'description'),
				variableKey: text(data, 'variableKey'),
				unitLabel: text(data, 'unitLabel'),
				baselineValue: text(data, 'baselineValue'),
				scenarioValue: text(data, 'scenarioValue'),
				sensitivityPercent: text(data, 'sensitivityPercent') || null
			});
			redirect(303, routes.strategyForesight(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	addProjection: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addScenarioProjection({
				actor,
				frameworkPublicId: params.strategy,
				scenarioPublicId: text(data, 'scenarioPublicId'),
				kpiPublicId: text(data, 'kpiPublicId'),
				projectionDate: text(data, 'projectionDate'),
				projectedValue: text(data, 'projectedValue'),
				rationale: text(data, 'rationale')
			});
			redirect(303, routes.strategyForesight(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	approve: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await approveStrategyScenario({
				actor,
				frameworkPublicId: params.strategy,
				scenarioPublicId: text(data, 'scenarioPublicId')
			});
			redirect(303, routes.strategyForesight(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	revise: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await reviseStrategyScenario({
				actor,
				frameworkPublicId: params.strategy,
				scenarioPublicId: text(data, 'scenarioPublicId')
			});
			redirect(303, routes.strategyForesight(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	}
} satisfies Actions;
