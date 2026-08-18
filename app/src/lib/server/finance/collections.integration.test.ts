import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CollectionsService } from './collections-service';
import { FinanceValidationError } from './finance-common';
import { ReceivablesReportingService } from './receivables-reporting-service';

const PREFIX = 'Collections Integration ';
const NOW = new Date('2026-08-17T12:00:00.000Z');

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let financeAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let financeAMemberId = '';
let ownerBMemberId = '';
let customerPartyId = '';
let customerPartyPublicId = '';
let secondCustomerPartyId = '';
let futureCustomerPublicId = '';
let foreignCustomerPublicId = '';
let invoicePublicId = '';
let secondCustomerInvoicePublicId = '';
let activeCasePublicId = '';
let openPromisePublicId = '';
let openDisputePublicId = '';
let salesItemTypeId = 0;
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorOwnerB: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
	await db
		.deleteFrom('receivable_collection_actions')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('receivable_promises_to_pay').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_disputes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_collection_cases').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payments').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('financial_document_issue_recipients')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('financial_document_issue_events')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('financial_document_item_taxes')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('credit_notes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_billing_settings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${name}`,
				default_currency_code: 'GBP',
				default_timezone: 'Europe/London',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-05-01T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignRole(
	organisationId: string,
	memberId: string,
	name: string,
	permissionKeys: string[]
) {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${name}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

async function createCustomer(
	organisationId: string,
	memberId: string,
	name: string
): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: publicId,
				party_kind: 'organisation',
				account_owner_member_id: memberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: id,
			organisation_id: organisationId,
			legal_name: `${PREFIX}${name}`,
			trading_name: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_billing_settings')
		.values({
			party_id: id,
			organisation_id: organisationId,
			default_payment_term_id: null,
			default_currency_code: 'GBP',
			customer_account_reference: `COL-${id}`,
			purchase_order_required: 0
		})
		.executeTakeFirstOrThrow();
	return { id, publicId };
}

async function createIssuedInvoice(input: {
	organisationId: string;
	customerId: string;
	memberId: string;
	number: string;
	amount: string;
	dueOn: string;
	issuedAt: string;
	currency?: string;
}): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: input.organisationId,
				public_id: publicId,
				document_kind: 'invoice',
				document_number: input.number,
				customer_party_id: input.customerId,
				billing_contact_party_id: null,
				project_id: null,
				contract_id: null,
				currency_code: input.currency ?? 'GBP',
				lifecycle_status: 'issued',
				created_by_member_id: input.memberId,
				voided_by_member_id: null,
				voided_at: null,
				void_reason: null
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('invoices')
		.values({
			financial_document_id: id,
			organisation_id: input.organisationId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: new Date(`${input.dueOn}T00:00:00.000Z`),
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_items')
		.values({
			organisation_id: input.organisationId,
			financial_document_id: id,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemTypeId,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: `${PREFIX}${input.number}`,
			quantity: '1.000000',
			unit_rate: input.amount
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_issue_events')
		.values({
			organisation_id: input.organisationId,
			financial_document_id: id,
			issue_sequence: 1,
			issued_by_member_id: input.memberId,
			delivery_channel: 'manual',
			issued_at: new Date(input.issuedAt),
			note: null
		})
		.executeTakeFirstOrThrow();
	return { id, publicId };
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	financeAUserId = await createUser('Finance A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	financeAMemberId = await createMember(organisationAId, financeAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', ['finance.view', 'finance.manage']);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', [
		'finance.view',
		'finance.collections.view',
		'finance.collections.case.manage',
		'finance.collections.action.record',
		'finance.collections.promise.manage',
		'finance.collections.dispute.manage'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
	actorOwnerA = {
		organisationId: organisationAId,
		userId: ownerAUserId,
		memberId: ownerAMemberId,
		correlationId: randomUUID()
	};
	actorFinanceA = {
		organisationId: organisationAId,
		userId: financeAUserId,
		memberId: financeAMemberId,
		correlationId: randomUUID()
	};
	actorOwnerB = {
		organisationId: organisationBId,
		userId: ownerBUserId,
		memberId: ownerBMemberId,
		correlationId: randomUUID()
	};
	salesItemTypeId = (
		await db
			.selectFrom('sales_item_types')
			.select('id')
			.where('is_active', '=', 1)
			.orderBy('id', 'asc')
			.executeTakeFirstOrThrow()
	).id;
	const customer = await createCustomer(organisationAId, ownerAMemberId, 'Client Ltd');
	customerPartyId = customer.id;
	customerPartyPublicId = customer.publicId;
	const secondCustomer = await createCustomer(organisationAId, ownerAMemberId, 'Other Client Ltd');
	secondCustomerPartyId = secondCustomer.id;
	futureCustomerPublicId = (
		await createCustomer(organisationAId, ownerAMemberId, 'Future Due Client Ltd')
	).publicId;
	foreignCustomerPublicId = (
		await createCustomer(organisationBId, ownerBMemberId, 'Foreign Client Ltd')
	).publicId;
	invoicePublicId = (
		await createIssuedInvoice({
			organisationId: organisationAId,
			customerId: customerPartyId,
			memberId: ownerAMemberId,
			number: 'INV-COL-001',
			amount: '120.0000',
			dueOn: '2026-06-01',
			issuedAt: '2026-05-01T09:00:00.000Z'
		})
	).publicId;
	secondCustomerInvoicePublicId = (
		await createIssuedInvoice({
			organisationId: organisationAId,
			customerId: secondCustomerPartyId,
			memberId: ownerAMemberId,
			number: 'INV-COL-002',
			amount: '80.0000',
			dueOn: '2026-06-15',
			issuedAt: '2026-05-15T09:00:00.000Z'
		})
	).publicId;
	const futureCustomer = await db
		.selectFrom('parties')
		.select('id')
		.where('organisation_id', '=', organisationAId)
		.where('public_id', '=', futureCustomerPublicId)
		.executeTakeFirstOrThrow();
	await createIssuedInvoice({
		organisationId: organisationAId,
		customerId: futureCustomer.id,
		memberId: ownerAMemberId,
		number: 'INV-COL-FUTURE',
		amount: '50.0000',
		dueOn: '2026-09-30',
		issuedAt: '2026-08-01T09:00:00.000Z'
	});
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004G controlled collections and dunning', () => {
	it('lists only overdue accounts and opens one idempotent active collections case with immutable opening evidence', async () => {
		const service = new CollectionsService(db, randomUUID, () => NOW);
		const portfolio = await service.getPortfolio(actorFinanceA);
		expect(portfolio.accounts.map((account) => account.customerPartyPublicId)).toContain(
			customerPartyPublicId
		);
		expect(portfolio.accounts.map((account) => account.customerPartyPublicId)).not.toContain(
			futureCustomerPublicId
		);
		const first = await service.startCase(actorFinanceA, customerPartyPublicId);
		const retry = await service.startCase(actorFinanceA, customerPartyPublicId);
		expect(retry.publicId).toBe(first.publicId);
		activeCasePublicId = first.publicId;
		const workspace = await service.getWorkspace(actorFinanceA, customerPartyPublicId);
		expect(workspace.case).toMatchObject({ publicId: activeCasePublicId, status: 'open' });
		expect(workspace.actions.filter((action) => action.actionType === 'case_opened')).toHaveLength(
			1
		);
	});

	it('records immutable collection evidence and promise lifecycle without changing the receivable ledger', async () => {
		const service = new CollectionsService(db, randomUUID, () => NOW);
		const before = await new ReceivablesReportingService(db, () => NOW).getCustomerStatement(
			actorFinanceA,
			customerPartyPublicId
		);
		await service.recordAction(actorFinanceA, {
			casePublicId: activeCasePublicId,
			actionType: 'reminder',
			deliveryChannel: 'email',
			subject: 'Invoice overdue',
			messageBody: 'Please arrange payment.',
			outcome: 'Reminder recorded for delivery evidence.'
		});
		openPromisePublicId = (
			await service.recordPromise(actorFinanceA, {
				casePublicId: activeCasePublicId,
				invoicePublicId,
				amount: '60',
				currencyCode: 'GBP',
				dueOn: '2026-08-24'
			})
		).publicId;
		await expect(
			service.setCaseStatus(actorFinanceA, activeCasePublicId, 'closed', 'Paid')
		).rejects.toThrow('Resolve open promises and disputes');
		await service.resolvePromise(actorFinanceA, {
			casePublicId: activeCasePublicId,
			promisePublicId: openPromisePublicId,
			status: 'kept',
			note: 'Customer confirmed transfer.'
		});
		const workspace = await service.getWorkspace(actorFinanceA, customerPartyPublicId);
		expect(workspace.promises[0]).toMatchObject({
			publicId: openPromisePublicId,
			status: 'kept',
			promisedAmount: '60.0000',
			currencyCode: 'GBP'
		});
		expect(workspace.actions.some((action) => action.actionType === 'reminder')).toBe(true);
		expect(workspace.actions.some((action) => action.actionType === 'promise_kept')).toBe(true);
		const after = await new ReceivablesReportingService(db, () => NOW).getCustomerStatement(
			actorFinanceA,
			customerPartyPublicId
		);
		expect(after.aging[0]?.totalOutstanding).toBe(before.aging[0]?.totalOutstanding);
	});

	it('enforces same-customer invoice context for promises and disputes, and records dispute resolution evidence', async () => {
		const service = new CollectionsService(db, randomUUID, () => NOW);
		await expect(
			service.recordPromise(actorFinanceA, {
				casePublicId: activeCasePublicId,
				invoicePublicId: secondCustomerInvoicePublicId,
				amount: '10',
				currencyCode: 'GBP',
				dueOn: '2026-08-25'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(
			service.openDispute(actorFinanceA, {
				casePublicId: activeCasePublicId,
				invoicePublicId: secondCustomerInvoicePublicId,
				disputedAmount: '10',
				currencyCode: 'GBP',
				reason: 'Wrong customer invoice'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
		openDisputePublicId = (
			await service.openDispute(actorFinanceA, {
				casePublicId: activeCasePublicId,
				invoicePublicId,
				disputedAmount: '20',
				currencyCode: 'GBP',
				reason: 'Customer challenges part of the charge.'
			})
		).publicId;
		await expect(
			service.setCaseStatus(actorFinanceA, activeCasePublicId, 'closed', 'Resolved')
		).rejects.toThrow('Resolve open promises and disputes');
		await service.resolveDispute(actorFinanceA, {
			casePublicId: activeCasePublicId,
			disputePublicId: openDisputePublicId,
			status: 'resolved',
			note: 'Supporting records accepted by customer.'
		});
		const workspace = await service.getWorkspace(actorFinanceA, customerPartyPublicId);
		expect(workspace.disputes[0]).toMatchObject({
			publicId: openDisputePublicId,
			status: 'resolved',
			disputedAmount: '20.0000',
			currencyCode: 'GBP'
		});
		expect(workspace.actions.some((action) => action.actionType === 'dispute_resolved')).toBe(true);
	});

	it('lets an explicit granular deny override the finance.manage umbrella', async () => {
		const permission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.collections.case.manage')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: ownerAMemberId,
				permission_id: permission.id,
				effect: 'deny'
			})
			.executeTakeFirstOrThrow();
		const service = new CollectionsService(db, randomUUID, () => NOW);
		await expect(
			service.setCaseStatus(actorOwnerA, activeCasePublicId, 'paused')
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', permission.id)
			.execute();
		await service.setCaseStatus(actorOwnerA, activeCasePublicId, 'paused');
		let workspace = await service.getWorkspace(actorOwnerA, customerPartyPublicId);
		expect(workspace.case?.status).toBe('paused');
		await service.setCaseStatus(actorOwnerA, activeCasePublicId, 'open');
		workspace = await service.getWorkspace(actorOwnerA, customerPartyPublicId);
		expect(workspace.case?.status).toBe('open');
	});

	it('closes only after commitments and disputes are resolved, while preserving historical collection evidence', async () => {
		const service = new CollectionsService(db, randomUUID, () => NOW);
		await service.setCaseStatus(
			actorFinanceA,
			activeCasePublicId,
			'closed',
			'Collections activity complete.'
		);
		const workspace = await service.getWorkspace(actorFinanceA, customerPartyPublicId);
		expect(workspace.case).toMatchObject({
			status: 'closed',
			closeReason: 'Collections activity complete.'
		});
		expect(workspace.actions.some((action) => action.actionType === 'case_closed')).toBe(true);
		await expect(
			service.recordAction(actorFinanceA, {
				casePublicId: activeCasePublicId,
				actionType: 'note',
				messageBody: 'Should not mutate closed case.'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('rejects case creation without an overdue receivable and masks foreign-tenant customer identities', async () => {
		const service = new CollectionsService(db, randomUUID, () => NOW);
		await expect(service.startCase(actorFinanceA, futureCustomerPublicId)).rejects.toThrow(
			'overdue receivable'
		);
		await expect(service.getWorkspace(actorOwnerB, customerPartyPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
		await expect(service.getWorkspace(actorOwnerA, foreignCustomerPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});

	it('requires collections read authority in addition to finance.view', async () => {
		const userId = await createUser('Finance View Only');
		const memberId = await createMember(organisationAId, userId);
		await assignRole(organisationAId, memberId, 'Finance View Only', ['finance.view']);
		const actor: TenantActorContext = {
			organisationId: organisationAId,
			userId,
			memberId,
			correlationId: randomUUID()
		};
		await expect(
			new CollectionsService(db, randomUUID, () => NOW).getPortfolio(actor)
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
