import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { activeRecoveryAmountForWriteOff, badDebtInvoiceById, paymentIsReversed } from './bad-debt-common';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	cleanFinanceText,
	insertedId,
	validateFinanceDate,
	validateMoneyAmount
} from './finance-common';

const MONEY_SCALE = 4;

type ClaimLineInput = {
	sourceInvoiceItemId: string;
	taxCategoryId: string;
	considerationBasisAmount: string;
};

export type TaxReliefSourceTaxLine = {
	sourceInvoiceItemId: string;
	lineNumber: number;
	description: string;
	taxCategoryId: string;
	taxCategoryCode: string;
	appliedRatePercent: string;
	taxableAmount: string;
	taxAmount: string;
	grossAmount: string;
	activeClaimedBasisAmount: string;
	availableBasisAmount: string;
};

export type TaxReliefWriteOffCandidate = {
	writeOffPublicId: string;
	writeOffAmount: string;
	authorisedAt: Date;
	invoicePublicId: string;
	invoiceNumber: string;
	invoiceDueDate: Date | null;
	customerName: string;
	activeRecoveryAmount: string;
	activeClaimBasisAmount: string;
	availableClaimBasisAmount: string;
	taxLines: TaxReliefSourceTaxLine[];
};

export type TaxReliefClaimWorkspaceRecord = {
	publicId: string;
	writeOffPublicId: string;
	invoicePublicId: string;
	invoiceNumber: string;
	preparedAt: Date;
	supplyDate: Date;
	paymentDueDate: Date;
	relevantDate: Date;
	eligibleFrom: Date;
	claimDeadline: Date;
	originalVatPeriodReference: string;
	reason: string;
	considerationBasisAmount: string;
	vatReliefAmount: string;
	status: 'prepared' | 'authorised' | 'reversed';
	authorisedAt: Date | null;
	reversedAt: Date | null;
	lines: TaxReliefSourceTaxLine[];
	repayments: Array<{
		publicId: string;
		recoveryPublicId: string;
		considerationPaymentAmount: string;
		vatRepaymentAmount: string;
		recordedAt: Date;
		reversedAt: Date | null;
	}>;
	postings: Array<{
		publicId: string;
		postingKind: string;
		vatReturnBox: number;
		vatReturnPeriodReference: string;
		vatReturnPeriodStart: Date;
		vatReturnPeriodEnd: Date;
		amount: string;
		externalReference: string | null;
		postedAt: Date;
		reversedAt: Date | null;
	}>;
};

export type TaxReliefWorkspace = {
	candidates: TaxReliefWriteOffCandidate[];
	claims: TaxReliefClaimWorkspaceRecord[];
	canPrepare: boolean;
	canAuthorise: boolean;
	canReverse: boolean;
	canRecordRepayment: boolean;
	canReverseRepayment: boolean;
	canPost: boolean;
	canReversePosting: boolean;
};

function cleanPublicId(value: string, label: string): string {
	return cleanFinanceText(value, 64, label, true)!;
}

function money(value: string, label = 'Amount'): bigint {
	return parseScaledDecimal(value, MONEY_SCALE, label, true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, MONEY_SCALE);
}

function addMonthsUtc(date: Date, months: number): Date {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth();
	const day = date.getUTCDate();
	const first = new Date(Date.UTC(year, month + months, 1));
	const endOfTargetMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
	return new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(day, endOfTargetMonth)));
}

function laterDate(a: Date, b: Date): Date {
	return a >= b ? new Date(a) : new Date(b);
}

function dateOnly(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function vatForConsiderationBasis(basisAmount: string, taxableAmount: string, taxAmount: string): string {
	const basis = money(basisAmount, 'Consideration basis');
	const taxable = money(taxableAmount, 'Source taxable amount');
	const tax = money(taxAmount, 'Source VAT amount');
	const gross = taxable + tax;
	if (basis <= 0n || tax <= 0n || gross <= 0n || basis > gross) {
		throw new FinanceValidationError('VAT relief basis is incompatible with the source tax snapshot.');
	}
	const rounded = (tax * basis + gross / 2n) / gross;
	if (rounded <= 0n) throw new FinanceValidationError('VAT relief amount rounds to zero.');
	return moneyText(rounded > tax ? tax : rounded);
}

async function activeClaimTotalsForWriteOff(db: DatabaseExecutor, organisationId: string, writeOffId: string, excludeClaimId?: string) {
	let query = db
		.selectFrom('receivable_vat_bad_debt_claims as claim')
		.innerJoin('receivable_vat_bad_debt_claim_authorisations as authorisation', (join) =>
			join.onRef('authorisation.claim_id', '=', 'claim.id').onRef('authorisation.organisation_id', '=', 'claim.organisation_id')
		)
		.leftJoin('receivable_vat_bad_debt_claim_reversals as reversal', (join) =>
			join.onRef('reversal.claim_id', '=', 'claim.id').onRef('reversal.organisation_id', '=', 'claim.organisation_id')
		)
		.innerJoin('receivable_vat_bad_debt_claim_lines as line', (join) =>
			join.onRef('line.claim_id', '=', 'claim.id').onRef('line.organisation_id', '=', 'claim.organisation_id')
		)
		.select(['claim.id as claimId', 'line.consideration_basis_amount as basisAmount', 'line.vat_relief_amount as vatAmount'])
		.where('claim.organisation_id', '=', organisationId)
		.where('claim.write_off_id', '=', writeOffId)
		.where('reversal.claim_id', 'is', null);
	if (excludeClaimId) query = query.where('claim.id', '!=', excludeClaimId);
	const rows = await query.execute();
	let basis = 0n;
	let vat = 0n;
	for (const row of rows) {
		basis += money(row.basisAmount);
		vat += money(row.vatAmount);
	}
	return { basis, vat };
}

async function activeClaimBasisForTaxSource(
	db: DatabaseExecutor,
	organisationId: string,
	invoiceItemId: string,
	taxCategoryId: string,
	excludeClaimId?: string
): Promise<bigint> {
	let query = db
		.selectFrom('receivable_vat_bad_debt_claim_lines as line')
		.innerJoin('receivable_vat_bad_debt_claims as claim', (join) =>
			join.onRef('claim.id', '=', 'line.claim_id').onRef('claim.organisation_id', '=', 'line.organisation_id')
		)
		.innerJoin('receivable_vat_bad_debt_claim_authorisations as authorisation', (join) =>
			join.onRef('authorisation.claim_id', '=', 'claim.id').onRef('authorisation.organisation_id', '=', 'claim.organisation_id')
		)
		.leftJoin('receivable_vat_bad_debt_claim_reversals as reversal', (join) =>
			join.onRef('reversal.claim_id', '=', 'claim.id').onRef('reversal.organisation_id', '=', 'claim.organisation_id')
		)
		.select('line.consideration_basis_amount as basisAmount')
		.where('line.organisation_id', '=', organisationId)
		.where('line.source_invoice_item_id', '=', invoiceItemId)
		.where('line.tax_category_id', '=', taxCategoryId)
		.where('reversal.claim_id', 'is', null);
	if (excludeClaimId) query = query.where('claim.id', '!=', excludeClaimId);
	const rows = await query.execute();
	return rows.reduce((total, row) => total + money(row.basisAmount), 0n);
}

async function claimTotals(db: DatabaseExecutor, organisationId: string, claimId: string) {
	const rows = await db
		.selectFrom('receivable_vat_bad_debt_claim_lines')
		.select(['consideration_basis_amount as basisAmount', 'vat_relief_amount as vatAmount'])
		.where('organisation_id', '=', organisationId)
		.where('claim_id', '=', claimId)
		.execute();
	let basis = 0n;
	let vat = 0n;
	for (const row of rows) {
		basis += money(row.basisAmount);
		vat += money(row.vatAmount);
	}
	return { basis, vat };
}

async function activeRepaymentTotalsForClaim(db: DatabaseExecutor, organisationId: string, claimId: string) {
	const rows = await db
		.selectFrom('receivable_vat_bad_debt_repayments as repayment')
		.leftJoin('receivable_vat_bad_debt_repayment_reversals as reversal', (join) =>
			join.onRef('reversal.repayment_id', '=', 'repayment.id').onRef('reversal.organisation_id', '=', 'repayment.organisation_id')
		)
		.select(['repayment.consideration_payment_amount as considerationAmount', 'repayment.vat_repayment_amount as vatAmount'])
		.where('repayment.organisation_id', '=', organisationId)
		.where('repayment.claim_id', '=', claimId)
		.where('reversal.repayment_id', 'is', null)
		.execute();
	let consideration = 0n;
	let vat = 0n;
	for (const row of rows) {
		consideration += money(row.considerationAmount);
		vat += money(row.vatAmount);
	}
	return { consideration, vat };
}

async function activeRepaymentConsiderationForRecovery(db: DatabaseExecutor, organisationId: string, recoveryId: string) {
	const rows = await db
		.selectFrom('receivable_vat_bad_debt_repayments as repayment')
		.leftJoin('receivable_vat_bad_debt_repayment_reversals as reversal', (join) =>
			join.onRef('reversal.repayment_id', '=', 'repayment.id').onRef('reversal.organisation_id', '=', 'repayment.organisation_id')
		)
		.select('repayment.consideration_payment_amount as considerationAmount')
		.where('repayment.organisation_id', '=', organisationId)
		.where('repayment.recovery_id', '=', recoveryId)
		.where('reversal.repayment_id', 'is', null)
		.execute();
	return rows.reduce((total, row) => total + money(row.considerationAmount), 0n);
}

async function activePostingsForSource(db: DatabaseExecutor, organisationId: string, source: { claimId?: string; repaymentId?: string }) {
	let query = db
		.selectFrom('receivable_vat_return_postings as posting')
		.leftJoin('receivable_vat_return_posting_reversals as reversal', (join) =>
			join.onRef('reversal.posting_id', '=', 'posting.id').onRef('reversal.organisation_id', '=', 'posting.organisation_id')
		)
		.select(['posting.id', 'posting.public_id as publicId'])
		.where('posting.organisation_id', '=', organisationId)
		.where('reversal.posting_id', 'is', null);
	if (source.claimId) query = query.where('posting.claim_id', '=', source.claimId);
	if (source.repaymentId) query = query.where('posting.repayment_id', '=', source.repaymentId);
	return query.execute();
}

export class TaxReliefService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertView(actor: TenantActorContext): Promise<FinanceAccessPolicy> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed || !(await policy.taxReliefViewDecision(actor)).allowed) {
			throw new TenantAccessError('VAT bad-debt relief viewing is not permitted.');
		}
		return policy;
	}

	async getWorkspace(actor: TenantActorContext): Promise<TaxReliefWorkspace> {
		const policy = await this.assertView(actor);
		const decisions = await Promise.all([
			policy.mutationDecision(actor, 'finance.tax_relief.prepare'),
			policy.mutationDecision(actor, 'finance.tax_relief.authorise'),
			policy.mutationDecision(actor, 'finance.tax_relief.reverse'),
			policy.mutationDecision(actor, 'finance.tax_relief.repayment.record'),
			policy.mutationDecision(actor, 'finance.tax_relief.repayment.reverse'),
			policy.mutationDecision(actor, 'finance.tax_relief.post'),
			policy.mutationDecision(actor, 'finance.tax_relief.post.reverse')
		]);

		const writeOffRows = await this.db
			.selectFrom('receivable_write_offs as writeOff')
			.innerJoin('financial_documents as invoice', (join) =>
				join.onRef('invoice.id', '=', 'writeOff.invoice_document_id').onRef('invoice.organisation_id', '=', 'writeOff.organisation_id')
			)
			.innerJoin('invoices as invoiceDetail', (join) =>
				join.onRef('invoiceDetail.financial_document_id', '=', 'invoice.id').onRef('invoiceDetail.organisation_id', '=', 'invoice.organisation_id')
			)
			.innerJoin('parties as customer', (join) =>
				join.onRef('customer.id', '=', 'invoice.customer_party_id').onRef('customer.organisation_id', '=', 'invoice.organisation_id')
			)
			.leftJoin('party_organisations as customerOrganisation', (join) =>
				join.onRef('customerOrganisation.party_id', '=', 'customer.id').onRef('customerOrganisation.organisation_id', '=', 'customer.organisation_id')
			)
			.leftJoin('receivable_write_off_reversals as reversal', (join) =>
				join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id')
			)
			.select([
				'writeOff.id', 'writeOff.public_id as writeOffPublicId', 'writeOff.write_off_amount as writeOffAmount', 'writeOff.authorised_at as authorisedAt',
				'invoice.id as invoiceId', 'invoice.public_id as invoicePublicId', 'invoice.document_number as invoiceNumber',
				'invoiceDetail.due_date as invoiceDueDate', 'customerOrganisation.legal_name as customerLegalName'
			])
			.where('writeOff.organisation_id', '=', actor.organisationId)
			.where('writeOff.tax_treatment_policy', '=', 'separate_tax_adjustment_required')
			.where('invoice.lifecycle_status', '=', 'issued')
			.where('reversal.write_off_id', 'is', null)
			.orderBy('writeOff.authorised_at', 'desc')
			.execute();

		const candidates: TaxReliefWriteOffCandidate[] = [];
		for (const row of writeOffRows) {
			const sourceRows = await this.db
				.selectFrom('financial_document_items as item')
				.innerJoin('financial_document_item_taxes as tax', (join) =>
					join.onRef('tax.financial_document_item_id', '=', 'item.id').onRef('tax.organisation_id', '=', 'item.organisation_id')
				)
				.innerJoin('tax_categories as category', (join) =>
					join.onRef('category.id', '=', 'tax.tax_category_id').onRef('category.organisation_id', '=', 'tax.organisation_id')
				)
				.select([
					'item.id as sourceInvoiceItemId', 'item.line_number as lineNumber', 'item.description',
					'tax.tax_category_id as taxCategoryId', 'category.code as taxCategoryCode', 'tax.applied_rate_percent as appliedRatePercent',
					'tax.taxable_amount as taxableAmount', 'tax.tax_amount as taxAmount'
				])
				.where('item.organisation_id', '=', actor.organisationId)
				.where('item.financial_document_id', '=', row.invoiceId)
				.orderBy('item.line_number', 'asc')
				.orderBy('tax.sort_order', 'asc')
				.execute();
			const taxLines: TaxReliefSourceTaxLine[] = [];
			for (const source of sourceRows) {
				const gross = money(source.taxableAmount) + money(source.taxAmount);
				const activeBasis = await activeClaimBasisForTaxSource(this.db, actor.organisationId, source.sourceInvoiceItemId, source.taxCategoryId);
				if (money(source.taxAmount) <= 0n) continue;
				taxLines.push({
					sourceInvoiceItemId: source.sourceInvoiceItemId,
					lineNumber: source.lineNumber,
					description: source.description,
					taxCategoryId: source.taxCategoryId,
					taxCategoryCode: source.taxCategoryCode,
					appliedRatePercent: source.appliedRatePercent,
					taxableAmount: source.taxableAmount,
					taxAmount: source.taxAmount,
					grossAmount: moneyText(gross),
					activeClaimedBasisAmount: moneyText(activeBasis),
					availableBasisAmount: moneyText(gross > activeBasis ? gross - activeBasis : 0n)
				});
			}
			const recovery = money(await activeRecoveryAmountForWriteOff(this.db, actor.organisationId, row.id));
			const claimed = (await activeClaimTotalsForWriteOff(this.db, actor.organisationId, row.id)).basis;
			const writeOffAmount = money(row.writeOffAmount);
			const available = writeOffAmount > recovery + claimed ? writeOffAmount - recovery - claimed : 0n;
			candidates.push({
				writeOffPublicId: row.writeOffPublicId,
				writeOffAmount: row.writeOffAmount,
				authorisedAt: row.authorisedAt,
				invoicePublicId: row.invoicePublicId,
				invoiceNumber: row.invoiceNumber ?? 'Unnumbered invoice',
				invoiceDueDate: row.invoiceDueDate,
				customerName: row.customerLegalName ?? 'Customer',
				activeRecoveryAmount: moneyText(recovery),
				activeClaimBasisAmount: moneyText(claimed),
				availableClaimBasisAmount: moneyText(available),
				taxLines
			});
		}

		const claimRows = await this.db
			.selectFrom('receivable_vat_bad_debt_claims as claim')
			.innerJoin('receivable_write_offs as writeOff', (join) =>
				join.onRef('writeOff.id', '=', 'claim.write_off_id').onRef('writeOff.organisation_id', '=', 'claim.organisation_id')
			)
			.innerJoin('financial_documents as invoice', (join) =>
				join.onRef('invoice.id', '=', 'claim.invoice_document_id').onRef('invoice.organisation_id', '=', 'claim.organisation_id')
			)
			.leftJoin('receivable_vat_bad_debt_claim_authorisations as authorisation', (join) =>
				join.onRef('authorisation.claim_id', '=', 'claim.id').onRef('authorisation.organisation_id', '=', 'claim.organisation_id')
			)
			.leftJoin('receivable_vat_bad_debt_claim_reversals as reversal', (join) =>
				join.onRef('reversal.claim_id', '=', 'claim.id').onRef('reversal.organisation_id', '=', 'claim.organisation_id')
			)
			.select([
				'claim.id', 'claim.public_id as publicId', 'claim.write_off_id as writeOffId', 'writeOff.public_id as writeOffPublicId',
				'claim.invoice_document_id as invoiceId', 'invoice.public_id as invoicePublicId', 'invoice.document_number as invoiceNumber',
				'claim.prepared_at as preparedAt', 'claim.supply_date as supplyDate', 'claim.payment_due_date as paymentDueDate',
				'claim.relevant_date as relevantDate', 'claim.eligible_from as eligibleFrom', 'claim.claim_deadline as claimDeadline',
				'claim.original_vat_period_reference as originalVatPeriodReference', 'claim.reason',
				'authorisation.authorised_at as authorisedAt', 'reversal.reversed_at as reversedAt'
			])
			.where('claim.organisation_id', '=', actor.organisationId)
			.orderBy('claim.prepared_at', 'desc')
			.execute();

		const claims: TaxReliefClaimWorkspaceRecord[] = [];
		for (const claim of claimRows) {
			const lineRows = await this.db
				.selectFrom('receivable_vat_bad_debt_claim_lines as line')
				.innerJoin('financial_document_items as item', (join) =>
					join.onRef('item.id', '=', 'line.source_invoice_item_id').onRef('item.organisation_id', '=', 'line.organisation_id')
				)
				.innerJoin('financial_document_item_taxes as tax', (join) =>
					join.onRef('tax.financial_document_item_id', '=', 'line.source_invoice_item_id')
						.onRef('tax.organisation_id', '=', 'line.organisation_id')
						.onRef('tax.tax_category_id', '=', 'line.tax_category_id')
				)
				.innerJoin('tax_categories as category', (join) =>
					join.onRef('category.id', '=', 'line.tax_category_id').onRef('category.organisation_id', '=', 'line.organisation_id')
				)
				.select([
					'line.source_invoice_item_id as sourceInvoiceItemId', 'item.line_number as lineNumber', 'item.description',
					'line.tax_category_id as taxCategoryId', 'category.code as taxCategoryCode', 'tax.applied_rate_percent as appliedRatePercent',
					'tax.taxable_amount as taxableAmount', 'tax.tax_amount as taxAmount',
					'line.consideration_basis_amount as claimBasis', 'line.vat_relief_amount as claimVat'
				])
				.where('line.organisation_id', '=', actor.organisationId)
				.where('line.claim_id', '=', claim.id)
				.orderBy('line.sort_order', 'asc')
				.execute();
			const lines: TaxReliefSourceTaxLine[] = lineRows.map((line) => ({
				sourceInvoiceItemId: line.sourceInvoiceItemId,
				lineNumber: line.lineNumber,
				description: line.description,
				taxCategoryId: line.taxCategoryId,
				taxCategoryCode: line.taxCategoryCode,
				appliedRatePercent: line.appliedRatePercent,
				taxableAmount: line.taxableAmount,
				taxAmount: line.taxAmount,
				grossAmount: moneyText(money(line.taxableAmount) + money(line.taxAmount)),
				activeClaimedBasisAmount: line.claimBasis,
				availableBasisAmount: line.claimVat
			}));
			const totals = await claimTotals(this.db, actor.organisationId, claim.id);
			const repayments = await this.db
				.selectFrom('receivable_vat_bad_debt_repayments as repayment')
				.innerJoin('receivable_write_off_recoveries as recovery', (join) =>
					join.onRef('recovery.id', '=', 'repayment.recovery_id').onRef('recovery.organisation_id', '=', 'repayment.organisation_id')
				)
				.leftJoin('receivable_vat_bad_debt_repayment_reversals as reversal', (join) =>
					join.onRef('reversal.repayment_id', '=', 'repayment.id').onRef('reversal.organisation_id', '=', 'repayment.organisation_id')
				)
				.select([
					'repayment.id', 'repayment.public_id as publicId', 'recovery.public_id as recoveryPublicId',
					'repayment.consideration_payment_amount as considerationPaymentAmount', 'repayment.vat_repayment_amount as vatRepaymentAmount',
					'repayment.recorded_at as recordedAt', 'reversal.reversed_at as reversedAt'
				])
				.where('repayment.organisation_id', '=', actor.organisationId)
				.where('repayment.claim_id', '=', claim.id)
				.orderBy('repayment.recorded_at', 'asc')
				.execute();
			const postings = await this.db
				.selectFrom('receivable_vat_return_postings as posting')
				.leftJoin('receivable_vat_return_posting_reversals as reversal', (join) =>
					join.onRef('reversal.posting_id', '=', 'posting.id').onRef('reversal.organisation_id', '=', 'posting.organisation_id')
				)
				.select([
					'posting.public_id as publicId', 'posting.posting_kind as postingKind', 'posting.vat_return_box as vatReturnBox',
					'posting.vat_return_period_reference as vatReturnPeriodReference', 'posting.vat_return_period_start as vatReturnPeriodStart',
					'posting.vat_return_period_end as vatReturnPeriodEnd', 'posting.amount', 'posting.external_reference as externalReference',
					'posting.posted_at as postedAt', 'reversal.reversed_at as reversedAt'
				])
				.where('posting.organisation_id', '=', actor.organisationId)
				.where((eb) => eb.or([
					eb('posting.claim_id', '=', claim.id),
					eb('posting.repayment_id', 'in', repayments.map((repayment) => repayment.id).length ? repayments.map((repayment) => repayment.id) : ['0'])
				]))
				.orderBy('posting.posted_at', 'asc')
				.execute();
			claims.push({
				publicId: claim.publicId,
				writeOffPublicId: claim.writeOffPublicId,
				invoicePublicId: claim.invoicePublicId,
				invoiceNumber: claim.invoiceNumber ?? 'Unnumbered invoice',
				preparedAt: claim.preparedAt,
				supplyDate: claim.supplyDate,
				paymentDueDate: claim.paymentDueDate,
				relevantDate: claim.relevantDate,
				eligibleFrom: claim.eligibleFrom,
				claimDeadline: claim.claimDeadline,
				originalVatPeriodReference: claim.originalVatPeriodReference,
				reason: claim.reason,
				considerationBasisAmount: moneyText(totals.basis),
				vatReliefAmount: moneyText(totals.vat),
				status: claim.reversedAt ? 'reversed' : claim.authorisedAt ? 'authorised' : 'prepared',
				authorisedAt: claim.authorisedAt,
				reversedAt: claim.reversedAt,
				lines,
				repayments: repayments.map((repayment) => ({
					publicId: repayment.publicId,
					recoveryPublicId: repayment.recoveryPublicId,
					considerationPaymentAmount: repayment.considerationPaymentAmount,
					vatRepaymentAmount: repayment.vatRepaymentAmount,
					recordedAt: repayment.recordedAt,
					reversedAt: repayment.reversedAt
				})),
				postings
			});
		}

		return {
			candidates,
			claims,
			canPrepare: decisions[0].allowed,
			canAuthorise: decisions[1].allowed,
			canReverse: decisions[2].allowed,
			canRecordRepayment: decisions[3].allowed,
			canReverseRepayment: decisions[4].allowed,
			canPost: decisions[5].allowed,
			canReversePosting: decisions[6].allowed
		};
	}

	async prepareClaim(actor: TenantActorContext, input: {
		writeOffPublicId: string;
		supplyDate: string;
		paymentDueDate: string;
		originalVatPeriodReference: string;
		reason: string;
		vatAccountedAndPaid: boolean;
		debtNotSoldOrFactored: boolean;
		sellingPriceConditionMet: boolean;
		reliefSchemeApplicable: boolean;
		lines: ClaimLineInput[];
	}): Promise<{ publicId: string }> {
		const writeOffPublicId = cleanPublicId(input.writeOffPublicId, 'Write-off ID');
		const supplyDate = validateFinanceDate(input.supplyDate, 'Supply date');
		const paymentDueDate = validateFinanceDate(input.paymentDueDate, 'Payment due date');
		if (!supplyDate || !paymentDueDate) throw new FinanceValidationError('Supply date and payment due date are required.');
		const originalVatPeriodReference = cleanFinanceText(input.originalVatPeriodReference, 80, 'Original VAT period reference', true)!;
		const reason = cleanFinanceText(input.reason, 1000, 'VAT bad-debt relief preparation reason', true)!;
		if (!input.vatAccountedAndPaid || !input.debtNotSoldOrFactored || !input.sellingPriceConditionMet || !input.reliefSchemeApplicable) {
			throw new FinanceValidationError('All VAT bad-debt relief eligibility attestations must be confirmed before preparation.');
		}
		if (input.lines.length === 0) throw new FinanceValidationError('At least one source VAT line is required.');
		const relevantDate = laterDate(supplyDate, paymentDueDate);
		const eligibleFrom = addMonthsUtc(relevantDate, 6);
		const claimDeadline = addMonthsUtc(relevantDate, 54);

		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.prepare', trx)).allowed) {
				throw new TenantAccessError('VAT bad-debt relief preparation is not permitted.');
			}
			const identity = await trx
				.selectFrom('receivable_write_offs')
				.select(['id', 'invoice_document_id as invoiceDocumentId'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', writeOffPublicId)
				.executeTakeFirst();
			if (!identity) throw new RecordNotFoundError('Write-off not found.');
			const invoiceIdentity = await badDebtInvoiceById(trx, actor.organisationId, identity.invoiceDocumentId);
			if (!invoiceIdentity) throw new RecordNotFoundError('Write-off not found.');
			await trx.selectFrom('parties').select('id').where('organisation_id', '=', actor.organisationId).where('id', '=', invoiceIdentity.customerPartyId).forUpdate().executeTakeFirstOrThrow();
			const invoice = await badDebtInvoiceById(trx, actor.organisationId, identity.invoiceDocumentId, true);
			if (!invoice || invoice.lifecycleStatus !== 'issued') throw new FinanceValidationError('VAT bad-debt relief requires an issued source invoice.');
			const writeOff = await trx
				.selectFrom('receivable_write_offs as writeOff')
				.leftJoin('receivable_write_off_reversals as reversal', (join) =>
					join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id')
				)
				.select(['writeOff.id', 'writeOff.invoice_document_id as invoiceDocumentId', 'writeOff.write_off_amount as amount', 'writeOff.tax_treatment_policy as taxTreatmentPolicy', 'reversal.write_off_id as reversedId'])
				.where('writeOff.organisation_id', '=', actor.organisationId)
				.where('writeOff.public_id', '=', writeOffPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!writeOff || writeOff.invoiceDocumentId !== invoice.id) throw new RecordNotFoundError('Write-off not found.');
			if (writeOff.reversedId) throw new FinanceValidationError('A reversed write-off cannot support VAT bad-debt relief.');
			if (writeOff.taxTreatmentPolicy !== 'separate_tax_adjustment_required') {
				throw new FinanceValidationError('The write-off was not marked for separate tax adjustment.');
			}
			const recovery = money(await activeRecoveryAmountForWriteOff(trx, actor.organisationId, writeOff.id, true));
			const activeClaims = await activeClaimTotalsForWriteOff(trx, actor.organisationId, writeOff.id);
			const availableWriteOffBasis = money(writeOff.amount) > recovery + activeClaims.basis ? money(writeOff.amount) - recovery - activeClaims.basis : 0n;
			let totalBasis = 0n;
			const preparedLines: Array<{ sourceInvoiceItemId: string; taxCategoryId: string; basisAmount: string; vatAmount: string }> = [];
			const seen = new Set<string>();
			for (const line of input.lines) {
				const sourceInvoiceItemId = cleanFinanceText(line.sourceInvoiceItemId, 32, 'Source invoice item ID', true)!;
				const taxCategoryId = cleanFinanceText(line.taxCategoryId, 32, 'Tax category ID', true)!;
				const key = `${sourceInvoiceItemId}:${taxCategoryId}`;
				if (seen.has(key)) throw new FinanceValidationError('A source VAT line can appear only once in one preparation.');
				seen.add(key);
				const basisAmount = validateMoneyAmount(line.considerationBasisAmount, 'Consideration basis');
				const source = await trx
					.selectFrom('financial_document_items as item')
					.innerJoin('financial_document_item_taxes as tax', (join) =>
						join.onRef('tax.financial_document_item_id', '=', 'item.id').onRef('tax.organisation_id', '=', 'item.organisation_id')
					)
					.select(['tax.taxable_amount as taxableAmount', 'tax.tax_amount as taxAmount'])
					.where('item.organisation_id', '=', actor.organisationId)
					.where('item.financial_document_id', '=', invoice.id)
					.where('item.id', '=', sourceInvoiceItemId)
					.where('tax.tax_category_id', '=', taxCategoryId)
					.executeTakeFirst();
				if (!source) throw new RecordNotFoundError('Source invoice VAT line not found.');
				if (money(source.taxAmount) <= 0n) throw new FinanceValidationError('Only source lines with VAT charged can support VAT bad-debt relief.');
				const sourceGross = money(source.taxableAmount) + money(source.taxAmount);
				const alreadyClaimed = await activeClaimBasisForTaxSource(trx, actor.organisationId, sourceInvoiceItemId, taxCategoryId);
				if (money(basisAmount) > sourceGross - alreadyClaimed) throw new FinanceValidationError('Consideration basis exceeds the remaining source VAT-line capacity.');
				const vatAmount = vatForConsiderationBasis(basisAmount, source.taxableAmount, source.taxAmount);
				totalBasis += money(basisAmount);
				preparedLines.push({ sourceInvoiceItemId, taxCategoryId, basisAmount, vatAmount });
			}
			if (totalBasis > availableWriteOffBasis) throw new FinanceValidationError(`Prepared consideration exceeds the currently available written-off amount of ${moneyText(availableWriteOffBasis)}.`);
			const publicId = this.publicIdFactory();
			const result = await trx.insertInto('receivable_vat_bad_debt_claims').values({
				organisation_id: actor.organisationId,
				public_id: publicId,
				write_off_id: writeOff.id,
				invoice_document_id: invoice.id,
				supply_date: supplyDate,
				payment_due_date: paymentDueDate,
				relevant_date: relevantDate,
				eligible_from: eligibleFrom,
				claim_deadline: claimDeadline,
				original_vat_period_reference: originalVatPeriodReference,
				vat_accounted_and_paid: 1,
				debt_not_sold_or_factored: 1,
				selling_price_condition_met: 1,
				relief_scheme_applicable: 1,
				reason,
				prepared_by_member_id: membership.id,
				prepared_at: this.now()
			}).executeTakeFirstOrThrow();
			const claimId = insertedId(result);
			await trx.insertInto('receivable_vat_bad_debt_claim_lines').values(preparedLines.map((line, index) => ({
				organisation_id: actor.organisationId,
				claim_id: claimId,
				invoice_document_id: invoice.id,
				source_invoice_item_id: line.sourceInvoiceItemId,
				tax_category_id: line.taxCategoryId,
				sort_order: index + 1,
				consideration_basis_amount: line.basisAmount,
				vat_relief_amount: line.vatAmount
			}))).execute();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id,
				projectId: null, actionKey: 'finance.tax_relief.claim.prepared', subjectType: 'vat_bad_debt_claim', subjectPublicId: publicId,
				correlationId: actor.correlationId, changeSummary: { writeOffPublicId, invoicePublicId: invoice.publicId, considerationBasisAmount: moneyText(totalBasis), eligibleFrom, claimDeadline, originalVatPeriodReference }
			});
			return { publicId };
		});
	}

	async authoriseClaim(actor: TenantActorContext, input: { claimPublicId: string; reason: string }): Promise<void> {
		const claimPublicId = cleanPublicId(input.claimPublicId, 'VAT relief claim ID');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT relief authorisation reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.authorise', trx)).allowed) throw new TenantAccessError('VAT bad-debt relief authorisation is not permitted.');
			const claimIdentity = await trx.selectFrom('receivable_vat_bad_debt_claims').select(['id', 'write_off_id as writeOffId', 'invoice_document_id as invoiceId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', claimPublicId).executeTakeFirst();
			if (!claimIdentity) throw new RecordNotFoundError('VAT bad-debt relief claim not found.');
			const invoiceIdentity = await badDebtInvoiceById(trx, actor.organisationId, claimIdentity.invoiceId);
			if (!invoiceIdentity) throw new RecordNotFoundError('VAT bad-debt relief claim not found.');
			await trx.selectFrom('parties').select('id').where('organisation_id', '=', actor.organisationId).where('id', '=', invoiceIdentity.customerPartyId).forUpdate().executeTakeFirstOrThrow();
			const invoice = await badDebtInvoiceById(trx, actor.organisationId, claimIdentity.invoiceId, true);
			if (!invoice || invoice.lifecycleStatus !== 'issued') throw new FinanceValidationError('The source invoice is no longer eligible for VAT bad-debt relief.');
			const claim = await trx.selectFrom('receivable_vat_bad_debt_claims').selectAll().where('organisation_id', '=', actor.organisationId).where('id', '=', claimIdentity.id).forUpdate().executeTakeFirstOrThrow();
			if (await trx.selectFrom('receivable_vat_bad_debt_claim_authorisations').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst()) return;
			if (await trx.selectFrom('receivable_vat_bad_debt_claim_reversals').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('A reversed VAT bad-debt relief claim cannot be authorised.');
			const writeOff = await trx.selectFrom('receivable_write_offs as writeOff').leftJoin('receivable_write_off_reversals as reversal', (join) => join.onRef('reversal.write_off_id', '=', 'writeOff.id').onRef('reversal.organisation_id', '=', 'writeOff.organisation_id')).select(['writeOff.write_off_amount as amount', 'writeOff.tax_treatment_policy as taxTreatmentPolicy', 'reversal.write_off_id as reversedId']).where('writeOff.organisation_id', '=', actor.organisationId).where('writeOff.id', '=', claim.write_off_id).forUpdate().executeTakeFirst();
			if (!writeOff || writeOff.reversedId) throw new FinanceValidationError('The source write-off is no longer active.');
			if (writeOff.taxTreatmentPolicy !== 'separate_tax_adjustment_required') throw new FinanceValidationError('The source write-off no longer requires separate tax adjustment.');
			const today = dateOnly(this.now());
			if (today < claim.eligible_from) throw new FinanceValidationError(`VAT bad-debt relief is not eligible before ${claim.eligible_from.toISOString().slice(0, 10)}.`);
			if (today > claim.claim_deadline) throw new FinanceValidationError(`VAT bad-debt relief claim deadline passed on ${claim.claim_deadline.toISOString().slice(0, 10)}.`);
			const totals = await claimTotals(trx, actor.organisationId, claim.id);
			if (totals.basis <= 0n || totals.vat <= 0n) throw new FinanceValidationError('VAT bad-debt relief claim has no source VAT lines.');
			const recovery = money(await activeRecoveryAmountForWriteOff(trx, actor.organisationId, claim.write_off_id, true));
			const otherClaims = await activeClaimTotalsForWriteOff(trx, actor.organisationId, claim.write_off_id, claim.id);
			const availableWriteOffBasis = money(writeOff.amount) > recovery + otherClaims.basis ? money(writeOff.amount) - recovery - otherClaims.basis : 0n;
			if (totals.basis > availableWriteOffBasis) throw new FinanceValidationError(`Prepared consideration now exceeds the available written-off amount of ${moneyText(availableWriteOffBasis)}.`);
			const lines = await trx.selectFrom('receivable_vat_bad_debt_claim_lines as line').innerJoin('financial_document_item_taxes as tax', (join) => join.onRef('tax.financial_document_item_id', '=', 'line.source_invoice_item_id').onRef('tax.organisation_id', '=', 'line.organisation_id').onRef('tax.tax_category_id', '=', 'line.tax_category_id')).select(['line.source_invoice_item_id as sourceInvoiceItemId', 'line.tax_category_id as taxCategoryId', 'line.consideration_basis_amount as basisAmount', 'line.vat_relief_amount as vatAmount', 'tax.taxable_amount as taxableAmount', 'tax.tax_amount as taxAmount']).where('line.organisation_id', '=', actor.organisationId).where('line.claim_id', '=', claim.id).forUpdate().execute();
			for (const line of lines) {
				const sourceGross = money(line.taxableAmount) + money(line.taxAmount);
				const otherBasis = await activeClaimBasisForTaxSource(trx, actor.organisationId, line.sourceInvoiceItemId, line.taxCategoryId, claim.id);
				if (money(line.basisAmount) > sourceGross - otherBasis) throw new FinanceValidationError('A source VAT line no longer has enough unclaimed consideration capacity.');
				const expectedVat = vatForConsiderationBasis(line.basisAmount, line.taxableAmount, line.taxAmount);
				if (money(expectedVat) !== money(line.vatAmount)) throw new FinanceValidationError('Prepared VAT relief no longer matches the immutable source tax snapshot.');
			}
			const authorisedAt = this.now();
			await trx.insertInto('receivable_vat_bad_debt_claim_authorisations').values({ claim_id: claim.id, organisation_id: actor.organisationId, authorised_by_member_id: membership.id, authorised_at: authorisedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.claim.authorised', subjectType: 'vat_bad_debt_claim', subjectPublicId: claimPublicId, correlationId: actor.correlationId, changeSummary: { considerationBasisAmount: moneyText(totals.basis), vatReliefAmount: moneyText(totals.vat), authorisedAt, reason } });
		});
	}

	async reverseClaim(actor: TenantActorContext, input: { claimPublicId: string; reason: string }): Promise<void> {
		const claimPublicId = cleanPublicId(input.claimPublicId, 'VAT relief claim ID');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT relief reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.reverse', trx)).allowed) throw new TenantAccessError('VAT bad-debt relief reversal is not permitted.');
			const claim = await trx.selectFrom('receivable_vat_bad_debt_claims').select(['id', 'public_id as publicId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', claimPublicId).forUpdate().executeTakeFirst();
			if (!claim) throw new RecordNotFoundError('VAT bad-debt relief claim not found.');
			if (!(await trx.selectFrom('receivable_vat_bad_debt_claim_authorisations').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst())) throw new FinanceValidationError('Only an authorised VAT bad-debt relief claim can be reversed.');
			if (await trx.selectFrom('receivable_vat_bad_debt_claim_reversals').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('The VAT bad-debt relief claim is already reversed.');
			if ((await activePostingsForSource(trx, actor.organisationId, { claimId: claim.id })).length) throw new FinanceValidationError('Reverse active VAT-return posting evidence before reversing the relief claim.');
			const activeRepayments = await activeRepaymentTotalsForClaim(trx, actor.organisationId, claim.id);
			if (activeRepayments.consideration > 0n) throw new FinanceValidationError('Reverse active VAT relief repayment evidence before reversing the relief claim.');
			const reversedAt = this.now();
			await trx.insertInto('receivable_vat_bad_debt_claim_reversals').values({ claim_id: claim.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.claim.reversed', subjectType: 'vat_bad_debt_claim', subjectPublicId: claimPublicId, correlationId: actor.correlationId, changeSummary: { reason, reversedAt } });
		});
	}

	async recordRepayment(actor: TenantActorContext, input: { claimPublicId: string; recoveryPublicId: string; considerationPaymentAmount: string; reason: string }): Promise<{ publicId: string }> {
		const claimPublicId = cleanPublicId(input.claimPublicId, 'VAT relief claim ID');
		const recoveryPublicId = cleanPublicId(input.recoveryPublicId, 'Recovery ID');
		const considerationPaymentAmount = validateMoneyAmount(input.considerationPaymentAmount, 'Recovered consideration');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT relief repayment reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.repayment.record', trx)).allowed) throw new TenantAccessError('VAT bad-debt relief repayment recording is not permitted.');
			const claim = await trx.selectFrom('receivable_vat_bad_debt_claims').select(['id', 'write_off_id as writeOffId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', claimPublicId).forUpdate().executeTakeFirst();
			if (!claim) throw new RecordNotFoundError('VAT bad-debt relief claim not found.');
			if (!(await trx.selectFrom('receivable_vat_bad_debt_claim_authorisations').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst())) throw new FinanceValidationError('VAT repayment requires an authorised relief claim.');
			if (await trx.selectFrom('receivable_vat_bad_debt_claim_reversals').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('A reversed VAT relief claim cannot receive repayment evidence.');
			const recovery = await trx.selectFrom('receivable_write_off_recoveries as recovery').leftJoin('receivable_write_off_recovery_reversals as reversal', (join) => join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id')).select(['recovery.id', 'recovery.write_off_id as writeOffId', 'recovery.recovered_amount as amount', 'reversal.recovery_id as reversedId']).where('recovery.organisation_id', '=', actor.organisationId).where('recovery.public_id', '=', recoveryPublicId).forUpdate().executeTakeFirst();
			if (!recovery || recovery.writeOffId !== claim.writeOffId) throw new RecordNotFoundError('Bad-debt recovery not found for this relief claim.');
			if (recovery.reversedId) throw new FinanceValidationError('A reversed recovery cannot create VAT repayment evidence.');
			const recoveryUsed = await activeRepaymentConsiderationForRecovery(trx, actor.organisationId, recovery.id);
			if (money(considerationPaymentAmount) > money(recovery.amount) - recoveryUsed) throw new FinanceValidationError('Recovered consideration exceeds the unused amount of the selected bad-debt recovery.');
			const totals = await claimTotals(trx, actor.organisationId, claim.id);
			const repaid = await activeRepaymentTotalsForClaim(trx, actor.organisationId, claim.id);
			const consideration = money(considerationPaymentAmount);
			if (consideration > totals.basis - repaid.consideration) throw new FinanceValidationError('Recovered consideration exceeds the remaining consideration covered by this VAT relief claim.');
			const proportionalVat = (totals.vat * consideration + totals.basis / 2n) / totals.basis;
			const remainingVat = totals.vat - repaid.vat;
			const vatRepayment = proportionalVat > remainingVat ? remainingVat : proportionalVat;
			if (vatRepayment <= 0n) throw new FinanceValidationError('VAT repayment amount rounds to zero.');
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_vat_bad_debt_repayments').values({ organisation_id: actor.organisationId, public_id: publicId, claim_id: claim.id, write_off_id: claim.writeOffId, recovery_id: recovery.id, consideration_payment_amount: considerationPaymentAmount, vat_repayment_amount: moneyText(vatRepayment), reason, recorded_by_member_id: membership.id, recorded_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.repayment.recorded', subjectType: 'vat_bad_debt_claim', subjectPublicId: claimPublicId, correlationId: actor.correlationId, changeSummary: { repaymentPublicId: publicId, recoveryPublicId, considerationPaymentAmount, vatRepaymentAmount: moneyText(vatRepayment), reason } });
			return { publicId };
		});
	}

	async reverseRepayment(actor: TenantActorContext, input: { repaymentPublicId: string; reason: string }): Promise<void> {
		const repaymentPublicId = cleanPublicId(input.repaymentPublicId, 'VAT relief repayment ID');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT relief repayment reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.repayment.reverse', trx)).allowed) throw new TenantAccessError('VAT bad-debt relief repayment reversal is not permitted.');
			const repayment = await trx.selectFrom('receivable_vat_bad_debt_repayments').select(['id', 'claim_id as claimId']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', repaymentPublicId).forUpdate().executeTakeFirst();
			if (!repayment) throw new RecordNotFoundError('VAT bad-debt relief repayment not found.');
			if (await trx.selectFrom('receivable_vat_bad_debt_repayment_reversals').select('repayment_id').where('organisation_id', '=', actor.organisationId).where('repayment_id', '=', repayment.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('The VAT repayment is already reversed.');
			if ((await activePostingsForSource(trx, actor.organisationId, { repaymentId: repayment.id })).length) throw new FinanceValidationError('Reverse active VAT-return posting evidence before reversing the VAT repayment.');
			const reversedAt = this.now();
			await trx.insertInto('receivable_vat_bad_debt_repayment_reversals').values({ repayment_id: repayment.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.repayment.reversed', subjectType: 'vat_bad_debt_repayment', subjectPublicId: repaymentPublicId, correlationId: actor.correlationId, changeSummary: { reason, reversedAt } });
		});
	}

	async recordReturnPosting(actor: TenantActorContext, input: {
		sourceKind: 'relief_claim' | 'relief_repayment';
		sourcePublicId: string;
		vatReturnPeriodReference: string;
		vatReturnPeriodStart: string;
		vatReturnPeriodEnd: string;
		externalReference?: string | null;
		reason: string;
	}): Promise<{ publicId: string }> {
		const sourcePublicId = cleanPublicId(input.sourcePublicId, 'VAT posting source ID');
		const vatReturnPeriodReference = cleanFinanceText(input.vatReturnPeriodReference, 80, 'VAT return period reference', true)!;
		const vatReturnPeriodStart = validateFinanceDate(input.vatReturnPeriodStart, 'VAT return period start');
		const vatReturnPeriodEnd = validateFinanceDate(input.vatReturnPeriodEnd, 'VAT return period end');
		if (!vatReturnPeriodStart || !vatReturnPeriodEnd || vatReturnPeriodEnd < vatReturnPeriodStart) throw new FinanceValidationError('VAT return period is invalid.');
		const externalReference = cleanFinanceText(input.externalReference, 160, 'External posting reference');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT return posting reason', true)!;
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.post', trx)).allowed) throw new TenantAccessError('VAT return posting evidence is not permitted.');
			let claimId: string | null = null;
			let repaymentId: string | null = null;
			let amount = 0n;
			let vatReturnBox = 0;
			if (input.sourceKind === 'relief_claim') {
				const claim = await trx.selectFrom('receivable_vat_bad_debt_claims').select(['id', 'eligible_from as eligibleFrom', 'claim_deadline as claimDeadline']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', sourcePublicId).forUpdate().executeTakeFirst();
				if (!claim) throw new RecordNotFoundError('VAT bad-debt relief claim not found.');
				if (!(await trx.selectFrom('receivable_vat_bad_debt_claim_authorisations').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst())) throw new FinanceValidationError('Only an authorised VAT bad-debt relief claim can be posted.');
				if (await trx.selectFrom('receivable_vat_bad_debt_claim_reversals').select('claim_id').where('organisation_id', '=', actor.organisationId).where('claim_id', '=', claim.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('A reversed VAT relief claim cannot be posted.');
				if (vatReturnPeriodEnd < claim.eligibleFrom) throw new FinanceValidationError('VAT return period ends before bad-debt relief becomes eligible.');
				if (vatReturnPeriodEnd > claim.claimDeadline) throw new FinanceValidationError('VAT return period ends after the recorded bad-debt relief claim deadline.');
				claimId = claim.id;
				amount = (await claimTotals(trx, actor.organisationId, claim.id)).vat;
				vatReturnBox = 4;
				if ((await activePostingsForSource(trx, actor.organisationId, { claimId })).length) throw new FinanceValidationError('This VAT relief claim already has active VAT-return posting evidence.');
			} else {
				const repayment = await trx.selectFrom('receivable_vat_bad_debt_repayments').select(['id', 'vat_repayment_amount as vatAmount']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', sourcePublicId).forUpdate().executeTakeFirst();
				if (!repayment) throw new RecordNotFoundError('VAT bad-debt relief repayment not found.');
				if (await trx.selectFrom('receivable_vat_bad_debt_repayment_reversals').select('repayment_id').where('organisation_id', '=', actor.organisationId).where('repayment_id', '=', repayment.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('A reversed VAT repayment cannot be posted.');
				repaymentId = repayment.id;
				amount = money(repayment.vatAmount);
				vatReturnBox = 1;
				if ((await activePostingsForSource(trx, actor.organisationId, { repaymentId })).length) throw new FinanceValidationError('This VAT repayment already has active VAT-return posting evidence.');
			}
			if (amount <= 0n) throw new FinanceValidationError('VAT return posting amount must be positive.');
			const publicId = this.publicIdFactory();
			await trx.insertInto('receivable_vat_return_postings').values({ organisation_id: actor.organisationId, public_id: publicId, posting_kind: input.sourceKind, claim_id: claimId, repayment_id: repaymentId, vat_return_box: vatReturnBox, vat_return_period_reference: vatReturnPeriodReference, vat_return_period_start: vatReturnPeriodStart, vat_return_period_end: vatReturnPeriodEnd, amount: moneyText(amount), external_reference: externalReference, reason, posted_by_member_id: membership.id, posted_at: this.now() }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.return_posting.recorded', subjectType: input.sourceKind, subjectPublicId: sourcePublicId, correlationId: actor.correlationId, changeSummary: { postingPublicId: publicId, vatReturnBox, vatReturnPeriodReference, vatReturnPeriodStart, vatReturnPeriodEnd, amount: moneyText(amount), externalReference, reason } });
			return { publicId };
		});
	}

	async reverseReturnPosting(actor: TenantActorContext, input: { postingPublicId: string; reason: string }): Promise<void> {
		const postingPublicId = cleanPublicId(input.postingPublicId, 'VAT return posting ID');
		const reason = cleanFinanceText(input.reason, 1000, 'VAT return posting reversal reason', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.tax_relief.post.reverse', trx)).allowed) throw new TenantAccessError('VAT return posting reversal is not permitted.');
			const posting = await trx.selectFrom('receivable_vat_return_postings').select(['id', 'posting_kind as postingKind', 'amount']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', postingPublicId).forUpdate().executeTakeFirst();
			if (!posting) throw new RecordNotFoundError('VAT return posting not found.');
			if (await trx.selectFrom('receivable_vat_return_posting_reversals').select('posting_id').where('organisation_id', '=', actor.organisationId).where('posting_id', '=', posting.id).forUpdate().executeTakeFirst()) throw new FinanceValidationError('The VAT return posting is already reversed.');
			const reversedAt = this.now();
			await trx.insertInto('receivable_vat_return_posting_reversals').values({ posting_id: posting.id, organisation_id: actor.organisationId, reversed_by_member_id: membership.id, reversed_at: reversedAt, reason }).executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({ eventPublicId: this.publicIdFactory(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: membership.id, projectId: null, actionKey: 'finance.tax_relief.return_posting.reversed', subjectType: 'vat_return_posting', subjectPublicId: postingPublicId, correlationId: actor.correlationId, changeSummary: { postingKind: posting.postingKind, amount: posting.amount, reason, reversedAt } });
		});
	}
}
