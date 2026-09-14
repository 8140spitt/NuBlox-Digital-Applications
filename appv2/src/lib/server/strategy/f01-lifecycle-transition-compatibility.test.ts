import { describe, expect, it } from 'vitest';
import { defineLifecycleTemplate } from '$lib/server/platform/lifecycle-kernel';
import { lifecycleTemplate } from './f01-lifecycle';
import { assertNativeF01LifecycleCompatibility } from './f01-lifecycle-resolver';

describe('native F01 lifecycle transition compatibility', () => {
	it('rejects a configured transition between native states when the native record cannot execute that route', () => {
		const fallback = lifecycleTemplate('framework');
		const configured = {
			template: defineLifecycleTemplate({
				...fallback,
				key: 'tenant.framework.unsupported-route',
				objectType: 'F01.framework',
				transitions: {
					...fallback.transitions,
					approved: [{ to: 'draft', label: 'Reopen approved strategy' }]
				}
			}),
			persistedTemplateId: 3,
			persistedTemplatePublicId: 'tenant-framework-unsupported-route',
			source: 'binding' as const
		};

		expect(() => assertNativeF01LifecycleCompatibility('framework', fallback, configured)).toThrow(
			'transition approved → draft is not executable by native F01.framework'
		);
	});
});
