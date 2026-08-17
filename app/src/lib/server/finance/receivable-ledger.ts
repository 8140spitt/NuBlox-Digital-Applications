import { parseScaledDecimal, subtractMoney, sumMoney, lineAmount } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export type IssuedInvoiceOutstanding = {
	invoiceGross: string;
	issuedCreditGross: string;
	activeAllocatedAmount: string;
	outstandingAmount: string;
};

export async function financialDocumentGross(
	db: DatabaseExecutor,
	organisationId: string,
	documentId: string
): Promise<string> {
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

export async function issuedCreditGrossForInvoice(
	db: DatabaseExecutor,
	organisationId: string,
	invoiceDocumentId: string
): Promise<string> {
	const credits = await db
		.selectFrom('credit_notes as creditNote')
		.innerJoin('financial_documents as document', (join) =>
			join
				.onRef('document.id', '=', 'creditNote.financial_document_id')
				.onRef('document.organisation_id', '=', 'creditNote.organisation_id')
		)
		.select('document.id')
		.where('creditNote.organisation_id', '=', organisationId)
		.where('creditNote.original_invoice_document_id', '=', invoiceDocumentId)
		.where('document.lifecycle_status', '=', 'issued')
		.execute();
	const totals: string[] = [];
	for (const credit of credits) totals.push(await financialDocumentGross(db, organisationId, credit.id));
	return sumMoney(totals);
}

export async function activeAllocatedAmountForInvoice(
	db: DatabaseExecutor,
	organisationId: string,
	invoiceDocumentId: string
): Promise<string> {
	const rows = await db
		.selectFrom('payment_allocations as allocation')
		.leftJoin('payment_allocation_reversals as reversal', (join) =>
			join
				.onRef('reversal.payment_allocation_id', '=', 'allocation.id')
				.onRef('reversal.organisation_id', '=', 'allocation.organisation_id')
		)
		.select('allocation.allocated_amount as allocatedAmount')
		.where('allocation.organisation_id', '=', organisationId)
		.where('allocation.invoice_document_id', '=', invoiceDocumentId)
		.where('reversal.payment_allocation_id', 'is', null)
		.execute();
	return sumMoney(rows.map((row) => row.allocatedAmount));
}

export async function issuedInvoiceOutstanding(
	db: DatabaseExecutor,
	organisationId: string,
	invoiceDocumentId: string
): Promise<IssuedInvoiceOutstanding> {
	const invoiceGross = await financialDocumentGross(db, organisationId, invoiceDocumentId);
	const [issuedCreditGross, activeAllocatedAmount] = await Promise.all([
		issuedCreditGrossForInvoice(db, organisationId, invoiceDocumentId),
		activeAllocatedAmountForInvoice(db, organisationId, invoiceDocumentId)
	]);
	return {
		invoiceGross,
		issuedCreditGross,
		activeAllocatedAmount,
		outstandingAmount: subtractMoney(subtractMoney(invoiceGross, issuedCreditGross), activeAllocatedAmount)
	};
}

export async function customerOutstandingByCurrency(
	db: DatabaseExecutor,
	organisationId: string,
	customerPartyId: string,
	currencyCode: string
): Promise<string> {
	const invoices = await db
		.selectFrom('financial_documents')
		.select('id')
		.where('organisation_id', '=', organisationId)
		.where('document_kind', '=', 'invoice')
		.where('lifecycle_status', '=', 'issued')
		.where('customer_party_id', '=', customerPartyId)
		.where('currency_code', '=', currencyCode)
		.orderBy('id', 'asc')
		.execute();
	const outstanding: string[] = [];
	for (const invoice of invoices) {
		const position = await issuedInvoiceOutstanding(db, organisationId, invoice.id);
		if (parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true) > 0n) {
			outstanding.push(position.outstandingAmount);
		}
	}
	return sumMoney(outstanding);
}
