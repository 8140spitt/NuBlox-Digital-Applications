import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	approveStrategyKpi,
	getStrategyExecutionReviewWorkspace,
	recordStrategyKpiObservation
} from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
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
		return await getStrategyExecutionReviewWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy
		});
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy performance is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	approveKpi: async ({ request, params, url }) => {
		const formData = await request.formData();
		const kpiPublicId = text(formData, 'kpiPublicId');
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await approveStrategyKpi({ actor, frameworkPublicId: params.strategy, kpiPublicId });
			redirect(303, routes.strategyPerformance(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, { action: 'approveKpi', kpiPublicId, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, { action: 'approveKpi', kpiPublicId, formError: cause.message });
			}
			throw cause;
		}
	},
	observe: async ({ request, params, url }) => {
		const formData = await request.formData();
		const values = {
			kpiPublicId: text(formData, 'kpiPublicId'),
			observedOn: text(formData, 'observedOn'),
			actualValue: text(formData, 'actualValue'),
			forecastValue: text(formData, 'forecastValue'),
			commentary: text(formData, 'commentary')
		};
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await recordStrategyKpiObservation({
				actor,
				frameworkPublicId: params.strategy,
				kpiPublicId: values.kpiPublicId,
				observedOn: values.observedOn,
				actualValue: values.actualValue,
				forecastValue: values.forecastValue,
				commentary: values.commentary
			});
			redirect(303, routes.strategyPerformance(access.organisationRouteSlug, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, { action: 'observe', values, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, { action: 'observe', values, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
