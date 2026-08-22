import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal,
	percentageAmount,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProcurementRepository } from '$lib/server/procurement/procurement-repository';
import {
	AccountsPayableRepository,
	type AccountsPayableDocumentItemRecord,
	type AccountsPayableDocumentRecord,
	type IssuedPurchaseOrder,
	type PurchaseOrderItemForMatching
} from './accounts-payable-repository';
import {
	FinanceValidationError,
	cleanFinanceText,
	validateCurrencyCode,
	validateFinanceDate,
	validateQuantity,
	validateUnitRate
} from './finance-common';

const AP_MUTATION_PERMISSIONS = {
	create: 'finance.ap.invoice.create',
	submit: 'finance.ap.invoice.submit',
	match: 'finance.ap.match.manage',
	resolve: 'finance.ap.exception.resolve',
	approve: 'finance.ap.approve',
	void: 'finance.ap.invoice.void'
} as const;

const AUTOMATIC_MATCH_EXCEPTION_CODES = new Set([
	'ORDER_QUANTITY_EXCEEDED',
	'INSUFFICIENT_RECEIPT',
	'MISSING_PO_LINE'
]);

export type AccountsPayableCreateLineInput = {
	description: string;
	quantity: string;
	unitRate: string;
	purchaseOrderLineNumber?: number | null;
	taxCategoryPublicId?: string | null;
};

export type CreateAccountsPayableDocumentInput = {
	documentType?: 'invoice' | 'credit_note';
	supplierPublicId: string;
	purchaseOrderPublicId?: string | null;
	supplierDocumentNumber: string;
	invoiceDate: string;
	taxDate?: string | null;
	dueDate?: string | null;
	currencyCode: string;
	lines: AccountsPayableCreateLineInput[];
};

export type AccountsPayableWorkspaceDocument = AccountsPayableDocumentRecord & {
	items: AccountsPayableDocumentItemRecord[];
	exceptions: Awaited<ReturnType<AccountsPayableRepository['listExceptions']>>;
	matchState: 'draft' | 'exception' | 'awaiting_approval' | 'approved' | 'closed';
};

export type AccountsPayableWorkspace = {
	documents: AccountsPayableWorkspaceDocument[];
	suppliers: Awaited<ReturnType<ProcurementRepository['listEligibleSuppliers']>>;
	purchaseOrders: Array<IssuedPurchaseOrder & { items: PurchaseOrderItemForMatching[] }>;
	taxCategories: Awaited<ReturnType<AccountsPayableRepository['listActiveTaxCategories']>>;
	canCreate: boolean;
	canSubmit: boolean;
	canMatch: boolean;
	canResolveExceptions: boolean;
	canApprove: boolean;
	canVoid: boolean;
};

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === 'object' &&
			'code' in error &&
			(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

function publicId(value: string, label: string): string {
	const text = value.trim();
	if (!/^[0-9a-f-]{36}$/i.test(text)) throw new FinanceValidationError(`${label} is invalid.`);
	return text;
}

function documentType(value: string | undefined): 'invoice' | 'credit_note' {
	if (!value || value === 'invoice') return 'invoice';
	if (value === 'credit_note') return value;
	throw new FinanceValidationError('Supplier document type is invalid.');
}

function positiveLineNumber(value: number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	if (!Number.isSafeInteger(value) || value <= 0)
		throw new FinanceValidationError('Purchase-order line number is invalid.');
	return value;
}

function addMoney(left: string, right: string): string {
	return sumMoney([left, right]);
}

function subtractQuantity(left: string, right: string): string {
	return formatScaledDecimal(
		parseScaledDecimal(left, 6, 'Quantity', true) - parseScaledDecimal(right, 6, 'Quantity', true),
		6
	);
}

function minimumQuantity(left: string, right: string): string {
	return parseScaledDecimal(left, 6, 'Quantity') <= parseScaledDecimal(right, 6, 'Quantity')
		? left
		: right;
}

export class AccountsPayableService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async decision(actor: TenantActorContext, permissionKey: string, db: DatabaseExecutor = this.db) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'finance.manage');
	}

	private async requireView(actor: TenantActorContext, db: DatabaseExecutor = this.db): Promise<void> {
		await this.assertActiveActor(actor, db);
		if (!(await this.decision(actor, 'finance.ap.view', db)).allowed) {
			throw new TenantAccessError('Accounts-payable access is not permitted.');
		}
	}

	private async requireMutation(
		actor: TenantActorContext,
		permissionKey: (typeof AP_MUTATION_PERMISSIONS)[keyof typeof AP_MUTATION_PERMISSIONS],
		db: DatabaseExecutor = this.db
	): Promise<void> {
		await this.assertActiveActor(actor, db);
		if (!(await this.decision(actor, permissionKey, db)).allowed) {
			throw new TenantAccessError('This accounts-payable action is not permitted.');
		}
	}

	private async requireDocument(
		actor: TenantActorContext,
		publicIdInput: string,
		db: DatabaseExecutor = this.db,
		forUpdate = false
	): Promise<AccountsPayableDocumentRecord> {
		const document = await new AccountsPayableRepository(db).findDocumentByPublicId(
			actor.organisationId,
			publicId(publicIdInput, 'Supplier document'),
			forUpdate
		);
		if (!document) throw new RecordNotFoundError('Supplier document not found.');
		return document;
	}

	private matchState(document: AccountsPayableDocumentRecord): AccountsPayableWorkspaceDocument['matchState'] {
		if (document.status === 'draft') return 'draft';
		if (document.status === 'exception') return 'exception';
		if (document.status === 'submitted' || document.status === 'matching') return 'awaiting_approval';
		if (document.status === 'approved') return 'approved';
		return 'closed';
	}

	async getWorkspace(actor: TenantActorContext): Promise<AccountsPayableWorkspace> {
		await this.requireView(actor);
		const repository = new AccountsPayableRepository(this.db);
		const procurement = new ProcurementRepository(this.db);
		const [documents, suppliers, purchaseOrders, taxCategories, canCreate, canSubmit, canMatch, canResolve, canApprove, canVoid] =
			await Promise.all([
				repository.listDocuments(actor.organisationId),
				procurement.listEligibleSuppliers(actor.organisationId),
				repository.listIssuedPurchaseOrders(actor.organisationId),
				repository.listActiveTaxCategories(actor.organisationId),
				this.decision(actor, AP_MUTATION_PERMISSIONS.create),
				this.decision(actor, AP_MUTATION_PERMISSIONS.submit),
				this.decision(actor, AP_MUTATION_PERMISSIONS.match),
				this.decision(actor, AP_MUTATION_PERMISSIONS.resolve),
				this.decision(actor, AP_MUTATION_PERMISSIONS.approve),
				this.decision(actor, AP_MUTATION_PERMISSIONS.void)
			]);
		const orderWorkspaces = [];
		for (const order of purchaseOrders) {
			orderWorkspaces.push({
				...order,
				items: await repository.listPurchaseOrderItems(actor.organisationId, order.versionId)
			});
		}
		const workspaceDocuments: AccountsPayableWorkspaceDocument[] = [];
		for (const document of documents) {
			workspaceDocuments.push({
				...document,
				items: await repository.listDocumentItems(actor.organisationId, document.id),
				exceptions: await repository.listExceptions(actor.organisationId, document.id),
				matchState: this.matchState(document)
			});
		}
		return {
			documents: workspaceDocuments,
			suppliers,
			purchaseOrders: orderWorkspaces,
			taxCategories,
			canCreate: canCreate.allowed,
			canSubmit: canSubmit.allowed,
			canMatch: canMatch.allowed,
			canResolveExceptions: canResolve.allowed,
			canApprove: canApprove.allowed,
			canVoid: canVoid.allowed
		};
	}

	async createSupplierDocument(
		actor: TenantActorContext,
		input: CreateAccountsPayableDocumentInput
	): Promise<string> {
		const type = documentType(input.documentType);
		const supplierPublicId = publicId(input.supplierPublicId, 'Supplier');
		const purchaseOrderPublicId = input.purchaseOrderPublicId?.trim()
			? publicId(input.purchaseOrderPublicId, 'Purchase order')
			: null;
		const supplierDocumentNumber = cleanFinanceText(
			input.supplierDocumentNumber,
			160,
			'Supplier document number',
			true
		)!;
		const invoiceDate = validateFinanceDate(input.invoiceDate, 'Invoice date');
		if (!invoiceDate) throw new FinanceValidationError('Invoice date is required.');
		const taxDate = validateFinanceDate(input.taxDate, 'Tax date');
		const dueDate = validateFinanceDate(input.dueDate, 'Due date');
		const currencyCode = validateCurrencyCode(input.currencyCode);
		if (!currencyCode) throw new FinanceValidationError('Currency is required.');
		if (!Array.isArray(input.lines) || input.lines.length === 0)
			throw new FinanceValidationError('At least one supplier-document line is required.');
		if (input.lines.length > 200)
			throw new FinanceValidationError('A supplier document cannot contain more than 200 lines.');

		try {
			return await this.db.transaction().execute(async (trx) => {
				const membership = await this.assertActiveActor(actor, trx);
				await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.create, trx);
				const procurement = new ProcurementRepository(trx);
				const repository = new AccountsPayableRepository(trx);
				const supplier = await procurement.findEligibleSupplierByPublicId(
					actor.organisationId,
					supplierPublicId
				);
				if (!supplier) throw new FinanceValidationError('The selected CRM organisation is not an active supplier.');

				let purchaseOrder: IssuedPurchaseOrder | null = null;
				let purchaseOrderItems: PurchaseOrderItemForMatching[] = [];
				if (purchaseOrderPublicId) {
					purchaseOrder = await repository.findIssuedPurchaseOrderByPublicId(
						actor.organisationId,
						purchaseOrderPublicId
					);
					if (!purchaseOrder)
						throw new FinanceValidationError('The selected purchase order is not an active issued order.');
					if (purchaseOrder.supplierPartyId !== supplier.id)
						throw new FinanceValidationError('Supplier invoice and purchase-order supplier do not match.');
					if (purchaseOrder.currencyCode !== currencyCode)
						throw new FinanceValidationError('Supplier invoice and purchase-order currencies do not match.');
					purchaseOrderItems = await repository.listPurchaseOrderItems(
						actor.organisationId,
						purchaseOrder.versionId
					);
				}

				const preparedLines: Array<{
					description: string;
					quantity: string;
					unitRate: string;
					purchaseOrderItem: PurchaseOrderItemForMatching | null;
					taxCategoryId: string | null;
					taxRate: string | null;
					netAmount: string;
					taxAmount: string;
					grossAmount: string;
				}> = [];
				for (const line of input.lines) {
					const description = cleanFinanceText(line.description, 10_000, 'Line description', true)!;
					const quantity = validateQuantity(line.quantity);
					const unitRate = validateUnitRate(line.unitRate);
					const poLineNumber = positiveLineNumber(line.purchaseOrderLineNumber);
					let purchaseOrderItem: PurchaseOrderItemForMatching | null = null;
					if (purchaseOrder) {
						if (!poLineNumber)
							throw new FinanceValidationError('A purchase-order line is required for every PO-backed invoice line.');
						purchaseOrderItem = purchaseOrderItems.find((row) => row.lineNumber === poLineNumber) ?? null;
						if (!purchaseOrderItem)
							throw new FinanceValidationError(`Purchase-order line ${poLineNumber} is unavailable.`);
					} else if (poLineNumber) {
						throw new FinanceValidationError('A purchase-order line cannot be used without a purchase order.');
					}
					const netAmount = lineAmount(quantity, unitRate);
					let taxCategoryId: string | null = null;
					let taxRate: string | null = null;
					let taxAmount = '0.0000';
					if (line.taxCategoryPublicId?.trim()) {
						const category = await repository.findTaxCategoryForDate(
							actor.organisationId,
							publicId(line.taxCategoryPublicId, 'Tax category'),
							taxDate ?? invoiceDate
						);
						if (!category) throw new FinanceValidationError('The selected tax category is unavailable.');
						taxCategoryId = category.id;
						if (category.treatment === 'taxable' && category.ratePercent === null)
							throw new FinanceValidationError(`Tax category ${category.name} has no effective rate.`);
						taxRate = category.ratePercent ?? '0.0000';
						taxAmount = percentageAmount(netAmount, taxRate);
					}
					preparedLines.push({
						description,
						quantity,
						unitRate,
						purchaseOrderItem,
						taxCategoryId,
						taxRate,
						netAmount,
						taxAmount,
						grossAmount: addMoney(netAmount, taxAmount)
					});
				}

				const netAmount = sumMoney(preparedLines.map((line) => line.netAmount));
				const taxAmount = sumMoney(preparedLines.map((line) => line.taxAmount));
				const grossAmount = addMoney(netAmount, taxAmount);
				const documentPublicId = this.publicIdFactory();
				const documentId = await repository.insertDocument({
					organisationId: actor.organisationId,
					publicId: documentPublicId,
					documentType: type,
					supplierPartyId: supplier.id,
					projectId: purchaseOrder?.projectId ?? null,
					purchaseOrderId: purchaseOrder?.id ?? null,
					supplierDocumentNumber,
					invoiceDate,
					taxDate,
					dueDate,
					currencyCode,
					netAmount,
					taxAmount,
					grossAmount,
					createdByMemberId: membership.id
				});
				for (const [index, line] of preparedLines.entries()) {
					const itemId = await repository.insertDocumentItem({
						organisationId: actor.organisationId,
						documentId,
						purchaseOrderItemId: line.purchaseOrderItem?.id ?? null,
						unitOfMeasureId: line.purchaseOrderItem?.unitOfMeasureId ?? null,
						lineNumber: index + 1,
						description: line.description,
						quantity: line.quantity,
						unitRate: line.unitRate,
						netAmount: line.netAmount,
						taxAmount: line.taxAmount,
						grossAmount: line.grossAmount
					});
					if (line.taxCategoryId && line.taxRate !== null) {
						await repository.insertDocumentItemTax({
							organisationId: actor.organisationId,
							documentItemId: itemId,
							taxCategoryId: line.taxCategoryId,
							ratePercent: line.taxRate,
							taxableAmount: line.netAmount,
							taxAmount: line.taxAmount
						});
					}
				}
				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: membership.id,
					projectId: purchaseOrder?.projectId ?? null,
					actionKey: 'finance.ap.document.created',
					subjectType: 'accounts_payable_document',
					subjectPublicId: documentPublicId,
					correlationId: actor.correlationId,
					changeSummary: {
						documentType: type,
						supplierPublicId,
						purchaseOrderPublicId,
						supplierDocumentNumber,
						grossAmount,
						lineCount: preparedLines.length
					}
				});
				return documentPublicId;
			});
		} catch (cause) {
			if (isDuplicateKeyError(cause)) {
				throw new FinanceValidationError('This supplier document number is already recorded for the supplier.');
			}
			throw cause;
		}
	}

	private async supplierSnapshot(
		db: DatabaseExecutor,
		organisationId: string,
		supplierPartyId: string
	) {
		const procurement = new ProcurementRepository(db);
		const supplierRows = await procurement.listEligibleSuppliers(organisationId);
		const supplier = supplierRows.find((row) => row.id === supplierPartyId);
		if (!supplier) throw new FinanceValidationError('The supplier is no longer active.');
		const address = await procurement.findPrimarySupplierAddress(organisationId, supplierPartyId);
		return { supplier, address };
	}

	private async ensureException(
		repository: AccountsPayableRepository,
		actor: TenantActorContext,
		memberId: string,
		documentId: string,
		documentItemId: string | null,
		code: string,
		message: string
	): Promise<void> {
		const existing = (await repository.listExceptions(actor.organisationId, documentId)).find(
			(row) => row.status === 'open' && row.code === code && row.documentItemId === documentItemId
		);
		if (existing) return;
		await repository.insertException({
			organisationId: actor.organisationId,
			publicId: this.publicIdFactory(),
			documentId,
			documentItemId,
			code,
			message,
			createdByMemberId: memberId
		});
	}

	private async closeAutomaticMatchExceptions(
		repository: AccountsPayableRepository,
		actor: TenantActorContext,
		memberId: string,
		documentId: string
	): Promise<void> {
		const open = await repository.listExceptions(actor.organisationId, documentId);
		for (const exception of open) {
			if (exception.status !== 'open' || !AUTOMATIC_MATCH_EXCEPTION_CODES.has(exception.code)) continue;
			await repository.resolveException({
				organisationId: actor.organisationId,
				exceptionId: exception.id,
				memberId,
				status: 'resolved',
				note: 'Resolved by a subsequent three-way-match evaluation.',
				now: this.now()
			});
		}
	}

	private async matchDocumentInTransaction(
		trx: DatabaseExecutor,
		actor: TenantActorContext,
		membershipId: string,
		document: AccountsPayableDocumentRecord
	): Promise<{ matched: boolean; openBlockingExceptions: number }> {
		const repository = new AccountsPayableRepository(trx);
		await this.closeAutomaticMatchExceptions(repository, actor, membershipId, document.id);
		const items = await repository.listDocumentItems(actor.organisationId, document.id);
		if (!document.purchaseOrderId || !document.purchaseOrderPublicId) {
			await this.ensureException(
				repository,
				actor,
				membershipId,
				document.id,
				null,
				'NON_PO_REQUIRES_APPROVAL',
				'No purchase order is linked. An authorised exception decision is required before approval.'
			);
			return { matched: false, openBlockingExceptions: await repository.countOpenBlockingExceptions(actor.organisationId, document.id) };
		}
		const purchaseOrder = await repository.findIssuedPurchaseOrderByPublicId(
			actor.organisationId,
			document.purchaseOrderPublicId
		);
		if (!purchaseOrder || purchaseOrder.id !== document.purchaseOrderId)
			throw new FinanceValidationError('The linked purchase order is no longer an active issued order.');
		if (purchaseOrder.supplierPartyId !== document.supplierPartyId)
			throw new FinanceValidationError('The supplier document no longer matches the purchase-order supplier.');
		if (purchaseOrder.currencyCode !== document.currencyCode)
			throw new FinanceValidationError('The supplier document no longer matches the purchase-order currency.');
		const poItems = await repository.listPurchaseOrderItems(actor.organisationId, purchaseOrder.versionId);

		for (const item of items) {
			if (!item.purchaseOrderItemId) {
				await this.ensureException(
					repository,
					actor,
					membershipId,
					document.id,
					item.id,
					'MISSING_PO_LINE',
					`Invoice line ${item.lineNumber} is not linked to an issued purchase-order line.`
				);
				continue;
			}
			const poItem = poItems.find((row) => row.id === item.purchaseOrderItemId);
			if (!poItem) {
				await this.ensureException(
					repository,
					actor,
					membershipId,
					document.id,
					item.id,
					'MISSING_PO_LINE',
					`Invoice line ${item.lineNumber} is not linked to the current issued purchase-order version.`
				);
				continue;
			}
			const existingForDocumentItem = await repository.listAllocationsForDocumentItem(
				actor.organisationId,
				item.id
			);
			const alreadyAllocatedOnDocument = formatScaledDecimal(
				existingForDocumentItem.reduce(
					(total, row) => total + parseScaledDecimal(row.matchedQuantity, 6, 'Matched quantity'),
					0n
				),
				6
			);
			const quantityStillToMatch = subtractQuantity(item.quantity, alreadyAllocatedOnDocument);
			if (parseScaledDecimal(quantityStillToMatch, 6, 'Quantity remaining', true) <= 0n) continue;

			const allPoAllocations = await repository.listActiveAllocationsForPurchaseOrderItem(
				actor.organisationId,
				poItem.id
			);
			const allocatedOnOtherDocuments = formatScaledDecimal(
				allPoAllocations
					.filter((row) => row.documentItemId !== item.id)
					.reduce(
						(total, row) => total + parseScaledDecimal(row.matchedQuantity, 6, 'Matched quantity'),
						0n
					),
				6
			);
			const orderedRemaining = subtractQuantity(poItem.quantity, allocatedOnOtherDocuments);
			if (
				parseScaledDecimal(item.quantity, 6, 'Invoice quantity') >
				parseScaledDecimal(orderedRemaining, 6, 'Remaining ordered quantity', true)
			) {
				await this.ensureException(
					repository,
					actor,
					membershipId,
					document.id,
					item.id,
					'ORDER_QUANTITY_EXCEEDED',
					`Invoice line ${item.lineNumber} exceeds the remaining ordered quantity (${orderedRemaining}).`
				);
				continue;
			}

			if (item.unitRate !== poItem.unitRate) {
				await this.ensureException(
					repository,
					actor,
					membershipId,
					document.id,
					item.id,
					'UNIT_RATE_MISMATCH',
					`Invoice line ${item.lineNumber} unit rate ${item.unitRate} differs from PO rate ${poItem.unitRate}.`
				);
			}

			const receipts = await repository.listReceiptItemsForPurchaseOrderItem(
				actor.organisationId,
				poItem.id
			);
			let availableReceiptQuantity = 0n;
			const receiptAvailability: Array<{ id: string; available: string }> = [];
			for (const receipt of receipts) {
				const accepted =
					parseScaledDecimal(receipt.quantityReceived, 6, 'Received quantity') -
					parseScaledDecimal(receipt.quantityRejected, 6, 'Rejected quantity');
				const alreadyAllocated = allPoAllocations
					.filter((row) => row.receiptItemId === receipt.id)
					.reduce(
						(total, row) => total + parseScaledDecimal(row.matchedQuantity, 6, 'Matched quantity'),
						0n
					);
				const available = accepted - alreadyAllocated;
				if (available <= 0n) continue;
				availableReceiptQuantity += available;
				receiptAvailability.push({ id: receipt.id, available: formatScaledDecimal(available, 6) });
			}
			if (availableReceiptQuantity < parseScaledDecimal(quantityStillToMatch, 6, 'Quantity to match')) {
				await this.ensureException(
					repository,
					actor,
					membershipId,
					document.id,
					item.id,
					'INSUFFICIENT_RECEIPT',
					`Invoice line ${item.lineNumber} has ${formatScaledDecimal(availableReceiptQuantity, 6)} accepted quantity available to match against ${quantityStillToMatch}.`
				);
				continue;
			}

			let remaining = quantityStillToMatch;
			for (const receipt of receiptAvailability) {
				if (parseScaledDecimal(remaining, 6, 'Remaining quantity', true) <= 0n) break;
				const allocatedQuantity = minimumQuantity(remaining, receipt.available);
				await repository.insertMatchAllocation({
					organisationId: actor.organisationId,
					documentItemId: item.id,
					purchaseOrderItemId: poItem.id,
					receiptItemId: receipt.id,
					matchedQuantity: allocatedQuantity,
					matchedNetAmount: lineAmount(allocatedQuantity, item.unitRate),
					matchedByMemberId: membershipId
				});
				remaining = subtractQuantity(remaining, allocatedQuantity);
			}
		}
		const openBlockingExceptions = await repository.countOpenBlockingExceptions(
			actor.organisationId,
			document.id
		);
		return { matched: openBlockingExceptions === 0, openBlockingExceptions };
	}

	async submitDocument(actor: TenantActorContext, documentPublicId: string): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.submit, trx);
			const repository = new AccountsPayableRepository(trx);
			const document = await this.requireDocument(actor, documentPublicId, trx, true);
			if (document.status !== 'draft')
				throw new FinanceValidationError('Only a draft supplier document can be submitted.');
			const snapshot = await this.supplierSnapshot(trx, actor.organisationId, document.supplierPartyId);
			await repository.insertSupplierSnapshot({
				organisationId: actor.organisationId,
				documentId: document.id,
				supplierPartyId: document.supplierPartyId,
				displayName: snapshot.supplier.displayName,
				email: snapshot.supplier.primaryEmail,
				address: snapshot.address
					? {
							line1: snapshot.address.line1,
							line2: snapshot.address.line2,
							line3: snapshot.address.line3,
							locality: snapshot.address.locality,
							city: snapshot.address.city,
							region: snapshot.address.region,
							postalCode: snapshot.address.postalCode,
							countryCode: snapshot.address.countryCode
						}
					: null
			});
			if (
				(await repository.setDocumentStatus({
					organisationId: actor.organisationId,
					documentId: document.id,
					fromStatuses: ['draft'],
					status: 'matching',
					submittedAt: this.now()
				})) !== 1
			)
				throw new FinanceValidationError('The supplier document changed before submission.');
			const matchingDocument = { ...document, status: 'matching', submittedAt: this.now() };
			const result = await this.matchDocumentInTransaction(trx, actor, membership.id, matchingDocument);
			await repository.setDocumentStatus({
				organisationId: actor.organisationId,
				documentId: document.id,
				fromStatuses: ['matching'],
				status: result.openBlockingExceptions === 0 ? 'submitted' : 'exception'
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: document.projectId,
				actionKey: 'finance.ap.document.submitted',
				subjectType: 'accounts_payable_document',
				subjectPublicId: document.publicId,
				correlationId: actor.correlationId,
				changeSummary: { matched: result.matched, openBlockingExceptions: result.openBlockingExceptions }
			});
		});
	}

	async retryMatch(actor: TenantActorContext, documentPublicId: string): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.match, trx);
			const repository = new AccountsPayableRepository(trx);
			const document = await this.requireDocument(actor, documentPublicId, trx, true);
			if (document.status !== 'submitted' && document.status !== 'exception')
				throw new FinanceValidationError('Only a submitted or exception supplier document can be matched.');
			const result = await this.matchDocumentInTransaction(trx, actor, membership.id, document);
			await repository.setDocumentStatus({
				organisationId: actor.organisationId,
				documentId: document.id,
				fromStatuses: ['submitted', 'exception'],
				status: result.openBlockingExceptions === 0 ? 'submitted' : 'exception'
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: document.projectId,
				actionKey: 'finance.ap.document.match_evaluated',
				subjectType: 'accounts_payable_document',
				subjectPublicId: document.publicId,
				correlationId: actor.correlationId,
				changeSummary: result
			});
		});
	}

	async resolveException(
		actor: TenantActorContext,
		exceptionPublicIdInput: string,
		input: { note: string; waive?: boolean }
	): Promise<void> {
		const exceptionPublicId = publicId(exceptionPublicIdInput, 'Exception');
		const note = cleanFinanceText(input.note, 1000, 'Resolution note', true)!;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.resolve, trx);
			const repository = new AccountsPayableRepository(trx);
			const exception = await repository.findExceptionByPublicId(actor.organisationId, exceptionPublicId, true);
			if (!exception) throw new RecordNotFoundError('Accounts-payable exception not found.');
			if (exception.status !== 'open') throw new FinanceValidationError('Only an open exception can be resolved.');
			const status = input.waive ? 'waived' : 'resolved';
			if (
				(await repository.resolveException({
					organisationId: actor.organisationId,
					exceptionId: exception.id,
					memberId: membership.id,
					status,
					note,
					now: this.now()
				})) !== 1
			)
				throw new FinanceValidationError('The exception changed before it could be resolved.');
			if ((await repository.countOpenBlockingExceptions(actor.organisationId, exception.documentId)) === 0) {
				await repository.setDocumentStatus({
					organisationId: actor.organisationId,
					documentId: exception.documentId,
					fromStatuses: ['exception'],
					status: 'submitted'
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: input.waive ? 'finance.ap.exception.waived' : 'finance.ap.exception.resolved',
				subjectType: 'accounts_payable_exception',
				subjectPublicId: exception.publicId,
				correlationId: actor.correlationId,
				changeSummary: { code: exception.code, note }
			});
		});
	}

	async approveDocument(
		actor: TenantActorContext,
		documentPublicId: string,
		noteInput?: string | null
	): Promise<void> {
		const note = cleanFinanceText(noteInput, 1000, 'Approval note');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.approve, trx);
			const repository = new AccountsPayableRepository(trx);
			const document = await this.requireDocument(actor, documentPublicId, trx, true);
			if (document.status !== 'submitted')
				throw new FinanceValidationError('Only a fully matched or authorised supplier document can be approved.');
			if (document.createdByMemberId === membership.id)
				throw new TenantAccessError('Maker/checker control prevents the document creator from approving it.');
			if ((await repository.countOpenBlockingExceptions(actor.organisationId, document.id)) !== 0)
				throw new FinanceValidationError('Open blocking exceptions must be resolved before approval.');
			const items = await repository.listDocumentItems(actor.organisationId, document.id);
			if (document.purchaseOrderId) {
				for (const item of items) {
					const allocations = await repository.listAllocationsForDocumentItem(actor.organisationId, item.id);
					const allocated = allocations.reduce(
						(total, row) => total + parseScaledDecimal(row.matchedQuantity, 6, 'Matched quantity'),
						0n
					);
					if (allocated !== parseScaledDecimal(item.quantity, 6, 'Invoice quantity')) {
						throw new FinanceValidationError(`Invoice line ${item.lineNumber} is not fully matched to receipt evidence.`);
					}
				}
			}
			await repository.insertApprovalEvent({
				organisationId: actor.organisationId,
				publicId: this.publicIdFactory(),
				documentId: document.id,
				decision: 'approved',
				memberId: membership.id,
				note
			});
			if (
				(await repository.setDocumentStatus({
					organisationId: actor.organisationId,
					documentId: document.id,
					fromStatuses: ['submitted'],
					status: 'approved',
					approvedAt: this.now()
				})) !== 1
			)
				throw new FinanceValidationError('The supplier document changed before approval.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: document.projectId,
				actionKey: 'finance.ap.document.approved',
				subjectType: 'accounts_payable_document',
				subjectPublicId: document.publicId,
				correlationId: actor.correlationId,
				changeSummary: { grossAmount: document.grossAmount, note }
			});
		});
	}

	async voidDocument(actor: TenantActorContext, documentPublicId: string): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, AP_MUTATION_PERMISSIONS.void, trx);
			const repository = new AccountsPayableRepository(trx);
			const document = await this.requireDocument(actor, documentPublicId, trx, true);
			if (!['draft', 'submitted', 'exception'].includes(document.status))
				throw new FinanceValidationError('Only an unapproved supplier document can be voided.');
			if (
				(await repository.setDocumentStatus({
					organisationId: actor.organisationId,
					documentId: document.id,
					fromStatuses: ['draft', 'submitted', 'exception'],
					status: 'void'
				})) !== 1
			)
				throw new FinanceValidationError('The supplier document changed before it could be voided.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: document.projectId,
				actionKey: 'finance.ap.document.voided',
				subjectType: 'accounts_payable_document',
				subjectPublicId: document.publicId,
				correlationId: actor.correlationId,
				changeSummary: { previousStatus: document.status }
			});
		});
	}
}
