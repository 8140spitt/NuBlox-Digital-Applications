import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	FinanceValidationError,
	cleanFinanceText,
	formatDateOnly,
	insertedId,
	validateFinanceDate,
	validateMoneyAmount
} from './finance-common';

const SUPPLIER_PAYMENT_PERMISSIONS = {
	create: 'finance.ap.payment.create',
	approve: 'finance.ap.payment.approve',
	execute: 'finance.ap.payment.execute',
	cancel: 'finance.ap.payment.cancel',
	reverse: 'finance.ap.payment.reverse'
} as const;

export type SupplierPaymentLifecycleStatus =
	| 'pending_approval'
	| 'approved'
	| 'executed'
	| 'cancelled';

export type SupplierPaymentAllocationInput = {
	documentPublicId: string;
	amount: string;
};

export type CreateSupplierPaymentInput = {
	paymentMethodCode: string;
	requestedPaymentDate: string;
	paymentReference?: string | null;
	allocations: SupplierPaymentAllocationInput[];
};

export type SupplierPaymentEligibleInvoice = {
	publicId: string;
	supplierPublicId: string;
	supplierName: string;
	supplierDocumentNumber: string;
	currencyCode: string;
	dueDate: string | null;
	grossAmount: string;
	reservedAmount: string;
	openAmount: string;
};

export type SupplierPaymentWorkspacePayment = {
	publicId: string;
	supplierPublicId: string;
	paymentMethodCode: string;
	paymentMethodName: string;
	currencyCode: string;
	requestedPaymentDate: string;
	paymentReference: string | null;
	paymentAmount: string;
	status: SupplierPaymentLifecycleStatus;
	createdByMemberId: string;
	approvedByMemberId: string | null;
	approvedAt: Date | null;
	executedByMemberId: string | null;
	executedAt: Date | null;
	cancelledByMemberId: string | null;
	cancelledAt: Date | null;
	cancellationReason: string | null;
	reversalPublicId: string | null;
	reversalReason: string | null;
	reversedAt: Date | null;
	allocations: Array<{
		documentPublicId: string;
		supplierDocumentNumber: string;
		supplierName: string;
		allocatedAmount: string;
	}>;
};

export type SupplierPaymentWorkspace = {
	paymentMethods: Array<{ code: string; name: string }>;
	eligibleInvoices: SupplierPaymentEligibleInvoice[];
	payments: SupplierPaymentWorkspacePayment[];
	canCreate: boolean;
	canApprove: boolean;
	canExecute: boolean;
	canCancel: boolean;
	canReverse: boolean;
};

type SupplierPaymentRecord = {
	id: string;
	publicId: string;
	supplierPartyId: string;
	currencyCode: string;
	paymentAmount: string;
	paymentReference: string | null;
	status: string;
	createdByMemberId: string;
	approvedByMemberId: string | null;
	approvedAt: Date | null;
	executedByMemberId: string | null;
	executedAt: Date | null;
};

function checkedPublicId(value: string, label: string): string {
	const text = value.trim();
	if (!/^[0-9a-f-]{36}$/i.test(text)) throw new FinanceValidationError(`${label} is invalid.`);
	return text;
}

function checkedPaymentMethodCode(value: string): string {
	const code = value.trim().toLowerCase();
	if (!/^[a-z0-9_]{1,64}$/.test(code)) {
		throw new FinanceValidationError('Payment method is invalid.');
	}
	return code;
}

function addMoney(total: bigint, amount: string, label = 'Amount'): bigint {
	return total + parseScaledDecimal(amount, 4, label, true);
}

function subtractMoney(left: string, right: string): string {
	return formatScaledDecimal(
		parseScaledDecimal(left, 4, 'Gross amount', true) -
			parseScaledDecimal(right, 4, 'Reserved amount', true),
		4
	);
}

function lifecycleStatus(value: string): SupplierPaymentLifecycleStatus {
	if (
		value === 'pending_approval' ||
		value === 'approved' ||
		value === 'executed' ||
		value === 'cancelled'
	) {
		return value;
	}
	throw new Error(`Unexpected supplier-payment lifecycle status: ${value}`);
}

export class SupplierPaymentService {
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

	private async decision(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor = this.db
	) {
		return new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'finance.manage');
	}

	private async requireView(actor: TenantActorContext, db: DatabaseExecutor = this.db): Promise<void> {
		await this.assertActiveActor(actor, db);
		if (!(await this.decision(actor, 'finance.ap.view', db)).allowed) {
			throw new TenantAccessError('Supplier-payment access is not permitted.');
		}
	}

	private async requireMutation(
		actor: TenantActorContext,
		permissionKey: (typeof SUPPLIER_PAYMENT_PERMISSIONS)[keyof typeof SUPPLIER_PAYMENT_PERMISSIONS],
		db: DatabaseExecutor = this.db
	): Promise<void> {
		await this.assertActiveActor(actor, db);
		if (!(await this.decision(actor, permissionKey, db)).allowed) {
			throw new TenantAccessError('This supplier-payment action is not permitted.');
		}
	}

	private async requirePayment(
		actor: TenantActorContext,
		paymentPublicIdInput: string,
		db: DatabaseExecutor = this.db,
		forUpdate = false
	): Promise<SupplierPaymentRecord> {
		let query = db
			.selectFrom('accounts_payable_supplier_payments')
			.select([
				'id',
				'public_id as publicId',
				'supplier_party_id as supplierPartyId',
				'currency_code as currencyCode',
				'payment_amount as paymentAmount',
				'payment_reference as paymentReference',
				'lifecycle_status as status',
				'created_by_member_id as createdByMemberId',
				'approved_by_member_id as approvedByMemberId',
				'approved_at as approvedAt',
				'executed_by_member_id as executedByMemberId',
				'executed_at as executedAt'
			])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', checkedPublicId(paymentPublicIdInput, 'Supplier payment'));
		if (forUpdate) query = query.forUpdate();
		const payment = await query.executeTakeFirst();
		if (!payment) throw new RecordNotFoundError('Supplier payment not found.');
		return payment;
	}

	private async hasActiveApJournal(
		db: DatabaseExecutor,
		organisationId: string,
		documentPublicId: string
	): Promise<boolean> {
		const row = await db
			.selectFrom('accounting_journal_entries as journal')
			.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
				join
					.onRef('reversal.journal_entry_id', '=', 'journal.id')
					.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
			)
			.select('journal.id')
			.where('journal.organisation_id', '=', organisationId)
			.where('journal.source_type', '=', 'accounts_payable_invoice_approval')
			.where('journal.source_public_id', '=', documentPublicId)
			.where('reversal.journal_entry_id', 'is', null)
			.executeTakeFirst();
		return Boolean(row);
	}

	private async reservedAmount(
		db: DatabaseExecutor,
		organisationId: string,
		documentId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('accounts_payable_supplier_payment_allocations as allocation')
			.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
				join
					.onRef('payment.id', '=', 'allocation.supplier_payment_id')
					.onRef('payment.organisation_id', '=', 'allocation.organisation_id')
			)
			.leftJoin('accounts_payable_supplier_payment_reversals as reversal', (join) =>
				join
					.onRef('reversal.supplier_payment_id', '=', 'payment.id')
					.onRef('reversal.organisation_id', '=', 'payment.organisation_id')
			)
			.select([
				'allocation.allocated_amount as allocatedAmount',
				'payment.lifecycle_status as paymentStatus',
				'reversal.id as reversalId'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.accounts_payable_document_id', '=', documentId)
			.where('payment.lifecycle_status', 'in', ['pending_approval', 'approved', 'executed'])
			.execute();
		let total = 0n;
		for (const row of rows) {
			if (row.paymentStatus === 'executed' && row.reversalId !== null) continue;
			total = addMoney(total, row.allocatedAmount, 'Allocated amount');
		}
		return formatScaledDecimal(total, 4);
	}

	private async listPaymentAllocations(
		db: DatabaseExecutor,
		organisationId: string,
		paymentId: string
	) {
		return db
			.selectFrom('accounts_payable_supplier_payment_allocations as allocation')
			.innerJoin('accounts_payable_documents as document', (join) =>
				join
					.onRef('document.id', '=', 'allocation.accounts_payable_document_id')
					.onRef('document.organisation_id', '=', 'allocation.organisation_id')
			)
			.select([
				'document.public_id as documentPublicId',
				'document.project_id as projectId',
				'allocation.allocated_amount as allocatedAmount'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.supplier_payment_id', '=', paymentId)
			.orderBy('allocation.id')
			.execute();
	}

	async getWorkspace(actor: TenantActorContext): Promise<SupplierPaymentWorkspace> {
		await this.requireView(actor);
		const [paymentMethods, invoiceRows, paymentRows, canCreate, canApprove, canExecute, canCancel, canReverse] =
			await Promise.all([
				this.db
					.selectFrom('payment_methods')
					.select(['code', 'name'])
					.where('is_active', '=', 1)
					.orderBy('name')
					.execute(),
				this.db
					.selectFrom('accounts_payable_documents as document')
					.innerJoin('accounts_payable_supplier_snapshots as supplier', (join) =>
						join
							.onRef('supplier.accounts_payable_document_id', '=', 'document.id')
							.onRef('supplier.organisation_id', '=', 'document.organisation_id')
					)
					.leftJoin('accounts_payable_supplier_payment_allocations as allocation', (join) =>
						join
							.onRef('allocation.accounts_payable_document_id', '=', 'document.id')
							.onRef('allocation.organisation_id', '=', 'document.organisation_id')
					)
					.leftJoin('accounts_payable_supplier_payments as payment', (join) =>
						join
							.onRef('payment.id', '=', 'allocation.supplier_payment_id')
							.onRef('payment.organisation_id', '=', 'allocation.organisation_id')
					)
					.leftJoin('accounts_payable_supplier_payment_reversals as payment_reversal', (join) =>
						join
							.onRef('payment_reversal.supplier_payment_id', '=', 'payment.id')
							.onRef('payment_reversal.organisation_id', '=', 'payment.organisation_id')
					)
					.select([
						'document.public_id as publicId',
						'document.supplier_party_id as supplierPartyId',
						'supplier.display_name as supplierName',
						'document.supplier_document_number as supplierDocumentNumber',
						'document.currency_code as currencyCode',
						'document.due_date as dueDate',
						'document.gross_amount as grossAmount',
						sql<string>`coalesce(sum(case
							when payment.lifecycle_status in ('pending_approval', 'approved', 'executed')
								and not (payment.lifecycle_status = 'executed' and payment_reversal.id is not null)
							then allocation.allocated_amount
							else 0
						end), 0)`.as('reservedAmount')
					])
					.where('document.organisation_id', '=', actor.organisationId)
					.where('document.document_type', '=', 'invoice')
					.where('document.lifecycle_status', '=', 'approved')
					.where(
						sql<boolean>`exists (
							select 1
							from accounting_journal_entries as journal
							left join accounting_journal_entry_reversals as journal_reversal
								on journal_reversal.journal_entry_id = journal.id
								and journal_reversal.organisation_id = journal.organisation_id
							where journal.organisation_id = ${actor.organisationId}
								and journal.source_type = 'accounts_payable_invoice_approval'
								and journal.source_public_id = document.public_id
								and journal_reversal.journal_entry_id is null
						)`
					)
					.groupBy([
						'document.id',
						'document.public_id',
						'document.supplier_party_id',
						'supplier.display_name',
						'document.supplier_document_number',
						'document.currency_code',
						'document.due_date',
						'document.gross_amount'
					])
					.orderBy('document.due_date', 'asc')
					.orderBy('document.id', 'asc')
					.limit(200)
					.execute(),
				this.db
					.selectFrom('accounts_payable_supplier_payments as payment')
					.innerJoin('payment_methods as method', 'method.id', 'payment.payment_method_id')
					.leftJoin('accounts_payable_supplier_payment_reversals as reversal', (join) =>
						join
							.onRef('reversal.supplier_payment_id', '=', 'payment.id')
							.onRef('reversal.organisation_id', '=', 'payment.organisation_id')
					)
					.select([
						'payment.id',
						'payment.public_id as publicId',
						'payment.supplier_party_id as supplierPartyId',
						'method.code as paymentMethodCode',
						'method.name as paymentMethodName',
						'payment.currency_code as currencyCode',
						'payment.requested_payment_date as requestedPaymentDate',
						'payment.payment_reference as paymentReference',
						'payment.payment_amount as paymentAmount',
						'payment.lifecycle_status as status',
						'payment.created_by_member_id as createdByMemberId',
						'payment.approved_by_member_id as approvedByMemberId',
						'payment.approved_at as approvedAt',
						'payment.executed_by_member_id as executedByMemberId',
						'payment.executed_at as executedAt',
						'payment.cancelled_by_member_id as cancelledByMemberId',
						'payment.cancelled_at as cancelledAt',
						'payment.cancellation_reason as cancellationReason',
						'reversal.public_id as reversalPublicId',
						'reversal.reason as reversalReason',
						'reversal.reversed_at as reversedAt'
					])
					.where('payment.organisation_id', '=', actor.organisationId)
					.orderBy('payment.created_at', 'desc')
					.limit(100)
					.execute(),
				this.decision(actor, SUPPLIER_PAYMENT_PERMISSIONS.create),
				this.decision(actor, SUPPLIER_PAYMENT_PERMISSIONS.approve),
				this.decision(actor, SUPPLIER_PAYMENT_PERMISSIONS.execute),
				this.decision(actor, SUPPLIER_PAYMENT_PERMISSIONS.cancel),
				this.decision(actor, SUPPLIER_PAYMENT_PERMISSIONS.reverse)
			]);

		const eligibleInvoices: SupplierPaymentEligibleInvoice[] = invoiceRows
			.map((row) => ({
				publicId: row.publicId,
				supplierPublicId: row.supplierPartyId,
				supplierName: row.supplierName,
				supplierDocumentNumber: row.supplierDocumentNumber,
				currencyCode: row.currencyCode,
				dueDate: row.dueDate ? formatDateOnly(row.dueDate) : null,
				grossAmount: row.grossAmount,
				reservedAmount: row.reservedAmount,
				openAmount: subtractMoney(row.grossAmount, row.reservedAmount)
			}))
			.filter((row) => parseScaledDecimal(row.openAmount, 4, 'Open amount', true) > 0n);

		const paymentIds = paymentRows.map((row) => row.id);
		const allocationRows =
			paymentIds.length === 0
				? []
				: await this.db
						.selectFrom('accounts_payable_supplier_payment_allocations as allocation')
						.innerJoin('accounts_payable_documents as document', (join) =>
							join
								.onRef('document.id', '=', 'allocation.accounts_payable_document_id')
								.onRef('document.organisation_id', '=', 'allocation.organisation_id')
						)
						.innerJoin('accounts_payable_supplier_snapshots as supplier', (join) =>
							join
								.onRef('supplier.accounts_payable_document_id', '=', 'document.id')
								.onRef('supplier.organisation_id', '=', 'document.organisation_id')
						)
						.select([
							'allocation.supplier_payment_id as paymentId',
							'document.public_id as documentPublicId',
							'document.supplier_document_number as supplierDocumentNumber',
							'supplier.display_name as supplierName',
							'allocation.allocated_amount as allocatedAmount'
						])
						.where('allocation.organisation_id', '=', actor.organisationId)
						.where('allocation.supplier_payment_id', 'in', paymentIds)
						.orderBy('allocation.id')
						.execute();

		return {
			paymentMethods,
			eligibleInvoices,
			payments: paymentRows.map((row) => ({
				publicId: row.publicId,
				supplierPublicId: row.supplierPartyId,
				paymentMethodCode: row.paymentMethodCode,
				paymentMethodName: row.paymentMethodName,
				currencyCode: row.currencyCode,
				requestedPaymentDate: formatDateOnly(row.requestedPaymentDate),
				paymentReference: row.paymentReference,
				paymentAmount: row.paymentAmount,
				status: lifecycleStatus(row.status),
				createdByMemberId: row.createdByMemberId,
				approvedByMemberId: row.approvedByMemberId,
				approvedAt: row.approvedAt,
				executedByMemberId: row.executedByMemberId,
				executedAt: row.executedAt,
				cancelledByMemberId: row.cancelledByMemberId,
				cancelledAt: row.cancelledAt,
				cancellationReason: row.cancellationReason,
				reversalPublicId: row.reversalPublicId,
				reversalReason: row.reversalReason,
				reversedAt: row.reversedAt,
				allocations: allocationRows
					.filter((allocation) => allocation.paymentId === row.id)
					.map((allocation) => ({
						documentPublicId: allocation.documentPublicId,
						supplierDocumentNumber: allocation.supplierDocumentNumber,
						supplierName: allocation.supplierName,
						allocatedAmount: allocation.allocatedAmount
					}))
			})),
			canCreate: canCreate.allowed,
			canApprove: canApprove.allowed,
			canExecute: canExecute.allowed,
			canCancel: canCancel.allowed,
			canReverse: canReverse.allowed
		};
	}

	async createPayment(actor: TenantActorContext, input: CreateSupplierPaymentInput): Promise<string> {
		const paymentMethodCode = checkedPaymentMethodCode(input.paymentMethodCode);
		const requestedPaymentDate = validateFinanceDate(input.requestedPaymentDate, 'Requested payment date');
		if (!requestedPaymentDate) throw new FinanceValidationError('Requested payment date is required.');
		const paymentReference = cleanFinanceText(input.paymentReference, 160, 'Payment reference');
		if (!Array.isArray(input.allocations) || input.allocations.length === 0) {
			throw new FinanceValidationError('At least one supplier invoice must be selected for payment.');
		}
		if (input.allocations.length > 100) {
			throw new FinanceValidationError('A supplier payment cannot contain more than 100 invoice allocations.');
		}
		const prepared = input.allocations
			.map((allocation) => ({
				documentPublicId: checkedPublicId(allocation.documentPublicId, 'Supplier invoice'),
				amount: validateMoneyAmount(allocation.amount, 'Payment allocation')
			}))
			.sort((left, right) => left.documentPublicId.localeCompare(right.documentPublicId));
		if (new Set(prepared.map((allocation) => allocation.documentPublicId)).size !== prepared.length) {
			throw new FinanceValidationError('A supplier invoice can only be allocated once per payment.');
		}

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, SUPPLIER_PAYMENT_PERMISSIONS.create, trx);
			const method = await trx
				.selectFrom('payment_methods')
				.select('id')
				.where('code', '=', paymentMethodCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!method) throw new FinanceValidationError('The selected payment method is unavailable.');

			let supplierPartyId: string | null = null;
			let currencyCode: string | null = null;
			let paymentAmount = 0n;
			const allocationRows: Array<{ documentId: string; documentPublicId: string; amount: string }> = [];
			for (const allocation of prepared) {
				const document = await trx
					.selectFrom('accounts_payable_documents')
					.select([
						'id',
						'public_id as publicId',
						'document_type as documentType',
						'supplier_party_id as supplierPartyId',
						'currency_code as currencyCode',
						'lifecycle_status as status',
						'gross_amount as grossAmount'
					])
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', allocation.documentPublicId)
					.forUpdate()
					.executeTakeFirst();
				if (!document || document.documentType !== 'invoice' || document.status !== 'approved') {
					throw new FinanceValidationError('Only approved supplier invoices can be paid.');
				}
				if (!(await this.hasActiveApJournal(trx, actor.organisationId, document.publicId))) {
					throw new FinanceValidationError(
						'Supplier invoice must have an active posted AP journal before payment can be requested.'
					);
				}
				if (supplierPartyId === null) supplierPartyId = document.supplierPartyId;
				if (currencyCode === null) currencyCode = document.currencyCode;
				if (supplierPartyId !== document.supplierPartyId) {
					throw new FinanceValidationError('A supplier payment cannot combine different suppliers.');
				}
				if (currencyCode !== document.currencyCode) {
					throw new FinanceValidationError('A supplier payment cannot combine different currencies.');
				}
				const reservedAmount = await this.reservedAmount(trx, actor.organisationId, document.id);
				const openAmount =
					parseScaledDecimal(document.grossAmount, 4, 'Supplier invoice total', true) -
					parseScaledDecimal(reservedAmount, 4, 'Reserved amount', true);
				const requestedAmount = parseScaledDecimal(allocation.amount, 4, 'Payment allocation', true);
				if (requestedAmount > openAmount) {
					throw new FinanceValidationError(
						`Payment allocation exceeds the supplier invoice open balance of ${formatScaledDecimal(openAmount, 4)}.`
					);
				}
				paymentAmount += requestedAmount;
				allocationRows.push({
					documentId: document.id,
					documentPublicId: document.publicId,
					amount: allocation.amount
				});
			}
			if (!supplierPartyId || !currencyCode || paymentAmount <= 0n) {
				throw new FinanceValidationError('Supplier payment is invalid.');
			}

			const paymentPublicId = this.publicIdFactory();
			const paymentInsert = await trx
				.insertInto('accounts_payable_supplier_payments')
				.values({
					organisation_id: actor.organisationId,
					public_id: paymentPublicId,
					supplier_party_id: supplierPartyId,
					payment_method_id: method.id,
					currency_code: currencyCode,
					requested_payment_date: requestedPaymentDate,
					payment_reference: paymentReference,
					payment_amount: formatScaledDecimal(paymentAmount, 4),
					lifecycle_status: 'pending_approval',
					created_by_member_id: membership.id
				})
				.executeTakeFirst();
			const paymentId = insertedId(paymentInsert);
			await trx
				.insertInto('accounts_payable_supplier_payment_allocations')
				.values(
					allocationRows.map((allocation) => ({
						organisation_id: actor.organisationId,
						supplier_payment_id: paymentId,
						accounts_payable_document_id: allocation.documentId,
						allocated_amount: allocation.amount
					}))
				)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.ap.supplier_payment.created',
				subjectType: 'accounts_payable_supplier_payment',
				subjectPublicId: paymentPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					paymentMethodCode,
					requestedPaymentDate: formatDateOnly(requestedPaymentDate),
					currencyCode,
					paymentAmount: formatScaledDecimal(paymentAmount, 4),
					allocations: allocationRows.map((allocation) => ({
						documentPublicId: allocation.documentPublicId,
						amount: allocation.amount
					}))
				}
			});
			return paymentPublicId;
		});
	}

	async approvePayment(actor: TenantActorContext, paymentPublicId: string): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, SUPPLIER_PAYMENT_PERMISSIONS.approve, trx);
			const payment = await this.requirePayment(actor, paymentPublicId, trx, true);
			if (payment.status !== 'pending_approval') {
				throw new FinanceValidationError('Only a pending supplier payment can be approved.');
			}
			if (payment.createdByMemberId === membership.id) {
				throw new FinanceValidationError('The supplier-payment maker cannot approve the same payment.');
			}
			const approvedAt = this.now();
			await trx
				.updateTable('accounts_payable_supplier_payments')
				.set({
					lifecycle_status: 'approved',
					approved_by_member_id: membership.id,
					approved_at: approvedAt
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', payment.id)
				.where('lifecycle_status', '=', 'pending_approval')
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.ap.supplier_payment.approved',
				subjectType: 'accounts_payable_supplier_payment',
				subjectPublicId: payment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { approvedAt: approvedAt.toISOString() }
			});
		});
	}

	async executePayment(
		actor: TenantActorContext,
		paymentPublicId: string,
		input: { paymentReference?: string | null } = {}
	): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, SUPPLIER_PAYMENT_PERMISSIONS.execute, trx);
			const payment = await this.requirePayment(actor, paymentPublicId, trx, true);
			if (payment.status !== 'approved') {
				throw new FinanceValidationError('Only an approved supplier payment can be executed.');
			}
			const paymentReference = cleanFinanceText(
				input.paymentReference ?? payment.paymentReference,
				160,
				'Payment reference',
				true
			)!;
			const allocations = await this.listPaymentAllocations(trx, actor.organisationId, payment.id);
			for (const allocation of allocations) {
				if (!(await this.hasActiveApJournal(trx, actor.organisationId, allocation.documentPublicId))) {
					throw new FinanceValidationError(
						'An allocated supplier invoice no longer has an active AP journal; payment execution is blocked.'
					);
				}
			}
			const executedAt = this.now();
			await trx
				.updateTable('accounts_payable_supplier_payments')
				.set({
					lifecycle_status: 'executed',
					payment_reference: paymentReference,
					executed_by_member_id: membership.id,
					executed_at: executedAt
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', payment.id)
				.where('lifecycle_status', '=', 'approved')
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.ap.supplier_payment.executed',
				subjectType: 'accounts_payable_supplier_payment',
				subjectPublicId: payment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { paymentReference, executedAt: executedAt.toISOString() }
			});
		});
	}

	async cancelPayment(
		actor: TenantActorContext,
		paymentPublicId: string,
		input: { reason: string }
	): Promise<void> {
		const reason = cleanFinanceText(input.reason, 1000, 'Cancellation reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, SUPPLIER_PAYMENT_PERMISSIONS.cancel, trx);
			const payment = await this.requirePayment(actor, paymentPublicId, trx, true);
			if (payment.status !== 'pending_approval' && payment.status !== 'approved') {
				throw new FinanceValidationError('Only an unexecuted supplier payment can be cancelled.');
			}
			const cancelledAt = this.now();
			await trx
				.updateTable('accounts_payable_supplier_payments')
				.set({
					lifecycle_status: 'cancelled',
					cancelled_by_member_id: membership.id,
					cancellation_reason: reason,
					cancelled_at: cancelledAt
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', payment.id)
				.where('lifecycle_status', 'in', ['pending_approval', 'approved'])
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.ap.supplier_payment.cancelled',
				subjectType: 'accounts_payable_supplier_payment',
				subjectPublicId: payment.publicId,
				correlationId: actor.correlationId,
				changeSummary: { reason, cancelledAt: cancelledAt.toISOString() }
			});
		});
	}

	async reversePayment(
		actor: TenantActorContext,
		paymentPublicId: string,
		input: { reason: string }
	): Promise<string> {
		const reason = cleanFinanceText(input.reason, 1000, 'Reversal reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.requireMutation(actor, SUPPLIER_PAYMENT_PERMISSIONS.reverse, trx);
			const payment = await this.requirePayment(actor, paymentPublicId, trx, true);
			if (payment.status !== 'executed' || !payment.executedAt) {
				throw new FinanceValidationError('Only an executed supplier payment can be reversed.');
			}
			const existing = await trx
				.selectFrom('accounts_payable_supplier_payment_reversals')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.where('supplier_payment_id', '=', payment.id)
				.executeTakeFirst();
			if (existing) throw new FinanceValidationError('Supplier payment has already been reversed.');
			const reversalPublicId = this.publicIdFactory();
			const reversedAt = this.now();
			await trx
				.insertInto('accounts_payable_supplier_payment_reversals')
				.values({
					organisation_id: actor.organisationId,
					public_id: reversalPublicId,
					supplier_payment_id: payment.id,
					reason,
					reversed_by_member_id: membership.id,
					reversed_at: reversedAt
				})
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.ap.supplier_payment.reversed',
				subjectType: 'accounts_payable_supplier_payment',
				subjectPublicId: payment.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					reversalPublicId,
					reason,
					reversedAt: reversedAt.toISOString()
				}
			});
			return reversalPublicId;
		});
	}
}
