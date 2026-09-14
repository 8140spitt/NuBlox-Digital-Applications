import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	listActiveWorkflowRequestsForSource,
	WorkflowAccessError,
	WorkflowValidationError
} from '$lib/server/platform/workflow-request-service';
import {
	deleteF01Record,
	getF01ManagedRecord,
	reviseF01Record,
	transitionF01Record,
	updateF01Record
} from '$lib/server/strategy/f01-record-management-service';
import type { F01ManagedRecordKind } from '$lib/server/strategy/f01-lifecycle';
import {
	getF01RelationshipEditor,
	updateF01Relationships
} from '$lib/server/strategy/f01-relationship-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import { submitF01WorkflowTransition } from '$lib/server/strategy/f01-workflow-service';
import type { Actions, PageServerLoad } from './$types';

const MANAGED_KINDS = new Set<F01ManagedRecordKind>([
	'framework',
	'evidence',
	'factor',
	'assumption',
	'option',
	'theme',
	'objective',
	'plan',
	'initiative',
	'requirement',
	'handoff',
	'kpi',
	'review',
	'decision'
]);

function recordKind(value: string): F01ManagedRecordKind {
	if (!MANAGED_KINDS.has(value as F01ManagedRecordKind)) {
		error(404, 'F01 record type not found.');
	}
	return value as F01ManagedRecordKind;
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

function sectionPath(tenant: string, strategy: string, kind: F01ManagedRecordKind): string {
	if (kind === 'framework') return routes.strategyFramework(tenant, strategy);
	if (['evidence', 'factor', 'assumption'].includes(kind)) {
		return routes.strategyAnalysis(tenant, strategy);
	}
	if (['option', 'theme', 'objective'].includes(kind)) {
		return routes.strategyPlanning(tenant, strategy);
	}
	if (['plan', 'initiative', 'requirement', 'handoff'].includes(kind)) {
		return routes.strategyBusinessPlanning(tenant, strategy);
	}
	if (kind === 'kpi') return routes.strategyPerformance(tenant, strategy);
	return routes.strategyReview(tenant, strategy);
}

function valuesFrom(formData: FormData): Record<string, string> {
	return Object.fromEntries(
		[...formData.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : ''])
	);
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	const kind = recordKind(params.kind);
	try {
		const managedRecord = await getF01ManagedRecord({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			frameworkPublicId: params.strategy,
			kind,
			recordPublicId: params.record
		});
		const relationshipEditor = managedRecord.canEdit
			? await getF01RelationshipEditor({
					organisationId: tenant.organisationId,
					memberId: tenant.memberId,
					frameworkPublicId: params.strategy,
					kind,
					recordPublicId: params.record
				})
			: null;
		const activeWorkflows = await listActiveWorkflowRequestsForSource({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId,
			sourceDomain: 'F01',
			sourceType: kind,
			sourcePublicId: params.record
		});
		return { managedRecord, relationshipEditor, activeWorkflows };
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'F01 record is not available in this scope.');
		}
		if (cause instanceof StrategyValidationError) error(404, cause.message);
		throw cause;
	}
};

export const actions = {
	update: async ({ request, params, url }) => {
		const kind = recordKind(params.kind);
		const formData = await request.formData();
		const values = valuesFrom(formData);
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await updateF01Record({
				actor,
				frameworkPublicId: params.strategy,
				kind,
				recordPublicId: params.record,
				values
			});
			redirect(
				303,
				routes.strategyManage(access.organisationRouteSlug, params.strategy, kind, params.record)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError)
				return fail(400, { values, formError: cause.message });
			if (cause instanceof StrategyAccessError)
				return fail(403, { values, formError: cause.message });
			throw cause;
		}
	},
	relationships: async ({ request, params, url }) => {
		const kind = recordKind(params.kind);
		const formData = await request.formData();
		const selections: Record<string, string[]> = {};
		for (const [key, value] of formData.entries()) {
			if (typeof value !== 'string') continue;
			(selections[key] ??= []).push(value);
		}
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await updateF01Relationships({
				actor,
				frameworkPublicId: params.strategy,
				kind,
				recordPublicId: params.record,
				selections
			});
			redirect(
				303,
				routes.strategyManage(access.organisationRouteSlug, params.strategy, kind, params.record)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	transition: async ({ request, params, url }) => {
		const kind = recordKind(params.kind);
		const formData = await request.formData();
		const targetStatus = String(formData.get('targetStatus') ?? '').trim();
		const transitionNote = String(formData.get('transitionNote') ?? '').trim();
		const targetRecordType = String(formData.get('targetRecordType') ?? '').trim();
		const targetPublicId = String(formData.get('targetPublicId') ?? '').trim();
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const workflow = await submitF01WorkflowTransition({
				actor,
				frameworkPublicId: params.strategy,
				kind,
				recordPublicId: params.record,
				targetStatus,
				note: transitionNote
			});
			if (workflow) {
				const target = routes.strategyManage(
					access.organisationRouteSlug,
					params.strategy,
					kind,
					params.record
				);
				redirect(
					303,
					`${target}?workflowSubmitted=1&workflowRequest=${encodeURIComponent(workflow.requestPublicId)}`
				);
			}

			await transitionF01Record({
				actor,
				frameworkPublicId: params.strategy,
				kind,
				recordPublicId: params.record,
				targetStatus,
				note: transitionNote,
				targetRecordType,
				targetPublicId
			});
			redirect(
				303,
				routes.strategyManage(access.organisationRouteSlug, params.strategy, kind, params.record)
			);
		} catch (cause) {
			const transitionValues = { targetStatus, transitionNote, targetRecordType, targetPublicId };
			if (cause instanceof StrategyValidationError || cause instanceof WorkflowValidationError) {
				return fail(400, { transitionValues, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError || cause instanceof WorkflowAccessError) {
				return fail(403, { transitionValues, formError: cause.message });
			}
			throw cause;
		}
	},
	revise: async ({ request, params, url }) => {
		const kind = recordKind(params.kind);
		if (!['framework', 'plan', 'kpi'].includes(kind)) {
			return fail(400, {
				formError: 'This record type uses lifecycle actions rather than version revision.'
			});
		}
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			const revision = await reviseF01Record({
				actor,
				frameworkPublicId: params.strategy,
				kind: kind as 'framework' | 'plan' | 'kpi',
				recordPublicId: params.record
			});
			const revisedStrategy = kind === 'framework' ? revision.publicId : params.strategy;
			redirect(
				303,
				routes.strategyManage(
					access.organisationRouteSlug,
					revisedStrategy,
					kind,
					revision.publicId
				)
			);
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	delete: async ({ request, params, url }) => {
		const kind = recordKind(params.kind);
		const formData = await request.formData();
		const confirmation = String(formData.get('deleteConfirmation') ?? '').trim();
		if (confirmation !== 'DELETE') {
			return fail(400, { formError: 'Type DELETE to confirm permanent deletion.' });
		}
		const { access, actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await deleteF01Record({
				actor,
				frameworkPublicId: params.strategy,
				kind,
				recordPublicId: params.record
			});
			if (kind === 'framework') redirect(303, routes.strategy(access.organisationRouteSlug));
			redirect(303, sectionPath(access.organisationRouteSlug, params.strategy, kind));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	}
} satisfies Actions;
