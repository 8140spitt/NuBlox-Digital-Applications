import type { Insertable, Selectable, Updateable } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';
import type {
	StrategyKpis,
	StrategyKpiObservations,
	StrategyPerformanceActions,
	StrategyPerformanceBenchmarkResults,
	StrategyPerformanceBenchmarks,
	StrategyPerformanceBenefitMeasurements,
	StrategyPerformanceBenefits,
	StrategyPerformanceFrameworkKpis,
	StrategyPerformanceFrameworks,
	StrategyPerformancePackKpis,
	StrategyPerformancePacks,
	StrategyPerformancePeriods,
	StrategyPerformanceReviews,
	StrategyPerformanceVariances
} from '$lib/server/db/generated/strategy';

export type PerformanceFrameworkRecord = Selectable<StrategyPerformanceFrameworks>;
export type PerformanceFrameworkKpiRecord = Selectable<StrategyPerformanceFrameworkKpis>;
export type PerformancePeriodRecord = Selectable<StrategyPerformancePeriods>;
export type PerformancePackRecord = Selectable<StrategyPerformancePacks>;
export type PerformancePackKpiRecord = Selectable<StrategyPerformancePackKpis>;
export type PerformanceVarianceRecord = Selectable<StrategyPerformanceVariances>;
export type PerformanceActionRecord = Selectable<StrategyPerformanceActions>;
export type PerformanceReviewRecord = Selectable<StrategyPerformanceReviews>;
export type PerformanceBenchmarkRecord = Selectable<StrategyPerformanceBenchmarks>;
export type PerformanceBenchmarkResultRecord = Selectable<StrategyPerformanceBenchmarkResults>;
export type PerformanceBenefitRecord = Selectable<StrategyPerformanceBenefits>;
export type PerformanceBenefitMeasurementRecord = Selectable<StrategyPerformanceBenefitMeasurements>;
export type PerformanceKpiRecord = Selectable<StrategyKpis>;
export type PerformanceObservationRecord = Selectable<StrategyKpiObservations>;

async function insertedId(result: { insertId?: bigint | undefined }, label: string): Promise<string> {
	const id = result.insertId?.toString();
	if (!id) throw new Error(`${label} insert did not return an identifier.`);
	return id;
}

export class EnterprisePerformanceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	listFrameworks(organisationId: string): Promise<PerformanceFrameworkRecord[]> {
		return this.db
			.selectFrom('strategy_performance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.orderBy('framework_code', 'asc')
			.orderBy('version_number', 'desc')
			.execute();
	}

	findFrameworkByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('strategy_performance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	findLatestFrameworkVersion(organisationId: string, frameworkCode: string) {
		return this.db
			.selectFrom('strategy_performance_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('framework_code', '=', frameworkCode)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
	}

	async insertFramework(values: Insertable<StrategyPerformanceFrameworks>) {
		const result = await this.db.insertInto('strategy_performance_frameworks').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance framework');
		return this.db.selectFrom('strategy_performance_frameworks').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateFramework(organisationId: string, id: string, values: Updateable<StrategyPerformanceFrameworks>) {
		await this.db.updateTable('strategy_performance_frameworks').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_frameworks').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listFrameworkKpis(frameworkId: string): Promise<PerformanceFrameworkKpiRecord[]> {
		return this.db.selectFrom('strategy_performance_framework_kpis').selectAll().where('performance_framework_id', '=', frameworkId).orderBy('display_order', 'asc').execute();
	}

	async insertFrameworkKpi(values: Insertable<StrategyPerformanceFrameworkKpis>) {
		const result = await this.db.insertInto('strategy_performance_framework_kpis').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance framework KPI');
		return this.db.selectFrom('strategy_performance_framework_kpis').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	listApprovedKpis(organisationId: string): Promise<PerformanceKpiRecord[]> {
		return this.db.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', organisationId).where('lifecycle_status', '=', 'approved').orderBy('kpi_code', 'asc').execute();
	}

	findKpiByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	listObservationsForKpi(kpiId: string): Promise<PerformanceObservationRecord[]> {
		return this.db.selectFrom('strategy_kpi_observations').selectAll().where('strategy_kpi_id', '=', kpiId).orderBy('observed_on', 'desc').orderBy('created_at', 'desc').execute();
	}

	findObservationByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_kpi_observations').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	listPeriods(frameworkId: string): Promise<PerformancePeriodRecord[]> {
		return this.db.selectFrom('strategy_performance_periods').selectAll().where('performance_framework_id', '=', frameworkId).orderBy('period_end', 'desc').execute();
	}

	findPeriodByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_periods').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertPeriod(values: Insertable<StrategyPerformancePeriods>) {
		const result = await this.db.insertInto('strategy_performance_periods').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance period');
		return this.db.selectFrom('strategy_performance_periods').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updatePeriod(organisationId: string, id: string, values: Updateable<StrategyPerformancePeriods>) {
		await this.db.updateTable('strategy_performance_periods').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_periods').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listPacks(periodIds: string[]): Promise<PerformancePackRecord[]> {
		if (!periodIds.length) return Promise.resolve([]);
		return this.db.selectFrom('strategy_performance_packs').selectAll().where('performance_period_id', 'in', periodIds).orderBy('created_at', 'desc').execute();
	}

	findPackByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_packs').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertPack(values: Insertable<StrategyPerformancePacks>) {
		const result = await this.db.insertInto('strategy_performance_packs').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance pack');
		return this.db.selectFrom('strategy_performance_packs').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updatePack(organisationId: string, id: string, values: Updateable<StrategyPerformancePacks>) {
		await this.db.updateTable('strategy_performance_packs').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_packs').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listPackKpis(packIds: string[]): Promise<PerformancePackKpiRecord[]> {
		if (!packIds.length) return Promise.resolve([]);
		return this.db.selectFrom('strategy_performance_pack_kpis').selectAll().where('performance_pack_id', 'in', packIds).orderBy('id', 'asc').execute();
	}

	async insertPackKpi(values: Insertable<StrategyPerformancePackKpis>) {
		const result = await this.db.insertInto('strategy_performance_pack_kpis').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance pack KPI');
		return this.db.selectFrom('strategy_performance_pack_kpis').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	listVariances(organisationId: string): Promise<PerformanceVarianceRecord[]> {
		return this.db.selectFrom('strategy_performance_variances').selectAll().where('organisation_id', '=', organisationId).orderBy('created_at', 'desc').execute();
	}

	findVarianceByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_variances').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertVariance(values: Insertable<StrategyPerformanceVariances>) {
		const result = await this.db.insertInto('strategy_performance_variances').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance variance');
		return this.db.selectFrom('strategy_performance_variances').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateVariance(organisationId: string, id: string, values: Updateable<StrategyPerformanceVariances>) {
		await this.db.updateTable('strategy_performance_variances').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_variances').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listActions(organisationId: string): Promise<PerformanceActionRecord[]> {
		return this.db.selectFrom('strategy_performance_actions').selectAll().where('organisation_id', '=', organisationId).orderBy('due_date', 'asc').execute();
	}

	findActionByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_actions').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertAction(values: Insertable<StrategyPerformanceActions>) {
		const result = await this.db.insertInto('strategy_performance_actions').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance action');
		return this.db.selectFrom('strategy_performance_actions').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateAction(organisationId: string, id: string, values: Updateable<StrategyPerformanceActions>) {
		await this.db.updateTable('strategy_performance_actions').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_actions').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listReviews(organisationId: string): Promise<PerformanceReviewRecord[]> {
		return this.db.selectFrom('strategy_performance_reviews').selectAll().where('organisation_id', '=', organisationId).orderBy('review_date', 'desc').execute();
	}

	async insertReview(values: Insertable<StrategyPerformanceReviews>) {
		const result = await this.db.insertInto('strategy_performance_reviews').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance review');
		return this.db.selectFrom('strategy_performance_reviews').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateReview(organisationId: string, id: string, values: Updateable<StrategyPerformanceReviews>) {
		await this.db.updateTable('strategy_performance_reviews').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_reviews').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listBenchmarks(organisationId: string): Promise<PerformanceBenchmarkRecord[]> {
		return this.db.selectFrom('strategy_performance_benchmarks').selectAll().where('organisation_id', '=', organisationId).orderBy('period_end', 'desc').execute();
	}

	findBenchmarkByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_benchmarks').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertBenchmark(values: Insertable<StrategyPerformanceBenchmarks>) {
		const result = await this.db.insertInto('strategy_performance_benchmarks').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance benchmark');
		return this.db.selectFrom('strategy_performance_benchmarks').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	listBenchmarkResults(organisationId: string): Promise<PerformanceBenchmarkResultRecord[]> {
		return this.db.selectFrom('strategy_performance_benchmark_results').selectAll().where('organisation_id', '=', organisationId).orderBy('created_at', 'desc').execute();
	}

	async insertBenchmarkResult(values: Insertable<StrategyPerformanceBenchmarkResults>) {
		const result = await this.db.insertInto('strategy_performance_benchmark_results').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance benchmark result');
		return this.db.selectFrom('strategy_performance_benchmark_results').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	listBenefits(organisationId: string): Promise<PerformanceBenefitRecord[]> {
		return this.db.selectFrom('strategy_performance_benefits').selectAll().where('organisation_id', '=', organisationId).orderBy('target_date', 'asc').execute();
	}

	findBenefitByPublicId(organisationId: string, publicId: string) {
		return this.db.selectFrom('strategy_performance_benefits').selectAll().where('organisation_id', '=', organisationId).where('public_id', '=', publicId).executeTakeFirst();
	}

	async insertBenefit(values: Insertable<StrategyPerformanceBenefits>) {
		const result = await this.db.insertInto('strategy_performance_benefits').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance benefit');
		return this.db.selectFrom('strategy_performance_benefits').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}

	async updateBenefit(organisationId: string, id: string, values: Updateable<StrategyPerformanceBenefits>) {
		await this.db.updateTable('strategy_performance_benefits').set(values).where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
		return this.db.selectFrom('strategy_performance_benefits').selectAll().where('organisation_id', '=', organisationId).where('id', '=', id).executeTakeFirstOrThrow();
	}

	listBenefitMeasurements(organisationId: string): Promise<PerformanceBenefitMeasurementRecord[]> {
		return this.db.selectFrom('strategy_performance_benefit_measurements').selectAll().where('organisation_id', '=', organisationId).orderBy('measured_on', 'desc').execute();
	}

	async insertBenefitMeasurement(values: Insertable<StrategyPerformanceBenefitMeasurements>) {
		const result = await this.db.insertInto('strategy_performance_benefit_measurements').values(values).executeTakeFirstOrThrow();
		const id = await insertedId(result, 'Performance benefit measurement');
		return this.db.selectFrom('strategy_performance_benefit_measurements').selectAll().where('id', '=', id).executeTakeFirstOrThrow();
	}
}
