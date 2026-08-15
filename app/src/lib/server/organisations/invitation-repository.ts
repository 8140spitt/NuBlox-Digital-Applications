import type { DatabaseExecutor } from '$lib/server/db/executor';

export type PendingOrganisationInvitation = {
	id: string;
	publicId: string;
	organisationId: string;
	organisationPublicId: string;
	organisationName: string;
	email: string;
	invitedByMemberId: string;
	authUserId: string | null;
	expiresAt: Date;
};

export class OrganisationInvitationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async findPendingByTokenHash(
		tokenHash: string,
		now = new Date(),
		lock = false
	): Promise<PendingOrganisationInvitation | null> {
		const query = this.db
			.selectFrom('organisation_invitations as invitation')
			.innerJoin('organisations as organisation', 'organisation.id', 'invitation.organisation_id')
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.organisation_id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.legal_name as organisationName',
				'invitation.email as email',
				'invitation.invited_by_member_id as invitedByMemberId',
				'invitation.auth_user_id as authUserId',
				'invitation.expires_at as expiresAt'
			])
			.where('invitation.token_hash', '=', tokenHash)
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', now)
			.where('organisation.status', '=', 'active');

		return (await (lock ? query.forUpdate() : query).executeTakeFirst()) ?? null;
	}

	async findPendingByAuthUser(
		authUserId: string,
		email: string,
		now = new Date(),
		lock = false
	): Promise<PendingOrganisationInvitation | null> {
		const query = this.db
			.selectFrom('organisation_invitations as invitation')
			.innerJoin('organisations as organisation', 'organisation.id', 'invitation.organisation_id')
			.select([
				'invitation.id as id',
				'invitation.public_id as publicId',
				'invitation.organisation_id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.legal_name as organisationName',
				'invitation.email as email',
				'invitation.invited_by_member_id as invitedByMemberId',
				'invitation.auth_user_id as authUserId',
				'invitation.expires_at as expiresAt'
			])
			.where('invitation.auth_user_id', '=', authUserId)
			.where('invitation.email', '=', email)
			.where('invitation.status', '=', 'pending')
			.where('invitation.expires_at', '>', now)
			.where('organisation.status', '=', 'active')
			.orderBy('invitation.created_at', 'asc');

		return (await (lock ? query.forUpdate() : query).executeTakeFirst()) ?? null;
	}

	async listRoleIds(invitationId: string, organisationId: string): Promise<string[]> {
		const rows = await this.db
			.selectFrom('organisation_invitation_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_invitation_id', '=', invitationId)
			.execute();

		return rows.map((row) => row.organisation_role_id);
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

	async hasActiveMemberByEmail(organisationId: string, email: string): Promise<boolean> {
		const row = await this.db
			.selectFrom('user_emails as email')
			.innerJoin('users as user', 'user.id', 'email.user_id')
			.innerJoin('organisation_members as member', 'member.user_id', 'user.id')
			.select('member.id')
			.where('email.email', '=', email)
			.where('member.organisation_id', '=', organisationId)
			.where('member.status', '=', 'active')
			.where('user.status', '=', 'active')
			.executeTakeFirst();
		return Boolean(row);
	}

	async revokePendingForEmail(
		organisationId: string,
		email: string,
		revokedAt = new Date()
	): Promise<void> {
		await this.db
			.updateTable('organisation_invitations')
			.set({ status: 'revoked', revoked_at: revokedAt })
			.where('organisation_id', '=', organisationId)
			.where('email', '=', email)
			.where('status', '=', 'pending')
			.execute();
	}

	async insertInvitation(input: {
		publicId: string;
		organisationId: string;
		email: string;
		tokenHash: string;
		invitedByMemberId: string;
		expiresAt: Date;
	}): Promise<string> {
		const result = await this.db
			.insertInto('organisation_invitations')
			.values({
				public_id: input.publicId,
				organisation_id: input.organisationId,
				email: input.email,
				token_hash: input.tokenHash,
				status: 'pending',
				invited_by_member_id: input.invitedByMemberId,
				expires_at: input.expiresAt
			})
			.executeTakeFirstOrThrow();

		if (result.insertId === undefined) throw new Error('Invitation insert did not return an ID.');
		return result.insertId.toString();
	}

	async insertRoles(
		organisationId: string,
		invitationId: string,
		roleIds: readonly string[]
	): Promise<void> {
		if (roleIds.length === 0) return;
		await this.db
			.insertInto('organisation_invitation_roles')
			.values(
				roleIds.map((roleId) => ({
					organisation_id: organisationId,
					organisation_invitation_id: invitationId,
					organisation_role_id: roleId
				}))
			)
			.execute();
	}

	async bindAuthUser(invitationId: string, authUserId: string): Promise<void> {
		await this.db
			.updateTable('organisation_invitations')
			.set({ auth_user_id: authUserId })
			.where('id', '=', invitationId)
			.where('status', '=', 'pending')
			.executeTakeFirstOrThrow();
	}
}
