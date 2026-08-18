import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError, validateCurrencyCode } from './finance-common';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type NormalBalance = 'debit' | 'credit';

type AggregatedAccount = {
	publicId: string;
	accountCode: string;
	name: string;
	accountType: AccountType;
	normalBalance: NormalBalance;
	openingNet: bigint;
	periodDebit: bigint;
	periodCredit: bigint;
	yearDebit: bigint;
	yearCredit: bigint;
	closingNet: bigint;
};

export type TrialBalanceRow = {
	accountPublicId: string;
	accountCode: string;
	name: string;
	accountType: AccountType;
	normalBalance: NormalBalance;
	openingDebit: string;
	openingCredit: string;
	periodDebit: string;
	periodCredit: string;
	closingDebit: string;
	closingCredit: string;
};

export type FinancialReportRow = {
	accountPublicId: string;
	accountCode: string;
	name: string;
	amount: string;
};

export type AccountingReportingWorkspace = {
	periods: Array<{
		publicId: string;
		financialYearPublicId: string;
		financialYearCode: string;
		financialYearName: string;
		financialYearStartsOn: Date;
		periodNumber: number;
		name: string;
		startsOn: Date;
		endsOn: Date;
		status: string;
	}>;
	currencies: string[];
	selectedPeriod: null | {
		publicId: string;
		financialYearPublicId: string;
		financialYearCode: string;
		financialYearName: string;
		financialYearStartsOn: Date;
		periodNumber: number;
		name: string;
		startsOn: Date;
		endsOn: Date;
		status: string;
	};
	selectedCurrency: string;
	trialBalance: {
		rows: TrialBalanceRow[];
		openingDebit: string;
		openingCredit: string;
		periodDebit: string;
		periodCredit: string;
		closingDebit: string;
		closingCredit: string;
		openingBalanced: boolean;
		periodBalanced: boolean;
		closingBalanced: boolean;
	};
	profitAndLoss: {
		revenue: FinancialReportRow[];
		expenses: FinancialReportRow[];
		periodRevenue: string;
		periodExpenses: string;
		periodProfit: string;
		yearToDateRevenue: string;
		yearToDateExpenses: string;
		yearToDateProfit: string;
	};
	balanceSheet: {
		assets: FinancialReportRow[];
		liabilities: FinancialReportRow[];
		equity: FinancialReportRow[];
		assetsTotal: string;
		liabilitiesTotal: string;
		equityTotal: string;
		unclosedEarnings: string;
		liabilitiesEquityAndEarningsTotal: string;
		balanced: boolean;
	};
};

function money(value: unknown): bigint {
	return parseScaledDecimal(String(value), 4, 'Accounting report amount', true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, 4);
}

function splitNet(value: bigint): { debit: bigint; credit: bigint } {
	return value >= 0n ? { debit: value, credit: 0n } : { debit: 0n, credit: -value };
}

function naturalAmount(account: AggregatedAccount, net: bigint): bigint {
	return account.normalBalance === 'debit' ? net : -net;
}

function rowAmount(account: AggregatedAccount, amount: bigint): FinancialReportRow {
	return {
		accountPublicId: account.publicId,
		accountCode: account.accountCode,
		name: account.name,
		amount: moneyText(amount)
	};
}

function dateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export class AccountingReportingService {
	constructor(private readonly db: Database) {}

	private async assertView(actor: TenantActorContext) {
		const access = new FinanceAccessPolicy(this.db);
		await access.assertActiveActor(actor);
		const [financeView, accountingView] = await Promise.all([
			access.viewDecision(actor),
			access.accountingViewDecision(actor)
		]);
		if (!financeView.allowed || !accountingView.allowed) throw new TenantAccessError();
	}

	async getWorkspace(
		actor: TenantActorContext,
		input: { periodPublicId?: string | null; currencyCode?: string | null } = {}
	): Promise<AccountingReportingWorkspace> {
		await this.assertView(actor);

		const [periodRows, currencyRows, organisation] = await Promise.all([
			this.db
				.selectFrom('accounting_periods as period')
				.innerJoin('accounting_financial_years as year', (join) =>
					join.onRef('year.id', '=', 'period.financial_year_id').onRef('year.organisation_id', '=', 'period.organisation_id')
				)
				.select([
					'period.public_id as publicId',
					'year.public_id as financialYearPublicId',
					'year.year_code as financialYearCode',
					'year.name as financialYearName',
					'year.starts_on as financialYearStartsOn',
					'period.period_number as periodNumber',
					'period.name',
					'period.starts_on as startsOn',
					'period.ends_on as endsOn',
					'period.status'
				])
				.where('period.organisation_id', '=', actor.organisationId)
				.orderBy('period.ends_on', 'desc')
				.orderBy('period.period_number', 'desc')
				.execute(),
			this.db
				.selectFrom('accounting_journal_entries')
				.select('currency_code as currencyCode')
				.distinct()
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('currency_code')
				.execute(),
			this.db
				.selectFrom('organisations')
				.select('default_currency_code as defaultCurrencyCode')
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow()
		]);

		const periods = periodRows.map((row) => ({
			...row,
			periodNumber: Number(row.periodNumber)
		}));
		const selectedPeriod = input.periodPublicId
			? periods.find((period) => period.publicId === input.periodPublicId) ?? null
			: periods[0] ?? null;
		if (input.periodPublicId && !selectedPeriod) {
			throw new FinanceValidationError('The selected accounting period is unavailable.');
		}

		const currencies = [...new Set([organisation.defaultCurrencyCode, ...currencyRows.map((row) => row.currencyCode)])].sort();
		const requestedCurrency = validateCurrencyCode(input.currencyCode, 'Reporting currency');
		const selectedCurrency = requestedCurrency ?? organisation.defaultCurrencyCode;
		if (!selectedPeriod) return this.emptyWorkspace(periods, currencies, selectedCurrency);

		const [accounts, lines] = await Promise.all([
			this.db
				.selectFrom('accounting_accounts')
				.select([
					'id',
					'public_id as publicId',
					'account_code as accountCode',
					'name',
					'account_type as accountType',
					'normal_balance as normalBalance'
				])
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('account_code')
				.execute(),
			this.db
				.selectFrom('accounting_journal_lines as line')
				.innerJoin('accounting_journal_entries as journal', (join) =>
					join.onRef('journal.id', '=', 'line.journal_entry_id').onRef('journal.organisation_id', '=', 'line.organisation_id')
				)
				.select([
					'line.accounting_account_id as accountId',
					'line.debit_amount as debitAmount',
					'line.credit_amount as creditAmount',
					'journal.accounting_date as accountingDate'
				])
				.where('journal.organisation_id', '=', actor.organisationId)
				.where('journal.currency_code', '=', selectedCurrency)
				.where('journal.accounting_date', '<=', selectedPeriod.endsOn)
				.execute()
		]);

		const byAccount = new Map<string, AggregatedAccount>();
		for (const account of accounts) {
			byAccount.set(String(account.id), {
				publicId: account.publicId,
				accountCode: account.accountCode,
				name: account.name,
				accountType: account.accountType as AccountType,
				normalBalance: account.normalBalance as NormalBalance,
				openingNet: 0n,
				periodDebit: 0n,
				periodCredit: 0n,
				yearDebit: 0n,
				yearCredit: 0n,
				closingNet: 0n
			});
		}

		const periodStart = dateKey(selectedPeriod.startsOn);
		const periodEnd = dateKey(selectedPeriod.endsOn);
		const yearStart = dateKey(selectedPeriod.financialYearStartsOn);
		for (const line of lines) {
			const aggregate = byAccount.get(String(line.accountId));
			if (!aggregate) continue;
			const debit = money(line.debitAmount);
			const credit = money(line.creditAmount);
			const net = debit - credit;
			const accountingDate = dateKey(line.accountingDate);
			aggregate.closingNet += net;
			if (accountingDate < periodStart) aggregate.openingNet += net;
			if (accountingDate >= periodStart && accountingDate <= periodEnd) {
				aggregate.periodDebit += debit;
				aggregate.periodCredit += credit;
			}
			if (accountingDate >= yearStart && accountingDate <= periodEnd) {
				aggregate.yearDebit += debit;
				aggregate.yearCredit += credit;
			}
		}

		const activeAccounts = [...byAccount.values()].filter((account) =>
			account.openingNet !== 0n || account.periodDebit !== 0n || account.periodCredit !== 0n || account.closingNet !== 0n
		);
		const trialRows: TrialBalanceRow[] = [];
		let openingDebit = 0n;
		let openingCredit = 0n;
		let periodDebit = 0n;
		let periodCredit = 0n;
		let closingDebit = 0n;
		let closingCredit = 0n;
		for (const account of activeAccounts) {
			const opening = splitNet(account.openingNet);
			const closing = splitNet(account.closingNet);
			openingDebit += opening.debit;
			openingCredit += opening.credit;
			periodDebit += account.periodDebit;
			periodCredit += account.periodCredit;
			closingDebit += closing.debit;
			closingCredit += closing.credit;
			trialRows.push({
				accountPublicId: account.publicId,
				accountCode: account.accountCode,
				name: account.name,
				accountType: account.accountType,
				normalBalance: account.normalBalance,
				openingDebit: moneyText(opening.debit),
				openingCredit: moneyText(opening.credit),
				periodDebit: moneyText(account.periodDebit),
				periodCredit: moneyText(account.periodCredit),
				closingDebit: moneyText(closing.debit),
				closingCredit: moneyText(closing.credit)
			});
		}

		const revenueAccounts = activeAccounts.filter((account) => account.accountType === 'revenue');
		const expenseAccounts = activeAccounts.filter((account) => account.accountType === 'expense');
		const periodRevenue = revenueAccounts.reduce((sum, account) => sum + (account.periodCredit - account.periodDebit), 0n);
		const periodExpenses = expenseAccounts.reduce((sum, account) => sum + (account.periodDebit - account.periodCredit), 0n);
		const yearRevenue = revenueAccounts.reduce((sum, account) => sum + (account.yearCredit - account.yearDebit), 0n);
		const yearExpenses = expenseAccounts.reduce((sum, account) => sum + (account.yearDebit - account.yearCredit), 0n);

		const assetAccounts = activeAccounts.filter((account) => account.accountType === 'asset');
		const liabilityAccounts = activeAccounts.filter((account) => account.accountType === 'liability');
		const equityAccounts = activeAccounts.filter((account) => account.accountType === 'equity');
		const assetsTotal = assetAccounts.reduce((sum, account) => sum + naturalAmount(account, account.closingNet), 0n);
		const liabilitiesTotal = liabilityAccounts.reduce((sum, account) => sum + naturalAmount(account, account.closingNet), 0n);
		const equityTotal = equityAccounts.reduce((sum, account) => sum + naturalAmount(account, account.closingNet), 0n);
		const cumulativeRevenue = revenueAccounts.reduce((sum, account) => sum + (account.closingNet * -1n), 0n);
		const cumulativeExpenses = expenseAccounts.reduce((sum, account) => sum + account.closingNet, 0n);
		const unclosedEarnings = cumulativeRevenue - cumulativeExpenses;
		const liabilitiesEquityAndEarningsTotal = liabilitiesTotal + equityTotal + unclosedEarnings;

		return {
			periods,
			currencies,
			selectedPeriod,
			selectedCurrency,
			trialBalance: {
				rows: trialRows,
				openingDebit: moneyText(openingDebit),
				openingCredit: moneyText(openingCredit),
				periodDebit: moneyText(periodDebit),
				periodCredit: moneyText(periodCredit),
				closingDebit: moneyText(closingDebit),
				closingCredit: moneyText(closingCredit),
				openingBalanced: openingDebit === openingCredit,
				periodBalanced: periodDebit === periodCredit,
				closingBalanced: closingDebit === closingCredit
			},
			profitAndLoss: {
				revenue: revenueAccounts.map((account) => rowAmount(account, account.periodCredit - account.periodDebit)),
				expenses: expenseAccounts.map((account) => rowAmount(account, account.periodDebit - account.periodCredit)),
				periodRevenue: moneyText(periodRevenue),
				periodExpenses: moneyText(periodExpenses),
				periodProfit: moneyText(periodRevenue - periodExpenses),
				yearToDateRevenue: moneyText(yearRevenue),
				yearToDateExpenses: moneyText(yearExpenses),
				yearToDateProfit: moneyText(yearRevenue - yearExpenses)
			},
			balanceSheet: {
				assets: assetAccounts.map((account) => rowAmount(account, naturalAmount(account, account.closingNet))),
				liabilities: liabilityAccounts.map((account) => rowAmount(account, naturalAmount(account, account.closingNet))),
				equity: equityAccounts.map((account) => rowAmount(account, naturalAmount(account, account.closingNet))),
				assetsTotal: moneyText(assetsTotal),
				liabilitiesTotal: moneyText(liabilitiesTotal),
				equityTotal: moneyText(equityTotal),
				unclosedEarnings: moneyText(unclosedEarnings),
				liabilitiesEquityAndEarningsTotal: moneyText(liabilitiesEquityAndEarningsTotal),
				balanced: assetsTotal === liabilitiesEquityAndEarningsTotal
			}
		};
	}

	private emptyWorkspace(
		periods: AccountingReportingWorkspace['periods'],
		currencies: string[],
		selectedCurrency: string
	): AccountingReportingWorkspace {
		return {
			periods,
			currencies,
			selectedPeriod: null,
			selectedCurrency,
			trialBalance: {
				rows: [],
				openingDebit: '0.0000', openingCredit: '0.0000', periodDebit: '0.0000', periodCredit: '0.0000', closingDebit: '0.0000', closingCredit: '0.0000',
				openingBalanced: true, periodBalanced: true, closingBalanced: true
			},
			profitAndLoss: {
				revenue: [], expenses: [], periodRevenue: '0.0000', periodExpenses: '0.0000', periodProfit: '0.0000', yearToDateRevenue: '0.0000', yearToDateExpenses: '0.0000', yearToDateProfit: '0.0000'
			},
			balanceSheet: {
				assets: [], liabilities: [], equity: [], assetsTotal: '0.0000', liabilitiesTotal: '0.0000', equityTotal: '0.0000', unclosedEarnings: '0.0000', liabilitiesEquityAndEarningsTotal: '0.0000', balanced: true
			}
		};
	}
}
