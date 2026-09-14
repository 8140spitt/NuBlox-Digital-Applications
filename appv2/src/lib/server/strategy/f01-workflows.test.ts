import { describe, expect, it } from 'vitest';
import { f01WorkflowTemplate } from './f01-workflows';

describe('F01 fallback workflow authority', () => {
	it('keeps the approver role as a permission-gated runtime responsibility', () => {
		const template = f01WorkflowTemplate('f01.strategy-approval');
		const approval = template?.nodes.find((node) => node.key === 'approval');

		expect(approval).toMatchObject({
			type: 'activity',
			responsibleRoleKey: 'approver'
		});
		expect(approval?.participants).toBeUndefined();
	});
});
