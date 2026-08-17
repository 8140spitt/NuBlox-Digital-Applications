import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { parseScaledDecimal, subtractMoney } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, cleanFinanceText, validateMoneyAmount } from './finance-common';
import { issuedInvoiceOutstanding } from './receivable-ledger';
import {
	activeRecoveryAmountForWriteOff,
	availablePaymentAmount,
	badDebtCaseByPublicId,
	badDebtInvoiceById,
	lockBadDebtCustomerThenInvoice,
	paymentIsReversed
} from './bad-debt-common';

const TAX_TREATMENT_POLICIES = new Set(['no_tax_adjustment', 'separate_tax_adjustment_required']);

function cleanPublicId(value: string, label: string): string {
	return cleanFinanceText(value, 64, label, true)!;
}

function validateTaxTreatment(value: string): string {
	const policy = value.trim();
	if (!TAX_TREATMENT_POLICIES.has(policy)) throw new FinanceValidationError('Write-off tax treatment is invalid.');
	return policy;
}

function positiveOrZero(value: string): string {
	return parseScaledDecimal(value, 4, 'Money amount', true) > 0n ? value : '0.0000';
}

export class BadDebtMutationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	async startCase(actor: TenantActorContext, input: { invoicePublicId: string; reason: string }): Promise<{ publicId: string }> {
		const invoicePublicId = cleanPublicId(input.invoicePublicId, 'Invoice ID');
		const reason = cleanFinanceText(input.reason, 1000, 'Bad-debt case reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.case.manage', trx)).allowed) throw new TenantAccessError('Bad-debt case management is not permitted.');
			const invoice = await lockBadDebtCustomerThenInvoice(trx, actor.organisationId, invoicePublicId);
			if (invoice.lifecycleStatus !== 'issued' || !invoice.documentNumber) throw new FinanceValidationError('Bad-debt assessment requires an issued invoice.');
			const existing = await trx.selectFrom('receivable_bad_debt_cases').select('public_id as publicId').where('organisation_id', '=', actor.organisationId).where('invoice_document_id', '=', invoice.id).where('status', '=', 'open').forUpdate().executeTakeFirst();
			if (existing) return { publicId: existing.publicId };
			const position = await issuedInvoiceOutstanding(trx, actor.organisationId, invoice.id);
			if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) throw new FinanceValidationError('The invoice has no receivable remaining for bad-debt assessment.');
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_bad_debt_cases').values({ organisation_id: actor.organisationId, public_id: publicId, customer_party_id: invoice.customerPartyId, invoice_document_id: invoice.id, status: 'open', opening_reason: reason, opened_by_member_id: membership.id, opened_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.case.opened', subjectType: 'bad_debt_case', subjectPublicId: publicId, correlationId: actor.correlationId, changeSummary: { invoicePublicId, invoiceNumber: invoice.documentNumber, outstandingAmount: position.outstandingAmount, reason } });
			return { publicId };
		});
	}

	async recommendWriteOff(actor: TenantActorContext, input: { casePublicId: string; amount: string; reason: string }): Promise<{ publicId: string }> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const amount = validateMoneyAmount(input.amount, 'Recommended write-off amount');
		const reason = cleanFinanceText(input.reason, 1000, 'Write-off recommendation reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.recommend', trx)).allowed) throw new TenantAccessError('Bad-debt write-off recommendation is not permitted.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId, true);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			if (caseRecord.status !== 'open') throw new FinanceValidationError('Only an open bad-debt case can receive a recommendation.');
			const invoice = await badDebtInvoiceById(trx, actor.organisationId, caseRecord.invoiceDocumentId);
			if (!invoice) throw new RecordNotFoundError('Bad-debt case not found.');
			await trx.selectFrom('parties').select('id').where('organisation_id', '=', actor.organisationId).where('id', '=', invoice.customerPartyId).forUpdate().executeTakeFirstOrThrow();
			const lockedInvoice = await badDebtInvoiceById(trx, actor.organisationId, invoice.id, true);
			if (!lockedInvoice || lockedInvoice.lifecycleStatus !== 'issued') throw new FinanceValidationError('The source invoice is no longer available for bad-debt assessment.');
			const position = await issuedInvoiceOutstanding(trx, actor.organisationId, invoice.id);
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true)) throw new FinanceValidationError(`Recommendation exceeds the current invoice outstanding balance of ${positiveOrZero(position.outstandingAmount)}.`);
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_bad_debt_recommendations').values({ organisation_id: actor.organisationId, public_id: publicId, bad_debt_case_id: caseRecord.id, invoice_document_id: invoice.id, recommended_amount: amount, reason, recommended_by_member_id: membership.id, recommended_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.write_off.recommended', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { recommendationPublicId: publicId, invoicePublicId: invoice.publicId, amount, reason } });
			return { publicId };
		});
	}

	async authoriseWriteOff(actor: TenantActorContext, input: { casePublicId: string; recommendationPublicId: string; taxTreatmentPolicy: string; reason: string }): Promise<{ publicId: string }> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const recommendationPublicId = cleanPublicId(input.recommendationPublicId, 'Recommendation ID');
		const taxTreatmentPolicy = validateTaxTreatment(input.taxTreatmentPolicy);
		const reason = cleanFinanceText(input.reason, 1000, 'Write-off authorisation reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.write_off.authorise', trx)).allowed) throw new TenantAccessError('Bad-debt write-off authorisation is not permitted.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId, true);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			if (caseRecord.status !== 'open') throw new FinanceValidationError('Write-off authorisation requires an open bad-debt case.');
			const invoice = await badDebtInvoiceById(trx, actor.organisationId, caseRecord.invoiceDocumentId);
			if (!invoice) throw new RecordNotFoundError('Bad-debt case not found.');
			await trx.selectFrom('parties').select('id').where('organisation_id', '=', actor.organisationId).where('id', '=', invoice.customerPartyId).forUpdate().executeTakeFirstOrThrow();
			const lockedInvoice = await badDebtInvoiceById(trx, actor.organisationId, invoice.id, true);
			if (!lockedInvoice || lockedInvoice.lifecycleStatus !== 'issued') throw new FinanceValidationError('The source invoice is no longer available for write-off.');
			const recommendation = await trx.selectFrom('receivable_bad_debt_recommendations').select(['id', 'recommended_amount as amount']).where('organisation_id', '=', actor.organisationId).where('bad_debt_case_id', '=', caseRecord.id).where('invoice_document_id', '=', invoice.id).where('public_id', '=', recommendationPublicId).forUpdate().executeTakeFirst();
			if (!recommendation) throw new RecordNotFoundError('Write-off recommendation not found.');
			const existing = await trx.selectFrom('receivable_write_offs').select('public_id as publicId').where('organisation_id', '=', actor.organisationId).where('recommendation_id', '=', recommendation.id).executeTakeFirst();
			if (existing) return { publicId: existing.publicId };
			const position = await issuedInvoiceOutstanding(trx, actor.organisationId, invoice.id);
			if (parseScaledDecimal(recommendation.amount, 4) > parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true)) throw new FinanceValidationError(`Recommended write-off exceeds the current invoice outstanding balance of ${positiveOrZero(position.outstandingAmount)}.`);
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_write_offs').values({ organisation_id: actor.organisationId, public_id: publicId, bad_debt_case_id: caseRecord.id, recommendation_id: recommendation.id, invoice_document_id: invoice.id, write_off_amount: recommendation.amount, tax_treatment_policy: taxTreatmentPolicy, reason, authorised_by_member_id: membership.id, authorised_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.write_off.authorised', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { writeOffPublicId: publicId, recommendationPublicId, invoicePublicId: invoice.publicId, amount: recommendation.amount, taxTreatmentPolicy, reason } });
			return { publicId };
		});
	}

	async reverseWriteOff(actor: TenantActorContext, input: { casePublicId: string; writeOffPublicId: string; reason: string }): Promise<void> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const writeOffPublicId = cleanPublicId(input.writeOffPublicId, 'Write-off ID');
		const reason = cleanFinanceText(input.reason, 1000, 'Write-off reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.write_off.reverse', trx)).allowed) throw new TenantAccessError('Bad-debt write-off reversal is not permitted.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId, true);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			const writeOff = await trx.selectFrom('receivable_write_offs').select(['id', 'write_off_amount as amount']).where('organisation_id', '=', actor.organisationId).where('bad_debt_case_id', '=', caseRecord.id).where('public_id', '=', writeOffPublicId).forUpdate().executeTakeFirst();
			if (!writeOff) throw new RecordNotFoundError('Write-off not found.');
			if (await trx.selectFrom('receivable_write_off_reversals').select('write_off_id').where('organisation_id', '=', actor.organisationId).where('write_off_id', '=', writeOff.id).executeTakeFirst()) throw new FinanceValidationError('The write-off is already reversed.');
			if (parseScaledDecimal(await activeRecoveryAmountForWriteOff(trx, actor.organisationId, writeOff.id), 4) > 0n) throw new FinanceValidationError('Reverse active bad-debt recoveries before reversing the write-off.');
			const reversedAt = this.now();
			await trx.insertInto('receivable_write_off_reversals').values({ write_off_id: writeOff.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.write_off.reversed', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { writeOffPublicId, amount: writeOff.amount, reason, reversedAt } });
		});
	}

	async recordRecovery(actor: TenantActorContext, input: { casePublicId: string; writeOffPublicId: string; paymentPublicId: string; amount: string; reason: string }): Promise<{ publicId: string }> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const writeOffPublicId = cleanPublicId(input.writeOffPublicId, 'Write-off ID');
		const paymentPublicId = cleanPublicId(input.paymentPublicId, 'Payment ID');
		const amount = validateMoneyAmount(input.amount, 'Recovery amount');
		const reason = cleanFinanceText(input.reason, 1000, 'Recovery reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.recovery.record', trx)).allowed) throw new TenantAccessError('Bad-debt recovery recording is not permitted.');
			const payment = await trx.selectFrom('payments').select(['id', 'public_id as publicId', 'amount', 'currency_code as currencyCode']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', paymentPublicId).forUpdate().executeTakeFirst();
			if (!payment) throw new RecordNotFoundError('Payment not found.');
			if (await paymentIsReversed(trx, actor.organisationId, payment.id)) throw new FinanceValidationError('A reversed payment cannot fund a bad-debt recovery.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			const invoice = await badDebtInvoiceById(trx, actor.organisationId, caseRecord.invoiceDocumentId);
			if (!invoice) throw new RecordNotFoundError('Bad-debt case not found.');
			if (payment.currencyCode !== invoice.currencyCode) throw new FinanceValidationError('Recovery payment and written-off invoice currency must match.');
			const writeOff = await trx.selectFrom('receivable_write_offs').select(['id', 'write_off_amount as amount']).where('organisation_id', '=', actor.organisationId).where('bad_debt_case_id', '=', caseRecord.id).where('public_id', '=', writeOffPublicId).forUpdate().executeTakeFirst();
			if (!writeOff) throw new RecordNotFoundError('Write-off not found.');
			if (await trx.selectFrom('receivable_write_off_reversals').select('write_off_id').where('organisation_id', '=', actor.organisationId).where('write_off_id', '=', writeOff.id).executeTakeFirst()) throw new FinanceValidationError('A reversed write-off cannot receive recovery.');
			const availability = await availablePaymentAmount(trx, actor.organisationId, payment.id, payment.amount);
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(availability.availableAmount, 4, 'Available payment', true)) throw new FinanceValidationError(`Recovery exceeds the remaining ${positiveOrZero(availability.availableAmount)} available on the payment.`);
			const activeWriteOffRecovery = await activeRecoveryAmountForWriteOff(trx, actor.organisationId, writeOff.id);
			const writeOffAvailable = subtractMoney(writeOff.amount, activeWriteOffRecovery);
			if (parseScaledDecimal(amount, 4) > parseScaledDecimal(writeOffAvailable, 4, 'Recoverable write-off', true)) throw new FinanceValidationError(`Recovery exceeds the remaining ${positiveOrZero(writeOffAvailable)} recoverable against the write-off.`);
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_write_off_recoveries').values({ organisation_id: actor.organisationId, public_id: publicId, write_off_id: writeOff.id, payment_id: payment.id, recovered_amount: amount, reason, recorded_by_member_id: membership.id, recovered_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.recovery.recorded', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { recoveryPublicId: publicId, writeOffPublicId, paymentPublicId, amount, currencyCode: payment.currencyCode, reason } });
			return { publicId };
		});
	}

	async reverseRecovery(actor: TenantActorContext, input: { casePublicId: string; recoveryPublicId: string; reason: string }): Promise<void> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const recoveryPublicId = cleanPublicId(input.recoveryPublicId, 'Recovery ID');
		const reason = cleanFinanceText(input.reason, 1000, 'Recovery reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.recovery.reverse', trx)).allowed) throw new TenantAccessError('Bad-debt recovery reversal is not permitted.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			const recoveryIdentity = await trx.selectFrom('receivable_write_off_recoveries as recovery').innerJoin('receivable_write_offs as writeOff', (join) => join.onRef('writeOff.id', '=', 'recovery.write_off_id').onRef('writeOff.organisation_id', '=', 'recovery.organisation_id')).select(['recovery.id', 'recovery.payment_id as paymentId']).where('recovery.organisation_id', '=', actor.organisationId).where('writeOff.bad_debt_case_id', '=', caseRecord.id).where('recovery.public_id', '=', recoveryPublicId).executeTakeFirst();
			if (!recoveryIdentity) throw new RecordNotFoundError('Bad-debt recovery not found.');
			await trx.selectFrom('payments').select('id').where('organisation_id', '=', actor.organisationId).where('id', '=', recoveryIdentity.paymentId).forUpdate().executeTakeFirstOrThrow();
			const recovery = await trx.selectFrom('receivable_write_off_recoveries').select(['id', 'recovered_amount as amount']).where('organisation_id', '=', actor.organisationId).where('id', '=', recoveryIdentity.id).forUpdate().executeTakeFirstOrThrow();
			if (await trx.selectFrom('receivable_write_off_recovery_reversals').select('recovery_id').where('organisation_id', '=', actor.organisationId).where('recovery_id', '=', recovery.id).executeTakeFirst()) throw new FinanceValidationError('The recovery is already reversed.');
			const reversedAt = this.now();
			await trx.insertInto('receivable_write_off_recovery_reversals').values({ recovery_id: recovery.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.recovery.reversed', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { recoveryPublicId, amount: recovery.amount, reason, reversedAt } });
		});
	}

	async closeCase(actor: TenantActorContext, input: { casePublicId: string; reason: string }): Promise<void> {
		const casePublicId = cleanPublicId(input.casePublicId, 'Bad-debt case ID');
		const reason = cleanFinanceText(input.reason, 1000, 'Bad-debt case close reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const access = new FinanceAccessPolicy(trx);
			const membership = await access.assertActiveActor(actor, trx);
			if (!(await access.mutationDecision(actor, 'finance.bad_debt.case.manage', trx)).allowed) throw new TenantAccessError('Bad-debt case management is not permitted.');
			const caseRecord = await badDebtCaseByPublicId(trx, actor.organisationId, casePublicId, true);
			if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
			if (caseRecord.status === 'closed') return;
			const closedAt = this.now();
			await trx.updateTable('receivable_bad_debt_cases').set({ status: 'closed', close_reason: reason, closed_by_member_id: membership.id, closed_at: closedAt }).where('organisation_id', '=', actor.organisationId).where('id', '=', caseRecord.id).where('status', '=', 'open').executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.bad_debt.case.closed', subjectType: 'bad_debt_case', subjectPublicId: casePublicId, correlationId: actor.correlationId, changeSummary: { reason, closedAt } });
		});
	}
}
