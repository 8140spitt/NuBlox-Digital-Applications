import type { LayoutLoad } from './$types';

import {
	resolveEnterpriseFunctions,
	resolveFunctionNavigation
} from '$lib/navigation/function-navigation';

function collectAvailableHrefs(data: Parameters<LayoutLoad>[0]['data']): string[] {
	const hrefs = new Set<string>();

	for (const section of data.navigation ?? []) {
		for (const item of section.items ?? []) hrefs.add(item.href);
	}

	for (const section of data.workspaceDirectory ?? []) {
		for (const item of section.items ?? []) hrefs.add(item.href);
	}

	for (const domain of data.capabilityRegistry ?? []) {
		for (const route of domain.routes ?? []) hrefs.add(route.href);
	}

	return [...hrefs];
}

export const load: LayoutLoad = ({ data }) => {
	const availableHrefs = collectAvailableHrefs(data);

	return {
		...data,
		navigation: resolveFunctionNavigation(availableHrefs),
		functionDirectory: resolveEnterpriseFunctions(availableHrefs)
	};
};
