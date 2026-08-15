import { error, json, type RequestHandler } from '@sveltejs/kit';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import {
	InvitationAccessError,
	InvitationRoleError,
	OrganisationInvitationService
} from '$lib/server/organisations/invitation-service';

type CreateInvitationBody = {
	email?: unknown;
	rolePublicIds?: unknown;
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.actor) throw error(401, 'Authentication required.');
	if (
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.memberId
	) {
		throw error(400, 'Select an active organisation before inviting a member.');
	}

	const actor = {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};

	const permission = await new PermissionService(getDatabase()).decide(actor, 'member.invite');
	if (!permission.allowed) throw error(403, 'You do not have permission to invite members.');

	const body = (await request.json()) as CreateInvitationBody;
	if (typeof body.email !== 'string') throw error(400, 'A valid email address is required.');
	if (
		body.rolePublicIds !== undefined &&
		(!Array.isArray(body.rolePublicIds) || body.rolePublicIds.some((value) => typeof value !== 'string'))
	) {
		throw error(400, 'rolePublicIds must be an array of role public IDs.');
	}

	const rolePublicIds = (body.rolePublicIds ?? []) as string[];
	if (rolePublicIds.length > 20) throw error(400, 'Too many roles were supplied.');

	try {
		const invitation = await new OrganisationInvitationService(getDatabase()).createInvitation({
			actor,
			email: body.email,
			rolePublicIds
		});
		return json(invitation, { status: 201 });
	} catch (cause) {
		if (cause instanceof InvitationAccessError || cause instanceof InvitationRoleError) {
			throw error(400, cause.message);
		}
		throw cause;
	}
};
