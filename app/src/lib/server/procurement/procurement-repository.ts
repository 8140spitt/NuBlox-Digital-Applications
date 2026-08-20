import type { DatabaseExecutor } from '$lib/server/db/executor';

const SUPPLIER_ROLE_CODES = ['supplier', 'subcontractor', 'consultant', 'manufacturer', 'merchant'];

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined) throw new Error(`MySQL did not return the inserted ${label} ID.`);
	return result.insertId.toString();
}

export type ProcurementSupplier = {
	id: string;
	publicId: string;
	displayName: string;
	primaryEmail: string | null;
};

export type ProcurementPackageSummary = {
	id: string;
	publicId: string;
	packageNumber: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	projectName: string | null;
	typeCode: string;
	typeName: string;
	title: string;
	description: string | null;
	currencyCode: string;
	status: string;
	requiredByDate: Date | null;
};

export type ProcurementPackageItem = {
	id: string;
	packageId: string;
	lineNumber: number;
	description: string;
	quantity: string;
	targetUnitCost: string | null;
	requiredByDate: Date | null;
	salesItemTypeId: number;
	unitOfMeasureId: number | null;
};

export type RfqSummary = {
	id: string;
	publicId: string;
	rfqNumber: string;
	packageId: string;
	status: string;
};

export type RfqVersionSummary = {
	id: string;
	rfqId: string;
	versionNumber: number;
	title: string;
	currencyCode: string;
	responseDeadlineAt: Date | null;
	status: string;
	lockedAt: Date | null;
};

export type PurchaseOrderSummary = {
	id: string;
	publicId: string;
	purchaseOrderNumber: string;
	typeCode: string;
	typeName: string;
	supplierPartyId: string;
	supplierPublicId: string;
	supplierName: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	projectName: string | null;
	currencyCode: string;
	status: string;
};

export type PurchaseOrderVersionSummary = {
	id: string;
	purchaseOrderId: string;
	versionNumber: number;
	title: string;
	supplierReference: string | null;
	orderDate: Date | null;
	requiredByDate: Date | null;
	status: string;
	approvedAt: Date | null;
	lockedAt: Date | null;
};

export type PurchaseOrderItemSummary = {
	id: string;
	versionId: string;
	lineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
	salesItemTypeId: number;
	unitOfMeasureId: number | null;
};

export type ReceiptSummary = {
	id: string;
	publicId: string;
	purchaseOrderId: string;
	receiptNumber: string;
	receiptType: string;
	receivedAt: Date;
	status: string;
	supplierDeliveryReference: string | null;
};

export class ProcurementRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listPackageTypes() {
		return this.db
			.selectFrom('procurement_package_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listPurchaseOrderTypes() {
		return this.db
			.selectFrom('purchase_order_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listSalesItemTypes() {
		return this.db
			.selectFrom('sales_item_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listUnitsOfMeasure() {
		return this.db
			.selectFrom('units_of_measure')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async findPackageTypeByCode(code: string) {
		return this.db
			.selectFrom('procurement_package_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async findPurchaseOrderTypeByCode(code: string) {
		return this.db
			.selectFrom('purchase_order_types')
			.select(['id', 'code', 'name'])
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
	}

	async listEligibleSuppliers(organisationId: string): Promise<ProcurementSupplier[]> {
		const rows = await this.db
			.selectFrom('parties as party')
			.innerJoin('party_organisations as partyOrganisation', (join) =>
				join
					.onRef('partyOrganisation.party_id', '=', 'party.id')
					.onRef('partyOrganisation.organisation_id', '=', 'party.organisation_id')
			)
			.innerJoin('party_role_assignments as roleAssignment', (join) =>
				join
					.onRef('roleAssignment.party_id', '=', 'party.id')
					.onRef('roleAssignment.organisation_id', '=', 'party.organisation_id')
			)
			.innerJoin('party_role_types as roleType', 'roleType.id', 'roleAssignment.party_role_type_id')
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'party.id')
					.onRef('email.organisation_id', '=', 'party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'partyOrganisation.legal_name as legalName',
				'partyOrganisation.trading_name as tradingName',
				'email.email as primaryEmail'
			])
			.distinct()
			.where('party.organisation_id', '=', organisationId)
			.where('party.status', '=', 'active')
			.where('roleAssignment.is_active', '=', 1)
			.where('roleType.code', 'in', SUPPLIER_ROLE_CODES)
			.orderBy('partyOrganisation.legal_name')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.publicId,
			displayName: row.tradingName ?? row.legalName,
			primaryEmail: row.primaryEmail
		}));
	}

	async findEligibleSupplierByPublicId(
		organisationId: string,
		publicId: string
	): Promise<ProcurementSupplier | null> {
		const supplier = (await this.listEligibleSuppliers(organisationId)).find(
			(row) => row.publicId === publicId
		);
		return supplier ?? null;
	}

	async findPrimarySupplierAddress(organisationId: string, partyId: string) {
		return this.db
			.selectFrom('party_addresses as partyAddress')
			.innerJoin('addresses as address', (join) =>
				join
					.onRef('address.id', '=', 'partyAddress.address_id')
					.onRef('address.organisation_id', '=', 'partyAddress.organisation_id')
			)
			.select([
				'partyAddress.address_role as addressRole',
				'address.line_1 as line1',
				'address.line_2 as line2',
				'address.line_3 as line3',
				'address.locality as locality',
				'address.city as city',
				'address.region as region',
				'address.postal_code as postalCode',
				'address.country_code as countryCode'
			])
			.where('partyAddress.organisation_id', '=', organisationId)
			.where('partyAddress.party_id', '=', partyId)
			.where('partyAddress.is_primary', '=', 1)
			.orderBy('partyAddress.id')
			.executeTakeFirst();
	}

	async listPackages(organisationId: string, projectIds: readonly string[]): Promise<ProcurementPackageSummary[]> {
		if (projectIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('procurement_packages as procurementPackage')
			.innerJoin('procurement_package_types as packageType', 'packageType.id', 'procurementPackage.procurement_package_type_id')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'procurementPackage.project_id')
					.onRef('project.owning_organisation_id', '=', 'procurementPackage.organisation_id')
			)
			.select([
				'procurementPackage.id as id',
				'procurementPackage.public_id as publicId',
				'procurementPackage.package_number as packageNumber',
				'procurementPackage.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'packageType.code as typeCode',
				'packageType.name as typeName',
				'procurementPackage.title as title',
				'procurementPackage.description as description',
				'procurementPackage.currency_code as currencyCode',
				'procurementPackage.lifecycle_status as status',
				'procurementPackage.required_by_date as requiredByDate'
			])
			.where('procurementPackage.organisation_id', '=', organisationId)
			.where('procurementPackage.project_id', 'in', projectIds)
			.orderBy('procurementPackage.id', 'desc')
			.execute();
		return rows;
	}

	async findPackageByPublicId(organisationId: string, publicId: string): Promise<ProcurementPackageSummary | null> {
		const row = await this.db
			.selectFrom('procurement_packages as procurementPackage')
			.innerJoin('procurement_package_types as packageType', 'packageType.id', 'procurementPackage.procurement_package_type_id')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'procurementPackage.project_id')
					.onRef('project.owning_organisation_id', '=', 'procurementPackage.organisation_id')
			)
			.select([
				'procurementPackage.id as id',
				'procurementPackage.public_id as publicId',
				'procurementPackage.package_number as packageNumber',
				'procurementPackage.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'packageType.code as typeCode',
				'packageType.name as typeName',
				'procurementPackage.title as title',
				'procurementPackage.description as description',
				'procurementPackage.currency_code as currencyCode',
				'procurementPackage.lifecycle_status as status',
				'procurementPackage.required_by_date as requiredByDate'
			])
			.where('procurementPackage.organisation_id', '=', organisationId)
			.where('procurementPackage.public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertPackage(input: {
		organisationId: string;
		publicId: string;
		packageNumber: string;
		packageTypeId: number;
		projectId: string;
		ownerMemberId: string;
		title: string;
		description: string | null;
		currencyCode: string;
		requiredByDate: Date | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('procurement_packages')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				package_number: input.packageNumber,
				procurement_package_type_id: input.packageTypeId,
				project_id: input.projectId,
				owner_member_id: input.ownerMemberId,
				title: input.title,
				description: input.description,
				currency_code: input.currencyCode,
				lifecycle_status: 'draft',
				required_by_date: input.requiredByDate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'procurement package');
	}

	async insertPackageItem(input: {
		organisationId: string;
		packageId: string;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		targetUnitCost: string | null;
		requiredByDate: Date | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('procurement_package_items')
			.values({
				organisation_id: input.organisationId,
				procurement_package_id: input.packageId,
				sales_item_type_id: input.salesItemTypeId,
				unit_of_measure_id: input.unitOfMeasureId,
				line_number: input.lineNumber,
				description: input.description,
				quantity: input.quantity,
				target_unit_cost: input.targetUnitCost,
				required_by_date: input.requiredByDate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'procurement package item');
	}

	async listPackageItems(organisationId: string, packageId: string): Promise<ProcurementPackageItem[]> {
		return this.db
			.selectFrom('procurement_package_items')
			.select([
				'id',
				'procurement_package_id as packageId',
				'line_number as lineNumber',
				'description',
				'quantity',
				'target_unit_cost as targetUnitCost',
				'required_by_date as requiredByDate',
				'sales_item_type_id as salesItemTypeId',
				'unit_of_measure_id as unitOfMeasureId'
			])
			.where('organisation_id', '=', organisationId)
			.where('procurement_package_id', '=', packageId)
			.orderBy('line_number')
			.execute();
	}

	async insertRfq(input: {
		organisationId: string;
		publicId: string;
		rfqNumber: string;
		packageId: string;
		ownerMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfqs')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				rfq_number: input.rfqNumber,
				procurement_package_id: input.packageId,
				owner_member_id: input.ownerMemberId,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFQ');
	}

	async insertRfqVersion(input: {
		organisationId: string;
		rfqId: string;
		versionNumber: number;
		title: string;
		currencyCode: string;
		responseDeadlineAt: Date | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfq_versions')
			.values({
				organisation_id: input.organisationId,
				rfq_id: input.rfqId,
				version_number: input.versionNumber,
				title: input.title,
				currency_code: input.currencyCode,
				response_deadline_at: input.responseDeadlineAt,
				version_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				locked_by_member_id: null,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFQ version');
	}

	async insertRfqItem(input: {
		organisationId: string;
		versionId: string;
		sourcePackageItemId: string | null;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		requiredByDate: Date | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfq_items')
			.values({
				organisation_id: input.organisationId,
				rfq_version_id: input.versionId,
				source_procurement_package_item_id: input.sourcePackageItemId,
				sales_item_type_id: input.salesItemTypeId,
				unit_of_measure_id: input.unitOfMeasureId,
				line_number: input.lineNumber,
				description: input.description,
				quantity: input.quantity,
				required_by_date: input.requiredByDate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFQ item');
	}

	async listRfqsForPackages(organisationId: string, packageIds: readonly string[]): Promise<RfqSummary[]> {
		if (packageIds.length === 0) return [];
		return this.db
			.selectFrom('rfqs')
			.select([
				'id',
				'public_id as publicId',
				'rfq_number as rfqNumber',
				'procurement_package_id as packageId',
				'lifecycle_status as status'
			])
			.where('organisation_id', '=', organisationId)
			.where('procurement_package_id', 'in', packageIds)
			.orderBy('id', 'desc')
			.execute();
	}

	async findRfqByPublicId(organisationId: string, publicId: string): Promise<RfqSummary | null> {
		const row = await this.db
			.selectFrom('rfqs')
			.select([
				'id',
				'public_id as publicId',
				'rfq_number as rfqNumber',
				'procurement_package_id as packageId',
				'lifecycle_status as status'
			])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ?? null;
	}

	async listRfqVersions(organisationId: string, rfqId: string): Promise<RfqVersionSummary[]> {
		return this.db
			.selectFrom('rfq_versions')
			.select([
				'id',
				'rfq_id as rfqId',
				'version_number as versionNumber',
				'title',
				'currency_code as currencyCode',
				'response_deadline_at as responseDeadlineAt',
				'version_status as status',
				'locked_at as lockedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('rfq_id', '=', rfqId)
			.orderBy('version_number', 'desc')
			.execute();
	}

	async issueRfqVersion(input: { organisationId: string; versionId: string; memberId: string }): Promise<number> {
		const result = await this.db
			.updateTable('rfq_versions')
			.set({ version_status: 'issued', locked_by_member_id: input.memberId, locked_at: new Date() })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async insertRfqIssueEvent(input: {
		organisationId: string;
		versionId: string;
		memberId: string;
		channel: string;
		note: string | null;
	}): Promise<string> {
		const existing = await this.db
			.selectFrom('rfq_issue_events')
			.select((eb) => eb.fn.max<number>('issue_sequence').as('maxSequence'))
			.where('organisation_id', '=', input.organisationId)
			.where('rfq_version_id', '=', input.versionId)
			.executeTakeFirst();
		const issueSequence = Number(existing?.maxSequence ?? 0) + 1;
		const result = await this.db
			.insertInto('rfq_issue_events')
			.values({
				organisation_id: input.organisationId,
				rfq_version_id: input.versionId,
				issue_sequence: issueSequence,
				issued_by_member_id: input.memberId,
				delivery_channel: input.channel,
				note: input.note
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFQ issue event');
	}

	async insertRfqInvitation(input: {
		organisationId: string;
		issueEventId: string;
		versionId: string;
		supplierPartyId: string;
		recipientName: string;
		recipientEmail: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('rfq_invitations')
			.values({
				organisation_id: input.organisationId,
				rfq_issue_event_id: input.issueEventId,
				rfq_version_id: input.versionId,
				supplier_party_id: input.supplierPartyId,
				contact_party_id: null,
				recipient_name: input.recipientName,
				recipient_email: input.recipientEmail,
				invitation_status: 'invited',
				responded_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'RFQ invitation');
	}

	async insertPurchaseOrder(input: {
		organisationId: string;
		publicId: string;
		purchaseOrderNumber: string;
		purchaseOrderTypeId: number;
		supplierPartyId: string;
		projectId: string;
		packageId: string | null;
		ownerMemberId: string;
		currencyCode: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_orders')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				purchase_order_number: input.purchaseOrderNumber,
				purchase_order_type_id: input.purchaseOrderTypeId,
				supplier_party_id: input.supplierPartyId,
				project_id: input.projectId,
				procurement_package_id: input.packageId,
				source_procurement_award_id: null,
				owner_member_id: input.ownerMemberId,
				currency_code: input.currencyCode,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order');
	}

	async insertPurchaseOrderVersion(input: {
		organisationId: string;
		purchaseOrderId: string;
		versionNumber: number;
		title: string;
		supplierReference: string | null;
		orderDate: Date | null;
		requiredByDate: Date | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_order_versions')
			.values({
				organisation_id: input.organisationId,
				purchase_order_id: input.purchaseOrderId,
				version_number: input.versionNumber,
				title: input.title,
				supplier_reference: input.supplierReference,
				order_date: input.orderDate,
				required_by_date: input.requiredByDate,
				version_status: 'draft',
				created_by_member_id: input.createdByMemberId,
				approved_by_member_id: null,
				approved_at: null,
				locked_by_member_id: null,
				locked_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order version');
	}

	async insertPurchaseOrderItem(input: {
		organisationId: string;
		versionId: string;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		unitRate: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_order_items')
			.values({
				organisation_id: input.organisationId,
				purchase_order_version_id: input.versionId,
				source_procurement_award_item_id: null,
				source_procurement_package_item_id: null,
				sales_item_type_id: input.salesItemTypeId,
				unit_of_measure_id: input.unitOfMeasureId,
				line_number: input.lineNumber,
				description: input.description,
				quantity: input.quantity,
				unit_rate: input.unitRate
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order item');
	}

	async listPurchaseOrders(organisationId: string, projectIds: readonly string[]): Promise<PurchaseOrderSummary[]> {
		if (projectIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('purchase_orders as purchaseOrder')
			.innerJoin('purchase_order_types as orderType', 'orderType.id', 'purchaseOrder.purchase_order_type_id')
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
				'orderType.code as typeCode',
				'orderType.name as typeName',
				'purchaseOrder.supplier_party_id as supplierPartyId',
				'supplier.public_id as supplierPublicId',
				'supplierOrganisation.legal_name as supplierLegalName',
				'supplierOrganisation.trading_name as supplierTradingName',
				'purchaseOrder.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'purchaseOrder.currency_code as currencyCode',
				'purchaseOrder.lifecycle_status as status'
			])
			.where('purchaseOrder.organisation_id', '=', organisationId)
			.where('purchaseOrder.project_id', 'in', projectIds)
			.orderBy('purchaseOrder.id', 'desc')
			.execute();
		return rows.map(({ supplierLegalName, supplierTradingName, ...row }) => ({
			...row,
			supplierName: supplierTradingName ?? supplierLegalName
		}));
	}

	async findPurchaseOrderByPublicId(organisationId: string, publicId: string): Promise<PurchaseOrderSummary | null> {
		const rows = await this.listPurchaseOrders(
			organisationId,
			(await this.db
				.selectFrom('purchase_orders')
				.select('project_id')
				.where('organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst())?.project_id
				? [
						(await this.db
							.selectFrom('purchase_orders')
							.select('project_id')
							.where('organisation_id', '=', organisationId)
							.where('public_id', '=', publicId)
							.executeTakeFirstOrThrow()).project_id!
					]
				: []
		);
		return rows.find((row) => row.publicId === publicId) ?? null;
	}

	async listPurchaseOrderVersions(organisationId: string, purchaseOrderId: string): Promise<PurchaseOrderVersionSummary[]> {
		return this.db
			.selectFrom('purchase_order_versions')
			.select([
				'id',
				'purchase_order_id as purchaseOrderId',
				'version_number as versionNumber',
				'title',
				'supplier_reference as supplierReference',
				'order_date as orderDate',
				'required_by_date as requiredByDate',
				'version_status as status',
				'approved_at as approvedAt',
				'locked_at as lockedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_id', '=', purchaseOrderId)
			.orderBy('version_number', 'desc')
			.execute();
	}

	async listPurchaseOrderItems(organisationId: string, versionId: string): Promise<PurchaseOrderItemSummary[]> {
		return this.db
			.selectFrom('purchase_order_items')
			.select([
				'id',
				'purchase_order_version_id as versionId',
				'line_number as lineNumber',
				'description',
				'quantity',
				'unit_rate as unitRate',
				'sales_item_type_id as salesItemTypeId',
				'unit_of_measure_id as unitOfMeasureId'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_version_id', '=', versionId)
			.orderBy('line_number')
			.execute();
	}

	async approvePurchaseOrderVersion(input: { organisationId: string; versionId: string; memberId: string }): Promise<number> {
		const now = new Date();
		const result = await this.db
			.updateTable('purchase_order_versions')
			.set({ version_status: 'approved', approved_by_member_id: input.memberId, approved_at: now })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async issuePurchaseOrderVersion(input: { organisationId: string; versionId: string; memberId: string }): Promise<number> {
		const now = new Date();
		const result = await this.db
			.updateTable('purchase_order_versions')
			.set({ version_status: 'issued', locked_by_member_id: input.memberId, locked_at: now })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.versionId)
			.where('version_status', '=', 'approved')
			.executeTakeFirst();
		return Number(result.numUpdatedRows);
	}

	async insertPurchaseOrderSupplierSnapshot(input: {
		organisationId: string;
		versionId: string;
		supplierPartyId: string;
		displayName: string;
		email: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_order_party_snapshots')
			.values({
				organisation_id: input.organisationId,
				purchase_order_version_id: input.versionId,
				source_party_id: input.supplierPartyId,
				snapshot_role: 'supplier',
				display_name: input.displayName,
				email: input.email,
				phone: null,
				reference_identifier: null,
				sort_order: 1
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order supplier snapshot');
	}

	async insertPurchaseOrderSnapshotAddress(input: {
		organisationId: string;
		versionId: string;
		snapshotId: string;
		addressRole: string;
		line1: string;
		line2: string | null;
		line3: string | null;
		locality: string | null;
		city: string | null;
		region: string | null;
		postalCode: string | null;
		countryCode: string;
	}): Promise<void> {
		await this.db
			.insertInto('purchase_order_party_snapshot_addresses')
			.values({
				organisation_id: input.organisationId,
				purchase_order_party_snapshot_id: input.snapshotId,
				purchase_order_version_id: input.versionId,
				address_role: input.addressRole,
				line_1: input.line1,
				line_2: input.line2,
				line_3: input.line3,
				locality: input.locality,
				city: input.city,
				region: input.region,
				postal_code: input.postalCode,
				country_code: input.countryCode
			})
			.executeTakeFirstOrThrow();
	}

	async insertPurchaseOrderIssueEvent(input: {
		organisationId: string;
		versionId: string;
		memberId: string;
		channel: string;
		note: string | null;
	}): Promise<string> {
		const existing = await this.db
			.selectFrom('purchase_order_issue_events')
			.select((eb) => eb.fn.max<number>('issue_sequence').as('maxSequence'))
			.where('organisation_id', '=', input.organisationId)
			.where('purchase_order_version_id', '=', input.versionId)
			.executeTakeFirst();
		const issueSequence = Number(existing?.maxSequence ?? 0) + 1;
		const result = await this.db
			.insertInto('purchase_order_issue_events')
			.values({
				organisation_id: input.organisationId,
				purchase_order_version_id: input.versionId,
				issue_sequence: issueSequence,
				issued_by_member_id: input.memberId,
				delivery_channel: input.channel,
				note: input.note
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order issue event');
	}

	async insertPurchaseOrderIssueRecipient(input: {
		organisationId: string;
		issueEventId: string;
		versionId: string;
		supplierPartyId: string;
		recipientName: string;
		recipientEmail: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('purchase_order_issue_recipients')
			.values({
				organisation_id: input.organisationId,
				purchase_order_issue_event_id: input.issueEventId,
				purchase_order_version_id: input.versionId,
				source_party_id: input.supplierPartyId,
				recipient_name: input.recipientName,
				recipient_email: input.recipientEmail,
				delivery_status: 'sent',
				delivered_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async insertReceipt(input: {
		organisationId: string;
		publicId: string;
		purchaseOrderId: string;
		receiptNumber: string;
		receiptType: string;
		receivedByMemberId: string;
		receivedAt: Date;
		supplierDeliveryReference: string | null;
		notes: string | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('purchase_order_receipts')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				purchase_order_id: input.purchaseOrderId,
				receipt_number: input.receiptNumber,
				receipt_type: input.receiptType,
				received_by_member_id: input.receivedByMemberId,
				received_at: input.receivedAt,
				supplier_delivery_reference: input.supplierDeliveryReference,
				receipt_status: 'confirmed',
				notes: input.notes
			})
			.executeTakeFirstOrThrow();
		return insertedId(result, 'purchase order receipt');
	}

	async insertReceiptItem(input: {
		organisationId: string;
		receiptId: string;
		purchaseOrderItemId: string;
		quantityReceived: string;
		quantityRejected: string;
		rejectionReason: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('purchase_order_receipt_items')
			.values({
				organisation_id: input.organisationId,
				purchase_order_receipt_id: input.receiptId,
				purchase_order_item_id: input.purchaseOrderItemId,
				quantity_received: input.quantityReceived,
				quantity_rejected: input.quantityRejected,
				rejection_reason: input.rejectionReason
			})
			.executeTakeFirstOrThrow();
	}

	async listReceipts(organisationId: string, purchaseOrderId: string): Promise<ReceiptSummary[]> {
		return this.db
			.selectFrom('purchase_order_receipts')
			.select([
				'id',
				'public_id as publicId',
				'purchase_order_id as purchaseOrderId',
				'receipt_number as receiptNumber',
				'receipt_type as receiptType',
				'received_at as receivedAt',
				'receipt_status as status',
				'supplier_delivery_reference as supplierDeliveryReference'
			])
			.where('organisation_id', '=', organisationId)
			.where('purchase_order_id', '=', purchaseOrderId)
			.orderBy('received_at', 'desc')
			.execute();
	}

	async receivedQuantityForItem(organisationId: string, purchaseOrderItemId: string): Promise<string[]> {
		const rows = await this.db
			.selectFrom('purchase_order_receipt_items as item')
			.innerJoin('purchase_order_receipts as receipt', (join) =>
				join
					.onRef('receipt.id', '=', 'item.purchase_order_receipt_id')
					.onRef('receipt.organisation_id', '=', 'item.organisation_id')
			)
			.select('item.quantity_received as quantityReceived')
			.where('item.organisation_id', '=', organisationId)
			.where('item.purchase_order_item_id', '=', purchaseOrderItemId)
			.where('receipt.receipt_status', 'in', ['recorded', 'confirmed'])
			.execute();
		return rows.map((row) => row.quantityReceived);
	}
}
