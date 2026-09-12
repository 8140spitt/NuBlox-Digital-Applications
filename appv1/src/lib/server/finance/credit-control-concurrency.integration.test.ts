import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CreditControlBlockedError, CreditControlService } from './credit-control-service';

const PREFIX = 'Credit Control Concurrency Integration ';

let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let customerId = '';
let invoiceDocumentId = '';
let actor: TenantActorContext;

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
		.deleteFrom('receivable_credit_control_overrides')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('receivable_credit_holds').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('receivable_credit_policy_revisions')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('receivable_credit_policies').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('financial_document_item_taxes')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	userId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}User`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Tenant`,
				default_currency_code: 'GBP',
				default_timezone: 'Europe/London',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-17T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	customerId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				party_kind: 'organisation',
				account_owner_member_id: memberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: customerId,
			organisation_id: organisationId,
			legal_name: `${PREFIX}Customer Ltd`,
			trading_name: null
		})
		.executeTakeFirstOrThrow();

	const salesItemType = await db
		.selectFrom('sales_item_types')
		.select('id')
		.where('is_active', '=', 1)
		.orderBy('id')
		.executeTakeFirstOrThrow();
	invoiceDocumentId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				document_kind: 'invoice',
				document_number: null,
				customer_party_id: customerId,
				billing_contact_party_id: null,
				project_id: null,
				contract_id: null,
				currency_code: 'GBP',
				lifecycle_status: 'draft',
				created_by_member_id: memberId,
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
			organisation_id: organisationId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: null,
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_items')
		.values({
			organisation_id: organisationId,
			financial_document_id: invoiceDocumentId,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemType.id,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: `${PREFIX}Draft exposure`,
			quantity: '1.000000',
			unit_rate: '120.0000'
		})
		.executeTakeFirstOrThrow();

	const policyId = insertedId(
		await db
			.insertInto('receivable_credit_policies')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				customer_party_id: customerId,
				currency_code: 'GBP',
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('receivable_credit_policy_revisions')
		.values({
			organisation_id: organisationId,
			public_id: randomUUID(),
			credit_policy_id: policyId,
			version_number: 1,
			is_enabled: 1,
			credit_limit_amount: '100.0000',
			reason: 'Concurrency boundary fixture.',
			created_by_member_id: memberId
		})
		.executeTakeFirstOrThrow();

	actor = {
		organisationId,
		userId,
		memberId,
		correlationId: randomUUID()
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004I credit-control serialization', () => {
	it('waits for a concurrently locked draft invoice and re-evaluates after it becomes issued', async () => {
		let releaseInvoice!: () => void;
		let invoiceLocked!: () => void;
		const releaseInvoicePromise = new Promise<void>((resolve) => {
			releaseInvoice = resolve;
		});
		const invoiceLockedPromise = new Promise<void>((resolve) => {
			invoiceLocked = resolve;
		});

		const issuingTransaction = db.transaction().execute(async (trx) => {
			await trx
				.selectFrom('parties')
				.select('id')
				.where('organisation_id', '=', organisationId)
				.where('id', '=', customerId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			await trx
				.selectFrom('financial_documents')
				.select('id')
				.where('organisation_id', '=', organisationId)
				.where('id', '=', invoiceDocumentId)
				.forUpdate()
				.executeTakeFirstOrThrow();
			invoiceLocked();
			await releaseInvoicePromise;
			await trx
				.updateTable('financial_documents')
				.set({ lifecycle_status: 'issued', document_number: 'INV-CONCURRENCY-001' })
				.where('organisation_id', '=', organisationId)
				.where('id', '=', invoiceDocumentId)
				.executeTakeFirstOrThrow();
		});

		await invoiceLockedPromise;
		let gateFinished = false;
		const gateResult = db
			.transaction()
			.execute(async (trx) => {
				await new CreditControlService(db).enforceCommitment(
					actor,
					{
						customerPartyId: customerId,
						currencyCode: 'GBP',
						workflowType: 'contract_execution',
						subjectPublicId: 'concurrency-subject'
					},
					trx
				);
			})
			.then(
				() => ({ ok: true as const, error: null }),
				(error: unknown) => ({ ok: false as const, error })
			)
			.finally(() => {
				gateFinished = true;
			});

		await new Promise((resolve) => setTimeout(resolve, 75));
		expect(gateFinished).toBe(false);

		releaseInvoice();
		await issuingTransaction;
		const result = await gateResult;
		expect(result.ok).toBe(false);
		expect(result.error).toBeInstanceOf(CreditControlBlockedError);

		const persistedOverride = await db
			.selectFrom('receivable_credit_control_overrides')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('subject_public_id', '=', 'concurrency-subject')
			.execute();
		expect(persistedOverride).toHaveLength(0);
	});
});
