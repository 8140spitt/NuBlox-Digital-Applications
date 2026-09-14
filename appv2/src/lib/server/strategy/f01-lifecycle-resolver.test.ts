import { describe, expect, it } from 'vitest';
import { defineLifecycleTemplate } from '$lib/server/platform/lifecycle-kernel';
import { lifecycleTemplate } from './f01-lifecycle';
import { assertNativeF01LifecycleCompatibility } from './f01-lifecycle-resolver';

describe('native F01 lifecycle binding compatibility', () => {
	it('accepts policy changes that retain the native state and transition contract', () => {
		const fallback = lifecycleTemplate('framework');
		const configured = {
			template: defineLifecycleTemplate({
				...fallback,
				key: 'tenant.framework',
				objectType: 'F01.framework',
				transitions: {
					...fallback.transitions,
					draft: fallback.transitions.draft.map((transition) => ({
						...transition,
						workflowKey: 'tenant.strategy-approval'
					}))
				}
			}),
			persistedTemplateId: 1,
			persistedTemplatePublicId: 'tenant-framework',
			source: 'binding' as const
		};
		expect(assertNativeF01LifecycleCompatibility('framework', fallback, configured)).toBe(
			configured
		);
	});

	it('rejects configured states and routes that native F01 cannot persist', () => {
		const fallback = lifecycleTemplate('framework');
		const configured = {
			template: defineLifecycleTemplate({
				...fallback,
				key: 'tenant.framework.invalid',
				objectType: 'F01.framework',
				phases: {
					...fallback.phases,
					in_review: { state: 'in_review', label: 'In review' }
				},
				transitions: {
					...fallback.transitions,
					draft: [{ to: 'in_review', label: 'Submit for review' }],
					in_review: [{ to: 'approved', label: 'Approve' }]
				}
			}),
			persistedTemplateId: 2,
			persistedTemplatePublicId: 'tenant-framework-invalid',
			source: 'binding' as const
		};
		expect(() => assertNativeF01LifecycleCompatibility('framework', fallback, configured)).toThrow(
			'incompatible with native F01.framework states'
		);
	});
});
