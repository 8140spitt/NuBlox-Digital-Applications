import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	StrategyEnvironmentFactors,
	StrategyFrameworks,
	StrategyObjectives,
	StrategyOptions
} from '$lib/server/db/generated/strategy';

export type StrategyFrameworkRecord = Selectable<StrategyFrameworks>;
export type StrategyEnvironmentFactorRecord = Selectable<StrategyEnvironmentFactors>;
export type StrategyOptionRecord = Selectable<StrategyOptions>;
export type StrategyObjectiveRecord = Selectable<StrategyObjectives>;

export class StrategyRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listFrameworks(organisationId: string): Promise<StrategyFrameworkRecord[]> {
		return this.db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('framework_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	async findFrameworkByPublicId(
		organisationId: string,
		publicId: string
	): Promise<StrategyFrameworkRecord | undefined> {
		return this.db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async findFrameworkById(
		organisationId: string,
		id: string
	): Promise<StrategyFrameworkRecord | undefined> {
		return this.db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirst();
	}

	async findLatestVersion(
		organisationId: string,
		frameworkCode: string
	): Promise<StrategyFrameworkRecord | undefined> {
		return this.db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('framework_code', '=', frameworkCode)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async findApprovedVersion(
		organisationId: string,
		frameworkCode: string
	): Promise<StrategyFrameworkRecord | undefined> {
		return this.db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('framework_code', '=', frameworkCode)
			.where('lifecycle_status', '=', 'approved')
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async insertFramework(
		values: Insertable<StrategyFrameworks>
	): Promise<StrategyFrameworkRecord> {
		const result = await this.db
			.insertInto('strategy_frameworks')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy framework insert did not return an identifier.');
		const record = await this.findFrameworkById(String(values.organisation_id), id);
		if (!record) throw new Error('Strategy framework was not found after insert.');
		return record;
	}

	async updateFramework(
		organisationId: string,
		id: string,
		values: Updateable<StrategyFrameworks>
	): Promise<StrategyFrameworkRecord> {
		await this.db
			.updateTable('strategy_frameworks')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		const record = await this.findFrameworkById(organisationId, id);
		if (!record) throw new Error('Strategy framework was not found after update.');
		return record;
	}

	async listEnvironmentFactors(frameworkId: string): Promise<StrategyEnvironmentFactorRecord[]> {
		return this.db
			.selectFrom('strategy_environment_factors')
			.selectAll()
			.where('strategy_framework_id', '=', frameworkId)
			.orderBy('dimension', 'asc')
			.orderBy('created_at', 'desc')
			.execute();
	}

	async insertEnvironmentFactor(
		values: Insertable<StrategyEnvironmentFactors>
	): Promise<StrategyEnvironmentFactorRecord> {
		const result = await this.db
			.insertInto('strategy_environment_factors')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy environmental factor insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_environment_factors')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async listOptions(frameworkId: string): Promise<StrategyOptionRecord[]> {
		return this.db
			.selectFrom('strategy_options')
			.selectAll()
			.where('strategy_framework_id', '=', frameworkId)
			.orderBy('decision_status', 'asc')
			.orderBy('priority_rank', 'asc')
			.orderBy('created_at', 'asc')
			.execute();
	}

	async insertOption(values: Insertable<StrategyOptions>): Promise<StrategyOptionRecord> {
		const result = await this.db
			.insertInto('strategy_options')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy option insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_options')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async decideOption(
		organisationId: string,
		frameworkId: string,
		publicId: string,
		values: Pick<
			Updateable<StrategyOptions>,
			'decision_status' | 'decision_rationale' | 'decided_by_member_id' | 'decided_at'
		>
	): Promise<StrategyOptionRecord | undefined> {
		await this.db
			.updateTable('strategy_options')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('strategy_framework_id', '=', frameworkId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return this.db
			.selectFrom('strategy_options')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('strategy_framework_id', '=', frameworkId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listObjectives(frameworkId: string): Promise<StrategyObjectiveRecord[]> {
		return this.db
			.selectFrom('strategy_objectives')
			.selectAll()
			.where('strategy_framework_id', '=', frameworkId)
			.orderBy('priority_rank', 'asc')
			.orderBy('objective_code', 'asc')
			.execute();
	}

	async insertObjective(
		values: Insertable<StrategyObjectives>
	): Promise<StrategyObjectiveRecord> {
		const result = await this.db
			.insertInto('strategy_objectives')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy objective insert did not return an identifier.');
		return this.db
			.selectFrom('strategy_objectives')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async activateDraftObjectives(frameworkId: string): Promise<void> {
		await this.db
			.updateTable('strategy_objectives')
			.set({ lifecycle_status: 'active' })
			.where('strategy_framework_id', '=', frameworkId)
			.where('lifecycle_status', '=', 'draft')
			.execute();
	}

	async copyEnvironmentFactors(
		organisationId: string,
		fromFrameworkId: string,
		toFrameworkId: string,
		createdByMemberId: string,
		publicIdFactory: () => string
	): Promise<void> {
		const factors = await this.listEnvironmentFactors(fromFrameworkId);
		if (!factors.length) return;
		await this.db
			.insertInto('strategy_environment_factors')
			.values(
				factors.map((factor) => ({
					organisation_id: organisationId,
					strategy_framework_id: toFrameworkId,
					public_id: publicIdFactory(),
					context_scope: factor.context_scope,
					dimension: factor.dimension,
					direction: factor.direction,
					title: factor.title,
					analysis_text: factor.analysis_text,
					evidence_reference: factor.evidence_reference,
					observed_on: factor.observed_on,
					likelihood_score: factor.likelihood_score,
					impact_score: factor.impact_score,
					lifecycle_status: 'active',
					owner_member_id: factor.owner_member_id,
					created_by_member_id: createdByMemberId
				}))
			)
			.execute();
	}

	async copyOptions(
		organisationId: string,
		fromFrameworkId: string,
		toFrameworkId: string,
		createdByMemberId: string,
		publicIdFactory: () => string
	): Promise<void> {
		const options = await this.listOptions(fromFrameworkId);
		if (!options.length) return;
		await this.db
			.insertInto('strategy_options')
			.values(
				options.map((option) => ({
					organisation_id: organisationId,
					strategy_framework_id: toFrameworkId,
					public_id: publicIdFactory(),
					title: option.title,
					description: option.description,
					evaluation_summary: option.evaluation_summary,
					decision_status: 'proposed',
					decision_rationale: null,
					priority_rank: option.priority_rank,
					created_by_member_id: createdByMemberId,
					decided_by_member_id: null,
					decided_at: null
				}))
			)
			.execute();
	}

	async copyObjectives(
		organisationId: string,
		fromFrameworkId: string,
		toFrameworkId: string,
		createdByMemberId: string,
		publicIdFactory: () => string
	): Promise<void> {
		const objectives = await this.listObjectives(fromFrameworkId);
		if (!objectives.length) return;
		await this.db
			.insertInto('strategy_objectives')
			.values(
				objectives.map((objective) => ({
					organisation_id: organisationId,
					strategy_framework_id: toFrameworkId,
					public_id: publicIdFactory(),
					objective_code: objective.objective_code,
					title: objective.title,
					description: objective.description,
					priority_rank: objective.priority_rank,
					owner_member_id: objective.owner_member_id,
					target_date: objective.target_date,
					lifecycle_status: 'draft',
					created_by_member_id: createdByMemberId
				}))
			)
			.execute();
	}
}
