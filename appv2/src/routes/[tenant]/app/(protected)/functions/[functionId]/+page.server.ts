import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	findEnterpriseFunction,
	type EnterpriseFunctionId
} from '$lib/enterprise/enterprise-functions';
import { functionBusinessJourneys } from '$lib/enterprise/function-business-journeys';
import { functionObjectRegistry } from '$lib/platform/object-template-registry';
import { listFunctionalRoles } from '$lib/server/job-architecture-catalogue';

export const load: PageServerLoad = async ({ params }) => {
	const functionId = params.functionId.toUpperCase();
	const enterpriseFunction = findEnterpriseFunction(functionId);
	if (!enterpriseFunction) throw error(404, 'Enterprise function not found.');

	const seenSubfunctions = new Set<string>();
	const subfunctions = listFunctionalRoles()
		.filter((role) => role.source.functionId === enterpriseFunction.id)
		.filter((role) => {
			if (seenSubfunctions.has(role.source.subfunctionId)) return false;
			seenSubfunctions.add(role.source.subfunctionId);
			return true;
		})
		.map((role) => ({
			id: role.source.subfunctionId,
			name: role.source.subfunctionName,
			purpose: role.purpose
		}))
		.sort((left, right) => left.id.localeCompare(right.id));

	const objectGroup = functionObjectRegistry.find(
		(group) => group.functionId === enterpriseFunction.id
	);

	return {
		enterpriseFunction,
		subfunctions,
		objects: (objectGroup?.objects ?? []).map((object) => ({
			name: object.name,
			pattern: object.pattern
		})),
		journey: functionBusinessJourneys[enterpriseFunction.id as EnterpriseFunctionId],
		functionalRoleCount: subfunctions.length
	};
};
