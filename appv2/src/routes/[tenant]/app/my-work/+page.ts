import { sortWorkItems, summariseWorkQueue, type WorkItem } from '$lib/work/work-contract';
import type { PageLoad } from './$types';

export const load: PageLoad = () => {
	const items: WorkItem[] = [];

	return {
		work: {
			items: sortWorkItems(items),
			summary: summariseWorkQueue(items),
			connected: false
		}
	};
};
