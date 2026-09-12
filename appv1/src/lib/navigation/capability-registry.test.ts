import { describe, expect, it } from 'vitest';

import {
	getNativeCapabilityRegistry,
	resolveNativeCapabilityRegistry,
	summariseCapabilityRegistry
} from './capability-registry';

describe('native capability registry', () => {
	it('defines exactly the 19 governed native capability domains in stable order', () => {
		const registry = getNativeCapabilityRegistry();
		expect(registry).toHaveLength(19);
		expect(registry.map((domain) => domain.id)).toEqual(
			Array.from({ length: 19 }, (_, index) => index + 1)
		);
		expect(new Set(registry.map((domain) => domain.key)).size).toBe(19);
		expect(registry.every((domain) => domain.permissionNamespaces.length > 0)).toBe(true);
	});

	it('keeps planned capability domains without live routes while exposing current governed workspaces', () => {
		const registry = getNativeCapabilityRegistry();
		const planned = registry.filter((domain) => domain.maturity === 'planned');
		expect(planned.map((domain) => domain.id)).toEqual([10, 11, 18]);
		expect(planned.every((domain) => domain.routes.length === 0)).toBe(true);
		expect(
			registry.find((domain) => domain.id === 19)?.routes.map((route) => route.href)
		).toContain('/search');
	});

	it('filters capability routes by effective permission keys without hiding member-safe horizontal utilities', () => {
		const registry = resolveNativeCapabilityRegistry(['crm.view', 'project.view']);
		const crm = registry.find((domain) => domain.id === 2);
		const project = registry.find((domain) => domain.id === 5);
		const finance = registry.find((domain) => domain.id === 7);
		const platform = registry.find((domain) => domain.id === 19);

		expect(crm?.available).toBe(true);
		expect(crm?.routes.map((route) => route.href)).toContain('/crm');
		expect(project?.routes.map((route) => route.href)).toContain('/projects');
		expect(finance?.available).toBe(false);
		expect(platform?.routes.map((route) => route.href)).toEqual(['/search', '/contexts']);
	});

	it('summarises product maturity separately from user availability', () => {
		const registry = resolveNativeCapabilityRegistry([]);
		expect(summariseCapabilityRegistry(registry)).toEqual({
			total: 19,
			available: 2,
			operational: 3,
			partial: 13,
			planned: 3
		});
	});
});
