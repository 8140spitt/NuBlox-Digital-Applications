import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { lineAmount, parseScaledDecimal, subtractMoney, sumMoney } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy } from './finance-common';

export type ReceivablePositionStatus = 'draft' | 'void' | 'open' | 'part_settled' | 'settled';

export type InvoiceReceivablePosition = {
	invoicePublicId: string;
	currencyCode: string;
	lifecycleStatus: string;
	invoiceGross: string;
	issuedCreditGross: string;
	activeAllocatedAmount: string;
	outstandingAmount: string | null;
	status: ReceivablePositionStatus;
};

export class ReceivablePositionService {
	constructor(private readonly db: Database = getDatabase()) {}

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

	private async issuedCreditGross(db: DatabaseExecutor, organisationId: string, invoiceDocumentId: string): Promise<string> {
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
		for (const credit of credits) totals.push(await this.documentGross(db, organisationId, credit.id));
		return sumMoney(totals);
	}

	private async activeAllocatedAmount(db: DatabaseExecutor, organisationId: string, invoiceDocumentId: string): Promise<string> {
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

	async getInvoicePosition(actor: TenantActorContext, invoicePublicIdInput: string): Promise<InvoiceReceivablePosition> {
		const invoicePublicId = invoicePublicIdInput.trim();
		if (!invoicePublicId || invoicePublicId.length > 64) throw new RecordNotFoundError('Invoice not found.');
		const policy = new FinanceAccessPolicy(this.db);
		await policy.assertActiveActor(actor);
		if (!(await policy.viewDecision(actor)).allowed) throw new TenantAccessError('Accounts-receivable viewing is not permitted.');
		const invoice = await this.db
			.selectFrom('financial_documents')
			.select(['id', 'public_id as publicId', 'currency_code as currencyCode', 'lifecycle_status as lifecycleStatus'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', invoicePublicId)
			.where('document_kind', '=', 'invoice')
			.executeTakeFirst();
		if (!invoice) throw new RecordNotFoundError('Invoice not found.');
		const invoiceGross = await this.documentGross(this.db, actor.organisationId, invoice.id);
		if (invoice.lifecycleStatus === 'draft') {
			return {
				invoicePublicId: invoice.publicId,
				currencyCode: invoice.currencyCode,
				lifecycleStatus: invoice.lifecycleStatus,
				invoiceGross,
				issuedCreditGross: '0.0000',
				activeAllocatedAmount: '0.0000',
				outstandingAmount: null,
				status: 'draft'
			};
		}
		if (invoice.lifecycleStatus === 'void') {
			return {
				invoicePublicId: invoice.publicId,
				currencyCode: invoice.currencyCode,
				lifecycleStatus: invoice.lifecycleStatus,
				invoiceGross,
				issuedCreditGross: '0.0000',
				activeAllocatedAmount: '0.0000',
				outstandingAmount: '0.0000',
				status: 'void'
			};
		}
		const [issuedCreditGross, activeAllocatedAmount] = await Promise.all([
			this.issuedCreditGross(this.db, actor.organisationId, invoice.id),
			this.activeAllocatedAmount(this.db, actor.organisationId, invoice.id)
		]);
		const outstandingAmount = subtractMoney(subtractMoney(invoiceGross, issuedCreditGross), activeAllocatedAmount);
		const outstanding = parseScaledDecimal(outstandingAmount, 4, 'Outstanding amount', true);
		const hasSettlement =
			parseScaledDecimal(activeAllocatedAmount, 4, 'Allocated amount', true) > 0n ||
			parseScaledDecimal(issuedCreditGross, 4) > 0n;
		return {
			invoicePublicId: invoice.publicId,
			currencyCode: invoice.currencyCode,
			lifecycleStatus: invoice.lifecycleStatus,
			invoiceGross,
			issuedCreditGross,
			activeAllocatedAmount,
			outstandingAmount,
			status: outstanding <= 0n ? 'settled' : hasSettlement ? 'part_settled' : 'open'
		};
	}
}
