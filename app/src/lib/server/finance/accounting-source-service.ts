import { createHash } from 'node:crypto';

import {
	formatScaledDecimal,
	lineAmount,
	parseScaledDecimal
} from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { FinanceValidationError } from './finance-common';

export const ACCOUNTING_SOURCE_TYPES = [
	'invoice_issue',
	'invoice_void',
	'credit_note_issue',
	'accounts_payable_invoice_approval',
	'accounts_payable_credit_note_approval',
	'payment_receipt',
	'payment_allocation',
	'payment_allocation_reversal',
	'payment_reversal',
	'bad_debt_write_off',
	'bad_debt_write_off_reversal',
	'bad_debt_recovery',
	'bad_debt_recovery_reversal',
	'vat_relief_posting',
	'vat_relief_posting_reversal'
] as const;

export type AccountingSourceType = (typeof ACCOUNTING_SOURCE_TYPES)[number];
export type AccountingMappingKey =
	| 'accounts_receivable'
	| 'sales_revenue'
	| 'vat_control'
	| 'cash_receipts'
	| 'customer_unapplied_cash'
	| 'bad_debt_expense'
	| 'bad_debt_recovery_income'
	| 'accounts_payable'
	| 'purchase_expense'
	| 'retained_earnings';

export type AccountingCandidateLine = {
	mappingKey: AccountingMappingKey;
	description: string;
	debitAmount: string;
	creditAmount: string;
};

export type AccountingSourceCandidate = {
	sourceType: AccountingSourceType;
	sourcePublicId: string;
	sourceLabel: string;
	sourceEventAt: Date;
	currencyCode: string;
	sourceAmount: string;
	memo: string;
	lines: AccountingCandidateLine[];
	fingerprint: string;
};

const ZERO = '0.0000';

function money(value: string): bigint {
	return parseScaledDecimal(value, 4, 'Accounting amount', true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, 4);
}

function line(
	mappingKey: AccountingMappingKey,
	description: string,
	side: 'debit' | 'credit',
	amount: string
): AccountingCandidateLine {
	if (money(amount) <= 0n)
		throw new FinanceValidationError('Accounting source line amount must be positive.');
	return {
		mappingKey,
		description,
		debitAmount: side === 'debit' ? amount : ZERO,
		creditAmount: side === 'credit' ? amount : ZERO
	};
}

function fingerprint(candidate: Omit<AccountingSourceCandidate, 'fingerprint'>): string {
	return createHash('sha256')
		.update(
			JSON.stringify({
				sourceType: candidate.sourceType,
				sourcePublicId: candidate.sourcePublicId,
				sourceEventAt: candidate.sourceEventAt.toISOString(),
				currencyCode: candidate.currencyCode,
				sourceAmount: candidate.sourceAmount,
				lines: candidate.lines
			})
		)
		.digest('hex');
}

function finish(
	candidate: Omit<AccountingSourceCandidate, 'fingerprint'>
): AccountingSourceCandidate {
	let debit = 0n;
	let credit = 0n;
	for (const candidateLine of candidate.lines) {
		debit += money(candidateLine.debitAmount);
		credit += money(candidateLine.creditAmount);
	}
	if (debit <= 0n || debit !== credit)
		throw new FinanceValidationError('Derived accounting candidate is not balanced.');
	if (debit !== money(candidate.sourceAmount)) {
		throw new FinanceValidationError(
			'Derived accounting candidate total does not match the source amount.'
		);
	}
	return { ...candidate, fingerprint: fingerprint(candidate) };
}

async function documentAmounts(db: DatabaseExecutor, organisationId: string, documentId: string) {
	const itemRows = await db
		.selectFrom('financial_document_items')
		.select(['id', 'quantity', 'unit_rate as unitRate'])
		.where('organisation_id', '=', organisationId)
		.where('financial_document_id', '=', documentId)
		.orderBy('line_number')
		.execute();
	if (itemRows.length === 0)
		throw new FinanceValidationError('The source financial document has no posting lines.');
	let net = 0n;
	for (const item of itemRows) net += money(lineAmount(item.quantity, item.unitRate));
	const taxRows = await db
		.selectFrom('financial_document_item_taxes as tax')
		.innerJoin('financial_document_items as item', (join) =>
			join
				.onRef('item.id', '=', 'tax.financial_document_item_id')
				.onRef('item.organisation_id', '=', 'tax.organisation_id')
		)
		.select('tax.tax_amount as taxAmount')
		.where('tax.organisation_id', '=', organisationId)
		.where('item.financial_document_id', '=', documentId)
		.execute();
	let tax = 0n;
	for (const row of taxRows) tax += money(row.taxAmount);
	return { net: moneyText(net), tax: moneyText(tax), gross: moneyText(net + tax) };
}

function parseAllocationSourceId(sourcePublicId: string): string {
	const match = /^allocation:(\d+)$/.exec(sourcePublicId);
	if (!match) throw new RecordNotFoundError('Payment allocation source not found.');
	return match[1]!;
}

async function documentCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'invoice_issue' | 'invoice_void' | 'credit_note_issue',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('financial_documents')
		.select([
			'id',
			'public_id as publicId',
			'document_kind as documentKind',
			'document_number as documentNumber',
			'currency_code as currencyCode',
			'lifecycle_status as lifecycleStatus',
			'voided_at as voidedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const document = await query.executeTakeFirst();
	if (!document) throw new RecordNotFoundError('Financial document source not found.');
	if (sourceType === 'invoice_issue' && document.documentKind !== 'invoice')
		throw new RecordNotFoundError('Invoice source not found.');
	if (
		sourceType === 'invoice_void' &&
		(document.documentKind !== 'invoice' ||
			document.lifecycleStatus !== 'void' ||
			!document.voidedAt)
	) {
		throw new RecordNotFoundError('Invoice void source not found.');
	}
	if (sourceType === 'credit_note_issue' && document.documentKind !== 'credit_note')
		throw new RecordNotFoundError('Credit-note source not found.');

	const issue =
		sourceType === 'invoice_void'
			? null
			: await db
					.selectFrom('financial_document_issue_events')
					.select('issued_at as issuedAt')
					.where('organisation_id', '=', organisationId)
					.where('financial_document_id', '=', document.id)
					.orderBy('issue_sequence', 'desc')
					.executeTakeFirst();
	if (sourceType !== 'invoice_void' && !issue)
		throw new FinanceValidationError('The financial document has no issue event to post.');

	const amounts = await documentAmounts(db, organisationId, document.id);
	const number = document.documentNumber ?? document.publicId;
	const reverseSales = sourceType !== 'invoice_issue';
	const lines: AccountingCandidateLine[] = [];
	if (reverseSales) {
		lines.push(line('sales_revenue', `${number} sales reversal`, 'debit', amounts.net));
		if (money(amounts.tax) > 0n)
			lines.push(line('vat_control', `${number} VAT reversal`, 'debit', amounts.tax));
		lines.push(
			line('accounts_receivable', `${number} receivable reversal`, 'credit', amounts.gross)
		);
	} else {
		lines.push(line('accounts_receivable', `${number} trade receivable`, 'debit', amounts.gross));
		lines.push(line('sales_revenue', `${number} sales revenue`, 'credit', amounts.net));
		if (money(amounts.tax) > 0n)
			lines.push(line('vat_control', `${number} output VAT`, 'credit', amounts.tax));
	}

	return finish({
		sourceType,
		sourcePublicId: document.publicId,
		sourceLabel: `${sourceType === 'credit_note_issue' ? 'Credit note' : sourceType === 'invoice_void' ? 'Invoice void' : 'Invoice'} ${number}`,
		sourceEventAt: sourceType === 'invoice_void' ? document.voidedAt! : issue!.issuedAt,
		currencyCode: document.currencyCode,
		sourceAmount: amounts.gross,
		memo:
			sourceType === 'invoice_issue'
				? `Post issued invoice ${number}`
				: sourceType === 'credit_note_issue'
					? `Post issued credit note ${number}`
					: `Reverse voided invoice ${number}`,
		lines
	});
}

async function accountsPayableDocumentCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'accounts_payable_invoice_approval' | 'accounts_payable_credit_note_approval',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('accounts_payable_documents')
		.select([
			'public_id as publicId',
			'document_type as documentType',
			'supplier_document_number as supplierDocumentNumber',
			'currency_code as currencyCode',
			'lifecycle_status as lifecycleStatus',
			'net_amount as netAmount',
			'tax_amount as taxAmount',
			'gross_amount as grossAmount',
			'approved_at as approvedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const document = await query.executeTakeFirst();
	if (!document || document.lifecycleStatus !== 'approved' || !document.approvedAt) {
		throw new RecordNotFoundError('Approved supplier document source not found.');
	}
	if (
		(sourceType === 'accounts_payable_invoice_approval' && document.documentType !== 'invoice') ||
		(sourceType === 'accounts_payable_credit_note_approval' &&
			document.documentType !== 'credit_note')
	) {
		throw new RecordNotFoundError('Approved supplier document source not found.');
	}
	if (money(document.grossAmount) <= 0n) {
		throw new FinanceValidationError('Approved supplier document total must be positive to post.');
	}

	const number = document.supplierDocumentNumber || document.publicId;
	const reversePurchase = document.documentType === 'credit_note';
	const lines: AccountingCandidateLine[] = [];
	if (reversePurchase) {
		lines.push(
			line('accounts_payable', `${number} payable reduction`, 'debit', document.grossAmount)
		);
		if (money(document.netAmount) > 0n) {
			lines.push(
				line('purchase_expense', `${number} purchase cost reversal`, 'credit', document.netAmount)
			);
		}
		if (money(document.taxAmount) > 0n) {
			lines.push(line('vat_control', `${number} input VAT reversal`, 'credit', document.taxAmount));
		}
	} else {
		if (money(document.netAmount) > 0n) {
			lines.push(line('purchase_expense', `${number} purchase cost`, 'debit', document.netAmount));
		}
		if (money(document.taxAmount) > 0n) {
			lines.push(line('vat_control', `${number} input VAT`, 'debit', document.taxAmount));
		}
		lines.push(line('accounts_payable', `${number} trade payable`, 'credit', document.grossAmount));
	}

	return finish({
		sourceType,
		sourcePublicId: document.publicId,
		sourceLabel: `${reversePurchase ? 'Supplier credit note' : 'Supplier invoice'} ${number}`,
		sourceEventAt: document.approvedAt,
		currencyCode: document.currencyCode,
		sourceAmount: document.grossAmount,
		memo: `${reversePurchase ? 'Post approved supplier credit note' : 'Post approved supplier invoice'} ${number}`,
		lines
	});
}

async function paymentCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'payment_receipt' | 'payment_reversal',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('payments')
		.select([
			'id',
			'public_id as publicId',
			'received_at as receivedAt',
			'amount',
			'currency_code as currencyCode',
			'payment_reference as paymentReference'
		])
		.where('organisation_id', '=', organisationId)
		.where('public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const payment = await query.executeTakeFirst();
	if (!payment) throw new RecordNotFoundError('Payment source not found.');
	const reversal = await db
		.selectFrom('payment_reversals')
		.select(['reversed_at as reversedAt'])
		.where('organisation_id', '=', organisationId)
		.where('payment_id', '=', payment.id)
		.executeTakeFirst();
	if (sourceType === 'payment_reversal' && !reversal)
		throw new RecordNotFoundError('Payment reversal source not found.');
	const reference = payment.paymentReference || payment.publicId;
	const lines =
		sourceType === 'payment_receipt'
			? [
					line('cash_receipts', `Payment ${reference} cash received`, 'debit', payment.amount),
					line(
						'customer_unapplied_cash',
						`Payment ${reference} unapplied customer cash`,
						'credit',
						payment.amount
					)
				]
			: [
					line('customer_unapplied_cash', `Payment ${reference} reversal`, 'debit', payment.amount),
					line('cash_receipts', `Payment ${reference} cash reversal`, 'credit', payment.amount)
				];
	return finish({
		sourceType,
		sourcePublicId: payment.publicId,
		sourceLabel: `${sourceType === 'payment_receipt' ? 'Payment' : 'Payment reversal'} ${reference}`,
		sourceEventAt: sourceType === 'payment_receipt' ? payment.receivedAt : reversal!.reversedAt,
		currencyCode: payment.currencyCode,
		sourceAmount: payment.amount,
		memo: `${sourceType === 'payment_receipt' ? 'Post payment receipt' : 'Post payment reversal'} ${reference}`,
		lines
	});
}

async function allocationCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'payment_allocation' | 'payment_allocation_reversal',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	const allocationId = parseAllocationSourceId(sourcePublicId);
	let query = db
		.selectFrom('payment_allocations as allocation')
		.innerJoin('payments as payment', (join) =>
			join
				.onRef('payment.id', '=', 'allocation.payment_id')
				.onRef('payment.organisation_id', '=', 'allocation.organisation_id')
		)
		.innerJoin('financial_documents as invoice', (join) =>
			join
				.onRef('invoice.id', '=', 'allocation.invoice_document_id')
				.onRef('invoice.organisation_id', '=', 'allocation.organisation_id')
		)
		.select([
			'allocation.id',
			'allocation.allocated_amount as amount',
			'allocation.allocated_at as allocatedAt',
			'payment.public_id as paymentPublicId',
			'payment.currency_code as currencyCode',
			'invoice.document_number as invoiceNumber'
		]);
	query = query
		.where('allocation.organisation_id', '=', organisationId)
		.where('allocation.id', '=', allocationId);
	if (forUpdate) query = query.forUpdate();
	const allocation = await query.executeTakeFirst();
	if (!allocation) throw new RecordNotFoundError('Payment allocation source not found.');
	const reversal = await db
		.selectFrom('payment_allocation_reversals')
		.select('reversed_at as reversedAt')
		.where('organisation_id', '=', organisationId)
		.where('payment_allocation_id', '=', allocation.id)
		.executeTakeFirst();
	if (sourceType === 'payment_allocation_reversal' && !reversal)
		throw new RecordNotFoundError('Payment allocation reversal source not found.');
	const invoice = allocation.invoiceNumber ?? 'invoice';
	const lines =
		sourceType === 'payment_allocation'
			? [
					line(
						'customer_unapplied_cash',
						`Allocate customer cash to ${invoice}`,
						'debit',
						allocation.amount
					),
					line('accounts_receivable', `Settle receivable ${invoice}`, 'credit', allocation.amount)
				]
			: [
					line('accounts_receivable', `Restore receivable ${invoice}`, 'debit', allocation.amount),
					line(
						'customer_unapplied_cash',
						`Restore unapplied cash for ${invoice}`,
						'credit',
						allocation.amount
					)
				];
	return finish({
		sourceType,
		sourcePublicId: `allocation:${allocation.id}`,
		sourceLabel: `${sourceType === 'payment_allocation' ? 'Allocation' : 'Allocation reversal'} ${allocation.id} · ${invoice}`,
		sourceEventAt:
			sourceType === 'payment_allocation' ? allocation.allocatedAt : reversal!.reversedAt,
		currencyCode: allocation.currencyCode,
		sourceAmount: allocation.amount,
		memo: `${sourceType === 'payment_allocation' ? 'Post payment allocation' : 'Post payment allocation reversal'} ${allocation.id}`,
		lines
	});
}

async function writeOffCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'bad_debt_write_off' | 'bad_debt_write_off_reversal',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('receivable_write_offs as writeOff')
		.innerJoin('financial_documents as invoice', (join) =>
			join
				.onRef('invoice.id', '=', 'writeOff.invoice_document_id')
				.onRef('invoice.organisation_id', '=', 'writeOff.organisation_id')
		)
		.select([
			'writeOff.id',
			'writeOff.public_id as publicId',
			'writeOff.write_off_amount as amount',
			'writeOff.authorised_at as authorisedAt',
			'invoice.currency_code as currencyCode',
			'invoice.document_number as invoiceNumber'
		])
		.where('writeOff.organisation_id', '=', organisationId)
		.where('writeOff.public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const writeOff = await query.executeTakeFirst();
	if (!writeOff) throw new RecordNotFoundError('Bad-debt write-off source not found.');
	const reversal = await db
		.selectFrom('receivable_write_off_reversals')
		.select('reversed_at as reversedAt')
		.where('organisation_id', '=', organisationId)
		.where('write_off_id', '=', writeOff.id)
		.executeTakeFirst();
	if (sourceType === 'bad_debt_write_off_reversal' && !reversal)
		throw new RecordNotFoundError('Bad-debt write-off reversal source not found.');
	const invoice = writeOff.invoiceNumber ?? 'invoice';
	const lines =
		sourceType === 'bad_debt_write_off'
			? [
					line('bad_debt_expense', `Bad-debt expense ${invoice}`, 'debit', writeOff.amount),
					line('accounts_receivable', `Write off receivable ${invoice}`, 'credit', writeOff.amount)
				]
			: [
					line('accounts_receivable', `Restore receivable ${invoice}`, 'debit', writeOff.amount),
					line('bad_debt_expense', `Reverse bad-debt expense ${invoice}`, 'credit', writeOff.amount)
				];
	return finish({
		sourceType,
		sourcePublicId: writeOff.publicId,
		sourceLabel: `${sourceType === 'bad_debt_write_off' ? 'Write-off' : 'Write-off reversal'} ${invoice}`,
		sourceEventAt:
			sourceType === 'bad_debt_write_off' ? writeOff.authorisedAt : reversal!.reversedAt,
		currencyCode: writeOff.currencyCode,
		sourceAmount: writeOff.amount,
		memo: `${sourceType === 'bad_debt_write_off' ? 'Post bad-debt write-off' : 'Post bad-debt write-off reversal'} ${invoice}`,
		lines
	});
}

async function recoveryCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'bad_debt_recovery' | 'bad_debt_recovery_reversal',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('receivable_write_off_recoveries as recovery')
		.innerJoin('receivable_write_offs as writeOff', (join) =>
			join
				.onRef('writeOff.id', '=', 'recovery.write_off_id')
				.onRef('writeOff.organisation_id', '=', 'recovery.organisation_id')
		)
		.innerJoin('financial_documents as invoice', (join) =>
			join
				.onRef('invoice.id', '=', 'writeOff.invoice_document_id')
				.onRef('invoice.organisation_id', '=', 'writeOff.organisation_id')
		)
		.select([
			'recovery.id',
			'recovery.public_id as publicId',
			'recovery.recovered_amount as amount',
			'recovery.recovered_at as recoveredAt',
			'invoice.currency_code as currencyCode',
			'invoice.document_number as invoiceNumber'
		])
		.where('recovery.organisation_id', '=', organisationId)
		.where('recovery.public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const recovery = await query.executeTakeFirst();
	if (!recovery) throw new RecordNotFoundError('Bad-debt recovery source not found.');
	const reversal = await db
		.selectFrom('receivable_write_off_recovery_reversals')
		.select('reversed_at as reversedAt')
		.where('organisation_id', '=', organisationId)
		.where('recovery_id', '=', recovery.id)
		.executeTakeFirst();
	if (sourceType === 'bad_debt_recovery_reversal' && !reversal)
		throw new RecordNotFoundError('Bad-debt recovery reversal source not found.');
	const invoice = recovery.invoiceNumber ?? 'invoice';
	const lines =
		sourceType === 'bad_debt_recovery'
			? [
					line(
						'customer_unapplied_cash',
						`Apply recovered customer cash ${invoice}`,
						'debit',
						recovery.amount
					),
					line(
						'bad_debt_recovery_income',
						`Bad-debt recovery income ${invoice}`,
						'credit',
						recovery.amount
					)
				]
			: [
					line(
						'bad_debt_recovery_income',
						`Reverse bad-debt recovery income ${invoice}`,
						'debit',
						recovery.amount
					),
					line(
						'customer_unapplied_cash',
						`Restore unapplied recovery cash ${invoice}`,
						'credit',
						recovery.amount
					)
				];
	return finish({
		sourceType,
		sourcePublicId: recovery.publicId,
		sourceLabel: `${sourceType === 'bad_debt_recovery' ? 'Bad-debt recovery' : 'Bad-debt recovery reversal'} ${invoice}`,
		sourceEventAt: sourceType === 'bad_debt_recovery' ? recovery.recoveredAt : reversal!.reversedAt,
		currencyCode: recovery.currencyCode,
		sourceAmount: recovery.amount,
		memo: `${sourceType === 'bad_debt_recovery' ? 'Post bad-debt recovery' : 'Post bad-debt recovery reversal'} ${invoice}`,
		lines
	});
}

async function vatPostingCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: 'vat_relief_posting' | 'vat_relief_posting_reversal',
	sourcePublicId: string,
	forUpdate: boolean
): Promise<AccountingSourceCandidate> {
	let query = db
		.selectFrom('receivable_vat_return_postings as posting')
		.select([
			'id',
			'public_id as publicId',
			'posting_kind as postingKind',
			'amount',
			'vat_return_box as vatReturnBox',
			'vat_return_period_reference as periodReference',
			'posted_at as postedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const posting = await query.executeTakeFirst();
	if (!posting) throw new RecordNotFoundError('VAT relief posting source not found.');
	const reversal = await db
		.selectFrom('receivable_vat_return_posting_reversals')
		.select('reversed_at as reversedAt')
		.where('organisation_id', '=', organisationId)
		.where('posting_id', '=', posting.id)
		.executeTakeFirst();
	if (sourceType === 'vat_relief_posting_reversal' && !reversal)
		throw new RecordNotFoundError('VAT relief posting reversal source not found.');
	const isClaim = posting.postingKind === 'relief_claim';
	const baseLines = isClaim
		? [
				line(
					'vat_control',
					`VAT bad-debt relief ${posting.periodReference}`,
					'debit',
					posting.amount
				),
				line('bad_debt_expense', `Reduce bad-debt expense for VAT relief`, 'credit', posting.amount)
			]
		: [
				line('bad_debt_expense', `VAT repayment after bad-debt recovery`, 'debit', posting.amount),
				line('vat_control', `VAT repayment ${posting.periodReference}`, 'credit', posting.amount)
			];
	const lines =
		sourceType === 'vat_relief_posting'
			? baseLines
			: baseLines.map((entry) => ({
					...entry,
					debitAmount: entry.creditAmount,
					creditAmount: entry.debitAmount,
					description: `Reverse: ${entry.description}`
				}));
	return finish({
		sourceType,
		sourcePublicId: posting.publicId,
		sourceLabel: `${sourceType === 'vat_relief_posting' ? 'VAT posting' : 'VAT posting reversal'} · Box ${posting.vatReturnBox} · ${posting.periodReference}`,
		sourceEventAt: sourceType === 'vat_relief_posting' ? posting.postedAt : reversal!.reversedAt,
		currencyCode: 'GBP',
		sourceAmount: posting.amount,
		memo: `${sourceType === 'vat_relief_posting' ? 'Post' : 'Reverse'} VAT bad-debt relief return evidence ${posting.periodReference}`,
		lines
	});
}

export async function resolveAccountingSourceCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: AccountingSourceType,
	sourcePublicId: string,
	forUpdate = false
): Promise<AccountingSourceCandidate> {
	switch (sourceType) {
		case 'invoice_issue':
		case 'invoice_void':
		case 'credit_note_issue':
			return documentCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
		case 'accounts_payable_invoice_approval':
		case 'accounts_payable_credit_note_approval':
			return accountsPayableDocumentCandidate(
				db,
				organisationId,
				sourceType,
				sourcePublicId,
				forUpdate
			);
		case 'payment_receipt':
		case 'payment_reversal':
			return paymentCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
		case 'payment_allocation':
		case 'payment_allocation_reversal':
			return allocationCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
		case 'bad_debt_write_off':
		case 'bad_debt_write_off_reversal':
			return writeOffCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
		case 'bad_debt_recovery':
		case 'bad_debt_recovery_reversal':
			return recoveryCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
		case 'vat_relief_posting':
		case 'vat_relief_posting_reversal':
			return vatPostingCandidate(db, organisationId, sourceType, sourcePublicId, forUpdate);
	}
}

export async function listAccountingSourceReferences(
	db: DatabaseExecutor,
	organisationId: string
): Promise<Array<{ sourceType: AccountingSourceType; sourcePublicId: string }>> {
	const refs: Array<{ sourceType: AccountingSourceType; sourcePublicId: string; at: Date }> = [];
	const documents = await db
		.selectFrom('financial_documents as document')
		.leftJoin('financial_document_issue_events as issue', (join) =>
			join
				.onRef('issue.financial_document_id', '=', 'document.id')
				.onRef('issue.organisation_id', '=', 'document.organisation_id')
		)
		.select([
			'document.public_id as publicId',
			'document.document_kind as documentKind',
			'document.lifecycle_status as lifecycleStatus',
			'document.voided_at as voidedAt',
			'issue.issued_at as issuedAt'
		])
		.where('document.organisation_id', '=', organisationId)
		.where('document.document_kind', 'in', ['invoice', 'credit_note'])
		.where('issue.issue_sequence', '=', 1)
		.orderBy('issue.issued_at', 'desc')
		.limit(100)
		.execute();
	for (const document of documents) {
		if (document.issuedAt)
			refs.push({
				sourceType: document.documentKind === 'invoice' ? 'invoice_issue' : 'credit_note_issue',
				sourcePublicId: document.publicId,
				at: document.issuedAt
			});
		if (
			document.documentKind === 'invoice' &&
			document.lifecycleStatus === 'void' &&
			document.voidedAt
		)
			refs.push({
				sourceType: 'invoice_void',
				sourcePublicId: document.publicId,
				at: document.voidedAt
			});
	}
	const supplierDocuments = await db
		.selectFrom('accounts_payable_documents')
		.select(['public_id as publicId', 'document_type as documentType', 'approved_at as approvedAt'])
		.where('organisation_id', '=', organisationId)
		.where('lifecycle_status', '=', 'approved')
		.where('approved_at', 'is not', null)
		.orderBy('approved_at', 'desc')
		.limit(100)
		.execute();
	for (const document of supplierDocuments) {
		references.push({
			sourceType:
				document.documentType === 'credit_note'
					? 'accounts_payable_credit_note_approval'
					: 'accounts_payable_invoice_approval',
			sourcePublicId: document.publicId
		});
	}

	const payments = await db
		.selectFrom('payments')
		.select(['id', 'public_id as publicId', 'received_at as receivedAt'])
		.where('organisation_id', '=', organisationId)
		.orderBy('received_at', 'desc')
		.limit(100)
		.execute();
	for (const payment of payments) {
		refs.push({
			sourceType: 'payment_receipt',
			sourcePublicId: payment.publicId,
			at: payment.receivedAt
		});
		const reversal = await db
			.selectFrom('payment_reversals')
			.select('reversed_at as reversedAt')
			.where('organisation_id', '=', organisationId)
			.where('payment_id', '=', payment.id)
			.executeTakeFirst();
		if (reversal)
			refs.push({
				sourceType: 'payment_reversal',
				sourcePublicId: payment.publicId,
				at: reversal.reversedAt
			});
	}
	const allocations = await db
		.selectFrom('payment_allocations')
		.select(['id', 'allocated_at as allocatedAt'])
		.where('organisation_id', '=', organisationId)
		.orderBy('allocated_at', 'desc')
		.limit(100)
		.execute();
	for (const allocation of allocations) {
		refs.push({
			sourceType: 'payment_allocation',
			sourcePublicId: `allocation:${allocation.id}`,
			at: allocation.allocatedAt
		});
		const reversal = await db
			.selectFrom('payment_allocation_reversals')
			.select('reversed_at as reversedAt')
			.where('organisation_id', '=', organisationId)
			.where('payment_allocation_id', '=', allocation.id)
			.executeTakeFirst();
		if (reversal)
			refs.push({
				sourceType: 'payment_allocation_reversal',
				sourcePublicId: `allocation:${allocation.id}`,
				at: reversal.reversedAt
			});
	}
	const writeOffs = await db
		.selectFrom('receivable_write_offs')
		.select(['id', 'public_id as publicId', 'authorised_at as authorisedAt'])
		.where('organisation_id', '=', organisationId)
		.orderBy('authorised_at', 'desc')
		.limit(100)
		.execute();
	for (const writeOff of writeOffs) {
		refs.push({
			sourceType: 'bad_debt_write_off',
			sourcePublicId: writeOff.publicId,
			at: writeOff.authorisedAt
		});
		const reversal = await db
			.selectFrom('receivable_write_off_reversals')
			.select('reversed_at as reversedAt')
			.where('organisation_id', '=', organisationId)
			.where('write_off_id', '=', writeOff.id)
			.executeTakeFirst();
		if (reversal)
			refs.push({
				sourceType: 'bad_debt_write_off_reversal',
				sourcePublicId: writeOff.publicId,
				at: reversal.reversedAt
			});
	}
	const recoveries = await db
		.selectFrom('receivable_write_off_recoveries')
		.select(['id', 'public_id as publicId', 'recovered_at as recoveredAt'])
		.where('organisation_id', '=', organisationId)
		.orderBy('recovered_at', 'desc')
		.limit(100)
		.execute();
	for (const recovery of recoveries) {
		refs.push({
			sourceType: 'bad_debt_recovery',
			sourcePublicId: recovery.publicId,
			at: recovery.recoveredAt
		});
		const reversal = await db
			.selectFrom('receivable_write_off_recovery_reversals')
			.select('reversed_at as reversedAt')
			.where('organisation_id', '=', organisationId)
			.where('recovery_id', '=', recovery.id)
			.executeTakeFirst();
		if (reversal)
			refs.push({
				sourceType: 'bad_debt_recovery_reversal',
				sourcePublicId: recovery.publicId,
				at: reversal.reversedAt
			});
	}
	const vatPostings = await db
		.selectFrom('receivable_vat_return_postings')
		.select(['id', 'public_id as publicId', 'posted_at as postedAt'])
		.where('organisation_id', '=', organisationId)
		.orderBy('posted_at', 'desc')
		.limit(100)
		.execute();
	for (const posting of vatPostings) {
		refs.push({
			sourceType: 'vat_relief_posting',
			sourcePublicId: posting.publicId,
			at: posting.postedAt
		});
		const reversal = await db
			.selectFrom('receivable_vat_return_posting_reversals')
			.select('reversed_at as reversedAt')
			.where('organisation_id', '=', organisationId)
			.where('posting_id', '=', posting.id)
			.executeTakeFirst();
		if (reversal)
			refs.push({
				sourceType: 'vat_relief_posting_reversal',
				sourcePublicId: posting.publicId,
				at: reversal.reversedAt
			});
	}
	refs.sort((left, right) => right.at.getTime() - left.at.getTime());
	return refs
		.slice(0, 200)
		.map(({ sourceType, sourcePublicId }) => ({ sourceType, sourcePublicId }));
}
