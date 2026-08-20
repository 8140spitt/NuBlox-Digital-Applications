import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { ConcurrentUpdateError, RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	PortalCollaborationService,
	PortalCollaborationValidationError
} from '$lib/server/portal/portal-collaboration-service';
import {
	ProjectTeamService,
	ProjectTeamValidationError
} from '$lib/server/projects/project-team-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function field(data: FormData, name: string): string {
	const value = data.get(name);
	return typeof value === 'string' ? value : '';
}

function actionFailure(
	status: number,
	action: string,
	subjectPublicId: string,
	message: string
) {
	return fail(status, { action, subjectPublicId, message });
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin?returnTo=%2Fportal');
	const db = getDatabase();
	const [workspace, invitations] = await Promise.all([
		new PortalCollaborationService(db).getWorkspace(actor),
		new ProjectTeamService(db).listPendingInvitations(actor)
	]);
	return { ...workspace, invitations };
};

export const actions: Actions = {
	acceptInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return actionFailure(401, 'invitation', '', 'Authentication is required.');
		const data = await request.formData();
		const projectPublicId = field(data, 'projectPublicId');
		try {
			await new ProjectTeamService(getDatabase()).respondToInvitation(actor, {
				projectPublicId,
				response: 'accept'
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return actionFailure(404, 'invitation', projectPublicId, error.message);
			}
			if (error instanceof TenantAccessError) {
				return actionFailure(403, 'invitation', projectPublicId, error.message);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return actionFailure(409, 'invitation', projectPublicId, error.message);
			}
			throw error;
		}
		throw redirect(303, '/portal');
	},

	declineInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return actionFailure(401, 'invitation', '', 'Authentication is required.');
		const data = await request.formData();
		const projectPublicId = field(data, 'projectPublicId');
		try {
			await new ProjectTeamService(getDatabase()).respondToInvitation(actor, {
				projectPublicId,
				response: 'decline'
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return actionFailure(404, 'invitation', projectPublicId, error.message);
			}
			if (error instanceof TenantAccessError) {
				return actionFailure(403, 'invitation', projectPublicId, error.message);
			}
			if (error instanceof ProjectTeamValidationError || error instanceof ConcurrentUpdateError) {
				return actionFailure(409, 'invitation', projectPublicId, error.message);
			}
			throw error;
		}
		throw redirect(303, '/portal');
	},

	respondRfi: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return actionFailure(401, 'rfi', '', 'Authentication is required.');
		const data = await request.formData();
		const rfiPublicId = field(data, 'rfiPublicId');
		try {
			await new PortalCollaborationService(getDatabase()).respondToRfi(actor, {
				rfiPublicId,
				responseText: field(data, 'responseText'),
				final: data.get('final') === 'on'
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return actionFailure(404, 'rfi', rfiPublicId, error.message);
			}
			if (error instanceof TenantAccessError) {
				return actionFailure(403, 'rfi', rfiPublicId, error.message);
			}
			if (
				error instanceof PortalCollaborationValidationError ||
				error instanceof ConcurrentUpdateError
			) {
				return actionFailure(409, 'rfi', rfiPublicId, error.message);
			}
			throw error;
		}
		throw redirect(303, '/portal');
	},

	reviewSubmittal: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return actionFailure(401, 'submittal', '', 'Authentication is required.');
		const data = await request.formData();
		const submittalPublicId = field(data, 'submittalPublicId');
		try {
			await new PortalCollaborationService(getDatabase()).reviewSubmittal(actor, {
				submittalPublicId,
				outcome: field(data, 'outcome'),
				comments: field(data, 'comments')
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return actionFailure(404, 'submittal', submittalPublicId, error.message);
			}
			if (error instanceof TenantAccessError) {
				return actionFailure(403, 'submittal', submittalPublicId, error.message);
			}
			if (
				error instanceof PortalCollaborationValidationError ||
				error instanceof ConcurrentUpdateError
			) {
				return actionFailure(409, 'submittal', submittalPublicId, error.message);
			}
			throw error;
		}
		throw redirect(303, '/portal');
	},

	acknowledgeInstruction: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return actionFailure(401, 'instruction', '', 'Authentication is required.');
		const data = await request.formData();
		const instructionPublicId = field(data, 'instructionPublicId');
		try {
			await new PortalCollaborationService(getDatabase()).acknowledgeInstruction(
				actor,
				instructionPublicId
			);
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return actionFailure(404, 'instruction', instructionPublicId, error.message);
			}
			if (error instanceof TenantAccessError) {
				return actionFailure(403, 'instruction', instructionPublicId, error.message);
			}
			if (
				error instanceof PortalCollaborationValidationError ||
				error instanceof ConcurrentUpdateError
			) {
				return actionFailure(409, 'instruction', instructionPublicId, error.message);
			}
			throw error;
		}
		throw redirect(303, '/portal');
	}
};
