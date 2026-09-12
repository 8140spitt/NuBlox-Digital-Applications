import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import type { WorkItemDecision, WorkItemStatus } from '$lib/server/work/work-item-repository';
import { WorkItemService, WorkKernelValidationError } from '$lib/server/work/work-item-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function text(data: FormData, name: string): string {
	return String(data.get(name) ?? '').trim();
}

function requestedTransition(value: string): WorkItemStatus | null {
	if (value === 'in_progress' || value === 'blocked' || value === 'completed') return value;
	return null;
}

function requestedDecision(value: string): WorkItemDecision | null {
	if (
		value === 'approved' ||
		value === 'rejected' ||
		value === 'returned' ||
		value === 'acknowledged'
	) {
		return value;
	}
	return null;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canViewProjects: false,
			projects: [],
			canViewWork: false,
			workItems: [],
			workSummary: { total: 0, overdue: 0, critical: 0 },
			workUpdated: false
		};
	}

	const db = getDatabase();
	const projectAccess = await new ProjectWorkspaceService(db).listProjects(actor);
	const priority: Record<string, number> = {
		active: 0,
		proposed: 1,
		on_hold: 2,
		completed: 3,
		cancelled: 4,
		archived: 5
	};
	const projects = [...projectAccess.projects].sort(
		(left, right) =>
			(priority[left.status] ?? 99) - (priority[right.status] ?? 99) ||
			left.projectNumber.localeCompare(right.projectNumber)
	);

	let assignedWork;
	try {
		assignedWork = await new WorkItemService(db).listMyWork(actor, 100);
	} catch (error) {
		if (error instanceof TenantAccessError) {
			return {
				canViewProjects: projectAccess.canView,
				projects,
				canViewWork: false,
				workItems: [],
				workSummary: { total: 0, overdue: 0, critical: 0 },
				workUpdated: false
			};
		}
		throw error;
	}

	const permissions = new PermissionService(db);
	const scopeDecisions = new Map<
		string,
		{ canView: boolean; canProgress: boolean; canComplete: boolean; canApprove: boolean }
	>();
	const scopeIds = [...new Set(assignedWork.map((item) => item.projectId ?? 'organisation'))];

	await Promise.all(
		scopeIds.map(async (scopeId) => {
			const projectId = scopeId === 'organisation' ? null : scopeId;
			const scope = projectId ? { projectId } : {};
			const [view, progress, complete, approve] = await Promise.all([
				permissions.decideWithUmbrella(actor, 'work.view', 'work.manage', scope),
				permissions.decideWithUmbrella(actor, 'work.progress', 'work.manage', scope),
				permissions.decideWithUmbrella(actor, 'work.complete', 'work.manage', scope),
				permissions.decideWithUmbrella(actor, 'work.approve', 'work.manage', scope)
			]);
			scopeDecisions.set(scopeId, {
				canView: view.allowed,
				canProgress: progress.allowed,
				canComplete: complete.allowed,
				canApprove: approve.allowed
			});
		})
	);

	const now = Date.now();
	const workItems = assignedWork
		.map((item) => {
			const decision = scopeDecisions.get(item.projectId ?? 'organisation');
			if (!decision?.canView) return null;
			return {
				...item,
				canProgress: decision.canProgress,
				canComplete: decision.canComplete,
				canApprove: decision.canApprove,
				isOverdue: Boolean(item.dueAt && item.dueAt.getTime() < now)
			};
		})
		.filter((item): item is NonNullable<typeof item> => item !== null);

	return {
		canViewProjects: projectAccess.canView,
		projects,
		canViewWork: true,
		workItems,
		workSummary: {
			total: workItems.length,
			overdue: workItems.filter((item) => item.isOverdue).length,
			critical: workItems.filter((item) => item.priority === 'critical').length
		},
		workUpdated: url.searchParams.get('workUpdated') === '1'
	};
};

export const actions: Actions = {
	transitionWork: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { workError: 'Authentication and organisation context are required.' });

		const data = await request.formData();
		const workItemPublicId = text(data, 'workItemPublicId');
		const toStatus = requestedTransition(text(data, 'toStatus'));
		const note = text(data, 'note') || null;
		if (!/^[0-9a-f-]{36}$/i.test(workItemPublicId) || !toStatus) {
			return fail(400, { workError: 'The requested work transition is invalid.' });
		}

		try {
			await new WorkItemService(getDatabase()).transition(actor, workItemPublicId, toStatus, note);
		} catch (error) {
			if (error instanceof TenantAccessError) {
				return fail(403, { workError: 'You are not authorised to perform this work transition.' });
			}
			if (error instanceof RecordNotFoundError) {
				return fail(404, {
					workError: 'The work item is no longer available in this organisation.'
				});
			}
			if (error instanceof ConcurrentUpdateError) {
				return fail(409, {
					workError: 'The work item changed while you were updating it. Reload and retry.'
				});
			}
			if (
				error instanceof InvalidLifecycleTransitionError ||
				error instanceof WorkKernelValidationError
			) {
				return fail(400, { workError: error.message });
			}
			throw error;
		}

		throw redirect(303, '/my-work?workUpdated=1');
	},

	decideWork: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { workError: 'Authentication and organisation context are required.' });

		const data = await request.formData();
		const workItemPublicId = text(data, 'workItemPublicId');
		const decision = requestedDecision(text(data, 'decision'));
		const note = text(data, 'note') || null;
		if (!/^[0-9a-f-]{36}$/i.test(workItemPublicId) || !decision) {
			return fail(400, { workError: 'The requested work decision is invalid.' });
		}

		try {
			await new WorkItemService(getDatabase()).recordDecision(
				actor,
				workItemPublicId,
				decision,
				note
			);
		} catch (error) {
			if (error instanceof TenantAccessError) {
				return fail(403, { workError: 'You are not authorised to record this work decision.' });
			}
			if (error instanceof RecordNotFoundError) {
				return fail(404, {
					workError: 'The work item is no longer available in this organisation.'
				});
			}
			if (error instanceof WorkKernelValidationError) {
				return fail(400, { workError: error.message });
			}
			throw error;
		}

		throw redirect(303, '/my-work?workUpdated=1');
	}
};
