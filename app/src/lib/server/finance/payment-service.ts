import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	formatScaledDecimal,
	parseScaledDecimal,
	subtractMoney,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { CrmRepository } from '$lib/server/crm/crm-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateCurrencyCode,
	validateFinanceDate,
	validateMoneyAmount
} from './finance-common';
import { issuedInvoiceOutstanding } from './receivable-ledger';

export type PaymentMethodOption = {
	code: string;
	name: string;
};

export type PaymentPayerCandidate = {
	publicId: string;
	displayName: string;
	kind: 'person' | 'organisation';
};

export type PaymentSummary = {
	id: string;
	publicId: string;
	payerPartyId: string | null;
	payerPartyPublicId: string | null;
	payerDisplayName: string | null;
	paymentMethodCode: string;
	paymentMethodName: string;
	receivedAt: Date;
	amount: string;
	currencyCode: string;
	paymentReference: string | null;
	allocatedAmount: string;
	recoveredAmount: string;
	unallocatedAmount: string;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
	createdAt: Date;
};

export type PaymentAllocationSummary = {
	id: string;
	invoicePublicId: string;
	invoiceNumber: string;
	customerDisplayName: string;
	allocatedAmount: string;
	allocatedAt: Date;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
};

export type PaymentInvoiceCandidate = {
	invoicePublicId: string;
	invoiceNumber: string;
	customerPartyId: string;
	customerDisplayName: string;
	currencyCode: string;
	dueDate: Date | null;
	invoiceGross: string;
	issuedCreditGross: string;
	activeAllocatedAmount: string;
	outstandingAmount: string;
	payerMatches: boolean | null;
};

export type PaymentPortfolio = {
	payments: PaymentSummary[];
	paymentMethods: PaymentMethodOption[];
	payerCandidates: PaymentPayerCandidate[];
	defaultCurrencyCode: string;
	today: string;
	canCreate: boolean;
	canSelectPayer: boolean;
};

export type PaymentWorkspace = {
	payment: PaymentSummary;
	allocations: PaymentAllocationSummary[];
	invoiceCandidates: PaymentInvoiceCandidate[];
	canAllocate: boolean;
	canReverseAllocation: boolean;
	canReversePayment: boolean;
};

function positiveOrZeroMoney(value: string): string {
	const parsed = parseScaledDecimal(value, 4, 'Money amount', true);
	return formatScaledDecimal(parsed > 0n ? parsed : 0n, 4);
}

function validateAllocationId(value: string): string {
	const text = value.trim();
	if (!/^\d+$/.test(text) || text === '0') throw new FinanceValidationError('Payment allocation is invalid.');
	return text;
}

export class PaymentService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async activeAllocatedAmountForPayment(
		db: DatabaseExecutor,
		organisationId: string,
		paymentId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('payment_allocations as allocation')
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join
					.onRef('reversal.payment_allocation_id', '=', 'allocation.id')
					.onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
			)
			.select('allocation.allocated_amount as allocatedAmount')
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.payment_id', '=', paymentId)
			.where('reversal.payment_allocation_id', 'is', null)
			.execute();
		return sumMoney(rows.map((row) => row.allocatedAmount));
	}

	private async activeRecoveryAmountForPayment(
		db: DatabaseExecutor,
		organisationId: string,
		paymentId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('receivable_recoveries as recovery')
			.leftJoin('receivable_recovery_reversals as reversal', (join) =>
				join
					.onRef('reversal.recovery_id', '=', 'recovery.id')
					.onRef('reversal.organisation_id', '=', 'recovery.organisation_id')
			)
			.select('recovery.amount as amount')
			.where('recovery.organisation_id', '=', organisationId)
			.where('recovery.payment_id', '=', paymentId)
			.where('reversal.recovery_id', 'is', null)
			.execute();
		return sumMoney(rows.map((row) => row.amount));
	}

	private async paymentRecord(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('payments as payment')
			.innerJoin('payment_methods as method', 'method.id', 'payment.payment_method_id')
			.leftJoin('parties as payer', (join) =>
				join
					.onRef('payer.id', '=', 'payment.payer_party_id')
					.onRef('payer.organisation_id', '=', 'payment.organisation_id')
			)
			.select([
				'payment.id as id',
				'payment.public_id as publicId',
				'payment.payer_party_id as payerPartyId',
				'payer.public_id as payerPartyPublicId',
				'payment.received_at as receivedAt',
				'payment.amount as amount',
				'payment.currency_code as currencyCode',
				'payment.payment_reference as paymentReference',
				'payment.created_at as createdAt',
				'method.code as paymentMethodCode',
				'method.name as paymentMethodName'
			])
			.where('payment.organisation_id', '=', organisationId)
			.where('payment.public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async paymentReversal(
		db: DatabaseExecutor,
		organisationId: string,
		paymentId: string
	) {
		return db
			.selectFrom('payment_reversals')
			.select(['reversed_at as reversedAt', 'reason'])
			.where('organisation_id', '=', organisationId)
			.where('payment_id', '=', paymentId)
			.executeTakeFirst();
	}

	private async paymentSummary(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<PaymentSummary | null> {
		const record = await this.paymentRecord(db, organisationId, publicId);
		if (!record) return null;
		const [allocatedAmount, recoveredAmount, reversal, payer] = await Promise.all([
			this.activeAllocatedAmountForPayment(db, organisationId, record.id),
			this.activeRecoveryAmountForPayment(db, organisationId, record.id),
			this.paymentReversal(db, organisationId, record.id),
			record.payerPartyPublicId
				? new CrmRepository(db).findPartyByPublicId(organisationId, record.payerPartyPublicId)
				: Promise.resolve(null)
		]);
		const rawUnallocated = subtractMoney(subtractMoney(record.amount, allocatedAmount), recoveredAmount);
		return {
			id: record.id,
			publicId: record.publicId,
			payerPartyId: record.payerPartyId,
			payerPartyPublicId: record.payerPartyPublicId,
			payerDisplayName: payer?.displayName ?? null,
			paymentMethodCode: record.paymentMethodCode,
			paymentMethodName: record.paymentMethodName,
			receivedAt: record.receivedAt,
			amount: record.amount,
			currencyCode: record.currencyCode,
			paymentReference: record.paymentReference,
			allocatedAmount,
			recoveredAmount,
			unallocatedAmount: reversal ? '0.0000' : positiveOrZeroMoney(rawUnallocated),
			isReversed: Boolean(reversal),
			reversedAt: reversal?.reversedAt ?? null,
			reversalReason: reversal?.reason ?? null,
			createdAt: record.createdAt
		};
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
				'document.currency_code as currencyCode',
				'document.lifecycle_status as lifecycleStatus',
				'invoice.due_date as dueDate',
				'snapshot.display_name as customerDisplayName'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.public_id', '=', publicId)
			.where('document.document_kind', '=', 'invoice');
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async invoiceCandidate(
		db: DatabaseExecutor,
		organisationId: string,
		invoice: Awaited<ReturnType<PaymentService['invoiceRecord']>>,
		payerPartyId: string | null
	): Promise<PaymentInvoiceCandidate | null> {
		if (!invoice || invoice.lifecycleStatus !== 'issued' || !invoice.documentNumber) return null;
		const position = await issuedInvoiceOutstanding(db, organisationId, invoice.id);
		return {
			invoicePublicId: invoice.publicId,
			invoiceNumber: invoice.documentNumber,
			customerPartyId: invoice.customerPartyId,
			customerDisplayName: invoice.customerDisplayName ?? 'Customer',
			currencyCode: invoice.currencyCode,
			dueDate: invoice.dueDate,
			invoiceGross: position.invoiceGross,
			issuedCreditGross: position.issuedCreditGross,
			activeAllocatedAmount: position.activeAllocatedAmount,
			outstandingAmount: position.outstandingAmount,
			payerMatches: payerPartyId ? invoice.customerPartyId === payerPartyId : null
		};
	}

	private async listInvoiceCandidates(
		db: DatabaseExecutor,
		organisationId: string,
		currencyCode: string,
		payerPartyId: string | null
	): Promise<PaymentInvoiceCandidate[]> {
		const rows = await db
			.selectFrom('financial_documents')
			.select('public_id as publicId')
			.where('organisation_id', '=', organisationId)
			.where('document_kind', '=', 'invoice')
			.where('lifecycle_status', '=', 'issued')
			.where('currency_code', '=', currencyCode)
			.orderBy('id', 'asc')
			.execute();
		const candidates: PaymentInvoiceCandidate[] = [];
		for (const row of rows) {
			const invoice = await this.invoiceRecord(db, organisationId, row.publicId);
			const candidate = await this.invoiceCandidate(db, organisationId, invoice, payerPartyId);
			if (!candidate) continue;
			if (parseScaledDecimal(candidate.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) continue;
			candidates.push(candidate);
		}
		return candidates.sort((left, right) => {
			const leftTime = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
			const rightTime = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
			return leftTime - rightTime || left.invoiceNumber.localeCompare(right.invoiceNumber);
		});
	}

	async getPortfolio(actor: TenantActorContext): Promise<PaymentPortfolio> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Payment viewing is not permitted.');
		const [createDecision, crmViewDecision, paymentRows, paymentMethods, organisation] = await Promise.all([
			policy.mutationDecision(actor, 'finance.payment.create'),
			new PermissionService(this.db).decide(actor, 'crm.view'),
			this.db
				.selectFrom('payments')
				.select('public_id as publicId')
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('received_at', 'desc')
				.orderBy('id', 'desc')
				.limit(250)
				.execute(),
			this.db
				.selectFrom('payment_methods')
				.select(['code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name', 'asc')
				.execute(),
			this.db
				.selectFrom('organisations')
				.select('default_currency_code as defaultCurrencyCode')
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow()
		]);
		const payments: PaymentSummary[] = [];
		for (const row of paymentRows) {
			const summary = await this.paymentSummary(this.db, actor.organisationId, row.publicId);
			if (summary) payments.push(summary);
		}
		const payerCandidates = crmViewDecision.allowed
			? (await new CrmRepository(this.db).listParties(actor.organisationId, { status: 'active' })).map((party) => ({
					publicId: party.publicId,
					displayName: party.displayName,
					kind: party.kind
				}))
			: [];
		return {
			payments,
			paymentMethods,
			payerCandidates,
			defaultCurrencyCode: organisation.defaultCurrencyCode,
			today: this.now().toISOString().slice(0, 10),
			canCreate: createDecision.allowed,
			canSelectPayer: crmViewDecision.allowed
		};
	}

	async recordPayment(
		actor: TenantActorContext,
		input: {
			payerPartyPublicId?: string | null;
			paymentMethodCode: string;
			receivedOn: string;
			amount: string;
			currencyCode: string;
			paymentReference?: string | null;
		}
	): Promise<{ publicId: string }> {
		const paymentMethodCode = cleanFinanceText(input.paymentMethodCode, 64, 'Payment method', true)!;
		const receivedAt = validateFinanceDate(input.receivedOn, 'Received date');
		if (!receivedAt) throw new FinanceValidationError('Received date is required.');
		const amount = validateMoneyAmount(input.amount, 'Payment amount');
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Payment currency');
		if (!currencyCode) throw new FinanceValidationError('Payment currency is required.');
		const paymentReference = cleanFinanceText(input.paymentReference, 255, 'Payment reference');
		const payerPublicId = cleanFinanceText(input.payerPartyPublicId, 64, 'Payer');
		const publicId = this.publicIdFactory();

		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.payment.create', trx);
			if (!decision.allowed) throw new TenantAccessError('Payment recording is not permitted.');
			const paymentMethod = await trx
				.selectFrom('payment_methods')
				.select('id')
				.where('code', '=', paymentMethodCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!paymentMethod) throw new FinanceValidationError('Payment method is unavailable.');

			let payerPartyId: string | null = null;
			let payerDisplayName: string | null = null;
			if (payerPublicId) {
				const crmView = await new PermissionService(trx).decide(actor, 'crm.view');
				if (!crmView.allowed) throw new TenantAccessError('CRM viewing is required to select a payer.');
				const payer = await new CrmRepository(trx).findPartyByPublicId(actor.organisationId, payerPublicId);
				if (!payer) throw new RecordNotFoundError('Payer not found.');
				if (payer.status !== 'active') throw new FinanceValidationError('The selected payer is not active.');
				payerPartyId = payer.id;
				payerDisplayName = payer.displayName;
			}

			await trx
				.insertInto('payments')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					payer_party_id: payerPartyId,
					payment_method_id: paymentMethod.id,
					received_at: receivedAt,
					amount,
					currency_code: currencyCode,
					payment_reference: paymentReference,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'finance.payment.recorded',
				subjectType: 'payment',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					payerPublicId,
					payerDisplayName,
					paymentMethodCode,
					receivedOn: input.receivedOn,
					amount,
					currencyCode,
					paymentReference
				}
			});
		});
		return { publicId };
	}

	private async allocations(
		db: DatabaseExecutor,
		organisationId: string,
		paymentId: string
	): Promise<PaymentAllocationSummary[]> {
		const rows = await db
			.selectFrom('payment_allocations as allocation')
			.innerJoin('financial_documents as invoiceDocument', (join) =>
				join
					.onRef('invoiceDocument.id', '=', 'allocation.invoice_document_id')
					.onRef('invoiceDocument.organisation_id', '=', 'allocation.organisation_id')
			)
			.leftJoin('financial_document_party_snapshots as customer', (join) =>
				join
					.onRef('customer.financial_document_id', '=', 'invoiceDocument.id')
					.onRef('customer.organisation_id', '=', 'invoiceDocument.organisation_id')
					.on('customer.snapshot_role', '=', 'customer')
					.on('customer.sort_order', '=', 1)
			)
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join
					.onRef('reversal.payment_allocation_id', '=', 'allocation.id')
					.onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
			)
			.select([
				'allocation.id as id',
				'invoiceDocument.public_id as invoicePublicId',
				'invoiceDocument.document_number as invoiceNumber',
				'customer.display_name as customerDisplayName',
				'allocation.allocated_amount as allocatedAmount',
				'allocation.allocated_at as allocatedAt',
				'reversal.reversed_at as reversedAt',
				'reversal.reason as reversalReason'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.payment_id', '=', paymentId)
			.orderBy('allocation.allocated_at', 'asc')
			.orderBy('allocation.id', 'asc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			invoicePublicId: row.invoicePublicId,
			invoiceNumber: row.invoiceNumber ?? 'Invoice',
			customerDisplayName: row.customerDisplayName ?? 'Customer',
			allocatedAmount: row.allocatedAmount,
			allocatedAt: row.allocatedAt,
			isReversed: Boolean(row.reversedAt),
			reversedAt: row.reversedAt,
			reversalReason: row.reversalReason
		}));
	}

	async getWorkspace(actor: TenantActorContext, paymentPublicIdInput: string): Promise<PaymentWorkspace> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		const view = await policy.viewDecision(actor);
		if (!view.allowed) throw new TenantAccessError('Payment viewing is not permitted.');
		const publicId = cleanFinanceText(paymentPublicIdInput, 64, 'Payment ID', true)!;
		const payment = await this.paymentSummary(this.db, actor.organisationId, publicId);
		if (!payment) throw new RecordNotFoundError('Payment not found.');
		const [allocateDecision, allocationReverseDecision, paymentReverseDecision, allocations] = await Promise.all([
			policy.mutationDecision(actor, 'finance.payment.allocate'),
			policy.mutationDecision(actor, 'finance.payment.allocation.reverse'),
			policy.mutationDecision(actor, 'finance.payment.reverse'),
			this.allocations(this.db, actor.organisationId, payment.id)
		]);
		const invoiceCandidates = payment.isReversed
			? []
			: await this.listInvoiceCandidates(this.db, actor.organisationId, payment.currencyCode, payment.payerPartyId);
		return {
			payment,
			allocations,
			invoiceCandidates,
			canAllocate: allocateDecision.allowed && !payment.isReversed && parseScaledDecimal(payment.unallocatedAmount, 4) > 0n,
			canReverseAllocation: allocationReverseDecision.allowed && !payment.isReversed,
			canReversePayment: paymentReverseDecision.allowed && !payment.isReversed && parseScaledDecimal(payment.recoveredAmount, 4, 'Recovered amount', true) === 0n
		};
	}

	async allocate(
		actor: TenantActorContext,
		input: { paymentPublicId: string; invoicePublicId: string; amount: string }
	): Promise<void> {
		const paymentPublicId = cleanFinanceText(input.paymentPublicId, 64, 'Payment ID', true)!;
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const amount = validateMoneyAmount(input.amount, 'Allocation amount');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.payment.allocate', trx);
			if (!decision.allowed) throw new TenantAccessError('Payment allocation is not permitted.');
			const payment = await this.paymentRecord(trx, actor.organisationId, paymentPublicId, true);
			if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await this.paymentReversal(trx, actor.organisationId, payment.id)) {
				throw new FinanceValidationError('A reversed payment cannot be allocated.');
			}
			const invoice = await this.invoiceRecord(trx, actor.organisationId, invoicePublicId, true);
			if (!invoice) throw new RecordNotFoundError('Invoice not found.');
			if (invoice.lifecycleStatus !== 'issued' || !invoice.documentNumber) {
				throw new FinanceValidationError('Payments can be allocated only to issued invoices.');
			}
			if (payment.currencyCode !== invoice.currencyCode) {
				throw new FinanceValidationError('Payment and invoice currency must match.');
			}

			const [activePaymentAllocations, activeRecoveries] = await Promise.all([
				this.activeAllocatedAmountForPayment(trx, actor.organisationId, payment.id),
				this.activeRecoveryAmountForPayment(trx, actor.organisationId, payment.id)
			]);
			const paymentAvailable = subtractMoney(subtractMoney(payment.amount, activePaymentAllocations), activeRecoveries);
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(paymentAvailable, 4, 'Available payment', true)) {
				throw new FinanceValidationError(`Allocation exceeds the remaining ${positiveOrZeroMoney(paymentAvailable)} available on the payment.`);
			}

			const candidate = await this.invoiceCandidate(trx, actor.organisationId, invoice, payment.payerPartyId);
			if (!candidate) throw new FinanceValidationError('The invoice is not available for allocation.');
			if (parseScaledDecimal(candidate.outstandingAmount, 4, 'Invoice outstanding', true) <= 0n) {
				throw new FinanceValidationError('The invoice has no remaining outstanding balance.');
			}
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(candidate.outstandingAmount, 4, 'Invoice outstanding', true)) {
				throw new FinanceValidationError(`Allocation exceeds the invoice outstanding balance of ${candidate.outstandingAmount}.`);
			}

			const allocationId = insertedId(
				await trx
					.insertInto('payment_allocations')
					.values({
						organisation_id: actor.organisationId,
						payment_id: payment.id,
						invoice_document_id: invoice.id,
						allocated_amount: amount,
						allocated_by_member_id: membership.id,
						allocated_at: this.now()
					})
					.executeTakeFirstOrThrow()
			);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId,
				actorMemberId: membership.id, projectId: null, actionKey: 'finance.payment.allocated', subjectType: 'payment',
				subjectPublicId: payment.publicId, correlationId: actor.correlationId,
				changeSummary: { allocationId, invoicePublicId: invoice.publicId, invoiceNumber: invoice.documentNumber, amount, currencyCode: payment.currencyCode }
			});
		});
	}

	async reverseAllocation(
		actor: TenantActorContext,
		input: { paymentPublicId: string; allocationId: string; reason: string }
	): Promise<void> {
		const paymentPublicId = cleanFinanceText(input.paymentPublicId, 64, 'Payment ID', true)!;
		const allocationId = validateAllocationId(input.allocationId);
		const reason = cleanFinanceText(input.reason, 1000, 'Allocation reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx); const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.payment.allocation.reverse', trx)).allowed) throw new TenantAccessError('Payment-allocation reversal is not permitted.');
			const payment = await this.paymentRecord(trx, actor.organisationId, paymentPublicId, true); if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await this.paymentReversal(trx, actor.organisationId, payment.id)) throw new FinanceValidationError('The payment is already reversed.');
			const allocation = await trx.selectFrom('payment_allocations as allocation')
				.innerJoin('financial_documents as invoiceDocument', (join) => join.onRef('invoiceDocument.id', '=', 'allocation.invoice_document_id').onRef('invoiceDocument.organisation_id', '=', 'allocation.organisation_id'))
				.select(['allocation.id','allocation.allocated_amount as allocatedAmount','invoiceDocument.public_id as invoicePublicId','invoiceDocument.document_number as invoiceNumber'])
				.where('allocation.organisation_id', '=', actor.organisationId).where('allocation.payment_id', '=', payment.id).where('allocation.id', '=', allocationId).forUpdate().executeTakeFirst();
			if (!allocation) throw new RecordNotFoundError('Payment allocation not found.');
			if (await trx.selectFrom('payment_allocation_reversals').select('payment_allocation_id').where('organisation_id', '=', actor.organisationId).where('payment_allocation_id', '=', allocation.id).executeTakeFirst()) throw new FinanceValidationError('The payment allocation is already reversed.');
			const reversedAt = this.now();
			await trx.insertInto('payment_allocation_reversals').values({ payment_allocation_id: allocation.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.payment.allocation.reversed', subjectType: 'payment', subjectPublicId: payment.publicId, correlationId: actor.correlationId, changeSummary: { allocationId: allocation.id, invoicePublicId: allocation.invoicePublicId, invoiceNumber: allocation.invoiceNumber, amount: allocation.allocatedAmount, reason, reversedAt } });
		});
	}

	async reversePayment(actor: TenantActorContext, input: { paymentPublicId: string; reason: string }): Promise<void> {
		const paymentPublicId = cleanFinanceText(input.paymentPublicId, 64, 'Payment ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Payment reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx); const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.payment.reverse', trx)).allowed) throw new TenantAccessError('Payment reversal is not permitted.');
			const payment = await this.paymentRecord(trx, actor.organisationId, paymentPublicId, true); if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await this.paymentReversal(trx, actor.organisationId, payment.id)) throw new FinanceValidationError('The payment is already reversed.');
			const activeRecoveries = await this.activeRecoveryAmountForPayment(trx, actor.organisationId, payment.id);
			if (parseScaledDecimal(activeRecoveries, 4, 'Recovered amount', true) > 0n) throw new FinanceValidationError('Reverse active bad-debt recovery evidence before reversing this payment.');

			const allocations = await trx.selectFrom('payment_allocations').select(['id', 'allocated_amount as allocatedAmount']).where('organisation_id', '=', actor.organisationId).where('payment_id', '=', payment.id).forUpdate().execute();
			let reversedAllocationCount = 0;
			if (allocations.length > 0) {
				const reversalRows = await trx.selectFrom('payment_allocation_reversals').select('payment_allocation_id as paymentAllocationId').where('organisation_id', '=', actor.organisationId).where('payment_allocation_id', 'in', allocations.map((allocation) => allocation.id)).execute();
				const reversedIds = new Set(reversalRows.map((row) => row.paymentAllocationId));
				const activeAllocations = allocations.filter((allocation) => !reversedIds.has(allocation.id));
				if (activeAllocations.length > 0) {
					const reversedAt = this.now();
					await trx.insertInto('payment_allocation_reversals').values(activeAllocations.map((allocation) => ({ payment_allocation_id: allocation.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }))).execute();
					reversedAllocationCount = activeAllocations.length;
				}
			}
			const reversedAt = this.now();
			await trx.insertInto('payment_reversals').values({ payment_id: payment.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.payment.reversed', subjectType: 'payment', subjectPublicId: payment.publicId, correlationId: actor.correlationId, changeSummary: { amount: payment.amount, currencyCode: payment.currencyCode, reversedAllocationCount, reason, reversedAt } });
		});
	}
}
