import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal, subtractMoney, sumMoney } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, cleanFinanceText, insertedId, validateMoneyAmount } from './finance-common';
import { issuedInvoiceOutstanding } from './receivable-ledger';

export type BadDebtInvoiceCandidate = {
	invoicePublicId: string;
	invoiceNumber: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	currencyCode: string;
	outstandingAmount: string;
	activeWriteOffAmount: string;
};

export type WriteOffSummary = {
	id: string;
	publicId: string;
	invoicePublicId: string;
	invoiceNumber: string;
	customerDisplayName: string;
	currencyCode: string;
	amount: string;
	reason: string;
	writtenOffAt: Date;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
	recoveredAmount: string;
	remainingRecoverableAmount: string;
};

export type RecoveryPaymentCandidate = {
	publicId: string;
	currencyCode: string;
	amount: string;
	usableAmount: string;
	paymentReference: string | null;
	receivedAt: Date;
};

export type RecoverySummary = {
	id: string;
	publicId: string;
	writeOffPublicId: string;
	paymentPublicId: string;
	amount: string;
	reason: string;
	recoveredAt: Date;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
};

export type BadDebtWorkspace = {
	invoices: BadDebtInvoiceCandidate[];
	writeOffs: WriteOffSummary[];
	recoveries: RecoverySummary[];
	payments: RecoveryPaymentCandidate[];
	canWriteOff: boolean;
	canReverseWriteOff: boolean;
	canRecover: boolean;
	canReverseRecovery: boolean;
};

function positiveOrZero(value: string): string {
	const parsed = parseScaledDecimal(value, 4, 'Amount', true);
	return formatScaledDecimal(parsed > 0n ? parsed : 0n, 4);
}

export class BadDebtService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertView(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const access = new FinanceAccessPolicy(db);
		await access.assertActiveActor(actor, db);
		const [financeView, badDebtView] = await Promise.all([
			access.viewDecision(actor, db),
			access.badDebtViewDecision(actor, db)
		]);
		if (!financeView.allowed || !badDebtView.allowed) throw new TenantAccessError('Bad-debt viewing is not permitted.');
	}

	private async invoiceRecord(db: DatabaseExecutor, organisationId: string, publicId: string, lock = false) {
		let query = db
			.selectFrom('financial_documents as document')
			.leftJoin('financial_document_party_snapshots as snapshot', (join) =>
				join.onRef('snapshot.financial_document_id', '=', 'document.id')
					.onRef('snapshot.organisation_id', '=', 'document.organisation_id')
					.on('snapshot.snapshot_role', '=', 'customer')
					.on('snapshot.sort_order', '=', 1)
			)
			.innerJoin('parties as customer', (join) =>
				join.onRef('customer.id', '=', 'document.customer_party_id').onRef('customer.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id', 'document.public_id as publicId', 'document.document_number as documentNumber',
				'document.customer_party_id as customerPartyId', 'customer.public_id as customerPartyPublicId',
				'document.currency_code as currencyCode', 'document.lifecycle_status as lifecycleStatus',
				'snapshot.display_name as customerDisplayName'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.public_id', '=', publicId)
			.where('document.document_kind', '=', 'invoice');
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async activeRecoveryAmountForWriteOff(db: DatabaseExecutor, organisationId: string, writeOffId: string) {
		const rows = await db.selectFrom('receivable_recoveries as recovery')
			.leftJoin('receivable_recovery_reversals as reversal', (join) =>
				join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id'))
			.select('recovery.amount as amount')
			.where('recovery.organisation_id', '=', organisationId)
			.where('recovery.write_off_id', '=', writeOffId)
			.where('reversal.recovery_id', 'is', null)
			.execute();
		return sumMoney(rows.map((row) => row.amount));
	}

	private async activeRecoveryAmountForPayment(db: DatabaseExecutor, organisationId: string, paymentId: string) {
		const rows = await db.selectFrom('receivable_recoveries as recovery')
			.leftJoin('receivable_recovery_reversals as reversal', (join) =>
				join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id'))
			.select('recovery.amount as amount')
			.where('recovery.organisation_id', '=', organisationId)
			.where('recovery.payment_id', '=', paymentId)
			.where('reversal.recovery_id', 'is', null)
			.execute();
		return sumMoney(rows.map((row) => row.amount));
	}

	private async activeAllocationAmountForPayment(db: DatabaseExecutor, organisationId: string, paymentId: string) {
		const rows = await db.selectFrom('payment_allocations as allocation')
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join.onRef('reversal.payment_allocation_id', '=', 'allocation.id').onRef('reversal.organisation_id', '=', 'allocation.organisation_id'))
			.select('allocation.allocated_amount as amount')
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.payment_id', '=', paymentId)
			.where('reversal.payment_allocation_id', 'is', null)
			.execute();
		return sumMoney(rows.map((row) => row.amount));
	}

	private async paymentRecord(db: DatabaseExecutor, organisationId: string, publicId: string, lock = false) {
		let query = db.selectFrom('payments').select(['id', 'public_id as publicId', 'amount', 'currency_code as currencyCode', 'payment_reference as paymentReference', 'received_at as receivedAt'])
			.where('organisation_id', '=', organisationId).where('public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async paymentIsReversed(db: DatabaseExecutor, organisationId: string, paymentId: string) {
		return Boolean(await db.selectFrom('payment_reversals').select('id').where('organisation_id', '=', organisationId).where('payment_id', '=', paymentId).executeTakeFirst());
	}

	private async usablePaymentAmount(db: DatabaseExecutor, organisationId: string, paymentId: string, paymentAmount: string) {
		const [allocated, recovered] = await Promise.all([
			this.activeAllocationAmountForPayment(db, organisationId, paymentId),
			this.activeRecoveryAmountForPayment(db, organisationId, paymentId)
		]);
		return positiveOrZero(subtractMoney(subtractMoney(paymentAmount, allocated), recovered));
	}

	async getWorkspace(actor: TenantActorContext): Promise<BadDebtWorkspace> {
		await this.assertView(actor);
		const access = new FinanceAccessPolicy(this.db);
		const [writeOffDecision, reverseWriteOffDecision, recoveryDecision, reverseRecoveryDecision] = await Promise.all([
			access.mutationDecision(actor, 'finance.bad_debt.write_off'),
			access.mutationDecision(actor, 'finance.bad_debt.write_off.reverse'),
			access.mutationDecision(actor, 'finance.bad_debt.recovery'),
			access.mutationDecision(actor, 'finance.bad_debt.recovery.reverse')
		]);

		const invoiceRows = await this.db.selectFrom('financial_documents').select('public_id as publicId')
			.where('organisation_id', '=', actor.organisationId).where('document_kind', '=', 'invoice').where('lifecycle_status', '=', 'issued').orderBy('id', 'asc').execute();
		const invoices: BadDebtInvoiceCandidate[] = [];
		for (const row of invoiceRows) {
			const invoice = await this.invoiceRecord(this.db, actor.organisationId, row.publicId); if (!invoice || !invoice.documentNumber) continue;
			const position = await issuedInvoiceOutstanding(this.db, actor.organisationId, invoice.id);
			if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) continue;
			invoices.push({ invoicePublicId: invoice.publicId, invoiceNumber: invoice.documentNumber, customerPartyPublicId: invoice.customerPartyPublicId, customerDisplayName: invoice.customerDisplayName ?? 'Customer', currencyCode: invoice.currencyCode, outstandingAmount: position.outstandingAmount, activeWriteOffAmount: position.activeWriteOffAmount });
		}

		const writeOffRows = await this.db.selectFrom('receivable_write_offs as writeOff')
			.innerJoin('financial_documents as document', (join) => join.onRef('document.id', '=', 'writeOff.invoice_document_id').onRef('document.organisation_id', '=', 'writeOff.organisation_id'))
			.leftJoin('financial_document_party_snapshots as snapshot', (join) => join.onRef('snapshot.financial_document_id', '=', 'document.id').onRef('snapshot.organisation_id', '=', 'document.organisation_id').on('snapshot.snapshot_role', '=', 'customer').on('snapshot.sort_order', '=', 1))
			.leftJoin('receivable_write_off_reversals as reversal', (join) => join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id'))
			.select(['writeOff.id as id','writeOff.public_id as publicId','writeOff.amount','writeOff.currency_code as currencyCode','writeOff.reason','writeOff.written_off_at as writtenOffAt','document.public_id as invoicePublicId','document.document_number as invoiceNumber','snapshot.display_name as customerDisplayName','reversal.reversed_at as reversedAt','reversal.reason as reversalReason'])
			.where('writeOff.organisation_id', '=', actor.organisationId).orderBy('writeOff.written_off_at', 'desc').limit(200).execute();
		const writeOffs: WriteOffSummary[] = [];
		for (const row of writeOffRows) {
			const recoveredAmount = await this.activeRecoveryAmountForWriteOff(this.db, actor.organisationId, row.id);
			writeOffs.push({ id: row.id, publicId: row.publicId, invoicePublicId: row.invoicePublicId, invoiceNumber: row.invoiceNumber ?? 'Unnumbered invoice', customerDisplayName: row.customerDisplayName ?? 'Customer', currencyCode: row.currencyCode, amount: row.amount, reason: row.reason, writtenOffAt: row.writtenOffAt, isReversed: Boolean(row.reversedAt), reversedAt: row.reversedAt, reversalReason: row.reversalReason, recoveredAmount, remainingRecoverableAmount: positiveOrZero(subtractMoney(row.amount, recoveredAmount)) });
		}

		const recoveryRows = await this.db.selectFrom('receivable_recoveries as recovery')
			.innerJoin('receivable_write_offs as writeOff', (join) => join.onRef('writeOff.id', '=', 'recovery.write_off_id').onRef('writeOff.organisation_id', '=', 'recovery.organisation_id'))
			.innerJoin('payments as payment', (join) => join.onRef('payment.id', '=', 'recovery.payment_id').onRef('payment.organisation_id', '=', 'recovery.organisation_id'))
			.leftJoin('receivable_recovery_reversals as reversal', (join) => join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id'))
			.select(['recovery.id as id','recovery.public_id as publicId','writeOff.public_id as writeOffPublicId','payment.public_id as paymentPublicId','recovery.amount','recovery.reason','recovery.recovered_at as recoveredAt','reversal.reversed_at as reversedAt','reversal.reason as reversalReason'])
			.where('recovery.organisation_id', '=', actor.organisationId).orderBy('recovery.recovered_at', 'desc').limit(200).execute();
		const recoveries = recoveryRows.map((row) => ({ id: row.id, publicId: row.publicId, writeOffPublicId: row.writeOffPublicId, paymentPublicId: row.paymentPublicId, amount: row.amount, reason: row.reason, recoveredAt: row.recoveredAt, isReversed: Boolean(row.reversedAt), reversedAt: row.reversedAt, reversalReason: row.reversalReason }));

		const paymentRows = await this.db.selectFrom('payments').select(['id','public_id as publicId','amount','currency_code as currencyCode','payment_reference as paymentReference','received_at as receivedAt']).where('organisation_id', '=', actor.organisationId).orderBy('received_at', 'desc').limit(200).execute();
		const payments: RecoveryPaymentCandidate[] = [];
		for (const payment of paymentRows) {
			if (await this.paymentIsReversed(this.db, actor.organisationId, payment.id)) continue;
			const usableAmount = await this.usablePaymentAmount(this.db, actor.organisationId, payment.id, payment.amount);
			if (parseScaledDecimal(usableAmount, 4, 'Usable payment', true) <= 0n) continue;
			payments.push({ publicId: payment.publicId, currencyCode: payment.currencyCode, amount: payment.amount, usableAmount, paymentReference: payment.paymentReference, receivedAt: payment.receivedAt });
		}

		return { invoices, writeOffs, recoveries, payments, canWriteOff: writeOffDecision.allowed, canReverseWriteOff: reverseWriteOffDecision.allowed, canRecover: recoveryDecision.allowed, canReverseRecovery: reverseRecoveryDecision.allowed };
	}

	async writeOff(actor: TenantActorContext, input: { invoicePublicId: string; amount: string; reason: string }): Promise<string> {
		const amount = validateMoneyAmount(input.amount, 'Write-off amount');
		const reason = cleanFinanceText(input.reason, 1000, 'Write-off reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx); const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.write_off', trx)).allowed) throw new TenantAccessError('Receivable write-off is not permitted.');
			const invoice = await this.invoiceRecord(trx, actor.organisationId, input.invoicePublicId.trim(), true);
			if (!invoice || invoice.lifecycleStatus !== 'issued') throw new RecordNotFoundError('Issued invoice not found.');
			const position = await issuedInvoiceOutstanding(trx, actor.organisationId, invoice.id);
			if (parseScaledDecimal(amount, 4, 'Write-off amount', true) > parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true)) throw new FinanceValidationError('Write-off amount exceeds the live invoice outstanding amount.');
			const publicId = this.publicIdFactory(); const now = this.now();
			await trx.insertInto('receivable_write_offs').values({ organisation_id: actor.organisationId, public_id: publicId, invoice_document_id: invoice.id, customer_party_id: invoice.customerPartyId, currency_code: invoice.currencyCode, amount, reason, authorised_by_member_id: membership.id, written_off_at: now }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, actionKey: 'finance.bad_debt.write_off.recorded', subjectType: 'receivable_write_off', subjectPublicId: publicId, correlationId: actor.correlationId, changeSummary: { invoicePublicId: invoice.publicId, amount, currencyCode: invoice.currencyCode, reason } });
			return publicId;
		});
	}

	async reverseWriteOff(actor: TenantActorContext, input: { writeOffPublicId: string; reason: string }): Promise<void> {
		const reason = cleanFinanceText(input.reason, 1000, 'Write-off reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx); const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.write_off.reverse', trx)).allowed) throw new TenantAccessError('Write-off reversal is not permitted.');
			const writeOff = await trx.selectFrom('receivable_write_offs').select(['id','public_id as publicId','invoice_document_id as invoiceDocumentId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', input.writeOffPublicId.trim()).forUpdate().executeTakeFirst();
			if (!writeOff) throw new RecordNotFoundError('Write-off not found.');
			if (await trx.selectFrom('receivable_write_off_reversals').select('id').where('organisation_id', '=', actor.organisationId).where('write_off_id', '=', writeOff.id).executeTakeFirst()) return;
			const recovered = await this.activeRecoveryAmountForWriteOff(trx, actor.organisationId, writeOff.id);
			if (parseScaledDecimal(recovered, 4, 'Recovered amount', true) > 0n) throw new FinanceValidationError('Reverse active recovery evidence before reversing this write-off.');
			const publicId = this.publicIdFactory(); const now = this.now();
			await trx.insertInto('receivable_write_off_reversals').values({ organisation_id: actor.organisationId, public_id: publicId, write_off_id: writeOff.id, reason, reversed_by_member_id: membership.id, reversed_at: now }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, actionKey: 'finance.bad_debt.write_off.reversed', subjectType: 'receivable_write_off', subjectPublicId: writeOff.publicId, correlationId: actor.correlationId, changeSummary: { reversalPublicId: publicId, reason } });
		});
	}

	async recordRecovery(actor: TenantActorContext, input: { writeOffPublicId: string; paymentPublicId: string; amount: string; reason: string }): Promise<string> {
		const amount = validateMoneyAmount(input.amount, 'Recovery amount'); const reason = cleanFinanceText(input.reason, 1000, 'Recovery reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx); const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.recovery', trx)).allowed) throw new TenantAccessError('Bad-debt recovery is not permitted.');
			const writeOff = await trx.selectFrom('receivable_write_offs').select(['id','public_id as publicId','currency_code as currencyCode','amount']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', input.writeOffPublicId.trim()).forUpdate().executeTakeFirst();
			if (!writeOff) throw new RecordNotFoundError('Write-off not found.');
			if (await trx.selectFrom('receivable_write_off_reversals').select('id').where('organisation_id', '=', actor.organisationId).where('write_off_id', '=', writeOff.id).executeTakeFirst()) throw new FinanceValidationError('A reversed write-off cannot receive recovery evidence.');
			const payment = await this.paymentRecord(trx, actor.organisationId, input.paymentPublicId.trim(), true); if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await this.paymentIsReversed(trx, actor.organisationId, payment.id)) throw new FinanceValidationError('A reversed payment cannot be used for recovery.');
			if (payment.currencyCode !== writeOff.currencyCode) throw new FinanceValidationError('Recovery payment currency must match the write-off currency.');
			const [recovered, usablePayment] = await Promise.all([this.activeRecoveryAmountForWriteOff(trx, actor.organisationId, writeOff.id), this.usablePaymentAmount(trx, actor.organisationId, payment.id, payment.amount)]);
			const remainingWriteOff = positiveOrZero(subtractMoney(writeOff.amount, recovered));
			if (parseScaledDecimal(amount, 4, 'Recovery amount', true) > parseScaledDecimal(remainingWriteOff, 4, 'Remaining write-off', true)) throw new FinanceValidationError('Recovery amount exceeds the remaining written-off amount.');
			if (parseScaledDecimal(amount, 4, 'Recovery amount', true) > parseScaledDecimal(usablePayment, 4, 'Usable payment', true)) throw new FinanceValidationError('Recovery amount exceeds the payment’s usable amount.');
			const publicId = this.publicIdFactory(); const now = this.now();
			await trx.insertInto('receivable_recoveries').values({ organisation_id: actor.organisationId, public_id: publicId, write_off_id: writeOff.id, payment_id: payment.id, amount, reason, recorded_by_member_id: membership.id, recovered_at: now }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, actionKey: 'finance.bad_debt.recovery.recorded', subjectType: 'receivable_recovery', subjectPublicId: publicId, correlationId: actor.correlationId, changeSummary: { writeOffPublicId: writeOff.publicId, paymentPublicId: payment.publicId, amount, currencyCode: writeOff.currencyCode, reason } });
			return publicId;
		});
	}

	async reverseRecovery(actor: TenantActorContext, input: { recoveryPublicId: string; reason: string }): Promise<void> {
		const reason = cleanFinanceText(input.reason, 1000, 'Recovery reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx); const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.recovery.reverse', trx)).allowed) throw new TenantAccessError('Recovery reversal is not permitted.');
			const recovery = await trx.selectFrom('receivable_recoveries').select(['id','public_id as publicId','payment_id as paymentId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', input.recoveryPublicId.trim()).forUpdate().executeTakeFirst();
			if (!recovery) throw new RecordNotFoundError('Recovery not found.');
			if (await trx.selectFrom('receivable_recovery_reversals').select('id').where('organisation_id', '=', actor.organisationId).where('recovery_id', '=', recovery.id).executeTakeFirst()) return;
			const publicId = this.publicIdFactory(); const now = this.now();
			await trx.insertInto('receivable_recovery_reversals').values({ organisation_id: actor.organisationId, public_id: publicId, recovery_id: recovery.id, reason, reversed_by_member_id: membership.id, reversed_at: now }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, actionKey: 'finance.bad_debt.recovery.reversed', subjectType: 'receivable_recovery', subjectPublicId: recovery.publicId, correlationId: actor.correlationId, changeSummary: { reversalPublicId: publicId, reason } });
		});
	}
}
