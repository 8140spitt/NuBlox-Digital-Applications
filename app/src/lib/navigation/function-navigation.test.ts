import { describe, expect, it } from 'vitest';

import {
	getEnterpriseFunctions,
	resolveEnterpriseFunctions,
	resolveFunctionNavigation
} from './function-navigation';

describe('function-first navigation', () => {
	it('defines the canonical 29 enterprise functions in stable order', () => {
		const functions = getEnterpriseFunctions();
		expect(functions).toHaveLength(29);
		expect(functions.map((fn) => fn.id)).toEqual(
			Array.from({ length: 29 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`)
		);
	});

	it('separates delivered workspaces from user availability', () => {
		const functions = resolveEnterpriseFunctions(['/strategy', '/finance', '/projects']);

		expect(functions.find((fn) => fn.id === 'F01')).toMatchObject({
			delivered: true,
			available: true
		});
		expect(functions.find((fn) => fn.id === 'F14')).toMatchObject({
			delivered: true,
			available: true
		});
		expect(functions.find((fn) => fn.id === 'F02')).toMatchObject({
			delivered: true,
			available: false
		});
		expect(functions.find((fn) => fn.id === 'F05')).toMatchObject({
			delivered: false,
			available: false
		});
	});

	it('builds primary navigation from authorised live functions rather than role groupings', () => {
		const navigation = resolveFunctionNavigation(['/strategy', '/performance', '/projects']);
		const functions = navigation.find((section) => section.id === 'functions');

		expect(navigation.map((section) => section.id)).toEqual(['work', 'functions', 'tools']);
		expect(functions?.items.map((item) => item.id)).toEqual(['f01', 'f03', 'f27']);
		expect(functions?.items.map((item) => item.label)).toEqual([
			'F01 Strategy & planning',
			'F03 Enterprise performance',
			'F27 Projects & programmes'
		]);
	});
});
