import { describe, expect, it } from 'vitest';
import {
	featuredObjectTemplates,
	functionObjectRegistry,
	getObjectTypeDefinition,
	lifecycleTemplateKey,
	objectTypeRegistry,
	workflowTemplateKey
} from './object-template-registry';

describe('object template registry', () => {
	it('covers every enterprise function from F01 to F29', () => {
		expect(functionObjectRegistry).toHaveLength(29);
		expect(functionObjectRegistry.map((group) => group.functionId)).toEqual(
			Array.from({ length: 29 }, (_, index) => `F${String(index + 1).padStart(2, '0')}`)
		);
		for (const group of functionObjectRegistry) {
			expect(group.objects.length).toBeGreaterThan(0);
		}
	});

	it('has unique canonical object types with valid lifecycle definitions and workflows', () => {
		const objectTypes = objectTypeRegistry.map((object) => object.objectType);
		expect(new Set(objectTypes).size).toBe(objectTypes.length);
		for (const object of objectTypeRegistry) {
			const states = new Set(object.lifecycle.states.map((state) => state.key));
			expect(states.has(object.lifecycle.initialState)).toBe(true);
			expect(object.workflows.length).toBeGreaterThan(0);
			for (const transition of object.lifecycle.transitions) {
				expect(states.has(transition.from)).toBe(true);
				expect(states.has(transition.to)).toBe(true);
				expect(transition.from).not.toBe(transition.to);
			}
		}
	});

	it('exposes the cross-enterprise starter pack requested for initial implementation', () => {
		const required = [
			'strategy.strategy-cycle',
			'governance.decision',
			'sales.opportunity',
			'commercial.contract',
			'procurement.supplier',
			'procurement.requisition',
			'procurement.purchase-order',
			'finance.supplier-invoice',
			'supply.material',
			'project.project',
			'project.change-request',
			'information.document',
			'quality.non-conformance',
			'risk.risk',
			'people.employment',
			'asset.physical-asset',
			'maintenance.work-order',
			'process.process'
		];
		expect(featuredObjectTemplates.map((object) => object.objectType).sort()).toEqual(
			required.sort()
		);
		for (const objectType of required) {
			expect(getObjectTypeDefinition(objectType)).not.toBeNull();
		}
	});

	it('produces stable lifecycle and workflow lineage keys', () => {
		expect(lifecycleTemplateKey('procurement.purchase-order')).toBe(
			'library.procurement.purchase-order.lifecycle'
		);
		expect(workflowTemplateKey('procurement.purchase-order', 'approval')).toBe(
			'library.procurement.purchase-order.approval'
		);
	});
});
