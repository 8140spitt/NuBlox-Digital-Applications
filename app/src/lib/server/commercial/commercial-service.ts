import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	CrmOpportunityRepository,
	type CrmOpportunitySummary
} from '$lib/server/crm/crm-opportunity-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { compareMoney, lineAmount, percentageAmount, sumMoney } from './commercial-decimal';
import {
	CommercialRepository,
	type CommercialReferenceItem,
	type CommercialTaxCategory,
	type CommercialUnit,
	type DeliveryChannel,
	type EstimateItemRecord,
	type EstimateRecord,
	type EstimateSummary,
	type EstimateVersionRecord,
	type QuotationEffectiveStatus,
	type QuotationItemRecord,
	type QuotationRecord,
	type QuotationResponse,
	type QuotationResponseType,
	type QuotationSummary,
	type QuotationVersionRecord
} from './commercial-repository';

export type CreateEstimateInput = {
	opportunityPublicId: string;
	title: string;
	currencyCode?: string | null;
	notes?: string | null;
};

export type EstimateItemInput = {
	estimatePublicId: string;
	versionNumber: number;
	salesItemTypeId: number;
	unitOfMeasureId?: number | null;
	description: string;
	quantity: string;
	sellUnitRate: string;
	isOptional?: boolean;
};

export type EstimateCostComponentInput = {
	estimatePublicId: string;
	versionNumber: number;
	lineNumber: number;
	salesItemTypeId: number;
	unitOfMeasureId?: number | null;
	description: string;
	quantity: string;
	unitCost: string;
	wastePercent?: string;
	markupPercent?: string;
};

export type CreateQuotationInput = {
	estimatePublicId: string;
	versionNumber: number;
	title?: string | null;
	customerReference?: string | null;
	validUntil?: string | null;
};

export type UpdateQuotationDraftInput = {
	quotationPublicId: string;
	versionNumber: number;
	title: string;
	customerReference?: string | null;
	validUntil?: string | null;
};

export type QuotationLineInput = {
	quotationPublicId: string;
	versionNumber: number;
	salesItemTypeId: number;
	unitOfMeasureId?: number | null;
	description: string;
	quantity: string;
	unitRate: string;
	isOptional?: boolean;
};

export type QuotationTextBlockInput = {
	quotationPublicId: string;
	versionNumber: number;
	blockType: string;
	heading?: string | null;
	body: string;
};

export type IssueQuotationInput = {
	quotationPublicId: string;
	versionNumber: number;
	deliveryChannel: DeliveryChannel;
	recipientName?: string | null;
	recipientEmail?: string | null;
	note?: string | null;
};

export type RecordQuotationResponseInput = {
	quotationPublicId: string;
	versionNumber: number;
	responseType: QuotationResponseType;
	respondedAt?: string | null;
	respondentName?: string | null;
	respondentEmail?: string | null;
	notes?: string | null;
};

export type EstimatePortfolioWorkspace = {
	canView: boolean;
	canManageEstimates: boolean;
	canManageQuotations: boolean;
	estimates: EstimateSummary[];
	opportunities: CrmOpportunitySummary[];
	salesItemTypes: CommercialReferenceItem[];
	units: CommercialUnit[];
};

export type EstimateWorkspace = {
	estimate: EstimateRecord;
	versions: EstimateVersionRecord[];
	version: EstimateVersionRecord;
	items: EstimateItemRecord[];
	sellTotal: string;
	costTotal: string;
	marginAmount: string;
	canManageEstimates: boolean;
	canManageQuotations: boolean;
	salesItemTypes: CommercialReferenceItem[];
	units: CommercialUnit[];
};

export type QuotationPortfolioWorkspace = {
	canView: boolean;
	quotations: QuotationSummary[];
};

export type QuotationWorkspace = {
	quotation: QuotationRecord;
	versions: QuotationVersionRecord[];
	version: QuotationVersionRecord;
	items: QuotationItemRecord[];
	textBlocks: Awaited<ReturnType<CommercialRepository['listQuotationTextBlocks']>>;
	issues: Awaited<ReturnType<CommercialRepository['listQuotationIssues']>>;
	responses: QuotationResponse[];
	taxCategories: CommercialTaxCategory[];
	netTotal: string;
	taxTotal: string;
	grossTotal: string;
	effectiveStatus: QuotationEffectiveStatus;
	canManageQuotations: boolean;
	canIssueQuotations: boolean;
	canRecordResponses: boolean;
	salesItemTypes: CommercialReferenceItem[];
	units: CommercialUnit[];
};

export class CommercialValidationError extends Error {
	readonly code = 'COMMERCIAL_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CommercialValidationError';
	}
}

type CommercialPermission =
	| 'commercial.estimate.manage'
	| 'commercial.quotation.manage'
	| 'commercial.quotation.issue'
	| 'commercial.quotation.response.record';

function requiredText(value: string, maxLength: number, label: string): string {
	const text = value.trim();
	if (!text || text.length > maxLength)
		throw new CommercialValidationError(`${label} must be between 1 and ${maxLength} characters.`);
	return text;
}

function optionalText(
	value: string | null | undefined,
	maxLength: number,
	label: string
): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > maxLength)
		throw new CommercialValidationError(`${label} must not exceed ${maxLength} characters.`);
	return text;
}

function publicId(value: string, label: string): string {
	const result = value.trim();
	if (!result || result.length > 64) throw new CommercialValidationError(`${label} is required.`);
	return result;
}

function currencyCode(value: string | null | undefined): string {
	const result = (value?.trim() || 'GBP').toUpperCase();
	if (!/^[A-Z]{3}$/.test(result))
		throw new CommercialValidationError('Currency code must be a three-letter ISO code.');
	return result;
}

function decimal(
	value: string,
	integerDigits: number,
	scale: number,
	label: string,
	allowZero = true
): string {
	const text = value.trim();
	const pattern = new RegExp(`^\\d{1,${integerDigits}}(?:\\.\\d{1,${scale}})?$`);
	if (!pattern.test(text))
		throw new CommercialValidationError(
			`${label} must be a non-negative decimal with at most ${scale} decimal places.`
		);
	if (!allowZero && /^0+(?:\.0+)?$/.test(text))
		throw new CommercialValidationError(`${label} must be greater than zero.`);
	return text;
}

function percentage(value: string | null | undefined, label: string): string {
	const text = value?.trim() || '0';
	const parsed = decimal(text, 3, 4, label);
	if (
		compareMoney(
			`${parsed.includes('.') ? parsed : `${parsed}.0`}`.padEnd(
				parsed.includes('.') ? parsed.length : parsed.length + 2,
				'0'
			),
			'100.0000'
		) > 0
	) {
		// compareMoney is a money-scale comparison; the preceding normalisation is only
		// used to guard the common 0..100 percentage range without binary floats.
		throw new CommercialValidationError(`${label} must not exceed 100%.`);
	}
	return parsed;
}

function dateValue(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new CommercialValidationError(`${label} must be a valid date.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text)
		throw new CommercialValidationError(`${label} must be a valid date.`);
	return date;
}

function positiveInteger(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value <= 0)
		throw new CommercialValidationError(`${label} is invalid.`);
	return value;
}

function blockType(value: string): string {
	if (['scope', 'assumption', 'exclusion', 'clarification', 'term', 'note'].includes(value))
		return value;
	throw new CommercialValidationError('Quotation narrative type is invalid.');
}

function deliveryChannel(value: string): DeliveryChannel {
	if (
		value === 'email' ||
		value === 'portal' ||
		value === 'manual' ||
		value === 'api' ||
		value === 'other'
	)
		return value;
	throw new CommercialValidationError('Quotation delivery channel is invalid.');
}

function responseType(value: string): QuotationResponseType {
	if (
		value === 'accepted' ||
		value === 'rejected' ||
		value === 'revision_requested' ||
		value === 'withdrawn_by_customer'
	)
		return value;
	throw new CommercialValidationError('Quotation response type is invalid.');
}

function documentNumber(prefix: 'EST' | 'QUO', id: string, now: Date): string {
	const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
	return `${prefix}-${stamp}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function estimateTotals(items: readonly EstimateItemRecord[]): {
	sellTotal: string;
	costTotal: string;
	marginAmount: string;
} {
	const included = items.filter((item) => !item.isOptional);
	const sellTotal = sumMoney(included.map((item) => item.sellAmount));
	const costTotal = sumMoney(included.map((item) => item.costAmount));
	const marginAmount = sumMoney([sellTotal, `-${costTotal}`]);
	return { sellTotal, costTotal, marginAmount };
}

function quotationTotals(items: readonly QuotationItemRecord[]): {
	netTotal: string;
	taxTotal: string;
	grossTotal: string;
} {
	// Package 003 intentionally has no customer option-selection model yet. Base
	// document totals therefore exclude optional lines until selection is modelled.
	const included = items.filter((item) => !item.isOptional);
	return {
		netTotal: sumMoney(included.map((item) => item.netAmount)),
		taxTotal: sumMoney(included.map((item) => item.taxAmount)),
		grossTotal: sumMoney(included.map((item) => item.grossAmount))
	};
}

function effectiveQuotationStatus(
	version: QuotationVersionRecord,
	responses: readonly QuotationResponse[],
	now: Date
): QuotationEffectiveStatus {
	if (version.versionStatus === 'draft') return 'draft';
	if (responses.some((response) => response.responseType === 'accepted')) return 'accepted';
	if (version.versionStatus === 'superseded') return 'superseded';
	if (version.versionStatus === 'withdrawn') return 'withdrawn';
	const latestResponse = responses[0];
	if (latestResponse?.responseType === 'rejected') return 'rejected';
	if (latestResponse?.responseType === 'revision_requested') return 'revision_requested';
	if (
		version.validUntil &&
		version.validUntil.getTime() <
			Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
	)
		return 'expired';
	return 'issued';
}

export class CommercialService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async assertView(actor: TenantActorContext): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, 'commercial.view');
		if (!decision.allowed) throw new TenantAccessError('Commercial viewing is not permitted.');
	}

	private async assertManage(
		actor: TenantActorContext,
		permission: CommercialPermission,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			permission,
			'commercial.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('Commercial management is not permitted.');
	}

	private async permissionFlags(actor: TenantActorContext) {
		const service = new PermissionService(this.db);
		const [view, estimate, quotation, issue, response] = await Promise.all([
			service.decide(actor, 'commercial.view'),
			service.decideWithUmbrella(actor, 'commercial.estimate.manage', 'commercial.manage'),
			service.decideWithUmbrella(actor, 'commercial.quotation.manage', 'commercial.manage'),
			service.decideWithUmbrella(actor, 'commercial.quotation.issue', 'commercial.manage'),
			service.decideWithUmbrella(actor, 'commercial.quotation.response.record', 'commercial.manage')
		]);
		return {
			canView: view.allowed,
			canManageEstimates: estimate.allowed,
			canManageQuotations: quotation.allowed,
			canIssueQuotations: issue.allowed,
			canRecordResponses: response.allowed
		};
	}

	private async referenceExists(
		repository: CommercialRepository,
		salesItemTypeId: number,
		unitOfMeasureId: number | null
	): Promise<void> {
		const [types, units] = await Promise.all([
			repository.listSalesItemTypes(),
			repository.listUnitsOfMeasure()
		]);
		if (!types.some((item) => item.id === salesItemTypeId))
			throw new CommercialValidationError('The selected sales item type is unavailable.');
		if (unitOfMeasureId !== null && !units.some((unit) => unit.id === unitOfMeasureId))
			throw new CommercialValidationError('The selected unit of measure is unavailable.');
	}

	private async estimateVersionByNumber(
		repository: CommercialRepository,
		organisationId: string,
		estimateId: string,
		versionNumber: number
	) {
		const versions = await repository.listEstimateVersions(organisationId, estimateId);
		const version = versions.find((candidate) => candidate.versionNumber === versionNumber);
		if (!version) throw new RecordNotFoundError('Estimate version not found.');
		return version;
	}

	private async quotationVersionByNumber(
		repository: CommercialRepository,
		organisationId: string,
		quotationId: string,
		versionNumber: number
	) {
		const versions = await repository.listQuotationVersions(organisationId, quotationId);
		const version = versions.find((candidate) => candidate.versionNumber === versionNumber);
		if (!version) throw new RecordNotFoundError('Quotation version not found.');
		return version;
	}

	async listEstimates(actor: TenantActorContext): Promise<EstimatePortfolioWorkspace> {
		await this.assertActiveActor(actor);
		const flags = await this.permissionFlags(actor);
		if (!flags.canView)
			return {
				canView: false,
				canManageEstimates: flags.canManageEstimates,
				canManageQuotations: flags.canManageQuotations,
				estimates: [],
				opportunities: [],
				salesItemTypes: [],
				units: []
			};
		const repository = new CommercialRepository(this.db);
		const [records, opportunities, salesItemTypes, units] = await Promise.all([
			repository.listEstimateRecords(actor.organisationId),
			new CrmOpportunityRepository(this.db).listOpportunities(actor.organisationId),
			repository.listSalesItemTypes(),
			repository.listUnitsOfMeasure()
		]);
		const estimates: EstimateSummary[] = [];
		for (const record of records) {
			const versions = await repository.listEstimateVersions(actor.organisationId, record.id);
			const latest = versions[0] ?? null;
			const items = latest
				? await repository.listEstimateItems(actor.organisationId, latest.id)
				: [];
			const totals = estimateTotals(items);
			estimates.push({
				...record,
				latestVersionNumber: latest?.versionNumber ?? null,
				latestVersionStatus: latest?.versionStatus ?? null,
				currencyCode: latest?.currencyCode ?? null,
				sellTotal: totals.sellTotal,
				costTotal: totals.costTotal
			});
		}
		return {
			canView: true,
			canManageEstimates: flags.canManageEstimates,
			canManageQuotations: flags.canManageQuotations,
			estimates,
			opportunities: opportunities.filter(
				(opportunity) => opportunity.status === 'open' || opportunity.status === 'won'
			),
			salesItemTypes,
			units
		};
	}

	async getEstimate(
		actor: TenantActorContext,
		estimatePublicIdInput: string,
		requestedVersionNumber?: number
	): Promise<EstimateWorkspace> {
		await this.assertView(actor);
		const estimatePublicId = publicId(estimatePublicIdInput, 'Estimate ID');
		const repository = new CommercialRepository(this.db);
		const estimate = await repository.findEstimateByPublicId(
			actor.organisationId,
			estimatePublicId
		);
		if (!estimate) throw new RecordNotFoundError('Estimate not found.');
		const versions = await repository.listEstimateVersions(actor.organisationId, estimate.id);
		if (versions.length === 0) throw new Error('Estimate has no versions.');
		const version = requestedVersionNumber
			? versions.find((candidate) => candidate.versionNumber === requestedVersionNumber)
			: versions[0];
		if (!version) throw new RecordNotFoundError('Estimate version not found.');
		const [items, flags, salesItemTypes, units] = await Promise.all([
			repository.listEstimateItems(actor.organisationId, version.id),
			this.permissionFlags(actor),
			repository.listSalesItemTypes(),
			repository.listUnitsOfMeasure()
		]);
		return {
			estimate,
			versions,
			version,
			items,
			...estimateTotals(items),
			canManageEstimates: flags.canManageEstimates,
			canManageQuotations: flags.canManageQuotations,
			salesItemTypes,
			units
		};
	}

	async createEstimate(
		actor: TenantActorContext,
		input: CreateEstimateInput
	): Promise<EstimateRecord> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.estimate.manage');
		const opportunityPublicId = publicId(input.opportunityPublicId, 'Opportunity');
		const title = requiredText(input.title, 255, 'Estimate title');
		const currency = currencyCode(input.currencyCode);
		const notes = optionalText(input.notes, 10_000, 'Estimate notes');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.estimate.manage', trx);
			const repository = new CommercialRepository(trx);
			const opportunity = await repository.findOpportunityCandidateByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
			if (opportunity.status === 'lost' || opportunity.status === 'cancelled')
				throw new CommercialValidationError(
					'A lost or cancelled opportunity cannot receive a new estimate.'
				);
			const estimatePublicId = this.publicIdFactory();
			const now = this.now();
			const estimateId = await repository.insertEstimate({
				organisationId: actor.organisationId,
				publicId: estimatePublicId,
				estimateNumber: documentNumber('EST', estimatePublicId, now),
				opportunityId: opportunity.id,
				createdByMemberId: membership.id,
				title
			});
			await repository.insertEstimateVersion({
				organisationId: actor.organisationId,
				estimateId,
				versionNumber: 1,
				currencyCode: currency,
				createdByMemberId: membership.id,
				notes
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.estimate.created',
				subjectType: 'estimate',
				subjectPublicId: estimatePublicId,
				correlationId: actor.correlationId,
				changeSummary: { opportunityPublicId, currencyCode: currency }
			});
			const created = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId
			);
			if (!created) throw new Error('Created estimate could not be reloaded.');
			return created;
		});
	}

	async addEstimateItem(actor: TenantActorContext, input: EstimateItemInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.estimate.manage');
		const estimatePublicId = publicId(input.estimatePublicId, 'Estimate ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const salesItemTypeId = positiveInteger(input.salesItemTypeId, 'Sales item type');
		const unitId =
			input.unitOfMeasureId == null
				? null
				: positiveInteger(input.unitOfMeasureId, 'Unit of measure');
		const description = requiredText(input.description, 10_000, 'Line description');
		const quantity = decimal(input.quantity, 13, 6, 'Quantity', false);
		const sellUnitRate = decimal(input.sellUnitRate, 15, 4, 'Sell unit rate');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.estimate.manage', trx);
			const repository = new CommercialRepository(trx);
			await this.referenceExists(repository, salesItemTypeId, unitId);
			const estimate = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId,
				true
			);
			if (!estimate) throw new RecordNotFoundError('Estimate not found.');
			if (estimate.lifecycleStatus !== 'active')
				throw new CommercialValidationError('Only active estimates can be edited.');
			const version = await this.estimateVersionByNumber(
				repository,
				actor.organisationId,
				estimate.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Final or superseded estimate versions are immutable.');
			const items = await repository.listEstimateItems(actor.organisationId, version.id);
			const lineNumber = items.reduce((max, item) => Math.max(max, item.lineNumber), 0) + 10;
			await repository.insertEstimateItem({
				organisationId: actor.organisationId,
				versionId: version.id,
				salesItemTypeId,
				unitOfMeasureId: unitId,
				lineNumber,
				description,
				quantity,
				sellUnitRate,
				isOptional: Boolean(input.isOptional)
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.estimate.item_added',
				subjectType: 'estimate',
				subjectPublicId: estimatePublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, lineNumber, description, quantity, sellUnitRate }
			});
		});
	}

	async addEstimateCostComponent(
		actor: TenantActorContext,
		input: EstimateCostComponentInput
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.estimate.manage');
		const estimatePublicId = publicId(input.estimatePublicId, 'Estimate ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const lineNumber = positiveInteger(input.lineNumber, 'Line number');
		const salesItemTypeId = positiveInteger(input.salesItemTypeId, 'Sales item type');
		const unitId =
			input.unitOfMeasureId == null
				? null
				: positiveInteger(input.unitOfMeasureId, 'Unit of measure');
		const description = requiredText(input.description, 500, 'Cost component description');
		const quantity = decimal(input.quantity, 13, 6, 'Cost quantity');
		const unitCost = decimal(input.unitCost, 15, 4, 'Unit cost');
		const wastePercent = decimal(input.wastePercent?.trim() || '0', 3, 4, 'Waste percent');
		const markupPercent = decimal(input.markupPercent?.trim() || '0', 6, 4, 'Markup percent');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.estimate.manage', trx);
			const repository = new CommercialRepository(trx);
			await this.referenceExists(repository, salesItemTypeId, unitId);
			const estimate = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId,
				true
			);
			if (!estimate) throw new RecordNotFoundError('Estimate not found.');
			const version = await this.estimateVersionByNumber(
				repository,
				actor.organisationId,
				estimate.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Final or superseded estimate versions are immutable.');
			const items = await repository.listEstimateItems(actor.organisationId, version.id);
			const item = items.find((candidate) => candidate.lineNumber === lineNumber);
			if (!item) throw new RecordNotFoundError('Estimate line not found.');
			const sortOrder =
				item.components.reduce((max, component) => Math.max(max, component.sortOrder), 0) + 10;
			await repository.insertEstimateCostComponent({
				organisationId: actor.organisationId,
				versionId: version.id,
				itemId: item.id,
				salesItemTypeId,
				unitOfMeasureId: unitId,
				sortOrder,
				description,
				quantity,
				unitCost,
				wastePercent,
				markupPercent
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.estimate.cost_component_added',
				subjectType: 'estimate',
				subjectPublicId: estimatePublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					lineNumber,
					sortOrder,
					description,
					quantity,
					unitCost,
					wastePercent,
					markupPercent
				}
			});
		});
	}

	async removeEstimateItem(
		actor: TenantActorContext,
		estimatePublicIdInput: string,
		versionNumberInput: number,
		lineNumberInput: number
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.estimate.manage');
		const estimatePublicId = publicId(estimatePublicIdInput, 'Estimate ID');
		const versionNumber = positiveInteger(versionNumberInput, 'Version number');
		const lineNumber = positiveInteger(lineNumberInput, 'Line number');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.estimate.manage', trx);
			const repository = new CommercialRepository(trx);
			const estimate = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId,
				true
			);
			if (!estimate) throw new RecordNotFoundError('Estimate not found.');
			const version = await this.estimateVersionByNumber(
				repository,
				actor.organisationId,
				estimate.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Final or superseded estimate versions are immutable.');
			const item = (await repository.listEstimateItems(actor.organisationId, version.id)).find(
				(candidate) => candidate.lineNumber === lineNumber
			);
			if (!item) throw new RecordNotFoundError('Estimate line not found.');
			await repository.deleteEstimateItem(actor.organisationId, version.id, item.id);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.estimate.item_removed',
				subjectType: 'estimate',
				subjectPublicId: estimatePublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, lineNumber }
			});
		});
	}

	async finaliseEstimate(
		actor: TenantActorContext,
		estimatePublicIdInput: string,
		versionNumberInput: number
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.estimate.manage');
		const estimatePublicId = publicId(estimatePublicIdInput, 'Estimate ID');
		const versionNumber = positiveInteger(versionNumberInput, 'Version number');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.estimate.manage', trx);
			const repository = new CommercialRepository(trx);
			const estimate = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId,
				true
			);
			if (!estimate) throw new RecordNotFoundError('Estimate not found.');
			const version = await this.estimateVersionByNumber(
				repository,
				actor.organisationId,
				estimate.id,
				versionNumber
			);
			const locked = await repository.findEstimateVersion(
				actor.organisationId,
				estimate.id,
				version.id,
				true
			);
			if (!locked || locked.versionStatus !== 'draft')
				throw new CommercialValidationError('Only a draft estimate version can be finalised.');
			const items = await repository.listEstimateItems(actor.organisationId, locked.id);
			if (items.length === 0)
				throw new CommercialValidationError('Add at least one estimate line before finalising.');
			await repository.finaliseEstimateVersion(
				actor.organisationId,
				locked.id,
				membership.id,
				this.now()
			);
			await repository.supersedeOtherFinalEstimateVersions(
				actor.organisationId,
				estimate.id,
				locked.id
			);
			const totals = estimateTotals(items);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.estimate.finalised',
				subjectType: 'estimate',
				subjectPublicId: estimatePublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					currencyCode: locked.currencyCode,
					sellTotal: totals.sellTotal,
					costTotal: totals.costTotal
				}
			});
		});
	}

	async createQuotationFromEstimate(
		actor: TenantActorContext,
		input: CreateQuotationInput
	): Promise<QuotationRecord> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const estimatePublicId = publicId(input.estimatePublicId, 'Estimate ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const customerReference = optionalText(input.customerReference, 160, 'Customer reference');
		const validUntil = dateValue(input.validUntil, 'Valid until');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			const estimate = await repository.findEstimateByPublicId(
				actor.organisationId,
				estimatePublicId,
				true
			);
			if (!estimate) throw new RecordNotFoundError('Estimate not found.');
			const estimateVersion = await this.estimateVersionByNumber(
				repository,
				actor.organisationId,
				estimate.id,
				versionNumber
			);
			if (estimateVersion.versionStatus !== 'final')
				throw new CommercialValidationError(
					'Only a final estimate version can create a quotation.'
				);
			if (!estimate.opportunityPublicId)
				throw new CommercialValidationError('The estimate has no CRM opportunity context.');
			const opportunity = await repository.findOpportunityCandidateByPublicId(
				actor.organisationId,
				estimate.opportunityPublicId
			);
			if (!opportunity) throw new RecordNotFoundError('Estimate opportunity not found.');
			const quotationPublicId = this.publicIdFactory();
			const now = this.now();
			const quotationId = await repository.insertQuotation({
				organisationId: actor.organisationId,
				publicId: quotationPublicId,
				quotationNumber: documentNumber('QUO', quotationPublicId, now),
				opportunityId: opportunity.id,
				customerPartyId: opportunity.customerPartyId,
				primaryContactPartyId: opportunity.primaryContactPartyId,
				ownerMemberId: membership.id
			});
			const quotationVersionId = await repository.insertQuotationVersion({
				organisationId: actor.organisationId,
				quotationId,
				versionNumber: 1,
				title: optionalText(input.title, 255, 'Quotation title') ?? estimate.title,
				currencyCode: estimateVersion.currencyCode,
				customerReference,
				validUntil,
				createdByMemberId: membership.id
			});
			await repository.linkQuotationEstimateVersion(
				actor.organisationId,
				quotationVersionId,
				estimateVersion.id,
				10
			);
			const estimateItems = await repository.listEstimateItems(
				actor.organisationId,
				estimateVersion.id
			);
			for (const item of estimateItems) {
				await repository.insertQuotationItem({
					organisationId: actor.organisationId,
					versionId: quotationVersionId,
					sourceEstimateItemId: item.id,
					salesItemTypeId: item.salesItemTypeId,
					unitOfMeasureId: item.unitOfMeasureId,
					lineNumber: item.lineNumber,
					description: item.description,
					quantity: item.quantity,
					unitRate: item.sellUnitRate,
					isOptional: item.isOptional
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.created_from_estimate',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					estimatePublicId,
					estimateVersionNumber: versionNumber,
					opportunityPublicId: opportunity.publicId,
					customerPartyPublicId: opportunity.customerPublicId
				}
			});
			const created = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId
			);
			if (!created) throw new Error('Created quotation could not be reloaded.');
			return created;
		});
	}

	async listQuotations(actor: TenantActorContext): Promise<QuotationPortfolioWorkspace> {
		await this.assertActiveActor(actor);
		const flags = await this.permissionFlags(actor);
		if (!flags.canView) return { canView: false, quotations: [] };
		const repository = new CommercialRepository(this.db);
		const records = await repository.listQuotationRecords(actor.organisationId);
		const quotations: QuotationSummary[] = [];
		for (const record of records) {
			const versions = await repository.listQuotationVersions(actor.organisationId, record.id);
			const latest = versions[0] ?? null;
			const items = latest
				? await repository.listQuotationItems(actor.organisationId, latest.id)
				: [];
			const responses = await repository.listQuotationResponses(actor.organisationId, record.id);
			const totals = quotationTotals(items);
			quotations.push({
				...record,
				latestVersionNumber: latest?.versionNumber ?? null,
				latestVersionStatus: latest?.versionStatus ?? null,
				currencyCode: latest?.currencyCode ?? null,
				effectiveStatus: latest ? effectiveQuotationStatus(latest, responses, this.now()) : 'draft',
				...totals
			});
		}
		return { canView: true, quotations };
	}

	async getQuotation(
		actor: TenantActorContext,
		quotationPublicIdInput: string,
		requestedVersionNumber?: number
	): Promise<QuotationWorkspace> {
		await this.assertView(actor);
		const quotationPublicId = publicId(quotationPublicIdInput, 'Quotation ID');
		const repository = new CommercialRepository(this.db);
		const quotation = await repository.findQuotationByPublicId(
			actor.organisationId,
			quotationPublicId
		);
		if (!quotation) throw new RecordNotFoundError('Quotation not found.');
		const versions = await repository.listQuotationVersions(actor.organisationId, quotation.id);
		if (versions.length === 0) throw new Error('Quotation has no versions.');
		const version = requestedVersionNumber
			? versions.find((candidate) => candidate.versionNumber === requestedVersionNumber)
			: versions[0];
		if (!version) throw new RecordNotFoundError('Quotation version not found.');
		const [items, textBlocks, issues, responses, taxCategories, flags, salesItemTypes, units] =
			await Promise.all([
				repository.listQuotationItems(actor.organisationId, version.id),
				repository.listQuotationTextBlocks(actor.organisationId, version.id),
				repository.listQuotationIssues(actor.organisationId, version.id),
				repository.listQuotationResponses(actor.organisationId, quotation.id),
				repository.listTaxCategories(actor.organisationId, this.now()),
				this.permissionFlags(actor),
				repository.listSalesItemTypes(),
				repository.listUnitsOfMeasure()
			]);
		const totals = quotationTotals(items);
		return {
			quotation,
			versions,
			version,
			items,
			textBlocks,
			issues,
			responses,
			taxCategories,
			...totals,
			effectiveStatus: effectiveQuotationStatus(version, responses, this.now()),
			canManageQuotations: flags.canManageQuotations,
			canIssueQuotations: flags.canIssueQuotations,
			canRecordResponses: flags.canRecordResponses,
			salesItemTypes,
			units
		};
	}

	async updateQuotationDraft(
		actor: TenantActorContext,
		input: UpdateQuotationDraftInput
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const quotationPublicId = publicId(input.quotationPublicId, 'Quotation ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const title = requiredText(input.title, 255, 'Quotation title');
		const customerReference = optionalText(input.customerReference, 160, 'Customer reference');
		const validUntil = dateValue(input.validUntil, 'Valid until');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			const locked = await repository.findQuotationVersion(
				actor.organisationId,
				quotation.id,
				version.id,
				true
			);
			if (!locked || locked.versionStatus !== 'draft')
				throw new CommercialValidationError('Issued quotation versions are immutable.');
			await repository.updateQuotationVersionDraft(actor.organisationId, locked.id, {
				title,
				customerReference,
				validUntil
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.draft_updated',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					title,
					customerReference,
					validUntil: validUntil?.toISOString().slice(0, 10) ?? null
				}
			});
		});
	}

	async addQuotationLine(actor: TenantActorContext, input: QuotationLineInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const quotationPublicId = publicId(input.quotationPublicId, 'Quotation ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const salesItemTypeId = positiveInteger(input.salesItemTypeId, 'Sales item type');
		const unitId =
			input.unitOfMeasureId == null
				? null
				: positiveInteger(input.unitOfMeasureId, 'Unit of measure');
		const description = requiredText(input.description, 10_000, 'Line description');
		const quantity = decimal(input.quantity, 13, 6, 'Quantity', false);
		const unitRate = decimal(input.unitRate, 15, 4, 'Unit rate');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			await this.referenceExists(repository, salesItemTypeId, unitId);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Issued quotation versions are immutable.');
			const items = await repository.listQuotationItems(actor.organisationId, version.id);
			const lineNumber = items.reduce((max, item) => Math.max(max, item.lineNumber), 0) + 10;
			await repository.insertQuotationItem({
				organisationId: actor.organisationId,
				versionId: version.id,
				salesItemTypeId,
				unitOfMeasureId: unitId,
				lineNumber,
				description,
				quantity,
				unitRate,
				isOptional: Boolean(input.isOptional)
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.item_added',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, lineNumber, description, quantity, unitRate }
			});
		});
	}

	async removeQuotationLine(
		actor: TenantActorContext,
		quotationPublicIdInput: string,
		versionNumberInput: number,
		lineNumberInput: number
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const quotationPublicId = publicId(quotationPublicIdInput, 'Quotation ID');
		const versionNumber = positiveInteger(versionNumberInput, 'Version number');
		const lineNumber = positiveInteger(lineNumberInput, 'Line number');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Issued quotation versions are immutable.');
			const item = (await repository.listQuotationItems(actor.organisationId, version.id)).find(
				(candidate) => candidate.lineNumber === lineNumber
			);
			if (!item) throw new RecordNotFoundError('Quotation line not found.');
			await repository.deleteQuotationItem(actor.organisationId, version.id, item.id);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.item_removed',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, lineNumber }
			});
		});
	}

	async setQuotationLineTax(
		actor: TenantActorContext,
		quotationPublicIdInput: string,
		versionNumberInput: number,
		lineNumberInput: number,
		taxCategoryPublicIdInput: string | null
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const quotationPublicId = publicId(quotationPublicIdInput, 'Quotation ID');
		const versionNumber = positiveInteger(versionNumberInput, 'Version number');
		const lineNumber = positiveInteger(lineNumberInput, 'Line number');
		const taxPublicId = taxCategoryPublicIdInput?.trim() || null;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Issued quotation versions are immutable.');
			const item = (await repository.listQuotationItems(actor.organisationId, version.id)).find(
				(candidate) => candidate.lineNumber === lineNumber
			);
			if (!item) throw new RecordNotFoundError('Quotation line not found.');
			if (!taxPublicId) {
				await repository.replaceQuotationItemTax({
					organisationId: actor.organisationId,
					itemId: item.id,
					taxCategoryId: null
				});
			} else {
				const category = await repository.resolveTaxCategory(
					actor.organisationId,
					taxPublicId,
					this.now()
				);
				if (!category) throw new RecordNotFoundError('Tax category not found.');
				const rate = category.ratePercent ?? (category.treatment === 'taxable' ? null : '0.0000');
				if (rate === null)
					throw new CommercialValidationError(
						'The selected taxable category has no effective tax rate.'
					);
				const taxableAmount = lineAmount(item.quantity, item.unitRate);
				const taxAmount = percentageAmount(taxableAmount, rate);
				await repository.replaceQuotationItemTax({
					organisationId: actor.organisationId,
					itemId: item.id,
					taxCategoryId: category.id,
					ratePercent: rate,
					taxableAmount,
					taxAmount
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.tax_updated',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, lineNumber, taxCategoryPublicId: taxPublicId }
			});
		});
	}

	async addQuotationTextBlock(
		actor: TenantActorContext,
		input: QuotationTextBlockInput
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.manage');
		const quotationPublicId = publicId(input.quotationPublicId, 'Quotation ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const type = blockType(input.blockType);
		const heading = optionalText(input.heading, 255, 'Heading');
		const body = requiredText(input.body, 20_000, 'Narrative body');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.manage', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			if (version.versionStatus !== 'draft')
				throw new CommercialValidationError('Issued quotation versions are immutable.');
			const blocks = await repository.listQuotationTextBlocks(actor.organisationId, version.id);
			const sortOrder =
				blocks
					.filter((block) => block.blockType === type)
					.reduce((max, block) => Math.max(max, block.sortOrder), 0) + 10;
			await repository.insertQuotationTextBlock({
				organisationId: actor.organisationId,
				versionId: version.id,
				blockType: type,
				sortOrder,
				heading,
				body
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.text_added',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, blockType: type, sortOrder, heading }
			});
		});
	}

	async issueQuotation(actor: TenantActorContext, input: IssueQuotationInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.issue');
		const quotationPublicId = publicId(input.quotationPublicId, 'Quotation ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const channel = deliveryChannel(input.deliveryChannel);
		const recipientNameInput = optionalText(input.recipientName, 255, 'Recipient name');
		const recipientEmailInput = optionalText(input.recipientEmail, 320, 'Recipient email');
		if (recipientEmailInput && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmailInput))
			throw new CommercialValidationError('Recipient email is invalid.');
		const note = optionalText(input.note, 1000, 'Issue note');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.issue', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			const locked = await repository.findQuotationVersion(
				actor.organisationId,
				quotation.id,
				version.id,
				true
			);
			if (!locked || locked.versionStatus !== 'draft')
				throw new CommercialValidationError('Only a draft quotation version can be issued.');
			const items = await repository.listQuotationItems(actor.organisationId, locked.id);
			if (items.length === 0)
				throw new CommercialValidationError('Add at least one quotation line before issue.');
			const customer = await repository.findPartySnapshotSource(
				actor.organisationId,
				quotation.customerPartyId
			);
			if (!customer) throw new RecordNotFoundError('Quotation customer not found.');
			const customerSnapshotId = await repository.insertQuotationPartySnapshot({
				organisationId: actor.organisationId,
				versionId: locked.id,
				sourcePartyId: customer.partyId,
				snapshotRole: 'customer',
				displayName: customer.displayName,
				email: customer.email,
				phone: customer.phone
			});
			const customerAddress = await repository.findPrimaryPartyAddress(
				actor.organisationId,
				customer.partyId
			);
			if (customerAddress)
				await repository.insertQuotationSnapshotAddress({
					organisationId: actor.organisationId,
					versionId: locked.id,
					snapshotId: customerSnapshotId,
					...customerAddress
				});
			let recipientSource = customer;
			if (quotation.primaryContactPartyId) {
				const contact = await repository.findPartySnapshotSource(
					actor.organisationId,
					quotation.primaryContactPartyId
				);
				if (contact) {
					recipientSource = contact;
					const contactSnapshotId = await repository.insertQuotationPartySnapshot({
						organisationId: actor.organisationId,
						versionId: locked.id,
						sourcePartyId: contact.partyId,
						snapshotRole: 'contact',
						displayName: contact.displayName,
						email: contact.email,
						phone: contact.phone
					});
					const contactAddress = await repository.findPrimaryPartyAddress(
						actor.organisationId,
						contact.partyId
					);
					if (contactAddress)
						await repository.insertQuotationSnapshotAddress({
							organisationId: actor.organisationId,
							versionId: locked.id,
							snapshotId: contactSnapshotId,
							...contactAddress
						});
				}
			}
			const recipientName = recipientNameInput ?? recipientSource.displayName;
			const recipientEmail = recipientEmailInput ?? recipientSource.email;
			if (!recipientName && !recipientEmail)
				throw new CommercialValidationError('Quotation issue requires a recipient identity.');
			const now = this.now();
			await repository.lockQuotationVersion(actor.organisationId, locked.id, membership.id, now);
			const issueId = await repository.insertQuotationIssue({
				organisationId: actor.organisationId,
				versionId: locked.id,
				issueSequence: 1,
				memberId: membership.id,
				deliveryChannel: channel,
				issuedAt: now,
				note
			});
			await repository.insertQuotationIssueRecipient({
				organisationId: actor.organisationId,
				issueId,
				versionId: locked.id,
				sourcePartyId: recipientSource.partyId,
				recipientName,
				recipientEmail,
				deliveryStatus: channel === 'manual' ? 'delivered' : 'sent',
				deliveredAt: channel === 'manual' ? now : null
			});
			const totals = quotationTotals(items);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'commercial.quotation.issued',
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber,
					deliveryChannel: channel,
					recipientName,
					recipientEmail,
					...totals
				}
			});
		});
	}

	async recordQuotationResponse(
		actor: TenantActorContext,
		input: RecordQuotationResponseInput
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'commercial.quotation.response.record');
		const quotationPublicId = publicId(input.quotationPublicId, 'Quotation ID');
		const versionNumber = positiveInteger(input.versionNumber, 'Version number');
		const type = responseType(input.responseType);
		const respondedAt = input.respondedAt?.trim() ? new Date(input.respondedAt) : this.now();
		if (Number.isNaN(respondedAt.getTime()))
			throw new CommercialValidationError('Response time is invalid.');
		const respondentName = optionalText(input.respondentName, 255, 'Respondent name');
		const respondentEmail = optionalText(input.respondentEmail, 320, 'Respondent email');
		if (respondentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(respondentEmail))
			throw new CommercialValidationError('Respondent email is invalid.');
		const notes = optionalText(input.notes, 10_000, 'Response notes');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'commercial.quotation.response.record', trx);
			const repository = new CommercialRepository(trx);
			const quotation = await repository.findQuotationByPublicId(
				actor.organisationId,
				quotationPublicId,
				true
			);
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			const version = await this.quotationVersionByNumber(
				repository,
				actor.organisationId,
				quotation.id,
				versionNumber
			);
			const locked = await repository.findQuotationVersion(
				actor.organisationId,
				quotation.id,
				version.id,
				true
			);
			if (!locked || locked.versionStatus !== 'issued' || !locked.lockedAt)
				throw new CommercialValidationError(
					'Responses can be recorded only against an issued quotation version.'
				);
			const responses = await repository.listQuotationResponses(actor.organisationId, quotation.id);
			if (type === 'accepted' && responses.some((response) => response.responseType === 'accepted'))
				throw new CommercialValidationError('This quotation already has an accepted response.');
			const issues = await repository.listQuotationIssues(actor.organisationId, locked.id);
			const respondingPartyId = quotation.primaryContactPartyId ?? quotation.customerPartyId;
			const source = await repository.findPartySnapshotSource(
				actor.organisationId,
				respondingPartyId
			);
			const responsePublicId = this.publicIdFactory();
			await repository.insertQuotationResponse({
				organisationId: actor.organisationId,
				publicId: responsePublicId,
				quotationId: quotation.id,
				versionId: locked.id,
				issueId: issues[0]?.id ?? null,
				responseType: type,
				respondedAt,
				respondingPartyId,
				respondentName: respondentName ?? source?.displayName ?? null,
				respondentEmail: respondentEmail ?? source?.email ?? null,
				recordedByMemberId: membership.id,
				notes
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: `commercial.quotation.response.${type}`,
				subjectType: 'quotation',
				subjectPublicId: quotationPublicId,
				correlationId: actor.correlationId,
				changeSummary: { versionNumber, responsePublicId, respondedAt: respondedAt.toISOString() }
			});
		});
	}
}
