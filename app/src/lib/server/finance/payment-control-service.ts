import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal, subtractMoney } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, cleanFinanceText, insertedId, validateMoneyAmount } from './finance-common';
import { PaymentService, type PaymentPortfolio, type PaymentWorkspace } from './payment-service';
import { activeRecoveryAmountForPayment, issuedInvoiceOutstanding } from './receivable-ledger';
import { activeAllocatedAmountForPayment } from './bad-debt-common';

function positiveOrZero(value: string): string {
	const amount = parseScaledDecimal(value, 4, 'Money amount', true);
	return formatScaledDecimal(amount > 0n ? amount : 0n, 4);
}

export class PaymentControlService {
	private readonly base: PaymentService;

	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {
		this.base = new PaymentService(db, publicIdFactory, now);
	}

	async getPortfolio(actor: TenantActorContext): Promise<PaymentPortfolio> {
		const portfolio = await this.base.getPortfolio(actor);
		for (const payment of portfolio.payments) {
			if (payment.isReversed) continue;
			const recoveryAmount = await activeRecoveryAmountForPayment(this.db, actor.organisationId, payment.id);
			payment.unallocatedAmount = positiveOrZero(subtractMoney(payment.unallocatedAmount, recoveryAmount));
		}
		return portfolio;
	}

	async recordPayment(actor: TenantActorContext, input: Parameters<PaymentService['recordPayment']>[1]) {
		return this.base.recordPayment(actor, input);
	}

	async getWorkspace(actor: TenantActorContext, paymentPublicId: string): Promise<PaymentWorkspace> {
		const workspace = await this.base.getWorkspace(actor, paymentPublicId);
		if (!workspace.payment.isReversed) {
			const recoveryAmount = await activeRecoveryAmountForPayment(this.db, actor.organisationId, workspace.payment.id);
			workspace.payment.unallocatedAmount = positiveOrZero(subtractMoney(workspace.payment.unallocatedAmount, recoveryAmount));
		}
		const candidates = [];
		for (const candidate of workspace.invoiceCandidates) {
			const invoice = await this.db.selectFrom('financial_documents').select('id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', candidate.invoicePublicId).where('document_kind', '=', 'invoice').executeTakeFirst();
			if (!invoice) continue;
			const position = await issuedInvoiceOutstanding(this.db, actor.organisationId, invoice.id);
			if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) continue;
			candidates.push({ ...candidate, issuedCreditGross: position.issuedCreditGross, activeAllocatedAmount: position.activeAllocatedAmount, outstandingAmount: position.outstandingAmount });
		}
		workspace.invoiceCandidates = candidates;
		workspace.canAllocate = workspace.canAllocate && parseScaledDecimal(workspace.payment.unallocatedAmount, 4, 'Available payment', true) > 0n;
		return workspace;
	}

	async allocate(actor: TenantActorContext, input: { paymentPublicId: string; invoicePublicId: string; amount: string }): Promise<void> {
		const paymentPublicId = cleanFinanceText(input.paymentPublicId, 64, 'Payment ID', true)!;
		const invoicePublicId = cleanFinanceText(input.invoicePublicId, 64, 'Invoice ID', true)!;
		const amount = validateMoneyAmount(input.amount, 'Allocation amount');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.payment.allocate', trx)).allowed) throw new TenantAccessError('Payment allocation is not permitted.');
			const payment = await trx.selectFrom('payments').select(['id', 'public_id as publicId', 'amount', 'currency_code as currencyCode']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', paymentPublicId).forUpdate().executeTakeFirst();
			if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await trx.selectFrom('payment_reversals').select('payment_id').where('organisation_id', '=', actor.organisationId).where('payment_id', '=', payment.id).executeTakeFirst()) throw new FinanceValidationError('A reversed payment cannot be allocated.');
			const invoice = await trx.selectFrom('financial_documents').select(['id', 'public_id as publicId', 'document_number as documentNumber', 'currency_code as currencyCode', 'lifecycle_status as lifecycleStatus']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', invoicePublicId).where('document_kind', '=', 'invoice').forUpdate().executeTakeFirst();
			if (!invoice) throw new RecordNotFoundError('Invoice not found.');
			if (invoice.lifecycleStatus !== 'issued' || !invoice.documentNumber) throw new FinanceValidationError('Payments can be allocated only to issued invoices.');
			if (payment.currencyCode !== invoice.currencyCode) throw new FinanceValidationError('Payment and invoice currency must match.');
			const [allocatedAmount, recoveryAmount] = await Promise.all([
				activeAllocatedAmountForPayment(trx, actor.organisationId, payment.id),
				activeRecoveryAmountForPayment(trx, actor.organisationId, payment.id)
			]);
			const available = subtractMoney(subtractMoney(payment.amount, allocatedAmount), recoveryAmount);
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(available, 4, 'Available payment', true)) throw new FinanceValidationError(`Allocation exceeds the remaining ${positiveOrZero(available)} available on the payment.`);
			const position = await issuedInvoiceOutstanding(trx, actor.organisationId, invoice.id);
			if (parseScaledDecimal(position.outstandingAmount, 4, 'Invoice outstanding', true) <= 0n) throw new FinanceValidationError('The invoice has no remaining outstanding balance.');
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(position.outstandingAmount, 4, 'Invoice outstanding', true)) throw new FinanceValidationError(`Allocation exceeds the invoice outstanding balance of ${position.outstandingAmount}.`);
			const allocationId = insertedId(await trx.insertInto('payment_allocations').values({ organisation_id: actor.organisationId, payment_id: payment.id, invoice_document_id: invoice.id, allocated_amount: amount, allocated_by_member_id: membership.id, allocated_at: this.now() }).executeTakeFirstOrThrow());
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.payment.allocated', subjectType: 'payment', subjectPublicId: payment.publicId, correlationId: actor.correlationId, changeSummary: { allocationId, invoicePublicId: invoice.publicId, invoiceNumber: invoice.documentNumber, amount, currencyCode: payment.currencyCode } });
		});
	}

	async reverseAllocation(actor: TenantActorContext, input: Parameters<PaymentService['reverseAllocation']>[1]) {
		return this.base.reverseAllocation(actor, input);
	}

	async reversePayment(actor: TenantActorContext, input: { paymentPublicId: string; reason: string }): Promise<void> {
		const paymentPublicId = cleanFinanceText(input.paymentPublicId, 64, 'Payment ID', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'Payment reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.payment.reverse', trx)).allowed) throw new TenantAccessError('Payment reversal is not permitted.');
			const payment = await trx.selectFrom('payments').select(['id', 'public_id as publicId', 'amount', 'currency_code as currencyCode']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', paymentPublicId).forUpdate().executeTakeFirst();
			if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await trx.selectFrom('payment_reversals').select('payment_id').where('organisation_id', '=', actor.organisationId).where('payment_id', '=', payment.id).executeTakeFirst()) throw new FinanceValidationError('The payment is already reversed.');
			const activeRecovery = await activeRecoveryAmountForPayment(trx, actor.organisationId, payment.id);
			if (parseScaledDecimal(activeRecovery, 4) > 0n) throw new FinanceValidationError('Reverse active bad-debt recovery usage before reversing the payment.');
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
