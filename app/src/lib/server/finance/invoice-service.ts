import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	lineAmount,
	percentageAmount,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { CommercialRepository, type CommercialTaxCategory } from '$lib/server/commercial/commercial-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FINANCE_DELIVERY_CHANNELS,
	FinanceAccessPolicy,
	FinanceValidationError,
	INVOICE_TYPES,
	addUtcDays,
	cleanFinanceText,
	endOfUtcMonth,
	insertedId,
	validateFinanceDate,
	validateQuantity,
	validateUnitRate
} from './finance-common';

export type EligibleInvoiceContract = {
	contractId: string;
	contractPublicId: string;
	contractNumber: string;
	title: string;
	currencyCode: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	customerPartyId: string;
	customerDisplayName: string;
	currentContractValue: string;
};

export type InvoiceSummary = {
	id: string;
	publicId: string;
	documentNumber: string | null;
	lifecycleStatus: string;
	invoiceType: string;
	currencyCode: string;
	dueDate: Date | null;
	customerDisplayName: string;
	contractPublicId: string | null;
	contractNumber: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
	netTotal: string;
	taxTotal: string;
	grossTotal: string;
	createdAt: Date;
};

export type InvoiceLine = {
	id: string;
	lineNumber: number;
	salesItemTypeCode: string;
	salesItemTypeName: string;
	unitCode: string | null;
	unitSymbol: string | null;
	description: string;
	quantity: string;
	unitRate: string;
	netAmount: string;
	taxes: Array<{
		taxCategoryPublicId: string;
		taxCategoryCode: string;
		taxCategoryName: string;
		appliedRatePercent: string;
		taxableAmount: string;
		taxAmount: string;
	}>;
	taxAmount: string;
	grossAmount: string;
};

export type InvoicePortfolio = {
	invoices: InvoiceSummary[];
	eligibleContracts: EligibleInvoiceContract[];
	canCreate: boolean;
};

export type InvoiceWorkspace = {
	invoice: InvoiceSummary & {
		customerPartyId: string;
		customerPartyPublicId: string;
		billingContactPartyId: string | null;
		paymentTermPublicId: string | null;
		paymentTermName: string | null;
		paymentTermBasis: string | null;
		paymentTermDaysOffset: number | null;
		customerPurchaseOrderReference: string | null;
		purchaseOrderRequired: boolean;
		customerAccountReference: string | null;
	};
	lines: InvoiceLine[];
	paymentTerms: Array<{
		publicId: string;
		name: string;
		calculationBasis: string;
		daysOffset: number;
		isDefault: boolean;
	}>;
	salesItemTypes: Array<{ id: number; code: string; name: string }>;
	units: Array<{ id: number; code: string; name: string; symbol: string | null }>;
	taxCategories: CommercialTaxCategory[];
	partySnapshots: Array<{
		id: string;
		snapshotRole: string;
		displayName: string;
		email: string | null;
		phone: string | null;
		referenceIdentifier: string | null;
	}>;
	issueEvents: Array<{
		id: string;
		issueSequence: number;
		deliveryChannel: string;
		issuedAt: Date;
		note: string | null;
		recipientName: string | null;
		recipientEmail: string | null;
		deliveryStatus: string | null;
	}>;
	contractCurrentValue: string | null;
	issuedContractNetBeforeThisInvoice: string | null;
	canManageDraft: boolean;
	canIssue: boolean;
};

type PartyFacts = {
	id: string;
	publicId: string;
	partyKind: string;
	displayName: string;
	primaryEmail: string | null;
	primaryPhone: string | null;
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
};

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

function invoiceType(value: string): string {
	const text = value.trim();
	if (!INVOICE_TYPES.has(text)) throw new FinanceValidationError('Invoice type is invalid.');
	return text;
}

function taxRate(category: CommercialTaxCategory): string {
	if (category.ratePercent !== null) return category.ratePercent;
	if (category.treatment === 'taxable') {
		throw new FinanceValidationError(`Tax category ${category.name} has no effective tax rate.`);
	}
	return '0.0000';
}

function invoiceNumberFrom(existingNumbers: Array<string | null>): string {
	let maximum = 0;
	for (const value of existingNumbers) {
		const match = /^INV-(\d+)$/.exec(value ?? '');
		if (!match) continue;
		const parsed = Number(match[1]);
		if (Number.isSafeInteger(parsed) && parsed > maximum) maximum = parsed;
	}
	return `INV-${String(maximum + 1).padStart(6, '0')}`;
}

export class InvoiceService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async contractViewAllowed(actor: TenantActorContext, db: DatabaseExecutor = this.db): Promise<boolean> {
		return (await new PermissionService(db).decide(actor, 'contract.view')).allowed;
	}

	private async partyFacts(db: DatabaseExecutor, organisationId: string, partyId: string): Promise<PartyFacts | null> {
		const row = await db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join.onRef('person.party_id', '=', 'party.id').onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join.onRef('company.party_id', '=', 'party.id').onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join.onRef('email.party_id', '=', 'party.id').onRef('email.organisation_id', '=', 'party.organisation_id').on('email.is_primary', '=', 1)
			)
			.leftJoin('party_phone_numbers as phone', (join) =>
				join.onRef('phone.party_id', '=', 'party.id').onRef('phone.organisation_id', '=', 'party.organisation_id').on('phone.is_primary', '=', 1)
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'email.email as primaryEmail',
				'phone.phone_e164 as primaryPhone'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.id', '=', partyId)
			.executeTakeFirst();
		if (!row) return null;
		const addresses = await db
			.selectFrom('party_addresses as link')
			.innerJoin('addresses as address', (join) =>
				join.onRef('address.id', '=', 'link.address_id').onRef('address.organisation_id', '=', 'link.organisation_id')
			)
			.select([
				'link.address_role as addressRole',
				'link.is_primary as isPrimary',
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
			.orderBy('link.is_primary', 'desc')
			.orderBy('link.id', 'asc')
			.execute();
		const selectedAddress =
			addresses.find((address) => address.addressRole === 'billing') ??
			addresses.find((address) => address.isPrimary === 1) ??
			addresses[0] ?? null;
		return {
			id: row.id,
			publicId: row.publicId,
			partyKind: row.partyKind,
			displayName: partyDisplayName(row),
			primaryEmail: row.primaryEmail ?? null,
			primaryPhone: row.primaryPhone ?? null,
			address: selectedAddress
				? {
					line1: selectedAddress.line1,
					line2: selectedAddress.line2,
					line3: selectedAddress.line3,
					locality: selectedAddress.locality,
					city: selectedAddress.city,
					region: selectedAddress.region,
					postalCode: selectedAddress.postalCode,
					countryCode: selectedAddress.countryCode
				}
				: null
		};
	}

	private async primaryBillingContactId(db: DatabaseExecutor, organisationId: string, customerPartyId: string): Promise<string | null> {
		const contact = await db
			.selectFrom('party_organisation_contacts')
			.select('person_party_id as personPartyId')
			.where('organisation_id', '=', organisationId)
			.where('organisation_party_id', '=', customerPartyId)
			.where('is_primary_contact', '=', 1)
			.where('ended_on', 'is', null)
			.orderBy('id', 'asc')
			.executeTakeFirst();
		return contact?.personPartyId ?? null;
	}

	private async currentContractValue(db: DatabaseExecutor, organisationId: string, contractId: string): Promise<string> {
		const baseline = await db.selectFrom('contract_versions').select('id')
			.where('organisation_id', '=', organisationId).where('contract_id', '=', contractId)
			.where('version_status', '=', 'executed').orderBy('version_number', 'desc').executeTakeFirst();
		if (!baseline) throw new FinanceValidationError('An executed contract baseline is required for invoicing.');
		const values = await db.selectFrom('contract_version_value_components').select('amount')
			.where('organisation_id', '=', organisationId).where('contract_version_id', '=', baseline.id).execute();
		const adjustments = await db
			.selectFrom('contract_amendments as amendment')
			.innerJoin('contract_amendment_value_adjustments as adjustment', (join) =>
				join.onRef('adjustment.contract_amendment_id', '=', 'amendment.id').onRef('adjustment.organisation_id', '=', 'amendment.organisation_id')
			)
			.select('adjustment.adjustment_amount as amount')
			.where('amendment.organisation_id', '=', organisationId)
			.where('amendment.contract_id', '=', contractId)
			.where('amendment.lifecycle_status', '=', 'agreed')
			.execute();
		return sumMoney([...values.map((row) => row.amount), ...adjustments.map((row) => row.amount)]);
	}

	private async contractCandidates(actor: TenantActorContext): Promise<EligibleInvoiceContract[]> {
		if (!(await this.contractViewAllowed(actor))) return [];
		const rows = await this.db
			.selectFrom('contracts as contract')
			.innerJoin('contract_versions as version', (join) =>
				join.onRef('version.contract_id', '=', 'contract.id').onRef('version.organisation_id', '=', 'contract.organisation_id').on('version.version_status', '=', 'executed')
			)
			.innerJoin('contract_version_parties as client', (join) =>
				join.onRef('client.contract_version_id', '=', 'version.id').onRef('client.organisation_id', '=', 'contract.organisation_id')
			)
			.innerJoin('contract_party_role_types as role', (join) =>
				join.onRef('role.id', '=', 'client.contract_party_role_type_id').on('role.code', '=', 'client')
			)
			.leftJoin('projects as project', (join) =>
				join.onRef('project.id', '=', 'contract.project_id').onRef('project.owning_organisation_id', '=', 'contract.organisation_id')
			)
			.select([
				'contract.id as contractId',
				'contract.public_id as contractPublicId',
				'contract.contract_number as contractNumber',
				'contract.title as title',
				'contract.currency_code as currencyCode',
				'contract.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'client.source_party_id as customerPartyId',
				'client.display_name as customerDisplayName',
				'version.version_number as versionNumber'
			])
			.where('contract.organisation_id', '=', actor.organisationId)
			.where('contract.lifecycle_status', '=', 'active')
			.orderBy('contract.id', 'desc')
			.orderBy('version.version_number', 'desc')
			.execute();
		const unique = new Map<string, typeof rows[number]>();
		for (const row of rows) if (!unique.has(row.contractId)) unique.set(row.contractId, row);
		const result: EligibleInvoiceContract[] = [];
		for (const row of unique.values()) {
			result.push({
				contractId: row.contractId,
				contractPublicId: row.contractPublicId,
				contractNumber: row.contractNumber,
				title: row.title,
				currencyCode: row.currencyCode,
				projectId: row.projectId,
				projectPublicId: row.projectPublicId ?? null,
				projectNumber: row.projectNumber ?? null,
				customerPartyId: row.customerPartyId,
				customerDisplayName: row.customerDisplayName,
				currentContractValue: await this.currentContractValue(this.db, actor.organisationId, row.contractId)
			});
		}
		return result;
	}

	private async lines(db: DatabaseExecutor, organisationId: string, documentId: string): Promise<InvoiceLine[]> {
		const items = await db
			.selectFrom('financial_document_items as item')
			.innerJoin('sales_item_types as type', 'type.id', 'item.sales_item_type_id')
			.leftJoin('units_of_measure as unit', 'unit.id', 'item.unit_of_measure_id')
			.select([
				'item.id as id', 'item.line_number as lineNumber', 'type.code as salesItemTypeCode', 'type.name as salesItemTypeName',
				'unit.code as unitCode', 'unit.symbol as unitSymbol', 'item.description as description', 'item.quantity as quantity', 'item.unit_rate as unitRate'
			])
			.where('item.organisation_id', '=', organisationId)
			.where('item.financial_document_id', '=', documentId)
			.orderBy('item.line_number', 'asc')
			.execute();
		const result: InvoiceLine[] = [];
		for (const item of items) {
			const taxes = await db
				.selectFrom('financial_document_item_taxes as tax')
				.innerJoin('tax_categories as category', (join) =>
					join.onRef('category.id', '=', 'tax.tax_category_id').onRef('category.organisation_id', '=', 'tax.organisation_id')
				)
				.select([
					'category.public_id as taxCategoryPublicId', 'category.code as taxCategoryCode', 'category.name as taxCategoryName',
					'tax.applied_rate_percent as appliedRatePercent', 'tax.taxable_amount as taxableAmount', 'tax.tax_amount as taxAmount'
				])
				.where('tax.organisation_id', '=', organisationId)
				.where('tax.financial_document_item_id', '=', item.id)
				.orderBy('tax.sort_order', 'asc')
				.execute();
			const netAmount = lineAmount(item.quantity, item.unitRate);
			const taxAmount = sumMoney(taxes.map((tax) => tax.taxAmount));
			result.push({
				...item,
				unitCode: item.unitCode ?? null,
				unitSymbol: item.unitSymbol ?? null,
				netAmount,
				taxes,
				taxAmount,
				grossAmount: sumMoney([netAmount, taxAmount])
			});
		}
		return result;
	}

	private async invoiceRecord(db: DatabaseExecutor, organisationId: string, publicId: string, lock = false) {
		let query = db
			.selectFrom('financial_documents as document')
			.innerJoin('invoices as invoice', (join) =>
				join.onRef('invoice.financial_document_id', '=', 'document.id').onRef('invoice.organisation_id', '=', 'document.organisation_id')
			)
			.innerJoin('parties as customer', (join) =>
				join.onRef('customer.id', '=', 'document.customer_party_id').onRef('customer.organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join.onRef('person.party_id', '=', 'customer.id').onRef('person.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join.onRef('company.party_id', '=', 'customer.id').onRef('company.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('contracts as contract', (join) =>
				join.onRef('contract.id', '=', 'document.contract_id').onRef('contract.organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('projects as project', (join) =>
				join.onRef('project.id', '=', 'document.project_id').onRef('project.owning_organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('payment_terms as term', (join) =>
				join.onRef('term.id', '=', 'invoice.payment_term_id').onRef('term.organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('party_billing_settings as settings', (join) =>
				join.onRef('settings.party_id', '=', 'document.customer_party_id').onRef('settings.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id', 'document.public_id as publicId', 'document.document_number as documentNumber',
				'document.lifecycle_status as lifecycleStatus', 'document.currency_code as currencyCode', 'document.created_at as createdAt',
				'document.customer_party_id as customerPartyId', 'customer.public_id as customerPartyPublicId', 'customer.party_kind as partyKind',
				'person.preferred_name as preferredName', 'person.given_names as givenNames', 'person.family_name as familyName',
				'company.legal_name as legalName', 'company.trading_name as tradingName',
				'document.billing_contact_party_id as billingContactPartyId', 'document.contract_id as contractId', 'contract.public_id as contractPublicId',
				'contract.contract_number as contractNumber', 'document.project_id as projectId', 'project.public_id as projectPublicId',
				'project.project_number as projectNumber', 'invoice.invoice_type as invoiceType', 'invoice.due_date as dueDate',
				'invoice.customer_purchase_order_reference as customerPurchaseOrderReference', 'term.public_id as paymentTermPublicId',
				'term.name as paymentTermName', 'term.calculation_basis as paymentTermBasis', 'term.days_offset as paymentTermDaysOffset',
				'settings.purchase_order_required as purchaseOrderRequired', 'settings.customer_account_reference as customerAccountReference'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.public_id', '=', publicId)
			.where('document.document_kind', '=', 'invoice');
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		return row ? { ...row, customerDisplayName: partyDisplayName(row) } : null;
	}

	private async summary(db: DatabaseExecutor, organisationId: string, publicId: string): Promise<InvoiceSummary | null> {
		const record = await this.invoiceRecord(db, organisationId, publicId);
		if (!record) return null;
		const lines = await this.lines(db, organisationId, record.id);
		return {
			id: record.id,
			publicId: record.publicId,
			documentNumber: record.documentNumber,
			lifecycleStatus: record.lifecycleStatus,
			invoiceType: record.invoiceType,
			currencyCode: record.currencyCode,
			dueDate: record.dueDate,
			customerDisplayName: record.customerDisplayName,
			contractPublicId: record.contractPublicId ?? null,
			contractNumber: record.contractNumber ?? null,
			projectPublicId: record.projectPublicId ?? null,
			projectNumber: record.projectNumber ?? null,
			netTotal: sumMoney(lines.map((line) => line.netAmount)),
			taxTotal: sumMoney(lines.map((line) => line.taxAmount)),
			grossTotal: sumMoney(lines.map((line) => line.grossAmount)),
			createdAt: record.createdAt
		};
	}

	async getPortfolio(actor: TenantActorContext): Promise<InvoicePortfolio> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const createDecision = await policy.mutationDecision(actor, 'finance.invoice.create');
		const documents = await this.db.selectFrom('financial_documents').select('public_id as publicId')
			.where('organisation_id', '=', actor.organisationId).where('document_kind', '=', 'invoice').orderBy('id', 'desc').execute();
		const invoices: InvoiceSummary[] = [];
		for (const document of documents) {
			const item = await this.summary(this.db, actor.organisationId, document.publicId);
			if (item) invoices.push(item);
		}
		return {
			invoices,
			eligibleContracts: createDecision.allowed ? await this.contractCandidates(actor) : [],
			canCreate: createDecision.allowed && await this.contractViewAllowed(actor)
		};
	}

	async createFromContract(actor: TenantActorContext, input: {
		contractPublicId: string;
		invoiceType: string;
		paymentTermPublicId?: string | null;
		dueDate?: string | null;
		customerPurchaseOrderReference?: string | null;
	}): Promise<InvoiceSummary> {
		const contractPublicId = cleanFinanceText(input.contractPublicId, 64, 'Contract ID', true)!;
		const selectedInvoiceType = invoiceType(input.invoiceType);
		const dueDate = validateFinanceDate(input.dueDate, 'Due date');
		const purchaseOrderReference = cleanFinanceText(input.customerPurchaseOrderReference, 160, 'Customer purchase order reference');
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const createDecision = await policy.mutationDecision(actor, 'finance.invoice.create', trx);
			if (!createDecision.allowed) throw new TenantAccessError('Invoice creation is not permitted.');
			if (!(await this.contractViewAllowed(actor, trx))) throw new TenantAccessError('Contract viewing is required to create a contract invoice.');
			const contract = await trx.selectFrom('contracts').select(['id', 'public_id as publicId', 'contract_number as contractNumber', 'currency_code as currencyCode', 'project_id as projectId', 'lifecycle_status as lifecycleStatus'])
				.where('organisation_id', '=', actor.organisationId).where('public_id', '=', contractPublicId).forUpdate().executeTakeFirst();
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			if (contract.lifecycleStatus !== 'active') throw new FinanceValidationError('Only an active executed contract can be invoiced.');
			const version = await trx.selectFrom('contract_versions').select(['id', 'version_number as versionNumber'])
				.where('organisation_id', '=', actor.organisationId).where('contract_id', '=', contract.id).where('version_status', '=', 'executed')
				.orderBy('version_number', 'desc').executeTakeFirst();
			if (!version) throw new FinanceValidationError('An executed contract baseline is required before invoicing.');
			const client = await trx.selectFrom('contract_version_parties as client')
				.innerJoin('contract_party_role_types as role', 'role.id', 'client.contract_party_role_type_id')
				.select('client.source_party_id as customerPartyId')
				.where('client.organisation_id', '=', actor.organisationId).where('client.contract_version_id', '=', version.id).where('role.code', '=', 'client')
				.orderBy('client.sort_order', 'asc').executeTakeFirst();
			if (!client) throw new FinanceValidationError('The executed contract has no client party available for invoicing.');
			const billingSettings = await trx.selectFrom('party_billing_settings').select(['default_payment_term_id as defaultPaymentTermId'])
				.where('organisation_id', '=', actor.organisationId).where('party_id', '=', client.customerPartyId).executeTakeFirst();
			let paymentTermId: string | null = billingSettings?.defaultPaymentTermId ?? null;
			const requestedTerm = input.paymentTermPublicId?.trim() ?? '';
			if (requestedTerm) {
				const term = await trx.selectFrom('payment_terms').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', requestedTerm).where('is_active', '=', 1).executeTakeFirst();
				if (!term) throw new FinanceValidationError('Selected payment term is unavailable.');
				paymentTermId = term.id;
			} else if (!paymentTermId) {
				const defaultTerm = await trx.selectFrom('payment_terms').select('id').where('organisation_id', '=', actor.organisationId).where('is_default', '=', 1).where('is_active', '=', 1).executeTakeFirst();
				paymentTermId = defaultTerm?.id ?? null;
			}
			const billingContactPartyId = await this.primaryBillingContactId(trx, actor.organisationId, client.customerPartyId);
			const documentId = insertedId(await trx.insertInto('financial_documents').values({
				organisation_id: actor.organisationId,
				public_id: publicId,
				document_kind: 'invoice',
				document_number: null,
				customer_party_id: client.customerPartyId,
				billing_contact_party_id: billingContactPartyId,
				project_id: contract.projectId,
				contract_id: contract.id,
				currency_code: contract.currencyCode,
				lifecycle_status: 'draft',
				created_by_member_id: membership.id,
				voided_by_member_id: null,
				voided_at: null,
				void_reason: null
			}).executeTakeFirstOrThrow());
			await trx.insertInto('invoices').values({
				financial_document_id: documentId,
				organisation_id: actor.organisationId,
				payment_term_id: paymentTermId,
				invoice_type: selectedInvoiceType,
				due_date: dueDate,
				customer_purchase_order_reference: purchaseOrderReference
			}).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId,
				actorMemberId: membership.id, projectId: contract.projectId, actionKey: 'finance.invoice.created_from_contract',
				subjectType: 'invoice', subjectPublicId: publicId, correlationId: actor.correlationId,
				changeSummary: { contractPublicId: contract.publicId, contractNumber: contract.contractNumber, invoiceType: selectedInvoiceType }
			});
		});
		return (await this.summary(this.db, actor.organisationId, publicId))!;
	}

	async getWorkspace(actor: TenantActorContext, invoicePublicIdInput: string): Promise<InvoiceWorkspace> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const invoicePublicId = cleanFinanceText(invoicePublicIdInput, 64, 'Invoice ID', true)!;
		const record = await this.invoiceRecord(this.db, actor.organisationId, invoicePublicId);
		if (!record) throw new RecordNotFoundError('Invoice not found.');
		const [lines, paymentTerms, salesItemTypes, units, taxCategories, manageDecision, issueDecision, snapshots, issues] = await Promise.all([
			this.lines(this.db, actor.organisationId, record.id),
			this.db.selectFrom('payment_terms').select(['public_id as publicId', 'name', 'calculation_basis as calculationBasis', 'days_offset as daysOffset', 'is_default as isDefault'])
				.where('organisation_id', '=', actor.organisationId).where('is_active', '=', 1).orderBy('is_default', 'desc').orderBy('name', 'asc').execute(),
			new CommercialRepository(this.db).listSalesItemTypes(),
			new CommercialRepository(this.db).listUnitsOfMeasure(),
			new CommercialRepository(this.db).listTaxCategories(actor.organisationId, this.now()),
			policy.mutationDecision(actor, 'finance.invoice.draft.manage'),
			policy.mutationDecision(actor, 'finance.invoice.issue'),
			this.db.selectFrom('financial_document_party_snapshots').select(['id', 'snapshot_role as snapshotRole', 'display_name as displayName', 'email', 'phone', 'reference_identifier as referenceIdentifier'])
				.where('organisation_id', '=', actor.organisationId).where('financial_document_id', '=', record.id).orderBy('snapshot_role', 'asc').orderBy('sort_order', 'asc').execute(),
			this.db.selectFrom('financial_document_issue_events as issue').leftJoin('financial_document_issue_recipients as recipient', (join) =>
				join.onRef('recipient.financial_document_issue_event_id', '=', 'issue.id').onRef('recipient.organisation_id', '=', 'issue.organisation_id')
			).select(['issue.id as id', 'issue.issue_sequence as issueSequence', 'issue.delivery_channel as deliveryChannel', 'issue.issued_at as issuedAt', 'issue.note as note', 'recipient.recipient_name as recipientName', 'recipient.recipient_email as recipientEmail', 'recipient.delivery_status as deliveryStatus'])
				.where('issue.organisation_id', '=', actor.organisationId).where('issue.financial_document_id', '=', record.id).orderBy('issue.issue_sequence', 'asc').execute()
		]);
		const summary = (await this.summary(this.db, actor.organisationId, invoicePublicId))!;
		let contractCurrentValue: string | null = null;
		let issuedContractNetBeforeThisInvoice: string | null = null;
		if (record.contractId) {
			contractCurrentValue = await this.currentContractValue(this.db, actor.organisationId, record.contractId);
			const otherIssued = await this.db.selectFrom('financial_documents').select('id').where('organisation_id', '=', actor.organisationId)
				.where('document_kind', '=', 'invoice').where('contract_id', '=', record.contractId).where('lifecycle_status', '=', 'issued').where('id', '!=', record.id).execute();
			const nets: string[] = [];
			for (const other of otherIssued) {
				const otherLines = await this.lines(this.db, actor.organisationId, other.id);
				nets.push(...otherLines.map((line) => line.netAmount));
			}
			issuedContractNetBeforeThisInvoice = sumMoney(nets);
		}
		return {
			invoice: {
				...summary,
				customerPartyId: record.customerPartyId,
				customerPartyPublicId: record.customerPartyPublicId,
				billingContactPartyId: record.billingContactPartyId ?? null,
				paymentTermPublicId: record.paymentTermPublicId ?? null,
				paymentTermName: record.paymentTermName ?? null,
				paymentTermBasis: record.paymentTermBasis ?? null,
				paymentTermDaysOffset: record.paymentTermDaysOffset ?? null,
				customerPurchaseOrderReference: record.customerPurchaseOrderReference ?? null,
				purchaseOrderRequired: record.purchaseOrderRequired === 1,
				customerAccountReference: record.customerAccountReference ?? null
			},
			lines,
			paymentTerms: paymentTerms.map((term) => ({ ...term, isDefault: term.isDefault === 1 })),
			salesItemTypes,
			units,
			taxCategories,
			partySnapshots: snapshots,
			issueEvents: issues,
			contractCurrentValue,
			issuedContractNetBeforeThisInvoice,
			canManageDraft: manageDecision.allowed && record.lifecycleStatus === 'draft',
			canIssue: issueDecision.allowed && record.lifecycleStatus === 'draft'
		};
	}

	private async lockDraft(trx: DatabaseExecutor, actor: TenantActorContext, invoicePublicId: string) {
		const identity = await trx
			.selectFrom('financial_documents')
			.select(['id', 'customer_party_id as customerPartyId'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', invoicePublicId)
			.where('document_kind', '=', 'invoice')
			.executeTakeFirst();
		if (!identity) throw new RecordNotFoundError('Invoice not found.');

		const customer = await trx
			.selectFrom('parties')
			.select('id')
			.where('organisation_id', '=', actor.organisationId)
			.where('id', '=', identity.customerPartyId)
			.forUpdate()
			.executeTakeFirst();
		if (!customer) throw new RecordNotFoundError('Invoice customer not found.');

		const record = await this.invoiceRecord(trx, actor.organisationId, invoicePublicId, true);
		if (!record) throw new RecordNotFoundError('Invoice not found.');
		if (record.customerPartyId !== identity.customerPartyId) {
			throw new Error('Invoice customer changed while acquiring the draft lock.');
		}
		if (record.lifecycleStatus !== 'draft') throw new FinanceValidationError('Issued invoices are immutable through draft APIs.');
		return record;
	}

	async updateDraft(actor: TenantActorContext, input: {
		invoicePublicId: string;
		invoiceType: string;
		paymentTermPublicId?: string | null;
		dueDate?: string | null;
		customerPurchaseOrderReference?: string | null;
	}): Promise<void> {
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const selectedInvoiceType = invoiceType(input.invoiceType);
		const dueDate = validateFinanceDate(input.dueDate, 'Due date');
		const purchaseOrderReference = cleanFinanceText(input.customerPurchaseOrderReference, 160, 'Customer purchase order reference');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.invoice.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Invoice draft management is not permitted.');
			const record = await this.lockDraft(trx, actor, invoicePublicId);
			let paymentTermId: string | null = null;
			const termPublicId = input.paymentTermPublicId?.trim() ?? '';
			if (termPublicId) {
				const term = await trx.selectFrom('payment_terms').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', termPublicId).where('is_active', '=', 1).executeTakeFirst();
				if (!term) throw new FinanceValidationError('Selected payment term is unavailable.');
				paymentTermId = term.id;
			}
			await trx.updateTable('invoices').set({ payment_term_id: paymentTermId, invoice_type: selectedInvoiceType, due_date: dueDate, customer_purchase_order_reference: purchaseOrderReference })
				.where('financial_document_id', '=', record.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: record.projectId, actionKey: 'finance.invoice.draft.updated', subjectType: 'invoice', subjectPublicId: record.publicId, correlationId: actor.correlationId, changeSummary: { invoiceType: selectedInvoiceType, paymentTermPublicId: termPublicId || null, dueDate, customerPurchaseOrderReference: purchaseOrderReference } });
		});
	}

	async addLine(actor: TenantActorContext, input: {
		invoicePublicId: string;
		salesItemTypeCode: string;
		unitCode?: string | null;
		description: string;
		quantity: string;
		unitRate: string;
		taxCategoryPublicId: string;
	}): Promise<void> {
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const description = cleanFinanceText(input.description, 65535, 'Line description', true)!;
		const quantity = validateQuantity(input.quantity);
		const unitRate = validateUnitRate(input.unitRate);
		const typeCode = cleanFinanceText(input.salesItemTypeCode, 48, 'Sales item type', true)!;
		const unitCode = cleanFinanceText(input.unitCode, 32, 'Unit');
		const taxCategoryPublicId = cleanFinanceText(input.taxCategoryPublicId, 64, 'Tax category', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.invoice.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Invoice draft management is not permitted.');
			const record = await this.lockDraft(trx, actor, invoicePublicId);
			const type = await trx.selectFrom('sales_item_types').select('id').where('code', '=', typeCode).where('is_active', '=', 1).executeTakeFirst();
			if (!type) throw new FinanceValidationError('Sales item type is unavailable.');
			let unitId: number | null = null;
			if (unitCode) {
				const unit = await trx.selectFrom('units_of_measure').select('id').where('code', '=', unitCode).where('is_active', '=', 1).executeTakeFirst();
				if (!unit) throw new FinanceValidationError('Unit of measure is unavailable.');
				unitId = unit.id;
			}
			const category = await new CommercialRepository(trx).resolveTaxCategory(actor.organisationId, taxCategoryPublicId, this.now());
			if (!category) throw new FinanceValidationError('Tax category is unavailable.');
			const appliedRate = taxRate(category);
			const net = lineAmount(quantity, unitRate);
			const last = await trx.selectFrom('financial_document_items').select('line_number as lineNumber').where('organisation_id', '=', actor.organisationId).where('financial_document_id', '=', record.id).orderBy('line_number', 'desc').executeTakeFirst();
			const lineNumber = (last?.lineNumber ?? 0) + 1;
			const itemId = insertedId(await trx.insertInto('financial_document_items').values({
				organisation_id: actor.organisationId, financial_document_id: record.id, source_quotation_item_id: null,
				sales_item_type_id: type.id, sales_catalog_item_id: null, unit_of_measure_id: unitId, line_number: lineNumber,
				description, quantity, unit_rate: unitRate
			}).executeTakeFirstOrThrow());
			await trx.insertInto('financial_document_item_taxes').values({
				organisation_id: actor.organisationId, financial_document_item_id: itemId, tax_category_id: category.id,
				sort_order: 1, applied_rate_percent: appliedRate, taxable_amount: net, tax_amount: percentageAmount(net, appliedRate)
			}).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: record.projectId, actionKey: 'finance.invoice.line.added', subjectType: 'invoice', subjectPublicId: record.publicId, correlationId: actor.correlationId, changeSummary: { lineNumber, description, quantity, unitRate, taxCategoryPublicId, appliedRate } });
		});
	}

	async removeLine(actor: TenantActorContext, invoicePublicIdInput: string, lineNumber: number): Promise<void> {
		const invoicePublicId = cleanFinanceText(invoicePublicIdInput, 64, 'Invoice ID', true)!;
		if (!Number.isSafeInteger(lineNumber) || lineNumber <= 0) throw new FinanceValidationError('Invoice line is invalid.');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.invoice.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Invoice draft management is not permitted.');
			const record = await this.lockDraft(trx, actor, invoicePublicId);
			const item = await trx.selectFrom('financial_document_items').select('id').where('organisation_id', '=', actor.organisationId).where('financial_document_id', '=', record.id).where('line_number', '=', lineNumber).executeTakeFirst();
			if (!item) throw new RecordNotFoundError('Invoice line not found.');
			await trx.deleteFrom('financial_document_item_taxes').where('organisation_id', '=', actor.organisationId).where('financial_document_item_id', '=', item.id).execute();
			await trx.deleteFrom('financial_document_items').where('organisation_id', '=', actor.organisationId).where('id', '=', item.id).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: record.projectId, actionKey: 'finance.invoice.line.removed', subjectType: 'invoice', subjectPublicId: record.publicId, correlationId: actor.correlationId, changeSummary: { lineNumber } });
		});
	}

	private async dueDateForIssue(trx: DatabaseExecutor, organisationId: string, record: Awaited<ReturnType<InvoiceService['invoiceRecord']>>, issuedAt: Date): Promise<Date> {
		if (!record) throw new FinanceValidationError('Invoice record is unavailable.');
		const issueDate = new Date(Date.UTC(issuedAt.getUTCFullYear(), issuedAt.getUTCMonth(), issuedAt.getUTCDate()));
		if (!record.paymentTermPublicId || !record.paymentTermBasis) {
			if (!record.dueDate) throw new FinanceValidationError('A due date or active payment term is required before invoice issue.');
			if (record.dueDate < issueDate) throw new FinanceValidationError('Invoice due date cannot be before the issue date.');
			return record.dueDate;
		}
		const offset = record.paymentTermDaysOffset ?? 0;
		if (record.paymentTermBasis === 'invoice_date') return addUtcDays(issueDate, offset);
		if (record.paymentTermBasis === 'end_of_month') return addUtcDays(endOfUtcMonth(issueDate), offset);
		if (record.paymentTermBasis === 'manual') {
			if (!record.dueDate) throw new FinanceValidationError('Manual payment terms require an explicit due date before issue.');
			if (record.dueDate < issueDate) throw new FinanceValidationError('Invoice due date cannot be before the issue date.');
			return record.dueDate;
		}
		throw new FinanceValidationError('Payment-term calculation basis is invalid.');
	}

	private async refreshTaxesForIssue(trx: DatabaseExecutor, organisationId: string, documentId: string, issuedAt: Date): Promise<void> {
		const rows = await trx
			.selectFrom('financial_document_item_taxes as tax')
			.innerJoin('financial_document_items as item', (join) =>
				join.onRef('item.id', '=', 'tax.financial_document_item_id').onRef('item.organisation_id', '=', 'tax.organisation_id')
			)
			.innerJoin('tax_categories as category', (join) =>
				join.onRef('category.id', '=', 'tax.tax_category_id').onRef('category.organisation_id', '=', 'tax.organisation_id')
			)
			.select(['tax.financial_document_item_id as itemId', 'tax.sort_order as sortOrder', 'category.public_id as categoryPublicId', 'item.quantity as quantity', 'item.unit_rate as unitRate'])
			.where('tax.organisation_id', '=', organisationId)
			.where('item.financial_document_id', '=', documentId)
			.execute();
		for (const row of rows) {
			const category = await new CommercialRepository(trx).resolveTaxCategory(organisationId, row.categoryPublicId, issuedAt);
			if (!category) throw new FinanceValidationError('An invoice tax category is no longer available at issue time.');
			const rate = taxRate(category);
			const taxableAmount = lineAmount(row.quantity, row.unitRate);
			await trx.updateTable('financial_document_item_taxes').set({ applied_rate_percent: rate, taxable_amount: taxableAmount, tax_amount: percentageAmount(taxableAmount, rate) })
				.where('organisation_id', '=', organisationId).where('financial_document_item_id', '=', row.itemId).where('sort_order', '=', row.sortOrder).executeTakeFirstOrThrow();
		}
	}

	private async insertPartySnapshot(trx: DatabaseExecutor, organisationId: string, documentId: string, facts: PartyFacts, snapshotRole: string, referenceIdentifier: string | null, sortOrder: number): Promise<string> {
		const snapshotId = insertedId(await trx.insertInto('financial_document_party_snapshots').values({
			organisation_id: organisationId, financial_document_id: documentId, source_party_id: facts.id, snapshot_role: snapshotRole,
			display_name: facts.displayName, email: facts.primaryEmail, phone: facts.primaryPhone, reference_identifier: referenceIdentifier, sort_order: sortOrder
		}).executeTakeFirstOrThrow());
		if (facts.address) {
			await trx.insertInto('financial_document_party_snapshot_addresses').values({
				organisation_id: organisationId, financial_document_party_snapshot_id: snapshotId, financial_document_id: documentId,
				address_role: 'billing', line_1: facts.address.line1, line_2: facts.address.line2, line_3: facts.address.line3,
				locality: facts.address.locality, city: facts.address.city, region: facts.address.region, postal_code: facts.address.postalCode,
				country_code: facts.address.countryCode
			}).executeTakeFirstOrThrow();
		}
		return snapshotId;
	}

	async issue(actor: TenantActorContext, input: {
		invoicePublicId: string;
		deliveryChannel: string;
		recipientName?: string | null;
		recipientEmail?: string | null;
		note?: string | null;
	}): Promise<void> {
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const deliveryChannel = input.deliveryChannel.trim();
		if (!FINANCE_DELIVERY_CHANNELS.has(deliveryChannel)) throw new FinanceValidationError('Invoice delivery channel is invalid.');
		const requestedRecipientName = cleanFinanceText(input.recipientName, 255, 'Recipient name');
		const requestedRecipientEmail = cleanFinanceText(input.recipientEmail, 320, 'Recipient email');
		const note = cleanFinanceText(input.note, 2000, 'Issue note');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.invoice.issue', trx);
			if (!decision.allowed) throw new TenantAccessError('Invoice issue is not permitted.');
			const record = await this.lockDraft(trx, actor, invoicePublicId);
			const items = await trx.selectFrom('financial_document_items').select('id').where('organisation_id', '=', actor.organisationId).where('financial_document_id', '=', record.id).execute();
			if (items.length === 0) throw new FinanceValidationError('Add at least one invoice line before issue.');
			if (record.purchaseOrderRequired === 1 && !record.customerPurchaseOrderReference) {
				throw new FinanceValidationError('This customer requires a purchase order/reference before invoice issue.');
			}
			const issuedAt = this.now();
			const dueDate = await this.dueDateForIssue(trx, actor.organisationId, record, issuedAt);
			await this.refreshTaxesForIssue(trx, actor.organisationId, record.id, issuedAt);
			const customerFacts = await this.partyFacts(trx, actor.organisationId, record.customerPartyId);
			if (!customerFacts) throw new FinanceValidationError('Invoice customer is unavailable.');
			let billingFacts: PartyFacts | null = null;
			if (record.billingContactPartyId && record.billingContactPartyId !== record.customerPartyId) {
				billingFacts = await this.partyFacts(trx, actor.organisationId, record.billingContactPartyId);
			}
			await this.insertPartySnapshot(trx, actor.organisationId, record.id, customerFacts, 'customer', record.customerAccountReference ?? null, 1);
			if (billingFacts) await this.insertPartySnapshot(trx, actor.organisationId, record.id, billingFacts, 'billing', null, 1);
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const existingNumbers = await trx.selectFrom('financial_documents').select('document_number as documentNumber')
				.where('organisation_id', '=', actor.organisationId).where('document_kind', '=', 'invoice').where('document_number', 'is not', null).execute();
			const documentNumber = invoiceNumberFrom(existingNumbers.map((row) => row.documentNumber));
			await trx.updateTable('financial_documents').set({ document_number: documentNumber, lifecycle_status: 'issued' })
				.where('id', '=', record.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await trx.updateTable('invoices').set({ due_date: dueDate }).where('financial_document_id', '=', record.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			const issueId = insertedId(await trx.insertInto('financial_document_issue_events').values({
				organisation_id: actor.organisationId, financial_document_id: record.id, issue_sequence: 1,
				delivery_channel: deliveryChannel, issued_by_member_id: membership.id, issued_at: issuedAt, note
			}).executeTakeFirstOrThrow());
			const recipientFacts = billingFacts ?? customerFacts;
			const recipientName = requestedRecipientName ?? recipientFacts.displayName;
			const recipientEmail = requestedRecipientEmail ?? recipientFacts.primaryEmail;
			await trx.insertInto('financial_document_issue_recipients').values({
				organisation_id: actor.organisationId, financial_document_issue_event_id: issueId, financial_document_id: record.id,
				source_party_id: recipientFacts.id, recipient_name: recipientName, recipient_email: recipientEmail,
				delivery_status: deliveryChannel === 'manual' ? 'acknowledged' : 'pending',
				delivered_at: deliveryChannel === 'manual' ? issuedAt : null
			}).executeTakeFirstOrThrow();
			const finalLines = await this.lines(trx, actor.organisationId, record.id);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId,
				actorMemberId: membership.id, projectId: record.projectId, actionKey: 'finance.invoice.issued', subjectType: 'invoice',
				subjectPublicId: record.publicId, correlationId: actor.correlationId,
				changeSummary: {
					documentNumber, dueDate, deliveryChannel,
					netTotal: sumMoney(finalLines.map((line) => line.netAmount)),
					taxTotal: sumMoney(finalLines.map((line) => line.taxAmount)),
					grossTotal: sumMoney(finalLines.map((line) => line.grossAmount))
				}
			});
		});
	}
}
