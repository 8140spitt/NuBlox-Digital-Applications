import { error, fail, redirect } from '@sveltejs/kit';
import { routes, type StrategyReviewRecordKind } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyReview,
	createStrategyReviewDecision,
	getStrategyExecutionReviewWorkspace,
	type ReviewDecisionType
} from '$lib/server/strategy/execution-review-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

const recordKinds: StrategyReviewRecordKind[] = ['review', 'decision'];

function recordKind(value: string): StrategyReviewRecordKind {
	if (!recordKinds.includes(value as StrategyReviewRecordKind)) {
		error(404, 'Strategic review record type not found.');
	}
	return value as StrategyReviewRecordKind;
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
			error(403, 'This strategy cycle is not available for strategic review changes.');
		}
		return {
			recordKind: kind,
			framework: workspace.framework,
			reviews: workspace.reviews,
			objectives: workspace.objectives,
			initiatives: workspace.initiatives,
			kpis: workspace.kpis
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategic review is not available in this strategy scope.');
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
		const actor = {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		};
		try {
			if (kind === 'review') {
				await createStrategyReview({
					actor,
					frameworkPublicId: params.strategy,
					reviewDate: text(formData, 'reviewDate'),
					title: text(formData, 'title'),
					summary: text(formData, 'summary')
				});
			} else {
				await createStrategyReviewDecision({
					actor,
					frameworkPublicId: params.strategy,
					reviewPublicId: text(formData, 'reviewPublicId'),
					decisionType: text(formData, 'decisionType') as ReviewDecisionType,
					decisionText: text(formData, 'decisionText'),
					rationale: text(formData, 'rationale'),
					dueDate: text(formData, 'dueDate'),
					objectivePublicId: text(formData, 'objectivePublicId'),
					initiativePublicId: text(formData, 'initiativePublicId'),
					kpiPublicId: text(formData, 'kpiPublicId')
				});
			}
			redirect(303, routes.strategyReview(access.organisationRouteSlug, params.strategy));
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
