import { defineWorkflowTemplate, type WorkflowTemplate } from '$lib/server/platform/workflow-kernel';
import type { F01ManagedRecordKind } from './f01-lifecycle';

function approvalTemplate(key: string, name: string): WorkflowTemplate {
	return defineWorkflowTemplate({
		key,
		version: '1.0',
		status: 'published',
		name,
		roles: ['approver'],
		variables: [
			{
				key: 'sourceReference',
				type: 'object_reference',
				scope: 'process',
				visible: true,
				required: true,
				readOnly: true
			}
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'approval',
				label: name,
				type: 'activity',
				responsibleRoleKey: 'approver',
				participants: [
					{ participantType: 'workflow_role', participantKey: 'approver', required: true }
				],
				completionRule: { type: 'any' },
				routingEvents: ['approve', 'return', 'reject'],
				recordVotes: true,
				recordReassignments: true,
				abortOnError: true
			},
			{ key: 'approved', label: 'Approved', type: 'end' },
			{ key: 'returned', label: 'Returned', type: 'end' },
			{ key: 'rejected', label: 'Rejected', type: 'end' }
		],
		links: [
			{ from: 'start', to: 'approval' },
			{ from: 'approval', to: 'approved', event: 'approve' },
			{ from: 'approval', to: 'returned', event: 'return' },
			{ from: 'approval', to: 'rejected', event: 'reject' }
		]
	});
}

export const F01_WORKFLOW_TEMPLATES: Readonly<Record<string, WorkflowTemplate>> = {
	'f01.strategy-approval': approvalTemplate('f01.strategy-approval', 'Strategy approval'),
	'f01.business-plan-approval': approvalTemplate('f01.business-plan-approval', 'Business plan approval'),
	'f01.kpi-approval': approvalTemplate('f01.kpi-approval', 'KPI approval'),
	'f01.strategic-review-approval': approvalTemplate(
		'f01.strategic-review-approval',
		'Strategic review approval'
	)
};

const DEFAULT_APPROVAL_WORKFLOW: Partial<Record<F01ManagedRecordKind, string>> = {
	framework: 'f01.strategy-approval',
	plan: 'f01.business-plan-approval',
	kpi: 'f01.kpi-approval',
	review: 'f01.strategic-review-approval'
};

export function defaultF01WorkflowKey(
	kind: F01ManagedRecordKind,
	fromState: string,
	toState: string
): string | null {
	if (fromState !== 'draft' || toState !== 'approved') return null;
	return DEFAULT_APPROVAL_WORKFLOW[kind] ?? null;
}

export function f01WorkflowTemplate(key: string): WorkflowTemplate | null {
	return F01_WORKFLOW_TEMPLATES[key] ?? null;
}
