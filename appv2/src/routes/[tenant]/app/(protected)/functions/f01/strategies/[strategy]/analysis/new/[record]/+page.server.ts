import { error, fail, redirect } from '@sveltejs/kit';
import { routes, type StrategyAnalysisRecordKind } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyAssumption,
	createStrategyEnvironmentFactor,
	createStrategyEvidenceItem,
	getStrategyAnalysisPlanningWorkspace,
	type EnvironmentDimension,
	type EnvironmentDirection,
	type EnvironmentScope,
	type EvidenceType
} from '$lib/server/strategy/analysis-planning-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

const recordKinds: StrategyAnalysisRecordKind[] = ['evidence', 'factor', 'assumption'];

function recordKind(value: string): StrategyAnalysisRecordKind {
	if (!recordKinds.includes(value as StrategyAnalysisRecordKind))
		error(404, 'Analysis record type not found.');
	return value as StrategyAnalysisRecordKind;
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
			evidence: workspace.evidence
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Environmental analysis is not available in this strategy scope.');
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
			if (kind === 'evidence') {
				await createStrategyEvidenceItem({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					evidenceType: text(formData, 'evidenceType') as EvidenceType,
					title: text(formData, 'title'),
					sourceReference: text(formData, 'sourceReference'),
					sourceUri: text(formData, 'sourceUri'),
					publisherName: text(formData, 'publisherName'),
					publishedOn: text(formData, 'publishedOn'),
					observedOn: text(formData, 'observedOn'),
					summaryText: text(formData, 'summaryText'),
					reliabilityScore: numberValue(formData, 'reliabilityScore')
				});
			} else if (kind === 'factor') {
				await createStrategyEnvironmentFactor({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					contextScope: text(formData, 'contextScope') as EnvironmentScope,
					dimension: text(formData, 'dimension') as EnvironmentDimension,
					direction: text(formData, 'direction') as EnvironmentDirection,
					title: text(formData, 'title'),
					analysisText: text(formData, 'analysisText'),
					implicationText: text(formData, 'implicationText'),
					observedOn: text(formData, 'observedOn'),
					likelihoodScore: numberValue(formData, 'likelihoodScore'),
					impactScore: numberValue(formData, 'impactScore'),
					confidenceScore: numberValue(formData, 'confidenceScore'),
					evidencePublicIds: formData.getAll('evidencePublicIds').map(String)
				});
			} else {
				await createStrategyAssumption({
					actor: {
						organisationId: access.organisationId,
						userId: access.userId,
						memberId: access.memberId
					},
					frameworkPublicId: params.strategy,
					statementText: text(formData, 'statementText'),
					rationaleText: text(formData, 'rationaleText'),
					confidenceScore: numberValue(formData, 'confidenceScore'),
					reviewBy: text(formData, 'reviewBy')
				});
			}
			redirect(303, routes.strategyAnalysis(access.organisationRouteSlug, params.strategy));
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
