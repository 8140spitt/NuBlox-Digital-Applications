import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { AccountingService } from './accounting-service';
import { FinanceValidationError } from './finance-common';

const PREFIX = 'Accounting Concurrency Integration ';
const NOW = new Date('2026-08-18T13:00:00.000Z');
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let invoicePublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

beforeAll(async () => {
	db = getDatabase();
	userId = insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' }).executeTakeFirstOrThrow());
	organisationId = insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, default_currency_code: 'GBP', default_timezone: 'Europe/London', status: 'active' }).executeTakeFirstOrThrow());
	memberId = insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: NOW }).executeTakeFirstOrThrow());
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}Owner`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select('id').where('permission_key', 'in', ['finance.view', 'finance.manage']).execute();
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	const service = new AccountingService(db, randomUUID, () => NOW);
	const ar = await service.createAccount(actor, { accountCode: '1100', name: 'Trade Receivables', accountType: 'asset' });
	const revenue = await service.createAccount(actor, { accountCode: '4000', name: 'Sales Revenue', accountType: 'revenue' });
	await service.assignMapping(actor, { mappingKey: 'accounts_receivable', accountPublicId: ar.publicId, reason: 'Concurrency fixture.' });
	await service.assignMapping(actor, { mappingKey: 'sales_revenue', accountPublicId: revenue.publicId, reason: 'Concurrency fixture.' });

	const customerId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationId, public_id: randomUUID(), party_kind: 'organisation', account_owner_member_id: memberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerId, organisation_id: organisationId, legal_name: `${PREFIX}Customer`, trading_name: null }).executeTakeFirstOrThrow();
	const salesItemTypeId = Number((await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id);
	invoicePublicId = randomUUID();
	const invoiceId = insertedId(await db.insertInto('financial_documents').values({ organisation_id: organisationId, public_id: invoicePublicId, document_kind: 'invoice', document_number: 'INV-ACC-CON-001', customer_party_id: customerId, billing_contact_party_id: null, project_id: null, contract_id: null, currency_code: 'GBP', lifecycle_status: 'issued', created_by_member_id: memberId, voided_by_member_id: null, voided_at: null, void_reason: null }).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({ financial_document_id: invoiceId, organisation_id: organisationId, payment_term_id: null, invoice_type: 'standard', due_date: new Date('2026-08-31T00:00:00.000Z'), customer_purchase_order_reference: null }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_items').values({ organisation_id: organisationId, financial_document_id: invoiceId, source_quotation_item_id: null, sales_item_type_id: salesItemTypeId, sales_catalog_item_id: null, unit_of_measure_id: null, line_number: 1, description: 'Concurrency source', quantity: '1.000000', unit_rate: '25.0000' }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_issue_events').values({ organisation_id: organisationId, financial_document_id: invoiceId, issue_sequence: 1, issued_by_member_id: memberId, delivery_channel: 'manual', issued_at: NOW, note: null }).executeTakeFirstOrThrow();
});

afterAll(async () => {
	if (db && organisationId) {
		await db.deleteFrom('accounting_export_reversals').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_export_batch_entries').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_export_batches').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_journal_entry_reversals').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_journal_lines').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_journal_entries').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_account_mappings').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_accounts').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('financial_document_issue_events').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('financial_document_items').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('invoices').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('financial_documents').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('party_organisations').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('parties').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('audit_events').where('acting_organisation_id', '=', organisationId).execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	}
	if (db && userId) await db.deleteFrom('users').where('id', '=', userId).execute();
	await closeDatabase();
});

describe('Package 004L accounting posting concurrency', () => {
	it('serialises two attempts so only one active journal is created for the same source event', async () => {
		const first = new AccountingService(db, randomUUID, () => NOW).postSource(actor, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId });
		const second = new AccountingService(db, randomUUID, () => NOW).postSource({ ...actor, correlationId: randomUUID() }, { sourceType: 'invoice_issue', sourcePublicId: invoicePublicId });
		const results = await Promise.allSettled([first, second]);
		expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
		expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
		const rejected = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
		expect(rejected?.reason).toBeInstanceOf(FinanceValidationError);
		const active = await db
			.selectFrom('accounting_journal_entries as journal')
			.leftJoin('accounting_journal_entry_reversals as reversal', (join) => join.onRef('reversal.journal_entry_id', '=', 'journal.id').onRef('reversal.organisation_id', '=', 'journal.organisation_id'))
			.select('journal.id')
			.where('journal.organisation_id', '=', organisationId)
			.where('journal.source_type', '=', 'invoice_issue')
			.where('journal.source_public_id', '=', invoicePublicId)
			.where('reversal.journal_entry_id', 'is', null)
			.execute();
		expect(active).toHaveLength(1);
	});
});
