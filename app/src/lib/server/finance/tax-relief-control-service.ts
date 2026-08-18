import { randomUUID } from 'node:crypto';

import { getDatabase, type Database } from '$lib/server/db/database';
import { FinanceValidationError, validateFinanceDate } from './finance-common';
import { TaxReliefService } from './tax-relief-service';

type PrepareClaimInput = Parameters<TaxReliefService['prepareClaim']>[1];
type ReturnPostingInput = Parameters<TaxReliefService['recordReturnPosting']>[1];

function dateOnly(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function sameDate(left: Date, right: Date): boolean {
	return dateOnly(left).getTime() === dateOnly(right).getTime();
}

/**
 * Public application boundary for Package 004K.
 *
 * TaxReliefService owns the transactional evidence workflow. This wrapper adds
 * statutory-date guards that depend on authoritative issued-invoice/recovery facts:
 * - an issued invoice's stored due date cannot be replaced by operator input to
 *   accelerate the six-month bad-debt-relief eligibility calculation;
 * - recovery repayment posting evidence must point at the VAT period containing
 *   the actual bad-debt recovery receipt date.
 */
export class ControlledTaxReliefService extends TaxReliefService {
	constructor(
		private readonly controlDb: Database = getDatabase(),
		publicIdFactory: () => string = randomUUID,
		private readonly controlNow: () => Date = () => new Date()
	) {
		super(controlDb, publicIdFactory, controlNow);
	}

	override async prepareClaim(
		actor: Parameters<TaxReliefService['prepareClaim']>[0],
		input: PrepareClaimInput
	): Promise<{ publicId: string }> {
		const supplyDate = validateFinanceDate(input.supplyDate, 'Supply date');
		const suppliedDueDate = validateFinanceDate(input.paymentDueDate, 'Payment due date');
		if (!supplyDate || !suppliedDueDate) {
			throw new FinanceValidationError('Supply date and payment due date are required.');
		}
		if (dateOnly(supplyDate) > dateOnly(this.controlNow())) {
			throw new FinanceValidationError('Supply date cannot be in the future.');
		}

		const source = await this.controlDb
			.selectFrom('receivable_write_offs as writeOff')
			.innerJoin('invoices as invoice', (join) =>
				join
					.onRef('invoice.financial_document_id', '=', 'writeOff.invoice_document_id')
					.onRef('invoice.organisation_id', '=', 'writeOff.organisation_id')
			)
			.select('invoice.due_date as dueDate')
			.where('writeOff.organisation_id', '=', actor.organisationId)
			.where('writeOff.public_id', '=', input.writeOffPublicId.trim())
			.executeTakeFirst();

		if (source?.dueDate && !sameDate(source.dueDate, suppliedDueDate)) {
			throw new FinanceValidationError(
				`Payment due date must match the issued invoice due date of ${source.dueDate.toISOString().slice(0, 10)}.`
			);
		}

		return super.prepareClaim(actor, input);
	}

	override async recordReturnPosting(
		actor: Parameters<TaxReliefService['recordReturnPosting']>[0],
		input: ReturnPostingInput
	): Promise<{ publicId: string }> {
		if (input.sourceKind === 'relief_repayment') {
			const periodStart = validateFinanceDate(
				input.vatReturnPeriodStart,
				'VAT return period start'
			);
			const periodEnd = validateFinanceDate(input.vatReturnPeriodEnd, 'VAT return period end');
			if (!periodStart || !periodEnd) {
				throw new FinanceValidationError('VAT return period is invalid.');
			}

			const source = await this.controlDb
				.selectFrom('receivable_vat_bad_debt_repayments as repayment')
				.innerJoin('receivable_write_off_recoveries as recovery', (join) =>
					join
						.onRef('recovery.id', '=', 'repayment.recovery_id')
						.onRef('recovery.organisation_id', '=', 'repayment.organisation_id')
				)
				.select('recovery.recovered_at as recoveredAt')
				.where('repayment.organisation_id', '=', actor.organisationId)
				.where('repayment.public_id', '=', input.sourcePublicId.trim())
				.executeTakeFirst();

			if (source) {
				const recoveryDate = dateOnly(source.recoveredAt);
				if (recoveryDate < dateOnly(periodStart) || recoveryDate > dateOnly(periodEnd)) {
					throw new FinanceValidationError(
						`VAT repayment posting period must include the bad-debt recovery receipt date of ${source.recoveredAt.toISOString().slice(0, 10)}.`
					);
				}
			}
		}

		return super.recordReturnPosting(actor, input);
	}
}
