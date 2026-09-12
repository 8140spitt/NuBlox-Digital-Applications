import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';

const MONEY_SCALE = 4;

export type ProjectProcurementSettlementStatus =
	| 'liability_unposted'
	| 'unpaid'
	| 'partially_paid'
	| 'payment_unposted'
	| 'paid_unreconciled'
	| 'settled';

export type ProjectProcurementSettlementPayment = {
	publicId: string;
	paymentReference: string | null;
	allocatedAmount: string;
	executedAt: Date;
	accountingPosted: boolean;
	bankSettled: boolean;
	bankAccountName: string | null;
	bankStatementReference: string | null;
	bankReference: string | null;
	bankBookedOn: Date | null;
};

export type ProjectProcurementSettlementDocument = {
	publicId: string;
	supplierName: string;
	supplierDocumentNumber: string;
	purchaseOrderPublicId: string | null;
	invoiceDate: Date;
	dueDate: Date | null;
	currencyCode: string;
	grossAmount: string;
	liabilityPosted: boolean;
	executedPaymentAmount: string;
	accountedPaymentAmount: string;
	bankSettledAmount: string;
	outstandingPayableAmount: string;
	unreconciledPaymentAmount: string;
	status: ProjectProcurementSettlementStatus;
	payments: ProjectProcurementSettlementPayment[];
};

export type ProjectProcurementSettlementTotals = {
	approvedInvoiceAmount: string;
	executedPaymentAmount: string;
	accountedPaymentAmount: string;
	bankSettledAmount: string;
	outstandingPayableAmount: string;
	unreconciledPaymentAmount: string;
};

export type ProjectProcurementSettlementWorkspace = {
	project: ProjectRecord;
	currencyCodes: string[];
	currencyMismatch: boolean;
	documents: ProjectProcurementSettlementDocument[];
	totals: ProjectProcurementSettlementTotals;
};

type PaymentAllocationRow = {
	documentId: string;
	paymentId: string;
	paymentPublicId: string;
	allocatedAmount: string;
	paymentReference: string | null;
	paymentStatus: string;
	executedAt: Date | null;
	paymentReversalId: string | null;
};

type ActiveBankMatch = {
	paymentId: string;
	bankAccountName: string;
	statementReference: string;
	bankReference: string | null;
	externalTransactionId: string;
	bookedOn: Date;
};

function money(value: string, label: string): bigint {
	return parseScaledDecimal(value, MONEY_SCALE, label, true);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, MONEY_SCALE);
}

function positive(value: bigint): bigint {
	return value > 0n ? value : 0n;
}

function settlementStatus(input: {
	gross: bigint;
	liabilityPosted: boolean;
	paid: bigint;
	accounted: bigint;
	settled: bigint;
}): ProjectProcurementSettlementStatus {
	if (!input.liabilityPosted) return 'liability_unposted';
	if (input.paid === 0n) return 'unpaid';
	if (input.paid < input.gross) return 'partially_paid';
	if (input.accounted < input.paid) return 'payment_unposted';
	if (input.settled < input.paid) return 'paid_unreconciled';
	return 'settled';
}

export class ProjectProcurementSettlementService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async resolveProject(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();

		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Project procurement settlement not found.');
		}

		const permissions = new PermissionService(this.db);
		const [projectView, financialView, accountsPayableView, bankView] = await Promise.all([
			permissions.decide(actor, 'project.view', { projectId: project.id }),
			permissions.decide(actor, 'commercial.forecast.view', { projectId: project.id }),
			permissions.decide(actor, 'finance.ap.view'),
			permissions.decide(actor, 'finance.bank.view')
		]);
		if (
			!projectView.allowed ||
			!financialView.allowed ||
			!accountsPayableView.allowed ||
			!bankView.allowed
		) {
			throw new TenantAccessError(
				'Project procurement settlement is outside your effective permission scope.'
			);
		}
		return project;
	}

	async getWorkspace(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectProcurementSettlementWorkspace> {
		const project = await this.resolveProject(actor, projectPublicId);
		const documents = await this.db
			.selectFrom('accounts_payable_documents as document')
			.innerJoin('accounts_payable_supplier_snapshots as supplier', (join) =>
				join
					.onRef('supplier.accounts_payable_document_id', '=', 'document.id')
					.onRef('supplier.organisation_id', '=', 'document.organisation_id')
			)
			.leftJoin('purchase_orders as purchaseOrder', (join) =>
				join
					.onRef('purchaseOrder.id', '=', 'document.purchase_order_id')
					.onRef('purchaseOrder.organisation_id', '=', 'document.organisation_id')
			)
			.select([
				'document.id as id',
				'document.public_id as publicId',
				'supplier.display_name as supplierName',
				'document.supplier_document_number as supplierDocumentNumber',
				'purchaseOrder.public_id as purchaseOrderPublicId',
				'document.invoice_date as invoiceDate',
				'document.due_date as dueDate',
				'document.currency_code as currencyCode',
				'document.gross_amount as grossAmount'
			])
			.where('document.organisation_id', '=', actor.organisationId)
			.where('document.project_id', '=', project.id)
			.where('document.document_type', '=', 'invoice')
			.where('document.lifecycle_status', '=', 'approved')
			.orderBy('document.invoice_date', 'desc')
			.orderBy('document.id', 'desc')
			.execute();

		if (documents.length === 0) {
			return {
				project,
				currencyCodes: [],
				currencyMismatch: false,
				documents: [],
				totals: {
					approvedInvoiceAmount: moneyText(0n),
					executedPaymentAmount: moneyText(0n),
					accountedPaymentAmount: moneyText(0n),
					bankSettledAmount: moneyText(0n),
					outstandingPayableAmount: moneyText(0n),
					unreconciledPaymentAmount: moneyText(0n)
				}
			};
		}

		const documentIds = documents.map((document) => document.id);
		const documentPublicIds = documents.map((document) => document.publicId);
		const [liabilityJournals, paymentAllocations] = await Promise.all([
			this.db
				.selectFrom('accounting_journal_entries as journal')
				.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
					join
						.onRef('reversal.journal_entry_id', '=', 'journal.id')
						.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
				)
				.select('journal.source_public_id as sourcePublicId')
				.where('journal.organisation_id', '=', actor.organisationId)
				.where('journal.source_type', '=', 'accounts_payable_invoice_approval')
				.where('journal.source_public_id', 'in', documentPublicIds)
				.where('reversal.journal_entry_id', 'is', null)
				.execute(),
			this.db
				.selectFrom('accounts_payable_supplier_payment_allocations as allocation')
				.innerJoin('accounts_payable_supplier_payments as payment', (join) =>
					join
						.onRef('payment.id', '=', 'allocation.supplier_payment_id')
						.onRef('payment.organisation_id', '=', 'allocation.organisation_id')
				)
				.leftJoin('accounts_payable_supplier_payment_reversals as paymentReversal', (join) =>
					join
						.onRef('paymentReversal.supplier_payment_id', '=', 'payment.id')
						.onRef('paymentReversal.organisation_id', '=', 'payment.organisation_id')
				)
				.select([
					'allocation.accounts_payable_document_id as documentId',
					'payment.id as paymentId',
					'payment.public_id as paymentPublicId',
					'allocation.allocated_amount as allocatedAmount',
					'payment.payment_reference as paymentReference',
					'payment.lifecycle_status as paymentStatus',
					'payment.executed_at as executedAt',
					'paymentReversal.id as paymentReversalId'
				])
				.where('allocation.organisation_id', '=', actor.organisationId)
				.where('allocation.accounts_payable_document_id', 'in', documentIds)
				.execute()
		]);

		const activePayments = (paymentAllocations as PaymentAllocationRow[]).filter(
			(row) => row.paymentStatus === 'executed' && row.executedAt && !row.paymentReversalId
		);
		const paymentPublicIds = [...new Set(activePayments.map((row) => row.paymentPublicId))];
		const paymentIds = [...new Set(activePayments.map((row) => row.paymentId))];

		const paymentJournals =
			paymentPublicIds.length === 0
				? []
				: await this.db
						.selectFrom('accounting_journal_entries as journal')
						.leftJoin('accounting_journal_entry_reversals as reversal', (join) =>
							join
								.onRef('reversal.journal_entry_id', '=', 'journal.id')
								.onRef('reversal.organisation_id', '=', 'journal.organisation_id')
						)
						.select('journal.source_public_id as sourcePublicId')
						.where('journal.organisation_id', '=', actor.organisationId)
						.where('journal.source_type', '=', 'supplier_payment_execution')
						.where('journal.source_public_id', 'in', paymentPublicIds)
						.where('reversal.journal_entry_id', 'is', null)
						.execute();

		const bankMatches: ActiveBankMatch[] =
			paymentIds.length === 0
				? []
				: await this.db
						.selectFrom('bank_reconciliation_matches as match')
						.innerJoin('bank_statement_lines as line', (join) =>
							join
								.onRef('line.id', '=', 'match.bank_statement_line_id')
								.onRef('line.organisation_id', '=', 'match.organisation_id')
						)
						.innerJoin('bank_statements as statement', (join) =>
							join
								.onRef('statement.id', '=', 'line.bank_statement_id')
								.onRef('statement.organisation_id', '=', 'line.organisation_id')
						)
						.innerJoin('bank_accounts as bank', (join) =>
							join
								.onRef('bank.id', '=', 'line.bank_account_id')
								.onRef('bank.organisation_id', '=', 'line.organisation_id')
						)
						.leftJoin('bank_reconciliation_match_reversals as reversal', (join) =>
							join
								.onRef('reversal.bank_reconciliation_match_id', '=', 'match.id')
								.onRef('reversal.organisation_id', '=', 'match.organisation_id')
						)
						.select([
							'match.supplier_payment_id as paymentId',
							'bank.account_name as bankAccountName',
							'statement.statement_reference as statementReference',
							'line.bank_reference as bankReference',
							'line.external_transaction_id as externalTransactionId',
							'line.booked_on as bookedOn'
						])
						.where('match.organisation_id', '=', actor.organisationId)
						.where('match.supplier_payment_id', 'in', paymentIds)
						.where('reversal.bank_reconciliation_match_id', 'is', null)
						.orderBy('match.matched_at', 'desc')
						.execute();

		const liabilityPosted = new Set(liabilityJournals.map((row) => row.sourcePublicId));
		const paymentPosted = new Set(paymentJournals.map((row) => row.sourcePublicId));
		const bankMatchByPayment = new Map<string, ActiveBankMatch>();
		for (const match of bankMatches) {
			if (!bankMatchByPayment.has(match.paymentId)) bankMatchByPayment.set(match.paymentId, match);
		}
		const paymentsByDocument = new Map<string, PaymentAllocationRow[]>();
		for (const row of activePayments) {
			const rows = paymentsByDocument.get(row.documentId) ?? [];
			rows.push(row);
			paymentsByDocument.set(row.documentId, rows);
		}

		const workspaceDocuments = documents.map((document) => {
			const gross = money(document.grossAmount, 'Approved supplier invoice');
			const allocations = paymentsByDocument.get(document.id) ?? [];
			let paid = 0n;
			let accounted = 0n;
			let settled = 0n;
			const payments = allocations.map((allocation): ProjectProcurementSettlementPayment => {
				const allocated = money(allocation.allocatedAmount, 'Supplier payment allocation');
				paid += allocated;
				const accountingPosted = paymentPosted.has(allocation.paymentPublicId);
				if (accountingPosted) accounted += allocated;
				const bankMatch = bankMatchByPayment.get(allocation.paymentId) ?? null;
				if (bankMatch) settled += allocated;
				return {
					publicId: allocation.paymentPublicId,
					paymentReference: allocation.paymentReference,
					allocatedAmount: moneyText(allocated),
					executedAt: allocation.executedAt!,
					accountingPosted,
					bankSettled: Boolean(bankMatch),
					bankAccountName: bankMatch?.bankAccountName ?? null,
					bankStatementReference: bankMatch?.statementReference ?? null,
					bankReference: bankMatch?.bankReference ?? bankMatch?.externalTransactionId ?? null,
					bankBookedOn: bankMatch?.bookedOn ?? null
				};
			});
			const isLiabilityPosted = liabilityPosted.has(document.publicId);
			return {
				publicId: document.publicId,
				supplierName: document.supplierName,
				supplierDocumentNumber: document.supplierDocumentNumber,
				purchaseOrderPublicId: document.purchaseOrderPublicId,
				invoiceDate: document.invoiceDate,
				dueDate: document.dueDate,
				currencyCode: document.currencyCode,
				grossAmount: moneyText(gross),
				liabilityPosted: isLiabilityPosted,
				executedPaymentAmount: moneyText(paid),
				accountedPaymentAmount: moneyText(accounted),
				bankSettledAmount: moneyText(settled),
				outstandingPayableAmount: moneyText(positive(gross - paid)),
				unreconciledPaymentAmount: moneyText(positive(paid - settled)),
				status: settlementStatus({
					gross,
					liabilityPosted: isLiabilityPosted,
					paid,
					accounted,
					settled
				}),
				payments
			};
		});

		const currencies = [...new Set(workspaceDocuments.map((row) => row.currencyCode))].sort();
		const total = (
			key: keyof Pick<
				ProjectProcurementSettlementDocument,
				| 'grossAmount'
				| 'executedPaymentAmount'
				| 'accountedPaymentAmount'
				| 'bankSettledAmount'
				| 'outstandingPayableAmount'
				| 'unreconciledPaymentAmount'
			>
		) =>
			workspaceDocuments.reduce(
				(sum, row) => sum + money(row[key], 'Project settlement total'),
				0n
			);

		return {
			project,
			currencyCodes: currencies,
			currencyMismatch: currencies.length > 1,
			documents: workspaceDocuments,
			totals: {
				approvedInvoiceAmount: moneyText(total('grossAmount')),
				executedPaymentAmount: moneyText(total('executedPaymentAmount')),
				accountedPaymentAmount: moneyText(total('accountedPaymentAmount')),
				bankSettledAmount: moneyText(total('bankSettledAmount')),
				outstandingPayableAmount: moneyText(total('outstandingPayableAmount')),
				unreconciledPaymentAmount: moneyText(total('unreconciledPaymentAmount'))
			}
		};
	}
}
