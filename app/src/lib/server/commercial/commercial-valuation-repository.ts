import type { DatabaseExecutor } from '$lib/server/db/executor';

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined)
		throw new Error(`MySQL did not return the inserted ${label} ID.`);
	return result.insertId.toString();
}

export type CommercialValuationSummary = {
	id: string;
	publicId: string;
	projectId: string;
	valuationNumber: string;
	kind: string;
	counterpartyPartyId: string | null;
	currencyCode: string;
	valuationDate: Date;
	status: string;
	submittedAt: Date | null;
	assessedAt: Date | null;
	purchaseOrderId: string | null;
	purchaseOrderPublicId: string | null;
	purchaseOrderNumber: string | null;
};

export type CommercialValuationItemSummary = {
	id: string;
	valuationId: string;
	costCodeId: string | null;
	lineNumber: number;
	description: string;
	grossValueToDate: string;
};

export class CommercialValuationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listForProjects(
		organisationId: string,
		projectIds: readonly string[]
	): Promise<CommercialValuationSummary[]> {
		if (projectIds.length === 0) return [];
		return this.db
			.selectFrom('commercial_valuations as valuation')
			.leftJoin('purchase_order_valuations as poValuation', (join) =>
				join
					.onRef('poValuation.commercial_valuation_id', '=', 'valuation.id')
					.onRef('poValuation.organisation_id', '=', 'valuation.organisation_id')
			)
			.leftJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'poValuation.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'poValuation.organisation_id')
			)
			.select([
				'valuation.id as id',
				'valuation.public_id as publicId',
				'valuation.project_id as projectId',
				'valuation.valuation_number as valuationNumber',
				'valuation.valuation_kind as kind',
				'valuation.counterparty_party_id as counterpartyPartyId',
				'valuation.currency_code as currencyCode',
				'valuation.valuation_date as valuationDate',
				'valuation.lifecycle_status as status',
				'valuation.submitted_at as submittedAt',
				'valuation.assessed_at as assessedAt',
				'poValuation.purchase_order_id as purchaseOrderId',
				'purchaseOrder.public_id as purchaseOrderPublicId',
				'purchaseOrder.purchase_order_number as purchaseOrderNumber'
			])
			.where('valuation.organisation_id', '=', organisationId)
			.where('valuation.project_id', 'in', projectIds)
			.orderBy('valuation.valuation_date', 'desc')
			.orderBy('valuation.id', 'desc')
			.execute();
	}

	async findByPublicId(
		organisationId: string,
		publicId: string
	): Promise<CommercialValuationSummary | null> {
		const rows = await this.db
			.selectFrom('commercial_valuations as valuation')
			.leftJoin('purchase_order_valuations as poValuation', (join) =>
				join
					.onRef('poValuation.commercial_valuation_id', '=', 'valuation.id')
					.onRef('poValuation.organisation_id', '=', 'valuation.organisation_id')
			)
			.leftJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'poValuation.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'poValuation.organisation_id')
			)
			.select([
				'valuation.id as id',
				'valuation.public_id as publicId',
				'valuation.project_id as projectId',
				'valuation.valuation_number as valuationNumber',
				'valuation.valuation_kind as kind',
				'valuation.counterparty_party_id as counterpartyPartyId',
				'valuation.currency_code as currencyCode',
				'valuation.valuation_date as valuationDate',
				'valuation.lifecycle_status as status',
				'valuation.submitted_at as submittedAt',
				'valuation.assessed_at as assessedAt',
				'poValuation.purchase_order_id as purchaseOrderId',
				'purchaseOrder.public_id as purchaseOrderPublicId',
				'purchaseOrder.purchase_order_number as purchaseOrderNumber'
			])
			.where('valuation.organisation_id', '=', organisationId)
			.where('valuation.public_id', '=', publicId)
			.execute();
		return rows[0] ?? null;
	}

	async insertSupplierApplication(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		valuationNumber: string;
		counterpartyPartyId: string;
		currencyCode: string;
		valuationDate: Date;
		recordedByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_valuations')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				valuation_number: input.valuationNumber,
				valuation_kind: 'supplier_application',
				source_application_id: null,
				counterparty_party_id: input.counterpartyPartyId,
				currency_code: input.currencyCode,
				period_start: null,
				period_end: null,
				valuation_date: input.valuationDate,
				lifecycle_status: 'draft',
				recorded_by_member_id: input.recordedByMemberId,
				submitted_at: null,
				assessed_by_member_id: null,
				assessed_at: null,
				closed_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial valuation');
	}

	async linkPurchaseOrder(input: {
		organisationId: string;
		valuationId: string;
		purchaseOrderId: string;
	}): Promise<void> {
		await this.db
			.insertInto('purchase_order_valuations')
			.values({
				commercial_valuation_id: input.valuationId,
				organisation_id: input.organisationId,
				purchase_order_id: input.purchaseOrderId
			})
			.executeTakeFirstOrThrow();
	}

	async insertItem(input: {
		organisationId: string;
		valuationId: string;
		costCodeId: string | null;
		lineNumber: number;
		description: string;
		grossValueToDate: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_valuation_items')
			.values({
				organisation_id: input.organisationId,
				commercial_valuation_id: input.valuationId,
				project_cost_code_id: input.costCodeId,
				line_number: input.lineNumber,
				description: input.description,
				gross_value_to_date: input.grossValueToDate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial valuation item');
	}

	async listItems(
		organisationId: string,
		valuationId: string
	): Promise<CommercialValuationItemSummary[]> {
		return this.db
			.selectFrom('commercial_valuation_items')
			.select([
				'id',
				'commercial_valuation_id as valuationId',
				'project_cost_code_id as costCodeId',
				'line_number as lineNumber',
				'description',
				'gross_value_to_date as grossValueToDate'
			])
			.where('organisation_id', '=', organisationId)
			.where('commercial_valuation_id', '=', valuationId)
			.orderBy('line_number')
			.execute();
	}

	async submit(input: { organisationId: string; valuationId: string; submittedAt: Date }) {
		const result = await this.db
			.updateTable('commercial_valuations')
			.set({ lifecycle_status: 'submitted', submitted_at: input.submittedAt })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.valuationId)
			.where('lifecycle_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async assess(input: {
		organisationId: string;
		valuationId: string;
		assessedByMemberId: string;
		assessedAt: Date;
	}) {
		const result = await this.db
			.updateTable('commercial_valuations')
			.set({
				lifecycle_status: 'assessed',
				assessed_by_member_id: input.assessedByMemberId,
				assessed_at: input.assessedAt
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.valuationId)
			.where('lifecycle_status', '=', 'submitted')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}
}
