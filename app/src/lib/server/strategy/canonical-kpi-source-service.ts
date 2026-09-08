import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { AccountingYearEndReportingService } from '$lib/server/finance/accounting-year-end-reporting-service';

export class CanonicalKpiSourceValidationError extends Error {
	readonly code = 'CANONICAL_KPI_SOURCE_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'CanonicalKpiSourceValidationError';
	}
}

export type CanonicalKpiSourceResolution = {
	value: string;
	observedOn: Date;
	sourceDomain: 'finance';
	sourceRecordType: 'accounting_profit_and_loss';
	sourcePublicId: string;
	sourceMeasureKey: string;
	sourceHref: string;
	sourceLabel: string;
};

const SUPPORTED_MEASURES = new Set([
	'period_revenue',
	'period_expenses',
	'period_profit',
	'period_profit_margin_percent',
	'year_to_date_revenue',
	'year_to_date_expenses',
	'year_to_date_profit',
	'year_to_date_profit_margin_percent'
]);

function money(value: string): bigint {
	return parseScaledDecimal(value, 4, 'Canonical accounting measure', true);
}

function percentage(numerator: string, denominator: string): string {
	const numeratorScaled = money(numerator);
	const denominatorScaled = money(denominator);
	if (denominatorScaled === 0n)
		throw new CanonicalKpiSourceValidationError(
			'Profit margin cannot be calculated because canonical revenue is zero.'
		);
	const sign = numeratorScaled < 0n !== denominatorScaled < 0n ? -1n : 1n;
	const absoluteNumerator = numeratorScaled < 0n ? -numeratorScaled : numeratorScaled;
	const absoluteDenominator = denominatorScaled < 0n ? -denominatorScaled : denominatorScaled;
	const scaledPercentNumerator = absoluteNumerator * 1_000_000n;
	const rounded = (scaledPercentNumerator + absoluteDenominator / 2n) / absoluteDenominator;
	return formatScaledDecimal(sign * rounded, 4);
}

export function canonicalKpiSourceHref(input: {
	sourceDomain: string | null;
	sourceRecordType: string | null;
	sourcePublicId: string | null;
}): string | null {
	if (
		input.sourceDomain === 'finance' &&
		input.sourceRecordType === 'accounting_profit_and_loss' &&
		input.sourcePublicId
	) {
		return `/finance/accounting/reports?period=${encodeURIComponent(input.sourcePublicId)}`;
	}
	return null;
}

export class CanonicalKpiSourceService {
	constructor(private readonly db: Database) {}

	async resolve(
		actor: TenantActorContext,
		input: {
			sourceDomain: string;
			sourceRecordType: string;
			sourcePublicId: string;
			sourceMeasureKey: string;
		}
	): Promise<CanonicalKpiSourceResolution> {
		const sourceDomain = input.sourceDomain.trim();
		const sourceRecordType = input.sourceRecordType.trim();
		const sourcePublicId = input.sourcePublicId.trim();
		const sourceMeasureKey = input.sourceMeasureKey.trim();

		if (sourceDomain !== 'finance' || sourceRecordType !== 'accounting_profit_and_loss') {
			throw new CanonicalKpiSourceValidationError(
				'Unsupported canonical KPI source. F01 currently resolves governed finance profit-and-loss measures.'
			);
		}
		if (!sourcePublicId)
			throw new CanonicalKpiSourceValidationError('Canonical source period is required.');
		if (!SUPPORTED_MEASURES.has(sourceMeasureKey)) {
			throw new CanonicalKpiSourceValidationError(
				`Unsupported accounting profit-and-loss measure: ${sourceMeasureKey}.`
			);
		}

		const workspace = await new AccountingYearEndReportingService(this.db).getWorkspace(actor, {
			periodPublicId: sourcePublicId
		});
		if (!workspace.selectedPeriod || workspace.selectedPeriod.publicId !== sourcePublicId)
			throw new RecordNotFoundError('Canonical accounting period was not found.');

		const profitAndLoss = workspace.profitAndLoss;
		const values: Record<string, string> = {
			period_revenue: profitAndLoss.periodRevenue,
			period_expenses: profitAndLoss.periodExpenses,
			period_profit: profitAndLoss.periodProfit,
			period_profit_margin_percent: percentage(
				profitAndLoss.periodProfit,
				profitAndLoss.periodRevenue
			),
			year_to_date_revenue: profitAndLoss.yearToDateRevenue,
			year_to_date_expenses: profitAndLoss.yearToDateExpenses,
			year_to_date_profit: profitAndLoss.yearToDateProfit,
			year_to_date_profit_margin_percent: percentage(
				profitAndLoss.yearToDateProfit,
				profitAndLoss.yearToDateRevenue
			)
		};

		return {
			value: values[sourceMeasureKey],
			observedOn: workspace.selectedPeriod.endsOn,
			sourceDomain: 'finance',
			sourceRecordType: 'accounting_profit_and_loss',
			sourcePublicId,
			sourceMeasureKey,
			sourceHref: canonicalKpiSourceHref({
				sourceDomain: 'finance',
				sourceRecordType: 'accounting_profit_and_loss',
				sourcePublicId
			})!,
			sourceLabel: `${workspace.selectedPeriod.financialYearCode} · ${workspace.selectedPeriod.name} · ${workspace.selectedCurrency}`
		};
	}
}
