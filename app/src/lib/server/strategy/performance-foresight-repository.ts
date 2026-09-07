import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	StrategyKpiActions,
	StrategyKpiObservations,
	StrategyKpis,
	StrategyReviewKpis,
	StrategyReviews,
	StrategyScenarioAssumptions,
	StrategyScenarioKpiProjections,
	StrategyScenarios
} from '$lib/server/db/generated/strategy';

export type StrategyKpiRecord = Selectable<StrategyKpis>;
export type StrategyKpiObservationRecord = Selectable<StrategyKpiObservations>;
export type StrategyKpiActionRecord = Selectable<StrategyKpiActions>;
export type StrategyReviewRecord = Selectable<StrategyReviews>;
export type StrategyReviewKpiRecord = Selectable<StrategyReviewKpis>;
export type StrategyScenarioRecord = Selectable<StrategyScenarios>;
export type StrategyScenarioAssumptionRecord = Selectable<StrategyScenarioAssumptions>;
export type StrategyScenarioKpiProjectionRecord = Selectable<StrategyScenarioKpiProjections>;

export class PerformanceForesightRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listKpis(frameworkId: string): Promise<StrategyKpiRecord[]> {
		return this.db
			.selectFrom('strategy_kpis')
			.selectAll()
			.where('strategy_framework_id', '=', frameworkId)
			.orderBy('kpi_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	async findKpiByPublicId(organisationId: string, publicId: string): Promise<StrategyKpiRecord | undefined> {
		return this.db.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async findKpiById(organisationId: string, id: string): Promise<StrategyKpiRecord | undefined> {
		return this.db.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirst();
	}

	async findLatestKpiVersion(organisationId: string, kpiCode: string): Promise<StrategyKpiRecord | undefined> {
		return this.db.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', organisationId).where('kpi_code', '=', kpiCode).orderBy('version_number', 'desc').executeTakeFirst();
	}

	async insertKpi(values: Insertable<StrategyKpis>): Promise<StrategyKpiRecord> {
		const result = await this.db.insertInto('strategy_kpis').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy KPI insert did not return an identifier.');
		return this.db.selectFrom('strategy_kpis').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateKpi(organisationId: string, id: string, values: Updateable<StrategyKpis>): Promise<StrategyKpiRecord> {
		await this.db.updateTable('strategy_kpis').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		const row = await this.findKpiById(organisationId, id);
		if (!row) throw new Error('Strategy KPI was not found after update.');
		return row;
	}

	async listObservations(frameworkId: string): Promise<StrategyKpiObservationRecord[]> {
		return this.db
			.selectFrom('strategy_kpi_observations as observation')
			.innerJoin('strategy_kpis as kpi', 'kpi.id', 'observation.strategy_kpi_id')
			.selectAll('observation')
			.where('kpi.strategy_framework_id', '=', frameworkId)
			.orderBy('observation.observed_on', 'desc')
			.orderBy('observation.created_at', 'desc')
			.execute();
	}

	async listObservationsForKpi(kpiId: string): Promise<StrategyKpiObservationRecord[]> {
		return this.db.selectFrom('strategy_kpi_observations').selectAll().where('strategy_kpi_id', '=', kpiId).orderBy('observed_on', 'desc').orderBy('created_at', 'desc').execute();
	}

	async findObservationByPublicId(organisationId: string, publicId: string): Promise<StrategyKpiObservationRecord | undefined> {
		return this.db.selectFrom('strategy_kpi_observations').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertObservation(values: Insertable<StrategyKpiObservations>): Promise<StrategyKpiObservationRecord> {
		const result = await this.db.insertInto('strategy_kpi_observations').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy KPI observation insert did not return an identifier.');
		return this.db.selectFrom('strategy_kpi_observations').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listActions(frameworkId: string): Promise<StrategyKpiActionRecord[]> {
		return this.db
			.selectFrom('strategy_kpi_actions as action')
			.innerJoin('strategy_kpis as kpi', 'kpi.id', 'action.strategy_kpi_id')
			.selectAll('action')
			.where('kpi.strategy_framework_id', '=', frameworkId)
			.orderBy('action.lifecycle_status', 'asc')
			.orderBy('action.due_date', 'asc')
			.execute();
	}

	async findActionByPublicId(organisationId: string, publicId: string): Promise<StrategyKpiActionRecord | undefined> {
		return this.db.selectFrom('strategy_kpi_actions').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertAction(values: Insertable<StrategyKpiActions>): Promise<StrategyKpiActionRecord> {
		const result = await this.db.insertInto('strategy_kpi_actions').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy KPI action insert did not return an identifier.');
		return this.db.selectFrom('strategy_kpi_actions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateAction(organisationId: string, id: string, values: Updateable<StrategyKpiActions>): Promise<StrategyKpiActionRecord> {
		await this.db.updateTable('strategy_kpi_actions').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_kpi_actions').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listReviews(frameworkId: string): Promise<StrategyReviewRecord[]> {
		return this.db.selectFrom('strategy_reviews').selectAll().where('strategy_framework_id', '=', frameworkId).orderBy('review_date', 'desc').execute();
	}

	async findReviewByPublicId(organisationId: string, publicId: string): Promise<StrategyReviewRecord | undefined> {
		return this.db.selectFrom('strategy_reviews').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertReview(values: Insertable<StrategyReviews>): Promise<StrategyReviewRecord> {
		const result = await this.db.insertInto('strategy_reviews').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy review insert did not return an identifier.');
		return this.db.selectFrom('strategy_reviews').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateReview(organisationId: string, id: string, values: Updateable<StrategyReviews>): Promise<StrategyReviewRecord> {
		await this.db.updateTable('strategy_reviews').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_reviews').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listReviewKpis(frameworkId: string): Promise<StrategyReviewKpiRecord[]> {
		return this.db
			.selectFrom('strategy_review_kpis as snapshot')
			.innerJoin('strategy_reviews as review', 'review.id', 'snapshot.strategy_review_id')
			.selectAll('snapshot')
			.where('review.strategy_framework_id', '=', frameworkId)
			.execute();
	}

	async listReviewKpisForReview(reviewId: string): Promise<StrategyReviewKpiRecord[]> {
		return this.db.selectFrom('strategy_review_kpis').selectAll().where('strategy_review_id', '=', reviewId).execute();
	}

	async insertReviewKpi(values: Insertable<StrategyReviewKpis>): Promise<StrategyReviewKpiRecord> {
		const result = await this.db.insertInto('strategy_review_kpis').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy review KPI snapshot insert did not return an identifier.');
		return this.db.selectFrom('strategy_review_kpis').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listScenarios(frameworkId: string): Promise<StrategyScenarioRecord[]> {
		return this.db.selectFrom('strategy_scenarios').selectAll().where('strategy_framework_id', '=', frameworkId).orderBy('scenario_code', 'asc').orderBy('version_number', 'desc').execute();
	}

	async findScenarioByPublicId(organisationId: string, publicId: string): Promise<StrategyScenarioRecord | undefined> {
		return this.db.selectFrom('strategy_scenarios').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async findLatestScenarioVersion(organisationId: string, scenarioCode: string): Promise<StrategyScenarioRecord | undefined> {
		return this.db.selectFrom('strategy_scenarios').selectAll().where('organisation_id', '=', organisationId).where('scenario_code', '=', scenarioCode).orderBy('version_number', 'desc').executeTakeFirst();
	}

	async insertScenario(values: Insertable<StrategyScenarios>): Promise<StrategyScenarioRecord> {
		const result = await this.db.insertInto('strategy_scenarios').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy scenario insert did not return an identifier.');
		return this.db.selectFrom('strategy_scenarios').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateScenario(organisationId: string, id: string, values: Updateable<StrategyScenarios>): Promise<StrategyScenarioRecord> {
		await this.db.updateTable('strategy_scenarios').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_scenarios').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listScenarioAssumptions(frameworkId: string): Promise<StrategyScenarioAssumptionRecord[]> {
		return this.db
			.selectFrom('strategy_scenario_assumptions as assumption')
			.innerJoin('strategy_scenarios as scenario', 'scenario.id', 'assumption.strategy_scenario_id')
			.selectAll('assumption')
			.where('scenario.strategy_framework_id', '=', frameworkId)
			.orderBy('assumption.assumption_code', 'asc')
			.execute();
	}

	async listScenarioAssumptionsForScenario(scenarioId: string): Promise<StrategyScenarioAssumptionRecord[]> {
		return this.db.selectFrom('strategy_scenario_assumptions').selectAll().where('strategy_scenario_id', '=', scenarioId).orderBy('assumption_code', 'asc').execute();
	}

	async insertScenarioAssumption(values: Insertable<StrategyScenarioAssumptions>): Promise<StrategyScenarioAssumptionRecord> {
		const result = await this.db.insertInto('strategy_scenario_assumptions').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy scenario assumption insert did not return an identifier.');
		return this.db.selectFrom('strategy_scenario_assumptions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async listScenarioProjections(frameworkId: string): Promise<StrategyScenarioKpiProjectionRecord[]> {
		return this.db
			.selectFrom('strategy_scenario_kpi_projections as projection')
			.innerJoin('strategy_scenarios as scenario', 'scenario.id', 'projection.strategy_scenario_id')
			.selectAll('projection')
			.where('scenario.strategy_framework_id', '=', frameworkId)
			.orderBy('projection.projection_date', 'asc')
			.execute();
	}

	async listScenarioProjectionsForScenario(scenarioId: string): Promise<StrategyScenarioKpiProjectionRecord[]> {
		return this.db.selectFrom('strategy_scenario_kpi_projections').selectAll().where('strategy_scenario_id', '=', scenarioId).orderBy('projection_date', 'asc').execute();
	}

	async insertScenarioProjection(values: Insertable<StrategyScenarioKpiProjections>): Promise<StrategyScenarioKpiProjectionRecord> {
		const result = await this.db.insertInto('strategy_scenario_kpi_projections').values(values).executeTakeFirstOrThrow();
		const id = result.insertId?.toString();
		if (!id) throw new Error('Strategy scenario KPI projection insert did not return an identifier.');
		return this.db.selectFrom('strategy_scenario_kpi_projections').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}
}
