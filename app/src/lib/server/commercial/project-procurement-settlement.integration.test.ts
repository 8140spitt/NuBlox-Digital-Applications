import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ProjectProcurementSettlementService } from './project-procurement-settlement-service';

const PREFIX = 'Project Settlement Integration ';

let db: Database;
let organisationId = '';
let memberId = '';
let userId = '';
let actor: TenantActorContext;
let projectId = '';
let projectPublicId = '';
let supplierPartyId = '';
let documentId = '';
let documentPublicId = '';
let paymentId = '';
let paymentPublicId = '';
let bankMatchId = '';

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined) throw new Error(`Expected ${label} insert ID.`);
	return result.insertId.toString();
}

async function assignRole(permissionKeys: string[]) {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Finance owner ${randomUUID().slice(0, 6)}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow(),
		'role'
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
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation ${randomUUID().slice(0, 8)}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow(),
		'organisation'
	);
	userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
			.executeTakeFirstOrThrow(),
		'user'
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-28T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow(),
		'member'
	);
	await assignRole([
		'project.create',
		'project.view',
		'project.manage',
		'commercial.forecast.view',
		'finance.ap.view',
		'finance.bank.view'
	]);
	actor = {
		organisationId,
		userId,
		memberId,
		correlationId: `project-settlement-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actor, {
		projectNumber: `SET-${randomUUID().slice(0, 8).toUpperCase()}`,
		name: `${PREFIX}Project`
	});
	projectPublicId = project.publicId;
	const projectRow = await db
		.selectFrom('projects')
		.select('id')
		.where('owning_organisation_id', '=', organisationId)
		.where('public_id', '=', projectPublicId)
		.executeTakeFirstOrThrow();
	projectId = projectRow.id;

	supplierPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				party_kind: 'organisation',
				account_owner_member_id: memberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow(),
		'supplier party'
	);

	documentPublicId = randomUUID();
	documentId = insertedId(
		await db
			.insertInto('accounts_payable_documents')
			.values({
				organisation_id: organisationId,
				public_id: documentPublicId,
				document_type: 'invoice',
				supplier_party_id: supplierPartyId,
				project_id: projectId,
				purchase_order_id: null,
				supplier_document_number: `INV-${randomUUID().slice(0, 8)}`,
				invoice_date: new Date('2026-08-20T00:00:00.000Z'),
				tax_date: new Date('2026-08-20T00:00:00.000Z'),
				due_date: new Date('2026-09-20T00:00:00.000Z'),
				currency_code: 'GBP',
				lifecycle_status: 'approved',
				net_amount: '100.0000',
				tax_amount: '20.0000',
				gross_amount: '120.0000',
				created_by_member_id: memberId,
				submitted_at: new Date('2026-08-20T09:00:00.000Z'),
				approved_at: new Date('2026-08-20T10:00:00.000Z')
			})
			.executeTakeFirstOrThrow(),
		'AP document'
	);
	await db
		.insertInto('accounts_payable_supplier_snapshots')
		.values({
			organisation_id: organisationId,
			accounts_payable_document_id: documentId,
			supplier_party_id: supplierPartyId,
			display_name: `${PREFIX}Supplier Ltd`
		})
		.executeTakeFirstOrThrow();

	const paymentMethod = await db
		.selectFrom('payment_methods')
		.select('id')
		.executeTakeFirstOrThrow();
	paymentPublicId = randomUUID();
	paymentId = insertedId(
		await db
			.insertInto('accounts_payable_supplier_payments')
			.values({
				organisation_id: organisationId,
				public_id: paymentPublicId,
				supplier_party_id: supplierPartyId,
				payment_method_id: paymentMethod.id,
				currency_code: 'GBP',
				requested_payment_date: new Date('2026-08-22T00:00:00.000Z'),
				payment_reference: 'BACS-SETTLED-001',
				payment_amount: '120.0000',
				lifecycle_status: 'executed',
				created_by_member_id: memberId,
				approved_by_member_id: memberId,
				approved_at: new Date('2026-08-21T10:00:00.000Z'),
				executed_by_member_id: memberId,
				executed_at: new Date('2026-08-22T12:00:00.000Z'),
				cancelled_by_member_id: null,
				cancellation_reason: null,
				cancelled_at: null
			})
			.executeTakeFirstOrThrow(),
		'supplier payment'
	);
	await db
		.insertInto('accounts_payable_supplier_payment_allocations')
		.values({
			organisation_id: organisationId,
			supplier_payment_id: paymentId,
			accounts_payable_document_id: documentId,
			allocated_amount: '120.0000'
		})
		.executeTakeFirstOrThrow();

	for (const journal of [
		{
			publicId: randomUUID(),
			number: `AP-${randomUUID().slice(0, 8)}`,
			sourceType: 'accounts_payable_invoice_approval',
			sourcePublicId: documentPublicId,
			fingerprint: 'a'.repeat(64),
			memo: 'Approved supplier liability'
		},
		{
			publicId: randomUUID(),
			number: `PAY-${randomUUID().slice(0, 8)}`,
			sourceType: 'supplier_payment_execution',
			sourcePublicId: paymentPublicId,
			fingerprint: 'b'.repeat(64),
			memo: 'Supplier payment execution'
		}
	] as const) {
		await db
			.insertInto('accounting_journal_entries')
			.values({
				organisation_id: organisationId,
				public_id: journal.publicId,
				journal_number: journal.number,
				source_type: journal.sourceType,
				source_public_id: journal.sourcePublicId,
				source_event_at: new Date('2026-08-22T12:00:00.000Z'),
				source_amount: '120.0000',
				source_fingerprint: journal.fingerprint,
				accounting_date: new Date('2026-08-22T00:00:00.000Z'),
				currency_code: 'GBP',
				memo: journal.memo,
				posted_by_member_id: memberId,
				posted_at: new Date('2026-08-22T12:05:00.000Z')
			})
			.executeTakeFirstOrThrow();
	}

	const accountingAccountId = insertedId(
		await db
			.insertInto('accounting_accounts')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				account_code: `CASH-${randomUUID().slice(0, 6)}`,
				name: `${PREFIX}Cash account`,
				account_type: 'asset',
				normal_balance: 'debit',
				is_active: 1,
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow(),
		'accounting account'
	);
	const bankAccountId = insertedId(
		await db
			.insertInto('bank_accounts')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				accounting_account_id: accountingAccountId,
				account_name: `${PREFIX}Operating account`,
				institution_name: `${PREFIX}Bank`,
				account_identifier_last4: '2046',
				currency_code: 'GBP',
				lifecycle_status: 'active',
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow(),
		'bank account'
	);
	const statementId = insertedId(
		await db
			.insertInto('bank_statements')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				bank_account_id: bankAccountId,
				statement_reference: `STMT-${randomUUID().slice(0, 8)}`,
				period_start: new Date('2026-08-22T00:00:00.000Z'),
				period_end: new Date('2026-08-22T00:00:00.000Z'),
				opening_balance: '1000.0000',
				closing_balance: '880.0000',
				created_by_member_id: memberId
			})
			.executeTakeFirstOrThrow(),
		'bank statement'
	);
	const statementLineId = insertedId(
		await db
			.insertInto('bank_statement_lines')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				bank_statement_id: statementId,
				bank_account_id: bankAccountId,
				external_transaction_id: `BANK-${randomUUID().slice(0, 8)}`,
				booked_on: new Date('2026-08-22T00:00:00.000Z'),
				value_on: new Date('2026-08-22T00:00:00.000Z'),
				direction: 'debit',
				amount: '120.0000',
				description: 'Supplier payment settlement',
				bank_reference: 'BANK-REF-001'
			})
			.executeTakeFirstOrThrow(),
		'bank statement line'
	);
	bankMatchId = insertedId(
		await db
			.insertInto('bank_reconciliation_matches')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				bank_statement_line_id: statementLineId,
				supplier_payment_id: paymentId,
				matched_amount: '120.0000',
				matched_by_member_id: memberId,
				matched_at: new Date('2026-08-22T13:00:00.000Z')
			})
			.executeTakeFirstOrThrow(),
		'bank reconciliation match'
	);
});

afterAll(async () => {
	await closeDatabase();
});

describe('project procurement settlement drill-through', () => {
	it('traces approved project AP from liability posting through paid and bank-settled cash', async () => {
		const workspace = await new ProjectProcurementSettlementService(db).getWorkspace(
			actor,
			projectPublicId
		);
		expect(workspace.project.publicId).toBe(projectPublicId);
		expect(workspace.currencyCodes).toEqual(['GBP']);
		expect(workspace.currencyMismatch).toBe(false);
		expect(workspace.documents).toHaveLength(1);
		expect(workspace.totals).toMatchObject({
			approvedInvoiceAmount: '120.0000',
			executedPaymentAmount: '120.0000',
			accountedPaymentAmount: '120.0000',
			bankSettledAmount: '120.0000',
			outstandingPayableAmount: '0.0000',
			unreconciledPaymentAmount: '0.0000'
		});
		const document = workspace.documents[0]!;
		expect(document.publicId).toBe(documentPublicId);
		expect(document.liabilityPosted).toBe(true);
		expect(document.status).toBe('settled');
		expect(document.payments).toHaveLength(1);
		expect(document.payments[0]).toMatchObject({
			publicId: paymentPublicId,
			paymentReference: 'BACS-SETTLED-001',
			allocatedAmount: '120.0000',
			accountingPosted: true,
			bankSettled: true,
			bankReference: 'BANK-REF-001'
		});
	});

	it('removes reversed bank evidence from project settlement without rewriting payment history', async () => {
		await db
			.insertInto('bank_reconciliation_match_reversals')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				bank_reconciliation_match_id: bankMatchId,
				reason: 'Correction evidence for project settlement projection.',
				reversed_by_member_id: memberId,
				reversed_at: new Date('2026-08-23T09:00:00.000Z')
			})
			.executeTakeFirstOrThrow();

		const workspace = await new ProjectProcurementSettlementService(db).getWorkspace(
			actor,
			projectPublicId
		);
		const document = workspace.documents[0]!;
		expect(document.executedPaymentAmount).toBe('120.0000');
		expect(document.accountedPaymentAmount).toBe('120.0000');
		expect(document.bankSettledAmount).toBe('0.0000');
		expect(document.unreconciledPaymentAmount).toBe('120.0000');
		expect(document.status).toBe('paid_unreconciled');
		expect(document.payments[0]?.bankSettled).toBe(false);
	});
});
