import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { BadDebtMutationService } from './bad-debt-mutation-service';
import { FinanceValidationError } from './finance-common';
import { ControlledTaxReliefService } from './tax-relief-control-service';

const PREFIX = 'Tax Relief Integration ';
const NOW = new Date('2026-08-18T09:00:00.000Z');
const BEFORE_ELIGIBLE = new Date('2026-07-30T09:00:00.000Z');
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
let invoiceItemId = '';
let taxCategoryId = '';
let badDebtCasePublicId = '';
let writeOffId = '';
let writeOffPublicId = '';
let recoveryPublicId = '';
let claimPublicId = '';
let claimPostingPublicId = '';
let repaymentPublicId = '';
let repaymentPostingPublicId = '';
let paymentId = '';
let salesItemTypeId = 0;
let paymentMethodId = 0;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const orgs = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const ids = orgs.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('receivable_vat_return_posting_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_return_postings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_repayment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_repayments').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_claim_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_claim_authorisations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_claim_lines').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_vat_bad_debt_claims').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_write_off_recovery_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_write_off_recoveries').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_write_off_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_write_offs').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_bad_debt_recommendations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('receivable_bad_debt_cases').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocation_reversals').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payment_allocations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('payments').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_issue_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_item_taxes').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_document_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('invoices').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('financial_documents').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_category_rates').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_categories').where('organisation_id', 'in', ids).execute();
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
	return insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createOrganisation(name: string) {
	return insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, default_currency_code: 'GBP', default_timezone: 'Europe/London', status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string) {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: NOW }).executeTakeFirstOrThrow());
}

async function assignRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]) {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
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
	await assignRole(organisationAId, financeAMemberId, 'Finance', ['finance.view', 'finance.tax_relief.view', 'finance.tax_relief.prepare', 'finance.bad_debt.recovery.record', 'finance.bad_debt.recovery.reverse']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ['finance.view', 'finance.manage']);
	actorOwnerA = { organisationId: organisationAId, userId: ownerAUserId, memberId: ownerAMemberId, correlationId: randomUUID() };
	actorFinanceA = { organisationId: organisationAId, userId: financeAUserId, memberId: financeAMemberId, correlationId: randomUUID() };
	actorOwnerB = { organisationId: organisationBId, userId: ownerBUserId, memberId: ownerBMemberId, correlationId: randomUUID() };

	salesItemTypeId = Number((await db.selectFrom('sales_item_types').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id);
	paymentMethodId = (await db.selectFrom('payment_methods').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow()).id;

	customerId = insertedId(await db.insertInto('parties').values({ organisation_id: organisationAId, public_id: randomUUID(), party_kind: 'organisation', account_owner_member_id: ownerAMemberId, status: 'active' }).executeTakeFirstOrThrow());
	await db.insertInto('party_organisations').values({ party_id: customerId, organisation_id: organisationAId, legal_name: `${PREFIX}Customer Ltd`, trading_name: `${PREFIX}Customer` }).executeTakeFirstOrThrow();

	taxCategoryId = insertedId(await db.insertInto('tax_categories').values({ organisation_id: organisationAId, public_id: randomUUID(), code: 'VAT_TEST_20', name: 'Test VAT 20%', treatment: 'taxable', is_active: 1 }).executeTakeFirstOrThrow());
	await db.insertInto('tax_category_rates').values({ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '20.0000', valid_from: new Date('2025-01-01T00:00:00.000Z'), valid_to: null }).executeTakeFirstOrThrow();

	invoicePublicId = randomUUID();
	invoiceId = insertedId(await db.insertInto('financial_documents').values({ organisation_id: organisationAId, public_id: invoicePublicId, document_kind: 'invoice', document_number: 'INV-VAT-BDR-001', customer_party_id: customerId, billing_contact_party_id: null, project_id: null, contract_id: null, currency_code: 'GBP', lifecycle_status: 'issued', created_by_member_id: ownerAMemberId, voided_by_member_id: null, voided_at: null, void_reason: null }).executeTakeFirstOrThrow());
	await db.insertInto('invoices').values({ financial_document_id: invoiceId, organisation_id: organisationAId, payment_term_id: null, invoice_type: 'standard', due_date: new Date('2026-01-31T00:00:00.000Z'), customer_purchase_order_reference: null }).executeTakeFirstOrThrow();
	invoiceItemId = insertedId(await db.insertInto('financial_document_items').values({ organisation_id: organisationAId, financial_document_id: invoiceId, source_quotation_item_id: null, sales_item_type_id: salesItemTypeId, sales_catalog_item_id: null, unit_of_measure_id: null, line_number: 1, description: 'VAT bad-debt relief test invoice', quantity: '1.000000', unit_rate: '100.0000' }).executeTakeFirstOrThrow());
	await db.insertInto('financial_document_item_taxes').values({ organisation_id: organisationAId, financial_document_item_id: invoiceItemId, tax_category_id: taxCategoryId, sort_order: 1, applied_rate_percent: '20.0000', taxable_amount: '100.0000', tax_amount: '20.0000' }).executeTakeFirstOrThrow();
	await db.insertInto('financial_document_issue_events').values({ organisation_id: organisationAId, financial_document_id: invoiceId, issue_sequence: 1, issued_by_member_id: ownerAMemberId, delivery_channel: 'manual', issued_at: new Date('2026-01-01T09:00:00.000Z'), note: null }).executeTakeFirstOrThrow();

	badDebtCasePublicId = randomUUID();
	const badDebtCaseId = insertedId(await db.insertInto('receivable_bad_debt_cases').values({ organisation_id: organisationAId, public_id: badDebtCasePublicId, customer_party_id: customerId, invoice_document_id: invoiceId, status: 'open', opening_reason: 'Customer insolvency.', opened_by_member_id: financeAMemberId, opened_at: new Date('2026-07-15T09:00:00.000Z') }).executeTakeFirstOrThrow());
	const recommendationId = insertedId(await db.insertInto('receivable_bad_debt_recommendations').values({ organisation_id: organisationAId, public_id: randomUUID(), bad_debt_case_id: badDebtCaseId, invoice_document_id: invoiceId, recommended_amount: '60.0000', reason: 'Partial write-off.', recommended_by_member_id: financeAMemberId, recommended_at: new Date('2026-07-16T09:00:00.000Z') }).executeTakeFirstOrThrow());
	writeOffPublicId = randomUUID();
	writeOffId = insertedId(await db.insertInto('receivable_write_offs').values({ organisation_id: organisationAId, public_id: writeOffPublicId, bad_debt_case_id: badDebtCaseId, recommendation_id: recommendationId, invoice_document_id: invoiceId, write_off_amount: '60.0000', tax_treatment_policy: 'separate_tax_adjustment_required', reason: 'Authorised with separate VAT treatment.', authorised_by_member_id: ownerAMemberId, authorised_at: new Date('2026-07-16T10:00:00.000Z') }).executeTakeFirstOrThrow());

	paymentId = insertedId(await db.insertInto('payments').values({ organisation_id: organisationAId, public_id: randomUUID(), payer_party_id: customerId, payment_method_id: paymentMethodId, received_at: NOW, amount: '30.0000', currency_code: 'GBP', payment_reference: 'LATE-RECOVERY', created_by_member_id: financeAMemberId }).executeTakeFirstOrThrow());
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004K controlled VAT bad-debt relief', () => {
	it('allows delegated preparation, binds eligibility to the issued due date, calculates VAT from immutable source tax, and enforces the six-month gate', async () => {
		const service = new ControlledTaxReliefService(db, randomUUID, () => NOW);
		const before = await service.getWorkspace(actorFinanceA);
		expect(before.candidates).toHaveLength(1);
		expect(before.candidates[0]?.availableClaimBasisAmount).toBe('60.0000');
		expect(before.candidates[0]?.taxLines[0]?.taxAmount).toBe('20.0000');

		await expect(service.prepareClaim(actorFinanceA, {
			writeOffPublicId,
			supplyDate: '2026-01-01',
			paymentDueDate: '2026-01-30',
			originalVatPeriodReference: '2026-Q1',
			reason: 'Operator input must not accelerate eligibility.',
			vatAccountedAndPaid: true,
			debtNotSoldOrFactored: true,
			sellingPriceConditionMet: true,
			reliefSchemeApplicable: true,
			lines: [{ sourceInvoiceItemId: invoiceItemId, taxCategoryId, considerationBasisAmount: '60.0000' }]
		})).rejects.toThrow('Payment due date must match the issued invoice due date of 2026-01-31.');

		claimPublicId = (await service.prepareClaim(actorFinanceA, {
			writeOffPublicId,
			supplyDate: '2026-01-01',
			paymentDueDate: '2026-01-31',
			originalVatPeriodReference: '2026-Q1',
			reason: 'Prepare source-linked VAT bad-debt relief.',
			vatAccountedAndPaid: true,
			debtNotSoldOrFactored: true,
			sellingPriceConditionMet: true,
			reliefSchemeApplicable: true,
			lines: [{ sourceInvoiceItemId: invoiceItemId, taxCategoryId, considerationBasisAmount: '60.0000' }]
		})).publicId;

		await expect(service.authoriseClaim(actorFinanceA, { claimPublicId, reason: 'Delegated preparer must not authorise.' })).rejects.toBeInstanceOf(TenantAccessError);
		await expect(new ControlledTaxReliefService(db, randomUUID, () => BEFORE_ELIGIBLE).authoriseClaim(actorOwnerA, { claimPublicId, reason: 'Too early.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await service.authoriseClaim(actorOwnerA, { claimPublicId, reason: 'Eligibility and source evidence revalidated.' });

		const workspace = await service.getWorkspace(actorOwnerA);
		const claim = workspace.claims.find((row) => row.publicId === claimPublicId);
		expect(claim?.status).toBe('authorised');
		expect(claim?.eligibleFrom.toISOString().slice(0, 10)).toBe('2026-07-31');
		expect(claim?.considerationBasisAmount).toBe('60.0000');
		expect(claim?.vatReliefAmount).toBe('10.0000');
		await expect(service.prepareClaim(actorFinanceA, {
			writeOffPublicId,
			supplyDate: '2026-01-01',
			paymentDueDate: '2026-01-31',
			originalVatPeriodReference: '2026-Q1',
			reason: 'Must not overclaim the write-off.',
			vatAccountedAndPaid: true,
			debtNotSoldOrFactored: true,
			sellingPriceConditionMet: true,
			reliefSchemeApplicable: true,
			lines: [{ sourceInvoiceItemId: invoiceItemId, taxCategoryId, considerationBasisAmount: '0.0001' }]
		})).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('records Box 4 posting evidence and honours explicit granular deny above finance.manage', async () => {
		const service = new ControlledTaxReliefService(db, randomUUID, () => NOW);
		const permission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.tax_relief.post').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({ organisation_id: organisationAId, organisation_member_id: ownerAMemberId, permission_id: permission.id, effect: 'deny', reason: 'Integration explicit deny.' }).executeTakeFirstOrThrow();
		await expect(service.recordReturnPosting(actorOwnerA, { sourceKind: 'relief_claim', sourcePublicId: claimPublicId, vatReturnPeriodReference: '2026-Q3', vatReturnPeriodStart: '2026-07-01', vatReturnPeriodEnd: '2026-09-30', externalReference: 'VAT-Q3-DRAFT', reason: 'Explicit deny must win.' })).rejects.toBeInstanceOf(TenantAccessError);
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationAId).where('organisation_member_id', '=', ownerAMemberId).where('permission_id', '=', permission.id).execute();
		claimPostingPublicId = (await service.recordReturnPosting(actorOwnerA, { sourceKind: 'relief_claim', sourcePublicId: claimPublicId, vatReturnPeriodReference: '2026-Q3', vatReturnPeriodStart: '2026-07-01', vatReturnPeriodEnd: '2026-09-30', externalReference: 'VAT-Q3-001', reason: 'Record inclusion in VAT return evidence.' })).publicId;
		const posting = (await service.getWorkspace(actorOwnerA)).claims.find((row) => row.publicId === claimPublicId)?.postings.find((row) => row.publicId === claimPostingPublicId);
		expect(posting?.vatReturnBox).toBe(4);
		expect(posting?.amount).toBe('10.0000');
		await expect(service.reverseClaim(actorOwnerA, { claimPublicId, reason: 'Posting must be reversed first.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(new BadDebtMutationService(db).reverseWriteOff(actorOwnerA, { casePublicId: badDebtCasePublicId, writeOffPublicId, reason: 'VAT claim must be reversed first.' })).rejects.toBeInstanceOf(FinanceValidationError);
	});

	it('records proportional VAT repayment from later bad-debt recovery and requires the VAT period containing the recovery receipt date', async () => {
		recoveryPublicId = randomUUID();
		await db.insertInto('receivable_write_off_recoveries').values({ organisation_id: organisationAId, public_id: recoveryPublicId, write_off_id: writeOffId, payment_id: paymentId, recovered_amount: '30.0000', reason: 'Late customer recovery after VAT relief.', recorded_by_member_id: financeAMemberId, recovered_at: NOW }).executeTakeFirstOrThrow();
		const service = new ControlledTaxReliefService(db, randomUUID, () => NOW);
		await expect(service.recordRepayment(actorFinanceA, { claimPublicId, recoveryPublicId, considerationPaymentAmount: '30.0000', reason: 'Delegated preparation must not record VAT repayment.' })).rejects.toBeInstanceOf(TenantAccessError);
		repaymentPublicId = (await service.recordRepayment(actorOwnerA, { claimPublicId, recoveryPublicId, considerationPaymentAmount: '30.0000', reason: 'Repay VAT proportionally after recovery.' })).publicId;
		const claim = (await service.getWorkspace(actorOwnerA)).claims.find((row) => row.publicId === claimPublicId);
		const repayment = claim?.repayments.find((row) => row.publicId === repaymentPublicId);
		expect(repayment?.vatRepaymentAmount).toBe('5.0000');
		await expect(service.recordReturnPosting(actorOwnerA, { sourceKind: 'relief_repayment', sourcePublicId: repaymentPublicId, vatReturnPeriodReference: '2026-Q2', vatReturnPeriodStart: '2026-04-01', vatReturnPeriodEnd: '2026-06-30', externalReference: 'WRONG-PERIOD', reason: 'Must not post recovery repayment in the wrong period.' })).rejects.toThrow('VAT repayment posting period must include the bad-debt recovery receipt date of 2026-08-18.');
		repaymentPostingPublicId = (await service.recordReturnPosting(actorOwnerA, { sourceKind: 'relief_repayment', sourcePublicId: repaymentPublicId, vatReturnPeriodReference: '2026-Q3', vatReturnPeriodStart: '2026-07-01', vatReturnPeriodEnd: '2026-09-30', externalReference: 'VAT-Q3-RECOVERY-001', reason: 'Record repayment in VAT return evidence.' })).publicId;
		const repaymentPosting = (await service.getWorkspace(actorOwnerA)).claims.find((row) => row.publicId === claimPublicId)?.postings.find((row) => row.publicId === repaymentPostingPublicId);
		expect(repaymentPosting?.vatReturnBox).toBe(1);
		expect(repaymentPosting?.amount).toBe('5.0000');
	});

	it('enforces additive reversal ordering across VAT posting, VAT repayment and operational recovery evidence', async () => {
		const service = new ControlledTaxReliefService(db, randomUUID, () => NOW);
		const badDebt = new BadDebtMutationService(db, randomUUID, () => NOW);
		await expect(badDebt.reverseRecovery(actorOwnerA, { casePublicId: badDebtCasePublicId, recoveryPublicId, reason: 'VAT repayment must be reversed first.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await expect(service.reverseRepayment(actorOwnerA, { repaymentPublicId, reason: 'Posting must be reversed first.' })).rejects.toBeInstanceOf(FinanceValidationError);
		await service.reverseReturnPosting(actorOwnerA, { postingPublicId: repaymentPostingPublicId, reason: 'Correct the VAT repayment posting.' });
		await service.reverseRepayment(actorOwnerA, { repaymentPublicId, reason: 'Reverse VAT repayment before operational recovery correction.' });
		await badDebt.reverseRecovery(actorOwnerA, { casePublicId: badDebtCasePublicId, recoveryPublicId, reason: 'Operational recovery can now be reversed.' });
		const reversal = await db.selectFrom('receivable_write_off_recovery_reversals').select('recovery_id').where('organisation_id', '=', organisationAId).where('recovery_id', '=', (await db.selectFrom('receivable_write_off_recoveries').select('id').where('organisation_id', '=', organisationAId).where('public_id', '=', recoveryPublicId).executeTakeFirstOrThrow()).id).executeTakeFirst();
		expect(reversal).toBeTruthy();
	});

	it('reverses VAT claim evidence before allowing the operational write-off reversal', async () => {
		const service = new ControlledTaxReliefService(db, randomUUID, () => NOW);
		await service.reverseReturnPosting(actorOwnerA, { postingPublicId: claimPostingPublicId, reason: 'Correct the VAT relief posting.' });
		await service.reverseClaim(actorOwnerA, { claimPublicId, reason: 'Reverse VAT relief before reversing the write-off.' });
		await new BadDebtMutationService(db, randomUUID, () => NOW).reverseWriteOff(actorOwnerA, { casePublicId: badDebtCasePublicId, writeOffPublicId, reason: 'Tax and recovery dependencies are now reversed.' });
		const reversal = await db.selectFrom('receivable_write_off_reversals').select('write_off_id').where('organisation_id', '=', organisationAId).where('write_off_id', '=', writeOffId).executeTakeFirst();
		expect(reversal).toBeTruthy();
	});

	it('masks VAT relief claim identities across tenants', async () => {
		await expect(new ControlledTaxReliefService(db, randomUUID, () => NOW).authoriseClaim(actorOwnerB, { claimPublicId, reason: 'Foreign tenant must not see claim.' })).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
