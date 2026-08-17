import { parseScaledDecimal, subtractMoney, sumMoney } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { activeRecoveryAmountForPayment, issuedInvoiceOutstanding } from './receivable-ledger';

export type BadDebtInvoiceRecord = {
	id: string;
	publicId: string;
	documentNumber: string | null;
	customerPartyId: string;
	customerPartyPublicId: string;
	customerDisplayName: string;
	currencyCode: string;
	lifecycleStatus: string;
	dueDate: Date | null;
};

export type BadDebtCaseRecord = {
	id: string;
	publicId: string;
	customerPartyId: string;
	invoiceDocumentId: string;
	status: string;
	openingReason: string;
	openedAt: Date;
	closeReason: string | null;
	closedAt: Date | null;
};

export async function badDebtInvoiceByPublicId(
	db: DatabaseExecutor,
	organisationId: string,
	publicId: string,
	lock = false
): Promise<BadDebtInvoiceRecord | null> {
	let query = db
		.selectFrom('financial_documents as document')
		.innerJoin('invoices as invoice', (join) => join.onRef('invoice.financial_document_id', '=', 'document.id').onRef('invoice.organisation_id', '=', 'document.organisation_id'))
		.innerJoin('parties as customer', (join) => join.onRef('customer.id', '=', 'document.customer_party_id').onRef('customer.organisation_id', '=', 'document.organisation_id'))
		.leftJoin('financial_document_party_snapshots as snapshot', (join) => join.onRef('snapshot.financial_document_id', '=', 'document.id').onRef('snapshot.organisation_id', '=', 'document.organisation_id').on('snapshot.snapshot_role', '=', 'customer').on('snapshot.sort_order', '=', 1))
		.select([
			'document.id as id', 'document.public_id as publicId', 'document.document_number as documentNumber',
			'document.customer_party_id as customerPartyId', 'customer.public_id as customerPartyPublicId',
			'document.currency_code as currencyCode', 'document.lifecycle_status as lifecycleStatus',
			'invoice.due_date as dueDate', 'snapshot.display_name as customerDisplayName'
		])
		.where('document.organisation_id', '=', organisationId)
		.where('document.public_id', '=', publicId)
		.where('document.document_kind', '=', 'invoice');
	if (lock) query = query.forUpdate();
	const row = await query.executeTakeFirst();
	return row ? { ...row, customerDisplayName: row.customerDisplayName ?? 'Customer' } : null;
}

export async function badDebtInvoiceById(
	db: DatabaseExecutor,
	organisationId: string,
	invoiceDocumentId: string,
	lock = false
): Promise<BadDebtInvoiceRecord | null> {
	const identity = await db.selectFrom('financial_documents').select('public_id as publicId').where('organisation_id', '=', organisationId).where('id', '=', invoiceDocumentId).where('document_kind', '=', 'invoice').executeTakeFirst();
	return identity ? badDebtInvoiceByPublicId(db, organisationId, identity.publicId, lock) : null;
}

export async function lockBadDebtCustomerThenInvoice(
	db: DatabaseExecutor,
	organisationId: string,
	invoicePublicId: string
): Promise<BadDebtInvoiceRecord> {
	const identity = await badDebtInvoiceByPublicId(db, organisationId, invoicePublicId);
	if (!identity) throw new RecordNotFoundError('Invoice not found.');
	const customer = await db.selectFrom('parties').select('id').where('organisation_id', '=', organisationId).where('id', '=', identity.customerPartyId).forUpdate().executeTakeFirst();
	if (!customer) throw new RecordNotFoundError('Invoice not found.');
	const locked = await badDebtInvoiceByPublicId(db, organisationId, invoicePublicId, true);
	if (!locked || locked.customerPartyId !== identity.customerPartyId) throw new RecordNotFoundError('Invoice not found.');
	return locked;
}

export async function badDebtCaseByPublicId(
	db: DatabaseExecutor,
	organisationId: string,
	publicId: string,
	lock = false
): Promise<BadDebtCaseRecord | null> {
	let query = db.selectFrom('receivable_bad_debt_cases').select([
		'id', 'public_id as publicId', 'customer_party_id as customerPartyId', 'invoice_document_id as invoiceDocumentId',
		'status', 'opening_reason as openingReason', 'opened_at as openedAt', 'close_reason as closeReason', 'closed_at as closedAt'
	]).where('organisation_id', '=', organisationId).where('public_id', '=', publicId);
	if (lock) query = query.forUpdate();
	return (await query.executeTakeFirst()) ?? null;
}

export async function activeRecoveryAmountForWriteOff(
	db: DatabaseExecutor,
	organisationId: string,
	writeOffId: string,
	currentRead = false
): Promise<string> {
	let query = db.selectFrom('receivable_write_off_recoveries as recovery')
		.leftJoin('receivable_write_off_recovery_reversals as reversal', (join) => join.onRef('reversal.recovery_id', '=', 'recovery.id').onRef('reversal.organisation_id', '=', 'recovery.organisation_id'))
		.select('recovery.recovered_amount as amount')
		.where('recovery.organisation_id', '=', organisationId).where('recovery.write_off_id', '=', writeOffId).where('reversal.recovery_id', 'is', null);
	if (currentRead) query = query.forUpdate();
	const rows = await query.execute();
	return sumMoney(rows.map((row) => row.amount));
}

export async function activeAllocatedAmountForPayment(
	db: DatabaseExecutor,
	organisationId: string,
	paymentId: string,
	currentRead = false
): Promise<string> {
	let query = db.selectFrom('payment_allocations as allocation')
		.leftJoin('payment_allocation_reversals as reversal', (join) => join.onRef('reversal.payment_allocation_id', '=', 'allocation.id').onRef('reversal.organisation_id', '=', 'allocation.organisation_id'))
		.select('allocation.allocated_amount as amount')
		.where('allocation.organisation_id', '=', organisationId).where('allocation.payment_id', '=', paymentId).where('reversal.payment_allocation_id', 'is', null);
	if (currentRead) query = query.forUpdate();
	const rows = await query.execute();
	return sumMoney(rows.map((row) => row.amount));
}

export async function paymentIsReversed(db: DatabaseExecutor, organisationId: string, paymentId: string, currentRead = false): Promise<boolean> {
	let query = db.selectFrom('payment_reversals').select('payment_id').where('organisation_id', '=', organisationId).where('payment_id', '=', paymentId);
	if (currentRead) query = query.forUpdate();
	return Boolean(await query.executeTakeFirst());
}

export async function availablePaymentAmount(
	db: DatabaseExecutor,
	organisationId: string,
	paymentId: string,
	paymentAmount: string,
	currentRead = false
): Promise<{ activeAllocatedAmount: string; activeRecoveryAmount: string; availableAmount: string }> {
	const [activeAllocatedAmount, activeRecoveryAmount] = await Promise.all([
		activeAllocatedAmountForPayment(db, organisationId, paymentId, currentRead),
		activeRecoveryAmountForPayment(db, organisationId, paymentId, currentRead)
	]);
	return { activeAllocatedAmount, activeRecoveryAmount, availableAmount: subtractMoney(subtractMoney(paymentAmount, activeAllocatedAmount), activeRecoveryAmount) };
}

export async function assertPositiveBadDebtOutstanding(db: DatabaseExecutor, organisationId: string, invoiceDocumentId: string): Promise<string> {
	const position = await issuedInvoiceOutstanding(db, organisationId, invoiceDocumentId);
	if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) <= 0n) throw new Error('NO_BAD_DEBT_OUTSTANDING');
	return position.outstandingAmount;
}
