import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { FinanceAccessPolicy } from './finance-common';
import { financialDocumentGross, issuedInvoiceOutstanding } from './receivable-ledger';

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
		const invoiceGross = await financialDocumentGross(this.db, actor.organisationId, invoice.id);
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
		const position = await issuedInvoiceOutstanding(this.db, actor.organisationId, invoice.id);
		const outstanding = parseScaledDecimal(position.outstandingAmount, 4, 'Outstanding amount', true);
		const hasSettlement =
			parseScaledDecimal(position.activeAllocatedAmount, 4, 'Allocated amount', true) > 0n ||
			parseScaledDecimal(position.issuedCreditGross, 4) > 0n;
		return {
			invoicePublicId: invoice.publicId,
			currencyCode: invoice.currencyCode,
			lifecycleStatus: invoice.lifecycleStatus,
			...position,
			status: outstanding <= 0n ? 'settled' : hasSettlement ? 'part_settled' : 'open'
		};
	}
}
