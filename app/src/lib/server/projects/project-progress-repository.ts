import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProgressPeriodStatus = 'open' | 'submitted' | 'approved';
export type ProgressMeasurementMethod =
	'manual_percent' | 'milestone_0_100' | 'milestone_50_50' | 'quantity';
export type EarnedValueBaselineStatus = 'draft' | 'approved' | 'superseded';

export type ProgressPeriodRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	periodNumber: number;
	label: string;
	dataDate: Date;
	status: ProgressPeriodStatus;
	createdByMemberId: string;
	createdAt: Date;
	submittedByMemberId: string | null;
	submittedAt: Date | null;
	approvedByMemberId: string | null;
	approvedAt: Date | null;
};

export type ActivityProgressMeasurementRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	progressPeriodId: string;
	progressPeriodPublicId: string;
	dataDate: Date;
	activityId: string;
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	activityKind: string;
	wbsCode: string;
	publicId: string;
	measurementMethod: ProgressMeasurementMethod;
	percentComplete: string;
	actualStartOn: Date | null;
	actualFinishOn: Date | null;
	remainingDurationDays: string | null;
	quantityComplete: string | null;
	quantityTotal: string | null;
	quantityUnit: string | null;
	commentary: string | null;
};

export type EarnedValueBaselineRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	baselineNumber: number;
	name: string;
	sourcePlanBaselineId: string;
	sourcePlanBaselinePublicId: string;
	sourcePlanBaselineNumber: number;
	sourcePlanBaselineName: string;
	currencyCode: string;
	controlBudgetSnapshot: string;
	status: EarnedValueBaselineStatus;
	createdByMemberId: string;
	createdAt: Date;
	approvedByMemberId: string | null;
	approvedAt: Date | null;
	allocatedBudget: string;
};

export type EarnedValueAllocationRecord = {
	id: string;
	earnedValueBaselineId: string;
	sourcePlanBaselineId: string;
	sourceActivityId: string;
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	activityKind: string;
	wbsCode: string;
	plannedStartOn: Date;
	plannedFinishOn: Date;
	plannedDurationDays: string;
	budgetAtCompletionAmount: string;
};

export type PlanBaselineActivityRecord = {
	baselineId: string;
	sourceActivityId: string;
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	activityKind: string;
	wbsCode: string;
	plannedStartOn: Date;
	plannedFinishOn: Date;
	plannedDurationDays: string;
};

function mapPeriod(row: {
	id: string;
	organisation_id: string;
	project_id: string;
	public_id: string;
	period_number: number;
	label: string;
	data_date: Date;
	lifecycle_status: string;
	created_by_member_id: string;
	created_at: Date;
	submitted_by_member_id: string | null;
	submitted_at: Date | null;
	approved_by_member_id: string | null;
	approved_at: Date | null;
}): ProgressPeriodRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		projectId: row.project_id,
		publicId: row.public_id,
		periodNumber: row.period_number,
		label: row.label,
		dataDate: row.data_date,
		status: row.lifecycle_status as ProgressPeriodStatus,
		createdByMemberId: row.created_by_member_id,
		createdAt: row.created_at,
		submittedByMemberId: row.submitted_by_member_id,
		submittedAt: row.submitted_at,
		approvedByMemberId: row.approved_by_member_id,
		approvedAt: row.approved_at
	};
}

export class ProjectProgressRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listProgressPeriods(projectId: string): Promise<ProgressPeriodRecord[]> {
		const rows = await this.db
			.selectFrom('project_progress_periods')
			.selectAll()
			.where('project_id', '=', projectId)
			.orderBy('data_date', 'desc')
			.orderBy('period_number', 'desc')
			.execute();
		return rows.map(mapPeriod);
	}

	async findProgressPeriodByPublicId(
		projectId: string,
		publicId: string
	): Promise<ProgressPeriodRecord | null> {
		const row = await this.db
			.selectFrom('project_progress_periods')
			.selectAll()
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapPeriod(row) : null;
	}

	async listApprovedPeriodsUpTo(
		projectId: string,
		dataDate: Date
	): Promise<ProgressPeriodRecord[]> {
		const rows = await this.db
			.selectFrom('project_progress_periods')
			.selectAll()
			.where('project_id', '=', projectId)
			.where('lifecycle_status', '=', 'approved')
			.where('data_date', '<=', dataDate)
			.orderBy('data_date', 'asc')
			.orderBy('period_number', 'asc')
			.execute();
		return rows.map(mapPeriod);
	}

	async nextProgressPeriodNumber(projectId: string): Promise<number> {
		const row = await this.db
			.selectFrom('project_progress_periods')
			.select(({ fn }) => fn.max<number>('period_number').as('maxPeriodNumber'))
			.where('project_id', '=', projectId)
			.executeTakeFirst();
		return (row?.maxPeriodNumber ?? 0) + 1;
	}

	async insertProgressPeriod(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		periodNumber: number;
		label: string;
		dataDate: Date;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_progress_periods')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				period_number: input.periodNumber,
				label: input.label,
				data_date: input.dataDate,
				lifecycle_status: 'open',
				created_by_member_id: input.createdByMemberId,
				submitted_by_member_id: null,
				submitted_at: null,
				approved_by_member_id: null,
				approved_at: null
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined)
			throw new Error('MySQL did not return the progress period ID.');
		return result.insertId.toString();
	}

	async listMeasurements(periodId: string): Promise<ActivityProgressMeasurementRecord[]> {
		return this.listMeasurementsForPeriods([periodId]);
	}

	async listMeasurementsForPeriods(
		periodIds: readonly string[]
	): Promise<ActivityProgressMeasurementRecord[]> {
		if (periodIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('project_activity_progress_measurements as measurement')
			.innerJoin(
				'project_progress_periods as period',
				'period.id',
				'measurement.progress_period_id'
			)
			.innerJoin('project_plan_activities as activity', 'activity.id', 'measurement.activity_id')
			.innerJoin('project_wbs_nodes as wbs', 'wbs.id', 'activity.wbs_node_id')
			.select([
				'measurement.id as id',
				'measurement.organisation_id as organisation_id',
				'measurement.project_id as project_id',
				'measurement.progress_period_id as progress_period_id',
				'period.public_id as progress_period_public_id',
				'period.data_date as data_date',
				'measurement.activity_id as activity_id',
				'activity.public_id as activity_public_id',
				'activity.activity_code as activity_code',
				'activity.name as activity_name',
				'activity.activity_kind as activity_kind',
				'wbs.wbs_code as wbs_code',
				'measurement.public_id as public_id',
				'measurement.measurement_method as measurement_method',
				'measurement.percent_complete as percent_complete',
				'measurement.actual_start_on as actual_start_on',
				'measurement.actual_finish_on as actual_finish_on',
				'measurement.remaining_duration_days as remaining_duration_days',
				'measurement.quantity_complete as quantity_complete',
				'measurement.quantity_total as quantity_total',
				'measurement.quantity_unit as quantity_unit',
				'measurement.commentary as commentary'
			])
			.where('measurement.progress_period_id', 'in', [...periodIds])
			.orderBy('period.data_date', 'asc')
			.orderBy('activity.activity_code', 'asc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			organisationId: row.organisation_id,
			projectId: row.project_id,
			progressPeriodId: row.progress_period_id,
			progressPeriodPublicId: row.progress_period_public_id,
			dataDate: row.data_date,
			activityId: row.activity_id,
			activityPublicId: row.activity_public_id,
			activityCode: row.activity_code,
			activityName: row.activity_name,
			activityKind: row.activity_kind,
			wbsCode: row.wbs_code,
			publicId: row.public_id,
			measurementMethod: row.measurement_method as ProgressMeasurementMethod,
			percentComplete: row.percent_complete,
			actualStartOn: row.actual_start_on,
			actualFinishOn: row.actual_finish_on,
			remainingDurationDays: row.remaining_duration_days,
			quantityComplete: row.quantity_complete,
			quantityTotal: row.quantity_total,
			quantityUnit: row.quantity_unit,
			commentary: row.commentary
		}));
	}

	async upsertMeasurement(input: {
		organisationId: string;
		projectId: string;
		progressPeriodId: string;
		activityId: string;
		publicId: string;
		measurementMethod: ProgressMeasurementMethod;
		percentComplete: string;
		actualStartOn: Date | null;
		actualFinishOn: Date | null;
		remainingDurationDays: string | null;
		quantityComplete: string | null;
		quantityTotal: string | null;
		quantityUnit: string | null;
		commentary: string | null;
		memberId: string;
	}): Promise<void> {
		await this.db
			.insertInto('project_activity_progress_measurements')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				progress_period_id: input.progressPeriodId,
				activity_id: input.activityId,
				public_id: input.publicId,
				measurement_method: input.measurementMethod,
				percent_complete: input.percentComplete,
				actual_start_on: input.actualStartOn,
				actual_finish_on: input.actualFinishOn,
				remaining_duration_days: input.remainingDurationDays,
				quantity_complete: input.quantityComplete,
				quantity_total: input.quantityTotal,
				quantity_unit: input.quantityUnit,
				commentary: input.commentary,
				created_by_member_id: input.memberId,
				updated_by_member_id: input.memberId
			})
			.onDuplicateKeyUpdate({
				measurement_method: input.measurementMethod,
				percent_complete: input.percentComplete,
				actual_start_on: input.actualStartOn,
				actual_finish_on: input.actualFinishOn,
				remaining_duration_days: input.remainingDurationDays,
				quantity_complete: input.quantityComplete,
				quantity_total: input.quantityTotal,
				quantity_unit: input.quantityUnit,
				commentary: input.commentary,
				updated_by_member_id: input.memberId
			})
			.execute();
	}

	async submitPeriod(input: {
		projectId: string;
		periodId: string;
		memberId: string;
		submittedAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_progress_periods')
			.set({
				lifecycle_status: 'submitted',
				submitted_by_member_id: input.memberId,
				submitted_at: input.submittedAt
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.periodId)
			.where('lifecycle_status', '=', 'open')
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async approvePeriod(input: {
		projectId: string;
		periodId: string;
		memberId: string;
		approvedAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_progress_periods')
			.set({
				lifecycle_status: 'approved',
				approved_by_member_id: input.memberId,
				approved_at: input.approvedAt
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.periodId)
			.where('lifecycle_status', '=', 'submitted')
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async nextEarnedValueBaselineNumber(projectId: string): Promise<number> {
		const row = await this.db
			.selectFrom('project_earned_value_baselines')
			.select(({ fn }) => fn.max<number>('baseline_number').as('maxBaselineNumber'))
			.where('project_id', '=', projectId)
			.executeTakeFirst();
		return (row?.maxBaselineNumber ?? 0) + 1;
	}

	async listEarnedValueBaselines(projectId: string): Promise<EarnedValueBaselineRecord[]> {
		const rows = await this.db
			.selectFrom('project_earned_value_baselines as ev')
			.innerJoin('project_plan_baselines as plan', 'plan.id', 'ev.source_plan_baseline_id')
			.select([
				'ev.id as id',
				'ev.organisation_id as organisation_id',
				'ev.project_id as project_id',
				'ev.public_id as public_id',
				'ev.baseline_number as baseline_number',
				'ev.name as name',
				'ev.source_plan_baseline_id as source_plan_baseline_id',
				'plan.public_id as source_plan_baseline_public_id',
				'plan.baseline_number as source_plan_baseline_number',
				'plan.name as source_plan_baseline_name',
				'ev.currency_code as currency_code',
				'ev.control_budget_snapshot as control_budget_snapshot',
				'ev.lifecycle_status as lifecycle_status',
				'ev.created_by_member_id as created_by_member_id',
				'ev.created_at as created_at',
				'ev.approved_by_member_id as approved_by_member_id',
				'ev.approved_at as approved_at'
			])
			.select((eb) =>
				eb
					.selectFrom('project_earned_value_baseline_allocations as allocation')
					.select(({ fn }) =>
						fn
							.coalesce(fn.sum<string>('allocation.budget_at_completion_amount'), eb.val('0.0000'))
							.as('allocated')
					)
					.whereRef('allocation.earned_value_baseline_id', '=', 'ev.id')
					.as('allocated_budget')
			)
			.where('ev.project_id', '=', projectId)
			.orderBy('ev.baseline_number', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			organisationId: row.organisation_id,
			projectId: row.project_id,
			publicId: row.public_id,
			baselineNumber: row.baseline_number,
			name: row.name,
			sourcePlanBaselineId: row.source_plan_baseline_id,
			sourcePlanBaselinePublicId: row.source_plan_baseline_public_id,
			sourcePlanBaselineNumber: row.source_plan_baseline_number,
			sourcePlanBaselineName: row.source_plan_baseline_name,
			currencyCode: row.currency_code,
			controlBudgetSnapshot: row.control_budget_snapshot,
			status: row.lifecycle_status as EarnedValueBaselineStatus,
			createdByMemberId: row.created_by_member_id,
			createdAt: row.created_at,
			approvedByMemberId: row.approved_by_member_id,
			approvedAt: row.approved_at,
			allocatedBudget: String(row.allocated_budget ?? '0.0000')
		}));
	}

	async findEarnedValueBaselineByPublicId(
		projectId: string,
		publicId: string
	): Promise<EarnedValueBaselineRecord | null> {
		return (
			(await this.listEarnedValueBaselines(projectId)).find((row) => row.publicId === publicId) ??
			null
		);
	}

	async findApprovedEarnedValueBaseline(
		projectId: string
	): Promise<EarnedValueBaselineRecord | null> {
		return (
			(await this.listEarnedValueBaselines(projectId)).find((row) => row.status === 'approved') ??
			null
		);
	}

	async insertEarnedValueBaseline(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		baselineNumber: number;
		name: string;
		sourcePlanBaselineId: string;
		currencyCode: string;
		controlBudgetSnapshot: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_earned_value_baselines')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				baseline_number: input.baselineNumber,
				name: input.name,
				source_plan_baseline_id: input.sourcePlanBaselineId,
				currency_code: input.currencyCode,
				control_budget_snapshot: input.controlBudgetSnapshot,
				lifecycle_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				approved_by_member_id: null,
				approved_at: null
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined)
			throw new Error('MySQL did not return the earned-value baseline ID.');
		return result.insertId.toString();
	}

	async listPlanBaselineActivities(
		projectId: string,
		planBaselineId: string
	): Promise<PlanBaselineActivityRecord[]> {
		const rows = await this.db
			.selectFrom('project_plan_baseline_activities')
			.select([
				'baseline_id',
				'source_activity_id',
				'activity_public_id',
				'activity_code',
				'name',
				'activity_kind',
				'wbs_code',
				'planned_start_on',
				'planned_finish_on',
				'planned_duration_days'
			])
			.where('project_id', '=', projectId)
			.where('baseline_id', '=', planBaselineId)
			.orderBy('activity_code', 'asc')
			.execute();
		return rows.map((row) => ({
			baselineId: row.baseline_id,
			sourceActivityId: row.source_activity_id,
			activityPublicId: row.activity_public_id,
			activityCode: row.activity_code,
			activityName: row.name,
			activityKind: row.activity_kind,
			wbsCode: row.wbs_code,
			plannedStartOn: row.planned_start_on,
			plannedFinishOn: row.planned_finish_on,
			plannedDurationDays: row.planned_duration_days
		}));
	}

	async listEarnedValueAllocations(
		projectId: string,
		earnedValueBaselineId: string
	): Promise<EarnedValueAllocationRecord[]> {
		const rows = await this.db
			.selectFrom('project_earned_value_baseline_allocations as allocation')
			.innerJoin('project_plan_baseline_activities as activity', (join) =>
				join
					.onRef('activity.baseline_id', '=', 'allocation.source_plan_baseline_id')
					.onRef('activity.source_activity_id', '=', 'allocation.source_activity_id')
			)
			.select([
				'allocation.id as id',
				'allocation.earned_value_baseline_id as earned_value_baseline_id',
				'allocation.source_plan_baseline_id as source_plan_baseline_id',
				'allocation.source_activity_id as source_activity_id',
				'activity.activity_public_id as activity_public_id',
				'activity.activity_code as activity_code',
				'activity.name as activity_name',
				'activity.activity_kind as activity_kind',
				'activity.wbs_code as wbs_code',
				'activity.planned_start_on as planned_start_on',
				'activity.planned_finish_on as planned_finish_on',
				'activity.planned_duration_days as planned_duration_days',
				'allocation.budget_at_completion_amount as budget_at_completion_amount'
			])
			.where('allocation.project_id', '=', projectId)
			.where('allocation.earned_value_baseline_id', '=', earnedValueBaselineId)
			.orderBy('activity.activity_code', 'asc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			earnedValueBaselineId: row.earned_value_baseline_id,
			sourcePlanBaselineId: row.source_plan_baseline_id,
			sourceActivityId: row.source_activity_id,
			activityPublicId: row.activity_public_id,
			activityCode: row.activity_code,
			activityName: row.activity_name,
			activityKind: row.activity_kind,
			wbsCode: row.wbs_code,
			plannedStartOn: row.planned_start_on,
			plannedFinishOn: row.planned_finish_on,
			plannedDurationDays: row.planned_duration_days,
			budgetAtCompletionAmount: row.budget_at_completion_amount
		}));
	}

	async upsertEarnedValueAllocation(input: {
		organisationId: string;
		projectId: string;
		earnedValueBaselineId: string;
		sourcePlanBaselineId: string;
		sourceActivityId: string;
		budgetAtCompletionAmount: string;
		memberId: string;
	}): Promise<void> {
		await this.db
			.insertInto('project_earned_value_baseline_allocations')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				earned_value_baseline_id: input.earnedValueBaselineId,
				source_plan_baseline_id: input.sourcePlanBaselineId,
				source_activity_id: input.sourceActivityId,
				budget_at_completion_amount: input.budgetAtCompletionAmount,
				created_by_member_id: input.memberId
			})
			.onDuplicateKeyUpdate({ budget_at_completion_amount: input.budgetAtCompletionAmount })
			.execute();
	}

	async deleteEarnedValueAllocation(
		projectId: string,
		earnedValueBaselineId: string,
		sourceActivityId: string
	): Promise<boolean> {
		const result = await this.db
			.deleteFrom('project_earned_value_baseline_allocations')
			.where('project_id', '=', projectId)
			.where('earned_value_baseline_id', '=', earnedValueBaselineId)
			.where('source_activity_id', '=', sourceActivityId)
			.executeTakeFirst();
		return result.numDeletedRows === 1n;
	}

	async approveEarnedValueBaseline(input: {
		projectId: string;
		baselineId: string;
		memberId: string;
		approvedAt: Date;
	}): Promise<boolean> {
		await this.db
			.updateTable('project_earned_value_baselines')
			.set({ lifecycle_status: 'superseded' })
			.where('project_id', '=', input.projectId)
			.where('id', '!=', input.baselineId)
			.where('lifecycle_status', '=', 'approved')
			.execute();
		const result = await this.db
			.updateTable('project_earned_value_baselines')
			.set({
				lifecycle_status: 'approved',
				approved_by_member_id: input.memberId,
				approved_at: input.approvedAt
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.baselineId)
			.where('lifecycle_status', '=', 'draft')
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}
}
