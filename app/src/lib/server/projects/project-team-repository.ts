import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProjectParticipationStatus =
	| 'invited'
	| 'active'
	| 'suspended'
	| 'left'
	| 'removed'
	| 'declined';

export type ProjectRoleTypeSummary = {
	id: string;
	roleKey: string;
	name: string;
	description: string | null;
};

export type ProjectParticipantAdmin = {
	organisationId: string;
	organisationPublicId: string;
	organisationName: string;
	status: ProjectParticipationStatus;
	joinedAt: Date | null;
	leftAt: Date | null;
	roles: ProjectRoleTypeSummary[];
};

export type ProjectInvitationSummary = {
	projectId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	projectStatus: string;
	owningOrganisationId: string;
	owningOrganisationPublicId: string;
	owningOrganisationName: string;
	invitedAt: Date;
	roles: ProjectRoleTypeSummary[];
};

export type OrganisationMemberProjectCandidate = {
	id: string;
	publicId: string;
	userId: string;
	displayName: string;
	email: string | null;
};

export type ProjectMemberAdmin = OrganisationMemberProjectCandidate & {
	joinedAt: Date;
	roles: ProjectRoleTypeSummary[];
};

export type LockedProjectParticipation = {
	projectId: string;
	projectPublicId: string;
	projectStatus: string;
	owningOrganisationId: string;
	participantOrganisationId: string;
	status: ProjectParticipationStatus;
	joinedAt: Date | null;
	leftAt: Date | null;
};

export type LockedProjectMember = {
	projectId: string;
	participantOrganisationId: string;
	organisationMemberId: string;
	status: string;
	joinedAt: Date;
	leftAt: Date | null;
};

function participationStatus(value: string): ProjectParticipationStatus {
	if (
		value === 'invited' ||
		value === 'active' ||
		value === 'suspended' ||
		value === 'left' ||
		value === 'removed' ||
		value === 'declined'
	) {
		return value;
	}
	throw new Error(`Unexpected project participation status: ${value}`);
}

function organisationName(row: { legalName: string; tradingName: string | null }): string {
	return row.tradingName ?? row.legalName;
}

export class ProjectTeamRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listActiveRoleTypes(): Promise<ProjectRoleTypeSummary[]> {
		const rows = await this.db
			.selectFrom('project_role_types')
			.select(['id', 'role_key', 'name', 'description'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			roleKey: row.role_key,
			name: row.name,
			description: row.description
		}));
	}

	async findActiveRoleTypeIdsByKeys(roleKeys: readonly string[]): Promise<string[]> {
		if (roleKeys.length === 0) return [];
		const rows = await this.db
			.selectFrom('project_role_types')
			.select('id')
			.where('role_key', 'in', [...roleKeys])
			.where('is_active', '=', 1)
			.execute();
		return rows.map((row) => row.id);
	}

	async findActiveOrganisationByPublicId(
		publicId: string
	): Promise<{ id: string; publicId: string; name: string } | null> {
		const row = await this.db
			.selectFrom('organisations')
			.select(['id', 'public_id', 'legal_name', 'trading_name'])
			.where('public_id', '=', publicId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.public_id,
			name: organisationName({ legalName: row.legal_name, tradingName: row.trading_name })
		};
	}

	async listPendingInvitations(participantOrganisationId: string): Promise<ProjectInvitationSummary[]> {
		const invitations = await this.db
			.selectFrom('project_organisations as participation')
			.innerJoin('projects as project', 'project.id', 'participation.project_id')
			.innerJoin('organisations as owner', 'owner.id', 'project.owning_organisation_id')
			.select([
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'project.owning_organisation_id as owningOrganisationId',
				'owner.public_id as owningOrganisationPublicId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'participation.created_at as invitedAt'
			])
			.where('participation.participant_organisation_id', '=', participantOrganisationId)
			.where('participation.status', '=', 'invited')
			.orderBy('participation.created_at', 'desc')
			.execute();

		if (invitations.length === 0) return [];
		const projectIds = invitations.map((invitation) => invitation.projectId);
		const roleAssignments = await this.db
			.selectFrom('project_organisation_roles as assignment')
			.innerJoin('project_role_types as role', 'role.id', 'assignment.project_role_type_id')
			.select([
				'assignment.project_id as projectId',
				'role.id as roleId',
				'role.role_key as roleKey',
				'role.name as roleName',
				'role.description as roleDescription'
			])
			.where('assignment.participant_organisation_id', '=', participantOrganisationId)
			.where('assignment.project_id', 'in', projectIds)
			.where('role.is_active', '=', 1)
			.orderBy('role.name', 'asc')
			.execute();
		const rolesByProject = new Map<string, ProjectRoleTypeSummary[]>();
		for (const assignment of roleAssignments) {
			const roles = rolesByProject.get(assignment.projectId) ?? [];
			roles.push({
				id: assignment.roleId,
				roleKey: assignment.roleKey,
				name: assignment.roleName,
				description: assignment.roleDescription
			});
			rolesByProject.set(assignment.projectId, roles);
		}

		return invitations.map((invitation) => ({
			projectId: invitation.projectId,
			projectPublicId: invitation.projectPublicId,
			projectNumber: invitation.projectNumber,
			projectName: invitation.projectName,
			projectStatus: invitation.projectStatus,
			owningOrganisationId: invitation.owningOrganisationId,
			owningOrganisationPublicId: invitation.owningOrganisationPublicId,
			owningOrganisationName: organisationName({
				legalName: invitation.ownerLegalName,
				tradingName: invitation.ownerTradingName
			}),
			invitedAt: invitation.invitedAt,
			roles: rolesByProject.get(invitation.projectId) ?? []
		}));
	}

	async findParticipationForUpdateByProjectPublicId(
		participantOrganisationId: string,
		projectPublicId: string
	): Promise<LockedProjectParticipation | null> {
		const row = await this.db
			.selectFrom('project_organisations as participation')
			.innerJoin('projects as project', 'project.id', 'participation.project_id')
			.select([
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.status as projectStatus',
				'project.owning_organisation_id as owningOrganisationId',
				'participation.participant_organisation_id as participantOrganisationId',
				'participation.status as status',
				'participation.joined_at as joinedAt',
				'participation.left_at as leftAt'
			])
			.where('participation.participant_organisation_id', '=', participantOrganisationId)
			.where('project.public_id', '=', projectPublicId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return {
			projectId: row.projectId,
			projectPublicId: row.projectPublicId,
			projectStatus: row.projectStatus,
			owningOrganisationId: row.owningOrganisationId,
			participantOrganisationId: row.participantOrganisationId,
			status: participationStatus(row.status),
			joinedAt: row.joinedAt,
			leftAt: row.leftAt
		};
	}

	async findParticipationForUpdate(
		projectId: string,
		participantOrganisationId: string
	): Promise<{ status: ProjectParticipationStatus; joinedAt: Date | null; leftAt: Date | null } | null> {
		const row = await this.db
			.selectFrom('project_organisations')
			.select(['status', 'joined_at', 'left_at'])
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', participantOrganisationId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return {
			status: participationStatus(row.status),
			joinedAt: row.joined_at,
			leftAt: row.left_at
		};
	}

	async insertInvitation(
		projectId: string,
		participantOrganisationId: string,
		invitedByMemberId: string
	): Promise<void> {
		await this.db
			.insertInto('project_organisations')
			.values({
				project_id: projectId,
				participant_organisation_id: participantOrganisationId,
				status: 'invited',
				invited_by_member_id: invitedByMemberId,
				joined_at: null,
				left_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async reinviteParticipation(
		projectId: string,
		participantOrganisationId: string,
		currentStatus: ProjectParticipationStatus,
		invitedByMemberId: string
	): Promise<boolean> {
		const result = await this.db
			.updateTable('project_organisations')
			.set({
				status: 'invited',
				invited_by_member_id: invitedByMemberId,
				joined_at: null,
				left_at: null
			})
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', participantOrganisationId)
			.where('status', '=', currentStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async updateParticipationStatus(input: {
		projectId: string;
		participantOrganisationId: string;
		fromStatus: ProjectParticipationStatus;
		toStatus: ProjectParticipationStatus;
		joinedAt: Date | null;
		leftAt: Date | null;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_organisations')
			.set({ status: input.toStatus, joined_at: input.joinedAt, left_at: input.leftAt })
			.where('project_id', '=', input.projectId)
			.where('participant_organisation_id', '=', input.participantOrganisationId)
			.where('status', '=', input.fromStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async replaceOrganisationRoles(
		projectId: string,
		participantOrganisationId: string,
		roleTypeIds: readonly string[]
	): Promise<void> {
		await this.db
			.deleteFrom('project_organisation_roles')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', participantOrganisationId)
			.execute();
		if (roleTypeIds.length === 0) return;
		await this.db
			.insertInto('project_organisation_roles')
			.values(
				roleTypeIds.map((projectRoleTypeId) => ({
					project_id: projectId,
					participant_organisation_id: participantOrganisationId,
					project_role_type_id: projectRoleTypeId
				}))
			)
			.execute();
	}

	async listParticipants(projectId: string): Promise<ProjectParticipantAdmin[]> {
		const participants = await this.db
			.selectFrom('project_organisations as participation')
			.innerJoin('organisations as organisation', 'organisation.id', 'participation.participant_organisation_id')
			.select([
				'organisation.id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName',
				'participation.status as status',
				'participation.joined_at as joinedAt',
				'participation.left_at as leftAt'
			])
			.where('participation.project_id', '=', projectId)
			.orderBy('organisation.legal_name', 'asc')
			.execute();
		if (participants.length === 0) return [];

		const roleAssignments = await this.db
			.selectFrom('project_organisation_roles as assignment')
			.innerJoin('project_role_types as role', 'role.id', 'assignment.project_role_type_id')
			.select([
				'assignment.participant_organisation_id as organisationId',
				'role.id as roleId',
				'role.role_key as roleKey',
				'role.name as roleName',
				'role.description as roleDescription'
			])
			.where('assignment.project_id', '=', projectId)
			.where('role.is_active', '=', 1)
			.orderBy('role.name', 'asc')
			.execute();
		const rolesByOrganisation = new Map<string, ProjectRoleTypeSummary[]>();
		for (const assignment of roleAssignments) {
			const roles = rolesByOrganisation.get(assignment.organisationId) ?? [];
			roles.push({
				id: assignment.roleId,
				roleKey: assignment.roleKey,
				name: assignment.roleName,
				description: assignment.roleDescription
			});
			rolesByOrganisation.set(assignment.organisationId, roles);
		}

		return participants.map((participant) => ({
			organisationId: participant.organisationId,
			organisationPublicId: participant.organisationPublicId,
			organisationName: organisationName({
				legalName: participant.legalName,
				tradingName: participant.tradingName
			}),
			status: participationStatus(participant.status),
			joinedAt: participant.joinedAt,
			leftAt: participant.leftAt,
			roles: rolesByOrganisation.get(participant.organisationId) ?? []
		}));
	}

	async listActiveOrganisationMembers(
		organisationId: string
	): Promise<OrganisationMemberProjectCandidate[]> {
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
				'email.email as email'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.status', '=', 'active')
			.orderBy('user.display_name', 'asc')
			.orderBy('member.id', 'asc')
			.execute();
		return rows;
	}

	async listActiveProjectMembers(
		projectId: string,
		participantOrganisationId: string
	): Promise<ProjectMemberAdmin[]> {
		const members = await this.db
			.selectFrom('project_members as project_member')
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'project_member.organisation_member_id')
					.onRef('member.organisation_id', '=', 'project_member.participant_organisation_id')
			)
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
				'project_member.joined_at as joinedAt'
			])
			.where('project_member.project_id', '=', projectId)
			.where('project_member.participant_organisation_id', '=', participantOrganisationId)
			.where('project_member.status', '=', 'active')
			.where('member.status', '=', 'active')
			.orderBy('user.display_name', 'asc')
			.execute();
		if (members.length === 0) return [];

		const roleAssignments = await this.db
			.selectFrom('project_member_roles as assignment')
			.innerJoin('project_role_types as role', 'role.id', 'assignment.project_role_type_id')
			.select([
				'assignment.organisation_member_id as memberId',
				'role.id as roleId',
				'role.role_key as roleKey',
				'role.name as roleName',
				'role.description as roleDescription'
			])
			.where('assignment.project_id', '=', projectId)
			.where('assignment.participant_organisation_id', '=', participantOrganisationId)
			.where('role.is_active', '=', 1)
			.orderBy('role.name', 'asc')
			.execute();
		const rolesByMember = new Map<string, ProjectRoleTypeSummary[]>();
		for (const assignment of roleAssignments) {
			const roles = rolesByMember.get(assignment.memberId) ?? [];
			roles.push({
				id: assignment.roleId,
				roleKey: assignment.roleKey,
				name: assignment.roleName,
				description: assignment.roleDescription
			});
			rolesByMember.set(assignment.memberId, roles);
		}

		return members.map((member) => ({
			...member,
			roles: rolesByMember.get(member.id) ?? []
		}));
	}

	async findActiveOrganisationMemberForUpdate(
		organisationId: string,
		memberPublicId: string
	): Promise<OrganisationMemberProjectCandidate | null> {
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
				'email.email as email'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.public_id', '=', memberPublicId)
			.where('member.status', '=', 'active')
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async findProjectMemberForUpdate(
		projectId: string,
		participantOrganisationId: string,
		organisationMemberId: string
	): Promise<LockedProjectMember | null> {
		const row = await this.db
			.selectFrom('project_members')
			.select([
				'project_id as projectId',
				'participant_organisation_id as participantOrganisationId',
				'organisation_member_id as organisationMemberId',
				'status',
				'joined_at as joinedAt',
				'left_at as leftAt'
			])
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', participantOrganisationId)
			.where('organisation_member_id', '=', organisationMemberId)
			.forUpdate()
			.executeTakeFirst();
		return row ?? null;
	}

	async activateProjectMember(input: {
		projectId: string;
		participantOrganisationId: string;
		organisationMemberId: string;
		joinedAt: Date;
		currentStatus?: string | null;
	}): Promise<void> {
		if (input.currentStatus === undefined || input.currentStatus === null) {
			await this.db
				.insertInto('project_members')
				.values({
					project_id: input.projectId,
					participant_organisation_id: input.participantOrganisationId,
					organisation_member_id: input.organisationMemberId,
					status: 'active',
					joined_at: input.joinedAt,
					left_at: null
				})
				.executeTakeFirstOrThrow();
			return;
		}
		await this.db
			.updateTable('project_members')
			.set({ status: 'active', joined_at: input.joinedAt, left_at: null })
			.where('project_id', '=', input.projectId)
			.where('participant_organisation_id', '=', input.participantOrganisationId)
			.where('organisation_member_id', '=', input.organisationMemberId)
			.where('status', '=', input.currentStatus)
			.executeTakeFirstOrThrow();
	}

	async updateProjectMemberStatus(input: {
		projectId: string;
		participantOrganisationId: string;
		organisationMemberId: string;
		fromStatus: string;
		toStatus: 'left' | 'removed';
		leftAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_members')
			.set({ status: input.toStatus, left_at: input.leftAt })
			.where('project_id', '=', input.projectId)
			.where('participant_organisation_id', '=', input.participantOrganisationId)
			.where('organisation_member_id', '=', input.organisationMemberId)
			.where('status', '=', input.fromStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async markAllActiveProjectMembers(input: {
		projectId: string;
		participantOrganisationId: string;
		toStatus: 'left' | 'removed';
		leftAt: Date;
	}): Promise<void> {
		await this.db
			.updateTable('project_members')
			.set({ status: input.toStatus, left_at: input.leftAt })
			.where('project_id', '=', input.projectId)
			.where('participant_organisation_id', '=', input.participantOrganisationId)
			.where('status', '=', 'active')
			.execute();
	}

	async listActiveProjectMemberActors(
		projectId: string,
		participantOrganisationId: string
	): Promise<Array<{ memberId: string; userId: string }>> {
		return this.db
			.selectFrom('project_members as project_member')
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'project_member.organisation_member_id')
					.onRef('member.organisation_id', '=', 'project_member.participant_organisation_id')
			)
			.select(['member.id as memberId', 'member.user_id as userId'])
			.where('project_member.project_id', '=', projectId)
			.where('project_member.participant_organisation_id', '=', participantOrganisationId)
			.where('project_member.status', '=', 'active')
			.where('member.status', '=', 'active')
			.execute();
	}

	async replaceMemberRoles(input: {
		projectId: string;
		participantOrganisationId: string;
		organisationMemberId: string;
		roleTypeIds: readonly string[];
	}): Promise<void> {
		await this.db
			.deleteFrom('project_member_roles')
			.where('project_id', '=', input.projectId)
			.where('participant_organisation_id', '=', input.participantOrganisationId)
			.where('organisation_member_id', '=', input.organisationMemberId)
			.execute();
		if (input.roleTypeIds.length === 0) return;
		await this.db
			.insertInto('project_member_roles')
			.values(
				input.roleTypeIds.map((projectRoleTypeId) => ({
					project_id: input.projectId,
					participant_organisation_id: input.participantOrganisationId,
					organisation_member_id: input.organisationMemberId,
					project_role_type_id: projectRoleTypeId
				}))
			)
			.execute();
	}

	async deleteMemberRolesForOrganisation(
		projectId: string,
		participantOrganisationId: string
	): Promise<void> {
		await this.db
			.deleteFrom('project_member_roles')
			.where('project_id', '=', projectId)
			.where('participant_organisation_id', '=', participantOrganisationId)
			.execute();
	}
}
