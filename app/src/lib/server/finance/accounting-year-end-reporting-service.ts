import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { Database } from '$lib/server/db/database';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	AccountingReportingService,
	type AccountingReportingWorkspace,
	type FinancialReportRow
} from './accounting-reporting-service';

type ReportAccount = {
	publicId: string;
	code: string;
	name: string;
	type: 'revenue' | 'expense';
	periodDebit: bigint;
	periodCredit: bigint;
	yearDebit: bigint;
	yearCredit: bigint;
};

function money(value: unknown): bigint {
	return parseScaledDecimal(String(value), 4, 'Accounting report amount', true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, 4);
}

function reportRow(account: ReportAccount, amount: bigint): FinancialReportRow {
	return {
		accountPublicId: account.publicId,
		accountCode: account.code,
		name: account.name,
		amount: moneyText(amount)
	};
}

export class AccountingYearEndReportingService {
	constructor(private readonly db: Database) {}

	async getWorkspace(
		actor: TenantActorContext,
		input: { periodPublicId?: string | null; currencyCode?: string | null } = {}
	): Promise<AccountingReportingWorkspace> {
		const workspace = await new AccountingReportingService(this.db).getWorkspace(actor, input);
		if (!workspace.selectedPeriod) return workspace;

		const year = await this.db
			.selectFrom('accounting_financial_years')
			.select('id')
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', workspace.selectedPeriod.financialYearPublicId)
			.executeTakeFirstOrThrow();
		const closeRows = await this.db
			.selectFrom('accounting_year_end_closes as close')
			.leftJoin('accounting_year_end_close_reversals as reversal', (join) =>
				join
					.onRef('reversal.year_end_close_id', '=', 'close.id')
					.onRef('reversal.organisation_id', '=', 'close.organisation_id')
			)
			.select([
				'close.closing_journal_entry_id as closingJournalId',
				'reversal.reversal_journal_entry_id as reversalJournalId'
			])
			.where('close.organisation_id', '=', actor.organisationId)
			.where('close.financial_year_id', '=', year.id)
			.where('close.currency_code', '=', workspace.selectedCurrency)
			.execute();
		const excludedJournalIds = closeRows.flatMap((row) =>
			[row.closingJournalId, row.reversalJournalId].filter(
				(value): value is string => value !== null
			)
		);

		let query = this.db
			.selectFrom('accounting_journal_lines as line')
			.innerJoin('accounting_journal_entries as journal', (join) =>
				join
					.onRef('journal.id', '=', 'line.journal_entry_id')
					.onRef('journal.organisation_id', '=', 'line.organisation_id')
			)
			.innerJoin('accounting_accounts as account', (join) =>
				join
					.onRef('account.id', '=', 'line.accounting_account_id')
					.onRef('account.organisation_id', '=', 'line.organisation_id')
			)
			.select([
				'account.id as accountId',
				'account.public_id as accountPublicId',
				'account.account_code as accountCode',
				'account.name as accountName',
				'account.account_type as accountType',
				'line.debit_amount as debitAmount',
				'line.credit_amount as creditAmount',
				'journal.accounting_date as accountingDate'
			])
			.where('journal.organisation_id', '=', actor.organisationId)
			.where('journal.currency_code', '=', workspace.selectedCurrency)
			.where('journal.accounting_date', '>=', workspace.selectedPeriod.financialYearStartsOn)
			.where('journal.accounting_date', '<=', workspace.selectedPeriod.endsOn)
			.where('account.account_type', 'in', ['revenue', 'expense']);
		if (excludedJournalIds.length > 0)
			query = query.where('journal.id', 'not in', excludedJournalIds);
		const rows = await query.execute();

		const accounts = new Map<string, ReportAccount>();
		for (const row of rows) {
			const key = String(row.accountId);
			const account = accounts.get(key) ?? {
				publicId: row.accountPublicId,
				code: row.accountCode,
				name: row.accountName,
				type: row.accountType as 'revenue' | 'expense',
				periodDebit: 0n,
				periodCredit: 0n,
				yearDebit: 0n,
				yearCredit: 0n
			};
			const debit = money(row.debitAmount);
			const credit = money(row.creditAmount);
			account.yearDebit += debit;
			account.yearCredit += credit;
			if (
				row.accountingDate >= workspace.selectedPeriod.startsOn &&
				row.accountingDate <= workspace.selectedPeriod.endsOn
			) {
				account.periodDebit += debit;
				account.periodCredit += credit;
			}
			accounts.set(key, account);
		}
		const ordered = [...accounts.values()].sort((a, b) => a.code.localeCompare(b.code));
		const revenue = ordered.filter((account) => account.type === 'revenue');
		const expenses = ordered.filter((account) => account.type === 'expense');
		const periodRevenue = revenue.reduce(
			(sum, account) => sum + account.periodCredit - account.periodDebit,
			0n
		);
		const periodExpenses = expenses.reduce(
			(sum, account) => sum + account.periodDebit - account.periodCredit,
			0n
		);
		const yearRevenue = revenue.reduce(
			(sum, account) => sum + account.yearCredit - account.yearDebit,
			0n
		);
		const yearExpenses = expenses.reduce(
			(sum, account) => sum + account.yearDebit - account.yearCredit,
			0n
		);
		workspace.profitAndLoss = {
			revenue: revenue.map((account) =>
				reportRow(account, account.periodCredit - account.periodDebit)
			),
			expenses: expenses.map((account) =>
				reportRow(account, account.periodDebit - account.periodCredit)
			),
			periodRevenue: moneyText(periodRevenue),
			periodExpenses: moneyText(periodExpenses),
			periodProfit: moneyText(periodRevenue - periodExpenses),
			yearToDateRevenue: moneyText(yearRevenue),
			yearToDateExpenses: moneyText(yearExpenses),
			yearToDateProfit: moneyText(yearRevenue - yearExpenses)
		};
		return workspace;
	}
}
