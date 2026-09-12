import type { DatabaseExecutor } from '$lib/server/db/executor';

export type HierarchyLifecycleStatus = 'active' | 'on_hold' | 'closed' | 'archived';

export type PortfolioRecord = {
	id: string;
	organisationId: string;
	publicId: string;
	portfolioNumber: string;
	name: string;
	description: string | null;
	lifecycleStatus: HierarchyLifecycleStatus;
	createdByMemberId: string;
	createdAt: Date;
	updatedAt: Date;
	archivedAt: Date | null;
};

export type ProgrammeRecord = {
	id: string;
	organisationId: string;
	portfolioId: string | null;
	portfolioPublicId: string | null;
	portfolioNumber: string | null;
	portfolioName: string | null;
	publicId: string;
	programmeNumber: string;
	name: string;
	description: string | null;
	lifecycleStatus: HierarchyLifecycleStatus;
	createdByMemberId: string;
	createdAt: Date;
	updatedAt: Date;
	archivedAt: Date | null;
};

export type ProjectHierarchyContext = {
	projectId: string;
	programmeId: string | null;
	programmePublicId: string | null;
	programmeNumber: string | null;
	programmeName: string | null;
	portfolioId: string | null;
	portfolioPublicId: string | null;
	portfolioNumber: string | null;
	portfolioName: string | null;
};

export type InsertPortfolio = {
	organisationId: string;
	publicId: string;
	portfolioNumber: string;
	name: string;
	description: string | null;
	createdByMemberId: string;
};

export type InsertProgramme = {
	organisationId: string;
	portfolioId: string | null;
	publicId: string;
	programmeNumber: string;
	name: string;
	description: string | null;
	createdByMemberId: string;
};

function mapPortfolio(row: {
	id: string;
	organisation_id: string;
	public_id: string;
	portfolio_number: string;
	name: string;
	description: string | null;
	lifecycle_status: string;
	created_by_member_id: string;
	created_at: Date;
	updated_at: Date;
	archived_at: Date | null;
}): PortfolioRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		publicId: row.public_id,
		portfolioNumber: row.portfolio_number,
		name: row.name,
		description: row.description,
		lifecycleStatus: row.lifecycle_status as HierarchyLifecycleStatus,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at
	};
}

function mapProgramme(row: {
	id: string;
	organisation_id: string;
	portfolio_id: string | null;
	portfolio_public_id: string | null;
	portfolio_number: string | null;
	portfolio_name: string | null;
	public_id: string;
	programme_number: string;
	name: string;
	description: string | null;
	lifecycle_status: string;
	created_by_member_id: string;
	created_at: Date;
	updated_at: Date;
	archived_at: Date | null;
}): ProgrammeRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		portfolioId: row.portfolio_id,
		portfolioPublicId: row.portfolio_public_id,
		portfolioNumber: row.portfolio_number,
		portfolioName: row.portfolio_name,
		publicId: row.public_id,
		programmeNumber: row.programme_number,
		name: row.name,
		description: row.description,
		lifecycleStatus: row.lifecycle_status as HierarchyLifecycleStatus,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		archivedAt: row.archived_at
	};
}

const PORTFOLIO_COLUMNS = [
	'id',
	'organisation_id',
	'public_id',
	'portfolio_number',
	'name',
	'description',
	'lifecycle_status',
	'created_by_member_id',
	'created_at',
	'updated_at',
	'archived_at'
] as const;

export class ProjectHierarchyRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listPortfolios(organisationId: string): Promise<PortfolioRecord[]> {
		const rows = await this.db
			.selectFrom('portfolios')
			.select(PORTFOLIO_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('lifecycle_status', '!=', 'archived')
			.orderBy('portfolio_number', 'asc')
			.orderBy('id', 'asc')
			.execute();
		return rows.map(mapPortfolio);
	}

	async findPortfolioByPublicId(
		organisationId: string,
		publicId: string
	): Promise<PortfolioRecord | null> {
		const row = await this.db
			.selectFrom('portfolios')
			.select(PORTFOLIO_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapPortfolio(row) : null;
	}

	async findPortfolioByNumber(
		organisationId: string,
		portfolioNumber: string
	): Promise<PortfolioRecord | null> {
		const row = await this.db
			.selectFrom('portfolios')
			.select(PORTFOLIO_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('portfolio_number', '=', portfolioNumber)
			.executeTakeFirst();
		return row ? mapPortfolio(row) : null;
	}

	async insertPortfolio(input: InsertPortfolio): Promise<string> {
		const result = await this.db
			.insertInto('portfolios')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				portfolio_number: input.portfolioNumber,
				name: input.name,
				description: input.description,
				created_by_member_id: input.createdByMemberId,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the portfolio ID.');
		return result.insertId.toString();
	}

	async listProgrammes(organisationId: string): Promise<ProgrammeRecord[]> {
		const rows = await this.db
			.selectFrom('programmes as programme')
			.leftJoin('portfolios as portfolio', 'portfolio.id', 'programme.portfolio_id')
			.select([
				'programme.id as id',
				'programme.organisation_id as organisation_id',
				'programme.portfolio_id as portfolio_id',
				'portfolio.public_id as portfolio_public_id',
				'portfolio.portfolio_number as portfolio_number',
				'portfolio.name as portfolio_name',
				'programme.public_id as public_id',
				'programme.programme_number as programme_number',
				'programme.name as name',
				'programme.description as description',
				'programme.lifecycle_status as lifecycle_status',
				'programme.created_by_member_id as created_by_member_id',
				'programme.created_at as created_at',
				'programme.updated_at as updated_at',
				'programme.archived_at as archived_at'
			])
			.where('programme.organisation_id', '=', organisationId)
			.where('programme.lifecycle_status', '!=', 'archived')
			.orderBy('portfolio.portfolio_number', 'asc')
			.orderBy('programme.programme_number', 'asc')
			.execute();
		return rows.map(mapProgramme);
	}

	async findProgrammeByPublicId(
		organisationId: string,
		publicId: string
	): Promise<ProgrammeRecord | null> {
		const row = await this.db
			.selectFrom('programmes as programme')
			.leftJoin('portfolios as portfolio', 'portfolio.id', 'programme.portfolio_id')
			.select([
				'programme.id as id',
				'programme.organisation_id as organisation_id',
				'programme.portfolio_id as portfolio_id',
				'portfolio.public_id as portfolio_public_id',
				'portfolio.portfolio_number as portfolio_number',
				'portfolio.name as portfolio_name',
				'programme.public_id as public_id',
				'programme.programme_number as programme_number',
				'programme.name as name',
				'programme.description as description',
				'programme.lifecycle_status as lifecycle_status',
				'programme.created_by_member_id as created_by_member_id',
				'programme.created_at as created_at',
				'programme.updated_at as updated_at',
				'programme.archived_at as archived_at'
			])
			.where('programme.organisation_id', '=', organisationId)
			.where('programme.public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapProgramme(row) : null;
	}

	async findProgrammeByNumber(
		organisationId: string,
		programmeNumber: string
	): Promise<ProgrammeRecord | null> {
		const row = await this.db
			.selectFrom('programmes as programme')
			.leftJoin('portfolios as portfolio', 'portfolio.id', 'programme.portfolio_id')
			.select([
				'programme.id as id',
				'programme.organisation_id as organisation_id',
				'programme.portfolio_id as portfolio_id',
				'portfolio.public_id as portfolio_public_id',
				'portfolio.portfolio_number as portfolio_number',
				'portfolio.name as portfolio_name',
				'programme.public_id as public_id',
				'programme.programme_number as programme_number',
				'programme.name as name',
				'programme.description as description',
				'programme.lifecycle_status as lifecycle_status',
				'programme.created_by_member_id as created_by_member_id',
				'programme.created_at as created_at',
				'programme.updated_at as updated_at',
				'programme.archived_at as archived_at'
			])
			.where('programme.organisation_id', '=', organisationId)
			.where('programme.programme_number', '=', programmeNumber)
			.executeTakeFirst();
		return row ? mapProgramme(row) : null;
	}

	async insertProgramme(input: InsertProgramme): Promise<string> {
		const result = await this.db
			.insertInto('programmes')
			.values({
				organisation_id: input.organisationId,
				portfolio_id: input.portfolioId,
				public_id: input.publicId,
				programme_number: input.programmeNumber,
				name: input.name,
				description: input.description,
				created_by_member_id: input.createdByMemberId,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the programme ID.');
		return result.insertId.toString();
	}

	async listProjectContexts(projectIds: readonly string[]): Promise<ProjectHierarchyContext[]> {
		if (projectIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('projects as project')
			.leftJoin('programmes as programme', 'programme.id', 'project.programme_id')
			.leftJoin('portfolios as portfolio', 'portfolio.id', 'programme.portfolio_id')
			.select([
				'project.id as projectId',
				'programme.id as programmeId',
				'programme.public_id as programmePublicId',
				'programme.programme_number as programmeNumber',
				'programme.name as programmeName',
				'portfolio.id as portfolioId',
				'portfolio.public_id as portfolioPublicId',
				'portfolio.portfolio_number as portfolioNumber',
				'portfolio.name as portfolioName'
			])
			.where('project.id', 'in', [...projectIds])
			.execute();
		return rows;
	}

	async updateProjectProgramme(input: {
		projectId: string;
		owningOrganisationId: string;
		programmeId: string | null;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('projects')
			.set({ programme_id: input.programmeId })
			.where('id', '=', input.projectId)
			.where('owning_organisation_id', '=', input.owningOrganisationId)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}
}
