import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal,
	subtractMoney,
	sumMoney
} from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy, FinanceValidationError } from './finance-common';

export type ReceivableAgingBucketCode = 'current' | '1_30' | '31_60' | '61_90' | '91_plus';

export type ReceivableAgingBucket = {
	code: ReceivableAgingBucketCode;
	label: string;
	amount: string;
	invoiceCount: number;
};

export type ReceivableInvoiceAging = {
	invoicePublicId: string;
	invoiceNumber: string;
	currencyCode: string;
	issuedAt: Date;
	dueDate: Date | null;
	invoiceGross: string;
	issuedCreditGross: string;
	activeAllocatedAmount: string;
	outstandingAmount: string;
	daysOverdue: number;
	bucket: ReceivableAgingBucketCode;
};

export type CustomerCurrencyReceivable = {
	currencyCode: string;
	issuedInvoiceCount: number;
	openInvoiceCount: number;
	totalOutstanding: string;
	buckets: ReceivableAgingBucket[];
	invoices: ReceivableInvoiceAging[];
};

export type CustomerReceivableAccount = {
	customerPartyPublicId: string;
	customerDisplayName: string;
	customerAccountReference: string | null;
	positions: CustomerCurrencyReceivable[];
};

export type ReceivablesPortfolio = {
	asOf: string;
	accounts: CustomerReceivableAccount[];
	totals: CustomerCurrencyReceivable[];
};

export type StatementMovementKind =
	| 'invoice'
	| 'invoice_void'
	| 'credit_note'
	| 'payment_allocation'
	| 'allocation_reversal';

export type StatementMovement = {
	id: string;
	occurredAt: Date;
	kind: StatementMovementKind;
	reference: string;
	description: string;
	invoicePublicId: string | null;
	debitAmount: string;
	creditAmount: string;
	runningBalance: string;
};

export type CurrencyStatement = {
	currencyCode: string;
	openingBalance: string;
	movements: StatementMovement[];
	closingBalance: string;
};

export type CustomerStatementWorkspace = {
	customer: {
		publicId: string;
		displayName: string;
		customerAccountReference: string | null;
	};
	period: {
		from: string;
		to: string;
		timezone: string;
	};
	statements: CurrencyStatement[];
	aging: CustomerCurrencyReceivable[];
};

type RawStatementMovement = Omit<StatementMovement, 'runningBalance'> & {
	currencyCode: string;
	sortKey: string;
};

type CustomerRecord = {
	id: string;
	publicId: string;
	displayName: string;
	customerAccountReference: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const ZERO = '0.0000';
const AGING_LABELS: Record<ReceivableAgingBucketCode, string> = {
	current: 'Current',
	'1_30': '1–30 days',
	'31_60': '31–60 days',
	'61_90': '61–90 days',
	'91_plus': '91+ days'
};

function partyDisplayName(row: {
	partyKind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	if (row.partyKind === 'person') {
		const preferred = row.preferredName?.trim();
		const family = row.familyName?.trim();
		if (preferred && family) return `${preferred} ${family}`;
		if (preferred) return preferred;
		return [row.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed person';
	}
	return row.tradingName?.trim() || row.legalName?.trim() || 'Unnamed organisation';
}

function dateParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
	const parts = new Intl.DateTimeFormat('en-GB', {
		timeZone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hourCycle: 'h23'
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
	return {
		year: value('year'),
		month: value('month'),
		day: value('day'),
		hour: value('hour'),
		minute: value('minute'),
		second: value('second')
	};
}

function dateTextInZone(date: Date, timeZone: string): string {
	const parts = dateParts(date, timeZone);
	return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function validateDateText(value: string, label: string): string {
	const text = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new FinanceValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
		throw new FinanceValidationError(`${label} is invalid.`);
	}
	return text;
}

function addDateOnlyDays(value: string, days: number): string {
	const date = new Date(`${value}T00:00:00.000Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}

function timezoneOffsetMs(date: Date, timeZone: string): number {
	const rounded = new Date(Math.floor(date.getTime() / 1000) * 1000);
	const parts = dateParts(rounded, timeZone);
	const representedAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
	return representedAsUtc - rounded.getTime();
}

function zonedStartOfDay(value: string, timeZone: string): Date {
	const [year, month, day] = value.split('-').map(Number);
	const wallClockUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
	const firstGuess = new Date(wallClockUtc);
	const firstOffset = timezoneOffsetMs(firstGuess, timeZone);
	let result = new Date(wallClockUtc - firstOffset);
	const secondOffset = timezoneOffsetMs(result, timeZone);
	if (secondOffset !== firstOffset) result = new Date(wallClockUtc - secondOffset);
	return result;
}

function dateOnlyDayNumber(value: string): number {
	return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / DAY_MS);
}

function moneyFromScaled(value: bigint): string {
	return formatScaledDecimal(value, 4);
}

function signedMoney(debit: string, credit: string): bigint {
	return parseScaledDecimal(debit, 4, 'Debit amount', true) - parseScaledDecimal(credit, 4, 'Credit amount', true);
}

function agingBucket(daysOverdue: number): ReceivableAgingBucketCode {
	if (daysOverdue <= 0) return 'current';
	if (daysOverdue <= 30) return '1_30';
	if (daysOverdue <= 60) return '31_60';
	if (daysOverdue <= 90) return '61_90';
	return '91_plus';
}

function emptyBuckets(): Record<ReceivableAgingBucketCode, { amount: bigint; invoiceCount: number }> {
	return {
		current: { amount: 0n, invoiceCount: 0 },
		'1_30': { amount: 0n, invoiceCount: 0 },
		'31_60': { amount: 0n, invoiceCount: 0 },
		'61_90': { amount: 0n, invoiceCount: 0 },
		'91_plus': { amount: 0n, invoiceCount: 0 }
	};
}

function publicBuckets(source: Record<ReceivableAgingBucketCode, { amount: bigint; invoiceCount: number }>): ReceivableAgingBucket[] {
	return (Object.keys(AGING_LABELS) as ReceivableAgingBucketCode[]).map((code) => ({
		code,
		label: AGING_LABELS[code],
		amount: moneyFromScaled(source[code].amount),
		invoiceCount: source[code].invoiceCount
	}));
}

export class ReceivablesReportingService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertReporting(actor: TenantActorContext): Promise<void> {
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed) {
			throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		}
	}

	private async tenantTimezone(actor: TenantActorContext): Promise<string> {
		const organisation = await this.db
			.selectFrom('organisations')
			.select('default_timezone as defaultTimezone')
			.where('id', '=', actor.organisationId)
			.executeTakeFirst();
		if (!organisation) throw new TenantAccessError();
		return organisation.defaultTimezone;
	}

	private async customerByPublicId(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<CustomerRecord | null> {
		const row = await db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join.onRef('person.party_id', '=', 'party.id').onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join.onRef('company.party_id', '=', 'party.id').onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_billing_settings as billing', (join) =>
				join.onRef('billing.party_id', '=', 'party.id').onRef('billing.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'billing.customer_account_reference as customerAccountReference'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.public_id', '=', publicId)
			.executeTakeFirst();
		return row
			? {
				id: row.id,
				publicId: row.publicId,
				displayName: partyDisplayName(row),
				customerAccountReference: row.customerAccountReference ?? null
			}
			: null;
	}

	private async documentGross(db: DatabaseExecutor, organisationId: string, documentId: string): Promise<string> {
		const items = await db
			.selectFrom('financial_document_items')
			.select(['id', 'quantity', 'unit_rate as unitRate'])
			.where('organisation_id', '=', organisationId)
			.where('financial_document_id', '=', documentId)
			.execute();
		const values: string[] = [];
		for (const item of items) {
			values.push(lineAmount(item.quantity, item.unitRate));
			const taxes = await db
				.selectFrom('financial_document_item_taxes')
				.select('tax_amount as taxAmount')
				.where('organisation_id', '=', organisationId)
				.where('financial_document_item_id', '=', item.id)
				.execute();
			values.push(...taxes.map((tax) => tax.taxAmount));
		}
		return sumMoney(values);
	}

	private async firstIssueAt(db: DatabaseExecutor, organisationId: string, documentId: string): Promise<Date | null> {
		const issue = await db
			.selectFrom('financial_document_issue_events')
			.select('issued_at as issuedAt')
			.where('organisation_id', '=', organisationId)
			.where('financial_document_id', '=', documentId)
			.orderBy('issue_sequence', 'asc')
			.executeTakeFirst();
		return issue?.issuedAt ?? null;
	}

	private async issuedCreditGrossAsOf(
		db: DatabaseExecutor,
		organisationId: string,
		invoiceDocumentId: string,
		cutoff: Date
	): Promise<string> {
		const credits = await db
			.selectFrom('credit_notes as credit')
			.innerJoin('financial_documents as document', (join) =>
				join.onRef('document.id', '=', 'credit.financial_document_id').onRef('document.organisation_id', '=', 'credit.organisation_id')
			)
			.select('document.id')
			.where('credit.organisation_id', '=', organisationId)
			.where('credit.original_invoice_document_id', '=', invoiceDocumentId)
			.where('document.lifecycle_status', '=', 'issued')
			.execute();
		const totals: string[] = [];
		for (const credit of credits) {
			const issuedAt = await this.firstIssueAt(db, organisationId, credit.id);
			if (!issuedAt || issuedAt >= cutoff) continue;
			totals.push(await this.documentGross(db, organisationId, credit.id));
		}
		return sumMoney(totals);
	}

	private async allocatedAmountAsOf(
		db: DatabaseExecutor,
		organisationId: string,
		invoiceDocumentId: string,
		cutoff: Date
	): Promise<string> {
		const rows = await db
			.selectFrom('payment_allocations as allocation')
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join.onRef('reversal.payment_allocation_id', '=', 'allocation.id').onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
			)
			.select(['allocation.allocated_amount as amount', 'reversal.reversed_at as reversedAt'])
			.where('allocation.organisation_id', '=', organisationId)
			.where('allocation.invoice_document_id', '=', invoiceDocumentId)
			.where('allocation.allocated_at', '<', cutoff)
			.execute();
		return sumMoney(
			rows.filter((row) => row.reversedAt === null || row.reversedAt >= cutoff).map((row) => row.amount)
		);
	}

	private async customerAging(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		asOf: string,
		cutoff: Date
	): Promise<CustomerCurrencyReceivable[]> {
		const invoices = await db
			.selectFrom('financial_documents as document')
			.innerJoin('invoices as invoice', (join) =>
				join.onRef('invoice.financial_document_id', '=', 'document.id').onRef('invoice.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id',
				'document.public_id as publicId',
				'document.document_number as documentNumber',
				'document.currency_code as currencyCode',
				'document.voided_at as voidedAt',
				'invoice.due_date as dueDate'
			])
			.where('document.organisation_id', '=', organisationId)
			.where('document.customer_party_id', '=', customerPartyId)
			.where('document.document_kind', '=', 'invoice')
			.orderBy('document.id', 'asc')
			.execute();

		type PositionAccumulator = {
			issuedInvoiceCount: number;
			openInvoiceCount: number;
			totalOutstanding: bigint;
			buckets: ReturnType<typeof emptyBuckets>;
			invoices: ReceivableInvoiceAging[];
		};
		const positions = new Map<string, PositionAccumulator>();
		const asOfDay = dateOnlyDayNumber(asOf);

		for (const invoice of invoices) {
			const issuedAt = await this.firstIssueAt(db, organisationId, invoice.id);
			if (!issuedAt || issuedAt >= cutoff || !invoice.documentNumber) continue;
			let position = positions.get(invoice.currencyCode);
			if (!position) {
				position = {
					issuedInvoiceCount: 0,
					openInvoiceCount: 0,
					totalOutstanding: 0n,
					buckets: emptyBuckets(),
					invoices: []
				};
				positions.set(invoice.currencyCode, position);
			}
			position.issuedInvoiceCount += 1;

			if (invoice.voidedAt && invoice.voidedAt < cutoff) continue;
			const [invoiceGross, issuedCreditGross, activeAllocatedAmount] = await Promise.all([
				this.documentGross(db, organisationId, invoice.id),
				this.issuedCreditGrossAsOf(db, organisationId, invoice.id, cutoff),
				this.allocatedAmountAsOf(db, organisationId, invoice.id, cutoff)
			]);
			const outstandingAmount = subtractMoney(subtractMoney(invoiceGross, issuedCreditGross), activeAllocatedAmount);
			const outstanding = parseScaledDecimal(outstandingAmount, 4, 'Outstanding amount', true);
			if (outstanding <= 0n) continue;
			const dueText = invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null;
			const daysOverdue = dueText ? Math.max(0, asOfDay - dateOnlyDayNumber(dueText)) : 0;
			const bucket = agingBucket(daysOverdue);
			position.openInvoiceCount += 1;
			position.totalOutstanding += outstanding;
			position.buckets[bucket].amount += outstanding;
			position.buckets[bucket].invoiceCount += 1;
			position.invoices.push({
				invoicePublicId: invoice.publicId,
				invoiceNumber: invoice.documentNumber,
				currencyCode: invoice.currencyCode,
				issuedAt,
				dueDate: invoice.dueDate,
				invoiceGross,
				issuedCreditGross,
				activeAllocatedAmount,
				outstandingAmount,
				daysOverdue,
				bucket
			});
		}

		return [...positions.entries()]
			.map(([currencyCode, position]) => ({
				currencyCode,
				issuedInvoiceCount: position.issuedInvoiceCount,
				openInvoiceCount: position.openInvoiceCount,
				totalOutstanding: moneyFromScaled(position.totalOutstanding),
				buckets: publicBuckets(position.buckets),
				invoices: position.invoices.sort((a, b) => {
					const dueA = a.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
					const dueB = b.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
					return dueA - dueB || a.invoiceNumber.localeCompare(b.invoiceNumber);
				})
			}))
			.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode));
	}

	private async rawStatementMovements(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string,
		cutoff: Date
	): Promise<RawStatementMovement[]> {
		const movements: RawStatementMovement[] = [];
		const documents = await db
			.selectFrom('financial_documents')
			.select([
				'id',
				'public_id as publicId',
				'document_kind as documentKind',
				'document_number as documentNumber',
				'currency_code as currencyCode',
				'lifecycle_status as lifecycleStatus',
				'voided_at as voidedAt',
				'void_reason as voidReason'
			])
			.where('organisation_id', '=', organisationId)
			.where('customer_party_id', '=', customerPartyId)
			.where('document_kind', 'in', ['invoice', 'credit_note'])
			.orderBy('id', 'asc')
			.execute();

		for (const document of documents) {
			if (!document.documentNumber) continue;
			const issuedAt = await this.firstIssueAt(db, organisationId, document.id);
			if (!issuedAt || issuedAt >= cutoff) continue;
			const gross = await this.documentGross(db, organisationId, document.id);
			if (document.documentKind === 'invoice') {
				movements.push({
					id: `invoice:${document.id}`,
					sortKey: `1:${document.id}`,
					currencyCode: document.currencyCode,
					occurredAt: issuedAt,
					kind: 'invoice',
					reference: document.documentNumber,
					description: 'Issued invoice',
					invoicePublicId: document.publicId,
					debitAmount: gross,
					creditAmount: ZERO
				});
				if (document.voidedAt && document.voidedAt < cutoff) {
					movements.push({
						id: `invoice-void:${document.id}`,
						sortKey: `5:${document.id}`,
						currencyCode: document.currencyCode,
						occurredAt: document.voidedAt,
						kind: 'invoice_void',
						reference: document.documentNumber,
						description: document.voidReason ? `Invoice void — ${document.voidReason}` : 'Invoice void',
						invoicePublicId: document.publicId,
						debitAmount: ZERO,
						creditAmount: gross
					});
				}
			} else if (document.lifecycleStatus === 'issued') {
				movements.push({
					id: `credit-note:${document.id}`,
					sortKey: `2:${document.id}`,
					currencyCode: document.currencyCode,
					occurredAt: issuedAt,
					kind: 'credit_note',
					reference: document.documentNumber,
					description: 'Issued credit note',
					invoicePublicId: null,
					debitAmount: ZERO,
					creditAmount: gross
				});
			}
		}

		const allocations = await db
			.selectFrom('payment_allocations as allocation')
			.innerJoin('financial_documents as invoice', (join) =>
				join.onRef('invoice.id', '=', 'allocation.invoice_document_id').onRef('invoice.organisation_id', '=', 'allocation.organisation_id')
			)
			.innerJoin('payments as payment', (join) =>
				join.onRef('payment.id', '=', 'allocation.payment_id').onRef('payment.organisation_id', '=', 'allocation.organisation_id')
			)
			.leftJoin('payment_allocation_reversals as reversal', (join) =>
				join.onRef('reversal.payment_allocation_id', '=', 'allocation.id').onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
			)
			.select([
				'allocation.id as id',
				'allocation.allocated_amount as amount',
				'allocation.allocated_at as allocatedAt',
				'invoice.public_id as invoicePublicId',
				'invoice.document_number as invoiceNumber',
				'invoice.currency_code as currencyCode',
				'payment.public_id as paymentPublicId',
				'payment.payment_reference as paymentReference',
				'reversal.reversed_at as reversedAt',
				'reversal.reason as reversalReason'
			])
			.where('allocation.organisation_id', '=', organisationId)
			.where('invoice.customer_party_id', '=', customerPartyId)
			.where('allocation.allocated_at', '<', cutoff)
			.orderBy('allocation.id', 'asc')
			.execute();

		for (const allocation of allocations) {
			const invoiceNumber = allocation.invoiceNumber ?? 'invoice';
			const paymentReference = allocation.paymentReference ?? allocation.paymentPublicId;
			movements.push({
				id: `allocation:${allocation.id}`,
				sortKey: `3:${allocation.id}`,
				currencyCode: allocation.currencyCode,
				occurredAt: allocation.allocatedAt,
				kind: 'payment_allocation',
				reference: paymentReference,
				description: `Payment allocated to ${invoiceNumber}`,
				invoicePublicId: allocation.invoicePublicId,
				debitAmount: ZERO,
				creditAmount: allocation.amount
			});
			if (allocation.reversedAt && allocation.reversedAt < cutoff) {
				movements.push({
					id: `allocation-reversal:${allocation.id}`,
					sortKey: `4:${allocation.id}`,
					currencyCode: allocation.currencyCode,
					occurredAt: allocation.reversedAt,
					kind: 'allocation_reversal',
					reference: paymentReference,
					description: allocation.reversalReason
						? `Allocation reversal — ${allocation.reversalReason}`
						: `Allocation reversal for ${invoiceNumber}`,
					invoicePublicId: allocation.invoicePublicId,
					debitAmount: allocation.amount,
					creditAmount: ZERO
				});
			}
		}

		return movements.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.sortKey.localeCompare(b.sortKey));
	}

	private publicAccount(customer: CustomerRecord, positions: CustomerCurrencyReceivable[]): CustomerReceivableAccount {
		return {
			customerPartyPublicId: customer.publicId,
			customerDisplayName: customer.displayName,
			customerAccountReference: customer.customerAccountReference,
			positions
		};
	}

	async getPortfolio(actor: TenantActorContext): Promise<ReceivablesPortfolio> {
		await this.assertReporting(actor);
		const timezone = await this.tenantTimezone(actor);
		const asOf = dateTextInZone(this.now(), timezone);
		const cutoff = zonedStartOfDay(addDateOnlyDays(asOf, 1), timezone);
		const customers = await this.db
			.selectFrom('financial_documents as document')
			.innerJoin('parties as party', (join) =>
				join.onRef('party.id', '=', 'document.customer_party_id').onRef('party.organisation_id', '=', 'document.organisation_id')
			)
			.select('party.public_id as publicId')
			.distinct()
			.where('document.organisation_id', '=', actor.organisationId)
			.where('document.document_kind', '=', 'invoice')
			.orderBy('party.public_id', 'asc')
			.execute();

		const accounts: CustomerReceivableAccount[] = [];
		for (const row of customers) {
			const customer = await this.customerByPublicId(this.db, actor.organisationId, row.publicId);
			if (!customer) continue;
			const positions = await this.customerAging(this.db, actor.organisationId, customer.id, asOf, cutoff);
			if (positions.length === 0) continue;
			accounts.push(this.publicAccount(customer, positions));
		}
		accounts.sort((a, b) => a.customerDisplayName.localeCompare(b.customerDisplayName));

		const totals = new Map<string, { issuedInvoiceCount: number; openInvoiceCount: number; total: bigint; buckets: ReturnType<typeof emptyBuckets> }>();
		for (const account of accounts) {
			for (const position of account.positions) {
				let total = totals.get(position.currencyCode);
				if (!total) {
					total = { issuedInvoiceCount: 0, openInvoiceCount: 0, total: 0n, buckets: emptyBuckets() };
					totals.set(position.currencyCode, total);
				}
				total.issuedInvoiceCount += position.issuedInvoiceCount;
				total.openInvoiceCount += position.openInvoiceCount;
				total.total += parseScaledDecimal(position.totalOutstanding, 4, 'Outstanding amount', true);
				for (const bucket of position.buckets) {
					total.buckets[bucket.code].amount += parseScaledDecimal(bucket.amount, 4, 'Aging amount', true);
					total.buckets[bucket.code].invoiceCount += bucket.invoiceCount;
				}
			}
		}

		return {
			asOf,
			accounts,
			totals: [...totals.entries()]
				.map(([currencyCode, total]) => ({
					currencyCode,
					issuedInvoiceCount: total.issuedInvoiceCount,
					openInvoiceCount: total.openInvoiceCount,
					totalOutstanding: moneyFromScaled(total.total),
					buckets: publicBuckets(total.buckets),
					invoices: []
				}))
				.sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
		};
	}

	async getCustomerStatement(
		actor: TenantActorContext,
		customerPartyPublicIdInput: string,
		input: { from?: string | null; to?: string | null } = {}
	): Promise<CustomerStatementWorkspace> {
		await this.assertReporting(actor);
		const customerPartyPublicId = customerPartyPublicIdInput.trim();
		if (!customerPartyPublicId || customerPartyPublicId.length > 64) throw new RecordNotFoundError('Customer not found.');
		const customer = await this.customerByPublicId(this.db, actor.organisationId, customerPartyPublicId);
		if (!customer) throw new RecordNotFoundError('Customer not found.');
		const hasInvoice = await this.db
			.selectFrom('financial_documents')
			.select('id')
			.where('organisation_id', '=', actor.organisationId)
			.where('customer_party_id', '=', customer.id)
			.where('document_kind', '=', 'invoice')
			.executeTakeFirst();
		if (!hasInvoice) throw new RecordNotFoundError('Customer receivable account not found.');

		const timezone = await this.tenantTimezone(actor);
		const today = dateTextInZone(this.now(), timezone);
		const defaultFrom = `${today.slice(0, 8)}01`;
		const from = validateDateText(input.from?.trim() || defaultFrom, 'Statement start date');
		const to = validateDateText(input.to?.trim() || today, 'Statement end date');
		if (from > to) throw new FinanceValidationError('Statement start date must not be after the end date.');
		if (to > today) throw new FinanceValidationError('Statement end date cannot be in the future.');
		if (dateOnlyDayNumber(to) - dateOnlyDayNumber(from) > 366) {
			throw new FinanceValidationError('A statement period must not exceed 367 calendar days.');
		}
		const fromInstant = zonedStartOfDay(from, timezone);
		const cutoff = zonedStartOfDay(addDateOnlyDays(to, 1), timezone);
		const allMovements = await this.rawStatementMovements(this.db, actor.organisationId, customer.id, cutoff);
		const aging = await this.customerAging(this.db, actor.organisationId, customer.id, to, cutoff);
		const currencies = new Set<string>([
			...allMovements.map((movement) => movement.currencyCode),
			...aging.map((position) => position.currencyCode)
		]);
		const statements: CurrencyStatement[] = [];

		for (const currencyCode of [...currencies].sort()) {
			const currencyMovements = allMovements.filter((movement) => movement.currencyCode === currencyCode);
			let opening = 0n;
			for (const movement of currencyMovements) {
				if (movement.occurredAt >= fromInstant) break;
				opening += signedMoney(movement.debitAmount, movement.creditAmount);
			}
			let running = opening;
			const periodMovements: StatementMovement[] = [];
			for (const movement of currencyMovements) {
				if (movement.occurredAt < fromInstant) continue;
				running += signedMoney(movement.debitAmount, movement.creditAmount);
				periodMovements.push({
					id: movement.id,
					occurredAt: movement.occurredAt,
					kind: movement.kind,
					reference: movement.reference,
					description: movement.description,
					invoicePublicId: movement.invoicePublicId,
					debitAmount: movement.debitAmount,
					creditAmount: movement.creditAmount,
					runningBalance: moneyFromScaled(running)
				});
			}
			statements.push({
				currencyCode,
				openingBalance: moneyFromScaled(opening),
				movements: periodMovements,
				closingBalance: moneyFromScaled(running)
			});
		}

		return {
			customer: {
				publicId: customer.publicId,
				displayName: customer.displayName,
				customerAccountReference: customer.customerAccountReference
			},
			period: { from, to, timezone },
			statements,
			aging
		};
	}
}
