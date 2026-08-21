import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) return { canViewProjects: false, projects: [] };

	const access = await new ProjectWorkspaceService(getDatabase()).listProjects(actor);
	const priority: Record<string, number> = {
		active: 0,
		proposed: 1,
		on_hold: 2,
		completed: 3,
		cancelled: 4,
		archived: 5
	};
	const projects = [...access.projects].sort(
		(left, right) =>
			(priority[left.status] ?? 99) - (priority[right.status] ?? 99) ||
			left.projectNumber.localeCompare(right.projectNumber)
	);

	return {
		canViewProjects: access.canView,
		projects
	};
};
