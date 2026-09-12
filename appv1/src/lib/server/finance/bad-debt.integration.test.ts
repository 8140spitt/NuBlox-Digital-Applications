import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { BadDebtMutationService } from './bad-debt-mutation-service';
import { BadDebtQueryService } from './bad-debt-query-service';
import { FinanceValidationError } from './finance-common';
import { PaymentControlService } from './payment-control-service';
import { issuedInvoiceOutstanding } from './receivable-ledger';

const PREFIX = 'Bad Debt Integration ';
const NOW = new Date('2026-08-17T16:30:00.000Z');
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let financeAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let financeAMemberId = '';
let ownerBMemberId = '';
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorOwnerB: TenantActorContext;
let customerId = '';
let invoiceId = '';
let invoicePublicId = '';
let paymentPublicId = '';
let casePublicId = '';
let recommendationPublicId = '';
let writeOffPublicId = '';
let recoveryPublicId = '';
let salesItemTypeId = 0;
let paymentMethodId = 0;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const orgs = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = orgs.map((row) => row.id);
	if (ids.length === 0) return;
	await db
		.deleteFrom('receivable_write_off_recovery_reversals')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('receivable_write_off_recoveries')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('receivable_write_off_reversals')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('receivable_write_offs').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('receivable_bad_debt_recommendations')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('receivable_bad_debt_cases').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', 'in', ids).execute();
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
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(name: string) {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}
async function createOrganisation(name: string) {
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
async function createMember(organisationId: string, userId: string) {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: NOW
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
	await assignRole(organisationAId, ownerAMemberId, 'Owner', ['finance.view', 'finance.manage']);
	await assignRole(organisationAId, financeAMemberId, 'Finance', [
		'finance.view',
		'finance.bad_debt.view',
		'finance.bad_debt.case.manage',
		'finance.bad_debt.recommend',
		'finance.bad_debt.recovery.record',
		'finance.bad_debt.recovery.reverse'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', [
		'finance.view',
		'finance.bad_debt.view'
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
	salesItemTypeId = Number(
		(
			await db
				.selectFrom('sales_item_types')
				.select('id')
				.where('is_active', '=', 1)
				.orderBy('id')
				.executeTakeFirstOrThrow()
		).id
	);
	paymentMethodId = (
		await db
			.selectFrom('payment_methods')
			.select('id')
			.where('is_active', '=', 1)
			.orderBy('id')
			.executeTakeFirstOrThrow()
	).id;
	const customerPublicId = randomUUID();
	customerId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: customerPublicId,
				party_kind: 'organisation',
				account_owner_member_id: ownerAMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: customerId,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}Customer Ltd`,
			trading_name: `${PREFIX}Customer`
		})
		.executeTakeFirstOrThrow();
	invoicePublicId = randomUUID();
	invoiceId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationAId,
				public_id: invoicePublicId,
				document_kind: 'invoice',
				document_number: 'INV-BAD-001',
				customer_party_id: customerId,
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
			financial_document_id: invoiceId,
			organisation_id: organisationAId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: new Date('2026-08-01T00:00:00.000Z'),
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_items')
		.values({
			organisation_id: organisationAId,
			financial_document_id: invoiceId,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemTypeId,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: 'Bad debt test invoice',
			quantity: '1.000000',
			unit_rate: '100.0000'
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_issue_events')
		.values({
			organisation_id: organisationAId,
			financial_document_id: invoiceId,
			issue_sequence: 1,
			issued_by_member_id: ownerAMemberId,
			delivery_channel: 'manual',
			issued_at: new Date('2026-08-01T09:00:00.000Z'),
			note: null
		})
		.executeTakeFirstOrThrow();
	paymentPublicId = randomUUID();
	await db
		.insertInto('payments')
		.values({
			organisation_id: organisationAId,
			public_id: paymentPublicId,
			payer_party_id: customerId,
			payment_method_id: paymentMethodId,
			received_at: NOW,
			amount: '50.0000',
			currency_code: 'GBP',
			payment_reference: 'RECOVERY-CASH',
			created_by_member_id: financeAMemberId
		})
		.executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004J controlled bad debt, write-off and recovery', () => {
	it('allows delegated assessment/recommendation but reserves write-off authority', async () => {
		const mutations = new BadDebtMutationService(db, randomUUID, () => NOW);
		casePublicId = (
			await mutations.startCase(actorFinanceA, {
				invoicePublicId,
				reason: 'Customer insolvency assessment.'
			})
		).publicId;
		expect(
			(await mutations.startCase(actorFinanceA, { invoicePublicId, reason: 'Idempotent retry.' }))
				.publicId
		).toBe(casePublicId);
		recommendationPublicId = (
			await mutations.recommendWriteOff(actorFinanceA, {
				casePublicId,
				amount: '60.0000',
				reason: 'Recommend partial loss recognition.'
			})
		).publicId;
		await expect(
			mutations.authoriseWriteOff(actorFinanceA, {
				casePublicId,
				recommendationPublicId,
				taxTreatmentPolicy: 'no_tax_adjustment',
				reason: 'Finance must not authorise.'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		writeOffPublicId = (
			await mutations.authoriseWriteOff(actorOwnerA, {
				casePublicId,
				recommendationPublicId,
				taxTreatmentPolicy: 'no_tax_adjustment',
				reason: 'Owner authorises the assessed loss.'
			})
		).publicId;
		const position = await issuedInvoiceOutstanding(db, organisationAId, invoiceId);
		expect(position.activeWriteOffAmount).toBe('60.0000');
		expect(position.outstandingAmount).toBe('40.0000');
		const workspace = await new BadDebtQueryService(db).getWorkspace(actorFinanceA, casePublicId);
		expect(workspace.writeOffs).toHaveLength(1);
		expect(workspace.canAuthoriseWriteOff).toBe(false);
	});

	it('revalidates current receivable before accepting another recommendation', async () => {
		await expect(
			new BadDebtMutationService(db).recommendWriteOff(actorFinanceA, {
				casePublicId,
				amount: '40.0001',
				reason: 'Must exceed remaining balance.'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('records recovery from available cash without reopening the receivable', async () => {
		const mutations = new BadDebtMutationService(db, randomUUID, () => NOW);
		recoveryPublicId = (
			await mutations.recordRecovery(actorFinanceA, {
				casePublicId,
				writeOffPublicId,
				paymentPublicId,
				amount: '30.0000',
				reason: 'Late recovery after write-off.'
			})
		).publicId;
		const payment = await new PaymentControlService(db).getWorkspace(
			actorFinanceA,
			paymentPublicId
		);
		expect(payment.payment.unallocatedAmount).toBe('20.0000');
		expect((await issuedInvoiceOutstanding(db, organisationAId, invoiceId)).outstandingAmount).toBe(
			'40.0000'
		);
		await expect(
			mutations.reverseWriteOff(actorOwnerA, {
				casePublicId,
				writeOffPublicId,
				reason: 'Must reverse recovery first.'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(
			new PaymentControlService(db).reversePayment(actorOwnerA, {
				paymentPublicId,
				reason: 'Must not bypass recovery evidence.'
			})
		).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('reverses recovery and write-off additively, restoring cash and receivable', async () => {
		const mutations = new BadDebtMutationService(db, randomUUID, () => NOW);
		await mutations.reverseRecovery(actorFinanceA, {
			casePublicId,
			recoveryPublicId,
			reason: 'Recovery was posted to the wrong write-off.'
		});
		expect(
			(await new PaymentControlService(db).getWorkspace(actorFinanceA, paymentPublicId)).payment
				.unallocatedAmount
		).toBe('50.0000');
		await mutations.reverseWriteOff(actorOwnerA, {
			casePublicId,
			writeOffPublicId,
			reason: 'Reverse the recognised loss.'
		});
		const position = await issuedInvoiceOutstanding(db, organisationAId, invoiceId);
		expect(position.activeWriteOffAmount).toBe('0.0000');
		expect(position.outstandingAmount).toBe('100.0000');
	});

	it('honours explicit granular deny above the finance.manage umbrella', async () => {
		const mutations = new BadDebtMutationService(db, randomUUID, () => NOW);
		const recommendation = await mutations.recommendWriteOff(actorFinanceA, {
			casePublicId,
			amount: '25.0000',
			reason: 'Second recommendation after reversal.'
		});
		const permission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.bad_debt.write_off.authorise')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationAId,
				organisation_member_id: ownerAMemberId,
				permission_id: permission.id,
				effect: 'deny',
				reason: 'Integration explicit deny.'
			})
			.executeTakeFirstOrThrow();
		await expect(
			mutations.authoriseWriteOff(actorOwnerA, {
				casePublicId,
				recommendationPublicId: recommendation.publicId,
				taxTreatmentPolicy: 'separate_tax_adjustment_required',
				reason: 'Explicit deny must win.'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', permission.id)
			.execute();
	});

	it('masks bad-debt case identities across tenants', async () => {
		await expect(
			new BadDebtQueryService(db).getWorkspace(actorOwnerB, casePublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
