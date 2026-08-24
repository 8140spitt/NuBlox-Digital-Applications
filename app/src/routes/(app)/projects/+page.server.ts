import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import {
	ProjectHierarchyService,
	ProjectHierarchyValidationError
} from '$lib/server/projects/project-hierarchy-service';
import {
	ProjectTeamService,
	ProjectTeamValidationError
} from '$lib/server/projects/project-team-service';
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
	hierarchyError?: string | null;
	hierarchyAction?: string;
	portfolioNumber?: string;
	portfolioName?: string;
	portfolioDescription?: string;
	programmeNumber?: string;
	programmeName?: string;
	programmeDescription?: string;
	portfolioPublicId?: string;
	projectPublicId?: string;
	programmePublicId?: string;
}) {
	return {
		createError: input.createError ?? null,
		projectNumber: input.projectNumber ?? '',
		name: input.name ?? '',
		description: input.description ?? '',
		invitationError: input.invitationError ?? null,
		invitationProjectPublicId: input.invitationProjectPublicId ?? '',
		hierarchyError: input.hierarchyError ?? null,
		hierarchyAction: input.hierarchyAction ?? '',
		portfolioNumber: input.portfolioNumber ?? '',
		portfolioName: input.portfolioName ?? '',
		portfolioDescription: input.portfolioDescription ?? '',
		programmeNumber: input.programmeNumber ?? '',
		programmeName: input.programmeName ?? '',
		programmeDescription: input.programmeDescription ?? '',
		portfolioPublicId: input.portfolioPublicId ?? '',
		projectPublicId: input.projectPublicId ?? '',
		programmePublicId: input.programmePublicId ?? ''
	};
}

function hierarchyFailure(error: unknown, input: Parameters<typeof formFailure>[0]) {
	if (error instanceof ProjectHierarchyValidationError) {
		return fail(400, formFailure({ ...input, hierarchyError: error.message }));
	}
	if (error instanceof RecordNotFoundError) {
		return fail(404, formFailure({ ...input, hierarchyError: error.message }));
	}
	if (error instanceof TenantAccessError) {
		return fail(403, formFailure({ ...input, hierarchyError: error.message }));
	}
	if (error instanceof ConcurrentUpdateError) {
		return fail(
			409,
			formFailure({
				...input,
				hierarchyError: 'The hierarchy changed concurrently. Reload and try again.'
			})
		);
	}
	throw error;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return {
			canView: false,
			canCreate: false,
			projects: [],
			invitations: [],
			hierarchy: {
				canViewPortfolios: false,
				canManagePortfolios: false,
				canViewProgrammes: false,
				canManageProgrammes: false,
				portfolios: [],
				programmes: []
			}
		};
	}
	const db = getDatabase();
	const [projectAccess, invitations, hierarchy] = await Promise.all([
		new ProjectWorkspaceService(db).listProjects(actor),
		new ProjectTeamService(db).listPendingInvitations(actor),
		new ProjectHierarchyService(db).listHierarchy(actor)
	]);
	return { ...projectAccess, invitations, hierarchy };
};

export const actions: Actions = {
	createPortfolio: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const portfolioNumber = String(data.get('portfolioNumber') ?? '');
		const portfolioName = String(data.get('portfolioName') ?? '');
		const portfolioDescription = String(data.get('portfolioDescription') ?? '');
		const failureInput = {
			hierarchyAction: 'create-portfolio',
			portfolioNumber,
			portfolioName,
			portfolioDescription
		};
		if (!actor) {
			return fail(
				401,
				formFailure({
					...failureInput,
					hierarchyError: 'Authentication and organisation context are required.'
				})
			);
		}
		try {
			await new ProjectHierarchyService(getDatabase()).createPortfolio(actor, {
				portfolioNumber,
				name: portfolioName,
				description: portfolioDescription
			});
		} catch (error) {
			return hierarchyFailure(error, failureInput);
		}
		throw redirect(303, '/projects#project-hierarchy');
	},

	createProgramme: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const programmeNumber = String(data.get('programmeNumber') ?? '');
		const programmeName = String(data.get('programmeName') ?? '');
		const programmeDescription = String(data.get('programmeDescription') ?? '');
		const portfolioPublicId = String(data.get('portfolioPublicId') ?? '');
		const failureInput = {
			hierarchyAction: 'create-programme',
			programmeNumber,
			programmeName,
			programmeDescription,
			portfolioPublicId
		};
		if (!actor) {
			return fail(
				401,
				formFailure({
					...failureInput,
					hierarchyError: 'Authentication and organisation context are required.'
				})
			);
		}
		try {
			await new ProjectHierarchyService(getDatabase()).createProgramme(actor, {
				programmeNumber,
				name: programmeName,
				description: programmeDescription,
				portfolioPublicId
			});
		} catch (error) {
			return hierarchyFailure(error, failureInput);
		}
		throw redirect(303, '/projects#project-hierarchy');
	},

	assignProgramme: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const data = await request.formData();
		const projectPublicId = String(data.get('projectPublicId') ?? '');
		const programmePublicId = String(data.get('programmePublicId') ?? '');
		const failureInput = {
			hierarchyAction: `assign-${projectPublicId}`,
			projectPublicId,
			programmePublicId
		};
		if (!actor) {
			return fail(
				401,
				formFailure({
					...failureInput,
					hierarchyError: 'Authentication and organisation context are required.'
				})
			);
		}
		try {
			await new ProjectHierarchyService(getDatabase()).assignProjectToProgramme(actor, {
				projectPublicId,
				programmePublicId
			});
		} catch (error) {
			return hierarchyFailure(error, failureInput);
		}
		throw redirect(303, '/projects#project-hierarchy');
	},

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
				return fail(
					400,
					formFailure({ createError: error.message, projectNumber, name, description })
				);
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
				return fail(
					404,
					formFailure({
						invitationError: error.message,
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof TenantAccessError) {
				return fail(
					403,
					formFailure({
						invitationError:
							'You do not have permission to respond to project invitations for this organisation.',
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return fail(
					409,
					formFailure({
						invitationError: error.message,
						invitationProjectPublicId: projectPublicId
					})
				);
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
				return fail(
					404,
					formFailure({
						invitationError: error.message,
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof TenantAccessError) {
				return fail(
					403,
					formFailure({
						invitationError:
							'You do not have permission to respond to project invitations for this organisation.',
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return fail(
					409,
					formFailure({
						invitationError: error.message,
						invitationProjectPublicId: projectPublicId
					})
				);
			}
			throw error;
		}
		throw redirect(303, '/projects');
	}
};
