import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	FinanceAccessPolicy,
	FinanceValidationError,
	validateCurrencyCode
} from './finance-common';

type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
type NormalBalance = 'debit' | 'credit';
type LedgerPhase = 'opening' | 'period';

export type AccountingReportSourceReference = {
	href: string;
	label: string;
};

export type AccountingReportDrillthroughWorkspace = {
	account: {
		publicId: string;
		accountCode: string;
		name: string;
		accountType: AccountType;
		normalBalance: NormalBalance;
	};
	period: {
		publicId: string;
		financialYearPublicId: string;
		financialYearCode: string;
		financialYearName: string;
		periodNumber: number;
		name: string;
		startsOn: Date;
		endsOn: Date;
		status: string;
	};
	currencyCode: string;
	summary: {
		openingDebit: string;
		openingCredit: string;
		periodDebit: string;
		periodCredit: string;
		closingDebit: string;
		closingCredit: string;
	};
	entries: Array<{
		journalPublicId: string;
		journalNumber: string;
		accountingDate: Date;
		postedAt: Date;
		memo: string;
		description: string;
		sourceType: string;
		sourcePublicId: string;
		sourceReference: AccountingReportSourceReference | null;
		debitAmount: string;
		creditAmount: string;
		phase: LedgerPhase;
		runningDebit: string;
		runningCredit: string;
		reversedAt: Date | null;
	}>;
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

function dateKey(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function encoded(value: string): string {
	return encodeURIComponent(value);
}

export function accountingReportSourceReference(
	sourceType: string,
	sourcePublicId: string
): AccountingReportSourceReference | null {
	switch (sourceType) {
		case 'invoice_issue':
		case 'invoice_void':
			return {
				href: `/finance/invoices/${encoded(sourcePublicId)}`,
				label: 'Customer invoice'
			};
		case 'credit_note_issue':
			return {
				href: `/finance/credit-notes/${encoded(sourcePublicId)}`,
				label: 'Customer credit note'
			};
		case 'accounts_payable_invoice_approval':
		case 'accounts_payable_credit_note_approval':
			return { href: '/finance/accounts-payable', label: 'Accounts payable' };
		case 'supplier_payment_execution':
		case 'supplier_payment_reversal':
			return { href: '/finance/supplier-payments', label: 'Supplier payments' };
		case 'payment_receipt':
		case 'payment_reversal':
			return {
				href: `/finance/payments/${encoded(sourcePublicId)}`,
				label: 'Customer payment'
			};
		case 'payment_allocation':
		case 'payment_allocation_reversal':
			return { href: '/finance/payments', label: 'Customer payments' };
		case 'bad_debt_write_off':
		case 'bad_debt_write_off_reversal':
		case 'bad_debt_recovery':
		case 'bad_debt_recovery_reversal':
			return { href: '/finance/bad-debt', label: 'Bad debt' };
		case 'vat_relief_posting':
		case 'vat_relief_posting_reversal':
			return { href: '/finance/tax-relief', label: 'VAT relief' };
		case 'year_end_close':
			return { href: '/finance/accounting/year-end', label: 'Year-end close' };
		case 'journal_reversal':
			return { href: '/finance/accounting', label: 'Accounting journals' };
		default:
			return null;
	}
}

export class AccountingReportDrillthroughService {
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

	async getAccountWorkspace(
		actor: TenantActorContext,
		input: { accountPublicId: string; periodPublicId: string; currencyCode?: string | null }
	): Promise<AccountingReportDrillthroughWorkspace> {
		await this.assertView(actor);

		const [account, period, organisation] = await Promise.all([
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
				.where('public_id', '=', input.accountPublicId)
				.executeTakeFirst(),
			this.db
				.selectFrom('accounting_periods as period')
				.innerJoin('accounting_financial_years as year', (join) =>
					join
						.onRef('year.id', '=', 'period.financial_year_id')
						.onRef('year.organisation_id', '=', 'period.organisation_id')
				)
				.select([
					'period.public_id as publicId',
					'year.public_id as financialYearPublicId',
					'year.year_code as financialYearCode',
					'year.name as financialYearName',
					'period.period_number as periodNumber',
					'period.name',
					'period.starts_on as startsOn',
					'period.ends_on as endsOn',
					'period.status'
				])
				.where('period.organisation_id', '=', actor.organisationId)
				.where('period.public_id', '=', input.periodPublicId)
				.executeTakeFirst(),
			this.db
				.selectFrom('organisations')
				.select('default_currency_code as defaultCurrencyCode')
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow()
		]);

		if (!account) throw new RecordNotFoundError('Accounting account not found.');
		if (!period) throw new RecordNotFoundError('Accounting period not found.');

		const requestedCurrency = validateCurrencyCode(input.currencyCode, 'Reporting currency');
		const currencyCode = requestedCurrency ?? organisation.defaultCurrencyCode;
		if (!currencyCode) throw new FinanceValidationError('Reporting currency is required.');

		const rows = await this.db
			.selectFrom('accounting_journal_lines as line')
			.innerJoin('accounting_journal_entries as journal', (join) =>
				join
					.onRef('journal.id', '=', 'line.journal_entry_id')
					.onRef('journal.organisation_id', '=', 'line.organisation_id')
			)
			.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
				join
					.onRef('reversal.journal_entry_id', '=', 'journal.id')
					.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
			)
			.select([
				'journal.public_id as journalPublicId',
				'journal.journal_number as journalNumber',
				'journal.accounting_date as accountingDate',
				'journal.posted_at as postedAt',
				'journal.memo',
				'journal.source_type as sourceType',
				'journal.source_public_id as sourcePublicId',
				'line.line_number as lineNumber',
				'line.description',
				'line.debit_amount as debitAmount',
				'line.credit_amount as creditAmount',
				'reversal.reversed_at as reversedAt'
			])
			.where('journal.organisation_id', '=', actor.organisationId)
			.where('journal.currency_code', '=', currencyCode)
			.where('line.accounting_account_id', '=', account.id)
			.where('journal.accounting_date', '<=', period.endsOn)
			.orderBy('journal.accounting_date')
			.orderBy('journal.journal_number')
			.orderBy('line.line_number')
			.execute();

		const periodStart = dateKey(period.startsOn);
		let openingNet = 0n;
		let periodDebit = 0n;
		let periodCredit = 0n;
		let runningNet = 0n;
		const entries: AccountingReportDrillthroughWorkspace['entries'] = [];

		for (const row of rows) {
			const debit = money(row.debitAmount);
			const credit = money(row.creditAmount);
			const net = debit - credit;
			const phase: LedgerPhase = dateKey(row.accountingDate) < periodStart ? 'opening' : 'period';
			if (phase === 'opening') openingNet += net;
			else {
				periodDebit += debit;
				periodCredit += credit;
			}
			runningNet += net;
			const running = splitNet(runningNet);
			entries.push({
				journalPublicId: row.journalPublicId,
				journalNumber: row.journalNumber,
				accountingDate: row.accountingDate,
				postedAt: row.postedAt,
				memo: row.memo,
				description: row.description,
				sourceType: row.sourceType,
				sourcePublicId: row.sourcePublicId,
				sourceReference: accountingReportSourceReference(row.sourceType, row.sourcePublicId),
				debitAmount: moneyText(debit),
				creditAmount: moneyText(credit),
				phase,
				runningDebit: moneyText(running.debit),
				runningCredit: moneyText(running.credit),
				reversedAt: row.reversedAt
			});
		}

		const opening = splitNet(openingNet);
		const closing = splitNet(openingNet + periodDebit - periodCredit);
		return {
			account: {
				publicId: account.publicId,
				accountCode: account.accountCode,
				name: account.name,
				accountType: account.accountType as AccountType,
				normalBalance: account.normalBalance as NormalBalance
			},
			period: {
				...period,
				periodNumber: Number(period.periodNumber)
			},
			currencyCode,
			summary: {
				openingDebit: moneyText(opening.debit),
				openingCredit: moneyText(opening.credit),
				periodDebit: moneyText(periodDebit),
				periodCredit: moneyText(periodCredit),
				closingDebit: moneyText(closing.debit),
				closingCredit: moneyText(closing.credit)
			},
			entries
		};
	}
}
