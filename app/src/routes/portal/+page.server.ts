import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { SUPPLIER_RFQ_SIGNUP_COOKIE } from '$lib/server/auth/supplier-rfq-cookie';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
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
import { ProjectExternalCollaborationService } from '$lib/server/projects/project-external-collaboration-service';
import {
	ProjectTeamService,
	ProjectTeamValidationError
} from '$lib/server/projects/project-team-service';
import {
	SupplierRfqPortalAccessError,
	SupplierRfqPortalService,
	SupplierRfqPortalValidationError
} from '$lib/server/procurement/supplier-rfq-portal-service';

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

function actionFailure(status: number, action: string, subjectPublicId: string, message: string) {
	return fail(status, { action, subjectPublicId, message });
}

function supplierQuoteLines(data: FormData) {
	const lines: Array<{
		itemId: string;
		offeredQuantity: string;
		unitRate: string;
		leadTimeDays: string;
		qualificationNote: string;
	}> = [];
	for (const [name, value] of data.entries()) {
		if (!name.startsWith('offeredQuantity:') || typeof value !== 'string') continue;
		const itemId = name.slice('offeredQuantity:'.length);
		if (!itemId) continue;
		lines.push({
			itemId,
			offeredQuantity: value,
			unitRate: field(data, `unitRate:${itemId}`),
			leadTimeDays: field(data, `leadTimeDays:${itemId}`),
			qualificationNote: field(data, `qualificationNote:${itemId}`)
		});
	}
	return lines;
}

export const load: PageServerLoad = async ({ locals, cookies }) => {
	if (!locals.actor) throw redirect(303, '/signin?returnTo=%2Fportal');
	cookies.delete(SUPPLIER_RFQ_SIGNUP_COOKIE, { path: '/' });
	const db = getDatabase();
	const supplierQuotes = await new SupplierRfqPortalService(db).listPortalQuotes(locals.actor.email);
	const actor = actorFromLocals(locals);
	if (!actor) {
		const externalProjects = await new ProjectExternalCollaborationService(
			db
		).listExternalPortalProjects(locals.actor.authUserId);
		return {
			mode: 'external' as const,
			canView: true,
			canRespond: false,
			canManage: false,
			projects: [],
			rfis: [],
			submittals: [],
			instructions: [],
			transmittals: [],
			invitations: [],
			externalProjects,
			supplierQuotes
		};
	}

	const invitationDecision = await new PermissionService(db).decideWithUmbrella(
		actor,
		'project.participation.manage',
		'project.manage'
	);
	const [workspace, invitations] = await Promise.all([
		new PortalCollaborationService(db).getWorkspace(actor),
		invitationDecision.allowed
			? new ProjectTeamService(db).listPendingInvitations(actor)
			: Promise.resolve([])
	]);
	return {
		mode: 'member' as const,
		...workspace,
		invitations,
		externalProjects: [],
		supplierQuotes
	};
};

export const actions: Actions = {
	submitSupplierQuote: async ({ request, locals }) => {
		if (!locals.actor) return actionFailure(401, 'supplierQuote', '', 'Authentication is required.');
		const data = await request.formData();
		try {
			await new SupplierRfqPortalService(getDatabase()).submitQuote(locals.actor, {
				quoteRef: field(data, 'quoteRef'),
				supplierReference: field(data, 'supplierReference'),
				validUntil: field(data, 'validUntil'),
				lines: supplierQuoteLines(data)
			});
		} catch (error) {
			if (error instanceof SupplierRfqPortalAccessError) {
				return actionFailure(403, 'supplierQuote', '', error.message);
			}
			if (error instanceof SupplierRfqPortalValidationError) {
				return actionFailure(400, 'supplierQuote', '', error.message);
			}
			if (error instanceof ConcurrentUpdateError) {
				return actionFailure(409, 'supplierQuote', '', 'The quotation changed while it was being submitted. Refresh and try again.');
			}
			throw error;
		}
		throw redirect(303, '/portal');
	},

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
