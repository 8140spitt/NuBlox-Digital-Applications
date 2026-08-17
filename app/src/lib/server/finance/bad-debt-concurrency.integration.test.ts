import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { BadDebtMutationService } from './bad-debt-mutation-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Bad Debt Concurrency ';
const NOW = new Date('2026-08-17T17:00:00.000Z');
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let customerId = '';
let invoiceId = '';
let invoicePublicId = '';
let paymentId = '';
let actor: TenantActorContext;
let casePublicId = '';
let recommendationPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db || !organisationId) return;
	await db.deleteFrom('receivable_write_off_recovery_reversals').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('receivable_write_off_recoveries').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('receivable_write_off_reversals').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('receivable_write_offs').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('receivable_bad_debt_recommendations').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('receivable_bad_debt_cases').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('payments').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('invoices').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', '=', organisationId).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('parties').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	if (userId) await db.deleteFrom('users').where('id', '=', userId).execute();
}

beforeAll(async () => {
	db = getDatabase();
	const user = await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' }).executeTakeFirstOrThrow();
	userId = insertedId(user);
	organisationId = insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, default_currency_code: 'GBP', default_timezone: 'Europe/London', status: 'active' }).executeTakeFirstOrThrow());
	memberId = insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: NOW }).executeTakeFirstOrThrow());
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}Owner`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', ['finance.view', 'finance.manage']).execute();
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	customerId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationId, public_id: randomUUID(), party_kind: 'organisation', account_owner_member_id: memberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerId, organisation_id: organisationId, legal_name: `${PREFIX}Customer Ltd`, trading_name: `${PREFIX}Customer` }).executeTakeFirstOrThrow();

	invoicePublicId = randomUUID();
	invoiceId = insertedId(await db.insertInto('financial_documents').values({ organisation_id: organisationId, public_id: invoicePublicId, document_kind: 'invoice', document_number: 'INV-CONCURRENT-001', customer_party_id: customerId, billing_contact_party_id: null, project_id: null, contract_id: null, currency_code: 'GBP', lifecycle_status: 'issued', created_by_member_id: memberId, voided_by_member_id: null, voided_at: null, void_reason: null }).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({ financial_document_id: invoiceId, organisation_id: organisationId, payment_term_id: null, invoice_type: 'standard', due_date: new Date('2026-08-01T00:00:00.000Z'), customer_purchase_order_reference: null }).executeTakeFirstOrThrow();
	const salesItemTypeId = Number((await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id);
	await db.insertInto('financial_document_items').values({ organisation_id: organisationId, financial_document_id: invoiceId, source_quotation_item_id: null, sales_item_type_id: salesItemTypeId, sales_catalog_item_id: null, unit_of_measure_id: null, line_number: 1, description: 'Concurrent write-off invoice', quantity: '1.000000', unit_rate: '100.0000' }).executeTakeFirstOrThrow();

	const paymentMethodId = (await db.selectFrom('payment_methods').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id;
	paymentId = insertedId(await db.insertInto('payments').values({ organisation_id: organisationId, public_id: randomUUID(), payer_party_id: customerId, payment_method_id: paymentMethodId, received_at: NOW, amount: '50.0000', currency_code: 'GBP', payment_reference: 'CONCURRENT-CASH', created_by_member_id: memberId }).executeTakeFirstOrThrow());

	const mutations = new BadDebtMutationService(db, randomUUID, () => NOW);
	casePublicId = (await mutations.startCase(actor, { invoicePublicId, reason: 'Concurrency assessment.' })).publicId;
	recommendationPublicId = (await mutations.recommendWriteOff(actor, { casePublicId, amount: '60.0000', reason: 'Recommend sixty before concurrent payment allocation.' })).publicId;
});

afterAll(async () => { await cleanup(); await closeDatabase(); });

describe.sequential('Package 004J bad-debt concurrency', () => {
	it('waits for a concurrent allocation and rejects a now-excessive write-off instead of using a stale snapshot', async () => {
		let releaseAllocation!: () => void;
		const allocationMayCommit = new Promise<void>((resolve) => { releaseAllocation = resolve; });
		let allocationReady!: () => void;
		const allocationReadyPromise = new Promise<void>((resolve) => { allocationReady = resolve; });

		const allocationTransaction = db.transaction().execute(async (trx) => {
			await trx.selectFrom('payments').select('id').where('organisation_id', '=', organisationId).where('id', '=', paymentId).forUpdate().executeTakeFirstOrThrow();
			await trx.selectFrom('financial_documents').select('id').where('organisation_id', '=', organisationId).where('id', '=', invoiceId).forUpdate().executeTakeFirstOrThrow();
			await trx.insertInto('payment_allocations').values({ organisation_id: organisationId, payment_id: paymentId, invoice_document_id: invoiceId, allocated_amount: '50.0000', allocated_by_member_id: memberId, allocated_at: NOW }).executeTakeFirstOrThrow();
			allocationReady();
			await allocationMayCommit;
		});

		await allocationReadyPromise;
		const authorisation = new BadDebtMutationService(db, randomUUID, () => NOW).authoriseWriteOff(actor, {
			casePublicId,
			recommendationPublicId,
			taxTreatmentPolicy: 'no_tax_adjustment',
			reason: 'Must re-evaluate after the concurrent allocation commits.'
		});

		await new Promise((resolve) => setTimeout(resolve, 75));
		releaseAllocation();
		await allocationTransaction;
		await expect(authorisation).rejects.toBeInstanceOf(FinanceValidationError);

		const writeOffs = await db.selectFrom('receivable_write_offs').select('id').where('organisation_id', '=', organisationId).where('invoice_document_id', '=', invoiceId).execute();
		expect(writeOffs).toHaveLength(0);
	});
}, 15_000);
