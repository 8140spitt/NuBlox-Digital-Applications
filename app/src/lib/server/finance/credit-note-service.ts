import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal,
	percentageAmount,
	subtractMoney,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FINANCE_DELIVERY_CHANNELS,
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateQuantity
} from './finance-common';

export type CreditNoteSummary = {
	id: string;
	publicId: string;
	documentNumber: string | null;
	lifecycleStatus: string;
	originalInvoicePublicId: string;
	originalInvoiceNumber: string;
	customerDisplayName: string;
	currencyCode: string;
	reason: string;
	netTotal: string;
	taxTotal: string;
	grossTotal: string;
	createdAt: Date;
};

export type CreditNoteInvoiceCandidate = {
	invoiceId: string;
	invoicePublicId: string;
	invoiceNumber: string;
	customerDisplayName: string;
	currencyCode: string;
	invoiceGross: string;
	issuedCreditGross: string;
	remainingGross: string;
	canCredit: boolean;
};

export type CreditNoteLine = {
	id: string;
	lineNumber: number;
	originalInvoiceLineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
	netAmount: string;
	taxAmount: string;
	grossAmount: string;
};

export type OriginalInvoiceLine = {
	id: string;
	lineNumber: number;
	description: string;
	quantity: string;
	unitRate: string;
	netAmount: string;
	creditedQuantity: string;
	remainingQuantity: string;
};

export type CreditNotePortfolio = {
	creditNotes: CreditNoteSummary[];
	invoices: CreditNoteInvoiceCandidate[];
	canCreate: boolean;
	canVoidInvoices: boolean;
};

export type CreditNoteWorkspace = {
	creditNote: CreditNoteSummary;
	lines: CreditNoteLine[];
	originalInvoiceLines: OriginalInvoiceLine[];
	partySnapshots: Array<{
		id: string;
		snapshotRole: string;
		displayName: string;
		email: string | null;
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
	canManageDraft: boolean;
	canIssue: boolean;
};

function numberedDocument(existing: Array<string | null>, prefix: string): string {
	let maximum = 0;
	const pattern = new RegExp(`^${prefix}-(\\d+)$`);
	for (const value of existing) {
		const match = pattern.exec(value ?? '');
		if (!match) continue;
		const parsed = Number(match[1]);
		if (Number.isSafeInteger(parsed) && parsed > maximum) maximum = parsed;
	}
	return `${prefix}-${String(maximum + 1).padStart(6, '0')}`;
}

function positiveRemainingQuantity(original: string, credited: string): string {
	const result =
		parseScaledDecimal(original, 6, 'Original quantity') -
		parseScaledDecimal(credited, 6, 'Credited quantity');
	return formatScaledDecimal(result > 0n ? result : 0n, 6);
}

export class CreditNoteService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async documentTotals(
		db: DatabaseExecutor,
		organisationId: string,
		documentId: string
	): Promise<{ net: string; tax: string; gross: string }> {
		const items = await db
			.selectFrom('financial_document_items')
			.select(['id', 'quantity', 'unit_rate as unitRate'])
			.where('organisation_id', '=', organisationId)
			.where('financial_document_id', '=', documentId)
			.execute();
		const nets: string[] = [];
		const taxes: string[] = [];
		for (const item of items) {
			nets.push(lineAmount(item.quantity, item.unitRate));
			const taxRows = await db
				.selectFrom('financial_document_item_taxes')
				.select('tax_amount as taxAmount')
				.where('organisation_id', '=', organisationId)
				.where('financial_document_item_id', '=', item.id)
				.execute();
			taxes.push(...taxRows.map((row) => row.taxAmount));
		}
		const net = sumMoney(nets);
		const tax = sumMoney(taxes);
		return { net, tax, gross: sumMoney([net, tax]) };
	}

	private async invoiceRecord(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('financial_documents as document')
			.innerJoin('invoices as invoice', (join) =>
				join
					.onRef('invoice.financial_document_id', '=', 'document.id')
					.onRef('invoice.organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('financial_document_party_snapshots as snapshot', (join) =>
				join
					.onRef('snapshot.financial_document_id', '=', 'document.id')
					.onRef('snapshot.organisation_id', '=', 'document.organisation_id')
					.on('snapshot.snapshot_role', '=', 'customer')
					.on('snapshot.sort_order', '=', 1)
			)
			.select([
				'document.id as id',
				'document.public_id as publicId',
				'document.document_number as documentNumber',
				'document.customer_party_id as customerPartyId',
				'document.billing_contact_party_id as billingContactPartyId',
				'document.project_id as projectId',
				'document.contract_id as contractId',
				'document.currency_code as currencyCode',
				'document.lifecycle_status as lifecycleStatus',
				'document.created_at as createdAt',
				'snapshot.display_name as snapshotDisplayName'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.public_id', '=', publicId)
			.where('document.document_kind', '=', 'invoice');
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async creditNoteRecord(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('financial_documents as creditDocument')
			.innerJoin('credit_notes as creditNote', (join) =>
				join
					.onRef('creditNote.financial_document_id', '=', 'creditDocument.id')
					.onRef('creditNote.organisation_id', '=', 'creditDocument.organisation_id')
			)
			.innerJoin('financial_documents as invoiceDocument', (join) =>
				join
					.onRef('invoiceDocument.id', '=', 'creditNote.original_invoice_document_id')
					.onRef('invoiceDocument.organisation_id', '=', 'creditDocument.organisation_id')
			)
			.leftJoin('financial_document_party_snapshots as invoiceCustomer', (join) =>
				join
					.onRef('invoiceCustomer.financial_document_id', '=', 'invoiceDocument.id')
					.onRef('invoiceCustomer.organisation_id', '=', 'invoiceDocument.organisation_id')
					.on('invoiceCustomer.snapshot_role', '=', 'customer')
					.on('invoiceCustomer.sort_order', '=', 1)
			)
			.select([
				'creditDocument.id as id',
				'creditDocument.public_id as publicId',
				'creditDocument.document_number as documentNumber',
				'creditDocument.lifecycle_status as lifecycleStatus',
				'creditDocument.currency_code as currencyCode',
				'creditDocument.customer_party_id as customerPartyId',
				'creditDocument.billing_contact_party_id as billingContactPartyId',
				'creditDocument.project_id as projectId',
				'creditDocument.contract_id as contractId',
				'creditDocument.created_at as createdAt',
				'creditNote.reason as reason',
				'creditNote.original_invoice_document_id as originalInvoiceDocumentId',
				'invoiceDocument.public_id as originalInvoicePublicId',
				'invoiceDocument.document_number as originalInvoiceNumber',
				'invoiceDocument.lifecycle_status as originalInvoiceLifecycleStatus',
				'invoiceCustomer.display_name as customerDisplayName'
			])
			.where('creditDocument.organisation_id', '=', organisationId)
			.where('creditDocument.public_id', '=', publicId)
			.where('creditDocument.document_kind', '=', 'credit_note');
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async summary(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<CreditNoteSummary | null> {
		const record = await this.creditNoteRecord(db, organisationId, publicId);
		if (!record || !record.originalInvoiceNumber) return null;
		const totals = await this.documentTotals(db, organisationId, record.id);
		return {
			id: record.id,
			publicId: record.publicId,
			documentNumber: record.documentNumber,
			lifecycleStatus: record.lifecycleStatus,
			originalInvoicePublicId: record.originalInvoicePublicId,
			originalInvoiceNumber: record.originalInvoiceNumber,
			customerDisplayName: record.customerDisplayName ?? 'Customer',
			currencyCode: record.currencyCode,
			reason: record.reason,
			netTotal: totals.net,
			taxTotal: totals.tax,
			grossTotal: totals.gross,
			createdAt: record.createdAt
		};
	}

	private async issuedCreditTotalsForInvoice(
		db: DatabaseExecutor,
		organisationId: string,
		invoiceDocumentId: string
	): Promise<{ net: string; tax: string; gross: string }> {
		const credits = await db
			.selectFrom('credit_notes as creditNote')
			.innerJoin('financial_documents as document', (join) =>
				join
					.onRef('document.id', '=', 'creditNote.financial_document_id')
					.onRef('document.organisation_id', '=', 'creditNote.organisation_id')
			)
			.select('document.id')
			.where('creditNote.organisation_id', '=', organisationId)
			.where('creditNote.original_invoice_document_id', '=', invoiceDocumentId)
			.where('document.lifecycle_status', '=', 'issued')
			.execute();
		const net: string[] = [];
		const tax: string[] = [];
		for (const credit of credits) {
			const totals = await this.documentTotals(db, organisationId, credit.id);
			net.push(totals.net);
			tax.push(totals.tax);
		}
		const netTotal = sumMoney(net);
		const taxTotal = sumMoney(tax);
		return { net: netTotal, tax: taxTotal, gross: sumMoney([netTotal, taxTotal]) };
	}

	private async creditedQuantityForOriginalItem(
		db: DatabaseExecutor,
		organisationId: string,
		originalItemId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('credit_note_item_sources as source')
			.innerJoin('financial_document_items as creditItem', (join) =>
				join
					.onRef('creditItem.id', '=', 'source.credit_note_item_id')
					.onRef('creditItem.organisation_id', '=', 'source.organisation_id')
			)
			.innerJoin('financial_documents as creditDocument', (join) =>
				join
					.onRef('creditDocument.id', '=', 'source.credit_note_document_id')
					.onRef('creditDocument.organisation_id', '=', 'source.organisation_id')
			)
			.select('creditItem.quantity')
			.where('source.organisation_id', '=', organisationId)
			.where('source.original_invoice_item_id', '=', originalItemId)
			.where('creditDocument.lifecycle_status', '=', 'issued')
			.execute();
		let total = 0n;
		for (const row of rows) total += parseScaledDecimal(row.quantity, 6, 'Credited quantity');
		return formatScaledDecimal(total, 6);
	}

	private async candidateForInvoice(
		db: DatabaseExecutor,
		organisationId: string,
		invoice: Awaited<ReturnType<CreditNoteService['invoiceRecord']>>
	): Promise<CreditNoteInvoiceCandidate | null> {
		if (!invoice || !invoice.documentNumber || invoice.lifecycleStatus !== 'issued') return null;
		const invoiceTotals = await this.documentTotals(db, organisationId, invoice.id);
		const creditTotals = await this.issuedCreditTotalsForInvoice(db, organisationId, invoice.id);
		const remainingGross = subtractMoney(invoiceTotals.gross, creditTotals.gross);
		return {
			invoiceId: invoice.id,
			invoicePublicId: invoice.publicId,
			invoiceNumber: invoice.documentNumber,
			customerDisplayName: invoice.snapshotDisplayName ?? 'Customer',
			currencyCode: invoice.currencyCode,
			invoiceGross: invoiceTotals.gross,
			issuedCreditGross: creditTotals.gross,
			remainingGross,
			canCredit: parseScaledDecimal(remainingGross, 4, 'Remaining receivable', true) > 0n
		};
	}

	async getPortfolio(actor: TenantActorContext): Promise<CreditNotePortfolio> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const [createDecision, voidDecision, creditRows, invoiceRows] = await Promise.all([
			policy.mutationDecision(actor, 'finance.credit_note.create'),
			policy.mutationDecision(actor, 'finance.invoice.void'),
			this.db
				.selectFrom('financial_documents')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('document_kind', '=', 'credit_note')
				.orderBy('id', 'desc')
				.execute(),
			this.db
				.selectFrom('financial_documents')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('document_kind', '=', 'invoice')
				.where('lifecycle_status', '=', 'issued')
				.orderBy('id', 'desc')
				.execute()
		]);
		const creditNotes: CreditNoteSummary[] = [];
		for (const row of creditRows) {
			const item = await this.summary(this.db, actor.organisationId, row.publicId);
			if (item) creditNotes.push(item);
		}
		const invoices: CreditNoteInvoiceCandidate[] = [];
		for (const row of invoiceRows) {
			const invoice = await this.invoiceRecord(this.db, actor.organisationId, row.publicId);
			const candidate = await this.candidateForInvoice(this.db, actor.organisationId, invoice);
			if (candidate) invoices.push(candidate);
		}
		return {
			creditNotes,
			invoices,
			canCreate: createDecision.allowed,
			canVoidInvoices: voidDecision.allowed
		};
	}

	async createFromInvoice(
		actor: TenantActorContext,
		input: { invoicePublicId: string; reason: string }
	): Promise<CreditNoteSummary> {
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const reason = cleanFinanceText(input.reason, 65535, 'Credit-note reason', true)!;
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.credit_note.create', trx);
			if (!decision.allowed) throw new TenantAccessError('Credit-note creation is not permitted.');
			const invoice = await this.invoiceRecord(trx, actor.organisationId, invoicePublicId, true);
			if (!invoice) throw new RecordNotFoundError('Invoice not found.');
			if (invoice.lifecycleStatus !== 'issued' || !invoice.documentNumber) {
				throw new FinanceValidationError('Only an issued invoice can be credited.');
			}
			const candidate = await this.candidateForInvoice(trx, actor.organisationId, invoice);
			if (!candidate?.canCredit) throw new FinanceValidationError('The invoice has no remaining amount available to credit.');
			const documentId = insertedId(
				await trx
					.insertInto('financial_documents')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						document_kind: 'credit_note',
						document_number: null,
						customer_party_id: invoice.customerPartyId,
						billing_contact_party_id: invoice.billingContactPartyId,
						project_id: invoice.projectId,
						contract_id: invoice.contractId,
						currency_code: invoice.currencyCode,
						lifecycle_status: 'draft',
						created_by_member_id: membership.id,
						voided_by_member_id: null,
						voided_at: null,
						void_reason: null
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('credit_notes')
				.values({
					financial_document_id: documentId,
					organisation_id: actor.organisationId,
					original_invoice_document_id: invoice.id,
					reason
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: invoice.projectId,
				actionKey: 'finance.credit_note.created',
				subjectType: 'credit_note',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { invoicePublicId: invoice.publicId, invoiceNumber: invoice.documentNumber, reason }
			});
		});
		return (await this.summary(this.db, actor.organisationId, publicId))!;
	}

	private async draftRecord(trx: DatabaseExecutor, actor: TenantActorContext, publicId: string) {
		const record = await this.creditNoteRecord(trx, actor.organisationId, publicId, true);
		if (!record) throw new RecordNotFoundError('Credit note not found.');
		if (record.lifecycleStatus !== 'draft') {
			throw new FinanceValidationError('Issued credit notes are immutable through draft APIs.');
		}
		return record;
	}

	async updateDraftReason(
		actor: TenantActorContext,
		input: { creditNotePublicId: string; reason: string }
	): Promise<void> {
		const publicId = cleanFinanceText(input.creditNotePublicId, 64, 'Credit-note ID', true)!;
		const reason = cleanFinanceText(input.reason, 65535, 'Credit-note reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.credit_note.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Credit-note draft management is not permitted.');
			const record = await this.draftRecord(trx, actor, publicId);
			await trx
				.updateTable('credit_notes')
				.set({ reason })
				.where('financial_document_id', '=', record.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: record.projectId,
				actionKey: 'finance.credit_note.draft.updated',
				subjectType: 'credit_note',
				subjectPublicId: record.publicId,
				correlationId: actor.correlationId,
				changeSummary: { reason }
			});
		});
	}

	async addLine(
		actor: TenantActorContext,
		input: { creditNotePublicId: string; originalInvoiceLineNumber: number; quantity: string }
	): Promise<void> {
		const publicId = cleanFinanceText(input.creditNotePublicId, 64, 'Credit-note ID', true)!;
		if (!Number.isSafeInteger(input.originalInvoiceLineNumber) || input.originalInvoiceLineNumber <= 0) {
			throw new FinanceValidationError('Original invoice line is invalid.');
		}
		const quantity = validateQuantity(input.quantity);
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.credit_note.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Credit-note draft management is not permitted.');
			const record = await this.draftRecord(trx, actor, publicId);
			const sourceItem = await trx
				.selectFrom('financial_document_items')
				.select([
					'id',
					'source_quotation_item_id as sourceQuotationItemId',
					'sales_item_type_id as salesItemTypeId',
					'sales_catalog_item_id as salesCatalogItemId',
					'unit_of_measure_id as unitOfMeasureId',
					'line_number as lineNumber',
					'description',
					'quantity',
					'unit_rate as unitRate'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_id', '=', record.originalInvoiceDocumentId)
				.where('line_number', '=', input.originalInvoiceLineNumber)
				.executeTakeFirst();
			if (!sourceItem) throw new RecordNotFoundError('Original invoice line not found.');
			const existing = await trx
				.selectFrom('credit_note_item_sources')
				.select('credit_note_item_id')
				.where('organisation_id', '=', actor.organisationId)
				.where('credit_note_document_id', '=', record.id)
				.where('original_invoice_item_id', '=', sourceItem.id)
				.executeTakeFirst();
			if (existing) throw new FinanceValidationError('This invoice line is already included in the credit-note draft.');
			const creditedQuantity = await this.creditedQuantityForOriginalItem(trx, actor.organisationId, sourceItem.id);
			const available = positiveRemainingQuantity(sourceItem.quantity, creditedQuantity);
			if (parseScaledDecimal(quantity, 6, 'Credit quantity') > parseScaledDecimal(available, 6, 'Available quantity')) {
				throw new FinanceValidationError(`Credit quantity exceeds the remaining ${available} available on the invoice line.`);
			}
			const lastLine = await trx
				.selectFrom('financial_document_items')
				.select('line_number as lineNumber')
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_id', '=', record.id)
				.orderBy('line_number', 'desc')
				.executeTakeFirst();
			const creditLineNumber = (lastLine?.lineNumber ?? 0) + 1;
			const creditItemId = insertedId(
				await trx
					.insertInto('financial_document_items')
					.values({
						organisation_id: actor.organisationId,
						financial_document_id: record.id,
						source_quotation_item_id: sourceItem.sourceQuotationItemId,
						sales_item_type_id: sourceItem.salesItemTypeId,
						sales_catalog_item_id: sourceItem.salesCatalogItemId,
						unit_of_measure_id: sourceItem.unitOfMeasureId,
						line_number: creditLineNumber,
						description: sourceItem.description,
						quantity,
						unit_rate: sourceItem.unitRate
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('credit_note_item_sources')
				.values({
					organisation_id: actor.organisationId,
					credit_note_document_id: record.id,
					credit_note_item_id: creditItemId,
					original_invoice_document_id: record.originalInvoiceDocumentId,
					original_invoice_item_id: sourceItem.id
				})
				.executeTakeFirstOrThrow();
			const sourceTaxes = await trx
				.selectFrom('financial_document_item_taxes')
				.select(['tax_category_id as taxCategoryId', 'sort_order as sortOrder', 'applied_rate_percent as appliedRatePercent'])
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_item_id', '=', sourceItem.id)
				.orderBy('sort_order', 'asc')
				.execute();
			const net = lineAmount(quantity, sourceItem.unitRate);
			if (sourceTaxes.length > 0) {
				await trx
					.insertInto('financial_document_item_taxes')
					.values(
						sourceTaxes.map((tax) => ({
							organisation_id: actor.organisationId,
							financial_document_item_id: creditItemId,
							tax_category_id: tax.taxCategoryId,
							sort_order: tax.sortOrder,
							applied_rate_percent: tax.appliedRatePercent,
							taxable_amount: net,
							tax_amount: percentageAmount(net, tax.appliedRatePercent)
						}))
					)
					.execute();
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: record.projectId,
				actionKey: 'finance.credit_note.line.added',
				subjectType: 'credit_note',
				subjectPublicId: record.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					creditLineNumber,
					originalInvoiceLineNumber: sourceItem.lineNumber,
					quantity,
					unitRate: sourceItem.unitRate
				}
			});
		});
	}

	async removeLine(actor: TenantActorContext, creditNotePublicIdInput: string, lineNumber: number): Promise<void> {
		const publicId = cleanFinanceText(creditNotePublicIdInput, 64, 'Credit-note ID', true)!;
		if (!Number.isSafeInteger(lineNumber) || lineNumber <= 0) throw new FinanceValidationError('Credit-note line is invalid.');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.credit_note.draft.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Credit-note draft management is not permitted.');
			const record = await this.draftRecord(trx, actor, publicId);
			const item = await trx
				.selectFrom('financial_document_items')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_id', '=', record.id)
				.where('line_number', '=', lineNumber)
				.executeTakeFirst();
			if (!item) throw new RecordNotFoundError('Credit-note line not found.');
			await trx
				.deleteFrom('credit_note_item_sources')
				.where('organisation_id', '=', actor.organisationId)
				.where('credit_note_item_id', '=', item.id)
				.execute();
			await trx
				.deleteFrom('financial_document_item_taxes')
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_item_id', '=', item.id)
				.execute();
			await trx
				.deleteFrom('financial_document_items')
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', item.id)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: record.projectId,
				actionKey: 'finance.credit_note.line.removed',
				subjectType: 'credit_note',
				subjectPublicId: record.publicId,
				correlationId: actor.correlationId,
				changeSummary: { lineNumber }
			});
		});
	}

	private async lines(
		db: DatabaseExecutor,
		organisationId: string,
		creditDocumentId: string
	): Promise<CreditNoteLine[]> {
		const rows = await db
			.selectFrom('financial_document_items as creditItem')
			.innerJoin('credit_note_item_sources as source', (join) =>
				join
					.onRef('source.credit_note_item_id', '=', 'creditItem.id')
					.onRef('source.organisation_id', '=', 'creditItem.organisation_id')
			)
			.innerJoin('financial_document_items as originalItem', (join) =>
				join
					.onRef('originalItem.id', '=', 'source.original_invoice_item_id')
					.onRef('originalItem.organisation_id', '=', 'source.organisation_id')
			)
			.select([
				'creditItem.id',
				'creditItem.line_number as lineNumber',
				'originalItem.line_number as originalInvoiceLineNumber',
				'creditItem.description',
				'creditItem.quantity',
				'creditItem.unit_rate as unitRate'
			])
			.where('creditItem.organisation_id', '=', organisationId)
			.where('creditItem.financial_document_id', '=', creditDocumentId)
			.orderBy('creditItem.line_number', 'asc')
			.execute();
		const result: CreditNoteLine[] = [];
		for (const row of rows) {
			const taxes = await db
				.selectFrom('financial_document_item_taxes')
				.select('tax_amount as taxAmount')
				.where('organisation_id', '=', organisationId)
				.where('financial_document_item_id', '=', row.id)
				.execute();
			const netAmount = lineAmount(row.quantity, row.unitRate);
			const taxAmount = sumMoney(taxes.map((tax) => tax.taxAmount));
			result.push({
				...row,
				netAmount,
				taxAmount,
				grossAmount: sumMoney([netAmount, taxAmount])
			});
		}
		return result;
	}

	private async originalInvoiceLines(
		db: DatabaseExecutor,
		organisationId: string,
		invoiceDocumentId: string
	): Promise<OriginalInvoiceLine[]> {
		const rows = await db
			.selectFrom('financial_document_items')
			.select(['id', 'line_number as lineNumber', 'description', 'quantity', 'unit_rate as unitRate'])
			.where('organisation_id', '=', organisationId)
			.where('financial_document_id', '=', invoiceDocumentId)
			.orderBy('line_number', 'asc')
			.execute();
		const result: OriginalInvoiceLine[] = [];
		for (const row of rows) {
			const creditedQuantity = await this.creditedQuantityForOriginalItem(db, organisationId, row.id);
			result.push({
				...row,
				netAmount: lineAmount(row.quantity, row.unitRate),
				creditedQuantity,
				remainingQuantity: positiveRemainingQuantity(row.quantity, creditedQuantity)
			});
		}
		return result;
	}

	async getWorkspace(actor: TenantActorContext, creditNotePublicIdInput: string): Promise<CreditNoteWorkspace> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const publicId = cleanFinanceText(creditNotePublicIdInput, 64, 'Credit-note ID', true)!;
		const record = await this.creditNoteRecord(this.db, actor.organisationId, publicId);
		if (!record) throw new RecordNotFoundError('Credit note not found.');
		const [summary, lines, originalInvoiceLines, manageDecision, issueDecision, snapshots, issues] = await Promise.all([
			this.summary(this.db, actor.organisationId, publicId),
			this.lines(this.db, actor.organisationId, record.id),
			this.originalInvoiceLines(this.db, actor.organisationId, record.originalInvoiceDocumentId),
			policy.mutationDecision(actor, 'finance.credit_note.draft.manage'),
			policy.mutationDecision(actor, 'finance.credit_note.issue'),
			this.db
				.selectFrom('financial_document_party_snapshots')
				.select([
					'id',
					'snapshot_role as snapshotRole',
					'display_name as displayName',
					'email',
					'reference_identifier as referenceIdentifier'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_id', '=', record.id)
				.orderBy('snapshot_role', 'asc')
				.orderBy('sort_order', 'asc')
				.execute(),
			this.db
				.selectFrom('financial_document_issue_events as issue')
				.leftJoin('financial_document_issue_recipients as recipient', (join) =>
					join
						.onRef('recipient.financial_document_issue_event_id', '=', 'issue.id')
						.onRef('recipient.organisation_id', '=', 'issue.organisation_id')
				)
				.select([
					'issue.id',
					'issue.issue_sequence as issueSequence',
					'issue.delivery_channel as deliveryChannel',
					'issue.issued_at as issuedAt',
					'issue.note',
					'recipient.recipient_name as recipientName',
					'recipient.recipient_email as recipientEmail',
					'recipient.delivery_status as deliveryStatus'
				])
				.where('issue.organisation_id', '=', actor.organisationId)
				.where('issue.financial_document_id', '=', record.id)
				.orderBy('issue.issue_sequence', 'asc')
				.execute()
		]);
		if (!summary) throw new RecordNotFoundError('Credit note not found.');
		return {
			creditNote: summary,
			lines,
			originalInvoiceLines,
			partySnapshots: snapshots,
			issueEvents: issues,
			canManageDraft: manageDecision.allowed && record.lifecycleStatus === 'draft',
			canIssue: issueDecision.allowed && record.lifecycleStatus === 'draft'
		};
	}

	private async revalidateAndRefreshTaxes(
		trx: DatabaseExecutor,
		organisationId: string,
		creditDocumentId: string
	): Promise<void> {
		const sources = await trx
			.selectFrom('credit_note_item_sources as source')
			.innerJoin('financial_document_items as creditItem', (join) =>
				join
					.onRef('creditItem.id', '=', 'source.credit_note_item_id')
					.onRef('creditItem.organisation_id', '=', 'source.organisation_id')
			)
			.innerJoin('financial_document_items as originalItem', (join) =>
				join
					.onRef('originalItem.id', '=', 'source.original_invoice_item_id')
					.onRef('originalItem.organisation_id', '=', 'source.organisation_id')
			)
			.select([
				'source.credit_note_item_id as creditItemId',
				'source.original_invoice_item_id as originalItemId',
				'creditItem.quantity as creditQuantity',
				'creditItem.unit_rate as creditUnitRate',
				'originalItem.quantity as originalQuantity'
			])
			.where('source.organisation_id', '=', organisationId)
			.where('source.credit_note_document_id', '=', creditDocumentId)
			.execute();
		if (sources.length === 0) throw new FinanceValidationError('Add at least one credit-note line before issue.');
		for (const source of sources) {
			const alreadyCredited = await this.creditedQuantityForOriginalItem(trx, organisationId, source.originalItemId);
			const totalAfterIssue =
				parseScaledDecimal(alreadyCredited, 6, 'Credited quantity') +
				parseScaledDecimal(source.creditQuantity, 6, 'Credit quantity');
			if (totalAfterIssue > parseScaledDecimal(source.originalQuantity, 6, 'Original quantity')) {
				throw new FinanceValidationError('Credit-note issue would exceed the remaining quantity on an original invoice line.');
			}
			const originalTaxes = await trx
				.selectFrom('financial_document_item_taxes')
				.select(['tax_category_id as taxCategoryId', 'sort_order as sortOrder', 'applied_rate_percent as appliedRatePercent'])
				.where('organisation_id', '=', organisationId)
				.where('financial_document_item_id', '=', source.originalItemId)
				.orderBy('sort_order', 'asc')
				.execute();
			await trx
				.deleteFrom('financial_document_item_taxes')
				.where('organisation_id', '=', organisationId)
				.where('financial_document_item_id', '=', source.creditItemId)
				.execute();
			const taxableAmount = lineAmount(source.creditQuantity, source.creditUnitRate);
			if (originalTaxes.length > 0) {
				await trx
					.insertInto('financial_document_item_taxes')
					.values(
						originalTaxes.map((tax) => ({
							organisation_id: organisationId,
							financial_document_item_id: source.creditItemId,
							tax_category_id: tax.taxCategoryId,
							sort_order: tax.sortOrder,
							applied_rate_percent: tax.appliedRatePercent,
							taxable_amount: taxableAmount,
							tax_amount: percentageAmount(taxableAmount, tax.appliedRatePercent)
						}))
					)
					.execute();
			}
		}
	}

	private async copyInvoiceSnapshots(
		trx: DatabaseExecutor,
		organisationId: string,
		invoiceDocumentId: string,
		creditDocumentId: string
	): Promise<void> {
		const snapshots = await trx
			.selectFrom('financial_document_party_snapshots')
			.select([
				'id',
				'source_party_id as sourcePartyId',
				'snapshot_role as snapshotRole',
				'display_name as displayName',
				'email',
				'phone',
				'reference_identifier as referenceIdentifier',
				'sort_order as sortOrder'
			])
			.where('organisation_id', '=', organisationId)
			.where('financial_document_id', '=', invoiceDocumentId)
			.orderBy('snapshot_role', 'asc')
			.orderBy('sort_order', 'asc')
			.execute();
		if (!snapshots.some((snapshot) => snapshot.snapshotRole === 'customer')) {
			throw new FinanceValidationError('The original invoice has no customer snapshot evidence.');
		}
		for (const snapshot of snapshots) {
			const newSnapshotId = insertedId(
				await trx
					.insertInto('financial_document_party_snapshots')
					.values({
						organisation_id: organisationId,
						financial_document_id: creditDocumentId,
						source_party_id: snapshot.sourcePartyId,
						snapshot_role: snapshot.snapshotRole,
						display_name: snapshot.displayName,
						email: snapshot.email,
						phone: snapshot.phone,
						reference_identifier: snapshot.referenceIdentifier,
						sort_order: snapshot.sortOrder
					})
					.executeTakeFirstOrThrow()
			);
			const addresses = await trx
				.selectFrom('financial_document_party_snapshot_addresses')
				.select([
					'address_role as addressRole',
					'line_1 as line1',
					'line_2 as line2',
					'line_3 as line3',
					'locality',
					'city',
					'region',
					'postal_code as postalCode',
					'country_code as countryCode'
				])
				.where('organisation_id', '=', organisationId)
				.where('financial_document_party_snapshot_id', '=', snapshot.id)
				.execute();
			if (addresses.length > 0) {
				await trx
					.insertInto('financial_document_party_snapshot_addresses')
					.values(
						addresses.map((address) => ({
							organisation_id: organisationId,
							financial_document_party_snapshot_id: newSnapshotId,
							financial_document_id: creditDocumentId,
							address_role: address.addressRole,
							line_1: address.line1,
							line_2: address.line2,
							line_3: address.line3,
							locality: address.locality,
							city: address.city,
							region: address.region,
							postal_code: address.postalCode,
							country_code: address.countryCode
						}))
					)
					.execute();
			}
		}
	}

	async issue(
		actor: TenantActorContext,
		input: {
			creditNotePublicId: string;
			deliveryChannel: string;
			recipientName?: string | null;
			recipientEmail?: string | null;
			note?: string | null;
		}
	): Promise<void> {
		const publicId = cleanFinanceText(input.creditNotePublicId, 64, 'Credit-note ID', true)!;
		const deliveryChannel = input.deliveryChannel.trim();
		if (!FINANCE_DELIVERY_CHANNELS.has(deliveryChannel)) throw new FinanceValidationError('Credit-note delivery channel is invalid.');
		const recipientNameInput = cleanFinanceText(input.recipientName, 255, 'Recipient name');
		const recipientEmailInput = cleanFinanceText(input.recipientEmail, 320, 'Recipient email');
		const note = cleanFinanceText(input.note, 1000, 'Issue note');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.credit_note.issue', trx);
			if (!decision.allowed) throw new TenantAccessError('Credit-note issue is not permitted.');
			const record = await this.draftRecord(trx, actor, publicId);
			const invoice = await trx
				.selectFrom('financial_documents')
				.select(['id', 'lifecycle_status as lifecycleStatus'])
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', record.originalInvoiceDocumentId)
				.where('document_kind', '=', 'invoice')
				.forUpdate()
				.executeTakeFirst();
			if (!invoice || invoice.lifecycleStatus !== 'issued') {
				throw new FinanceValidationError('The original invoice must remain issued when the credit note is issued.');
			}
			await this.revalidateAndRefreshTaxes(trx, actor.organisationId, record.id);
			await this.copyInvoiceSnapshots(trx, actor.organisationId, record.originalInvoiceDocumentId, record.id);
			await trx.selectFrom('organisations').select('id').where('id', '=', actor.organisationId).forUpdate().executeTakeFirstOrThrow();
			const existingNumbers = await trx
				.selectFrom('financial_documents')
				.select('document_number as documentNumber')
				.where('organisation_id', '=', actor.organisationId)
				.where('document_kind', '=', 'credit_note')
				.where('document_number', 'is not', null)
				.execute();
			const documentNumber = numberedDocument(existingNumbers.map((row) => row.documentNumber), 'CN');
			await trx
				.updateTable('financial_documents')
				.set({ document_number: documentNumber, lifecycle_status: 'issued' })
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', record.id)
				.executeTakeFirstOrThrow();
			const sourceRecipient = await trx
				.selectFrom('financial_document_issue_events as issue')
				.innerJoin('financial_document_issue_recipients as recipient', (join) =>
					join
						.onRef('recipient.financial_document_issue_event_id', '=', 'issue.id')
						.onRef('recipient.organisation_id', '=', 'issue.organisation_id')
				)
				.select([
					'recipient.source_party_id as sourcePartyId',
					'recipient.recipient_name as recipientName',
					'recipient.recipient_email as recipientEmail'
				])
				.where('issue.organisation_id', '=', actor.organisationId)
				.where('issue.financial_document_id', '=', record.originalInvoiceDocumentId)
				.orderBy('issue.issue_sequence', 'desc')
				.orderBy('recipient.id', 'asc')
				.executeTakeFirst();
			const fallbackSnapshot = await trx
				.selectFrom('financial_document_party_snapshots')
				.select(['source_party_id as sourcePartyId', 'display_name as displayName', 'email'])
				.where('organisation_id', '=', actor.organisationId)
				.where('financial_document_id', '=', record.id)
				.where('snapshot_role', 'in', ['billing', 'customer'])
				.orderBy('snapshot_role', 'asc')
				.orderBy('sort_order', 'asc')
				.executeTakeFirstOrThrow();
			const recipientName = recipientNameInput ?? sourceRecipient?.recipientName ?? fallbackSnapshot.displayName;
			const recipientEmail = recipientEmailInput ?? sourceRecipient?.recipientEmail ?? fallbackSnapshot.email;
			const recipientSourcePartyId = sourceRecipient?.sourcePartyId ?? fallbackSnapshot.sourcePartyId;
			const issuedAt = this.now();
			const issueId = insertedId(
				await trx
					.insertInto('financial_document_issue_events')
					.values({
						organisation_id: actor.organisationId,
						financial_document_id: record.id,
						issue_sequence: 1,
						issued_by_member_id: membership.id,
						delivery_channel: deliveryChannel,
						issued_at: issuedAt,
						note
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('financial_document_issue_recipients')
				.values({
					organisation_id: actor.organisationId,
					financial_document_issue_event_id: issueId,
					financial_document_id: record.id,
					source_party_id: recipientSourcePartyId,
					recipient_name: recipientName,
					recipient_email: recipientEmail,
					delivery_status: deliveryChannel === 'manual' ? 'acknowledged' : 'pending',
					delivered_at: deliveryChannel === 'manual' ? issuedAt : null
				})
				.executeTakeFirstOrThrow();
			const totals = await this.documentTotals(trx, actor.organisationId, record.id);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: record.projectId,
				actionKey: 'finance.credit_note.issued',
				subjectType: 'credit_note',
				subjectPublicId: record.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					documentNumber,
					originalInvoicePublicId: record.originalInvoicePublicId,
					originalInvoiceNumber: record.originalInvoiceNumber,
					netTotal: totals.net,
					taxTotal: totals.tax,
					grossTotal: totals.gross,
					deliveryChannel
				}
			});
		});
	}

	async voidInvoice(
		actor: TenantActorContext,
		input: { invoicePublicId: string; reason: string }
	): Promise<void> {
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Void reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.invoice.void', trx);
			if (!decision.allowed) throw new TenantAccessError('Invoice voiding is not permitted.');
			const invoice = await this.invoiceRecord(trx, actor.organisationId, invoicePublicId, true);
			if (!invoice) throw new RecordNotFoundError('Invoice not found.');
			if (invoice.lifecycleStatus !== 'issued') throw new FinanceValidationError('Only an issued invoice can be voided.');
			const credit = await trx
				.selectFrom('credit_notes as creditNote')
				.innerJoin('financial_documents as creditDocument', (join) =>
					join
						.onRef('creditDocument.id', '=', 'creditNote.financial_document_id')
						.onRef('creditDocument.organisation_id', '=', 'creditNote.organisation_id')
				)
				.select('creditDocument.id')
				.where('creditNote.organisation_id', '=', actor.organisationId)
				.where('creditNote.original_invoice_document_id', '=', invoice.id)
				.where('creditDocument.lifecycle_status', '!=', 'void')
				.executeTakeFirst();
			if (credit) {
				throw new FinanceValidationError('An invoice with a draft or issued credit note cannot be voided. Resolve the credit-note history instead.');
			}
			const allocation = await trx
				.selectFrom('payment_allocations as allocation')
				.leftJoin('payment_allocation_reversals as reversal', (join) =>
					join
						.onRef('reversal.payment_allocation_id', '=', 'allocation.id')
						.onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
				)
				.select('allocation.id')
				.where('allocation.organisation_id', '=', actor.organisationId)
				.where('allocation.invoice_document_id', '=', invoice.id)
				.where('reversal.payment_allocation_id', 'is', null)
				.executeTakeFirst();
			if (allocation) throw new FinanceValidationError('An invoice with an active payment allocation cannot be voided.');
			const voidedAt = this.now();
			await trx
				.updateTable('financial_documents')
				.set({
					lifecycle_status: 'void',
					voided_by_member_id: membership.id,
					voided_at: voidedAt,
					void_reason: reason
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', invoice.id)
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: invoice.projectId,
				actionKey: 'finance.invoice.voided',
				subjectType: 'invoice',
				subjectPublicId: invoice.publicId,
				correlationId: actor.correlationId,
				changeSummary: { documentNumber: invoice.documentNumber, reason, voidedAt }
			});
		});
	}
}
