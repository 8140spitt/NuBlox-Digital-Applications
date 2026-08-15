import { error, fail, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import {
	InvitationAccessError,
	InvitationRoleError,
	OrganisationInvitationService
} from '$lib/server/organisations/invitation-service';
import {
	LastOrganisationManagerError,
	OrganisationAdminNotFoundError,
	OrganisationAdminService,
	OrganisationAdminValidationError
} from '$lib/server/organisations/organisation-admin-service';
import type { OrganisationMemberStatus } from '$lib/server/organisations/organisation-admin-repository';

const MEMBER_STATUSES = new Set<OrganisationMemberStatus>([
	'invited',
	'active',
	'suspended',
	'disabled',
	'left'
]);

type LocalsLike = {
	actor: { userId: string } | null;
	tenant: { membershipVerified: boolean; organisationId: string | null; memberId: string | null };
	correlationId: string;
};

function actorFromLocals(locals: LocalsLike): TenantActorContext {
	if (
		!locals.actor ||
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.memberId
	) {
		throw error(401, 'An active organisation membership is required.');
	}
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

async function administrationPermissions(actor: TenantActorContext) {
	const service = new PermissionService(getDatabase());
	const [organisation, invite, member] = await Promise.all([
		service.decide(actor, 'organisation.manage'),
		service.decide(actor, 'member.invite'),
		service.decide(actor, 'member.manage')
	]);
	return {
		canManageOrganisation: organisation.allowed,
		canInvite: organisation.allowed || invite.allowed,
		canManageMembers: organisation.allowed || member.allowed
	};
}

function stringField(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

function stringList(formData: FormData, name: string): string[] {
	return formData
		.getAll(name)
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter(Boolean);
}

function actionFailure(cause: unknown) {
	if (cause instanceof OrganisationAdminNotFoundError) {
		return fail(404, { adminError: cause.message });
	}
	if (
		cause instanceof OrganisationAdminValidationError ||
		cause instanceof LastOrganisationManagerError ||
		cause instanceof InvitationAccessError ||
		cause instanceof InvitationRoleError
	) {
		return fail(400, { adminError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	const permissions = await administrationPermissions(actor);
	if (!permissions.canManageOrganisation && !permissions.canInvite && !permissions.canManageMembers) {
		throw error(403, 'You do not have organisation administration access.');
	}

	const data = await new OrganisationAdminService(getDatabase()).load(actor);
	return {
		...permissions,
		members: permissions.canManageMembers ? data.members : [],
		invitations: permissions.canInvite ? data.invitations : [],
		roles:
			permissions.canManageMembers || permissions.canManageOrganisation
				? data.roles
				: data.roles.map(({ id: _id, permissionKeys: _permissionKeys, ...role }) => ({
						...role,
						permissionKeys: [] as string[]
					})),
		permissions: permissions.canManageOrganisation ? data.permissions : []
	};
};

export const actions: Actions = {
	invite: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const permissions = await administrationPermissions(actor);
		if (!permissions.canInvite) return fail(403, { adminError: 'You cannot invite members.' });

		const formData = await request.formData();
		const email = stringField(formData, 'email');
		const rolePublicIds = stringList(formData, 'rolePublicId');
		if (rolePublicIds.length > 0 && !permissions.canManageMembers) {
			return fail(403, { adminError: 'Member-management permission is required to assign roles.' });
		}
		try {
			await new OrganisationInvitationService(getDatabase()).createInvitation({
				actor,
				email,
				rolePublicIds
			});
			return { adminSuccess: `Invitation created for ${email.trim().toLowerCase()}.` };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	revokeInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!(await administrationPermissions(actor)).canInvite) {
			return fail(403, { adminError: 'You cannot revoke invitations.' });
		}
		const invitationPublicId = stringField(await request.formData(), 'invitationPublicId');
		if (!invitationPublicId) return fail(400, { adminError: 'Invitation is required.' });
		try {
			await new OrganisationAdminService(getDatabase()).revokeInvitation(actor, invitationPublicId);
			return { adminSuccess: 'Invitation revoked.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	resendInvitation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const permissions = await administrationPermissions(actor);
		if (!permissions.canInvite || !permissions.canManageMembers) {
			return fail(403, {
				adminError: 'Invite and member-management permission are required to resend an invitation with its roles.'
			});
		}
		const invitationPublicId = stringField(await request.formData(), 'invitationPublicId');
		if (!invitationPublicId) return fail(400, { adminError: 'Invitation is required.' });
		try {
			await new OrganisationAdminService(getDatabase()).resendInvitation(actor, invitationPublicId);
			return { adminSuccess: 'A replacement invitation was sent.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	setMemberStatus: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!(await administrationPermissions(actor)).canManageMembers) {
			return fail(403, { adminError: 'You cannot manage member status.' });
		}
		const formData = await request.formData();
		const memberPublicId = stringField(formData, 'memberPublicId');
		const status = stringField(formData, 'status') as OrganisationMemberStatus;
		if (!memberPublicId || !MEMBER_STATUSES.has(status)) {
			return fail(400, { adminError: 'A valid member and membership status are required.' });
		}
		try {
			await new OrganisationAdminService(getDatabase()).setMemberStatus(actor, memberPublicId, status);
			return { adminSuccess: 'Member status updated.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	setMemberRoles: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!(await administrationPermissions(actor)).canManageMembers) {
			return fail(403, { adminError: 'You cannot manage member roles.' });
		}
		const formData = await request.formData();
		const memberPublicId = stringField(formData, 'memberPublicId');
		if (!memberPublicId) return fail(400, { adminError: 'Member is required.' });
		try {
			await new OrganisationAdminService(getDatabase()).replaceMemberRoles(
				actor,
				memberPublicId,
				stringList(formData, 'rolePublicId')
			);
			return { adminSuccess: 'Member roles updated.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	createRole: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!(await administrationPermissions(actor)).canManageOrganisation) {
			return fail(403, { adminError: 'You cannot create organisation roles.' });
		}
		const formData = await request.formData();
		try {
			await new OrganisationAdminService(getDatabase()).createRole(actor, {
				name: stringField(formData, 'name'),
				description: stringField(formData, 'description'),
				permissionKeys: stringList(formData, 'permissionKey')
			});
			return { adminSuccess: 'Organisation role created.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	},

	updateRole: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!(await administrationPermissions(actor)).canManageOrganisation) {
			return fail(403, { adminError: 'You cannot update organisation roles.' });
		}
		const formData = await request.formData();
		const rolePublicId = stringField(formData, 'rolePublicId');
		if (!rolePublicId) return fail(400, { adminError: 'Role is required.' });
		try {
			await new OrganisationAdminService(getDatabase()).updateRole(actor, {
				rolePublicId,
				name: stringField(formData, 'name'),
				description: stringField(formData, 'description'),
				isActive: formData.has('isActive'),
				permissionKeys: stringList(formData, 'permissionKey')
			});
			return { adminSuccess: 'Organisation role updated.' };
		} catch (cause) {
			return actionFailure(cause);
		}
	}
};
