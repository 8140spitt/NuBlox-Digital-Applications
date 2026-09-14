import { sortWorkItems, summariseWorkQueue, type WorkItem } from '$lib/work/work-contract';
import { listPendingWorkflowTasks } from '$lib/server/platform/workflow-request-service';
import type { PageServerLoad } from './$types';

function workPriority(priority: string): WorkItem['priority'] {
	if (priority === 'critical') return 'critical';
	if (priority === 'urgent' || priority === 'high') return 'high';
	if (priority === 'low') return 'low';
	return 'normal';
}

function workStatus(status: string): WorkItem['status'] {
	if (status === 'in_progress') return 'in-progress';
	if (status === 'blocked') return 'blocked';
	return 'open';
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	const tasks = (
		await listPendingWorkflowTasks({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId
		})
	).filter((task) => task.sourceDomain === 'F01');
	const items: WorkItem[] = tasks.map((task) => ({
		id: task.requestPublicId,
		functionId: 'F01',
		kind: 'approval',
		priority: workPriority(task.priority),
		status: workStatus(task.workStatus),
		title: task.title,
		description: task.submissionNote ?? task.description ?? undefined,
		dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
		context: `${task.sourceType} · ${task.fromState} → ${task.toState}`,
		reference: {
			label: 'Open workflow task',
			href: `/${params.tenant}/app/my-work/${task.requestPublicId}`
		}
	}));
	const sorted = sortWorkItems(items);
	return {
		work: {
			items: sorted,
			summary: summariseWorkQueue(sorted),
			connected: true
		}
	};
};
