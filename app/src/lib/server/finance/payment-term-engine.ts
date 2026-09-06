export const PAYMENT_TERM_CALCULATION_BASES = [
	'invoice_date',
	'invoice_receipt_date',
	'order_date',
	'shipment_date',
	'delivery_date',
	'goods_receipt_date',
	'acceptance_date',
	'service_completion_date',
	'billing_period_start',
	'billing_period_end',
	'milestone_date',
	'completion_date',
	'end_of_month',
	'manual'
] as const;

export type PaymentTermCalculationBasis = (typeof PAYMENT_TERM_CALCULATION_BASES)[number];
export type PaymentTermDayType = 'calendar' | 'business';
export type BusinessDayConvention = 'none' | 'following' | 'preceding' | 'modified_following';
export type PaymentTermKind =
	'single' | 'recurring' | 'milestone' | 'split' | 'retention' | 'trade';

export const PAYMENT_TERM_DAY_TYPES = new Set<PaymentTermDayType>(['calendar', 'business']);
export const PAYMENT_TERM_BUSINESS_DAY_CONVENTIONS = new Set<BusinessDayConvention>([
	'none',
	'following',
	'preceding',
	'modified_following'
]);
export const PAYMENT_TERM_KINDS = new Set<PaymentTermKind>([
	'single',
	'recurring',
	'milestone',
	'split',
	'retention',
	'trade'
]);
export const PAYMENT_TERM_BASES = new Set<string>(PAYMENT_TERM_CALCULATION_BASES);

export type PaymentTermRule = {
	calculationBasis: PaymentTermCalculationBasis;
	daysOffset: number;
	dayType?: PaymentTermDayType;
	monthOffset?: number;
	fixedDayOfMonth?: number | null;
	businessDayConvention?: BusinessDayConvention;
};

export type PaymentTermScheduleLine = PaymentTermRule & {
	lineNumber: number;
	percentageDue: number;
	milestoneCode?: string | null;
	description?: string | null;
};

export type PaymentTermDiscount = {
	sequenceNumber: number;
	discountPercentage: number;
	calculationBasis: 'invoice_date' | 'invoice_receipt_date';
	eligibilityDays: number;
	dayType?: PaymentTermDayType;
};

export type PaymentTermDateContext = {
	invoiceDate?: Date | null;
	invoiceReceiptDate?: Date | null;
	orderDate?: Date | null;
	shipmentDate?: Date | null;
	deliveryDate?: Date | null;
	goodsReceiptDate?: Date | null;
	acceptanceDate?: Date | null;
	serviceCompletionDate?: Date | null;
	billingPeriodStart?: Date | null;
	billingPeriodEnd?: Date | null;
	milestoneDate?: Date | null;
	completionDate?: Date | null;
	manualDueDate?: Date | null;
};

export type BusinessCalendar = {
	isBusinessDay(date: Date): boolean;
};

export class PaymentTermEngineError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PaymentTermEngineError';
	}
}

const WEEKDAY_CALENDAR: BusinessCalendar = {
	isBusinessDay(date) {
		const day = date.getUTCDay();
		return day !== 0 && day !== 6;
	}
};

function utcDate(date: Date): Date {
	if (Number.isNaN(date.getTime()))
		throw new PaymentTermEngineError('Payment-term reference date is invalid.');
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysInUtcMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function addUtcCalendarDays(date: Date, days: number): Date {
	const result = utcDate(date);
	result.setUTCDate(result.getUTCDate() + days);
	return result;
}

function addUtcBusinessDays(date: Date, days: number, calendar: BusinessCalendar): Date {
	let result = utcDate(date);
	let remaining = days;
	while (remaining > 0) {
		result = addUtcCalendarDays(result, 1);
		if (calendar.isBusinessDay(result)) remaining -= 1;
	}
	return result;
}

function addUtcMonthsClamped(date: Date, months: number): Date {
	const source = utcDate(date);
	const targetMonthStart = new Date(
		Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + months, 1)
	);
	const targetDay = Math.min(
		source.getUTCDate(),
		daysInUtcMonth(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth())
	);
	return new Date(
		Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth(), targetDay)
	);
}

function withFixedUtcDay(date: Date, fixedDay: number): Date {
	const source = utcDate(date);
	const targetDay = Math.min(
		fixedDay,
		daysInUtcMonth(source.getUTCFullYear(), source.getUTCMonth())
	);
	return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), targetDay));
}

function endOfUtcMonth(date: Date): Date {
	const source = utcDate(date);
	return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth() + 1, 0));
}

function followingBusinessDay(date: Date, calendar: BusinessCalendar): Date {
	let result = utcDate(date);
	while (!calendar.isBusinessDay(result)) result = addUtcCalendarDays(result, 1);
	return result;
}

function precedingBusinessDay(date: Date, calendar: BusinessCalendar): Date {
	let result = utcDate(date);
	while (!calendar.isBusinessDay(result)) result = addUtcCalendarDays(result, -1);
	return result;
}

function applyBusinessDayConvention(
	date: Date,
	convention: BusinessDayConvention,
	calendar: BusinessCalendar
): Date {
	const source = utcDate(date);
	if (convention === 'none' || calendar.isBusinessDay(source)) return source;
	if (convention === 'following') return followingBusinessDay(source, calendar);
	if (convention === 'preceding') return precedingBusinessDay(source, calendar);
	const following = followingBusinessDay(source, calendar);
	if (following.getUTCMonth() === source.getUTCMonth()) return following;
	return precedingBusinessDay(source, calendar);
}

function referenceDate(basis: PaymentTermCalculationBasis, context: PaymentTermDateContext): Date {
	const values: Record<PaymentTermCalculationBasis, Date | null | undefined> = {
		invoice_date: context.invoiceDate,
		invoice_receipt_date: context.invoiceReceiptDate,
		order_date: context.orderDate,
		shipment_date: context.shipmentDate,
		delivery_date: context.deliveryDate,
		goods_receipt_date: context.goodsReceiptDate,
		acceptance_date: context.acceptanceDate,
		service_completion_date: context.serviceCompletionDate,
		billing_period_start: context.billingPeriodStart,
		billing_period_end: context.billingPeriodEnd,
		milestone_date: context.milestoneDate,
		completion_date: context.completionDate,
		end_of_month: context.invoiceDate,
		manual: context.manualDueDate
	};
	const value = values[basis];
	if (!value) {
		throw new PaymentTermEngineError(
			`Payment term requires a ${basis.replaceAll('_', ' ')} reference date.`
		);
	}
	return basis === 'end_of_month' ? endOfUtcMonth(value) : utcDate(value);
}

export function validatePaymentTermRule(rule: PaymentTermRule): void {
	if (!PAYMENT_TERM_BASES.has(rule.calculationBasis)) {
		throw new PaymentTermEngineError('Payment-term calculation basis is invalid.');
	}
	if (!Number.isSafeInteger(rule.daysOffset) || rule.daysOffset < 0 || rule.daysOffset > 65535) {
		throw new PaymentTermEngineError('Payment-term day offset must be an integer from 0 to 65535.');
	}
	const dayType = rule.dayType ?? 'calendar';
	if (!PAYMENT_TERM_DAY_TYPES.has(dayType)) {
		throw new PaymentTermEngineError('Payment-term day type is invalid.');
	}
	const monthOffset = rule.monthOffset ?? 0;
	if (!Number.isSafeInteger(monthOffset) || monthOffset < 0 || monthOffset > 120) {
		throw new PaymentTermEngineError('Payment-term month offset must be an integer from 0 to 120.');
	}
	if (
		rule.fixedDayOfMonth !== null &&
		rule.fixedDayOfMonth !== undefined &&
		(!Number.isSafeInteger(rule.fixedDayOfMonth) ||
			rule.fixedDayOfMonth < 1 ||
			rule.fixedDayOfMonth > 31)
	) {
		throw new PaymentTermEngineError('Fixed day of month must be from 1 to 31.');
	}
	const convention = rule.businessDayConvention ?? 'none';
	if (!PAYMENT_TERM_BUSINESS_DAY_CONVENTIONS.has(convention)) {
		throw new PaymentTermEngineError('Payment-term business-day convention is invalid.');
	}
	if (rule.calculationBasis === 'manual' && (rule.daysOffset !== 0 || monthOffset !== 0)) {
		throw new PaymentTermEngineError('Manual payment terms cannot apply day or month offsets.');
	}
}

export function calculatePaymentTermDate(
	rule: PaymentTermRule,
	context: PaymentTermDateContext,
	calendar: BusinessCalendar = WEEKDAY_CALENDAR
): Date {
	validatePaymentTermRule(rule);
	if (rule.calculationBasis === 'manual') return referenceDate('manual', context);

	let result = referenceDate(rule.calculationBasis, context);
	const monthOffset = rule.monthOffset ?? 0;
	if (monthOffset > 0) result = addUtcMonthsClamped(result, monthOffset);
	if (rule.fixedDayOfMonth !== null && rule.fixedDayOfMonth !== undefined) {
		result = withFixedUtcDay(result, rule.fixedDayOfMonth);
	}
	result =
		(rule.dayType ?? 'calendar') === 'business'
			? addUtcBusinessDays(result, rule.daysOffset, calendar)
			: addUtcCalendarDays(result, rule.daysOffset);
	return applyBusinessDayConvention(result, rule.businessDayConvention ?? 'none', calendar);
}

export function validatePaymentSchedule(lines: PaymentTermScheduleLine[]): void {
	if (lines.length === 0)
		throw new PaymentTermEngineError('A staged payment term requires schedule lines.');
	const seen = new Set<number>();
	let total = 0;
	for (const line of lines) {
		if (!Number.isSafeInteger(line.lineNumber) || line.lineNumber < 1) {
			throw new PaymentTermEngineError('Payment schedule line numbers must start at 1.');
		}
		if (seen.has(line.lineNumber))
			throw new PaymentTermEngineError('Payment schedule line numbers must be unique.');
		seen.add(line.lineNumber);
		if (
			!Number.isFinite(line.percentageDue) ||
			line.percentageDue <= 0 ||
			line.percentageDue > 100
		) {
			throw new PaymentTermEngineError(
				'Payment schedule percentages must be greater than 0 and at most 100.'
			);
		}
		validatePaymentTermRule(line);
		total += line.percentageDue;
	}
	if (Math.abs(total - 100) > 0.0001) {
		throw new PaymentTermEngineError('Payment schedule percentages must total 100%.');
	}
}

export function calculatePaymentSchedule(
	lines: PaymentTermScheduleLine[],
	context: PaymentTermDateContext,
	calendar: BusinessCalendar = WEEKDAY_CALENDAR
): Array<PaymentTermScheduleLine & { dueDate: Date }> {
	validatePaymentSchedule(lines);
	return [...lines]
		.sort((a, b) => a.lineNumber - b.lineNumber)
		.map((line) => ({ ...line, dueDate: calculatePaymentTermDate(line, context, calendar) }));
}

export function calculateDiscountDeadline(
	discount: PaymentTermDiscount,
	context: PaymentTermDateContext,
	calendar: BusinessCalendar = WEEKDAY_CALENDAR
): Date {
	if (!Number.isSafeInteger(discount.sequenceNumber) || discount.sequenceNumber < 1) {
		throw new PaymentTermEngineError('Payment discount sequence number must start at 1.');
	}
	if (
		!Number.isFinite(discount.discountPercentage) ||
		discount.discountPercentage <= 0 ||
		discount.discountPercentage >= 100
	) {
		throw new PaymentTermEngineError(
			'Payment discount percentage must be greater than 0 and below 100.'
		);
	}
	if (!Number.isSafeInteger(discount.eligibilityDays) || discount.eligibilityDays < 0) {
		throw new PaymentTermEngineError(
			'Payment discount eligibility days must be a non-negative integer.'
		);
	}
	return calculatePaymentTermDate(
		{
			calculationBasis: discount.calculationBasis,
			daysOffset: discount.eligibilityDays,
			dayType: discount.dayType ?? 'calendar',
			businessDayConvention: 'none'
		},
		context,
		calendar
	);
}
