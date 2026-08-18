import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CreditControlBlockedError, CreditControlService } from './credit-control-service';

const PREFIX = 'Credit Control Projection Integration ';

let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let customerId = '';
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
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
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
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
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

	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Owner`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', ['finance.view', 'finance.manage'])
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([
		'finance.manage',
		'finance.view'
	]);
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

	const customerPublicId = randomUUID();
	customerId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: customerPublicId,
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
	const invoiceId = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				document_kind: 'invoice',
				document_number: 'INV-PROJECTION-001',
				customer_party_id: customerId,
				billing_contact_party_id: null,
				project_id: null,
				contract_id: null,
				currency_code: 'GBP',
				lifecycle_status: 'issued',
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
			financial_document_id: invoiceId,
			organisation_id: organisationId,
			payment_term_id: null,
			invoice_type: 'standard',
			due_date: new Date('2026-08-31T00:00:00.000Z'),
			customer_purchase_order_reference: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_items')
		.values({
			organisation_id: organisationId,
			financial_document_id: invoiceId,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemType.id,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: `${PREFIX}Existing receivable`,
			quantity: '1.000000',
			unit_rate: '20.0000'
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
			reason: 'Projection test limit.',
			created_by_member_id: memberId
		})
		.executeTakeFirstOrThrow();

	actor = { organisationId, userId, memberId, correlationId: randomUUID() };
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004I projected exposure enforcement', () => {
	it('allows exact-limit projection, blocks a commitment that crosses headroom, and snapshots the override projection', async () => {
		const service = new CreditControlService(
			db,
			randomUUID,
			() => new Date('2026-08-17T15:45:00.000Z')
		);

		const atLimit = await service.commitmentPreview(actor, customerId, 'GBP', '80.0000');
		expect(atLimit).toMatchObject({
			blocked: false,
			limitExhausted: false,
			outstandingAmount: '20.0000',
			commitmentAmount: '80.0000',
			projectedExposureAmount: '100.0000',
			creditLimitAmount: '100.0000'
		});

		const overLimit = await service.commitmentPreview(actor, customerId, 'GBP', '80.0001');
		expect(overLimit).toMatchObject({
			blocked: true,
			limitExhausted: true,
			outstandingAmount: '20.0000',
			commitmentAmount: '80.0001',
			projectedExposureAmount: '100.0001',
			creditLimitAmount: '100.0000'
		});

		await expect(
			db.transaction().execute((trx) =>
				service.enforceCommitment(
					actor,
					{
						customerPartyId: customerId,
						currencyCode: 'GBP',
						workflowType: 'contract_execution',
						subjectPublicId: 'projection-without-override',
						commitmentAmount: '80.0001'
					},
					trx
				)
			)
		).rejects.toBeInstanceOf(CreditControlBlockedError);

		await db.transaction().execute((trx) =>
			service.enforceCommitment(
				actor,
				{
					customerPartyId: customerId,
					currencyCode: 'GBP',
					workflowType: 'contract_execution',
					subjectPublicId: 'projection-with-override',
					commitmentAmount: '80.0001',
					overrideReason: 'Owner approves the small projected exposure exception.'
				},
				trx
			)
		);

		const evidence = await db
			.selectFrom('receivable_credit_control_overrides')
			.select([
				'outstanding_amount as outstandingAmount',
				'commitment_amount as commitmentAmount',
				'projected_exposure_amount as projectedExposureAmount',
				'credit_limit_amount as creditLimitAmount'
			])
			.where('organisation_id', '=', organisationId)
			.where('subject_public_id', '=', 'projection-with-override')
			.executeTakeFirstOrThrow();
		expect(evidence).toEqual({
			outstandingAmount: '20.0000',
			commitmentAmount: '80.0001',
			projectedExposureAmount: '100.0001',
			creditLimitAmount: '100.0000'
		});
	});
});
