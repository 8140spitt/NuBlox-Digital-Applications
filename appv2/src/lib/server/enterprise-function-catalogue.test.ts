import { describe, expect, it } from 'vitest';
import {
	getEnterpriseFunctionBlueprint,
	listEnterpriseFunctionBlueprints
} from './enterprise-function-catalogue';

describe('enterprise function catalogue', () => {
	it('builds one visual blueprint for every enterprise function', () => {
		const blueprints = listEnterpriseFunctionBlueprints();
		expect(blueprints).toHaveLength(29);
		expect(blueprints[0]?.id).toBe('F01');
		expect(blueprints[28]?.id).toBe('F29');
		for (const blueprint of blueprints) {
			expect(blueprint.subfunctions.length).toBeGreaterThan(0);
			expect(blueprint.objects.length).toBeGreaterThan(0);
			expect(blueprint.journey.length).toBeGreaterThan(0);
			expect(blueprint.journey.length).toBeLessThanOrEqual(6);
		}
	});

	it('keeps operational status explicit instead of presenting roadmap functions as live', () => {
		expect(getEnterpriseFunctionBlueprint('F01')?.status).toBe('operational');
		expect(getEnterpriseFunctionBlueprint('F02')?.status).toBe('blueprint');
		expect(getEnterpriseFunctionBlueprint('F29')?.status).toBe('blueprint');
	});
});
