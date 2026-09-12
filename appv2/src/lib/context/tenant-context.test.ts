import { describe, expect, it } from 'vitest';
import { tenantContextFromRoute, tenantDisplayName } from './tenant-context';

describe('tenant route context', () => {
	it('formats route slugs for display without changing identity', () => {
		expect(tenantDisplayName('perspective-bc')).toBe('Perspective Bc');
	});

	it('rejects invalid route context', () => {
		expect(tenantContextFromRoute('Perspective BC')).toBeNull();
		expect(tenantContextFromRoute('nublox')).toEqual({ slug: 'nublox', displayName: 'Nublox' });
	});
});
