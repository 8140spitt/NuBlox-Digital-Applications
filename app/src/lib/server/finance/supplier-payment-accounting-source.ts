import { createHash } from 'node:crypto';

import { sql } from 'kysely';

import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { FinanceValidationError } from './finance-common';

export type SupplierPaymentAccountingSourceType =
	'supplier_payment_execution' | 'supplier_payment_reversal';

export type SupplierPaymentAccountingLine = {
	mappingKey: 'accounts_payable' | 'cash_disbursements';
	description: string;
	debitAmount: string;
	creditAmount: string;
};

export type SupplierPaymentAccountingCandidate = {
	sourceType: SupplierPaymentAccountingSourceType;
	sourcePublicId: string;
	sourceLabel: string;
	sourceEventAt: Date;
	currencyCode: string;
	sourceAmount: string;
	memo: string;
	lines: SupplierPaymentAccountingLine[];
	fingerprint: string;
};

export type SupplierPaymentAccountingReference = {
	sourceType: SupplierPaymentAccountingSourceType;
	sourcePublicId: string;
	at: Date;
};

const ZERO = '0.0000';

function money(value: string): bigint {
	return parseScaledDecimal(value, 4, 'Supplier payment accounting amount', true);
}

function line(
	mappingKey: SupplierPaymentAccountingLine['mappingKey'],
	description: string,
	side: 'debit' | 'credit',
	amount: string
): SupplierPaymentAccountingLine {
	if (money(amount) <= 0n) {
		throw new FinanceValidationError('Supplier payment accounting line amount must be positive.');
	}
	return {
		mappingKey,
		description,
		debitAmount: side === 'debit' ? amount : ZERO,
		creditAmount: side === 'credit' ? amount : ZERO
	};
}

function finish(
	candidate: Omit<SupplierPaymentAccountingCandidate, 'fingerprint'>
): SupplierPaymentAccountingCandidate {
	let debit = 0n;
	let credit = 0n;
	for (const candidateLine of candidate.lines) {
		debit += money(candidateLine.debitAmount);
		credit += money(candidateLine.creditAmount);
	}
	if (debit <= 0n || debit !== credit || debit !== money(candidate.sourceAmount)) {
		throw new FinanceValidationError(
			'Derived supplier payment accounting candidate is not balanced.'
		);
	}
	const fingerprint = createHash('sha256')
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
	return { ...candidate, fingerprint };
}

async function hasActiveExecutionJournal(
	db: DatabaseExecutor,
	organisationId: string,
	paymentPublicId: string
): Promise<boolean> {
	const journal = await db
		.selectFrom('accounting_journal_entries as journal')
		.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
			join
				.onRef('reversal.journal_entry_id', '=', 'journal.id')
				.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
		)
		.select('journal.id')
		.where('journal.organisation_id', '=', organisationId)
		.where('journal.source_type', '=', 'supplier_payment_execution')
		.where('journal.source_public_id', '=', paymentPublicId)
		.where('reversal.journal_entry_id', 'is', null)
		.executeTakeFirst();
	return Boolean(journal);
}

export async function resolveSupplierPaymentAccountingCandidate(
	db: DatabaseExecutor,
	organisationId: string,
	sourceType: SupplierPaymentAccountingSourceType,
	sourcePublicId: string,
	forUpdate: boolean
): Promise<SupplierPaymentAccountingCandidate> {
	let query = db
		.selectFrom('accounts_payable_supplier_payments as payment')
		.select([
			'payment.id',
			'payment.public_id as publicId',
			'payment.currency_code as currencyCode',
			'payment.payment_amount as paymentAmount',
			'payment.payment_reference as paymentReference',
			'payment.lifecycle_status as status',
			'payment.executed_at as executedAt'
		])
		.where('payment.organisation_id', '=', organisationId)
		.where('payment.public_id', '=', sourcePublicId);
	if (forUpdate) query = query.forUpdate();
	const payment = await query.executeTakeFirst();
	if (!payment || payment.status !== 'executed' || !payment.executedAt) {
		throw new RecordNotFoundError('Executed supplier payment source not found.');
	}
	const reversal = await db
		.selectFrom('accounts_payable_supplier_payment_reversals')
		.select(['public_id as publicId', 'reversed_at as reversedAt'])
		.where('organisation_id', '=', organisationId)
		.where('supplier_payment_id', '=', payment.id)
		.executeTakeFirst();
	if (sourceType === 'supplier_payment_reversal') {
		if (!reversal) throw new RecordNotFoundError('Supplier payment reversal source not found.');
		if (!(await hasActiveExecutionJournal(db, organisationId, payment.publicId))) {
			throw new FinanceValidationError(
				'The supplier payment execution must have an active journal before its operational reversal can be posted.'
			);
		}
	}
	if (money(payment.paymentAmount) <= 0n) {
		throw new FinanceValidationError('Executed supplier payment total must be positive to post.');
	}

	const reference = payment.paymentReference ?? payment.publicId;
	const reverse = sourceType === 'supplier_payment_reversal';
	return finish({
		sourceType,
		sourcePublicId: payment.publicId,
		sourceLabel: `${reverse ? 'Supplier payment reversal' : 'Supplier payment'} ${reference}`,
		sourceEventAt: reverse ? reversal!.reversedAt : payment.executedAt,
		currencyCode: payment.currencyCode,
		sourceAmount: formatScaledDecimal(money(payment.paymentAmount), 4),
		memo: `${reverse ? 'Reverse supplier payment' : 'Post supplier payment'} ${reference}`,
		lines: reverse
			? [
					line(
						'cash_disbursements',
						`${reference} cash restoration`,
						'debit',
						payment.paymentAmount
					),
					line(
						'accounts_payable',
						`${reference} payable restoration`,
						'credit',
						payment.paymentAmount
					)
				]
			: [
					line(
						'accounts_payable',
						`${reference} payable settlement`,
						'debit',
						payment.paymentAmount
					),
					line(
						'cash_disbursements',
						`${reference} cash disbursement`,
						'credit',
						payment.paymentAmount
					)
				]
	});
}

export async function listSupplierPaymentAccountingReferences(
	db: DatabaseExecutor,
	organisationId: string
): Promise<SupplierPaymentAccountingReference[]> {
	const references: SupplierPaymentAccountingReference[] = [];
	const executions = await db
		.selectFrom('accounts_payable_supplier_payments as payment')
		.select(['payment.public_id as publicId', 'payment.executed_at as executedAt'])
		.where('payment.organisation_id', '=', organisationId)
		.where('payment.lifecycle_status', '=', 'executed')
		.where('payment.executed_at', 'is not', null)
		.where(
			sql<boolean>`not exists (
				select 1
				from accounting_journal_entries as journal
				left join accounting_journal_entry_reversals as journal_reversal
					on journal_reversal.journal_entry_id = journal.id
					and journal_reversal.organisation_id = journal.organisation_id
				where journal.organisation_id = ${organisationId}
					and journal.source_type = 'supplier_payment_execution'
					and journal.source_public_id = payment.public_id
					and journal_reversal.journal_entry_id is null
			)`
		)
		.orderBy('payment.executed_at', 'desc')
		.limit(100)
		.execute();
	for (const payment of executions) {
		if (!payment.executedAt) continue;
		references.push({
			sourceType: 'supplier_payment_execution',
			sourcePublicId: payment.publicId,
			at: payment.executedAt
		});
	}

	const reversals = await db
		.selectFrom('accounts_payable_supplier_payment_reversals as reversal')
		.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
			join
				.onRef('payment.id', '=', 'reversal.supplier_payment_id')
				.onRef('payment.organisation_id', '=', 'reversal.organisation_id')
		)
		.select(['payment.public_id as publicId', 'reversal.reversed_at as reversedAt'])
		.where('reversal.organisation_id', '=', organisationId)
		.where(
			sql<boolean>`exists (
				select 1
				from accounting_journal_entries as execution_journal
				left join accounting_journal_entry_reversals as execution_reversal
					on execution_reversal.journal_entry_id = execution_journal.id
					and execution_reversal.organisation_id = execution_journal.organisation_id
				where execution_journal.organisation_id = ${organisationId}
					and execution_journal.source_type = 'supplier_payment_execution'
					and execution_journal.source_public_id = payment.public_id
					and execution_reversal.journal_entry_id is null
			)`
		)
		.where(
			sql<boolean>`not exists (
				select 1
				from accounting_journal_entries as reversal_journal
				left join accounting_journal_entry_reversals as journal_reversal
					on journal_reversal.journal_entry_id = reversal_journal.id
					and journal_reversal.organisation_id = reversal_journal.organisation_id
				where reversal_journal.organisation_id = ${organisationId}
					and reversal_journal.source_type = 'supplier_payment_reversal'
					and reversal_journal.source_public_id = payment.public_id
					and journal_reversal.journal_entry_id is null
			)`
		)
		.orderBy('reversal.reversed_at', 'desc')
		.limit(100)
		.execute();
	for (const reversal of reversals) {
		references.push({
			sourceType: 'supplier_payment_reversal',
			sourcePublicId: reversal.publicId,
			at: reversal.reversedAt
		});
	}
	return references;
}
