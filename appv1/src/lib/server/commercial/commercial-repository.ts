import type { DatabaseExecutor } from '$lib/server/db/executor';
import { applyPercentage, lineAmount, sumMoney } from './commercial-decimal';

export type EstimateLifecycleStatus = 'active' | 'cancelled' | 'archived';
export type EstimateVersionStatus = 'draft' | 'final' | 'superseded';
export type QuotationLifecycleStatus = 'active' | 'cancelled' | 'archived';
export type QuotationVersionStatus = 'draft' | 'issued' | 'superseded' | 'withdrawn';
export type QuotationResponseType =
	'accepted' | 'rejected' | 'revision_requested' | 'withdrawn_by_customer';
export type QuotationEffectiveStatus =
	| 'draft'
	| 'issued'
	| 'accepted'
	| 'rejected'
	| 'revision_requested'
	| 'expired'
	| 'superseded'
	| 'withdrawn';
export type DeliveryChannel = 'email' | 'portal' | 'manual' | 'api' | 'other';

export type CommercialReferenceItem = { id: number; code: string; name: string };
export type CommercialUnit = CommercialReferenceItem & { symbol: string | null };
export type CommercialTaxCategory = {
	id: string;
	publicId: string;
	code: string;
	name: string;
	treatment: string;
	ratePercent: string | null;
};

export type CommercialOpportunityCandidate = {
	id: string;
	publicId: string;
	title: string;
	status: string;
	currencyCode: string;
	customerPartyId: string;
	customerPublicId: string;
	customerDisplayName: string;
	primaryContactPartyId: string | null;
};

export type EstimateRecord = {
	id: string;
	publicId: string;
	estimateNumber: string;
	title: string;
	lifecycleStatus: EstimateLifecycleStatus;
	opportunityId: string | null;
	opportunityPublicId: string | null;
	opportunityTitle: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type EstimateVersionRecord = {
	id: string;
	versionNumber: number;
	currencyCode: string;
	versionStatus: EstimateVersionStatus;
	createdByMemberId: string;
	finalisedByMemberId: string | null;
	finalisedAt: Date | null;
	notes: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type EstimateCostComponent = {
	id: string;
	sortOrder: number;
	salesItemTypeId: number;
	salesItemTypeCode: string;
	salesItemTypeName: string;
	unitOfMeasureId: number | null;
	unitCode: string | null;
	unitSymbol: string | null;
	description: string;
	quantity: string;
	unitCost: string;
	wastePercent: string;
	markupPercent: string;
	baseCost: string;
	wastedCost: string;
};

export type EstimateItemRecord = {
	id: string;
	lineNumber: number;
	salesItemTypeId: number;
	salesItemTypeCode: string;
	salesItemTypeName: string;
	unitOfMeasureId: number | null;
	unitCode: string | null;
	unitSymbol: string | null;
	description: string;
	quantity: string;
	sellUnitRate: string;
	isOptional: boolean;
	sellAmount: string;
	components: EstimateCostComponent[];
	costAmount: string;
};

export type EstimateSummary = EstimateRecord & {
	latestVersionNumber: number | null;
	latestVersionStatus: EstimateVersionStatus | null;
	currencyCode: string | null;
	sellTotal: string;
	costTotal: string;
};

export type QuotationRecord = {
	id: string;
	publicId: string;
	quotationNumber: string;
	lifecycleStatus: QuotationLifecycleStatus;
	opportunityId: string | null;
	opportunityPublicId: string | null;
	opportunityTitle: string | null;
	customerPartyId: string;
	customerPublicId: string;
	customerDisplayName: string;
	primaryContactPartyId: string | null;
	primaryContactPublicId: string | null;
	primaryContactDisplayName: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type QuotationVersionRecord = {
	id: string;
	versionNumber: number;
	title: string;
	currencyCode: string;
	customerReference: string | null;
	validUntil: Date | null;
	versionStatus: QuotationVersionStatus;
	createdByMemberId: string;
	lockedByMemberId: string | null;
	lockedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type QuotationItemTax = {
	id: string;
	taxCategoryId: string;
	taxCategoryPublicId: string;
	taxCategoryName: string;
	appliedRatePercent: string;
	taxableAmount: string;
	taxAmount: string;
};

export type QuotationItemRecord = {
	id: string;
	lineNumber: number;
	sourceEstimateItemId: string | null;
	salesItemTypeId: number;
	salesItemTypeCode: string;
	salesItemTypeName: string;
	unitOfMeasureId: number | null;
	unitCode: string | null;
	unitSymbol: string | null;
	description: string;
	quantity: string;
	unitRate: string;
	isOptional: boolean;
	netAmount: string;
	taxes: QuotationItemTax[];
	taxAmount: string;
	grossAmount: string;
};

export type QuotationTextBlock = {
	id: string;
	blockType: string;
	sortOrder: number;
	heading: string | null;
	body: string;
};

export type QuotationIssue = {
	id: string;
	issueSequence: number;
	deliveryChannel: DeliveryChannel;
	issuedAt: Date;
	note: string | null;
	recipients: Array<{
		id: string;
		sourcePartyId: string | null;
		recipientName: string | null;
		recipientEmail: string | null;
		deliveryStatus: string;
		deliveredAt: Date | null;
	}>;
};

export type QuotationResponse = {
	id: string;
	publicId: string;
	responseType: QuotationResponseType;
	respondedAt: Date;
	respondingPartyId: string | null;
	respondentName: string | null;
	respondentEmail: string | null;
	notes: string | null;
};

export type QuotationSummary = QuotationRecord & {
	latestVersionNumber: number | null;
	latestVersionStatus: QuotationVersionStatus | null;
	currencyCode: string | null;
	effectiveStatus: QuotationEffectiveStatus;
	netTotal: string;
	taxTotal: string;
	grossTotal: string;
};

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function estimateLifecycle(value: string): EstimateLifecycleStatus {
	if (value === 'active' || value === 'cancelled' || value === 'archived') return value;
	throw new Error(`Unexpected estimate lifecycle status: ${value}`);
}

function estimateVersionStatus(value: string): EstimateVersionStatus {
	if (value === 'draft' || value === 'final' || value === 'superseded') return value;
	throw new Error(`Unexpected estimate version status: ${value}`);
}

function quotationLifecycle(value: string): QuotationLifecycleStatus {
	if (value === 'active' || value === 'cancelled' || value === 'archived') return value;
	throw new Error(`Unexpected quotation lifecycle status: ${value}`);
}

function quotationVersionStatus(value: string): QuotationVersionStatus {
	if (value === 'draft' || value === 'issued' || value === 'superseded' || value === 'withdrawn')
		return value;
	throw new Error(`Unexpected quotation version status: ${value}`);
}

function responseType(value: string): QuotationResponseType {
	if (
		value === 'accepted' ||
		value === 'rejected' ||
		value === 'revision_requested' ||
		value === 'withdrawn_by_customer'
	)
		return value;
	throw new Error(`Unexpected quotation response type: ${value}`);
}

function partyDisplayName(row: {
	partyKind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	if (row.partyKind === 'person') {
		const preferred = row.preferredName?.trim();
		const family = row.familyName?.trim();
		if (preferred && family) return `${preferred} ${family}`;
		if (preferred) return preferred;
		return [row.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed person';
	}
	return row.tradingName?.trim() || row.legalName?.trim() || 'Unnamed organisation';
}

export class CommercialRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listSalesItemTypes(): Promise<CommercialReferenceItem[]> {
		const rows = await this.db
			.selectFrom('sales_item_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
		return rows.map((row) => ({ id: row.id, code: row.code, name: row.name }));
	}

	async listUnitsOfMeasure(): Promise<CommercialUnit[]> {
		const rows = await this.db
			.selectFrom('units_of_measure')
			.select(['id', 'code', 'name', 'symbol'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
		return rows.map((row) => ({ id: row.id, code: row.code, name: row.name, symbol: row.symbol }));
	}

	async listTaxCategories(
		organisationId: string,
		effectiveAt: Date
	): Promise<CommercialTaxCategory[]> {
		const rows = await this.db
			.selectFrom('tax_categories as category')
			.leftJoin('tax_category_rates as rate', (join) =>
				join
					.onRef('rate.tax_category_id', '=', 'category.id')
					.onRef('rate.organisation_id', '=', 'category.organisation_id')
					.on('rate.valid_from', '<=', effectiveAt)
					.on((eb) =>
						eb.or([eb('rate.valid_to', 'is', null), eb('rate.valid_to', '>=', effectiveAt)])
					)
			)
			.select([
				'category.id as id',
				'category.public_id as publicId',
				'category.code as code',
				'category.name as name',
				'category.treatment as treatment',
				'rate.rate_percent as ratePercent'
			])
			.where('category.organisation_id', '=', organisationId)
			.where('category.is_active', '=', 1)
			.orderBy('category.name', 'asc')
			.execute();
		return rows.map((row) => ({ ...row, ratePercent: row.ratePercent ?? null }));
	}

	async resolveTaxCategory(
		organisationId: string,
		publicId: string,
		effectiveAt: Date
	): Promise<CommercialTaxCategory | null> {
		const categories = await this.listTaxCategories(organisationId, effectiveAt);
		return categories.find((category) => category.publicId === publicId) ?? null;
	}

	async findOpportunityCandidateByPublicId(
		organisationId: string,
		publicId: string
	): Promise<CommercialOpportunityCandidate | null> {
		const row = await this.db
			.selectFrom('opportunities as opportunity')
			.innerJoin('opportunity_parties as customerAssignment', (join) =>
				join
					.onRef('customerAssignment.opportunity_id', '=', 'opportunity.id')
					.onRef('customerAssignment.organisation_id', '=', 'opportunity.organisation_id')
					.on('customerAssignment.is_primary', '=', 1)
			)
			.innerJoin('opportunity_party_role_types as customerRole', (join) =>
				join
					.onRef('customerRole.id', '=', 'customerAssignment.opportunity_party_role_type_id')
					.on('customerRole.code', '=', 'customer')
			)
			.innerJoin('parties as customer', (join) =>
				join
					.onRef('customer.id', '=', 'customerAssignment.party_id')
					.onRef('customer.organisation_id', '=', 'opportunity.organisation_id')
			)
			.leftJoin('party_persons as customerPerson', (join) =>
				join
					.onRef('customerPerson.party_id', '=', 'customer.id')
					.onRef('customerPerson.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('party_organisations as customerCompany', (join) =>
				join
					.onRef('customerCompany.party_id', '=', 'customer.id')
					.onRef('customerCompany.organisation_id', '=', 'customer.organisation_id')
			)
			.select([
				'opportunity.id as id',
				'opportunity.public_id as publicId',
				'opportunity.title as title',
				'opportunity.status as status',
				'opportunity.currency_code as currencyCode',
				'customer.id as customerPartyId',
				'customer.public_id as customerPublicId',
				'customer.party_kind as partyKind',
				'customerPerson.preferred_name as preferredName',
				'customerPerson.given_names as givenNames',
				'customerPerson.family_name as familyName',
				'customerCompany.legal_name as legalName',
				'customerCompany.trading_name as tradingName'
			])
			.where('opportunity.organisation_id', '=', organisationId)
			.where('opportunity.public_id', '=', publicId)
			.executeTakeFirst();
		if (!row) return null;

		const contact = await this.db
			.selectFrom('opportunity_parties as assignment')
			.innerJoin(
				'opportunity_party_role_types as role',
				'role.id',
				'assignment.opportunity_party_role_type_id'
			)
			.select('assignment.party_id as partyId')
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.opportunity_id', '=', row.id)
			.where('role.code', '=', 'client_contact')
			.executeTakeFirst();

		return {
			id: row.id,
			publicId: row.publicId,
			title: row.title,
			status: row.status,
			currencyCode: row.currencyCode,
			customerPartyId: row.customerPartyId,
			customerPublicId: row.customerPublicId,
			customerDisplayName: partyDisplayName(row),
			primaryContactPartyId: contact?.partyId ?? null
		};
	}

	async listEstimateRecords(organisationId: string): Promise<EstimateRecord[]> {
		const rows = await this.db
			.selectFrom('estimates as estimate')
			.leftJoin('opportunities as opportunity', (join) =>
				join
					.onRef('opportunity.id', '=', 'estimate.opportunity_id')
					.onRef('opportunity.organisation_id', '=', 'estimate.organisation_id')
			)
			.select([
				'estimate.id as id',
				'estimate.public_id as publicId',
				'estimate.estimate_number as estimateNumber',
				'estimate.title as title',
				'estimate.lifecycle_status as lifecycleStatus',
				'estimate.opportunity_id as opportunityId',
				'opportunity.public_id as opportunityPublicId',
				'opportunity.title as opportunityTitle',
				'estimate.created_at as createdAt',
				'estimate.updated_at as updatedAt'
			])
			.where('estimate.organisation_id', '=', organisationId)
			.orderBy('estimate.updated_at', 'desc')
			.limit(250)
			.execute();
		return rows.map((row) => ({ ...row, lifecycleStatus: estimateLifecycle(row.lifecycleStatus) }));
	}

	async findEstimateByPublicId(
		organisationId: string,
		publicId: string,
		lock = false
	): Promise<EstimateRecord | null> {
		let query = this.db
			.selectFrom('estimates as estimate')
			.leftJoin('opportunities as opportunity', (join) =>
				join
					.onRef('opportunity.id', '=', 'estimate.opportunity_id')
					.onRef('opportunity.organisation_id', '=', 'estimate.organisation_id')
			)
			.select([
				'estimate.id as id',
				'estimate.public_id as publicId',
				'estimate.estimate_number as estimateNumber',
				'estimate.title as title',
				'estimate.lifecycle_status as lifecycleStatus',
				'estimate.opportunity_id as opportunityId',
				'opportunity.public_id as opportunityPublicId',
				'opportunity.title as opportunityTitle',
				'estimate.created_at as createdAt',
				'estimate.updated_at as updatedAt'
			])
			.where('estimate.organisation_id', '=', organisationId)
			.where('estimate.public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		return row ? { ...row, lifecycleStatus: estimateLifecycle(row.lifecycleStatus) } : null;
	}

	async listEstimateVersions(
		organisationId: string,
		estimateId: string
	): Promise<EstimateVersionRecord[]> {
		const rows = await this.db
			.selectFrom('estimate_versions')
			.select([
				'id',
				'version_number as versionNumber',
				'currency_code as currencyCode',
				'version_status as versionStatus',
				'created_by_member_id as createdByMemberId',
				'finalised_by_member_id as finalisedByMemberId',
				'finalised_at as finalisedAt',
				'notes',
				'created_at as createdAt',
				'updated_at as updatedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('estimate_id', '=', estimateId)
			.orderBy('version_number', 'desc')
			.execute();
		return rows.map((row) => ({ ...row, versionStatus: estimateVersionStatus(row.versionStatus) }));
	}

	async findEstimateVersion(
		organisationId: string,
		estimateId: string,
		versionId: string,
		lock = false
	): Promise<EstimateVersionRecord | null> {
		let query = this.db
			.selectFrom('estimate_versions')
			.select([
				'id',
				'version_number as versionNumber',
				'currency_code as currencyCode',
				'version_status as versionStatus',
				'created_by_member_id as createdByMemberId',
				'finalised_by_member_id as finalisedByMemberId',
				'finalised_at as finalisedAt',
				'notes',
				'created_at as createdAt',
				'updated_at as updatedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('estimate_id', '=', estimateId)
			.where('id', '=', versionId);
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		return row ? { ...row, versionStatus: estimateVersionStatus(row.versionStatus) } : null;
	}

	async listEstimateItems(
		organisationId: string,
		versionId: string
	): Promise<EstimateItemRecord[]> {
		const rows = await this.db
			.selectFrom('estimate_items as item')
			.innerJoin('sales_item_types as type', 'type.id', 'item.sales_item_type_id')
			.leftJoin('units_of_measure as unit', 'unit.id', 'item.unit_of_measure_id')
			.select([
				'item.id as id',
				'item.line_number as lineNumber',
				'item.sales_item_type_id as salesItemTypeId',
				'type.code as salesItemTypeCode',
				'type.name as salesItemTypeName',
				'item.unit_of_measure_id as unitOfMeasureId',
				'unit.code as unitCode',
				'unit.symbol as unitSymbol',
				'item.description as description',
				'item.quantity as quantity',
				'item.sell_unit_rate as sellUnitRate',
				'item.is_optional as isOptional'
			])
			.where('item.organisation_id', '=', organisationId)
			.where('item.estimate_version_id', '=', versionId)
			.orderBy('item.line_number', 'asc')
			.execute();
		const result: EstimateItemRecord[] = [];
		for (const row of rows) {
			const components = await this.listEstimateCostComponents(organisationId, versionId, row.id);
			const costAmount = sumMoney(components.map((component) => component.wastedCost));
			result.push({
				...row,
				isOptional: row.isOptional === 1,
				sellAmount: lineAmount(row.quantity, row.sellUnitRate),
				components,
				costAmount
			});
		}
		return result;
	}

	async listEstimateCostComponents(
		organisationId: string,
		versionId: string,
		itemId: string
	): Promise<EstimateCostComponent[]> {
		const rows = await this.db
			.selectFrom('estimate_item_cost_components as component')
			.innerJoin('sales_item_types as type', 'type.id', 'component.sales_item_type_id')
			.leftJoin('units_of_measure as unit', 'unit.id', 'component.unit_of_measure_id')
			.select([
				'component.id as id',
				'component.sort_order as sortOrder',
				'component.sales_item_type_id as salesItemTypeId',
				'type.code as salesItemTypeCode',
				'type.name as salesItemTypeName',
				'component.unit_of_measure_id as unitOfMeasureId',
				'unit.code as unitCode',
				'unit.symbol as unitSymbol',
				'component.description as description',
				'component.quantity as quantity',
				'component.unit_cost as unitCost',
				'component.waste_percent as wastePercent',
				'component.markup_percent as markupPercent'
			])
			.where('component.organisation_id', '=', organisationId)
			.where('component.estimate_version_id', '=', versionId)
			.where('component.estimate_item_id', '=', itemId)
			.orderBy('component.sort_order', 'asc')
			.execute();
		return rows.map((row) => {
			const baseCost = lineAmount(row.quantity, row.unitCost);
			// Waste is a percentage addition to the raw component cost; markup remains
			// visible commercial metadata and does not silently rewrite the item sell rate.
			return { ...row, baseCost, wastedCost: applyPercentage(baseCost, row.wastePercent) };
		});
	}

	async insertEstimate(input: {
		organisationId: string;
		publicId: string;
		estimateNumber: string;
		opportunityId: string;
		createdByMemberId: string;
		title: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('estimates')
				.values({
					organisation_id: input.organisationId,
					public_id: input.publicId,
					estimate_number: input.estimateNumber,
					opportunity_id: input.opportunityId,
					project_id: null,
					created_by_member_id: input.createdByMemberId,
					title: input.title,
					lifecycle_status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertEstimateVersion(input: {
		organisationId: string;
		estimateId: string;
		versionNumber: number;
		currencyCode: string;
		createdByMemberId: string;
		notes?: string | null;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('estimate_versions')
				.values({
					organisation_id: input.organisationId,
					estimate_id: input.estimateId,
					version_number: input.versionNumber,
					currency_code: input.currencyCode,
					version_status: 'draft',
					created_by_member_id: input.createdByMemberId,
					finalised_by_member_id: null,
					finalised_at: null,
					notes: input.notes ?? null
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertEstimateItem(input: {
		organisationId: string;
		versionId: string;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		sellUnitRate: string;
		isOptional: boolean;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('estimate_items')
				.values({
					organisation_id: input.organisationId,
					estimate_version_id: input.versionId,
					estimate_section_id: null,
					sales_item_type_id: input.salesItemTypeId,
					sales_catalog_item_id: null,
					unit_of_measure_id: input.unitOfMeasureId,
					line_number: input.lineNumber,
					description: input.description,
					quantity: input.quantity,
					sell_unit_rate: input.sellUnitRate,
					is_optional: input.isOptional ? 1 : 0
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertEstimateCostComponent(input: {
		organisationId: string;
		versionId: string;
		itemId: string;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		sortOrder: number;
		description: string;
		quantity: string;
		unitCost: string;
		wastePercent: string;
		markupPercent: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('estimate_item_cost_components')
				.values({
					organisation_id: input.organisationId,
					estimate_item_id: input.itemId,
					estimate_version_id: input.versionId,
					sales_item_type_id: input.salesItemTypeId,
					sales_catalog_item_id: null,
					unit_of_measure_id: input.unitOfMeasureId,
					sort_order: input.sortOrder,
					description: input.description,
					quantity: input.quantity,
					unit_cost: input.unitCost,
					waste_percent: input.wastePercent,
					markup_percent: input.markupPercent
				})
				.executeTakeFirstOrThrow()
		);
	}

	async deleteEstimateItem(
		organisationId: string,
		versionId: string,
		itemId: string
	): Promise<void> {
		await this.db
			.deleteFrom('estimate_item_cost_components')
			.where('organisation_id', '=', organisationId)
			.where('estimate_version_id', '=', versionId)
			.where('estimate_item_id', '=', itemId)
			.execute();
		await this.db
			.deleteFrom('estimate_items')
			.where('organisation_id', '=', organisationId)
			.where('estimate_version_id', '=', versionId)
			.where('id', '=', itemId)
			.execute();
	}

	async finaliseEstimateVersion(
		organisationId: string,
		versionId: string,
		memberId: string,
		now: Date
	): Promise<void> {
		await this.db
			.updateTable('estimate_versions')
			.set({ version_status: 'final', finalised_by_member_id: memberId, finalised_at: now })
			.where('organisation_id', '=', organisationId)
			.where('id', '=', versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
	}

	async supersedeOtherFinalEstimateVersions(
		organisationId: string,
		estimateId: string,
		exceptVersionId: string
	): Promise<void> {
		await this.db
			.updateTable('estimate_versions')
			.set({ version_status: 'superseded' })
			.where('organisation_id', '=', organisationId)
			.where('estimate_id', '=', estimateId)
			.where('id', '!=', exceptVersionId)
			.where('version_status', '=', 'final')
			.execute();
	}

	async listQuotationRecords(organisationId: string): Promise<QuotationRecord[]> {
		const rows = await this.db
			.selectFrom('quotations as quotation')
			.leftJoin('opportunities as opportunity', (join) =>
				join
					.onRef('opportunity.id', '=', 'quotation.opportunity_id')
					.onRef('opportunity.organisation_id', '=', 'quotation.organisation_id')
			)
			.innerJoin('parties as customer', (join) =>
				join
					.onRef('customer.id', '=', 'quotation.customer_party_id')
					.onRef('customer.organisation_id', '=', 'quotation.organisation_id')
			)
			.leftJoin('party_persons as customerPerson', (join) =>
				join
					.onRef('customerPerson.party_id', '=', 'customer.id')
					.onRef('customerPerson.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('party_organisations as customerCompany', (join) =>
				join
					.onRef('customerCompany.party_id', '=', 'customer.id')
					.onRef('customerCompany.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('parties as contact', (join) =>
				join
					.onRef('contact.id', '=', 'quotation.primary_contact_party_id')
					.onRef('contact.organisation_id', '=', 'quotation.organisation_id')
			)
			.leftJoin('party_persons as contactPerson', (join) =>
				join
					.onRef('contactPerson.party_id', '=', 'contact.id')
					.onRef('contactPerson.organisation_id', '=', 'contact.organisation_id')
			)
			.select([
				'quotation.id as id',
				'quotation.public_id as publicId',
				'quotation.quotation_number as quotationNumber',
				'quotation.lifecycle_status as lifecycleStatus',
				'quotation.opportunity_id as opportunityId',
				'opportunity.public_id as opportunityPublicId',
				'opportunity.title as opportunityTitle',
				'quotation.customer_party_id as customerPartyId',
				'customer.public_id as customerPublicId',
				'customer.party_kind as customerPartyKind',
				'customerPerson.preferred_name as customerPreferredName',
				'customerPerson.given_names as customerGivenNames',
				'customerPerson.family_name as customerFamilyName',
				'customerCompany.legal_name as customerLegalName',
				'customerCompany.trading_name as customerTradingName',
				'quotation.primary_contact_party_id as primaryContactPartyId',
				'contact.public_id as primaryContactPublicId',
				'contact.party_kind as contactPartyKind',
				'contactPerson.preferred_name as contactPreferredName',
				'contactPerson.given_names as contactGivenNames',
				'contactPerson.family_name as contactFamilyName',
				'quotation.created_at as createdAt',
				'quotation.updated_at as updatedAt'
			])
			.where('quotation.organisation_id', '=', organisationId)
			.orderBy('quotation.updated_at', 'desc')
			.limit(250)
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.publicId,
			quotationNumber: row.quotationNumber,
			lifecycleStatus: quotationLifecycle(row.lifecycleStatus),
			opportunityId: row.opportunityId,
			opportunityPublicId: row.opportunityPublicId,
			opportunityTitle: row.opportunityTitle,
			customerPartyId: row.customerPartyId,
			customerPublicId: row.customerPublicId,
			customerDisplayName: partyDisplayName({
				partyKind: row.customerPartyKind,
				preferredName: row.customerPreferredName,
				givenNames: row.customerGivenNames,
				familyName: row.customerFamilyName,
				legalName: row.customerLegalName,
				tradingName: row.customerTradingName
			}),
			primaryContactPartyId: row.primaryContactPartyId,
			primaryContactPublicId: row.primaryContactPublicId,
			primaryContactDisplayName: row.primaryContactPartyId
				? partyDisplayName({
						partyKind: row.contactPartyKind ?? 'person',
						preferredName: row.contactPreferredName,
						givenNames: row.contactGivenNames,
						familyName: row.contactFamilyName,
						legalName: null,
						tradingName: null
					})
				: null,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt
		}));
	}

	async findQuotationByPublicId(
		organisationId: string,
		publicId: string,
		lock = false
	): Promise<QuotationRecord | null> {
		const records = await this.listQuotationRecords(organisationId);
		const match = records.find((record) => record.publicId === publicId) ?? null;
		if (!match || !lock) return match;
		await this.db
			.selectFrom('quotations')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('id', '=', match.id)
			.forUpdate()
			.executeTakeFirst();
		return match;
	}

	async listQuotationVersions(
		organisationId: string,
		quotationId: string
	): Promise<QuotationVersionRecord[]> {
		const rows = await this.db
			.selectFrom('quotation_versions')
			.select([
				'id',
				'version_number as versionNumber',
				'title',
				'currency_code as currencyCode',
				'customer_reference as customerReference',
				'valid_until as validUntil',
				'version_status as versionStatus',
				'created_by_member_id as createdByMemberId',
				'locked_by_member_id as lockedByMemberId',
				'locked_at as lockedAt',
				'created_at as createdAt',
				'updated_at as updatedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('quotation_id', '=', quotationId)
			.orderBy('version_number', 'desc')
			.execute();
		return rows.map((row) => ({
			...row,
			versionStatus: quotationVersionStatus(row.versionStatus)
		}));
	}

	async findQuotationVersion(
		organisationId: string,
		quotationId: string,
		versionId: string,
		lock = false
	): Promise<QuotationVersionRecord | null> {
		let query = this.db
			.selectFrom('quotation_versions')
			.select([
				'id',
				'version_number as versionNumber',
				'title',
				'currency_code as currencyCode',
				'customer_reference as customerReference',
				'valid_until as validUntil',
				'version_status as versionStatus',
				'created_by_member_id as createdByMemberId',
				'locked_by_member_id as lockedByMemberId',
				'locked_at as lockedAt',
				'created_at as createdAt',
				'updated_at as updatedAt'
			])
			.where('organisation_id', '=', organisationId)
			.where('quotation_id', '=', quotationId)
			.where('id', '=', versionId);
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		return row ? { ...row, versionStatus: quotationVersionStatus(row.versionStatus) } : null;
	}

	async listQuotationItems(
		organisationId: string,
		versionId: string
	): Promise<QuotationItemRecord[]> {
		const rows = await this.db
			.selectFrom('quotation_items as item')
			.innerJoin('sales_item_types as type', 'type.id', 'item.sales_item_type_id')
			.leftJoin('units_of_measure as unit', 'unit.id', 'item.unit_of_measure_id')
			.select([
				'item.id as id',
				'item.line_number as lineNumber',
				'item.source_estimate_item_id as sourceEstimateItemId',
				'item.sales_item_type_id as salesItemTypeId',
				'type.code as salesItemTypeCode',
				'type.name as salesItemTypeName',
				'item.unit_of_measure_id as unitOfMeasureId',
				'unit.code as unitCode',
				'unit.symbol as unitSymbol',
				'item.description as description',
				'item.quantity as quantity',
				'item.unit_rate as unitRate',
				'item.is_optional as isOptional'
			])
			.where('item.organisation_id', '=', organisationId)
			.where('item.quotation_version_id', '=', versionId)
			.orderBy('item.line_number', 'asc')
			.execute();
		const result: QuotationItemRecord[] = [];
		for (const row of rows) {
			const taxes = await this.listQuotationItemTaxes(organisationId, row.id);
			const netAmount = lineAmount(row.quantity, row.unitRate);
			const taxAmount = sumMoney(taxes.map((tax) => tax.taxAmount));
			result.push({
				...row,
				isOptional: row.isOptional === 1,
				netAmount,
				taxes,
				taxAmount,
				grossAmount: sumMoney([netAmount, taxAmount])
			});
		}
		return result;
	}

	async listQuotationItemTaxes(
		organisationId: string,
		itemId: string
	): Promise<QuotationItemTax[]> {
		const rows = await this.db
			.selectFrom('quotation_item_taxes as tax')
			.innerJoin('tax_categories as category', (join) =>
				join
					.onRef('category.id', '=', 'tax.tax_category_id')
					.onRef('category.organisation_id', '=', 'tax.organisation_id')
			)
			.select([
				'tax.id as id',
				'tax.tax_category_id as taxCategoryId',
				'category.public_id as taxCategoryPublicId',
				'category.name as taxCategoryName',
				'tax.applied_rate_percent as appliedRatePercent',
				'tax.taxable_amount as taxableAmount',
				'tax.tax_amount as taxAmount'
			])
			.where('tax.organisation_id', '=', organisationId)
			.where('tax.quotation_item_id', '=', itemId)
			.orderBy('tax.sort_order', 'asc')
			.execute();
		return rows;
	}

	async listQuotationTextBlocks(
		organisationId: string,
		versionId: string
	): Promise<QuotationTextBlock[]> {
		return this.db
			.selectFrom('quotation_text_blocks')
			.select(['id', 'block_type as blockType', 'sort_order as sortOrder', 'heading', 'body'])
			.where('organisation_id', '=', organisationId)
			.where('quotation_version_id', '=', versionId)
			.orderBy('block_type', 'asc')
			.orderBy('sort_order', 'asc')
			.execute();
	}

	async listQuotationIssues(organisationId: string, versionId: string): Promise<QuotationIssue[]> {
		const issues = await this.db
			.selectFrom('quotation_issue_events')
			.select([
				'id',
				'issue_sequence as issueSequence',
				'delivery_channel as deliveryChannel',
				'issued_at as issuedAt',
				'note'
			])
			.where('organisation_id', '=', organisationId)
			.where('quotation_version_id', '=', versionId)
			.orderBy('issue_sequence', 'desc')
			.execute();
		const result: QuotationIssue[] = [];
		for (const issue of issues) {
			const recipients = await this.db
				.selectFrom('quotation_issue_recipients')
				.select([
					'id',
					'source_party_id as sourcePartyId',
					'recipient_name as recipientName',
					'recipient_email as recipientEmail',
					'delivery_status as deliveryStatus',
					'delivered_at as deliveredAt'
				])
				.where('organisation_id', '=', organisationId)
				.where('quotation_issue_event_id', '=', issue.id)
				.orderBy('id', 'asc')
				.execute();
			result.push({
				...issue,
				deliveryChannel: issue.deliveryChannel as DeliveryChannel,
				recipients
			});
		}
		return result;
	}

	async listQuotationResponses(
		organisationId: string,
		quotationId: string
	): Promise<QuotationResponse[]> {
		const rows = await this.db
			.selectFrom('quotation_responses')
			.select([
				'id',
				'public_id as publicId',
				'response_type as responseType',
				'responded_at as respondedAt',
				'responding_party_id as respondingPartyId',
				'respondent_name as respondentName',
				'respondent_email as respondentEmail',
				'notes'
			])
			.where('organisation_id', '=', organisationId)
			.where('quotation_id', '=', quotationId)
			.orderBy('responded_at', 'desc')
			.execute();
		return rows.map((row) => ({ ...row, responseType: responseType(row.responseType) }));
	}

	async insertQuotation(input: {
		organisationId: string;
		publicId: string;
		quotationNumber: string;
		opportunityId: string | null;
		customerPartyId: string;
		primaryContactPartyId: string | null;
		ownerMemberId: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotations')
				.values({
					organisation_id: input.organisationId,
					public_id: input.publicId,
					quotation_number: input.quotationNumber,
					opportunity_id: input.opportunityId,
					project_id: null,
					customer_party_id: input.customerPartyId,
					primary_contact_party_id: input.primaryContactPartyId,
					owner_member_id: input.ownerMemberId,
					lifecycle_status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertQuotationVersion(input: {
		organisationId: string;
		quotationId: string;
		versionNumber: number;
		title: string;
		currencyCode: string;
		customerReference?: string | null;
		validUntil?: Date | null;
		createdByMemberId: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_versions')
				.values({
					organisation_id: input.organisationId,
					quotation_id: input.quotationId,
					version_number: input.versionNumber,
					title: input.title,
					currency_code: input.currencyCode,
					customer_reference: input.customerReference ?? null,
					valid_until: input.validUntil ?? null,
					version_status: 'draft',
					created_by_member_id: input.createdByMemberId,
					locked_by_member_id: null,
					locked_at: null
				})
				.executeTakeFirstOrThrow()
		);
	}

	async linkQuotationEstimateVersion(
		organisationId: string,
		quotationVersionId: string,
		estimateVersionId: string,
		sortOrder: number
	): Promise<void> {
		await this.db
			.insertInto('quotation_version_estimates')
			.values({
				organisation_id: organisationId,
				quotation_version_id: quotationVersionId,
				estimate_version_id: estimateVersionId,
				sort_order: sortOrder
			})
			.executeTakeFirstOrThrow();
	}

	async insertQuotationItem(input: {
		organisationId: string;
		versionId: string;
		sourceEstimateItemId?: string | null;
		salesItemTypeId: number;
		unitOfMeasureId: number | null;
		lineNumber: number;
		description: string;
		quantity: string;
		unitRate: string;
		isOptional: boolean;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_items')
				.values({
					organisation_id: input.organisationId,
					quotation_version_id: input.versionId,
					quotation_section_id: null,
					source_estimate_item_id: input.sourceEstimateItemId ?? null,
					sales_item_type_id: input.salesItemTypeId,
					sales_catalog_item_id: null,
					unit_of_measure_id: input.unitOfMeasureId,
					line_number: input.lineNumber,
					description: input.description,
					quantity: input.quantity,
					unit_rate: input.unitRate,
					is_optional: input.isOptional ? 1 : 0
				})
				.executeTakeFirstOrThrow()
		);
	}

	async updateQuotationVersionDraft(
		organisationId: string,
		versionId: string,
		input: {
			title: string;
			customerReference: string | null;
			validUntil: Date | null;
		}
	): Promise<void> {
		await this.db
			.updateTable('quotation_versions')
			.set({
				title: input.title,
				customer_reference: input.customerReference,
				valid_until: input.validUntil
			})
			.where('organisation_id', '=', organisationId)
			.where('id', '=', versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
	}

	async deleteQuotationItem(
		organisationId: string,
		versionId: string,
		itemId: string
	): Promise<void> {
		await this.db
			.deleteFrom('quotation_item_taxes')
			.where('organisation_id', '=', organisationId)
			.where('quotation_item_id', '=', itemId)
			.execute();
		await this.db
			.deleteFrom('quotation_items')
			.where('organisation_id', '=', organisationId)
			.where('quotation_version_id', '=', versionId)
			.where('id', '=', itemId)
			.execute();
	}

	async replaceQuotationItemTax(input: {
		organisationId: string;
		itemId: string;
		taxCategoryId: string | null;
		ratePercent?: string;
		taxableAmount?: string;
		taxAmount?: string;
	}): Promise<void> {
		await this.db
			.deleteFrom('quotation_item_taxes')
			.where('organisation_id', '=', input.organisationId)
			.where('quotation_item_id', '=', input.itemId)
			.execute();
		if (!input.taxCategoryId) return;
		await this.db
			.insertInto('quotation_item_taxes')
			.values({
				organisation_id: input.organisationId,
				quotation_item_id: input.itemId,
				tax_category_id: input.taxCategoryId,
				applied_rate_percent: input.ratePercent!,
				taxable_amount: input.taxableAmount!,
				tax_amount: input.taxAmount!,
				sort_order: 1
			})
			.executeTakeFirstOrThrow();
	}

	async insertQuotationTextBlock(input: {
		organisationId: string;
		versionId: string;
		blockType: string;
		sortOrder: number;
		heading: string | null;
		body: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_text_blocks')
				.values({
					organisation_id: input.organisationId,
					quotation_version_id: input.versionId,
					block_type: input.blockType,
					sort_order: input.sortOrder,
					heading: input.heading,
					body: input.body
				})
				.executeTakeFirstOrThrow()
		);
	}

	async deleteQuotationTextBlock(
		organisationId: string,
		versionId: string,
		blockId: string
	): Promise<void> {
		await this.db
			.deleteFrom('quotation_text_blocks')
			.where('organisation_id', '=', organisationId)
			.where('quotation_version_id', '=', versionId)
			.where('id', '=', blockId)
			.execute();
	}

	async findPartySnapshotSource(
		organisationId: string,
		partyId: string
	): Promise<{
		partyId: string;
		publicId: string;
		displayName: string;
		email: string | null;
		phone: string | null;
	} | null> {
		const row = await this.db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'party.id')
					.onRef('email.organisation_id', '=', 'party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.leftJoin('party_phone_numbers as phone', (join) =>
				join
					.onRef('phone.party_id', '=', 'party.id')
					.onRef('phone.organisation_id', '=', 'party.organisation_id')
					.on('phone.is_primary', '=', 1)
			)
			.select([
				'party.id as partyId',
				'party.public_id as publicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'email.email as email',
				'phone.phone_e164 as phone'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.id', '=', partyId)
			.executeTakeFirst();
		return row
			? {
					partyId: row.partyId,
					publicId: row.publicId,
					displayName: partyDisplayName(row),
					email: row.email,
					phone: row.phone
				}
			: null;
	}

	async insertQuotationPartySnapshot(input: {
		organisationId: string;
		versionId: string;
		sourcePartyId: string;
		snapshotRole: string;
		displayName: string;
		email: string | null;
		phone: string | null;
		sortOrder?: number;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_party_snapshots')
				.values({
					organisation_id: input.organisationId,
					quotation_version_id: input.versionId,
					source_party_id: input.sourcePartyId,
					snapshot_role: input.snapshotRole,
					display_name: input.displayName,
					email: input.email,
					phone: input.phone,
					reference_identifier: null,
					sort_order: input.sortOrder ?? 1
				})
				.executeTakeFirstOrThrow()
		);
	}

	async findPrimaryPartyAddress(
		organisationId: string,
		partyId: string
	): Promise<{
		addressRole: string;
		line1: string;
		line2: string | null;
		line3: string | null;
		locality: string | null;
		city: string | null;
		region: string | null;
		postalCode: string | null;
		countryCode: string;
	} | null> {
		const row = await this.db
			.selectFrom('party_addresses as link')
			.innerJoin('addresses as address', (join) =>
				join
					.onRef('address.id', '=', 'link.address_id')
					.onRef('address.organisation_id', '=', 'link.organisation_id')
			)
			.select([
				'link.address_role as addressRole',
				'address.line_1 as line1',
				'address.line_2 as line2',
				'address.line_3 as line3',
				'address.locality as locality',
				'address.city as city',
				'address.region as region',
				'address.postal_code as postalCode',
				'address.country_code as countryCode'
			])
			.where('link.organisation_id', '=', organisationId)
			.where('link.party_id', '=', partyId)
			.where('link.is_primary', '=', 1)
			.executeTakeFirst();
		return row ?? null;
	}

	async insertQuotationSnapshotAddress(input: {
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
			.insertInto('quotation_party_snapshot_addresses')
			.values({
				organisation_id: input.organisationId,
				quotation_party_snapshot_id: input.snapshotId,
				quotation_version_id: input.versionId,
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

	async lockQuotationVersion(
		organisationId: string,
		versionId: string,
		memberId: string,
		now: Date
	): Promise<void> {
		await this.db
			.updateTable('quotation_versions')
			.set({ version_status: 'issued', locked_by_member_id: memberId, locked_at: now })
			.where('organisation_id', '=', organisationId)
			.where('id', '=', versionId)
			.where('version_status', '=', 'draft')
			.executeTakeFirst();
	}

	async supersedeQuotationVersion(organisationId: string, versionId: string): Promise<void> {
		await this.db
			.updateTable('quotation_versions')
			.set({ version_status: 'superseded' })
			.where('organisation_id', '=', organisationId)
			.where('id', '=', versionId)
			.where('version_status', '=', 'issued')
			.executeTakeFirst();
	}

	async insertQuotationIssue(input: {
		organisationId: string;
		versionId: string;
		issueSequence: number;
		memberId: string;
		deliveryChannel: DeliveryChannel;
		issuedAt: Date;
		note: string | null;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_issue_events')
				.values({
					organisation_id: input.organisationId,
					quotation_version_id: input.versionId,
					issue_sequence: input.issueSequence,
					issued_by_member_id: input.memberId,
					delivery_channel: input.deliveryChannel,
					issued_at: input.issuedAt,
					note: input.note
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertQuotationIssueRecipient(input: {
		organisationId: string;
		issueId: string;
		versionId: string;
		sourcePartyId: string | null;
		recipientName: string | null;
		recipientEmail: string | null;
		deliveryStatus: string;
		deliveredAt: Date | null;
	}): Promise<void> {
		await this.db
			.insertInto('quotation_issue_recipients')
			.values({
				organisation_id: input.organisationId,
				quotation_issue_event_id: input.issueId,
				quotation_version_id: input.versionId,
				source_party_id: input.sourcePartyId,
				recipient_name: input.recipientName,
				recipient_email: input.recipientEmail,
				delivery_status: input.deliveryStatus,
				delivered_at: input.deliveredAt
			})
			.executeTakeFirstOrThrow();
	}

	async insertQuotationResponse(input: {
		organisationId: string;
		publicId: string;
		quotationId: string;
		versionId: string;
		issueId: string | null;
		responseType: QuotationResponseType;
		respondedAt: Date;
		respondingPartyId: string | null;
		respondentName: string | null;
		respondentEmail: string | null;
		recordedByMemberId: string;
		notes: string | null;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('quotation_responses')
				.values({
					organisation_id: input.organisationId,
					public_id: input.publicId,
					quotation_id: input.quotationId,
					quotation_version_id: input.versionId,
					quotation_issue_event_id: input.issueId,
					response_type: input.responseType,
					responded_at: input.respondedAt,
					responding_party_id: input.respondingPartyId,
					respondent_name: input.respondentName,
					respondent_email: input.respondentEmail,
					recorded_by_member_id: input.recordedByMemberId,
					notes: input.notes
				})
				.executeTakeFirstOrThrow()
		);
	}
}
