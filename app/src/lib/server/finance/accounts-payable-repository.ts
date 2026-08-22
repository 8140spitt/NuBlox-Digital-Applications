import type { DatabaseExecutor } from '$lib/server/db/executor';

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined) throw new Error(`Expected inserted ${label} ID.`);
	return result.insertId.toString();
}

export type AccountsPayableDocumentRecord = {
	id: string;
	publicId: string;
	documentType: string;
	supplierPartyId: string;
	supplierPublicId: string;
	supplierName: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	purchaseOrderId: string | null;
	purchaseOrderPublicId: string | null;
	purchaseOrderNumber: string | null;
	supplierDocumentNumber: string;
	invoiceDate: Date;
	taxDate: Date | null;
	dueDate: Date | null;
	currencyCode: string;
	status: string;
	netAmount: string;
	taxAmount: string;
	grossAmount: string;
	createdByMemberId: string;
	submittedAt: Date | null;
	approvedAt: Date | null;
	createdAt: Date;
};

export type AccountsPayableDocumentItemRecord = {
	id: string;
	documentId: string;
	purchaseOrderItemId: string | null;
	lineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
	netAmount: string;
	taxAmount: string;
	grossAmount: string;
	unitOfMeasureId: number | null;
};

export type AccountsPayableExceptionRecord = {
	id: string;
	publicId: string;
	documentId: string;
	documentItemId: string | null;
	code: string;
	severity: string;
	status: string;
	message: string;
	resolutionNote: string | null;
	resolvedAt: Date | null;
	createdAt: Date;
};

export type IssuedPurchaseOrder = {
	id: string;
	publicId: string;
	purchaseOrderNumber: string;
	supplierPartyId: string;
	supplierPublicId: string;
	supplierName: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	currencyCode: string;
	versionId: string;
	versionNumber: number;
};

export type PurchaseOrderItemForMatching = {
	id: string;
	versionId: string;
	lineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
	unitOfMeasureId: number | null;
};

export type ReceiptItemForMatching = {
	id: string;
	receiptId: string;
	receiptPublicId: string;
	receiptNumber: string;
	quantityReceived: string;
	quantityRejected: string;
	receivedAt: Date;
};

export type AccountsPayableTaxCategory = {
	id: string;
	publicId: string;
	code: string;
	name: string;
	treatment: string;
	ratePercent: string | null;
};

export class AccountsPayableRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listDocuments(organisationId: string): Promise<AccountsPayableDocumentRecord[]> {
		const rows = await this.db
			.selectFrom('accounts_payable_documents as document')
			.innerJoin('parties as supplier', (join) =>
				join
					.onRef('supplier.id', '=', 'document.supplier_party_id')
					.onRef('supplier.organisation_id', '=', 'document.organisation_id')
			)
			.innerJoin('party_organisations as supplierOrganisation', (join) =>
				join
					.onRef('supplierOrganisation.party_id', '=', 'supplier.id')
					.onRef('supplierOrganisation.organisation_id', '=', 'supplier.organisation_id')
			)
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'document.project_id')
					.onRef('project.owning_organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'document.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id',
				'document.public_id as publicId',
				'document.document_type as documentType',
				'document.supplier_party_id as supplierPartyId',
				'supplier.public_id as supplierPublicId',
				'supplierOrganisation.legal_name as supplierLegalName',
				'supplierOrganisation.trading_name as supplierTradingName',
				'document.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'document.purchase_order_id as purchaseOrderId',
				'purchaseOrder.public_id as purchaseOrderPublicId',
				'purchaseOrder.purchase_order_number as purchaseOrderNumber',
				'document.supplier_document_number as supplierDocumentNumber',
				'document.invoice_date as invoiceDate',
				'document.tax_date as taxDate',
				'document.due_date as dueDate',
				'document.currency_code as currencyCode',
				'document.lifecycle_status as status',
				'document.net_amount as netAmount',
				'document.tax_amount as taxAmount',
				'document.gross_amount as grossAmount',
				'document.created_by_member_id as createdByMemberId',
				'document.submitted_at as submittedAt',
				'document.approved_at as approvedAt',
				'document.created_at as createdAt'
			])
			.where('document.organisation_id', '=', organisationId)
			.orderBy('document.id', 'desc')
			.execute();
		return rows.map(({ supplierLegalName, supplierTradingName, ...row }) => ({
			...row,
			supplierName: supplierTradingName ?? supplierLegalName
		}));
	}

	async findDocumentByPublicId(
		organisationId: string,
		publicId: string,
		forUpdate = false
	): Promise<AccountsPayableDocumentRecord | null> {
		let query = this.db
			.selectFrom('accounts_payable_documents as document')
			.innerJoin('parties as supplier', (join) =>
				join
					.onRef('supplier.id', '=', 'document.supplier_party_id')
					.onRef('supplier.organisation_id', '=', 'document.organisation_id')
			)
			.innerJoin('party_organisations as supplierOrganisation', (join) =>
				join
					.onRef('supplierOrganisation.party_id', '=', 'supplier.id')
					.onRef('supplierOrganisation.organisation_id', '=', 'supplier.organisation_id')
			)
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'document.project_id')
					.onRef('project.owning_organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'document.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id',
				'document.public_id as publicId',
				'document.document_type as documentType',
				'document.supplier_party_id as supplierPartyId',
				'supplier.public_id as supplierPublicId',
				'supplierOrganisation.legal_name as supplierLegalName',
				'supplierOrganisation.trading_name as supplierTradingName',
				'document.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'document.purchase_order_id as purchaseOrderId',
				'purchaseOrder.public_id as purchaseOrderPublicId',
				'purchaseOrder.purchase_order_number as purchaseOrderNumber',
				'document.supplier_document_number as supplierDocumentNumber',
				'document.invoice_date as invoiceDate',
				'document.tax_date as taxDate',
				'document.due_date as dueDate',
				'document.currency_code as currencyCode',
				'document.lifecycle_status as status',
				'document.net_amount as netAmount',
				'document.tax_amount as taxAmount',
				'document.gross_amount as grossAmount',
				'document.created_by_member_id as createdByMemberId',
				'document.submitted_at as submittedAt',
				'document.approved_at as approvedAt',
				'document.created_at as createdAt'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.public_id', '=', publicId);
		if (forUpdate) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		if (!row) return null;
		const { supplierLegalName, supplierTradingName, ...rest } = row;
		return { ...rest, supplierName: supplierTradingName ?? supplierLegalName };
	}

	async listDocumentItems(
		organisationId: string,
		documentId: string
	): Promise<AccountsPayableDocumentItemRecord[]> {
		return this.db
			.selectFrom('accounts_payable_document_items')
			.select([
				'id',
				'accounts_payable_document_id as documentId',
				'source_purchase_order_item_id as purchaseOrderItemId',
				'line_number as lineNumber',
				'description',
				'quantity',
				'unit_rate as unitRate',
				'net_amount as netAmount',
				'tax_amount as taxAmount',
				'gross_amount as grossAmount',
				'unit_of_measure_id as unitOfMeasureId'
			])
			.where('organisation_id', '=', organisationId)
			.where('accounts_payable_document_id', '=', documentId)
			.orderBy('line_number')
			.execute();
	}

	async listExceptions(
		organisationId: string,
		documentId?: string
	): Promise<AccountsPayableExceptionRecord[]> {
		let query = this.db
			.selectFrom('accounts_payable_exceptions')
			.select([
				'id',
				'public_id as publicId',
				'accounts_payable_document_id as documentId',
				'accounts_payable_document_item_id as documentItemId',
				'exception_code as code',
				'severity',
				'status',
				'message',
				'resolution_note as resolutionNote',
				'resolved_at as resolvedAt',
				'created_at as createdAt'
			])
			.where('organisation_id', '=', organisationId);
		if (documentId) query = query.where('accounts_payable_document_id', '=', documentId);
		return query.orderBy('id', 'desc').execute();
	}

	async findExceptionByPublicId(organisationId: string, publicId: string, forUpdate = false) {
		let query = this.db
			.selectFrom('accounts_payable_exceptions')
			.select([
				'id',
				'public_id as publicId',
				'accounts_payable_document_id as documentId',
				'accounts_payable_document_item_id as documentItemId',
				'exception_code as code',
				'severity',
				'status',
				'message',
				'resolution_note as resolutionNote',
				'resolved_at as resolvedAt',
				'created_at as createdAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId);
		if (forUpdate) query = query.forUpdate();
		return (await query.executeTakeFirst()) ?? null;
	}

	async listIssuedPurchaseOrders(organisationId: string): Promise<IssuedPurchaseOrder[]> {
		const rows = await this.db
			.selectFrom('purchase_orders as purchaseOrder')
			.innerJoin('purchase_order_versions as version', (join) =>
				join
					.onRef('version.purchase_order_id', '=', 'purchaseOrder.id')
					.onRef('version.organisation_id', '=', 'purchaseOrder.organisation_id')
					.on('version.version_status', '=', 'issued')
			)
			.innerJoin('parties as supplier', (join) =>
				join
					.onRef('supplier.id', '=', 'purchaseOrder.supplier_party_id')
					.onRef('supplier.organisation_id', '=', 'purchaseOrder.organisation_id')
			)
			.innerJoin('party_organisations as supplierOrganisation', (join) =>
				join
					.onRef('supplierOrganisation.party_id', '=', 'supplier.id')
					.onRef('supplierOrganisation.organisation_id', '=', 'supplier.organisation_id')
			)
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'purchaseOrder.project_id')
					.onRef('project.owning_organisation_id', '=', 'purchaseOrder.organisation_id')
			)
			.select([
				'purchaseOrder.id as id',
				'purchaseOrder.public_id as publicId',
				'purchaseOrder.purchase_order_number as purchaseOrderNumber',
				'purchaseOrder.supplier_party_id as supplierPartyId',
				'supplier.public_id as supplierPublicId',
				'supplierOrganisation.legal_name as supplierLegalName',
				'supplierOrganisation.trading_name as supplierTradingName',
				'purchaseOrder.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'purchaseOrder.currency_code as currencyCode',
				'version.id as versionId',
				'version.version_number as versionNumber'
			])
			.where('purchaseOrder.organisation_id', '=', organisationId)
			.where('purchaseOrder.lifecycle_status', '=', 'active')
			.orderBy('purchaseOrder.id', 'desc')
			.execute();
		return rows.map(({ supplierLegalName, supplierTradingName, ...row }) => ({
			...row,
			supplierName: supplierTradingName ?? supplierLegalName
		}));
	}

	async findIssuedPurchaseOrderByPublicId(
		organisationId: string,
		publicId: string
	): Promise<IssuedPurchaseOrder | null> {
		return (
			(await this.listIssuedPurchaseOrders(organisationId)).find(
				(row) => row.publicId === publicId
			) ?? null
		);
	}

	async listPurchaseOrderItems(
		organisationId: string,
		versionId: string
	): Promise<PurchaseOrderItemForMatching[]> {
		return this.db
			.selectFrom('purchase_order_items')
			.select([
				'id',
				'purchase_order_version_id as versionId',
				'line_number as lineNumber',
				'description',
				'quantity',
				'unit_rate as unitRate',
				'unit_of_measure_id as unitOfMeasureId'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_version_id', '=', versionId)
			.orderBy('line_number')
			.execute();
	}

	async listReceiptItemsForPurchaseOrderItem(
		organisationId: string,
		purchaseOrderItemId: string
	): Promise<ReceiptItemForMatching[]> {
		return this.db
			.selectFrom('purchase_order_receipt_items as item')
			.innerJoin('purchase_order_receipts as receipt', (join) =>
				join
					.onRef('receipt.id', '=', 'item.purchase_order_receipt_id')
					.onRef('receipt.organisation_id', '=', 'item.organisation_id')
			)
			.select([
				'item.id as id',
				'receipt.id as receiptId',
				'receipt.public_id as receiptPublicId',
				'receipt.receipt_number as receiptNumber',
				'item.quantity_received as quantityReceived',
				'item.quantity_rejected as quantityRejected',
				'receipt.received_at as receivedAt'
			])
			.where('item.organisation_id', '=', organisationId)
			.where('item.purchase_order_item_id', '=', purchaseOrderItemId)
			.where('receipt.receipt_status', 'in', ['recorded', 'confirmed'])
			.orderBy('receipt.received_at')
			.orderBy('item.id')
			.execute();
	}

	async listActiveTaxCategories(organisationId: string): Promise<AccountsPayableTaxCategory[]> {
		const categories = await this.db
			.selectFrom('tax_categories')
			.select(['id', 'public_id as publicId', 'code', 'name', 'treatment'])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
		const results: AccountsPayableTaxCategory[] = [];
		for (const category of categories) {
			const rate = await this.db
				.selectFrom('tax_category_rates')
				.select(['rate_percent as ratePercent', 'valid_from as validFrom', 'valid_to as validTo'])
				.where('organisation_id', '=', organisationId)
				.where('tax_category_id', '=', category.id)
				.orderBy('valid_from', 'desc')
				.executeTakeFirst();
			results.push({ ...category, ratePercent: rate?.ratePercent ?? null });
		}
		return results;
	}

	async findTaxCategoryForDate(
		organisationId: string,
		publicId: string,
		effectiveDate: Date
	): Promise<AccountsPayableTaxCategory | null> {
		const category = await this.db
			.selectFrom('tax_categories')
			.select(['id', 'public_id as publicId', 'code', 'name', 'treatment'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!category) return null;
		const rates = await this.db
			.selectFrom('tax_category_rates')
			.select(['rate_percent as ratePercent', 'valid_from as validFrom', 'valid_to as validTo'])
			.where('organisation_id', '=', organisationId)
			.where('tax_category_id', '=', category.id)
			.orderBy('valid_from', 'desc')
			.execute();
		const day = effectiveDate.getTime();
		const rate = rates.find((row) => {
			const from = row.validFrom.getTime();
			const to = row.validTo?.getTime() ?? Number.POSITIVE_INFINITY;
			return from <= day && day <= to;
		});
		return { ...category, ratePercent: rate?.ratePercent ?? null };
	}

	async insertDocument(input: {
		organisationId: string;
		publicId: string;
		documentType: string;
		supplierPartyId: string;
		projectId: string | null;
		purchaseOrderId: string | null;
		supplierDocumentNumber: string;
		invoiceDate: Date;
		taxDate: Date | null;
		dueDate: Date | null;
		currencyCode: string;
		netAmount: string;
		taxAmount: string;
		grossAmount: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('accounts_payable_documents')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				document_type: input.documentType,
				supplier_party_id: input.supplierPartyId,
				project_id: input.projectId,
				purchase_order_id: input.purchaseOrderId,
				supplier_document_number: input.supplierDocumentNumber,
				invoice_date: input.invoiceDate,
				tax_date: input.taxDate,
				due_date: input.dueDate,
				currency_code: input.currencyCode,
				lifecycle_status: 'draft',
				net_amount: input.netAmount,
				tax_amount: input.taxAmount,
				gross_amount: input.grossAmount,
				created_by_member_id: input.createdByMemberId,
				submitted_at: null,
				approved_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'accounts-payable document');
	}

	async insertDocumentItem(input: {
		organisationId: string;
		documentId: string;
		purchaseOrderItemId: string | null;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		unitRate: string;
		netAmount: string;
		taxAmount: string;
		grossAmount: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('accounts_payable_document_items')
			.values({
				organisation_id: input.organisationId,
				accounts_payable_document_id: input.documentId,
				source_purchase_order_item_id: input.purchaseOrderItemId,
				unit_of_measure_id: input.unitOfMeasureId,
				line_number: input.lineNumber,
				description: input.description,
				quantity: input.quantity,
				unit_rate: input.unitRate,
				net_amount: input.netAmount,
				tax_amount: input.taxAmount,
				gross_amount: input.grossAmount
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'accounts-payable document item');
	}

	async insertDocumentItemTax(input: {
		organisationId: string;
		documentItemId: string;
		taxCategoryId: string;
		ratePercent: string;
		taxableAmount: string;
		taxAmount: string;
	}): Promise<void> {
		await this.db
			.insertInto('accounts_payable_document_item_taxes')
			.values({
				organisation_id: input.organisationId,
				accounts_payable_document_item_id: input.documentItemId,
				tax_category_id: input.taxCategoryId,
				applied_rate_percent: input.ratePercent,
				taxable_amount: input.taxableAmount,
				tax_amount: input.taxAmount,
				sort_order: 1
			})
			.executeTakeFirstOrThrow();
	}

	async insertSupplierSnapshot(input: {
		organisationId: string;
		documentId: string;
		supplierPartyId: string;
		displayName: string;
		email: string | null;
		address: {
			line1: string;
			line2: string | null;
			line3: string | null;
			locality: string | null;
			city: string | null;
			region: string | null;
			postalCode: string | null;
			countryCode: string;
		} | null;
	}): Promise<void> {
		await this.db
			.insertInto('accounts_payable_supplier_snapshots')
			.values({
				organisation_id: input.organisationId,
				accounts_payable_document_id: input.documentId,
				supplier_party_id: input.supplierPartyId,
				display_name: input.displayName,
				email: input.email,
				tax_registration_number: null,
				address_line_1: input.address?.line1 ?? null,
				address_line_2: input.address?.line2 ?? null,
				address_line_3: input.address?.line3 ?? null,
				locality: input.address?.locality ?? null,
				city: input.address?.city ?? null,
				region: input.address?.region ?? null,
				postal_code: input.address?.postalCode ?? null,
				country_code: input.address?.countryCode ?? null
			})
			.executeTakeFirstOrThrow();
	}

	async setDocumentStatus(input: {
		organisationId: string;
		documentId: string;
		fromStatuses: readonly string[];
		status: string;
		submittedAt?: Date | null;
		approvedAt?: Date | null;
	}): Promise<number> {
		const values: Record<string, Date | string | null> = { lifecycle_status: input.status };
		if ('submittedAt' in input) values.submitted_at = input.submittedAt ?? null;
		if ('approvedAt' in input) values.approved_at = input.approvedAt ?? null;
		const result = await this.db
			.updateTable('accounts_payable_documents')
			.set(values)
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.documentId)
			.where('lifecycle_status', 'in', [...input.fromStatuses])
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async insertException(input: {
		organisationId: string;
		publicId: string;
		documentId: string;
		documentItemId: string | null;
		code: string;
		message: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('accounts_payable_exceptions')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				accounts_payable_document_id: input.documentId,
				accounts_payable_document_item_id: input.documentItemId,
				exception_code: input.code,
				severity: 'blocking',
				status: 'open',
				message: input.message,
				created_by_member_id: input.createdByMemberId,
				resolved_by_member_id: null,
				resolution_note: null,
				resolved_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'accounts-payable exception');
	}

	async resolveException(input: {
		organisationId: string;
		exceptionId: string;
		memberId: string;
		status: 'resolved' | 'waived';
		note: string;
		now: Date;
	}): Promise<number> {
		const result = await this.db
			.updateTable('accounts_payable_exceptions')
			.set({
				status: input.status,
				resolved_by_member_id: input.memberId,
				resolution_note: input.note,
				resolved_at: input.now
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.exceptionId)
			.where('status', '=', 'open')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async listActiveAllocationsForPurchaseOrderItem(
		organisationId: string,
		purchaseOrderItemId: string
	) {
		return this.db
			.selectFrom('accounts_payable_match_allocations as allocation')
			.innerJoin('accounts_payable_document_items as item', (join) =>
				join
					.onRef('item.id', '=', 'allocation.accounts_payable_document_item_id')
					.onRef('item.organisation_id', '=', 'allocation.organisation_id')
			)
			.innerJoin('accounts_payable_documents as document', (join) =>
				join
					.onRef('document.id', '=', 'item.accounts_payable_document_id')
					.onRef('document.organisation_id', '=', 'item.organisation_id')
			)
			.select([
				'allocation.id as id',
				'allocation.accounts_payable_document_item_id as documentItemId',
				'allocation.purchase_order_receipt_item_id as receiptItemId',
				'allocation.matched_quantity as matchedQuantity',
				'allocation.matched_net_amount as matchedNetAmount'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.purchase_order_item_id', '=', purchaseOrderItemId)
			.where('document.lifecycle_status', 'not in', ['void', 'rejected'])
			.execute();
	}

	async listAllocationsForDocumentItem(organisationId: string, documentItemId: string) {
		return this.db
			.selectFrom('accounts_payable_match_allocations')
			.select([
				'id',
				'purchase_order_receipt_item_id as receiptItemId',
				'matched_quantity as matchedQuantity',
				'matched_net_amount as matchedNetAmount'
			])
			.where('organisation_id', '=', organisationId)
			.where('accounts_payable_document_item_id', '=', documentItemId)
			.orderBy('id')
			.execute();
	}

	async insertMatchAllocation(input: {
		organisationId: string;
		documentItemId: string;
		purchaseOrderItemId: string;
		receiptItemId: string | null;
		matchedQuantity: string;
		matchedNetAmount: string;
		matchedByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('accounts_payable_match_allocations')
			.values({
				organisation_id: input.organisationId,
				accounts_payable_document_item_id: input.documentItemId,
				purchase_order_item_id: input.purchaseOrderItemId,
				purchase_order_receipt_item_id: input.receiptItemId,
				matched_quantity: input.matchedQuantity,
				matched_net_amount: input.matchedNetAmount,
				matched_by_member_id: input.matchedByMemberId
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'accounts-payable match allocation');
	}

	async insertApprovalEvent(input: {
		organisationId: string;
		publicId: string;
		documentId: string;
		decision: 'approved' | 'rejected' | 'returned';
		memberId: string;
		note: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('accounts_payable_approval_events')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				accounts_payable_document_id: input.documentId,
				decision: input.decision,
				decided_by_member_id: input.memberId,
				decision_note: input.note
			})
			.executeTakeFirstOrThrow();
	}

	async countOpenBlockingExceptions(organisationId: string, documentId: string): Promise<number> {
		const rows = await this.db
			.selectFrom('accounts_payable_exceptions')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('accounts_payable_document_id', '=', documentId)
			.where('severity', '=', 'blocking')
			.where('status', '=', 'open')
			.execute();
		return rows.length;
	}
}
