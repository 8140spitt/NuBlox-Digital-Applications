import taxonomyF01F08Document from '../../../../docs/architecture/taxonomy/taxonomy-f01-f08.json';
import taxonomyF09F15Document from '../../../../docs/architecture/taxonomy/taxonomy-f09-f15.json';
import taxonomyF16F22Document from '../../../../docs/architecture/taxonomy/taxonomy-f16-f22.json';
import taxonomyF23F29Document from '../../../../docs/architecture/taxonomy/taxonomy-f23-f29.json';
import {
	enterpriseFunctions,
	findEnterpriseFunction,
	type EnterpriseFunctionId
} from '$lib/enterprise/enterprise-functions';
import { functionObjectRegistry } from '$lib/platform/object-template-registry';

type TaxonomySubfunction = {
	id: string;
	name: string;
	activities: string[];
};

type TaxonomyFunction = {
	id: string;
	name: string;
	subfunctions: TaxonomySubfunction[];
};

type TaxonomyDocument = {
	version: number;
	functionRange: string;
	functions: TaxonomyFunction[];
};

export type FunctionJourneyStep = {
	step: number;
	id: string;
	name: string;
	detail: string;
};

export type EnterpriseFunctionBlueprint = {
	id: EnterpriseFunctionId;
	name: string;
	shortName: string;
	purpose: string;
	status: 'operational' | 'blueprint';
	subfunctions: TaxonomySubfunction[];
	objects: {
		name: string;
		objectType: string;
		pattern: string;
		ownerDomain: string;
	}[];
	journey: FunctionJourneyStep[];
};

const taxonomyDocuments = [
	taxonomyF01F08Document,
	taxonomyF09F15Document,
	taxonomyF16F22Document,
	taxonomyF23F29Document
] as TaxonomyDocument[];

const taxonomyFunctions = taxonomyDocuments.flatMap((document) => document.functions);
const taxonomyById = new Map(taxonomyFunctions.map((entry) => [entry.id, entry]));
const objectGroupByFunctionId = new Map(
	functionObjectRegistry.map((group) => [group.functionId, group])
);

function journeyFromSubfunctions(subfunctions: TaxonomySubfunction[]): FunctionJourneyStep[] {
	if (subfunctions.length <= 6) {
		return subfunctions.map((subfunction, index) => ({
			step: index + 1,
			id: subfunction.id,
			name: subfunction.name,
			detail: subfunction.activities.slice(0, 2).join(' · ')
		}));
	}

	const lastIndex = subfunctions.length - 1;
	const selectedIndexes = [
		0,
		Math.round(lastIndex * 0.2),
		Math.round(lastIndex * 0.4),
		Math.round(lastIndex * 0.6),
		Math.round(lastIndex * 0.8),
		lastIndex
	];

	return selectedIndexes.map((index, step) => {
		const subfunction = subfunctions[index]!;
		return {
			step: step + 1,
			id: subfunction.id,
			name: subfunction.name,
			detail: subfunction.activities.slice(0, 2).join(' · ')
		};
	});
}

export function getEnterpriseFunctionBlueprint(id: string): EnterpriseFunctionBlueprint | null {
	const definition = findEnterpriseFunction(id);
	if (!definition) return null;

	const taxonomy = taxonomyById.get(definition.id);
	if (!taxonomy) {
		throw new Error(`Missing canonical taxonomy for ${definition.id}.`);
	}

	const objectGroup = objectGroupByFunctionId.get(definition.id);
	if (!objectGroup) {
		throw new Error(`Missing object registry group for ${definition.id}.`);
	}

	return {
		id: definition.id,
		name: definition.name,
		shortName: definition.shortName,
		purpose: definition.purpose,
		status: definition.id === 'F01' ? 'operational' : 'blueprint',
		subfunctions: taxonomy.subfunctions,
		objects: objectGroup.objects.map((object) => ({
			name: object.name,
			objectType: object.objectType,
			pattern: object.pattern,
			ownerDomain: object.ownerDomain
		})),
		journey: journeyFromSubfunctions(taxonomy.subfunctions)
	};
}

export function listEnterpriseFunctionBlueprints(): EnterpriseFunctionBlueprint[] {
	return enterpriseFunctions.map((entry) => {
		const blueprint = getEnterpriseFunctionBlueprint(entry.id);
		if (!blueprint) throw new Error(`Unable to build blueprint for ${entry.id}.`);
		return blueprint;
	});
}
