import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	cleanFinanceText,
	FinanceAccessPolicy,
	FinanceValidationError,
	insertedId,
	validateCurrencyCode,
	validateFinanceDate,
	validateMoneyAmount
} from './finance-common';
import {
	ReceivablesReportingService,
	type CustomerCurrencyReceivable,
	type CustomerStatementWorkspace
} from './receivables-reporting-service';

export type CollectionCaseStatus = 'open' | 'paused' | 'closed';
export type PromiseStatus = 'open' | 'kept' | 'broken' | 'cancelled';
export type DisputeStatus = 'open' | 'resolved' | 'withdrawn';
export type CollectionActionType =
	| 'case_opened'
	| 'case_paused'
	| 'case_resumed'
	| 'case_closed'
	| 'reminder'
	| 'phone_call'
	| 'note'
	| 'promise_recorded'
	| 'promise_kept'
	| 'promise_broken'
	| 'promise_cancelled'
	| 'dispute_opened'
	| 'dispute_resolved'
	| 'dispute_withdrawn';

const USER_ACTION_TYPES = new Set<CollectionActionType>(['reminder', 'phone_call', 'note']);
const DELIVERY_CHANNELS = new Set(['email', 'portal', 'phone', 'letter', 'manual', 'other']);

export type CollectionCaseSummary = {
	id: string;
	publicId: string;
	customerPartyId: string;
	status: CollectionCaseStatus;
	assignedMemberId: string | null;
	openedAt: Date;
	closedAt: Date | null;
	closeReason: string | null;
};

export type CollectionActionSummary = {
	publicId: string;
	actionType: CollectionActionType;
	deliveryChannel: string | null;
	occurredAt: Date;
	recordedByMemberId: string;
	invoicePublicId: string | null;
	promisePublicId: string | null;
	disputePublicId: string | null;
	subject: string | null;
	messageBody: string | null;
	outcome: string | null;
};

export type PromiseSummary = {
	publicId: string;
	invoicePublicId: string | null;
	promisedAmount: string;
	currencyCode: string;
	dueOn: Date;
	status: PromiseStatus;
	recordedAt: Date;
	resolvedAt: Date | null;
	resolutionNote: string | null;
};

export type DisputeSummary = {
	publicId: string;
	invoicePublicId: string | null;
	disputedAmount: string | null;
	currencyCode: string | null;
	reason: string;
	status: DisputeStatus;
	openedAt: Date;
	resolvedAt: Date | null;
	resolutionNote: string | null;
};

export type CollectionsPortfolioAccount = {
	customerPartyPublicId: string;
	customerDisplayName: string;
	customerAccountReference: string | null;
	overduePositions: CustomerCurrencyReceivable[];
	activeCase: CollectionCaseSummary | null;
};

export type CollectionsPortfolio = {
	asOf: string;
	accounts: CollectionsPortfolioAccount[];
};

export type CollectionsWorkspace = {
	receivable: CustomerStatementWorkspace;
	case: CollectionCaseSummary | null;
	actions: CollectionActionSummary[];
	promises: PromiseSummary[];
	disputes: DisputeSummary[];
	canStartCase: boolean;
	canManageCase: boolean;
	canRecordAction: boolean;
	canManagePromises: boolean;
	canManageDisputes: boolean;
};

function asCaseStatus(value: string): CollectionCaseStatus {
	if (value === 'open' || value === 'paused' || value === 'closed') return value;
	throw new Error(`Unexpected collections case status: ${value}`);
}

function asPromiseStatus(value: string): PromiseStatus {
	if (value === 'open' || value === 'kept' || value === 'broken' || value === 'cancelled') return value;
	throw new Error(`Unexpected promise status: ${value}`);
}

function asDisputeStatus(value: string): DisputeStatus {
	if (value === 'open' || value === 'resolved' || value === 'withdrawn') return value;
	throw new Error(`Unexpected dispute status: ${value}`);
}

function asActionType(value: string): CollectionActionType {
	const values: CollectionActionType[] = [
		'case_opened', 'case_paused', 'case_resumed', 'case_closed', 'reminder', 'phone_call', 'note',
		'promise_recorded', 'promise_kept', 'promise_broken', 'promise_cancelled',
		'dispute_opened', 'dispute_resolved', 'dispute_withdrawn'
	];
	if (values.includes(value as CollectionActionType)) return value as CollectionActionType;
	throw new Error(`Unexpected collection action type: ${value}`);
}

function overduePositions(positions: CustomerCurrencyReceivable[]): CustomerCurrencyReceivable[] {
	return positions
		.map((position) => {
			const invoices = position.invoices.filter((invoice) => invoice.daysOverdue > 0);
			if (invoices.length === 0) return null;
			const bucketCodes = new Set(['1_30', '31_60', '61_90', '91_plus']);
			return {
				...position,
				openInvoiceCount: invoices.length,
				buckets: position.buckets.filter((bucket) => bucketCodes.has(bucket.code)),
				invoices
			};
		})
		.filter((value): value is CustomerCurrencyReceivable => value !== null);
}

export class CollectionsService {
	constructor(
		private readonly db: Database,
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertRead(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const policy = new FinanceAccessPolicy(db);
		await policy.assertActiveActor(actor, db);
		const [financeView, collectionsView] = await Promise.all([
			policy.viewDecision(actor, db),
			policy.collectionsViewDecision(actor, db)
		]);
		if (!financeView.allowed || !collectionsView.allowed) {
			throw new TenantAccessError('Collections viewing is not permitted.');
		}
	}

	private async customerId(db: DatabaseExecutor, actor: TenantActorContext, publicIdInput: string, lock = false) {
		const publicId = cleanFinanceText(publicIdInput, 64, 'Customer ID', true)!;
		let query = db
			.selectFrom('parties')
			.select(['id', 'public_id as publicId'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', publicId);
		if (lock) query = query.forUpdate();
		const customer = await query.executeTakeFirst();
		if (!customer) throw new RecordNotFoundError('Customer not found.');
		return customer;
	}

	private async activeCase(db: DatabaseExecutor, organisationId: string, customerPartyId: string, lock = false) {
		let query = db
			.selectFrom('receivable_collection_cases')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('customer_party_id', '=', customerPartyId)
			.where('status', 'in', ['open', 'paused'])
			.orderBy('opened_at', 'desc')
			.limit(1);
		if (lock) query = query.forUpdate();
		return query.executeTakeFirst();
	}

	private async lockCustomerIssuedInvoices(
		db: DatabaseExecutor,
		organisationId: string,
		customerPartyId: string
	): Promise<void> {
		await db
			.selectFrom('financial_documents as document')
			.innerJoin('invoices as invoice', (join) =>
				join
					.onRef('invoice.financial_document_id', '=', 'document.id')
					.onRef('invoice.organisation_id', '=', 'document.organisation_id')
			)
			.select('document.id')
			.where('document.organisation_id', '=', organisationId)
			.where('document.customer_party_id', '=', customerPartyId)
			.where('document.document_kind', '=', 'invoice')
			.where('document.lifecycle_status', '=', 'issued')
			.orderBy('document.id', 'asc')
			.forUpdate()
			.execute();
	}

	private publicCase(row: Awaited<ReturnType<CollectionsService['activeCase']>>): CollectionCaseSummary | null {
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.public_id,
			customerPartyId: row.customer_party_id,
			status: asCaseStatus(row.status),
			assignedMemberId: row.assigned_member_id,
			openedAt: row.opened_at,
			closedAt: row.closed_at,
			closeReason: row.close_reason
		};
	}

	private async caseByPublicId(db: DatabaseExecutor, actor: TenantActorContext, casePublicId: string, lock = false) {
		let query = db
			.selectFrom('receivable_collection_cases')
			.selectAll()
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', casePublicId);
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		if (!row) throw new RecordNotFoundError('Collections case not found.');
		return row;
	}

	private async appendAction(
		db: DatabaseExecutor,
		input: {
			organisationId: string;
			caseId: string;
			actionType: CollectionActionType;
			recordedByMemberId: string;
			deliveryChannel?: string | null;
			invoiceDocumentId?: string | null;
			promiseToPayId?: string | null;
			disputeId?: string | null;
			subject?: string | null;
			messageBody?: string | null;
			outcome?: string | null;
		}
	): Promise<void> {
		await db
			.insertInto('receivable_collection_actions')
			.values({
				organisation_id: input.organisationId,
				public_id: this.publicIdFactory(),
				collection_case_id: input.caseId,
				action_type: input.actionType,
				delivery_channel: input.deliveryChannel ?? null,
				occurred_at: this.now(),
				recorded_by_member_id: input.recordedByMemberId,
				contact_party_id: null,
				invoice_document_id: input.invoiceDocumentId ?? null,
				promise_to_pay_id: input.promiseToPayId ?? null,
				dispute_id: input.disputeId ?? null,
				subject: input.subject ?? null,
				message_body: input.messageBody ?? null,
				outcome: input.outcome ?? null
			})
			.executeTakeFirstOrThrow();
	}

	private async audit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		memberId: string,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>
	) {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: memberId,
			projectId: null,
			actionKey,
			subjectType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary
		});
	}

	async getPortfolio(actor: TenantActorContext): Promise<CollectionsPortfolio> {
		await this.assertRead(actor);
		const receivables = await new ReceivablesReportingService(this.db, this.now).getPortfolio(actor);
		const accounts: CollectionsPortfolioAccount[] = [];
		for (const account of receivables.accounts) {
			const overdue = overduePositions(account.positions);
			if (overdue.length === 0) continue;
			const customer = await this.customerId(this.db, actor, account.customerPartyPublicId);
			accounts.push({
				customerPartyPublicId: account.customerPartyPublicId,
				customerDisplayName: account.customerDisplayName,
				customerAccountReference: account.customerAccountReference,
				overduePositions: overdue,
				activeCase: this.publicCase(await this.activeCase(this.db, actor.organisationId, customer.id))
			});
		}
		return { asOf: receivables.asOf, accounts };
	}

	async getWorkspace(actor: TenantActorContext, customerPartyPublicId: string): Promise<CollectionsWorkspace> {
		await this.assertRead(actor);
		const receivable = await new ReceivablesReportingService(this.db, this.now).getCustomerStatement(actor, customerPartyPublicId);
		const customer = await this.customerId(this.db, actor, customerPartyPublicId);
		const active = await this.activeCase(this.db, actor.organisationId, customer.id);
		let caseRow = active;
		if (!caseRow) {
			caseRow = await this.db
				.selectFrom('receivable_collection_cases')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('customer_party_id', '=', customer.id)
				.orderBy('opened_at', 'desc')
				.limit(1)
				.executeTakeFirst();
		}
		const policy = new FinanceAccessPolicy(this.db);
		const [caseDecision, actionDecision, promiseDecision, disputeDecision] = await Promise.all([
			policy.mutationDecision(actor, 'finance.collections.case.manage'),
			policy.mutationDecision(actor, 'finance.collections.action.record'),
			policy.mutationDecision(actor, 'finance.collections.promise.manage'),
			policy.mutationDecision(actor, 'finance.collections.dispute.manage')
		]);
		const isActive = Boolean(caseRow && caseRow.status !== 'closed');
		const actions: CollectionActionSummary[] = [];
		const promises: PromiseSummary[] = [];
		const disputes: DisputeSummary[] = [];
		if (caseRow) {
			const [actionRows, promiseRows, disputeRows] = await Promise.all([
				this.db
					.selectFrom('receivable_collection_actions as action')
					.leftJoin('financial_documents as invoice', (join) =>
						join.onRef('invoice.id', '=', 'action.invoice_document_id').onRef('invoice.organisation_id', '=', 'action.organisation_id')
					)
					.leftJoin('receivable_promises_to_pay as promise', (join) =>
						join.onRef('promise.id', '=', 'action.promise_to_pay_id').onRef('promise.organisation_id', '=', 'action.organisation_id')
					)
					.leftJoin('receivable_disputes as dispute', (join) =>
						join.onRef('dispute.id', '=', 'action.dispute_id').onRef('dispute.organisation_id', '=', 'action.organisation_id')
					)
					.select([
						'action.public_id as publicId', 'action.action_type as actionType', 'action.delivery_channel as deliveryChannel',
						'action.occurred_at as occurredAt', 'action.recorded_by_member_id as recordedByMemberId',
						'invoice.public_id as invoicePublicId', 'promise.public_id as promisePublicId', 'dispute.public_id as disputePublicId',
						'action.subject as subject', 'action.message_body as messageBody', 'action.outcome as outcome'
					])
					.where('action.organisation_id', '=', actor.organisationId)
					.where('action.collection_case_id', '=', caseRow.id)
					.orderBy('action.occurred_at', 'desc')
					.orderBy('action.id', 'desc')
					.execute(),
				this.db.selectFrom('receivable_promises_to_pay as promise')
					.leftJoin('financial_documents as invoice', (join) => join.onRef('invoice.id', '=', 'promise.invoice_document_id').onRef('invoice.organisation_id', '=', 'promise.organisation_id'))
					.select(['promise.public_id as publicId', 'invoice.public_id as invoicePublicId', 'promise.promised_amount as promisedAmount', 'promise.currency_code as currencyCode', 'promise.due_on as dueOn', 'promise.status as status', 'promise.recorded_at as recordedAt', 'promise.resolved_at as resolvedAt', 'promise.resolution_note as resolutionNote'])
					.where('promise.organisation_id', '=', actor.organisationId).where('promise.collection_case_id', '=', caseRow.id)
					.orderBy('promise.recorded_at', 'desc').execute(),
				this.db.selectFrom('receivable_disputes as dispute')
					.leftJoin('financial_documents as invoice', (join) => join.onRef('invoice.id', '=', 'dispute.invoice_document_id').onRef('invoice.organisation_id', '=', 'dispute.organisation_id'))
					.select(['dispute.public_id as publicId', 'invoice.public_id as invoicePublicId', 'dispute.disputed_amount as disputedAmount', 'dispute.currency_code as currencyCode', 'dispute.reason as reason', 'dispute.status as status', 'dispute.opened_at as openedAt', 'dispute.resolved_at as resolvedAt', 'dispute.resolution_note as resolutionNote'])
					.where('dispute.organisation_id', '=', actor.organisationId).where('dispute.collection_case_id', '=', caseRow.id)
					.orderBy('dispute.opened_at', 'desc').execute()
			]);
			actions.push(...actionRows.map((row) => ({ ...row, actionType: asActionType(row.actionType) })));
			promises.push(...promiseRows.map((row) => ({ ...row, status: asPromiseStatus(row.status) })));
			disputes.push(...disputeRows.map((row) => ({ ...row, status: asDisputeStatus(row.status) })));
		}
		const hasOverdue = receivable.aging.some((position) => position.invoices.some((invoice) => invoice.daysOverdue > 0));
		return {
			receivable,
			case: this.publicCase(caseRow),
			actions,
			promises,
			disputes,
			canStartCase: caseDecision.allowed && !isActive && hasOverdue,
			canManageCase: caseDecision.allowed && isActive,
			canRecordAction: actionDecision.allowed && isActive,
			canManagePromises: promiseDecision.allowed && isActive,
			canManageDisputes: disputeDecision.allowed && isActive
		};
	}

	async startCase(actor: TenantActorContext, customerPartyPublicId: string): Promise<{ publicId: string }> {
		await this.assertRead(actor);
		const receivable = await new ReceivablesReportingService(this.db, this.now).getCustomerStatement(actor, customerPartyPublicId);
		if (!receivable.aging.some((position) => position.invoices.some((invoice) => invoice.daysOverdue > 0))) {
			throw new FinanceValidationError('Collections can only start when the customer has an overdue receivable.');
		}
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.collections.case.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Collections case management is not permitted.');
			const customer = await this.customerId(trx, actor, customerPartyPublicId, true);
			const existing = await this.activeCase(trx, actor.organisationId, customer.id, true);
			if (existing) return { publicId: existing.public_id };
			await this.lockCustomerIssuedInvoices(trx, actor.organisationId, customer.id);
			const currentReceivable = await new ReceivablesReportingService(this.db, this.now).getCustomerStatement(actor, customerPartyPublicId);
			if (!currentReceivable.aging.some((position) => position.invoices.some((invoice) => invoice.daysOverdue > 0))) {
				throw new FinanceValidationError('Collections can only start when the customer has an overdue receivable.');
			}
			const publicId = this.publicIdFactory();
			const caseId = insertedId(await trx.insertInto('receivable_collection_cases').values({
				organisation_id: actor.organisationId,
				public_id: publicId,
				customer_party_id: customer.id,
				status: 'open',
				assigned_member_id: null,
				opened_by_member_id: membership.id,
				opened_at: this.now(),
				closed_by_member_id: null,
				closed_at: null,
				close_reason: null
			}).executeTakeFirstOrThrow());
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId, actionType: 'case_opened', recordedByMemberId: membership.id, subject: 'Collections case opened' });
			await this.audit(trx, actor, membership.id, 'finance.collections.case.opened', 'receivable_collection_case', publicId, { customerPartyPublicId });
			return { publicId };
		});
	}

	async setCaseStatus(actor: TenantActorContext, casePublicId: string, status: 'paused' | 'open' | 'closed', reason?: string | null): Promise<void> {
		const closeReason = status === 'closed' ? cleanFinanceText(reason, 1000, 'Close reason', true)! : null;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.collections.case.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Collections case management is not permitted.');
			const row = await this.caseByPublicId(trx, actor, casePublicId, true);
			if (row.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			if (status === 'closed') {
				const [promise, dispute] = await Promise.all([
					trx.selectFrom('receivable_promises_to_pay').select('id').where('organisation_id', '=', actor.organisationId).where('collection_case_id', '=', row.id).where('status', '=', 'open').executeTakeFirst(),
					trx.selectFrom('receivable_disputes').select('id').where('organisation_id', '=', actor.organisationId).where('collection_case_id', '=', row.id).where('status', '=', 'open').executeTakeFirst()
				]);
				if (promise || dispute) throw new FinanceValidationError('Resolve open promises and disputes before closing the collections case.');
			}
			if (status === row.status) return;
			await trx.updateTable('receivable_collection_cases').set(status === 'closed' ? {
				status, closed_by_member_id: membership.id, closed_at: this.now(), close_reason: closeReason
			} : { status, closed_by_member_id: null, closed_at: null, close_reason: null }).where('id', '=', row.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			const actionType: CollectionActionType = status === 'paused' ? 'case_paused' : status === 'open' ? 'case_resumed' : 'case_closed';
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: row.id, actionType, recordedByMemberId: membership.id, outcome: closeReason });
			await this.audit(trx, actor, membership.id, `finance.collections.case.${status}`, 'receivable_collection_case', row.public_id, { status, reason: closeReason });
		});
	}

	async recordAction(actor: TenantActorContext, input: { casePublicId: string; actionType: string; deliveryChannel?: string | null; subject?: string | null; messageBody?: string | null; outcome?: string | null }): Promise<void> {
		const actionType = input.actionType as CollectionActionType;
		if (!USER_ACTION_TYPES.has(actionType)) throw new FinanceValidationError('Collection action type is invalid.');
		const channel = cleanFinanceText(input.deliveryChannel, 24, 'Delivery channel');
		if (channel && !DELIVERY_CHANNELS.has(channel)) throw new FinanceValidationError('Delivery channel is invalid.');
		const subject = cleanFinanceText(input.subject, 255, 'Subject');
		const messageBody = cleanFinanceText(input.messageBody, 10000, 'Message or note', true)!;
		const outcome = cleanFinanceText(input.outcome, 1000, 'Outcome');
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.collections.action.record', trx);
			if (!decision.allowed) throw new TenantAccessError('Recording collection actions is not permitted.');
			const row = await this.caseByPublicId(trx, actor, input.casePublicId, true);
			if (row.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: row.id, actionType, recordedByMemberId: membership.id, deliveryChannel: channel, subject, messageBody, outcome });
			await this.audit(trx, actor, membership.id, 'finance.collections.action.recorded', 'receivable_collection_case', row.public_id, { actionType, deliveryChannel: channel, subject });
		});
	}

	private async invoiceForCustomer(db: DatabaseExecutor, actor: TenantActorContext, caseRow: { customer_party_id: string }, invoicePublicIdInput?: string | null) {
		const publicId = cleanFinanceText(invoicePublicIdInput, 64, 'Invoice');
		if (!publicId) return null;
		const row = await db.selectFrom('financial_documents as document').innerJoin('invoices as invoice', (join) => join.onRef('invoice.financial_document_id', '=', 'document.id').onRef('invoice.organisation_id', '=', 'document.organisation_id'))
			.select(['document.id', 'document.public_id as publicId', 'document.currency_code as currencyCode'])
			.where('document.organisation_id', '=', actor.organisationId).where('document.public_id', '=', publicId).where('document.customer_party_id', '=', caseRow.customer_party_id).where('document.document_kind', '=', 'invoice').executeTakeFirst();
		if (!row) throw new RecordNotFoundError('Invoice not found for this customer account.');
		return row;
	}

	async recordPromise(actor: TenantActorContext, input: { casePublicId: string; invoicePublicId?: string | null; amount: string; currencyCode: string; dueOn: string }): Promise<{ publicId: string }> {
		const amount = validateMoneyAmount(input.amount, 'Promised amount');
		const currencyCode = validateCurrencyCode(input.currencyCode, 'Promise currency');
		if (!currencyCode) throw new FinanceValidationError('Promise currency is required.');
		const dueOn = validateFinanceDate(input.dueOn, 'Promise due date');
		if (!dueOn) throw new FinanceValidationError('Promise due date is required.');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx);
			const membership = await policy.assertActiveActor(actor, trx);
			const decision = await policy.mutationDecision(actor, 'finance.collections.promise.manage', trx);
			if (!decision.allowed) throw new TenantAccessError('Promise-to-pay management is not permitted.');
			const caseRow = await this.caseByPublicId(trx, actor, input.casePublicId, true);
			if (caseRow.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			const invoice = await this.invoiceForCustomer(trx, actor, caseRow, input.invoicePublicId);
			if (invoice && invoice.currencyCode !== currencyCode) throw new FinanceValidationError('Promise currency must match the linked invoice currency.');
			const publicId = this.publicIdFactory();
			const promiseId = insertedId(await trx.insertInto('receivable_promises_to_pay').values({ organisation_id: actor.organisationId, public_id: publicId, collection_case_id: caseRow.id, invoice_document_id: invoice?.id ?? null, promised_amount: amount, currency_code: currencyCode, due_on: dueOn, status: 'open', recorded_by_member_id: membership.id, recorded_at: this.now(), resolved_by_member_id: null, resolved_at: null, resolution_note: null }).executeTakeFirstOrThrow());
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: caseRow.id, actionType: 'promise_recorded', recordedByMemberId: membership.id, invoiceDocumentId: invoice?.id ?? null, promiseToPayId: promiseId, subject: `Promise to pay ${amount} ${currencyCode}` });
			await this.audit(trx, actor, membership.id, 'finance.collections.promise.recorded', 'receivable_promise_to_pay', publicId, { casePublicId: caseRow.public_id, invoicePublicId: invoice?.publicId ?? null, amount, currencyCode, dueOn: input.dueOn });
			return { publicId };
		});
	}

	async resolvePromise(actor: TenantActorContext, input: { casePublicId: string; promisePublicId: string; status: 'kept' | 'broken' | 'cancelled'; note: string }): Promise<void> {
		const note = cleanFinanceText(input.note, 1000, 'Resolution note', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx); const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.collections.promise.manage', trx)).allowed) throw new TenantAccessError('Promise-to-pay management is not permitted.');
			const caseRow = await this.caseByPublicId(trx, actor, input.casePublicId, true);
			if (caseRow.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			const promise = await trx.selectFrom('receivable_promises_to_pay').selectAll().where('organisation_id', '=', actor.organisationId).where('collection_case_id', '=', caseRow.id).where('public_id', '=', input.promisePublicId).forUpdate().executeTakeFirst();
			if (!promise) throw new RecordNotFoundError('Promise to pay not found.');
			if (promise.status !== 'open') throw new FinanceValidationError('Only an open promise can be resolved.');
			await trx.updateTable('receivable_promises_to_pay').set({ status: input.status, resolved_by_member_id: membership.id, resolved_at: this.now(), resolution_note: note }).where('id', '=', promise.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			const actionType = `promise_${input.status}` as CollectionActionType;
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: caseRow.id, actionType, recordedByMemberId: membership.id, invoiceDocumentId: promise.invoice_document_id, promiseToPayId: promise.id, outcome: note });
			await this.audit(trx, actor, membership.id, `finance.collections.promise.${input.status}`, 'receivable_promise_to_pay', promise.public_id, { note });
		});
	}

	async openDispute(actor: TenantActorContext, input: { casePublicId: string; invoicePublicId?: string | null; disputedAmount?: string | null; currencyCode?: string | null; reason: string }): Promise<{ publicId: string }> {
		const reason = cleanFinanceText(input.reason, 10000, 'Dispute reason', true)!;
		const hasAmount = Boolean(input.disputedAmount?.trim());
		const amount = hasAmount ? validateMoneyAmount(input.disputedAmount!, 'Disputed amount') : null;
		const currencyCode = hasAmount ? validateCurrencyCode(input.currencyCode, 'Dispute currency') : null;
		if (hasAmount && !currencyCode) throw new FinanceValidationError('Dispute currency is required when an amount is supplied.');
		return this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx); const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.collections.dispute.manage', trx)).allowed) throw new TenantAccessError('Receivable dispute management is not permitted.');
			const caseRow = await this.caseByPublicId(trx, actor, input.casePublicId, true);
			if (caseRow.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			const invoice = await this.invoiceForCustomer(trx, actor, caseRow, input.invoicePublicId);
			if (invoice && currencyCode && invoice.currencyCode !== currencyCode) throw new FinanceValidationError('Dispute currency must match the linked invoice currency.');
			const publicId = this.publicIdFactory();
			const disputeId = insertedId(await trx.insertInto('receivable_disputes').values({ organisation_id: actor.organisationId, public_id: publicId, collection_case_id: caseRow.id, invoice_document_id: invoice?.id ?? null, disputed_amount: amount, currency_code: currencyCode, reason, status: 'open', opened_by_member_id: membership.id, opened_at: this.now(), resolved_by_member_id: null, resolved_at: null, resolution_note: null }).executeTakeFirstOrThrow());
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: caseRow.id, actionType: 'dispute_opened', recordedByMemberId: membership.id, invoiceDocumentId: invoice?.id ?? null, disputeId, subject: 'Receivable dispute opened', messageBody: reason });
			await this.audit(trx, actor, membership.id, 'finance.collections.dispute.opened', 'receivable_dispute', publicId, { casePublicId: caseRow.public_id, invoicePublicId: invoice?.publicId ?? null, disputedAmount: amount, currencyCode });
			return { publicId };
		});
	}

	async resolveDispute(actor: TenantActorContext, input: { casePublicId: string; disputePublicId: string; status: 'resolved' | 'withdrawn'; note: string }): Promise<void> {
		const note = cleanFinanceText(input.note, 1000, 'Resolution note', true)!;
		await this.db.transaction().execute(async (trx) => {
			const policy = new FinanceAccessPolicy(trx); const membership = await policy.assertActiveActor(actor, trx);
			if (!(await policy.mutationDecision(actor, 'finance.collections.dispute.manage', trx)).allowed) throw new TenantAccessError('Receivable dispute management is not permitted.');
			const caseRow = await this.caseByPublicId(trx, actor, input.casePublicId, true);
			if (caseRow.status === 'closed') throw new FinanceValidationError('Closed collections cases are immutable.');
			const dispute = await trx.selectFrom('receivable_disputes').selectAll().where('organisation_id', '=', actor.organisationId).where('collection_case_id', '=', caseRow.id).where('public_id', '=', input.disputePublicId).forUpdate().executeTakeFirst();
			if (!dispute) throw new RecordNotFoundError('Receivable dispute not found.');
			if (dispute.status !== 'open') throw new FinanceValidationError('Only an open dispute can be resolved.');
			await trx.updateTable('receivable_disputes').set({ status: input.status, resolved_by_member_id: membership.id, resolved_at: this.now(), resolution_note: note }).where('id', '=', dispute.id).where('organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			const actionType = input.status === 'resolved' ? 'dispute_resolved' : 'dispute_withdrawn';
			await this.appendAction(trx, { organisationId: actor.organisationId, caseId: caseRow.id, actionType, recordedByMemberId: membership.id, invoiceDocumentId: dispute.invoice_document_id, disputeId: dispute.id, outcome: note });
			await this.audit(trx, actor, membership.id, `finance.collections.dispute.${input.status}`, 'receivable_dispute', dispute.public_id, { note });
		});
	}
}
