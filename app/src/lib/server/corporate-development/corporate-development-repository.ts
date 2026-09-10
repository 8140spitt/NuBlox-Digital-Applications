import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	CorporateDevelopmentOpportunities,
	CorporateDevelopmentOpportunityStageHistory,
	CorporateDevelopmentValuationAssumptions,
	CorporateDevelopmentValuationScenarios,
	CorporateDevelopmentValuations
} from '$lib/server/db/generated/corporate-development';

export type CorporateDevelopmentOpportunityRecord = Selectable<CorporateDevelopmentOpportunities>;
export type CorporateDevelopmentStageHistoryRecord = Selectable<CorporateDevelopmentOpportunityStageHistory>;
export type CorporateDevelopmentValuationRecord = Selectable<CorporateDevelopmentValuations>;
export type CorporateDevelopmentValuationScenarioRecord = Selectable<CorporateDevelopmentValuationScenarios>;
export type CorporateDevelopmentValuationAssumptionRecord = Selectable<CorporateDevelopmentValuationAssumptions>;

function insertedId(result: { insertId?: bigint }, label: string): string {
	const id = result.insertId?.toString();
	if (!id) throw new Error(`${label} insert did not return an identifier.`);
	return id;
}

export class CorporateDevelopmentRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	listOpportunities(organisationId: string) {
		return this.db.selectFrom('corporate_development_opportunities').selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc').execute();
	}

	findOpportunityByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_opportunities').selectAll()
			.where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertOpportunity(values: Insertable<CorporateDevelopmentOpportunities>) {
		const result = await this.db.insertInto('corporate_development_opportunities').values(values).executeTakeFirstOrThrow();
		const id = insertedId(result, 'Corporate development opportunity');
		return this.db.selectFrom('corporate_development_opportunities').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateOpportunity(organisationId: string, id: string, values: Updateable<CorporateDevelopmentOpportunities>) {
		await this.db.updateTable('corporate_development_opportunities').set(values)
			.where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_opportunities').selectAll()
			.where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listStageHistory(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_opportunity_stage_history').selectAll()
			.where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId)
			.orderBy('transitioned_at', 'desc').execute();
	}

	async insertStageHistory(values: Insertable<CorporateDevelopmentOpportunityStageHistory>) {
		await this.db.insertInto('corporate_development_opportunity_stage_history').values(values).executeTakeFirstOrThrow();
	}

	listValuations(organisationId: string, opportunityId: string) {
		return this.db.selectFrom('corporate_development_valuations').selectAll()
			.where('organisation_id', '=', organisationId).where('opportunity_id', '=', opportunityId)
			.orderBy('valuation_code', 'asc').orderBy('version_number', 'desc').execute();
	}

	findValuationByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('corporate_development_valuations').selectAll()
			.where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertValuation(values: Insertable<CorporateDevelopmentValuations>) {
		const result = await this.db.insertInto('corporate_development_valuations').values(values).executeTakeFirstOrThrow();
		const id = insertedId(result, 'Corporate development valuation');
		return this.db.selectFrom('corporate_development_valuations').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateValuation(organisationId: string, id: string, values: Updateable<CorporateDevelopmentValuations>) {
		await this.db.updateTable('corporate_development_valuations').set(values)
			.where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('corporate_development_valuations').selectAll()
			.where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listScenarios(organisationId: string, valuationIds: string[]) {
		if (!valuationIds.length) return Promise.resolve([] as CorporateDevelopmentValuationScenarioRecord[]);
		return this.db.selectFrom('corporate_development_valuation_scenarios').selectAll()
			.where('organisation_id', '=', organisationId).where('valuation_id', 'in', valuationIds)
			.orderBy('scenario_type', 'asc').execute();
	}

	async insertScenario(values: Insertable<CorporateDevelopmentValuationScenarios>) {
		const result = await this.db.insertInto('corporate_development_valuation_scenarios').values(values).executeTakeFirstOrThrow();
		const id = insertedId(result, 'Corporate development valuation scenario');
		return this.db.selectFrom('corporate_development_valuation_scenarios').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	listAssumptions(organisationId: string, scenarioIds: string[]) {
		if (!scenarioIds.length) return Promise.resolve([] as CorporateDevelopmentValuationAssumptionRecord[]);
		return this.db.selectFrom('corporate_development_valuation_assumptions').selectAll()
			.where('organisation_id', '=', organisationId).where('valuation_scenario_id', 'in', scenarioIds)
			.orderBy('assumption_code', 'asc').execute();
	}

	async insertAssumption(values: Insertable<CorporateDevelopmentValuationAssumptions>) {
		const result = await this.db.insertInto('corporate_development_valuation_assumptions').values(values).executeTakeFirstOrThrow();
		const id = insertedId(result, 'Corporate development valuation assumption');
		return this.db.selectFrom('corporate_development_valuation_assumptions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}
}
