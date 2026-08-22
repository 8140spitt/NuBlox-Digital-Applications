import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OrganisationTeamMemberSummary = {
	publicId: string;
	displayName: string;
	email: string | null;
	status: string;
};

export type OrganisationTeamSummary = {
	publicId: string;
	name: string;
	description: string | null;
	isActive: boolean;
	members: OrganisationTeamMemberSummary[];
};

export type OrganisationTeamMemberOption = OrganisationTeamMemberSummary & {
	id: string;
};

export type LockedOrganisationTeam = {
	id: string;
	publicId: string;
	name: string;
	description: string | null;
	isActive: boolean;
};

export class OrganisationTeamRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listTeams(organisationId: string): Promise<OrganisationTeamSummary[]> {
		const teams = await this.db
			.selectFrom('teams')
			.select(['id', 'public_id', 'name', 'description', 'is_active'])
			.where('organisation_id', '=', organisationId)
			.orderBy('name', 'asc')
			.execute();

		const assignments = await this.db
			.selectFrom('team_members as assignment')
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'assignment.organisation_member_id')
					.onRef('member.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('users as user', 'user.id', 'member.user_id')
			.leftJoin('user_emails as email', (join) =>
				join.onRef('email.user_id', '=', 'user.id').on('email.is_primary', '=', 1)
			)
			.select([
				'assignment.team_id as teamId',
				'member.public_id as publicId',
				'user.display_name as displayName',
				'email.email as email',
				'member.status as status'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.orderBy('user.display_name', 'asc')
			.execute();

		const membersByTeam = new Map<string, OrganisationTeamMemberSummary[]>();
		for (const assignment of assignments) {
			const members = membersByTeam.get(assignment.teamId) ?? [];
			members.push({
				publicId: assignment.publicId,
				displayName: assignment.displayName,
				email: assignment.email,
				status: assignment.status
			});
			membersByTeam.set(assignment.teamId, members);
		}

		return teams.map((team) => ({
			publicId: team.public_id,
			name: team.name,
			description: team.description,
			isActive: Boolean(team.is_active),
			members: membersByTeam.get(team.id) ?? []
		}));
	}

	async listAssignableMembers(organisationId: string): Promise<OrganisationTeamMemberOption[]> {
		return this.db
			.selectFrom('organisation_members as member')
			.innerJoin('users as user', 'user.id', 'member.user_id')
			.leftJoin('user_emails as email', (join) =>
				join.onRef('email.user_id', '=', 'user.id').on('email.is_primary', '=', 1)
			)
			.select([
				'member.id as id',
				'member.public_id as publicId',
				'user.display_name as displayName',
				'email.email as email',
				'member.status as status'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.status', 'in', ['active', 'suspended'])
			.orderBy('user.display_name', 'asc')
			.execute();
	}

	async findTeamForUpdate(
		organisationId: string,
		teamPublicId: string
	): Promise<LockedOrganisationTeam | null> {
		const row = await this.db
			.selectFrom('teams')
			.select(['id', 'public_id', 'name', 'description', 'is_active'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', teamPublicId)
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

	async findTeamByName(organisationId: string, name: string): Promise<{ publicId: string } | null> {
		const row = await this.db
			.selectFrom('teams')
			.select('public_id as publicId')
			.where('organisation_id', '=', organisationId)
			.where('name', '=', name)
			.executeTakeFirst();
		return row ?? null;
	}

	async createTeam(input: {
		organisationId: string;
		publicId: string;
		name: string;
		description: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('teams')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				name: input.name,
				description: input.description,
				is_active: 1
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('Team insert did not return an ID.');
		return result.insertId.toString();
	}

	async updateTeam(input: {
		organisationId: string;
		teamId: string;
		name: string;
		description: string | null;
		isActive: boolean;
	}): Promise<void> {
		await this.db
			.updateTable('teams')
			.set({
				name: input.name,
				description: input.description,
				is_active: input.isActive ? 1 : 0
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.teamId)
			.executeTakeFirstOrThrow();
	}

	async findAssignableMemberIdsByPublicIds(
		organisationId: string,
		memberPublicIds: readonly string[]
	): Promise<string[]> {
		if (memberPublicIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('organisation_members')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('public_id', 'in', [...memberPublicIds])
			.where('status', 'in', ['active', 'suspended'])
			.execute();
		return rows.map((row) => row.id);
	}

	async listTeamMemberPublicIds(organisationId: string, teamId: string): Promise<string[]> {
		const rows = await this.db
			.selectFrom('team_members as assignment')
			.innerJoin('organisation_members as member', (join) =>
				join
					.onRef('member.id', '=', 'assignment.organisation_member_id')
					.onRef('member.organisation_id', '=', 'assignment.organisation_id')
			)
			.select('member.public_id as publicId')
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.team_id', '=', teamId)
			.orderBy('member.public_id', 'asc')
			.execute();
		return rows.map((row) => row.publicId);
	}

	async replaceTeamMembers(
		organisationId: string,
		teamId: string,
		memberIds: readonly string[]
	): Promise<void> {
		await this.db
			.deleteFrom('team_members')
			.where('organisation_id', '=', organisationId)
			.where('team_id', '=', teamId)
			.execute();
		if (memberIds.length === 0) return;
		await this.db
			.insertInto('team_members')
			.values(
				memberIds.map((memberId) => ({
					organisation_id: organisationId,
					team_id: teamId,
					organisation_member_id: memberId
				}))
			)
			.execute();
	}
}
