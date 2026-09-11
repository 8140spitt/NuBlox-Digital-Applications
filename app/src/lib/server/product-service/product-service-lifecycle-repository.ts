import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	ProductServiceDesignReviews,
	ProductServiceDesigns,
	ProductServiceDevelopmentPlans,
	ProductServiceInnovationExperiments,
	ProductServiceLaunchPlans,
	ProductServiceLifecycleReviews,
	ProductServiceRetirementPlans
} from '$lib/server/db/generated/product-service';

export type ProductServiceDesignRecord = Selectable<ProductServiceDesigns>;
export type ProductServiceDesignReviewRecord = Selectable<ProductServiceDesignReviews>;
export type ProductServiceDevelopmentPlanRecord = Selectable<ProductServiceDevelopmentPlans>;
export type ProductServiceLaunchPlanRecord = Selectable<ProductServiceLaunchPlans>;
export type ProductServiceLifecycleReviewRecord = Selectable<ProductServiceLifecycleReviews>;
export type ProductServiceRetirementPlanRecord = Selectable<ProductServiceRetirementPlans>;
export type ProductServiceInnovationExperimentRecord =
	Selectable<ProductServiceInnovationExperiments>;

function insertedId(result: { insertId?: bigint }, label: string): string {
	const id = result.insertId?.toString();
	if (!id) throw new Error(`${label} insert did not return an identifier.`);
	return id;
}

export class ProductServiceLifecycleRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	listDesigns(organisationId: string) {
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findDesignByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertDesign(values: Insertable<ProductServiceDesigns>) {
		const result = await this.db
			.insertInto('product_service_designs')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service design');
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateDesign(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceDesigns>
	) {
		await this.db
			.updateTable('product_service_designs')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listDesignReviews(organisationId: string) {
		return this.db
			.selectFrom('product_service_design_reviews')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('review_date', 'desc')
			.execute();
	}

	async insertDesignReview(values: Insertable<ProductServiceDesignReviews>) {
		const result = await this.db
			.insertInto('product_service_design_reviews')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service design review');
		return this.db
			.selectFrom('product_service_design_reviews')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listDevelopmentPlans(organisationId: string) {
		return this.db
			.selectFrom('product_service_development_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findDevelopmentPlanByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_development_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertDevelopmentPlan(values: Insertable<ProductServiceDevelopmentPlans>) {
		const result = await this.db
			.insertInto('product_service_development_plans')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service development plan');
		return this.db
			.selectFrom('product_service_development_plans')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateDevelopmentPlan(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceDevelopmentPlans>
	) {
		await this.db
			.updateTable('product_service_development_plans')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_development_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listLaunchPlans(organisationId: string) {
		return this.db
			.selectFrom('product_service_launch_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('target_launch_date', 'desc')
			.execute();
	}

	findLaunchPlanByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_launch_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertLaunchPlan(values: Insertable<ProductServiceLaunchPlans>) {
		const result = await this.db
			.insertInto('product_service_launch_plans')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service launch plan');
		return this.db
			.selectFrom('product_service_launch_plans')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateLaunchPlan(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceLaunchPlans>
	) {
		await this.db
			.updateTable('product_service_launch_plans')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_launch_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listLifecycleReviews(organisationId: string) {
		return this.db
			.selectFrom('product_service_lifecycle_reviews')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('review_date', 'desc')
			.execute();
	}

	findLifecycleReviewByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_lifecycle_reviews')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertLifecycleReview(values: Insertable<ProductServiceLifecycleReviews>) {
		const result = await this.db
			.insertInto('product_service_lifecycle_reviews')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service lifecycle review');
		return this.db
			.selectFrom('product_service_lifecycle_reviews')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listRetirementPlans(organisationId: string) {
		return this.db
			.selectFrom('product_service_retirement_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('target_end_date', 'desc')
			.execute();
	}

	findRetirementPlanByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_retirement_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertRetirementPlan(values: Insertable<ProductServiceRetirementPlans>) {
		const result = await this.db
			.insertInto('product_service_retirement_plans')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service retirement plan');
		return this.db
			.selectFrom('product_service_retirement_plans')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateRetirementPlan(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceRetirementPlans>
	) {
		await this.db
			.updateTable('product_service_retirement_plans')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_retirement_plans')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	listInnovationExperiments(organisationId: string) {
		return this.db
			.selectFrom('product_service_innovation_experiments')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('updated_at', 'desc')
			.execute();
	}

	findInnovationExperimentByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('product_service_innovation_experiments')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async insertInnovationExperiment(values: Insertable<ProductServiceInnovationExperiments>) {
		const result = await this.db
			.insertInto('product_service_innovation_experiments')
			.values(values)
			.executeTakeFirstOrThrow();
		const id = insertedId(result, 'Product/service innovation experiment');
		return this.db
			.selectFrom('product_service_innovation_experiments')
			.selectAll()
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}

	async updateInnovationExperiment(
		organisationId: string,
		id: string,
		values: Updateable<ProductServiceInnovationExperiments>
	) {
		await this.db
			.updateTable('product_service_innovation_experiments')
			.set(values)
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
		return this.db
			.selectFrom('product_service_innovation_experiments')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirstOrThrow();
	}
}
