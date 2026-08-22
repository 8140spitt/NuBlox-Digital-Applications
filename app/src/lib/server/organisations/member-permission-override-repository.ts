import type { DatabaseExecutor } from '$lib/server/db/executor';

export type MemberPermissionOverrideEffect = 'allow' | 'deny';

export type MemberPermissionOverrideMember = {
	id: string;
	publicId: string;
	userId: string;
	displayName: string;
	email: string | null;
	status: string;
};

export type MemberPermissionOverridePermission = {
	id: string;
	key: string;
	name: string;
	description: string | null;
};

export type MemberPermissionOverrideSummary = {
	memberPublicId: string;
	memberDisplayName: string;
	permissionKey: string;
	permissionName: string;
	effect: MemberPermissionOverrideEffect;
	reason: string | null;
	updatedAt: Date;
};

export type LockedMemberPermissionOverride = {
	permissionId: string;
	effect: MemberPermissionOverrideEffect;
	reason: string | null;
};

function overrideEffect(value: string): MemberPermissionOverrideEffect {
	if (value === 'allow' || value === 'deny') return value;
	throw new Error(`Unexpected member permission override effect: ${value}`);
}

export class MemberPermissionOverrideRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listMembers(organisationId: string): Promise<MemberPermissionOverrideMember[]> {
		const rows = await this.db
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
				'member.status as status'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.status', 'in', ['active', 'suspended'])
			.orderBy('user.display_name', 'asc')
			.execute();

		return rows;
	}

	async listActivePermissions(): Promise<MemberPermissionOverridePermission[]> {
		return this.db
			.selectFrom('permissions')
			.select(['id', 'permission_key as key', 'name', 'description'])
			.where('is_active', '=', 1)
			.orderBy('permission_key', 'asc')
			.execute();
	}

	async listOverrides(organisationId: string): Promise<MemberPermissionOverrideSummary[]> {
		const rows = await this.db
			.selectFrom('member_permission_overrides as override')
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'override.organisation_member_id')
					.onRef('member.organisation_id', '=', 'override.organisation_id')
			)
			.innerJoin('users as user', 'user.id', 'member.user_id')
			.innerJoin('permissions as permission', 'permission.id', 'override.permission_id')
			.select([
				'member.public_id as memberPublicId',
				'user.display_name as memberDisplayName',
				'permission.permission_key as permissionKey',
				'permission.name as permissionName',
				'override.effect as effect',
				'override.reason as reason',
				'override.updated_at as updatedAt'
			])
			.where('override.organisation_id', '=', organisationId)
			.orderBy('user.display_name', 'asc')
			.orderBy('permission.permission_key', 'asc')
			.execute();

		return rows.map((row) => ({ ...row, effect: overrideEffect(row.effect) }));
	}

	async findMemberForUpdate(
		organisationId: string,
		memberPublicId: string
	): Promise<MemberPermissionOverrideMember | null> {
		const row = await this.db
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
				'member.status as status'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.public_id', '=', memberPublicId)
			.forUpdate()
			.executeTakeFirst();

		return row ?? null;
	}

	async findActivePermission(
		permissionKey: string
	): Promise<MemberPermissionOverridePermission | null> {
		const row = await this.db
			.selectFrom('permissions')
			.select(['id', 'permission_key as key', 'name', 'description'])
			.where('permission_key', '=', permissionKey)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		return row ?? null;
	}

	async findOverrideForUpdate(
		organisationId: string,
		memberId: string,
		permissionId: string
	): Promise<LockedMemberPermissionOverride | null> {
		const row = await this.db
			.selectFrom('member_permission_overrides')
			.select(['permission_id as permissionId', 'effect', 'reason'])
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', memberId)
			.where('permission_id', '=', permissionId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return { ...row, effect: overrideEffect(row.effect) };
	}

	async createOverride(input: {
		organisationId: string;
		memberId: string;
		permissionId: string;
		effect: MemberPermissionOverrideEffect;
		reason: string;
	}): Promise<void> {
		await this.db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: input.organisationId,
				organisation_member_id: input.memberId,
				permission_id: input.permissionId,
				effect: input.effect,
				reason: input.reason
			})
			.executeTakeFirstOrThrow();
	}

	async updateOverride(input: {
		organisationId: string;
		memberId: string;
		permissionId: string;
		effect: MemberPermissionOverrideEffect;
		reason: string;
	}): Promise<void> {
		await this.db
			.updateTable('member_permission_overrides')
			.set({ effect: input.effect, reason: input.reason })
			.where('organisation_id', '=', input.organisationId)
			.where('organisation_member_id', '=', input.memberId)
			.where('permission_id', '=', input.permissionId)
			.executeTakeFirstOrThrow();
	}

	async deleteOverride(
		organisationId: string,
		memberId: string,
		permissionId: string
	): Promise<void> {
		await this.db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', memberId)
			.where('permission_id', '=', permissionId)
			.executeTakeFirstOrThrow();
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
}
