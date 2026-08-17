import { parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, cleanFinanceText } from './finance-common';
import { issuedInvoiceOutstanding } from './receivable-ledger';
import {
	activeRecoveryAmountForWriteOff,
	availablePaymentAmount,
	badDebtCaseByPublicId,
	badDebtInvoiceById,
	badDebtInvoiceByPublicId,
	paymentIsReversed,
	type BadDebtCaseRecord
} from './bad-debt-common';

export type BadDebtInvoiceCandidate = {
	invoicePublicId: string;
	invoiceNumber: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	currencyCode: string;
	dueDate: Date | null;
	outstandingAmount: string;
};

export type BadDebtCaseSummary = {
	publicId: string;
	status: string;
	invoicePublicId: string;
	invoiceNumber: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	currencyCode: string;
	openingReason: string;
	openedAt: Date;
	closeReason: string | null;
	closedAt: Date | null;
	outstandingAmount: string;
};

export type BadDebtRecommendationSummary = {
	publicId: string;
	amount: string;
	reason: string;
	recommendedAt: Date;
	isUsed: boolean;
};

export type BadDebtWriteOffSummary = {
	publicId: string;
	recommendationPublicId: string;
	amount: string;
	taxTreatmentPolicy: string;
	reason: string;
	authorisedAt: Date;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
	activeRecoveryAmount: string;
};

export type BadDebtRecoverySummary = {
	publicId: string;
	writeOffPublicId: string;
	paymentPublicId: string;
	paymentReference: string | null;
	amount: string;
	reason: string;
	recoveredAt: Date;
	isReversed: boolean;
	reversedAt: Date | null;
	reversalReason: string | null;
};

export type BadDebtPaymentCandidate = {
	paymentPublicId: string;
	paymentReference: string | null;
	receivedAt: Date;
	currencyCode: string;
	paymentAmount: string;
	activeAllocatedAmount: string;
	activeRecoveryAmount: string;
	availableAmount: string;
};

export type BadDebtPortfolio = {
	cases: BadDebtCaseSummary[];
	invoiceCandidates: BadDebtInvoiceCandidate[];
	canStartCase: boolean;
};

export type BadDebtWorkspace = {
	case: BadDebtCaseSummary;
	recommendations: BadDebtRecommendationSummary[];
	writeOffs: BadDebtWriteOffSummary[];
	recoveries: BadDebtRecoverySummary[];
	paymentCandidates: BadDebtPaymentCandidate[];
	canManageCase: boolean;
	canRecommend: boolean;
	canAuthoriseWriteOff: boolean;
	canReverseWriteOff: boolean;
	canRecordRecovery: boolean;
	canReverseRecovery: boolean;
};

function cleanPublicId(value: string, label: string): string {
	return cleanFinanceText(value, 64, label, true)!;
}

export class BadDebtQueryService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async assertView(actor: import('$lib/server/auth/tenant-actor-context').TenantActorContext): Promise<void> {
		const access = new FinanceAccessPolicy(this.db);
		await access.assertActiveActor(actor);
		const [financeView, badDebtView] = await Promise.all([access.viewDecision(actor), access.badDebtViewDecision(actor)]);
		if (!financeView.allowed || !badDebtView.allowed) throw new TenantAccessError('Bad-debt viewing is not permitted.');
	}

	private async caseSummary(organisationId: string, caseRecord: BadDebtCaseRecord): Promise<BadDebtCaseSummary> {
		const invoice = await badDebtInvoiceById(this.db, organisationId, caseRecord.invoiceDocumentId);
		if (!invoice) throw new Error('Bad-debt case invoice is unavailable.');
		const position = invoice.lifecycleStatus === 'issued' ? await issuedInvoiceOutstanding(this.db, organisationId, invoice.id) : null;
		return {
			publicId: caseRecord.publicId,
			status: caseRecord.status,
			invoicePublicId: invoice.publicId,
			invoiceNumber: invoice.documentNumber ?? 'Invoice',
			customerPartyPublicId: invoice.customerPartyPublicId,
			customerDisplayName: invoice.customerDisplayName,
			currencyCode: invoice.currencyCode,
			openingReason: caseRecord.openingReason,
			openedAt: caseRecord.openedAt,
			closeReason: caseRecord.closeReason,
			closedAt: caseRecord.closedAt,
			outstandingAmount: position && parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) > 0n ? position.outstandingAmount : '0.0000'
		};
	}

	private async recommendations(organisationId: string, caseId: string): Promise<BadDebtRecommendationSummary[]> {
		const rows = await this.db.selectFrom('receivable_bad_debt_recommendations as recommendation')
			.leftJoin('receivable_write_offs as writeOff', (join) => join.onRef('writeOff.recommendation_id', '=', 'recommendation.id').onRef('writeOff.organisation_id', '=', 'recommendation.organisation_id'))
			.select(['recommendation.public_id as publicId', 'recommendation.recommended_amount as amount', 'recommendation.reason', 'recommendation.recommended_at as recommendedAt', 'writeOff.id as writeOffId'])
			.where('recommendation.organisation_id', '=', organisationId).where('recommendation.bad_debt_case_id', '=', caseId)
			.orderBy('recommendation.recommended_at', 'asc').orderBy('recommendation.id', 'asc').execute();
		return rows.map((row) => ({ publicId: row.publicId, amount: row.amount, reason: row.reason, recommendedAt: row.recommendedAt, isUsed: row.writeOffId !== null }));
	}

	private async writeOffs(organisationId: string, caseId: string): Promise<BadDebtWriteOffSummary[]> {
		const rows = await this.db.selectFrom('receivable_write_offs as writeOff')
			.innerJoin('receivable_bad_debt_recommendations as recommendation', (join) => join.onRef('recommendation.id', '=', 'writeOff.recommendation_id').onRef('recommendation.organisation_id', '=', 'writeOff.organisation_id'))
			.leftJoin('receivable_write_off_reversals as reversal', (join) => join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id'))
			.select(['writeOff.id as id', 'writeOff.public_id as publicId', 'recommendation.public_id as recommendationPublicId', 'writeOff.write_off_amount as amount', 'writeOff.tax_treatment_policy as taxTreatmentPolicy', 'writeOff.reason', 'writeOff.authorised_at as authorisedAt', 'reversal.reversed_at as reversedAt', 'reversal.reason as reversalReason'])
			.where('writeOff.organisation_id', '=', organisationId).where('writeOff.bad_debt_case_id', '=', caseId)
			.orderBy('writeOff.authorised_at', 'asc').orderBy('writeOff.id', 'asc').execute();
		const result: BadDebtWriteOffSummary[] = [];
		for (const row of rows) result.push({ publicId: row.publicId, recommendationPublicId: row.recommendationPublicId, amount: row.amount, taxTreatmentPolicy: row.taxTreatmentPolicy, reason: row.reason, authorisedAt: row.authorisedAt, isReversed: row.reversedAt !== null, reversedAt: row.reversedAt, reversalReason: row.reversalReason, activeRecoveryAmount: await activeRecoveryAmountForWriteOff(this.db, organisationId, row.id) });
		return result;
	}

	private async recoveries(organisationId: string, caseId: string): Promise<BadDebtRecoverySummary[]> {
		const rows = await this.db.selectFrom('receivable_write_off_recoveries as recovery')
			.innerJoin('receivable_write_offs as writeOff', (join) => join.onRef('writeOff.id', '=', 'recovery.write_off_id').onRef('writeOff.organisation_id', '=', 'recovery.organisation_id'))
			.innerJoin('payments as payment', (join) => join.onRef('payment.id', '=', 'recovery.payment_id').onRef('payment.organisation_id', '=', 'recovery.organisation_id'))
			.leftJoin('receivable_write_off_recovery_reversals as reversal', (join) => join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id'))
			.select(['recovery.public_id as publicId', 'writeOff.public_id as writeOffPublicId', 'payment.public_id as paymentPublicId', 'payment.payment_reference as paymentReference', 'recovery.recovered_amount as amount', 'recovery.reason', 'recovery.recovered_at as recoveredAt', 'reversal.reversed_at as reversedAt', 'reversal.reason as reversalReason'])
			.where('recovery.organisation_id', '=', organisationId).where('writeOff.bad_debt_case_id', '=', caseId)
			.orderBy('recovery.recovered_at', 'asc').orderBy('recovery.id', 'asc').execute();
		return rows.map((row) => ({ publicId: row.publicId, writeOffPublicId: row.writeOffPublicId, paymentPublicId: row.paymentPublicId, paymentReference: row.paymentReference, amount: row.amount, reason: row.reason, recoveredAt: row.recoveredAt, isReversed: row.reversedAt !== null, reversedAt: row.reversedAt, reversalReason: row.reversalReason }));
	}

	private async paymentCandidates(organisationId: string, currencyCode: string): Promise<BadDebtPaymentCandidate[]> {
		const rows = await this.db.selectFrom('payments').select(['id', 'public_id as publicId', 'payment_reference as paymentReference', 'received_at as receivedAt', 'amount', 'currency_code as currencyCode'])
			.where('organisation_id', '=', organisationId).where('currency_code', '=', currencyCode).orderBy('received_at', 'desc').orderBy('id', 'desc').limit(250).execute();
		const result: BadDebtPaymentCandidate[] = [];
		for (const payment of rows) {
			if (await paymentIsReversed(this.db, organisationId, payment.id)) continue;
			const availability = await availablePaymentAmount(this.db, organisationId, payment.id, payment.amount);
			if (parseScaledDecimal(availability.availableAmount, 4, 'Available payment', true) <= 0n) continue;
			result.push({ paymentPublicId: payment.publicId, paymentReference: payment.paymentReference, receivedAt: payment.receivedAt, currencyCode: payment.currencyCode, paymentAmount: payment.amount, ...availability });
		}
		return result;
	}

	async getPortfolio(actor: import('$lib/server/auth/tenant-actor-context').TenantActorContext): Promise<BadDebtPortfolio> {
		await this.assertView(actor);
		const access = new FinanceAccessPolicy(this.db);
		const [caseDecision, caseRows, invoiceRows] = await Promise.all([
			access.mutationDecision(actor, 'finance.bad_debt.case.manage'),
			this.db.selectFrom('receivable_bad_debt_cases').select('public_id as publicId').where('organisation_id', '=', actor.organisationId).orderBy('opened_at', 'desc').orderBy('id', 'desc').limit(250).execute(),
			this.db.selectFrom('financial_documents').select('public_id as publicId').where('organisation_id', '=', actor.organisationId).where('document_kind', '=', 'invoice').where('lifecycle_status', '=', 'issued').orderBy('id', 'asc').execute()
		]);
		const cases: BadDebtCaseSummary[] = [];
		for (const row of caseRows) {
			const record = await badDebtCaseByPublicId(this.db, actor.organisationId, row.publicId);
			if (record) cases.push(await this.caseSummary(actor.organisationId, record));
		}
		const invoiceCandidates: BadDebtInvoiceCandidate[] = [];
		for (const row of invoiceRows) {
			const invoice = await badDebtInvoiceByPublicId(this.db, actor.organisationId, row.publicId);
			if (!invoice || !invoice.documentNumber) continue;
			const position = await issuedInvoiceOutstanding(this.db, actor.organisationId, invoice.id);
			if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) continue;
			const activeCase = await this.db.selectFrom('receivable_bad_debt_cases').select('id').where('organisation_id', '=', actor.organisationId).where('invoice_document_id', '=', invoice.id).where('status', '=', 'open').executeTakeFirst();
			if (activeCase) continue;
			invoiceCandidates.push({ invoicePublicId: invoice.publicId, invoiceNumber: invoice.documentNumber, customerPartyPublicId: invoice.customerPartyPublicId, customerDisplayName: invoice.customerDisplayName, currencyCode: invoice.currencyCode, dueDate: invoice.dueDate, outstandingAmount: position.outstandingAmount });
		}
		return { cases, invoiceCandidates, canStartCase: caseDecision.allowed };
	}

	async getWorkspace(actor: import('$lib/server/auth/tenant-actor-context').TenantActorContext, casePublicIdInput: string): Promise<BadDebtWorkspace> {
		await this.assertView(actor);
		const casePublicId = cleanPublicId(casePublicIdInput, 'Bad-debt case ID');
		const caseRecord = await badDebtCaseByPublicId(this.db, actor.organisationId, casePublicId);
		if (!caseRecord) throw new RecordNotFoundError('Bad-debt case not found.');
		const invoice = await badDebtInvoiceById(this.db, actor.organisationId, caseRecord.invoiceDocumentId);
		if (!invoice) throw new RecordNotFoundError('Bad-debt case not found.');
		const access = new FinanceAccessPolicy(this.db);
		const [recommendations, writeOffs, recoveries, paymentCandidates, caseDecision, recommendDecision, authoriseDecision, reverseWriteOffDecision, recoveryDecision, reverseRecoveryDecision] = await Promise.all([
			this.recommendations(actor.organisationId, caseRecord.id), this.writeOffs(actor.organisationId, caseRecord.id), this.recoveries(actor.organisationId, caseRecord.id), this.paymentCandidates(actor.organisationId, invoice.currencyCode),
			access.mutationDecision(actor, 'finance.bad_debt.case.manage'), access.mutationDecision(actor, 'finance.bad_debt.recommend'), access.mutationDecision(actor, 'finance.bad_debt.write_off.authorise'), access.mutationDecision(actor, 'finance.bad_debt.write_off.reverse'), access.mutationDecision(actor, 'finance.bad_debt.recovery.record'), access.mutationDecision(actor, 'finance.bad_debt.recovery.reverse')
		]);
		return { case: await this.caseSummary(actor.organisationId, caseRecord), recommendations, writeOffs, recoveries, paymentCandidates, canManageCase: caseDecision.allowed && caseRecord.status === 'open', canRecommend: recommendDecision.allowed && caseRecord.status === 'open', canAuthoriseWriteOff: authoriseDecision.allowed && caseRecord.status === 'open', canReverseWriteOff: reverseWriteOffDecision.allowed, canRecordRecovery: recoveryDecision.allowed, canReverseRecovery: reverseRecoveryDecision.allowed };
	}
}
