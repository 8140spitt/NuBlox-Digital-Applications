export class CommercialDecimalError extends Error {
	readonly code = 'COMMERCIAL_DECIMAL';
	constructor(message: string) {
		super(message);
		this.name = 'CommercialDecimalError';
	}
}

function power10(scale: number): bigint {
	if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
		throw new CommercialDecimalError('Decimal scale is outside the supported range.');
	}
	return 10n ** BigInt(scale);
}

export function parseScaledDecimal(
	value: string,
	scale: number,
	label = 'Amount',
	allowNegative = false
): bigint {
	const text = value.trim();
	const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
	if (!match) throw new CommercialDecimalError(`${label} must be a decimal number.`);
	const negative = match[1] === '-';
	if (negative && !allowNegative) throw new CommercialDecimalError(`${label} must not be negative.`);
	const fraction = match[3] ?? '';
	if (fraction.length > scale) {
		throw new CommercialDecimalError(`${label} must have at most ${scale} decimal places.`);
	}
	const whole = BigInt(match[2]);
	const fractionValue = BigInt((fraction + '0'.repeat(scale)).slice(0, scale) || '0');
	const result = whole * power10(scale) + fractionValue;
	return negative ? -result : result;
}

export function formatScaledDecimal(value: bigint, scale: number): string {
	const negative = value < 0n;
	const absolute = negative ? -value : value;
	const divisor = power10(scale);
	const whole = absolute / divisor;
	if (scale === 0) return `${negative ? '-' : ''}${whole.toString()}`;
	const fraction = (absolute % divisor).toString().padStart(scale, '0');
	return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

function divideRoundedHalfUp(numerator: bigint, denominator: bigint): bigint {
	if (denominator <= 0n) throw new CommercialDecimalError('Decimal divisor must be positive.');
	const negative = numerator < 0n;
	const absolute = negative ? -numerator : numerator;
	const quotient = absolute / denominator;
	const remainder = absolute % denominator;
	const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;
	return negative ? -rounded : rounded;
}

export function multiplyScaledDecimals(
	left: string,
	leftScale: number,
	right: string,
	rightScale: number,
	outputScale: number,
	leftLabel = 'Left value',
	rightLabel = 'Right value'
): string {
	const a = parseScaledDecimal(left, leftScale, leftLabel);
	const b = parseScaledDecimal(right, rightScale, rightLabel);
	const inputScale = leftScale + rightScale;
	let scaled: bigint;
	if (inputScale === outputScale) {
		scaled = a * b;
	} else if (inputScale > outputScale) {
		scaled = divideRoundedHalfUp(a * b, power10(inputScale - outputScale));
	} else {
		scaled = a * b * power10(outputScale - inputScale);
	}
	return formatScaledDecimal(scaled, outputScale);
}

export function lineAmount(quantity: string, unitRate: string): string {
	return multiplyScaledDecimals(quantity, 6, unitRate, 4, 4, 'Quantity', 'Unit rate');
}

export function percentageAmount(baseAmount: string, ratePercent: string): string {
	const base = parseScaledDecimal(baseAmount, 4, 'Taxable amount');
	const rate = parseScaledDecimal(ratePercent, 4, 'Rate percent');
	// base has scale 4 and percentage has scale 4. Dividing by 100 and
	// returning scale 4 means dividing their product by 10^6.
	return formatScaledDecimal(divideRoundedHalfUp(base * rate, 1_000_000n), 4);
}

export function applyPercentage(baseAmount: string, ratePercent: string): string {
	const base = parseScaledDecimal(baseAmount, 4, 'Base amount');
	const adjustment = parseScaledDecimal(percentageAmount(baseAmount, ratePercent), 4, 'Adjustment');
	return formatScaledDecimal(base + adjustment, 4);
}

export function sumMoney(values: readonly string[]): string {
	let total = 0n;
	for (const value of values) total += parseScaledDecimal(value, 4, 'Money amount', true);
	return formatScaledDecimal(total, 4);
}

export function subtractMoney(left: string, right: string): string {
	const result = parseScaledDecimal(left, 4, 'Money amount', true) - parseScaledDecimal(right, 4, 'Money amount', true);
	return formatScaledDecimal(result, 4);
}

export function compareMoney(left: string, right: string): number {
	const a = parseScaledDecimal(left, 4, 'Money amount', true);
	const b = parseScaledDecimal(right, 4, 'Money amount', true);
	return a === b ? 0 : a < b ? -1 : 1;
}
