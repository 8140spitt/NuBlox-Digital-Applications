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

	findDesignById(organisationId: string, id: string) {
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('id', '=', id)
			.executeTakeFirst();
	}

	findLatestDesignByCode(organisationId: string, offeringId: string, designCode: string) {
		return this.db
			.selectFrom('product_service_designs')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('offering_id', '=', offeringId)
			.where('design_code', '=', designCode)
			.orderBy('version_number', 'desc')
			.orderBy('id', 'desc')
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

	createDesign(values: Insertable<ProductServiceDesigns>) {
		return this.insertDesign(values);
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

	listDesignReviews(organisationId: string, designId?: string) {
		const query = this.db
			.selectFrom('product_service_design_reviews')
			.selectAll()
			.where('organisation_id', '=', organisationId);
		return (designId ? query.where('design_id', '=', designId) : query)
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

	createDesignReview(values: Insertable<ProductServiceDesignReviews>) {
		return this.insertDesignReview(values);
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

	createDevelopmentPlan(values: Insertable<ProductServiceDevelopmentPlans>) {
		return this.insertDevelopmentPlan(values);
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

	createLaunchPlan(values: Insertable<ProductServiceLaunchPlans>) {
		return this.insertLaunchPlan(values);
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

	createLifecycleReview(values: Insertable<ProductServiceLifecycleReviews>) {
		return this.insertLifecycleReview(values);
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

	createRetirementPlan(values: Insertable<ProductServiceRetirementPlans>) {
		return this.insertRetirementPlan(values);
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

	createInnovationExperiment(values: Insertable<ProductServiceInnovationExperiments>) {
		return this.insertInnovationExperiment(values);
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

	async getWorkspace(organisationId: string) {
		const [
			designs,
			designReviews,
			developmentPlans,
			launchPlans,
			lifecycleReviews,
			retirementPlans,
			innovationExperiments
		] = await Promise.all([
			this.listDesigns(organisationId),
			this.listDesignReviews(organisationId),
			this.listDevelopmentPlans(organisationId),
			this.listLaunchPlans(organisationId),
			this.listLifecycleReviews(organisationId),
			this.listRetirementPlans(organisationId),
			this.listInnovationExperiments(organisationId)
		]);
		return {
			designs,
			designReviews,
			developmentPlans,
			launchPlans,
			lifecycleReviews,
			retirementPlans,
			innovationExperiments
		};
	}
}
