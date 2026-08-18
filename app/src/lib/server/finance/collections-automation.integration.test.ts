import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CollectionsAutomationService } from './collections-automation-service';
import { CollectionsService } from './collections-service';
import { FinanceValidationError } from './finance-common';
import { ReceivablesReportingService } from './receivables-reporting-service';

const PREFIX = 'Collections Automation Integration ';
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
let invoiceDocumentId = '';
let activeCasePublicId = '';
let activePolicyPublicId = '';
let stageOnePublicId = '';
let stageTwoPublicId = '';
let firstReminderPublicId = '';
let secondReminderPublicId = '';
let salesItemTypeId = 0;
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorOwnerB: TenantActorContext;
let failDelivery = false;
const deliveredMessages: TransactionalEmail[] = [];

const fakeDelivery: EmailDelivery = {
	async send(message) {
		deliveredMessages.push(message);
		if (failDelivery) throw new Error('Provider unavailable for integration test.');
	}
};

function automationService() {
	return new CollectionsAutomationService(
		db,
		randomUUID,
		() => NOW,
		() => fakeDelivery
	);
}

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
		.deleteFrom('receivable_collection_reminder_deliveries')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('receivable_collection_reminders')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('receivable_collection_policy_stages')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('receivable_collection_policies')
		.where('organisation_id', 'in', ids)
		.execute();
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
	await db.deleteFrom('party_email_addresses').where('organisation_id', 'in', ids).execute();
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

async function createCustomer(): Promise<void> {
	customerPartyPublicId = randomUUID();
	customerPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: customerPartyPublicId,
				party_kind: 'organisation',
				account_owner_member_id: ownerAMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: customerPartyId,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}Client Ltd`,
			trading_name: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('party_billing_settings')
		.values({
			party_id: customerPartyId,
			organisation_id: organisationAId,
			default_payment_term_id: null,
			default_currency_code: 'GBP',
			customer_account_reference: 'AUT-001',
			purchase_order_required: 0
		})
		.executeTakeFirstOrThrow();
	// `primary_party_id` is a MySQL generated column; kysely-codegen does not currently model that expression as Generated.
	await db
		.insertInto('party_email_addresses')
		.values({
			party_id: customerPartyId,
			organisation_id: organisationAId,
			email: 'accounts@example.test',
			label: 'Accounts',
			is_primary: 1,
			is_verified: 1
		} as never)
		.executeTakeFirstOrThrow();
}

async function createIssuedInvoice(): Promise<void> {
	const publicId = randomUUID();
	invoiceDocumentId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationAId,
				public_id: publicId,
				document_kind: 'invoice',
				document_number: 'INV-AUT-001',
				customer_party_id: customerPartyId,
				billing_contact_party_id: null,
				project_id: null,
				contract_id: null,
				currency_code: 'GBP',
				lifecycle_status: 'issued',
				created_by_member_id: ownerAMemberId,
				voided_by_member_id: null,
				voided_at: null,
				void_reason: null
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('invoices')
		.values({
			financial_document_id: invoiceDocumentId,
			organisation_id: organisationAId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: new Date('2026-06-01T00:00:00.000Z'),
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_items')
		.values({
			organisation_id: organisationAId,
			financial_document_id: invoiceDocumentId,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemTypeId,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: `${PREFIX}Invoice`,
			quantity: '1.000000',
			unit_rate: '120.0000'
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_issue_events')
		.values({
			organisation_id: organisationAId,
			financial_document_id: invoiceDocumentId,
			issue_sequence: 1,
			issued_by_member_id: ownerAMemberId,
			delivery_channel: 'manual',
			issued_at: new Date('2026-05-01T09:00:00.000Z'),
			note: null
		})
		.executeTakeFirstOrThrow();
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
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', [
		'finance.view',
		'finance.manage',
		'crm.view'
	]);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', [
		'finance.view',
		'crm.view',
		'finance.collections.view',
		'finance.collections.case.manage',
		'finance.collections.promise.manage',
		'finance.collections.dispute.manage',
		'finance.collections.reminder.generate',
		'finance.collections.reminder.dispatch'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', [
		'finance.view',
		'finance.manage',
		'crm.view'
	]);
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
	await createCustomer();
	await createIssuedInvoice();
	activeCasePublicId = (
		await new CollectionsService(db, randomUUID, () => NOW).startCase(
			actorOwnerA,
			customerPartyPublicId
		)
	).publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004H collections automation policy', () => {
	it('keeps policy authoring stronger than ordinary reminder generation/dispatch delegation', async () => {
		const service = automationService();
		await expect(
			service.createDraftPolicy(actorFinanceA, 'Unauthorised policy')
		).rejects.toBeInstanceOf(TenantAccessError);
		activePolicyPublicId = await service.createDraftPolicy(
			actorOwnerA,
			'Standard collections policy'
		);
		stageOnePublicId = await service.saveDraftStage(actorOwnerA, {
			policyPublicId: activePolicyPublicId,
			sequenceNumber: 1,
			name: 'First reminder',
			triggerDaysOverdue: 30,
			subjectTemplate: 'Payment reminder for {{customer_name}}',
			bodyTemplate:
				'{{customer_name}} has {{invoice_count}} overdue invoice(s), oldest {{days_overdue}} days overdue.',
			suppressOnOpenDispute: true,
			suppressOnCurrentPromise: true
		});
		stageTwoPublicId = await service.saveDraftStage(actorOwnerA, {
			policyPublicId: activePolicyPublicId,
			sequenceNumber: 2,
			name: 'Second reminder',
			triggerDaysOverdue: 60,
			subjectTemplate: 'Second payment reminder for {{customer_name}}',
			bodyTemplate: 'Account {{account_reference}} remains overdue as at {{as_of_date}}.',
			suppressOnOpenDispute: true,
			suppressOnCurrentPromise: true
		});
		await service.activatePolicy(actorOwnerA, activePolicyPublicId);
		const workspace = await service.getWorkspace(actorFinanceA);
		expect(workspace.activePolicy).toMatchObject({
			publicId: activePolicyPublicId,
			versionNumber: 1,
			status: 'active'
		});
		expect(workspace.activePolicy?.stages.map((stage) => stage.publicId)).toEqual([
			stageOnePublicId,
			stageTwoPublicId
		]);
		expect(workspace.canManagePolicy).toBe(false);
		expect(workspace.canGenerateReminders).toBe(true);
		expect(workspace.canDispatchReminders).toBe(true);
	});

	it('freezes activated policy versions and opens the next draft as a new version', async () => {
		const service = automationService();
		await expect(
			service.saveDraftStage(actorOwnerA, {
				policyPublicId: activePolicyPublicId,
				sequenceNumber: 3,
				name: 'Illegal active edit',
				triggerDaysOverdue: 90,
				subjectTemplate: 'Do not save',
				bodyTemplate: 'Do not save',
				suppressOnOpenDispute: true,
				suppressOnCurrentPromise: true
			})
		).rejects.toThrow('Only draft collections policies can be edited');
		const draftPublicId = await service.createDraftPolicy(actorOwnerA, 'Next collections policy');
		const workspace = await service.getWorkspace(actorOwnerA);
		expect(workspace.draftPolicy).toMatchObject({
			publicId: draftPublicId,
			versionNumber: 2,
			status: 'draft'
		});
	});

	it('derives threshold candidates from live overdue receivables and snapshots a reminder idempotently without touching the ledger', async () => {
		const service = automationService();
		const before = await new ReceivablesReportingService(db, () => NOW).getCustomerStatement(
			actorFinanceA,
			customerPartyPublicId
		);
		const workspace = await service.getWorkspace(actorFinanceA);
		const candidate = workspace.dueReminders.find(
			(item) => item.stagePublicId === stageOnePublicId
		);
		expect(candidate).toMatchObject({
			customerPartyPublicId,
			canGenerate: true,
			recipient: { email: 'accounts@example.test' }
		});
		firstReminderPublicId = await service.generateReminder(
			actorFinanceA,
			activeCasePublicId,
			stageOnePublicId
		);
		const retry = await service.generateReminder(
			actorFinanceA,
			activeCasePublicId,
			stageOnePublicId
		);
		expect(retry).toBe(firstReminderPublicId);
		const reminder = await db
			.selectFrom('receivable_collection_reminders')
			.select([
				'status',
				'recipient_email as recipientEmail',
				'subject',
				'message_body as messageBody'
			])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', firstReminderPublicId)
			.executeTakeFirstOrThrow();
		expect(reminder).toMatchObject({
			status: 'pending',
			recipientEmail: 'accounts@example.test',
			subject: `Payment reminder for ${PREFIX}Client Ltd`
		});
		expect(reminder.messageBody).toContain('77 days overdue');
		const reminderActions = await db
			.selectFrom('receivable_collection_actions')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('action_type', '=', 'reminder')
			.execute();
		expect(reminderActions).toHaveLength(0);
		const after = await new ReceivablesReportingService(db, () => NOW).getCustomerStatement(
			actorFinanceA,
			customerPartyPublicId
		);
		expect(after.aging[0]?.totalOutstanding).toBe(before.aging[0]?.totalOutstanding);
	});

	it('preserves explicit granular deny precedence over the finance umbrella at dispatch', async () => {
		const permission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.collections.reminder.dispatch')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: ownerAMemberId,
				permission_id: permission.id,
				effect: 'deny',
				reason: 'Integration deny precedence'
			})
			.executeTakeFirstOrThrow();
		await expect(
			automationService().dispatchReminder(actorOwnerA, firstReminderPublicId)
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', permission.id)
			.execute();
	});

	it('records failed delivery attempts, keeps the snapshot retryable, then records successful dispatch once', async () => {
		failDelivery = true;
		let result = await automationService().dispatchReminder(actorFinanceA, firstReminderPublicId);
		expect(result).toMatchObject({
			sent: false,
			errorMessage: 'Provider unavailable for integration test.'
		});
		let reminder = await db
			.selectFrom('receivable_collection_reminders')
			.select(['id', 'status', 'sent_at as sentAt'])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', firstReminderPublicId)
			.executeTakeFirstOrThrow();
		expect(reminder).toMatchObject({ status: 'pending', sentAt: null });
		let attempts = await db
			.selectFrom('receivable_collection_reminder_deliveries')
			.select(['attempt_number as attemptNumber', 'outcome'])
			.where('organisation_id', '=', organisationAId)
			.where('reminder_id', '=', reminder.id)
			.orderBy('attempt_number')
			.execute();
		expect(attempts).toEqual([{ attemptNumber: 1, outcome: 'failed' }]);
		failDelivery = false;
		result = await automationService().dispatchReminder(actorFinanceA, firstReminderPublicId);
		expect(result).toEqual({ sent: true, errorMessage: null });
		reminder = await db
			.selectFrom('receivable_collection_reminders')
			.select(['id', 'status', 'sent_at as sentAt'])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', firstReminderPublicId)
			.executeTakeFirstOrThrow();
		expect(reminder.status).toBe('sent');
		expect(reminder.sentAt).not.toBeNull();
		attempts = await db
			.selectFrom('receivable_collection_reminder_deliveries')
			.select(['attempt_number as attemptNumber', 'outcome'])
			.where('organisation_id', '=', organisationAId)
			.where('reminder_id', '=', reminder.id)
			.orderBy('attempt_number')
			.execute();
		expect(attempts).toEqual([
			{ attemptNumber: 1, outcome: 'failed' },
			{ attemptNumber: 2, outcome: 'sent' }
		]);
		expect(deliveredMessages.slice(-2).map((message) => message.idempotencyKey)).toEqual([
			firstReminderPublicId,
			firstReminderPublicId
		]);
		const actions = await db
			.selectFrom('receivable_collection_actions')
			.select(['action_type as actionType', 'delivery_channel as deliveryChannel'])
			.where('organisation_id', '=', organisationAId)
			.where('action_type', '=', 'reminder')
			.execute();
		expect(actions).toEqual([{ actionType: 'reminder', deliveryChannel: 'email' }]);
	});

	it('suppresses future-stage generation for a current promise and surfaces overdue promises for review', async () => {
		const collections = new CollectionsService(db, randomUUID, () => NOW);
		const currentPromise = await collections.recordPromise(actorFinanceA, {
			casePublicId: activeCasePublicId,
			amount: '50',
			currencyCode: 'GBP',
			dueOn: '2026-08-24'
		});
		let workspace = await automationService().getWorkspace(actorFinanceA);
		const blocked = workspace.dueReminders.find((item) => item.stagePublicId === stageTwoPublicId);
		expect(blocked?.blockedReasons).toContain('Current promise to pay');
		await collections.resolvePromise(actorFinanceA, {
			casePublicId: activeCasePublicId,
			promisePublicId: currentPromise.publicId,
			status: 'cancelled',
			note: 'Customer replaced the promise.'
		});
		const overduePromise = await collections.recordPromise(actorFinanceA, {
			casePublicId: activeCasePublicId,
			amount: '40',
			currencyCode: 'GBP',
			dueOn: '2026-08-10'
		});
		workspace = await automationService().getWorkspace(actorFinanceA);
		expect(workspace.promiseReviews).toContainEqual(
			expect.objectContaining({ promisePublicId: overduePromise.publicId, daysPastDue: 7 })
		);
		expect(
			workspace.dueReminders.find((item) => item.stagePublicId === stageTwoPublicId)?.canGenerate
		).toBe(true);
		secondReminderPublicId = await automationService().generateReminder(
			actorFinanceA,
			activeCasePublicId,
			stageTwoPublicId
		);
	});

	it('tenant-masks reminder identities and blocks dispatch while a case is paused', async () => {
		await expect(
			automationService().dispatchReminder(actorOwnerB, secondReminderPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
		const collections = new CollectionsService(db, randomUUID, () => NOW);
		await collections.setCaseStatus(actorFinanceA, activeCasePublicId, 'paused');
		await expect(
			automationService().dispatchReminder(actorFinanceA, secondReminderPublicId)
		).rejects.toThrow('Only reminders for an open collections case can be dispatched');
		await collections.setCaseStatus(actorFinanceA, activeCasePublicId, 'open');
	});

	it('revalidates the authoritative receivable immediately before dispatch and refuses a reminder after settlement state changes', async () => {
		await db
			.updateTable('financial_documents')
			.set({
				lifecycle_status: 'void',
				voided_by_member_id: ownerAMemberId,
				voided_at: NOW,
				void_reason: 'Integration settlement revalidation'
			})
			.where('organisation_id', '=', organisationAId)
			.where('id', '=', invoiceDocumentId)
			.executeTakeFirstOrThrow();
		await expect(
			automationService().dispatchReminder(actorFinanceA, secondReminderPublicId)
		).rejects.toBeInstanceOf(FinanceValidationError);
		const reminder = await db
			.selectFrom('receivable_collection_reminders')
			.select(['id', 'status'])
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', secondReminderPublicId)
			.executeTakeFirstOrThrow();
		expect(reminder.status).toBe('pending');
		const attempts = await db
			.selectFrom('receivable_collection_reminder_deliveries')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('reminder_id', '=', reminder.id)
			.execute();
		expect(attempts).toHaveLength(0);
	});
});
