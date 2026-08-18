import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProjectLifecycleStatus =
	'proposed' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';

export type ProjectRecord = {
	id: string;
	owningOrganisationId: string;
	publicId: string;
	projectNumber: string;
	name: string;
	description: string | null;
	status: ProjectLifecycleStatus;
	createdByMemberId: string | null;
	startedOn: Date | null;
	completedOn: Date | null;
	archivedAt: Date | null;
};

export type ProjectParticipantOrganisation = {
	organisationId: string;
	organisationPublicId: string;
	organisationName: string;
	status: string;
	joinedAt: Date | null;
};

export type InsertProject = {
	owningOrganisationId: string;
	publicId: string;
	projectNumber: string;
	name: string;
	description: string | null;
	createdByMemberId: string;
};

function mapProject(row: {
	id: string;
	owning_organisation_id: string;
	public_id: string;
	project_number: string;
	name: string;
	description: string | null;
	status: string;
	created_by_member_id: string | null;
	started_on: Date | null;
	completed_on: Date | null;
	archived_at: Date | null;
}): ProjectRecord {
	return {
		id: row.id,
		owningOrganisationId: row.owning_organisation_id,
		publicId: row.public_id,
		projectNumber: row.project_number,
		name: row.name,
		description: row.description,
		status: row.status as ProjectLifecycleStatus,
		createdByMemberId: row.created_by_member_id,
		startedOn: row.started_on,
		completedOn: row.completed_on,
		archivedAt: row.archived_at
	};
}

const PROJECT_COLUMNS = [
	'id',
	'owning_organisation_id',
	'public_id',
	'project_number',
	'name',
	'description',
	'status',
	'created_by_member_id',
	'started_on',
	'completed_on',
	'archived_at'
] as const;

export class ProjectRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async findOwnedByPublicId(
		owningOrganisationId: string,
		publicId: string
	): Promise<ProjectRecord | null> {
		const row = await this.db
			.selectFrom('projects')
			.select(PROJECT_COLUMNS)
			.where('owning_organisation_id', '=', owningOrganisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();

		return row ? mapProject(row) : null;
	}

	async findOwnedByProjectNumber(
		owningOrganisationId: string,
		projectNumber: string
	): Promise<ProjectRecord | null> {
		const row = await this.db
			.selectFrom('projects')
			.select(PROJECT_COLUMNS)
			.where('owning_organisation_id', '=', owningOrganisationId)
			.where('project_number', '=', projectNumber)
			.executeTakeFirst();

		return row ? mapProject(row) : null;
	}

	async findParticipatingByPublicId(
		participantOrganisationId: string,
		publicId: string
	): Promise<ProjectRecord | null> {
		const row = await this.db
			.selectFrom('projects as p')
			.innerJoin('project_organisations as po', 'po.project_id', 'p.id')
			.select([
				'p.id as id',
				'p.owning_organisation_id as owning_organisation_id',
				'p.public_id as public_id',
				'p.project_number as project_number',
				'p.name as name',
				'p.description as description',
				'p.status as status',
				'p.created_by_member_id as created_by_member_id',
				'p.started_on as started_on',
				'p.completed_on as completed_on',
				'p.archived_at as archived_at'
			])
			.where('po.participant_organisation_id', '=', participantOrganisationId)
			.where('po.status', '=', 'active')
			.where('p.public_id', '=', publicId)
			.executeTakeFirst();

		return row ? mapProject(row) : null;
	}

	async findForMemberByPublicId(
		participantOrganisationId: string,
		organisationMemberId: string,
		publicId: string
	): Promise<ProjectRecord | null> {
		const row = await this.db
			.selectFrom('projects as p')
			.innerJoin('project_organisations as po', 'po.project_id', 'p.id')
			.innerJoin('project_members as pm', (join) =>
				join
					.onRef('pm.project_id', '=', 'po.project_id')
					.onRef('pm.participant_organisation_id', '=', 'po.participant_organisation_id')
			)
			.select([
				'p.id as id',
				'p.owning_organisation_id as owning_organisation_id',
				'p.public_id as public_id',
				'p.project_number as project_number',
				'p.name as name',
				'p.description as description',
				'p.status as status',
				'p.created_by_member_id as created_by_member_id',
				'p.started_on as started_on',
				'p.completed_on as completed_on',
				'p.archived_at as archived_at'
			])
			.where('po.participant_organisation_id', '=', participantOrganisationId)
			.where('po.status', '=', 'active')
			.where('pm.organisation_member_id', '=', organisationMemberId)
			.where('pm.status', '=', 'active')
			.where('p.public_id', '=', publicId)
			.executeTakeFirst();

		return row ? mapProject(row) : null;
	}

	async listForMember(
		participantOrganisationId: string,
		organisationMemberId: string
	): Promise<ProjectRecord[]> {
		const rows = await this.db
			.selectFrom('projects as p')
			.innerJoin('project_organisations as po', 'po.project_id', 'p.id')
			.innerJoin('project_members as pm', (join) =>
				join
					.onRef('pm.project_id', '=', 'po.project_id')
					.onRef('pm.participant_organisation_id', '=', 'po.participant_organisation_id')
			)
			.select([
				'p.id as id',
				'p.owning_organisation_id as owning_organisation_id',
				'p.public_id as public_id',
				'p.project_number as project_number',
				'p.name as name',
				'p.description as description',
				'p.status as status',
				'p.created_by_member_id as created_by_member_id',
				'p.started_on as started_on',
				'p.completed_on as completed_on',
				'p.archived_at as archived_at'
			])
			.where('po.participant_organisation_id', '=', participantOrganisationId)
			.where('po.status', '=', 'active')
			.where('pm.organisation_member_id', '=', organisationMemberId)
			.where('pm.status', '=', 'active')
			.orderBy('p.id', 'desc')
			.execute();

		return rows.map(mapProject);
	}

	async listActiveParticipantOrganisations(
		projectId: string
	): Promise<ProjectParticipantOrganisation[]> {
		const rows = await this.db
			.selectFrom('project_organisations as po')
			.innerJoin(
				'organisations as organisation',
				'organisation.id',
				'po.participant_organisation_id'
			)
			.select([
				'organisation.id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName',
				'po.status as status',
				'po.joined_at as joinedAt'
			])
			.where('po.project_id', '=', projectId)
			.where('po.status', '=', 'active')
			.orderBy('po.joined_at', 'asc')
			.orderBy('organisation.id', 'asc')
			.execute();

		return rows.map((row) => ({
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			organisationName: row.tradingName ?? row.legalName,
			status: row.status,
			joinedAt: row.joinedAt
		}));
	}

	async insert(project: InsertProject): Promise<string> {
		const result = await this.db
			.insertInto('projects')
			.values({
				owning_organisation_id: project.owningOrganisationId,
				public_id: project.publicId,
				project_number: project.projectNumber,
				name: project.name,
				description: project.description,
				created_by_member_id: project.createdByMemberId,
				status: 'proposed'
			})
			.executeTakeFirstOrThrow();

		if (result.insertId === undefined) {
			throw new Error('MySQL did not return the inserted project ID.');
		}

		return result.insertId.toString();
	}

	async insertOwningParticipation(
		projectId: string,
		organisationId: string,
		joinedAt: Date
	): Promise<void> {
		await this.db
			.insertInto('project_organisations')
			.values({
				project_id: projectId,
				participant_organisation_id: organisationId,
				status: 'active',
				invited_by_member_id: null,
				joined_at: joinedAt,
				left_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async insertProjectMember(
		projectId: string,
		organisationId: string,
		memberId: string,
		joinedAt: Date
	): Promise<void> {
		await this.db
			.insertInto('project_members')
			.values({
				project_id: projectId,
				participant_organisation_id: organisationId,
				organisation_member_id: memberId,
				status: 'active',
				joined_at: joinedAt,
				left_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async updateLifecycle(input: {
		projectId: string;
		owningOrganisationId: string;
		fromStatus: ProjectLifecycleStatus;
		toStatus: ProjectLifecycleStatus;
		startedOn?: Date;
		completedOn?: Date;
		archivedAt?: Date;
	}): Promise<boolean> {
		let query = this.db
			.updateTable('projects')
			.set({ status: input.toStatus })
			.where('id', '=', input.projectId)
			.where('owning_organisation_id', '=', input.owningOrganisationId)
			.where('status', '=', input.fromStatus);

		if (input.startedOn !== undefined) query = query.set({ started_on: input.startedOn });
		if (input.completedOn !== undefined) query = query.set({ completed_on: input.completedOn });
		if (input.archivedAt !== undefined) query = query.set({ archived_at: input.archivedAt });

		const result = await query.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}
}
