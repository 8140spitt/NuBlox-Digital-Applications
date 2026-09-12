import { describe, expect, it } from 'vitest';
import { enterpriseFunctions, findEnterpriseFunction } from './enterprise-functions';

describe('enterprise function registry', () => {
	it('contains the canonical 29 enterprise functions in order', () => {
		expect(enterpriseFunctions).toHaveLength(29);
		expect(enterpriseFunctions[0]?.id).toBe('F01');
		expect(enterpriseFunctions[28]?.id).toBe('F29');
		expect(new Set(enterpriseFunctions.map((entry) => entry.id)).size).toBe(29);
	});

	it('resolves function identifiers case-insensitively', () => {
		expect(findEnterpriseFunction('f27')?.name).toBe('Portfolio, Programme & Project Management');
		expect(findEnterpriseFunction('F99')).toBeNull();
	});
});
