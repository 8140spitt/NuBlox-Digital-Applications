import type { DatabaseExecutor } from '$lib/server/db/executor';

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined)
		throw new Error(`MySQL did not return the inserted ${label} ID.`);
	return result.insertId.toString();
}

export type ProjectCostCodeSummary = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	categoryId: number;
	categoryCode: string;
	categoryName: string;
	parentCostCodeId: string | null;
	code: string;
	name: string;
	description: string | null;
	sortOrder: number;
	isActive: number;
};

export type ProjectBudgetSummary = {
	id: string;
	projectId: string;
	publicId: string;
	budgetNumber: string;
	name: string;
	status: string;
};

export type ProjectBudgetVersionSummary = {
	id: string;
	budgetId: string;
	versionNumber: number;
	currencyCode: string;
	status: string;
	effectiveOn: Date | null;
	approvedAt: Date | null;
	lockedAt: Date | null;
};

export type ProjectBudgetLineSummary = {
	id: string;
	versionId: string;
	costCodeId: string;
	lineNumber: number;
	description: string | null;
	budgetAmount: string;
};

export type CommercialVariationSummary = {
	id: string;
	projectId: string;
	publicId: string;
	variationNumber: string;
	typeId: number;
	typeCode: string;
	typeName: string;
	commercialSide: string;
	counterpartyPartyId: string | null;
	currencyCode: string;
	title: string;
	status: string;
};

export type CommercialVariationVersionSummary = {
	id: string;
	variationId: string;
	versionNumber: number;
	title: string;
	status: string;
	lockedAt: Date | null;
};

export type CommercialVariationItemSummary = {
	id: string;
	versionId: string;
	costCodeId: string | null;
	lineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
};

export type CommercialVariationDecisionSummary = {
	id: string;
	versionId: string;
	decisionSequence: number;
	decision: string;
	decisionAmount: string | null;
	decidedAt: Date;
	comments: string | null;
};

export type ReceiptCostFact = {
	purchaseOrderItemId: string;
	quantityReceived: string;
	quantityRejected: string;
	unitRate: string;
};

export class ProjectCommercialControlRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listCostCategories() {
		return this.db
			.selectFrom('commercial_cost_categories')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listVariationTypes() {
		return this.db
			.selectFrom('commercial_variation_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async findCostCategoryByCode(code: string) {
		return this.db
			.selectFrom('commercial_cost_categories')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async findVariationTypeByCode(code: string) {
		return this.db
			.selectFrom('commercial_variation_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async listCostCodes(
		organisationId: string,
		projectIds: readonly string[]
	): Promise<ProjectCostCodeSummary[]> {
		if (projectIds.length === 0) return [];
		return this.db
			.selectFrom('project_cost_codes as costCode')
			.innerJoin(
				'commercial_cost_categories as category',
				'category.id',
				'costCode.commercial_cost_category_id'
			)
			.select([
				'costCode.id as id',
				'costCode.organisation_id as organisationId',
				'costCode.project_id as projectId',
				'costCode.public_id as publicId',
				'costCode.commercial_cost_category_id as categoryId',
				'category.code as categoryCode',
				'category.name as categoryName',
				'costCode.parent_cost_code_id as parentCostCodeId',
				'costCode.code as code',
				'costCode.name as name',
				'costCode.description as description',
				'costCode.sort_order as sortOrder',
				'costCode.is_active as isActive'
			])
			.where('costCode.organisation_id', '=', organisationId)
			.where('costCode.project_id', 'in', projectIds)
			.orderBy('costCode.project_id')
			.orderBy('costCode.sort_order')
			.orderBy('costCode.code')
			.execute();
	}

	async findCostCodeByPublicId(
		organisationId: string,
		publicId: string
	): Promise<ProjectCostCodeSummary | null> {
		const row = await this.db
			.selectFrom('project_cost_codes as costCode')
			.innerJoin(
				'commercial_cost_categories as category',
				'category.id',
				'costCode.commercial_cost_category_id'
			)
			.select([
				'costCode.id as id',
				'costCode.organisation_id as organisationId',
				'costCode.project_id as projectId',
				'costCode.public_id as publicId',
				'costCode.commercial_cost_category_id as categoryId',
				'category.code as categoryCode',
				'category.name as categoryName',
				'costCode.parent_cost_code_id as parentCostCodeId',
				'costCode.code as code',
				'costCode.name as name',
				'costCode.description as description',
				'costCode.sort_order as sortOrder',
				'costCode.is_active as isActive'
			])
			.where('costCode.organisation_id', '=', organisationId)
			.where('costCode.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertCostCode(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		categoryId: number;
		parentCostCodeId: string | null;
		code: string;
		name: string;
		description: string | null;
		sortOrder: number;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_cost_codes')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				commercial_cost_category_id: input.categoryId,
				parent_cost_code_id: input.parentCostCodeId,
				code: input.code,
				name: input.name,
				description: input.description,
				sort_order: input.sortOrder,
				is_active: 1
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'project cost code');
	}

	async listBudgets(
		organisationId: string,
		projectIds: readonly string[]
	): Promise<ProjectBudgetSummary[]> {
		if (projectIds.length === 0) return [];
		return this.db
			.selectFrom('project_budgets')
			.select([
				'id',
				'project_id as projectId',
				'public_id as publicId',
				'budget_number as budgetNumber',
				'name',
				'lifecycle_status as status'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_id', 'in', projectIds)
			.orderBy('id', 'desc')
			.execute();
	}

	async findBudgetByPublicId(
		organisationId: string,
		publicId: string
	): Promise<ProjectBudgetSummary | null> {
		const row = await this.db
			.selectFrom('project_budgets')
			.select([
				'id',
				'project_id as projectId',
				'public_id as publicId',
				'budget_number as budgetNumber',
				'name',
				'lifecycle_status as status'
			])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertBudget(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		budgetNumber: string;
		name: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_budgets')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				budget_number: input.budgetNumber,
				name: input.name,
				lifecycle_status: 'active',
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'project budget');
	}

	async insertBudgetVersion(input: {
		organisationId: string;
		budgetId: string;
		versionNumber: number;
		currencyCode: string;
		effectiveOn: Date | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_budget_versions')
			.values({
				organisation_id: input.organisationId,
				project_budget_id: input.budgetId,
				version_number: input.versionNumber,
				currency_code: input.currencyCode,
				version_status: 'draft',
				effective_on: input.effectiveOn,
				created_by_member_id: input.createdByMemberId,
				approved_by_member_id: null,
				approved_at: null,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'project budget version');
	}

	async insertBudgetLine(input: {
		organisationId: string;
		versionId: string;
		costCodeId: string;
		lineNumber: number;
		description: string | null;
		budgetAmount: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_budget_lines')
			.values({
				organisation_id: input.organisationId,
				project_budget_version_id: input.versionId,
				project_cost_code_id: input.costCodeId,
				line_number: input.lineNumber,
				description: input.description,
				budget_amount: input.budgetAmount
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'project budget line');
	}

	async listBudgetVersions(
		organisationId: string,
		budgetId: string
	): Promise<ProjectBudgetVersionSummary[]> {
		return this.db
			.selectFrom('project_budget_versions')
			.select([
				'id',
				'project_budget_id as budgetId',
				'version_number as versionNumber',
				'currency_code as currencyCode',
				'version_status as status',
				'effective_on as effectiveOn',
				'approved_at as approvedAt',
				'locked_at as lockedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_budget_id', '=', budgetId)
			.orderBy('version_number', 'desc')
			.execute();
	}

	async listBudgetLines(
		organisationId: string,
		versionId: string
	): Promise<ProjectBudgetLineSummary[]> {
		return this.db
			.selectFrom('project_budget_lines')
			.select([
				'id',
				'project_budget_version_id as versionId',
				'project_cost_code_id as costCodeId',
				'line_number as lineNumber',
				'description',
				'budget_amount as budgetAmount'
			])
			.where('organisation_id', '=', organisationId)
			.where('project_budget_version_id', '=', versionId)
			.orderBy('line_number')
			.execute();
	}

	async approveBudgetVersion(input: {
		organisationId: string;
		versionId: string;
		memberId: string;
		approvedAt: Date;
	}): Promise<number> {
		const result = await this.db
			.updateTable('project_budget_versions')
			.set({
				version_status: 'approved',
				approved_by_member_id: input.memberId,
				approved_at: input.approvedAt,
				locked_at: input.approvedAt
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listPurchaseOrderCostAllocations(
		organisationId: string,
		purchaseOrderItemIds: readonly string[]
	) {
		if (purchaseOrderItemIds.length === 0) return [];
		return this.db
			.selectFrom('purchase_order_item_cost_allocations')
			.select([
				'id',
				'purchase_order_item_id as purchaseOrderItemId',
				'project_cost_code_id as costCodeId',
				'allocated_net_amount as allocatedNetAmount'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_item_id', 'in', purchaseOrderItemIds)
			.execute();
	}

	async insertPurchaseOrderCostAllocation(input: {
		organisationId: string;
		purchaseOrderItemId: string;
		costCodeId: string;
		allocatedNetAmount: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_order_item_cost_allocations')
			.values({
				organisation_id: input.organisationId,
				purchase_order_item_id: input.purchaseOrderItemId,
				project_cost_code_id: input.costCodeId,
				allocated_net_amount: input.allocatedNetAmount,
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase-order cost allocation');
	}

	async listVariations(
		organisationId: string,
		projectIds: readonly string[]
	): Promise<CommercialVariationSummary[]> {
		if (projectIds.length === 0) return [];
		return this.db
			.selectFrom('commercial_variations as variation')
			.innerJoin(
				'commercial_variation_types as variationType',
				'variationType.id',
				'variation.commercial_variation_type_id'
			)
			.select([
				'variation.id as id',
				'variation.project_id as projectId',
				'variation.public_id as publicId',
				'variation.variation_number as variationNumber',
				'variation.commercial_variation_type_id as typeId',
				'variationType.code as typeCode',
				'variationType.name as typeName',
				'variation.commercial_side as commercialSide',
				'variation.counterparty_party_id as counterpartyPartyId',
				'variation.currency_code as currencyCode',
				'variation.title as title',
				'variation.lifecycle_status as status'
			])
			.where('variation.organisation_id', '=', organisationId)
			.where('variation.project_id', 'in', projectIds)
			.orderBy('variation.id', 'desc')
			.execute();
	}

	async findVariationByPublicId(
		organisationId: string,
		publicId: string
	): Promise<CommercialVariationSummary | null> {
		const row = await this.db
			.selectFrom('commercial_variations as variation')
			.innerJoin(
				'commercial_variation_types as variationType',
				'variationType.id',
				'variation.commercial_variation_type_id'
			)
			.select([
				'variation.id as id',
				'variation.project_id as projectId',
				'variation.public_id as publicId',
				'variation.variation_number as variationNumber',
				'variation.commercial_variation_type_id as typeId',
				'variationType.code as typeCode',
				'variationType.name as typeName',
				'variation.commercial_side as commercialSide',
				'variation.counterparty_party_id as counterpartyPartyId',
				'variation.currency_code as currencyCode',
				'variation.title as title',
				'variation.lifecycle_status as status'
			])
			.where('variation.organisation_id', '=', organisationId)
			.where('variation.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertVariation(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		variationNumber: string;
		variationTypeId: number;
		commercialSide: string;
		counterpartyPartyId: string | null;
		currencyCode: string;
		title: string;
		ownerMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_variations')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				variation_number: input.variationNumber,
				commercial_variation_type_id: input.variationTypeId,
				commercial_side: input.commercialSide,
				counterparty_party_id: input.counterpartyPartyId,
				currency_code: input.currencyCode,
				title: input.title,
				lifecycle_status: 'active',
				owner_member_id: input.ownerMemberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial variation');
	}

	async insertPurchaseOrderVariationLink(input: {
		organisationId: string;
		variationId: string;
		purchaseOrderId: string;
	}): Promise<void> {
		await this.db
			.insertInto('purchase_order_variations')
			.values({
				commercial_variation_id: input.variationId,
				organisation_id: input.organisationId,
				purchase_order_id: input.purchaseOrderId
			})
			.executeTakeFirstOrThrow();
	}

	async insertVariationVersion(input: {
		organisationId: string;
		variationId: string;
		versionNumber: number;
		title: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_variation_versions')
			.values({
				organisation_id: input.organisationId,
				commercial_variation_id: input.variationId,
				version_number: input.versionNumber,
				title: input.title,
				version_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial variation version');
	}

	async insertVariationItem(input: {
		organisationId: string;
		versionId: string;
		costCodeId: string | null;
		lineNumber: number;
		description: string;
		quantity: string;
		unitRate: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('commercial_variation_items')
			.values({
				organisation_id: input.organisationId,
				commercial_variation_version_id: input.versionId,
				project_cost_code_id: input.costCodeId,
				unit_of_measure_id: null,
				line_number: input.lineNumber,
				description: input.description,
				quantity: input.quantity,
				unit_rate: input.unitRate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial variation item');
	}

	async listVariationVersions(
		organisationId: string,
		variationId: string
	): Promise<CommercialVariationVersionSummary[]> {
		return this.db
			.selectFrom('commercial_variation_versions')
			.select([
				'id',
				'commercial_variation_id as variationId',
				'version_number as versionNumber',
				'title',
				'version_status as status',
				'locked_at as lockedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('commercial_variation_id', '=', variationId)
			.orderBy('version_number', 'desc')
			.execute();
	}

	async listVariationItems(
		organisationId: string,
		versionId: string
	): Promise<CommercialVariationItemSummary[]> {
		return this.db
			.selectFrom('commercial_variation_items')
			.select([
				'id',
				'commercial_variation_version_id as versionId',
				'project_cost_code_id as costCodeId',
				'line_number as lineNumber',
				'description',
				'quantity',
				'unit_rate as unitRate'
			])
			.where('organisation_id', '=', organisationId)
			.where('commercial_variation_version_id', '=', versionId)
			.orderBy('line_number')
			.execute();
	}

	async issueVariationVersion(input: {
		organisationId: string;
		versionId: string;
		lockedAt: Date;
	}): Promise<number> {
		const result = await this.db
			.updateTable('commercial_variation_versions')
			.set({ version_status: 'issued', locked_at: input.lockedAt })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async insertVariationIssueEvent(input: {
		organisationId: string;
		versionId: string;
		memberId: string;
		channel: string;
		note: string | null;
	}): Promise<string> {
		const existing = await this.db
			.selectFrom('commercial_variation_issue_events')
			.select((eb) => eb.fn.max<number>('issue_sequence').as('maxSequence'))
			.where('organisation_id', '=', input.organisationId)
			.where('commercial_variation_version_id', '=', input.versionId)
			.executeTakeFirst();
		const issueSequence = Number(existing?.maxSequence ?? 0) + 1;
		const result = await this.db
			.insertInto('commercial_variation_issue_events')
			.values({
				organisation_id: input.organisationId,
				commercial_variation_version_id: input.versionId,
				issue_sequence: issueSequence,
				issued_by_member_id: input.memberId,
				delivery_channel: input.channel,
				note: input.note
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial variation issue event');
	}

	async listVariationDecisions(
		organisationId: string,
		versionId: string
	): Promise<CommercialVariationDecisionSummary[]> {
		return this.db
			.selectFrom('commercial_variation_decisions')
			.select([
				'id',
				'commercial_variation_version_id as versionId',
				'decision_sequence as decisionSequence',
				'decision',
				'decision_amount as decisionAmount',
				'decided_at as decidedAt',
				'comments'
			])
			.where('organisation_id', '=', organisationId)
			.where('commercial_variation_version_id', '=', versionId)
			.orderBy('decision_sequence', 'desc')
			.execute();
	}

	async insertVariationDecision(input: {
		organisationId: string;
		versionId: string;
		decision: string;
		decisionAmount: string | null;
		respondingPartyId: string | null;
		recordedByMemberId: string;
		decidedAt: Date;
		comments: string | null;
	}): Promise<string> {
		const existing = await this.db
			.selectFrom('commercial_variation_decisions')
			.select((eb) => eb.fn.max<number>('decision_sequence').as('maxSequence'))
			.where('organisation_id', '=', input.organisationId)
			.where('commercial_variation_version_id', '=', input.versionId)
			.executeTakeFirst();
		const decisionSequence = Number(existing?.maxSequence ?? 0) + 1;
		const result = await this.db
			.insertInto('commercial_variation_decisions')
			.values({
				organisation_id: input.organisationId,
				commercial_variation_version_id: input.versionId,
				decision_sequence: decisionSequence,
				decision: input.decision,
				decision_amount: input.decisionAmount,
				responding_party_id: input.respondingPartyId,
				recorded_by_member_id: input.recordedByMemberId,
				decided_at: input.decidedAt,
				comments: input.comments
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'commercial variation decision');
	}

	async listReceiptCostFacts(
		organisationId: string,
		projectId: string
	): Promise<ReceiptCostFact[]> {
		return this.db
			.selectFrom('purchase_order_receipt_items as receiptItem')
			.innerJoin('purchase_order_receipts as receipt', (join) =>
				join
					.onRef('receipt.id', '=', 'receiptItem.purchase_order_receipt_id')
					.onRef('receipt.organisation_id', '=', 'receiptItem.organisation_id')
			)
			.innerJoin('purchase_order_items as orderItem', (join) =>
				join
					.onRef('orderItem.id', '=', 'receiptItem.purchase_order_item_id')
					.onRef('orderItem.organisation_id', '=', 'receiptItem.organisation_id')
			)
			.innerJoin('purchase_order_versions as orderVersion', (join) =>
				join
					.onRef('orderVersion.id', '=', 'orderItem.purchase_order_version_id')
					.onRef('orderVersion.organisation_id', '=', 'orderItem.organisation_id')
			)
			.innerJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'orderVersion.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'orderVersion.organisation_id')
			)
			.select([
				'receiptItem.purchase_order_item_id as purchaseOrderItemId',
				'receiptItem.quantity_received as quantityReceived',
				'receiptItem.quantity_rejected as quantityRejected',
				'orderItem.unit_rate as unitRate'
			])
			.where('receiptItem.organisation_id', '=', organisationId)
			.where('purchaseOrder.project_id', '=', projectId)
			.where('receipt.receipt_status', 'in', ['recorded', 'confirmed'])
			.execute();
	}
}
