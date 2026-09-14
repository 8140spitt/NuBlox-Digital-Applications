import { describe, expect, it } from 'vitest';
import {
	completionSatisfied,
	defineWorkflowTemplate,
	deriveWorkflowHealth,
	workflowSuccessors
} from './workflow-kernel';

describe('workflow kernel', () => {
	it('models an approval route without conflating workflow state with lifecycle state', () => {
		const template = defineWorkflowTemplate({
			key: 'f01.strategy-approval',
			version: '1.0',
			status: 'published' as const,
			name: 'Strategy approval',
			roles: ['approver'],
			nodes: [
				{ key: 'start', label: 'Start', type: 'start' as const },
				{
					key: 'approve',
					label: 'Approve strategy',
					type: 'activity' as const,
					participants: [
						{
							participantType: 'workflow_role' as const,
							participantKey: 'approver',
							required: true
						}
					],
					completionRule: { type: 'all' as const },
					routingEvents: ['approve', 'return', 'reject'],
					recordVotes: true,
					recordReassignments: true
				},
				{ key: 'approved', label: 'Approved', type: 'end' as const },
				{ key: 'returned', label: 'Returned', type: 'end' as const },
				{ key: 'rejected', label: 'Rejected', type: 'end' as const }
			],
			links: [
				{ from: 'start', to: 'approve' },
				{ from: 'approve', to: 'approved', event: 'approve' },
				{ from: 'approve', to: 'returned', event: 'return' },
				{ from: 'approve', to: 'rejected', event: 'reject' }
			]
		});

		expect(workflowSuccessors(template, 'approve', 'approve').map((link) => link.to)).toEqual([
			'approved'
		]);
		expect(workflowSuccessors(template, 'approve', 'reject').map((link) => link.to)).toEqual([
			'rejected'
		]);
	});

	it('rejects unsafe or structurally invalid templates', () => {
		expect(() =>
			defineWorkflowTemplate({
				key: 'bad',
				version: '1.0',
				status: 'draft' as const,
				name: 'Bad workflow',
				nodes: [
					{ key: 'start', label: 'Start', type: 'start' as const },
					{ key: 'threshold', label: 'Threshold', type: 'threshold' as const, threshold: 0 }
				],
				links: [{ from: 'start', to: 'missing' }]
			})
		).toThrow();
	});

	it('supports all, any and count completion semantics', () => {
		expect(
			completionSatisfied({
				rule: { type: 'all' },
				requiredParticipants: 3,
				completedParticipants: 2
			})
		).toBe(false);
		expect(
			completionSatisfied({
				rule: { type: 'any' },
				requiredParticipants: 3,
				completedParticipants: 1
			})
		).toBe(true);
		expect(
			completionSatisfied({
				rule: { type: 'count', count: 2 },
				requiredParticipants: 5,
				completedParticipants: 2
			})
		).toBe(true);
	});

	it('derives workflow health independently from execution state', () => {
		expect(deriveWorkflowHealth({ errors: 0, warnings: 0 })).toBe('green');
		expect(deriveWorkflowHealth({ errors: 0, warnings: 1 })).toBe('amber');
		expect(deriveWorkflowHealth({ errors: 1, warnings: 3 })).toBe('red');
	});
});
