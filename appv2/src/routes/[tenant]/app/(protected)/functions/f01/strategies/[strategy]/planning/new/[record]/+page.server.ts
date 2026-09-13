import { error, fail, redirect } from '@sveltejs/kit';
import { routes, type StrategyPlanningRecordKind } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyObjective,
	createStrategyOption,
	createStrategyTheme,
	getStrategyAnalysisPlanningWorkspace
} from '$lib/server/strategy/analysis-planning-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

const recordKinds: StrategyPlanningRecordKind[] = ['option', 'theme', 'objective'];

function recordKind(value: string): StrategyPlanningRecordKind {
	if (!recordKinds.includes(value as StrategyPlanningRecordKind)) error(404, 'Planning record type not found.');
	return value as StrategyPlanningRecordKind;
}

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

function numberValue(formData: FormData, key: string): number | null {
	const value = text(formData, key);
	if (!value) return null;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
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
		const workspace = await getStrategyAnalysisPlanningWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy
		});
		if (!workspace.permissions.canManage || workspace.framework.lifecycleStatus !== 'draft') {
			error(403, 'This strategy cycle cannot be amended.');
		}
		return {
			recordKind: kind,
			framework: workspace.framework,
			factors: workspace.factors,
			assumptions: workspace.assumptions,
			options: workspace.options,
			themes: workspace.themes,
			objectives: workspace.objectives
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategic planning is not available in this strategy scope.');
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

		try {
			if (kind === 'option') {
				await createStrategyOption({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					title: text(formData, 'title'),
					description: text(formData, 'description'),
					evaluationSummary: text(formData, 'evaluationSummary'),
					priorityRank: numberValue(formData, 'priorityRank'),
					factorPublicIds: formData.getAll('factorPublicIds').map(String),
					assumptionPublicIds: formData.getAll('assumptionPublicIds').map(String)
				});
			} else if (kind === 'theme') {
				await createStrategyTheme({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					title: text(formData, 'title'),
					description: text(formData, 'description'),
					priorityRank: numberValue(formData, 'priorityRank')
				});
			} else {
				await createStrategyObjective({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					title: text(formData, 'title'),
					description: text(formData, 'description'),
					priorityRank: numberValue(formData, 'priorityRank'),
					targetDate: text(formData, 'targetDate'),
					parentObjectivePublicId: text(formData, 'parentObjectivePublicId'),
					optionPublicIds: formData.getAll('optionPublicIds').map(String),
					themePublicId: text(formData, 'themePublicId')
				});
			}
			redirect(303, routes.strategyPlanning(access.organisationRouteSlug, params.strategy));
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
