import { error, fail, redirect } from '@sveltejs/kit';
import { routes, type StrategyPerformanceRecordKind } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyKpi,
	getStrategyExecutionReviewWorkspace,
	type KpiDirection
} from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

const recordKinds: StrategyPerformanceRecordKind[] = ['kpi'];

function recordKind(value: string): StrategyPerformanceRecordKind {
	if (!recordKinds.includes(value as StrategyPerformanceRecordKind)) {
		error(404, 'Performance record type not found.');
	}
	return value as StrategyPerformanceRecordKind;
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
			error(403, 'This strategy cycle is not available for KPI definition changes.');
		}
		return {
			recordKind: kind,
			framework: workspace.framework,
			objectives: workspace.objectives,
			initiatives: workspace.initiatives
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy performance is not available in this strategy scope.');
		}
		throw cause;
	}
};

export const actions = {
	create: async ({ request, params, url }) => {
		recordKind(params.record);
		const formData = await request.formData();
		const values = submittedValues(formData);
		const errors: Record<string, string> = {};
		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));
		try {
			await createStrategyKpi({
				actor: {
					organisationId: access.organisationId,
					userId: access.userId,
					memberId: access.memberId
				},
				frameworkPublicId: params.strategy,
				objectivePublicId: text(formData, 'objectivePublicId'),
				initiativePublicIds: formData.getAll('initiativePublicIds').map(String),
				title: text(formData, 'title'),
				description: text(formData, 'description'),
				unitLabel: text(formData, 'unitLabel'),
				direction: text(formData, 'direction') as KpiDirection,
				baselineValue: text(formData, 'baselineValue'),
				targetValue: text(formData, 'targetValue'),
				targetDate: text(formData, 'targetDate')
			});
			redirect(303, routes.strategyPerformance(access.organisationRouteSlug, params.strategy));
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
