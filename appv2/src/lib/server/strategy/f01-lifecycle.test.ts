import { describe, expect, it } from 'vitest';
import {
	assertLifecycleTransition,
	canDeleteF01Record,
	canEditF01Record,
	canReviseF01Record,
	f01PhasePermissionKeys,
	lifecycleTemplate,
	lifecycleTransitions
} from './f01-lifecycle';

describe('F01 lifecycle policies', () => {
	it('treats superseded as historical outcome rather than a next strategy step', () => {
		expect(lifecycleTransitions('framework', 'approved')).toEqual([]);
		expect(canReviseF01Record('framework', 'approved')).toBe(true);
		expect(() => assertLifecycleTransition('framework', 'approved', 'superseded')).toThrow(
			'Invalid framework lifecycle transition'
		);
	});

	it('keeps approved governed roots immutable for editing but explicitly deletable or revisable', () => {
		for (const kind of ['framework', 'plan', 'kpi'] as const) {
			expect(canEditF01Record(kind, 'approved')).toBe(false);
			expect(canDeleteF01Record(kind, 'approved')).toBe(true);
			expect(canReviseF01Record(kind, 'approved')).toBe(true);
		}
	});

	it('models governed roots as advanced lifecycle templates with phase-scoped access', () => {
		expect(lifecycleTemplate('framework').mode).toBe('advanced');
		expect(f01PhasePermissionKeys('framework', 'draft', ['strategy.manager'])).toEqual([
			'strategy.manage',
			'strategy.view'
		]);
		expect(f01PhasePermissionKeys('framework', 'approved', ['strategy.viewer'])).toEqual([
			'strategy.view'
		]);
		const approvalGate = assertLifecycleTransition('framework', 'draft', 'approved');
		expect(approvalGate.requiredPermissionKey).toBe('strategy.manage');
		expect(approvalGate.workflowKey).toBe('f01.strategy-approval');
	});

	it('keeps ordinary operational state machines basic unless phase access or workflow is required', () => {
		expect(lifecycleTemplate('initiative').mode).toBe('basic');
		expect(f01PhasePermissionKeys('initiative', 'in_progress', ['strategy.manager'])).toEqual([]);
	});

	it('never hard deletes governed handoff requests and keeps receiving outcomes outside F01', () => {
		expect(canDeleteF01Record('handoff', 'requested')).toBe(false);
		expect(lifecycleTransitions('handoff', 'requested').map((item) => item.to)).toEqual([
			'cancelled'
		]);
		expect(lifecycleTransitions('handoff', 'accepted')).toEqual([]);
		expect(() => assertLifecycleTransition('handoff', 'requested', 'accepted')).toThrow(
			'Invalid handoff lifecycle transition'
		);
	});

	it('moves initiatives through delivery rather than generic approval states', () => {
		expect(lifecycleTransitions('initiative', 'approved').map((item) => item.to)).toEqual([
			'in_progress',
			'cancelled'
		]);
		expect(lifecycleTransitions('initiative', 'in_progress').map((item) => item.to)).toEqual([
			'completed',
			'cancelled'
		]);
	});

	it('allows review decisions to close with explicit lifecycle outcomes', () => {
		expect(lifecycleTransitions('decision', 'open').map((item) => item.to)).toEqual([
			'in_progress',
			'completed',
			'cancelled'
		]);
		expect(assertLifecycleTransition('decision', 'open', 'completed').requiresNote).toBe(true);
	});
});
