import { describe, expect, it } from 'vitest';

import {
	PaymentTermEngineError,
	calculateDiscountDeadline,
	calculatePaymentSchedule,
	calculatePaymentTermDate,
	validatePaymentSchedule
} from './payment-term-engine';

function date(value: string): Date {
	return new Date(`${value}T00:00:00.000Z`);
}

function iso(value: Date): string {
	return value.toISOString().slice(0, 10);
}

describe('enterprise payment term engine', () => {
	it('calculates net invoice-date terms', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{ calculationBasis: 'invoice_date', daysOffset: 30 },
					{ invoiceDate: date('2026-09-06') }
				)
			)
		).toBe('2026-10-06');
	});

	it('calculates end-of-month terms from the invoice month end', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{ calculationBasis: 'end_of_month', daysOffset: 30 },
					{ invoiceDate: date('2026-01-15') }
				)
			)
		).toBe('2026-03-02');
	});

	it('supports following-month fixed payment days and clamps invalid month days', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 0,
						monthOffset: 1,
						fixedDayOfMonth: 15
					},
					{ invoiceDate: date('2026-01-31') }
				)
			)
		).toBe('2026-02-15');

		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 0,
						monthOffset: 1,
						fixedDayOfMonth: 31
					},
					{ invoiceDate: date('2026-01-31') }
				)
			)
		).toBe('2026-02-28');
	});

	it('counts business-day offsets without counting weekends', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 5,
						dayType: 'business'
					},
					{ invoiceDate: date('2026-09-04') }
				)
			)
		).toBe('2026-09-11');
	});

	it('applies following, preceding and modified-following conventions', () => {
		const context = { invoiceDate: date('2026-01-31') };
		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 0,
						businessDayConvention: 'following'
					},
					context
				)
			)
		).toBe('2026-02-02');
		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 0,
						businessDayConvention: 'preceding'
					},
					context
				)
			)
		).toBe('2026-01-30');
		expect(
			iso(
				calculatePaymentTermDate(
					{
						calculationBasis: 'invoice_date',
						daysOffset: 0,
						businessDayConvention: 'modified_following'
					},
					context
				)
			)
		).toBe('2026-01-30');
	});

	it('uses governed event reference dates such as delivery and acceptance', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{ calculationBasis: 'delivery_date', daysOffset: 30 },
					{ deliveryDate: date('2026-09-10') }
				)
			)
		).toBe('2026-10-10');
		expect(
			iso(
				calculatePaymentTermDate(
					{ calculationBasis: 'acceptance_date', daysOffset: 0 },
					{ acceptanceDate: date('2026-09-14') }
				)
			)
		).toBe('2026-09-14');
	});

	it('requires the calculation-basis reference date rather than silently guessing', () => {
		expect(() =>
			calculatePaymentTermDate(
				{ calculationBasis: 'goods_receipt_date', daysOffset: 30 },
				{ invoiceDate: date('2026-09-06') }
			)
		).toThrowError(PaymentTermEngineError);
	});

	it('supports explicit manual due dates but rejects offsets on manual terms', () => {
		expect(
			iso(
				calculatePaymentTermDate(
					{ calculationBasis: 'manual', daysOffset: 0 },
					{ manualDueDate: date('2026-10-31') }
				)
			)
		).toBe('2026-10-31');
		expect(() =>
			calculatePaymentTermDate(
				{ calculationBasis: 'manual', daysOffset: 1 },
				{ manualDueDate: date('2026-10-31') }
			)
		).toThrow('Manual payment terms cannot apply day or month offsets.');
	});

	it('validates and calculates staged payment schedules', () => {
		const lines = [
			{
				lineNumber: 1,
				percentageDue: 30,
				calculationBasis: 'order_date' as const,
				daysOffset: 0
			},
			{
				lineNumber: 2,
				percentageDue: 70,
				calculationBasis: 'delivery_date' as const,
				daysOffset: 0
			}
		];
		const schedule = calculatePaymentSchedule(lines, {
			orderDate: date('2026-09-01'),
			deliveryDate: date('2026-10-20')
		});
		expect(schedule.map((line) => [line.percentageDue, iso(line.dueDate)])).toEqual([
			[30, '2026-09-01'],
			[70, '2026-10-20']
		]);
		expect(() => validatePaymentSchedule([{ ...lines[0], percentageDue: 90 }])).toThrow(
			'Payment schedule percentages must total 100%.'
		);
	});

	it('calculates early-payment discount deadlines such as 2/10 Net 30', () => {
		expect(
			iso(
				calculateDiscountDeadline(
					{
						sequenceNumber: 1,
						discountPercentage: 2,
						calculationBasis: 'invoice_date',
						eligibilityDays: 10
					},
					{ invoiceDate: date('2026-09-06') }
				)
			)
		).toBe('2026-09-16');
	});
});
