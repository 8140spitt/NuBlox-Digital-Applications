import { describe, expect, it } from 'vitest';
import { lifecycleTransitions, type F01ManagedRecordKind } from './f01-lifecycle';
import {
	defaultF01WorkflowKey,
	f01WorkflowDecisionPermissionKey,
	f01WorkflowTemplate
} from './f01-workflows';

const governedApprovals: Array<{
	kind: F01ManagedRecordKind;
	workflowKey: string;
}> = [
	{ kind: 'framework', workflowKey: 'f01.strategy-approval' },
	{ kind: 'plan', workflowKey: 'f01.business-plan-approval' },
	{ kind: 'kpi', workflowKey: 'f01.kpi-approval' },
	{ kind: 'review', workflowKey: 'f01.strategic-review-approval' }
];

describe('F01 governed workflow routing', () => {
	it.each(governedApprovals)(
		'separates submit authority from decision authority for $kind',
		({ kind, workflowKey }) => {
			const transition = lifecycleTransitions(kind, 'draft').find(
				(candidate) => candidate.to === 'approved'
			);
			expect(transition).toMatchObject({
				to: 'approved',
				requiredPermissionKey: 'strategy.manage',
				workflowKey
			});
			expect(defaultF01WorkflowKey(kind, 'draft', 'approved')).toBe(workflowKey);
			expect(f01WorkflowDecisionPermissionKey(workflowKey)).toBe('strategy.approve');
		}
	);

	it.each(governedApprovals)(
		'publishes an approve/return/reject decision activity for $kind',
		({ workflowKey }) => {
			const template = f01WorkflowTemplate(workflowKey);
			expect(template).not.toBeNull();
			const approval = template!.nodes.find((node) => node.key === 'approval');
			expect(approval).toMatchObject({
				type: 'activity',
				responsibleRoleKey: 'approver',
				routingEvents: ['approve', 'return', 'reject'],
				recordVotes: true,
				recordReassignments: true
			});
		}
	);
});
