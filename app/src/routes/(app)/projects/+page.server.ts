import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectWorkspaceService,
	ProjectWorkspaceValidationError
} from '$lib/server/projects/project-workspace-service';

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
	if (!actor) return { canView: false, canCreate: false, projects: [] };
	return new ProjectWorkspaceService(getDatabase()).listProjects(actor);
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) {
			return fail(401, {
				createError: 'Authentication and organisation context are required.',
				projectNumber: '',
				name: '',
				description: ''
			});
		}

		const data = await request.formData();
		const projectNumber = String(data.get('projectNumber') ?? '');
		const name = String(data.get('name') ?? '');
		const description = String(data.get('description') ?? '');

		let project;
		try {
			project = await new ProjectWorkspaceService(getDatabase()).createProject(actor, {
				projectNumber,
				name,
				description
			});
		} catch (error) {
			if (error instanceof ProjectWorkspaceValidationError) {
				return fail(400, {
					createError: error.message,
					projectNumber,
					name,
					description
				});
			}
			if (error instanceof TenantAccessError) {
				return fail(403, {
					createError: 'You do not have permission to create projects in this organisation.',
					projectNumber,
					name,
					description
				});
			}
			throw error;
		}

		throw redirect(303, `/projects/${encodeURIComponent(project.publicId)}`);
	}
};
