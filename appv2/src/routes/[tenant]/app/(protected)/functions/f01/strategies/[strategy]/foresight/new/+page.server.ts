import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	createStrategyScenario,
	getForesightWorkspace,
	type ScenarioType
} from '$lib/server/strategy/operating-foresight-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

function text(data: FormData, key: string): string {
	return String(data.get(key) ?? '').trim();
}

function values(data: FormData): Record<string, string> {
	return Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
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
	default: async ({ request, params, url }) => {
		const data = await request.formData();
		const submitted = values(data);
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await createStrategyScenario({
				actor,
				frameworkPublicId: params.strategy,
				scenarioCode: text(data, 'scenarioCode'),
				title: text(data, 'title'),
				scenarioType: text(data, 'scenarioType') as ScenarioType,
				horizonStart: text(data, 'horizonStart'),
				horizonEnd: text(data, 'horizonEnd'),
				narrative: text(data, 'narrative')
			});
			redirect(303, routes.strategyForesight(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError)
				return fail(400, { values: submitted, formError: cause.message });
			if (cause instanceof StrategyAccessError)
				return fail(403, { values: submitted, formError: cause.message });
			throw cause;
		}
	}
} satisfies Actions;
