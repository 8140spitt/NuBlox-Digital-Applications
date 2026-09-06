import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	StrategyBusinessPlans,
	StrategyInitiativeDependencies,
	StrategyInitiativeMilestones,
	StrategyInitiativeOperatingModelLinks,
	StrategyInitiatives,
	StrategyOperatingModelAccountabilities,
	StrategyOperatingModelComponents
} from '$lib/server/db/generated/strategy';

export type BusinessPlanRecord = Selectable<StrategyBusinessPlans>;
export type StrategyInitiativeRecord = Selectable<StrategyInitiatives>;
export type StrategyInitiativeMilestoneRecord = Selectable<StrategyInitiativeMilestones>;
export type StrategyInitiativeDependencyRecord = Selectable<StrategyInitiativeDependencies>;
export type OperatingModelComponentRecord = Selectable<StrategyOperatingModelComponents>;
export type OperatingModelAccountabilityRecord = Selectable<StrategyOperatingModelAccountabilities>;
export type InitiativeOperatingModelLinkRecord = Selectable<StrategyInitiativeOperatingModelLinks>;

export type ExecutionProject = {
	id: string;
	publicId: string;
	projectNumber: string;
	name: string;
	status: string;
};

export type ExecutionBudget = {
	id: string;
	publicId: string;
	projectId: string;
	budgetNumber: string;
	name: string;
	currencyCode: string;
	approvedVersion: number;
};

export class BusinessPlanningRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listPlans(organisationId: string): Promise<BusinessPlanRecord[]> {
		return this.db
			.selectFrom('strategy_business_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('plan_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	async findPlanByPublicId(
		organisationId: string,
		publicId: string
	): Promise<BusinessPlanRecord | undefined> {
		return this.db
			.selectFrom('strategy_business_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async findPlanById(
		organisationId: string,
		id: string
	): Promise<BusinessPlanRecord | undefined> {
		return this.db
			.selectFrom('strategy_business_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirst();
	}

	async findLatestPlanVersion(
		organisationId: string,
		planCode: string
	): Promise<BusinessPlanRecord | undefined> {
		return this.db
			.selectFrom('strategy_business_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('plan_code', '=', planCode)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async insertPlan(values: Insertable<StrategyBusinessPlans>): Promise<BusinessPlanRecord> {
		const result = await this.db
			.insertInto('strategy_business_plans')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Business plan insert did not return an identifier.');
		const record = await this.findPlanById(String(values.organisation_id), id);
		if (!record) throw new Error('Business plan was not found after insert.');
		return record;
	}

	async updatePlan(
		organisationId: string,
		id: string,
		values: Updateable<StrategyBusinessPlans>
	): Promise<BusinessPlanRecord> {
		await this.db
			.updateTable('strategy_business_plans')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		const record = await this.findPlanById(organisationId, id);
		if (!record) throw new Error('Business plan was not found after update.');
		return record;
	}

	async listInitiatives(planId: string): Promise<StrategyInitiativeRecord[]> {
		return this.db
			.selectFrom('strategy_initiatives')
			.selectAll()
			.where('strategy_business_plan_id', '=', planId)
			.orderBy('priority_rank', 'asc')
			.orderBy('initiative_code', 'asc')
			.execute();
	}

	async findInitiativeByPublicId(
		organisationId: string,
		planId: string,
		publicId: string
	): Promise<StrategyInitiativeRecord | undefined> {
		return this.db
			.selectFrom('strategy_initiatives')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('strategy_business_plan_id', '=', planId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertInitiative(values: Insertable<StrategyInitiatives>): Promise<StrategyInitiativeRecord> {
		const result = await this.db
			.insertInto('strategy_initiatives')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy initiative insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_initiatives')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateInitiativesForPlan(
		planId: string,
		values: Updateable<StrategyInitiatives>
	): Promise<void> {
		await this.db
			.updateTable('strategy_initiatives')
			.set(values)
			.where('strategy_business_plan_id', '=', planId)
			.execute();
	}

	async listMilestones(planId: string): Promise<StrategyInitiativeMilestoneRecord[]> {
		return this.db
			.selectFrom('strategy_initiative_milestones as milestone')
			.innerJoin('strategy_initiatives as initiative', 'initiative.id', 'milestone.strategy_initiative_id')
			.selectAll('milestone')
			.where('initiative.strategy_business_plan_id', '=', planId)
			.orderBy('milestone.target_date', 'asc')
			.orderBy('milestone.milestone_code', 'asc')
			.execute();
	}

	async insertMilestone(
		values: Insertable<StrategyInitiativeMilestones>
	): Promise<StrategyInitiativeMilestoneRecord> {
		const result = await this.db
			.insertInto('strategy_initiative_milestones')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy initiative milestone insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_initiative_milestones')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listDependencies(planId: string): Promise<StrategyInitiativeDependencyRecord[]> {
		return this.db
			.selectFrom('strategy_initiative_dependencies as dependency')
			.innerJoin('strategy_initiatives as initiative', 'initiative.id', 'dependency.initiative_id')
			.selectAll('dependency')
			.where('initiative.strategy_business_plan_id', '=', planId)
			.execute();
	}

	async insertDependency(values: Insertable<StrategyInitiativeDependencies>): Promise<void> {
		await this.db.insertInto('strategy_initiative_dependencies').values(values).executeTakeFirstOrThrow();
	}

	async listComponents(planId: string): Promise<OperatingModelComponentRecord[]> {
		return this.db
			.selectFrom('strategy_operating_model_components')
			.selectAll()
			.where('strategy_business_plan_id', '=', planId)
			.orderBy('component_type', 'asc')
			.orderBy('component_code', 'asc')
			.execute();
	}

	async findComponentByPublicId(
		organisationId: string,
		planId: string,
		publicId: string
	): Promise<OperatingModelComponentRecord | undefined> {
		return this.db
			.selectFrom('strategy_operating_model_components')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('strategy_business_plan_id', '=', planId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertComponent(
		values: Insertable<StrategyOperatingModelComponents>
	): Promise<OperatingModelComponentRecord> {
		const result = await this.db
			.insertInto('strategy_operating_model_components')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Operating-model component insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_operating_model_components')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateComponentsForPlan(
		planId: string,
		values: Updateable<StrategyOperatingModelComponents>
	): Promise<void> {
		await this.db
			.updateTable('strategy_operating_model_components')
			.set(values)
			.where('strategy_business_plan_id', '=', planId)
			.execute();
	}

	async listAccountabilities(planId: string): Promise<OperatingModelAccountabilityRecord[]> {
		return this.db
			.selectFrom('strategy_operating_model_accountabilities as accountability')
			.innerJoin(
				'strategy_operating_model_components as component',
				'component.id',
				'accountability.operating_model_component_id'
			)
			.selectAll('accountability')
			.where('component.strategy_business_plan_id', '=', planId)
			.orderBy('accountability.accountability_type', 'asc')
			.orderBy('accountability.position_label', 'asc')
			.execute();
	}

	async insertAccountability(
		values: Insertable<StrategyOperatingModelAccountabilities>
	): Promise<OperatingModelAccountabilityRecord> {
		const result = await this.db
			.insertInto('strategy_operating_model_accountabilities')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Operating-model accountability insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_operating_model_accountabilities')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listInitiativeComponentLinks(planId: string): Promise<InitiativeOperatingModelLinkRecord[]> {
		return this.db
			.selectFrom('strategy_initiative_operating_model_links as link')
			.innerJoin('strategy_initiatives as initiative', 'initiative.id', 'link.initiative_id')
			.selectAll('link')
			.where('initiative.strategy_business_plan_id', '=', planId)
			.execute();
	}

	async insertInitiativeComponentLink(
		values: Insertable<StrategyInitiativeOperatingModelLinks>
	): Promise<void> {
		await this.db
			.insertInto('strategy_initiative_operating_model_links')
			.values(values)
			.executeTakeFirstOrThrow();
	}

	async listExecutionProjects(organisationId: string): Promise<ExecutionProject[]> {
		const owned = await this.db
			.selectFrom('projects')
			.select(['id', 'public_id', 'project_number', 'name', 'status'])
			.where('owning_organisation_id', '=', organisationId)
			.where('status', 'not in', ['cancelled', 'archived'])
			.execute();
		const participating = await this.db
			.selectFrom('project_organisations as participant')
			.innerJoin('projects as project', 'project.id', 'participant.project_id')
			.select([
				'project.id as id',
				'project.public_id as public_id',
				'project.project_number as project_number',
				'project.name as name',
				'project.status as status'
			])
			.where('participant.participant_organisation_id', '=', organisationId)
			.where('participant.status', '=', 'active')
			.where('project.status', 'not in', ['cancelled', 'archived'])
			.execute();
		const unique = new Map<string, ExecutionProject>();
		for (const row of [...owned, ...participating]) {
			unique.set(row.id, {
				id: row.id,
				publicId: row.public_id,
				projectNumber: row.project_number,
				name: row.name,
				status: row.status
			});
		}
		return [...unique.values()].sort((left, right) => left.projectNumber.localeCompare(right.projectNumber));
	}

	async findExecutionProject(
		organisationId: string,
		publicId: string
	): Promise<ExecutionProject | undefined> {
		const projects = await this.listExecutionProjects(organisationId);
		return projects.find((project) => project.publicId === publicId);
	}

	async listApprovedExecutionBudgets(
		organisationId: string,
		projectId?: string | null
	): Promise<ExecutionBudget[]> {
		let query = this.db
			.selectFrom('project_budgets as budget')
			.innerJoin('project_budget_versions as version', (join) =>
				join
					.onRef('version.project_budget_id', '=', 'budget.id')
					.onRef('version.organisation_id', '=', 'budget.organisation_id')
			)
			.select([
				'budget.id as id',
				'budget.public_id as public_id',
				'budget.project_id as project_id',
				'budget.budget_number as budget_number',
				'budget.name as name',
				'version.currency_code as currency_code',
				'version.version_number as version_number'
			])
			.where('budget.organisation_id', '=', organisationId)
			.where('budget.lifecycle_status', '=', 'active')
			.where('version.version_status', '=', 'approved');
		if (projectId) query = query.where('budget.project_id', '=', projectId);
		const rows = await query.orderBy('budget.budget_number', 'asc').orderBy('version.version_number', 'desc').execute();
		const unique = new Map<string, ExecutionBudget>();
		for (const row of rows) {
			if (unique.has(row.id)) continue;
			unique.set(row.id, {
				id: row.id,
				publicId: row.public_id,
				projectId: row.project_id,
				budgetNumber: row.budget_number,
				name: row.name,
				currencyCode: row.currency_code,
				approvedVersion: row.version_number
			});
		}
		return [...unique.values()];
	}

	async findApprovedExecutionBudget(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<ExecutionBudget | undefined> {
		const budgets = await this.listApprovedExecutionBudgets(organisationId, projectId);
		return budgets.find((budget) => budget.publicId === publicId);
	}
}
