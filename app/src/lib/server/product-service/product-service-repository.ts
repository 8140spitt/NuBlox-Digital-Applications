import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	ProductServiceBusinessCaseAssumptions,
	ProductServiceBusinessCaseScenarios,
	ProductServiceBusinessCases,
	ProductServiceIdeas,
	ProductServiceNeeds,
	ProductServiceOfferings,
	ProductServicePortfolios
} from '$lib/server/db/generated/product-service';

export type ProductServicePortfolioRecord = Selectable<ProductServicePortfolios>;
export type ProductServiceOfferingRecord = Selectable<ProductServiceOfferings>;
export type ProductServiceNeedRecord = Selectable<ProductServiceNeeds>;
export type ProductServiceIdeaRecord = Selectable<ProductServiceIdeas>;
export type ProductServiceBusinessCaseRecord = Selectable<ProductServiceBusinessCases>;
export type ProductServiceBusinessCaseAssumptionRecord =
	Selectable<ProductServiceBusinessCaseAssumptions>;
export type ProductServiceBusinessCaseScenarioRecord =
	Selectable<ProductServiceBusinessCaseScenarios>;

function insertedId(result: { insertId?: bigint }, label: string): string {
	const id = result.insertId?.toString();
	if (!id) throw new Error(`${label} insert did not return an identifier.`);
	return id;
}

export class ProductServiceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	listPortfolios(organisationId: string) {
		return this.db
			.selectFrom('product_service_portfolios')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('priority', 'desc')
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findPortfolioByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_portfolios')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertPortfolio(values: Insertable<ProductServicePortfolios>) {
		const result = await this.db
			.insertInto('product_service_portfolios')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service portfolio');
		return this.db
			.selectFrom('product_service_portfolios')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listOfferings(organisationId: string, portfolioId?: string) {
		let query = this.db
			.selectFrom('product_service_offerings')
			.selectAll()
			.where('organisation_id', '=', organisationId);
		if (portfolioId) query = query.where('portfolio_id', '=', portfolioId);
		return query.orderBy('updated_at', 'desc').execute();
	}

	findOfferingByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_offerings')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertOffering(values: Insertable<ProductServiceOfferings>) {
		const result = await this.db
			.insertInto('product_service_offerings')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service offering');
		return this.db
			.selectFrom('product_service_offerings')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateOffering(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceOfferings>
	) {
		await this.db
			.updateTable('product_service_offerings')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_offerings')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listNeeds(organisationId: string) {
		return this.db
			.selectFrom('product_service_needs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findNeedByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_needs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertNeed(values: Insertable<ProductServiceNeeds>) {
		const result = await this.db
			.insertInto('product_service_needs')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service need');
		return this.db
			.selectFrom('product_service_needs')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listIdeas(organisationId: string) {
		return this.db
			.selectFrom('product_service_ideas')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findIdeaByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_ideas')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertIdea(values: Insertable<ProductServiceIdeas>) {
		const result = await this.db
			.insertInto('product_service_ideas')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service idea');
		return this.db
			.selectFrom('product_service_ideas')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateIdea(organisationId: string, id: string, values: Updateable<ProductServiceIdeas>) {
		await this.db
			.updateTable('product_service_ideas')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_ideas')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listBusinessCases(organisationId: string, ideaId?: string) {
		let query = this.db
			.selectFrom('product_service_business_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId);
		if (ideaId) query = query.where('idea_id', '=', ideaId);
		return query
			.orderBy('business_case_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	findBusinessCaseByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_business_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertBusinessCase(values: Insertable<ProductServiceBusinessCases>) {
		const result = await this.db
			.insertInto('product_service_business_cases')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service business case');
		return this.db
			.selectFrom('product_service_business_cases')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateBusinessCase(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceBusinessCases>
	) {
		await this.db
			.updateTable('product_service_business_cases')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_business_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listBusinessCaseAssumptions(organisationId: string, businessCaseIds: string[]) {
		if (!businessCaseIds.length) {
			return Promise.resolve([] as ProductServiceBusinessCaseAssumptionRecord[]);
		}
		return this.db
			.selectFrom('product_service_business_case_assumptions')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('business_case_id', 'in', businessCaseIds)
			.orderBy('assumption_code', 'asc')
			.execute();
	}

	async insertBusinessCaseAssumption(values: Insertable<ProductServiceBusinessCaseAssumptions>) {
		const result = await this.db
			.insertInto('product_service_business_case_assumptions')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service business case assumption');
		return this.db
			.selectFrom('product_service_business_case_assumptions')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listBusinessCaseScenarios(organisationId: string, businessCaseIds: string[]) {
		if (!businessCaseIds.length) {
			return Promise.resolve([] as ProductServiceBusinessCaseScenarioRecord[]);
		}
		return this.db
			.selectFrom('product_service_business_case_scenarios')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('business_case_id', 'in', businessCaseIds)
			.orderBy('scenario_type', 'asc')
			.execute();
	}

	async insertBusinessCaseScenario(values: Insertable<ProductServiceBusinessCaseScenarios>) {
		const result = await this.db
			.insertInto('product_service_business_case_scenarios')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service business case scenario');
		return this.db
			.selectFrom('product_service_business_case_scenarios')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}
}
