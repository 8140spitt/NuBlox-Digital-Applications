import type { EnterpriseFunctionId } from '$lib/enterprise/enterprise-functions';

export type WorkKind = 'action' | 'approval' | 'decision' | 'exception' | 'review';
export type WorkPriority = 'critical' | 'high' | 'normal' | 'low';
export type WorkStatus = 'open' | 'in-progress' | 'blocked' | 'waiting';

export type WorkReference = {
	label: string;
	href: string;
};

export type WorkItem = {
	id: string;
	functionId: EnterpriseFunctionId;
	kind: WorkKind;
	priority: WorkPriority;
	status: WorkStatus;
	title: string;
	description?: string;
	dueAt?: string;
	context: string;
	reference: WorkReference;
};

export type WorkQueueSummary = {
	total: number;
	critical: number;
	dueSoon: number;
	blocked: number;
};

const priorityWeight: Record<WorkPriority, number> = {
	critical: 0,
	high: 1,
	normal: 2,
	low: 3
};

export function sortWorkItems(items: readonly WorkItem[]): WorkItem[] {
	return [...items].sort((left, right) => {
		const priorityDifference = priorityWeight[left.priority] - priorityWeight[right.priority];
		if (priorityDifference !== 0) return priorityDifference;

		if (left.dueAt && right.dueAt) return left.dueAt.localeCompare(right.dueAt);
		if (left.dueAt) return -1;
		if (right.dueAt) return 1;
		return left.title.localeCompare(right.title);
	});
}

export function summariseWorkQueue(
	items: readonly WorkItem[],
	now: Date = new Date()
): WorkQueueSummary {
	const dueSoonBoundary = new Date(now);
	dueSoonBoundary.setHours(dueSoonBoundary.getHours() + 48);

	return {
		total: items.length,
		critical: items.filter((item) => item.priority === 'critical').length,
		dueSoon: items.filter((item) => {
			if (!item.dueAt) return false;
			const dueAt = new Date(item.dueAt);
			return dueAt >= now && dueAt <= dueSoonBoundary;
		}).length,
		blocked: items.filter((item) => item.status === 'blocked').length
	};
}
