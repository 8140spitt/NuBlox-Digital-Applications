import type { DatabaseExecutor } from '$lib/server/db/executor';

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined)
		throw new Error(`MySQL did not return the inserted ${label} ID.`);
	return result.insertId.toString();
}

export type FinancialCostCodeRecord = {
	id: string;
	publicId: string;
	code: string;
	name: string;
	categoryCode: string;
	categoryName: string;
};

export type BudgetLineFact = {
	budgetId: string;
	versionId: string;
	versionNumber: number;
	costCodeId: string;
	currencyCode: string;
	budgetAmount: string;
};

export type BudgetAdjustmentFact = {
	budgetId: string;
	costCodeId: string;
	adjustmentAmount: string;
	effectiveOn: Date;
};

export type CommitmentItemFact = {
	itemId: string;
	quantity: string;
	unitRate: string;
	currencyCode: string;
};

export type CommitmentAllocationFact = {
	itemId: string;
	costCodeId: string;
	allocatedNetAmount: string;
};

export type ConfirmedReceiptFact = {
	itemId: string;
	quantityReceived: string;
	quantityRejected: string;
	receivedAt: Date;
};

export type LabourActualFact = {
	costCodeId: string;
	allocatedCostAmount: string;
	currencyCode: string;
};

export type DirectCostFact = {
	id: string;
	costCodeId: string;
	amount: string;
	currencyCode: string;
};

export type DirectCostReversalFact = {
	directCostId: string;
	reversalAmount: string;
};

export type ReportingPeriodRecord = {
	id: string;
	publicId: string;
	periodLabel: string;
	periodStart: Date;
	periodEnd: Date;
	status: string;
	closedAt: Date | null;
};

export type ForecastRecord = {
	id: string;
	publicId: string;
	periodId: string;
	periodPublicId: string;
	periodLabel: string;
	periodStart: Date;
	periodEnd: Date;
	versionNumber: number;
	currencyCode: string;
	forecastRevenueAmount: string;
	status: string;
	createdAt: Date;
	approvedAt: Date | null;
	lockedAt: Date | null;
};

export type ForecastLineRecord = {
	id: string;
	forecastId: string;
	costCodeId: string;
	costCodePublicId: string;
	costCode: string;
	costCodeName: string;
	controlBudgetSnapshot: string;
	actualCostSnapshot: string;
	remainingCommitmentSnapshot: string;
	approvedChangeSnapshot: string;
	pendingChangeExposureSnapshot: string;
	forecastToCompleteAmount: string;
	commentary: string | null;
};

export type CashFlowLineRecord = {
	id: string;
	forecastId: string;
	lineNumber: number;
	costCodeId: string | null;
	costCodePublicId: string | null;
	costCode: string | null;
	flowDate: Date;
	direction: string;
	category: string;
	amount: string;
	commentary: string | null;
};

export class ProjectFinancialControlRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listCostCodes(
		organisationId: string,
		projectId: string
	): Promise<FinancialCostCodeRecord[]> {
		return this.db
			.selectFrom('project_cost_codes as costCode')
			.innerJoin(
				'commercial_cost_categories as category',
				'category.id',
				'costCode.commercial_cost_category_id'
			)
			.select([
				'costCode.id as id',
				'costCode.public_id as publicId',
				'costCode.code as code',
				'costCode.name as name',
				'category.code as categoryCode',
				'category.name as categoryName'
			])
			.where('costCode.organisation_id', '=', organisationId)
			.where('costCode.project_id', '=', projectId)
			.where('costCode.is_active', '=', 1)
			.orderBy('costCode.sort_order')
			.orderBy('costCode.code')
			.execute();
	}

	async listApprovedBudgetFacts(
		organisationId: string,
		projectId: string
	): Promise<BudgetLineFact[]> {
		return this.db
			.selectFrom('project_budgets as budget')
			.innerJoin('project_budget_versions as version', (join) =>
				join
					.onRef('version.project_budget_id', '=', 'budget.id')
					.onRef('version.organisation_id', '=', 'budget.organisation_id')
			)
			.innerJoin('project_budget_lines as line', (join) =>
				join
					.onRef('line.project_budget_version_id', '=', 'version.id')
					.onRef('line.organisation_id', '=', 'version.organisation_id')
			)
			.select([
				'budget.id as budgetId',
				'version.id as versionId',
				'version.version_number as versionNumber',
				'line.project_cost_code_id as costCodeId',
				'version.currency_code as currencyCode',
				'line.budget_amount as budgetAmount'
			])
			.where('budget.organisation_id', '=', organisationId)
			.where('budget.project_id', '=', projectId)
			.where('budget.lifecycle_status', '=', 'active')
			.where('version.version_status', '=', 'approved')
			.execute();
	}

	async listApprovedBudgetAdjustmentFacts(
		organisationId: string,
		projectId: string,
		cutoff: Date
	): Promise<BudgetAdjustmentFact[]> {
		return this.db
			.selectFrom('project_budget_adjustments as adjustment')
			.innerJoin('project_budgets as budget', (join) =>
				join
					.onRef('budget.id', '=', 'adjustment.project_budget_id')
					.onRef('budget.organisation_id', '=', 'adjustment.organisation_id')
			)
			.innerJoin('project_budget_adjustment_items as item', (join) =>
				join
					.onRef('item.project_budget_adjustment_id', '=', 'adjustment.id')
					.onRef('item.organisation_id', '=', 'adjustment.organisation_id')
			)
			.select([
				'budget.id as budgetId',
				'item.project_cost_code_id as costCodeId',
				'item.adjustment_amount as adjustmentAmount',
				'adjustment.effective_on as effectiveOn'
			])
			.where('adjustment.organisation_id', '=', organisationId)
			.where('budget.project_id', '=', projectId)
			.where('adjustment.lifecycle_status', '=', 'approved')
			.where('adjustment.effective_on', '<=', cutoff)
			.execute();
	}

	async listIssuedCommitmentItems(
		organisationId: string,
		projectId: string,
		cutoff: Date
	): Promise<CommitmentItemFact[]> {
		return this.db
			.selectFrom('purchase_orders as purchaseOrder')
			.innerJoin('purchase_order_versions as version', (join) =>
				join
					.onRef('version.purchase_order_id', '=', 'purchaseOrder.id')
					.onRef('version.organisation_id', '=', 'purchaseOrder.organisation_id')
			)
			.innerJoin('purchase_order_items as item', (join) =>
				join
					.onRef('item.purchase_order_version_id', '=', 'version.id')
					.onRef('item.organisation_id', '=', 'version.organisation_id')
			)
			.select([
				'item.id as itemId',
				'item.quantity as quantity',
				'item.unit_rate as unitRate',
				'purchaseOrder.currency_code as currencyCode'
			])
			.where('purchaseOrder.organisation_id', '=', organisationId)
			.where('purchaseOrder.project_id', '=', projectId)
			.where('purchaseOrder.lifecycle_status', '=', 'active')
			.where('version.version_status', '=', 'issued')
			.where((eb) =>
				eb.or([eb('version.order_date', 'is', null), eb('version.order_date', '<=', cutoff)])
			)
			.execute();
	}

	async listCommitmentAllocations(
		organisationId: string,
		itemIds: readonly string[]
	): Promise<CommitmentAllocationFact[]> {
		if (itemIds.length === 0) return [];
		return this.db
			.selectFrom('purchase_order_item_cost_allocations')
			.select([
				'purchase_order_item_id as itemId',
				'project_cost_code_id as costCodeId',
				'allocated_net_amount as allocatedNetAmount'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_item_id', 'in', itemIds)
			.execute();
	}

	async listConfirmedReceipts(
		organisationId: string,
		itemIds: readonly string[],
		cutoffEnd: Date
	): Promise<ConfirmedReceiptFact[]> {
		if (itemIds.length === 0) return [];
		return this.db
			.selectFrom('purchase_order_receipt_items as receiptItem')
			.innerJoin('purchase_order_receipts as receipt', (join) =>
				join
					.onRef('receipt.id', '=', 'receiptItem.purchase_order_receipt_id')
					.onRef('receipt.organisation_id', '=', 'receiptItem.organisation_id')
			)
			.select([
				'receiptItem.purchase_order_item_id as itemId',
				'receiptItem.quantity_received as quantityReceived',
				'receiptItem.quantity_rejected as quantityRejected',
				'receipt.received_at as receivedAt'
			])
			.where('receiptItem.organisation_id', '=', organisationId)
			.where('receiptItem.purchase_order_item_id', 'in', itemIds)
			.where('receipt.receipt_status', '=', 'confirmed')
			.where('receipt.received_at', '<=', cutoffEnd)
			.execute();
	}

	async listLabourActuals(
		organisationId: string,
		projectId: string,
		cutoff: Date
	): Promise<LabourActualFact[]> {
		return this.db
			.selectFrom('timesheet_cost_code_allocations as allocation')
			.innerJoin('timesheet_entry_cost_snapshots as snapshot', (join) =>
				join
					.onRef('snapshot.id', '=', 'allocation.timesheet_entry_cost_snapshot_id')
					.onRef('snapshot.organisation_id', '=', 'allocation.organisation_id')
			)
			.innerJoin('timesheet_entries as entry', (join) =>
				join
					.onRef('entry.id', '=', 'snapshot.timesheet_entry_id')
					.onRef('entry.organisation_id', '=', 'snapshot.organisation_id')
			)
			.select([
				'allocation.project_cost_code_id as costCodeId',
				'allocation.allocated_cost_amount as allocatedCostAmount',
				'snapshot.currency_code as currencyCode'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('entry.project_id', '=', projectId)
			.where('entry.work_date', '<=', cutoff)
			.execute();
	}

	async listPostedDirectCosts(
		organisationId: string,
		projectId: string,
		cutoff: Date
	): Promise<DirectCostFact[]> {
		return this.db
			.selectFrom('project_direct_costs')
			.select([
				'id',
				'project_cost_code_id as costCodeId',
				'amount',
				'currency_code as currencyCode'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_id', '=', projectId)
			.where('lifecycle_status', '=', 'posted')
			.where('transaction_date', '<=', cutoff)
			.execute();
	}

	async listDirectCostReversals(
		organisationId: string,
		directCostIds: readonly string[],
		cutoffEnd: Date
	): Promise<DirectCostReversalFact[]> {
		if (directCostIds.length === 0) return [];
		return this.db
			.selectFrom('project_direct_cost_reversals')
			.select(['project_direct_cost_id as directCostId', 'reversal_amount as reversalAmount'])
			.where('organisation_id', '=', organisationId)
			.where('project_direct_cost_id', 'in', directCostIds)
			.where('reversed_at', '<=', cutoffEnd)
			.execute();
	}

	async listReportingPeriods(
		organisationId: string,
		projectId: string
	): Promise<ReportingPeriodRecord[]> {
		return this.db
			.selectFrom('commercial_reporting_periods')
			.select([
				'id',
				'public_id as publicId',
				'period_label as periodLabel',
				'period_start as periodStart',
				'period_end as periodEnd',
				'lifecycle_status as status',
				'closed_at as closedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_id', '=', projectId)
			.orderBy('period_end', 'desc')
			.execute();
	}

	async findReportingPeriodByPublicId(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<ReportingPeriodRecord | null> {
		const row = await this.db
			.selectFrom('commercial_reporting_periods')
			.select([
				'id',
				'public_id as publicId',
				'period_label as periodLabel',
				'period_start as periodStart',
				'period_end as periodEnd',
				'lifecycle_status as status',
				'closed_at as closedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertReportingPeriod(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		periodLabel: string;
		periodStart: Date;
		periodEnd: Date;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_reporting_periods')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				period_label: input.periodLabel,
				period_start: input.periodStart,
				period_end: input.periodEnd,
				lifecycle_status: 'open',
				closed_by_member_id: null,
				closed_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial reporting period');
	}

	async closeReportingPeriod(input: {
		organisationId: string;
		periodId: string;
		memberId: string;
		closedAt: Date;
	}): Promise<number> {
		const result = await this.db
			.updateTable('commercial_reporting_periods')
			.set({
				lifecycle_status: 'closed',
				closed_by_member_id: input.memberId,
				closed_at: input.closedAt
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.periodId)
			.where('lifecycle_status', 'in', ['open', 'reopened'])
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async reopenReportingPeriod(input: {
		organisationId: string;
		periodId: string;
	}): Promise<number> {
		const result = await this.db
			.updateTable('commercial_reporting_periods')
			.set({ lifecycle_status: 'reopened', closed_by_member_id: null, closed_at: null })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.periodId)
			.where('lifecycle_status', '=', 'closed')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listForecasts(organisationId: string, projectId: string): Promise<ForecastRecord[]> {
		return this.db
			.selectFrom('commercial_forecasts as forecast')
			.innerJoin('commercial_reporting_periods as period', (join) =>
				join
					.onRef('period.id', '=', 'forecast.commercial_reporting_period_id')
					.onRef('period.organisation_id', '=', 'forecast.organisation_id')
			)
			.select([
				'forecast.id as id',
				'forecast.public_id as publicId',
				'forecast.commercial_reporting_period_id as periodId',
				'period.public_id as periodPublicId',
				'period.period_label as periodLabel',
				'period.period_start as periodStart',
				'period.period_end as periodEnd',
				'forecast.version_number as versionNumber',
				'forecast.currency_code as currencyCode',
				'forecast.forecast_revenue_amount as forecastRevenueAmount',
				'forecast.version_status as status',
				'forecast.created_at as createdAt',
				'forecast.approved_at as approvedAt',
				'forecast.locked_at as lockedAt'
			])
			.where('forecast.organisation_id', '=', organisationId)
			.where('forecast.project_id', '=', projectId)
			.orderBy('period.period_end', 'desc')
			.orderBy('forecast.version_number', 'desc')
			.execute();
	}

	async findForecastByPublicId(
		organisationId: string,
		projectId: string,
		publicId: string
	): Promise<ForecastRecord | null> {
		const rows = await this.listForecasts(organisationId, projectId);
		return rows.find((row) => row.publicId === publicId) ?? null;
	}

	async insertForecast(input: {
		organisationId: string;
		projectId: string;
		periodId: string;
		publicId: string;
		versionNumber: number;
		currencyCode: string;
		forecastRevenueAmount: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_forecasts')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				commercial_reporting_period_id: input.periodId,
				public_id: input.publicId,
				version_number: input.versionNumber,
				currency_code: input.currencyCode,
				forecast_revenue_amount: input.forecastRevenueAmount,
				version_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				approved_by_member_id: null,
				approved_at: null,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial forecast');
	}

	async listForecastLines(
		organisationId: string,
		forecastId: string
	): Promise<ForecastLineRecord[]> {
		return this.db
			.selectFrom('commercial_forecast_lines as line')
			.innerJoin('project_cost_codes as costCode', (join) =>
				join
					.onRef('costCode.id', '=', 'line.project_cost_code_id')
					.onRef('costCode.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'line.id as id',
				'line.commercial_forecast_id as forecastId',
				'line.project_cost_code_id as costCodeId',
				'costCode.public_id as costCodePublicId',
				'costCode.code as costCode',
				'costCode.name as costCodeName',
				'line.control_budget_snapshot as controlBudgetSnapshot',
				'line.actual_cost_snapshot as actualCostSnapshot',
				'line.remaining_commitment_snapshot as remainingCommitmentSnapshot',
				'line.approved_change_snapshot as approvedChangeSnapshot',
				'line.pending_change_exposure_snapshot as pendingChangeExposureSnapshot',
				'line.forecast_to_complete_amount as forecastToCompleteAmount',
				'line.commentary as commentary'
			])
			.where('line.organisation_id', '=', organisationId)
			.where('line.commercial_forecast_id', '=', forecastId)
			.orderBy('costCode.sort_order')
			.orderBy('costCode.code')
			.execute();
	}

	async insertForecastLine(input: {
		organisationId: string;
		forecastId: string;
		costCodeId: string;
		controlBudgetSnapshot: string;
		actualCostSnapshot: string;
		remainingCommitmentSnapshot: string;
		approvedChangeSnapshot: string;
		pendingChangeExposureSnapshot: string;
		forecastToCompleteAmount: string;
		commentary: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_forecast_lines')
			.values({
				organisation_id: input.organisationId,
				commercial_forecast_id: input.forecastId,
				project_cost_code_id: input.costCodeId,
				control_budget_snapshot: input.controlBudgetSnapshot,
				actual_cost_snapshot: input.actualCostSnapshot,
				remaining_commitment_snapshot: input.remainingCommitmentSnapshot,
				approved_change_snapshot: input.approvedChangeSnapshot,
				pending_change_exposure_snapshot: input.pendingChangeExposureSnapshot,
				forecast_to_complete_amount: input.forecastToCompleteAmount,
				commentary: input.commentary
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial forecast line');
	}

	async updateDraftForecastLine(input: {
		organisationId: string;
		forecastId: string;
		costCodeId: string;
		forecastToCompleteAmount: string;
		commentary: string | null;
	}): Promise<number> {
		const result = await this.db
			.updateTable('commercial_forecast_lines')
			.set({
				forecast_to_complete_amount: input.forecastToCompleteAmount,
				commentary: input.commentary
			})
			.where('organisation_id', '=', input.organisationId)
			.where('commercial_forecast_id', '=', input.forecastId)
			.where('project_cost_code_id', '=', input.costCodeId)
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listCashFlowLines(
		organisationId: string,
		forecastId: string
	): Promise<CashFlowLineRecord[]> {
		return this.db
			.selectFrom('commercial_forecast_cash_flow_lines as line')
			.leftJoin('project_cost_codes as costCode', (join) =>
				join
					.onRef('costCode.id', '=', 'line.project_cost_code_id')
					.onRef('costCode.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'line.id as id',
				'line.commercial_forecast_id as forecastId',
				'line.line_number as lineNumber',
				'line.project_cost_code_id as costCodeId',
				'costCode.public_id as costCodePublicId',
				'costCode.code as costCode',
				'line.flow_date as flowDate',
				'line.direction as direction',
				'line.cash_flow_category as category',
				'line.amount as amount',
				'line.commentary as commentary'
			])
			.where('line.organisation_id', '=', organisationId)
			.where('line.commercial_forecast_id', '=', forecastId)
			.orderBy('line.flow_date')
			.orderBy('line.line_number')
			.execute();
	}

	async insertCashFlowLine(input: {
		organisationId: string;
		projectId: string;
		forecastId: string;
		costCodeId: string | null;
		lineNumber: number;
		flowDate: Date;
		direction: string;
		category: string;
		amount: string;
		commentary: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_forecast_cash_flow_lines')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				commercial_forecast_id: input.forecastId,
				project_cost_code_id: input.costCodeId,
				line_number: input.lineNumber,
				flow_date: input.flowDate,
				direction: input.direction,
				cash_flow_category: input.category,
				amount: input.amount,
				commentary: input.commentary
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'forecast cash-flow line');
	}

	async deleteCashFlowLine(
		organisationId: string,
		forecastId: string,
		lineNumber: number
	): Promise<number> {
		const result = await this.db
			.deleteFrom('commercial_forecast_cash_flow_lines')
			.where('organisation_id', '=', organisationId)
			.where('commercial_forecast_id', '=', forecastId)
			.where('line_number', '=', lineNumber)
			.executeTakeFirst();
		return Number(result.numDeletedRows);
	}

	async supersedeApprovedForecasts(input: {
		organisationId: string;
		projectId: string;
		periodId: string;
		excludeForecastId: string;
	}): Promise<void> {
		await this.db
			.updateTable('commercial_forecasts')
			.set({ version_status: 'superseded' })
			.where('organisation_id', '=', input.organisationId)
			.where('project_id', '=', input.projectId)
			.where('commercial_reporting_period_id', '=', input.periodId)
			.where('id', '!=', input.excludeForecastId)
			.where('version_status', '=', 'approved')
			.execute();
	}

	async approveForecast(input: {
		organisationId: string;
		forecastId: string;
		memberId: string;
		approvedAt: Date;
	}): Promise<number> {
		const result = await this.db
			.updateTable('commercial_forecasts')
			.set({
				version_status: 'approved',
				approved_by_member_id: input.memberId,
				approved_at: input.approvedAt,
				locked_at: input.approvedAt
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.forecastId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}
}
