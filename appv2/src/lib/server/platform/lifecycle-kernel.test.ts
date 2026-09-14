import { describe, expect, it } from 'vitest';
import {
	assertLifecycleTransition,
	canLifecycleOperation,
	defineLifecycleTemplate,
	lifecycleTransitions,
	phasePermissionKeysForRoles
} from './lifecycle-kernel';

describe('platform lifecycle kernel', () => {
	it('validates and executes a basic lifecycle without phase access rules', () => {
		const template = defineLifecycleTemplate({
			key: 'controlled-record',
			version: '1.0',
			mode: 'basic' as const,
			enabled: true,
			objectType: 'controlled-record',
			initialState: 'draft',
			phases: {
				draft: { state: 'draft', label: 'Draft', editable: true, deletable: true },
				approved: { state: 'approved', label: 'Approved', revisable: true }
			},
			transitions: {
				draft: [{ to: 'approved', label: 'Approve', requiredPermissionKey: 'record.approve' }],
				approved: []
			}
		});

		expect(canLifecycleOperation(template, 'draft', 'edit')).toBe(true);
		expect(canLifecycleOperation(template, 'approved', 'edit')).toBe(false);
		expect(canLifecycleOperation(template, 'approved', 'revise')).toBe(true);
		expect(assertLifecycleTransition(template, 'draft', 'approved').requiredPermissionKey).toBe(
			'record.approve'
		);
	});

	it('supports phase-scoped access grants for advanced lifecycles', () => {
		const template = defineLifecycleTemplate({
			key: 'advanced-controlled-record',
			version: '1.0',
			mode: 'advanced' as const,
			enabled: true,
			objectType: 'advanced-controlled-record',
			initialState: 'draft',
			phases: {
				draft: {
					state: 'draft',
					label: 'Draft',
					editable: true,
					accessRules: [
						{ roleKey: 'author', permissionKeys: ['record.read', 'record.modify'] },
						{ roleKey: 'approver', permissionKeys: ['record.read'] }
					]
				},
				approved: {
					state: 'approved',
					label: 'Approved',
					revisable: true,
					accessRules: [
						{ roleKey: 'author', permissionKeys: ['record.read', 'record.revise'] },
						{ roleKey: 'approver', permissionKeys: ['record.read', 'record.delete'] }
					]
				}
			},
			transitions: {
				draft: [{ to: 'approved', label: 'Approve' }],
				approved: []
			}
		});

		expect(phasePermissionKeysForRoles(template, 'draft', ['author'])).toEqual([
			'record.modify',
			'record.read'
		]);
		expect(phasePermissionKeysForRoles(template, 'approved', ['author'])).toEqual([
			'record.read',
			'record.revise'
		]);
		expect(phasePermissionKeysForRoles(template, 'approved', ['approver'])).toEqual([
			'record.delete',
			'record.read'
		]);
	});

	it('rejects phase access rules on a basic lifecycle', () => {
		expect(() =>
			defineLifecycleTemplate({
				key: 'invalid-basic',
				version: '1.0',
				mode: 'basic' as const,
				enabled: true,
				objectType: 'invalid-basic',
				initialState: 'draft',
				phases: {
					draft: {
						state: 'draft',
						label: 'Draft',
						accessRules: [{ roleKey: 'author', permissionKeys: ['record.read'] }]
					}
				},
				transitions: { draft: [] }
			})
		).toThrow('basic and cannot define phase access rules');
	});

	it('rejects transitions to undefined phases', () => {
		expect(() =>
			defineLifecycleTemplate({
				key: 'invalid-transition',
				version: '1.0',
				mode: 'basic' as const,
				enabled: true,
				objectType: 'invalid-transition',
				initialState: 'draft',
				phases: { draft: { state: 'draft', label: 'Draft' } },
				transitions: { draft: [{ to: 'approved', label: 'Approve' }] }
			})
		).toThrow('transition target approved is not a phase');
	});

	it('keeps invalid transitions explicit', () => {
		const template = defineLifecycleTemplate({
			key: 'simple',
			version: '1.0',
			mode: 'basic' as const,
			enabled: true,
			objectType: 'simple',
			initialState: 'draft',
			phases: {
				draft: { state: 'draft', label: 'Draft' },
				approved: { state: 'approved', label: 'Approved' }
			},
			transitions: { draft: [{ to: 'approved', label: 'Approve' }], approved: [] }
		});
		expect(lifecycleTransitions(template, 'approved')).toEqual([]);
		expect(() => assertLifecycleTransition(template, 'approved', 'draft')).toThrow(
			'Invalid simple lifecycle transition'
		);
	});
});
