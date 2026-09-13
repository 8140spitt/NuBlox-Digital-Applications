import { describe, expect, it } from 'vitest';
import {
	assertLifecycleTransition,
	canDeleteF01Record,
	canEditF01Record,
	canReviseF01Record,
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

	it('keeps approved business plans immutable but revisable', () => {
		expect(canEditF01Record('plan', 'approved')).toBe(false);
		expect(canDeleteF01Record('plan', 'approved')).toBe(false);
		expect(canReviseF01Record('plan', 'approved')).toBe(true);
	});

	it('never hard deletes governed handoff requests', () => {
		expect(canDeleteF01Record('handoff', 'requested')).toBe(false);
		expect(lifecycleTransitions('handoff', 'requested').map((item) => item.to)).toEqual([
			'accepted',
			'rejected',
			'cancelled'
		]);
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

	it('requires canonical references when a handoff is fulfilled', () => {
		const transition = assertLifecycleTransition('handoff', 'accepted', 'fulfilled');
		expect(transition.requiresTargetReference).toBe(true);
		expect(transition.requiresNote).toBe(true);
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
