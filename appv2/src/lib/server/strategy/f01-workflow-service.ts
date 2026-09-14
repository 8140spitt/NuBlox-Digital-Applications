import type { EvidenceActor } from '$lib/server/platform/evidence';
import {
	finaliseWorkflowRequest,
	getPendingWorkflowTask,
	submitLifecycleWorkflow,
	type WorkflowDecision,
	WorkflowValidationError
} from '$lib/server/platform/workflow-request-service';
import type { F01ManagedRecordKind } from './f01-lifecycle';
import { getF01ManagedRecord, transitionF01Record } from './f01-record-management-service';
import { StrategyValidationError } from './f01-service';
import { defaultF01WorkflowKey, f01WorkflowTemplate } from './f01-workflows';

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

function asManagedKind(value: string): F01ManagedRecordKind {
	if (!MANAGED_KINDS.has(value as F01ManagedRecordKind)) {
		throw new WorkflowValidationError(`Unsupported F01 workflow source type: ${value}.`);
	}
	return value as F01ManagedRecordKind;
}

function requiredPermission(kind: F01ManagedRecordKind, toState: string, configured?: string): string {
	if (configured?.trim()) return configured;
	if (toState === 'approved' || (kind === 'option' && ['selected', 'rejected'].includes(toState))) {
		return 'strategy.approve';
	}
	return 'strategy.manage';
}

export async function submitF01WorkflowTransition(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
	targetStatus: string;
	note?: string | null;
}): Promise<{ requestPublicId: string; workItemPublicId: string; workflowKey: string } | null> {
	const record = await getF01ManagedRecord({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId,
		kind: input.kind,
		recordPublicId: input.recordPublicId
	});
	const transition = record.transitions.find((candidate) => candidate.to === input.targetStatus);
	if (!transition) {
		throw new StrategyValidationError(
			`Lifecycle transition ${record.status} → ${input.targetStatus} is not available.`
		);
	}
	if (transition.requiresNote && !input.note?.trim()) {
		throw new StrategyValidationError('A transition note is required.');
	}
	if (transition.requiresTargetReference) {
		throw new StrategyValidationError(
			'This workflow transition requires a governed target reference and is not yet eligible for generic routing.'
		);
	}

	const workflowKey =
		transition.workflowKey ?? defaultF01WorkflowKey(input.kind, record.status, input.targetStatus);
	if (!workflowKey) return null;
	if (!f01WorkflowTemplate(workflowKey)) {
		throw new StrategyValidationError(`Workflow template ${workflowKey} is not available for execution.`);
	}

	const request = await submitLifecycleWorkflow({
		actor: input.actor,
		workflowKey,
		sourceDomain: 'F01',
		sourceType: input.kind,
		sourcePublicId: input.recordPublicId,
		contextPublicId: input.frameworkPublicId,
		fromState: record.status,
		toState: input.targetStatus,
		transitionLabel: transition.label,
		requiredPermissionKey: requiredPermission(input.kind, input.targetStatus, transition.requiredPermissionKey),
		note: input.note
	});
	return { ...request, workflowKey };
}

export async function decideF01WorkflowRequest(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	decision: WorkflowDecision;
	note?: string | null;
}): Promise<{ frameworkPublicId: string; kind: F01ManagedRecordKind; recordPublicId: string }> {
	const task = await getPendingWorkflowTask({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		requestPublicId: input.requestPublicId
	});
	if (task.sourceDomain !== 'F01') {
		throw new WorkflowValidationError('This workflow task is not owned by F01.');
	}
	const kind = asManagedKind(task.sourceType);

	if (input.decision === 'approved') {
		const record = await getF01ManagedRecord({
			organisationId: input.actor.organisationId,
			memberId: input.actor.memberId,
			frameworkPublicId: task.contextPublicId,
			kind,
			recordPublicId: task.sourcePublicId
		});
		if (record.status !== task.toState) {
			if (record.status !== task.fromState) {
				throw new WorkflowValidationError(
					`The source record is now ${record.status}; this workflow expected ${task.fromState}. The task is stale and must not be applied.`
				);
			}
			await transitionF01Record({
				actor: input.actor,
				frameworkPublicId: task.contextPublicId,
				kind,
				recordPublicId: task.sourcePublicId,
				targetStatus: task.toState,
				note: input.note ?? undefined,
				targetRecordType: '',
				targetPublicId: ''
			});
		}
	}

	await finaliseWorkflowRequest({
		actor: input.actor,
		requestPublicId: input.requestPublicId,
		decision: input.decision,
		note: input.note
	});
	return {
		frameworkPublicId: task.contextPublicId,
		kind,
		recordPublicId: task.sourcePublicId
	};
}
