import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { ConcurrentUpdateError, RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectTeamService, ProjectTeamValidationError } from '$lib/server/projects/project-team-service';
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

function formFailure(input: {
	createError?: string | null;
	projectNumber?: string;
	name?: string;
	description?: string;
	invitationError?: string | null;
	invitationProjectPublicId?: string;
}) {
	return {
		createError: input.createError ?? null,
		projectNumber: input.projectNumber ?? '',
		name: input.name ?? '',
		description: input.description ?? '',
		invitationError: input.invitationError ?? null,
		invitationProjectPublicId: input.invitationProjectPublicId ?? ''
	};
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) return { canView: false, canCreate: false, projects: [], invitations: [] };
	const db = getDatabase();
	const [portfolio, invitations] = await Promise.all([
		new ProjectWorkspaceService(db).listProjects(actor),
		new ProjectTeamService(db).listPendingInvitations(actor)
	]);
	return { ...portfolio, invitations };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) {
			return fail(
				401,
				formFailure({ createError: 'Authentication and organisation context are required.' })
			);
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
				return fail(400, formFailure({ createError: error.message, projectNumber, name, description }));
			}
			if (error instanceof TenantAccessError) {
				return fail(
					403,
					formFailure({
						createError: 'You do not have permission to create projects in this organisation.',
						projectNumber,
						name,
						description
					})
				);
			}
			throw error;
		}

		throw redirect(303, `/projects/${encodeURIComponent(project.publicId)}`);
	},

	acceptInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const projectPublicId = String(data.get('projectPublicId') ?? '');
		if (!actor) {
			return fail(
				401,
				formFailure({
					invitationError: 'Authentication and organisation context are required.',
					invitationProjectPublicId: projectPublicId
				})
			);
		}
		try {
			await new ProjectTeamService(getDatabase()).respondToInvitation(actor, {
				projectPublicId,
				response: 'accept'
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return fail(404, formFailure({ invitationError: error.message, invitationProjectPublicId: projectPublicId }));
			}
			if (error instanceof TenantAccessError) {
				return fail(
					403,
					formFailure({
						invitationError: 'You do not have permission to respond to project invitations for this organisation.',
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return fail(409, formFailure({ invitationError: error.message, invitationProjectPublicId: projectPublicId }));
			}
			throw error;
		}
		throw redirect(303, `/projects/${encodeURIComponent(projectPublicId)}`);
	},

	declineInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const projectPublicId = String(data.get('projectPublicId') ?? '');
		if (!actor) {
			return fail(
				401,
				formFailure({
					invitationError: 'Authentication and organisation context are required.',
					invitationProjectPublicId: projectPublicId
				})
			);
		}
		try {
			await new ProjectTeamService(getDatabase()).respondToInvitation(actor, {
				projectPublicId,
				response: 'decline'
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return fail(404, formFailure({ invitationError: error.message, invitationProjectPublicId: projectPublicId }));
			}
			if (error instanceof TenantAccessError) {
				return fail(
					403,
					formFailure({
						invitationError: 'You do not have permission to respond to project invitations for this organisation.',
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return fail(409, formFailure({ invitationError: error.message, invitationProjectPublicId: projectPublicId }));
			}
			throw error;
		}
		throw redirect(303, '/projects');
	}
};
