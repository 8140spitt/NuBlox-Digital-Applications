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
	PortalCollaborationService,
	PortalCollaborationValidationError
} from '$lib/server/portal/portal-collaboration-service';

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

function actionFailure(status: number, action: string, message: string, projectPublicId: string) {
	return fail(status, { action, message, projectPublicId });
}

function redirectToProject(projectPublicId: string): never {
	throw redirect(303, `/portal/manage?project=${encodeURIComponent(projectPublicId)}`);
}

async function runAction(
	locals: App.Locals,
	request: Request,
	action: string,
	run: (
		service: PortalCollaborationService,
		actor: TenantActorContext,
		data: FormData
	) => Promise<void>
) {
	const actor = actorFromLocals(locals);
	const data = await request.formData();
	const projectPublicId = field(data, 'projectPublicId');
	if (!actor) return actionFailure(401, action, 'Authentication is required.', projectPublicId);
	try {
		await run(new PortalCollaborationService(getDatabase()), actor, data);
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			return actionFailure(404, action, error.message, projectPublicId);
		}
		if (error instanceof TenantAccessError) {
			return actionFailure(403, action, error.message, projectPublicId);
		}
		if (
			error instanceof PortalCollaborationValidationError ||
			error instanceof ConcurrentUpdateError
		) {
			return actionFailure(409, action, error.message, projectPublicId);
		}
		throw error;
	}
	redirectToProject(projectPublicId);
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw redirect(303, '/signin?returnTo=%2Fportal%2Fmanage');
	return new PortalCollaborationService(getDatabase()).getManagementWorkspace(
		actor,
		url.searchParams.get('project')
	);
};

export const actions: Actions = {
	assignRfi: ({ request, locals }) =>
		runAction(locals, request, 'rfi', (service, actor, data) =>
			service.assignRfiAddressee(actor, {
				projectPublicId: field(data, 'projectPublicId'),
				rfiPublicId: field(data, 'rfiPublicId'),
				organisationPublicId: field(data, 'organisationPublicId')
			})
		),

	assignSubmittal: ({ request, locals }) =>
		runAction(locals, request, 'submittal', (service, actor, data) =>
			service.assignSubmittalReviewer(actor, {
				projectPublicId: field(data, 'projectPublicId'),
				submittalPublicId: field(data, 'submittalPublicId'),
				organisationPublicId: field(data, 'organisationPublicId'),
				dueAt: field(data, 'dueAt')
			})
		),

	assignInstruction: ({ request, locals }) =>
		runAction(locals, request, 'instruction', (service, actor, data) =>
			service.assignInstructionRecipient(actor, {
				projectPublicId: field(data, 'projectPublicId'),
				instructionPublicId: field(data, 'instructionPublicId'),
				organisationPublicId: field(data, 'organisationPublicId')
			})
		),

	issueTransmittal: ({ request, locals }) =>
		runAction(locals, request, 'transmittal', async (service, actor, data) => {
			await service.issueTransmittal(actor, {
				projectPublicId: field(data, 'projectPublicId'),
				organisationPublicId: field(data, 'organisationPublicId'),
				versionPublicId: field(data, 'versionPublicId'),
				transmittalNumber: field(data, 'transmittalNumber'),
				subject: field(data, 'subject'),
				purpose: field(data, 'purpose')
			});
		})
};
