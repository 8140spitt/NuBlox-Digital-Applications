import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OrganisationMemberStatus = 'invited' | 'active' | 'suspended' | 'disabled' | 'left';
export type OrganisationInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export type OrganisationRoleSummary = {
	publicId: string;
	name: string;
	isActive: boolean;
};

export type OrganisationMemberAdmin = {
	id: string;
	publicId: string;
	userId: string;
	displayName: string;
	email: string | null;
	status: OrganisationMemberStatus;
	joinedAt: Date | null;
	disabledAt: Date | null;
	roles: OrganisationRoleSummary[];
};

export type OrganisationInvitationAdmin = {
	id: string;
	publicId: string;
	email: string;
	status: OrganisationInvitationStatus;
	expiresAt: Date;
	acceptedAt: Date | null;
	revokedAt: Date | null;
	createdAt: Date;
	invitedByName: string;
	roles: OrganisationRoleSummary[];
};

export type OrganisationRoleAdmin = {
	id: string;
	publicId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	memberCount: number;
	permissionKeys: string[];
};

export type OrganisationPermissionAdmin = {
	key: string;
	name: string;
	description: string | null;
};

export type LockedMember = {
	id: string;
	publicId: string;
	userId: string;
	status: OrganisationMemberStatus;
	joinedAt: Date | null;
};

export type LockedRole = {
	id: string;
	publicId: string;
	name: string;
	description: string | null;
	isActive: boolean;
};

function memberStatus(value: string): OrganisationMemberStatus {
	if (
		value === 'invited' ||
		value === 'active' ||
		value === 'suspended' ||
		value === 'disabled' ||
		value === 'left'
	) {
		return value;
	}
	throw new Error(`Unexpected organisation member status: ${value}`);
}

function invitationStatus(value: string, expiresAt: Date, now: Date): OrganisationInvitationStatus {
	if (value === 'pending') return expiresAt <= now ? 'expired' : 'pending';
	if (value === 'accepted' || value === 'revoked' || value === 'expired') return value;
	throw new Error(`Unexpected organisation invitation status: ${value}`);
}

export class OrganisationAdminRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listMembers(organisationId: string): Promise<OrganisationMemberAdmin[]> {
		const members = await this.db
			.selectFrom('organisation_members as member')
			.innerJoin('users as user', 'user.id', 'member.user_id')
			.leftJoin('user_emails as email', (join) =>
				join.onRef('email.user_id', '=', 'user.id').on('email.is_primary', '=', 1)
			)
			.select([
				'member.id as id',
				'member.public_id as publicId',
				'member.user_id as userId',
				'user.display_name as displayName',
				'email.email as email',
				'member.status as status',
				'member.joined_at as joinedAt',
				'member.disabled_at as disabledAt'
			])
			.where('member.organisation_id', '=', organisationId)
			.orderBy('user.display_name', 'asc')
			.orderBy('member.id', 'asc')
			.execute();

		const assignments = await this.db
			.selectFrom('member_roles as assignment')
			.innerJoin('organisation_roles as role', (join) =>
				join
					.onRef('role.id', '=', 'assignment.organisation_role_id')
					.onRef('role.organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.organisation_member_id as memberId',
				'role.public_id as rolePublicId',
				'role.name as roleName',
				'role.is_active as roleIsActive'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.orderBy('role.name', 'asc')
			.execute();

		const rolesByMember = new Map<string, OrganisationRoleSummary[]>();
		for (const assignment of assignments) {
			const roles = rolesByMember.get(assignment.memberId) ?? [];
			roles.push({
				publicId: assignment.rolePublicId,
				name: assignment.roleName,
				isActive: Boolean(assignment.roleIsActive)
			});
			rolesByMember.set(assignment.memberId, roles);
		}

		return members.map((member) => ({
			id: member.id,
			publicId: member.publicId,
			userId: member.userId,
			displayName: member.displayName,
			email: member.email,
			status: memberStatus(member.status),
			joinedAt: member.joinedAt,
			disabledAt: member.disabledAt,
			roles: rolesByMember.get(member.id) ?? []
		}));
	}

	async listInvitations(
		organisationId: string,
		now = new Date()
	): Promise<OrganisationInvitationAdmin[]> {
		const invitations = await this.db
			.selectFrom('organisation_invitations as invitation')
			.innerJoin('organisation_members as inviter_member', (join) =>
				join
					.onRef('inviter_member.id', '=', 'invitation.invited_by_member_id')
					.onRef('inviter_member.organisation_id', '=', 'invitation.organisation_id')
			)
			.innerJoin('users as inviter', 'inviter.id', 'inviter_member.user_id')
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.email as email',
				'invitation.status as status',
				'invitation.expires_at as expiresAt',
				'invitation.accepted_at as acceptedAt',
				'invitation.revoked_at as revokedAt',
				'invitation.created_at as createdAt',
				'inviter.display_name as invitedByName'
			])
			.where('invitation.organisation_id', '=', organisationId)
			.orderBy('invitation.created_at', 'desc')
			.limit(100)
			.execute();

		const invitationIds = invitations.map((invitation) => invitation.id);
		const rolesByInvitation = new Map<string, OrganisationRoleSummary[]>();
		if (invitationIds.length > 0) {
			const assignments = await this.db
				.selectFrom('organisation_invitation_roles as assignment')
				.innerJoin('organisation_roles as role', (join) =>
					join
						.onRef('role.id', '=', 'assignment.organisation_role_id')
						.onRef('role.organisation_id', '=', 'assignment.organisation_id')
				)
				.select([
					'assignment.organisation_invitation_id as invitationId',
					'role.public_id as rolePublicId',
					'role.name as roleName',
					'role.is_active as roleIsActive'
				])
				.where('assignment.organisation_id', '=', organisationId)
				.where('assignment.organisation_invitation_id', 'in', invitationIds)
				.orderBy('role.name', 'asc')
				.execute();

			for (const assignment of assignments) {
				const roles = rolesByInvitation.get(assignment.invitationId) ?? [];
				roles.push({
					publicId: assignment.rolePublicId,
					name: assignment.roleName,
					isActive: Boolean(assignment.roleIsActive)
				});
				rolesByInvitation.set(assignment.invitationId, roles);
			}
		}

		return invitations.map((invitation) => ({
			id: invitation.id,
			publicId: invitation.publicId,
			email: invitation.email,
			status: invitationStatus(invitation.status, invitation.expiresAt, now),
			expiresAt: invitation.expiresAt,
			acceptedAt: invitation.acceptedAt,
			revokedAt: invitation.revokedAt,
			createdAt: invitation.createdAt,
			invitedByName: invitation.invitedByName,
			roles: rolesByInvitation.get(invitation.id) ?? []
		}));
	}

	async listRoles(organisationId: string): Promise<OrganisationRoleAdmin[]> {
		const roles = await this.db
			.selectFrom('organisation_roles')
			.select(['id', 'public_id', 'name', 'description', 'is_active'])
			.where('organisation_id', '=', organisationId)
			.orderBy('name', 'asc')
			.execute();

		const memberAssignments = await this.db
			.selectFrom('member_roles')
			.select(['organisation_role_id as roleId', 'organisation_member_id as memberId'])
			.where('organisation_id', '=', organisationId)
			.execute();
		const memberIdsByRole = new Map<string, Set<string>>();
		for (const assignment of memberAssignments) {
			const members = memberIdsByRole.get(assignment.roleId) ?? new Set<string>();
			members.add(assignment.memberId);
			memberIdsByRole.set(assignment.roleId, members);
		}

		const grants = await this.db
			.selectFrom('role_permissions as grant')
			.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
			.select([
				'grant.organisation_role_id as roleId',
				'permission.permission_key as permissionKey'
			])
			.where('grant.organisation_id', '=', organisationId)
			.orderBy('permission.permission_key', 'asc')
			.execute();
		const permissionsByRole = new Map<string, string[]>();
		for (const grant of grants) {
			const permissionKeys = permissionsByRole.get(grant.roleId) ?? [];
			permissionKeys.push(grant.permissionKey);
			permissionsByRole.set(grant.roleId, permissionKeys);
		}

		return roles.map((role) => ({
			id: role.id,
			publicId: role.public_id,
			name: role.name,
			description: role.description,
			isActive: Boolean(role.is_active),
			memberCount: memberIdsByRole.get(role.id)?.size ?? 0,
			permissionKeys: permissionsByRole.get(role.id) ?? []
		}));
	}

	async listActivePermissions(): Promise<OrganisationPermissionAdmin[]> {
		const rows = await this.db
			.selectFrom('permissions')
			.select(['permission_key', 'name', 'description'])
			.where('is_active', '=', 1)
			.orderBy('permission_key', 'asc')
			.execute();

		return rows.map((row) => ({
			key: row.permission_key,
			name: row.name,
			description: row.description
		}));
	}

	async findMemberForUpdate(
		organisationId: string,
		memberPublicId: string
	): Promise<LockedMember | null> {
		const row = await this.db
			.selectFrom('organisation_members')
			.select(['id', 'public_id', 'user_id', 'status', 'joined_at'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', memberPublicId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.public_id,
			userId: row.user_id,
			status: memberStatus(row.status),
			joinedAt: row.joined_at
		};
	}

	async listActiveMembersForPermissionCheck(
		organisationId: string
	): Promise<Array<{ id: string; userId: string }>> {
		return this.db
			.selectFrom('organisation_members')
			.select(['id', 'user_id as userId'])
			.where('organisation_id', '=', organisationId)
			.where('status', '=', 'active')
			.execute();
	}

	async updateMemberStatus(
		organisationId: string,
		memberId: string,
		currentStatus: OrganisationMemberStatus,
		nextStatus: OrganisationMemberStatus,
		joinedAt: Date | null,
		now = new Date()
	): Promise<boolean> {
		const result = await this.db
			.updateTable('organisation_members')
			.set({
				status: nextStatus,
				joined_at: nextStatus === 'active' ? (joinedAt ?? now) : joinedAt,
				disabled_at: nextStatus === 'active' || nextStatus === 'invited' ? null : now
			})
			.where('organisation_id', '=', organisationId)
			.where('id', '=', memberId)
			.where('status', '=', currentStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async findActiveRoleIdsByPublicIds(
		organisationId: string,
		rolePublicIds: readonly string[]
	): Promise<string[]> {
		if (rolePublicIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('organisation_roles')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('public_id', 'in', [...rolePublicIds])
			.where('is_active', '=', 1)
			.execute();
		return rows.map((row) => row.id);
	}

	async replaceMemberRoles(
		organisationId: string,
		memberId: string,
		roleIds: readonly string[]
	): Promise<void> {
		await this.db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', memberId)
			.execute();
		if (roleIds.length === 0) return;
		await this.db
			.insertInto('member_roles')
			.values(
				roleIds.map((roleId) => ({
					organisation_id: organisationId,
					organisation_member_id: memberId,
					organisation_role_id: roleId
				}))
			)
			.execute();
	}

	async findRoleForUpdate(
		organisationId: string,
		rolePublicId: string
	): Promise<LockedRole | null> {
		const row = await this.db
			.selectFrom('organisation_roles')
			.select(['id', 'public_id', 'name', 'description', 'is_active'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', rolePublicId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.public_id,
			name: row.name,
			description: row.description,
			isActive: Boolean(row.is_active)
		};
	}

	async createRole(input: {
		organisationId: string;
		publicId: string;
		name: string;
		description: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('organisation_roles')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				name: input.name,
				description: input.description,
				is_active: 1
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('Role insert did not return an ID.');
		return result.insertId.toString();
	}

	async updateRole(input: {
		organisationId: string;
		roleId: string;
		name: string;
		description: string | null;
		isActive: boolean;
	}): Promise<void> {
		await this.db
			.updateTable('organisation_roles')
			.set({
				name: input.name,
				description: input.description,
				is_active: input.isActive ? 1 : 0
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.roleId)
			.executeTakeFirstOrThrow();
	}

	async findActivePermissionIdsByKeys(permissionKeys: readonly string[]): Promise<string[]> {
		if (permissionKeys.length === 0) return [];
		const rows = await this.db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', 'in', [...permissionKeys])
			.where('is_active', '=', 1)
			.execute();
		return rows.map((row) => row.id);
	}

	async replaceRolePermissions(
		organisationId: string,
		roleId: string,
		permissionIds: readonly string[]
	): Promise<void> {
		await this.db
			.deleteFrom('role_permissions')
			.where('organisation_id', '=', organisationId)
			.where('organisation_role_id', '=', roleId)
			.execute();
		if (permissionIds.length === 0) return;
		await this.db
			.insertInto('role_permissions')
			.values(
				permissionIds.map((permissionId) => ({
					organisation_id: organisationId,
					organisation_role_id: roleId,
					permission_id: permissionId
				}))
			)
			.execute();
	}

	async findInvitationForUpdate(
		organisationId: string,
		invitationPublicId: string
	): Promise<{
		id: string;
		publicId: string;
		email: string;
		status: OrganisationInvitationStatus;
		expiresAt: Date;
		rolePublicIds: string[];
	} | null> {
		const row = await this.db
			.selectFrom('organisation_invitations')
			.select(['id', 'public_id', 'email', 'status', 'expires_at'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', invitationPublicId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;

		const roleRows = await this.db
			.selectFrom('organisation_invitation_roles as assignment')
			.innerJoin('organisation_roles as role', (join) =>
				join
					.onRef('role.id', '=', 'assignment.organisation_role_id')
					.onRef('role.organisation_id', '=', 'assignment.organisation_id')
			)
			.select('role.public_id as publicId')
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.organisation_invitation_id', '=', row.id)
			.where('role.is_active', '=', 1)
			.execute();

		return {
			id: row.id,
			publicId: row.public_id,
			email: row.email,
			status: invitationStatus(row.status, row.expires_at, new Date()),
			expiresAt: row.expires_at,
			rolePublicIds: roleRows.map((role) => role.publicId)
		};
	}

	async revokeInvitation(
		organisationId: string,
		invitationId: string,
		revokedAt = new Date()
	): Promise<boolean> {
		const result = await this.db
			.updateTable('organisation_invitations')
			.set({ status: 'revoked', revoked_at: revokedAt })
			.where('organisation_id', '=', organisationId)
			.where('id', '=', invitationId)
			.where('status', '=', 'pending')
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}
}
