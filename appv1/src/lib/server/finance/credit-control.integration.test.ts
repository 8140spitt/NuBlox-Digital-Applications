import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialValidationError } from '$lib/server/commercial/commercial-service';
import { QuotationProjectConversionService } from '$lib/server/commercial/quotation-project-conversion-service';
import { ContractService, ContractValidationError } from '$lib/server/contracts/contract-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { CreditControlService } from './credit-control-service';

const PREFIX = 'Credit Control Integration ';
const NOW = new Date('2026-08-17T15:30:00.000Z');

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let financeAUserId = '';
let commercialAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let financeAMemberId = '';
let commercialAMemberId = '';
let ownerBMemberId = '';
let actorOwnerA: TenantActorContext;
let actorFinanceA: TenantActorContext;
let actorCommercialA: TenantActorContext;
let actorOwnerB: TenantActorContext;
let salesItemTypeId = 0;
let limitCustomerId = '';
let limitCustomerPublicId = '';
let limitInvoiceId = '';
let quoteCustomerId = '';
let quoteCustomerPublicId = '';
let quotationPublicId = '';
let contractCustomerId = '';
let contractCustomerPublicId = '';
let contractProjectPublicId = '';
let contractPublicId = '';

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
		.deleteFrom('contract_execution_signatories')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('contract_execution_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_issue_recipients').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_issue_events').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('contract_version_party_addresses')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('contract_version_parties').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contract_version_key_dates').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('contract_version_value_components')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('contract_versions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('contracts').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('quotation_project_conversions')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('quotation_responses').where('organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('quotation_party_snapshot_addresses')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('quotation_party_snapshots').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('quotation_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('quotation_versions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('quotations').where('organisation_id', 'in', ids).execute();
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
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('project_members').where('participant_organisation_id', 'in', ids).execute();
	await db
		.deleteFrom('project_organisations')
		.where('participant_organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('projects').where('owning_organisation_id', 'in', ids).execute();
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
				joined_at: new Date('2026-08-17T08:00:00.000Z')
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

async function createCustomer(name: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: publicId,
				party_kind: 'organisation',
				account_owner_member_id: ownerAMemberId,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('party_organisations')
		.values({
			party_id: id,
			organisation_id: organisationAId,
			legal_name: `${PREFIX}${name} Ltd`,
			trading_name: `${PREFIX}${name}`
		})
		.executeTakeFirstOrThrow();
	return { id, publicId };
}

async function createIssuedInvoice(
	customerId: string,
	number: string,
	amount: string
): Promise<string> {
	const id = insertedId(
		await db
			.insertInto('financial_documents')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				document_kind: 'invoice',
				document_number: number,
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
			financial_document_id: id,
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
			financial_document_id: id,
			source_quotation_item_id: null,
			sales_item_type_id: salesItemTypeId,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: `${PREFIX}Exposure`,
			quantity: '1.000000',
			unit_rate: amount
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('financial_document_issue_events')
		.values({
			organisation_id: organisationAId,
			financial_document_id: id,
			issue_sequence: 1,
			issued_by_member_id: ownerAMemberId,
			delivery_channel: 'manual',
			issued_at: new Date('2026-08-01T09:00:00.000Z'),
			note: null
		})
		.executeTakeFirstOrThrow();
	return id;
}

async function createAcceptedQuotation(
	customerId: string,
	number: string,
	title: string
): Promise<{ quotationPublicId: string; responseId: string; versionId: string }> {
	const quotationPublicId = randomUUID();
	const quotationId = insertedId(
		await db
			.insertInto('quotations')
			.values({
				organisation_id: organisationAId,
				public_id: quotationPublicId,
				quotation_number: number,
				opportunity_id: null,
				project_id: null,
				customer_party_id: customerId,
				primary_contact_party_id: null,
				owner_member_id: ownerAMemberId,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const versionId = insertedId(
		await db
			.insertInto('quotation_versions')
			.values({
				organisation_id: organisationAId,
				quotation_id: quotationId,
				version_number: 1,
				title,
				currency_code: 'GBP',
				customer_reference: null,
				version_status: 'issued',
				created_by_member_id: ownerAMemberId,
				locked_by_member_id: ownerAMemberId,
				locked_at: new Date('2026-08-17T10:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const responseId = insertedId(
		await db
			.insertInto('quotation_responses')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				quotation_id: quotationId,
				quotation_version_id: versionId,
				quotation_issue_event_id: null,
				response_type: 'accepted',
				responded_at: new Date('2026-08-17T10:05:00.000Z'),
				responding_party_id: customerId,
				respondent_name: `${PREFIX}Signatory`,
				respondent_email: 'signatory@example.test',
				recorded_by_member_id: ownerAMemberId,
				notes: 'Accepted.'
			})
			.executeTakeFirstOrThrow()
	);
	return { quotationPublicId, responseId, versionId };
}

async function createAcceptedProjectFixture(customerId: string): Promise<string> {
	const source = await createAcceptedQuotation(
		customerId,
		'QUO-CCR-002',
		`${PREFIX}Contract Works`
	);
	await db
		.insertInto('quotation_items')
		.values({
			organisation_id: organisationAId,
			quotation_version_id: source.versionId,
			quotation_section_id: null,
			source_estimate_item_id: null,
			sales_item_type_id: salesItemTypeId,
			sales_catalog_item_id: null,
			unit_of_measure_id: null,
			line_number: 1,
			description: 'Contract scope',
			quantity: '10.000000',
			unit_rate: '125.0000',
			is_optional: 0
		})
		.executeTakeFirstOrThrow();
	const snapshotId = insertedId(
		await db
			.insertInto('quotation_party_snapshots')
			.values({
				organisation_id: organisationAId,
				quotation_version_id: source.versionId,
				source_party_id: customerId,
				snapshot_role: 'customer',
				display_name: `${PREFIX}Contract Customer Ltd`,
				email: 'contracts@example.test',
				phone: null,
				reference_identifier: 'CCR-002',
				sort_order: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('quotation_party_snapshot_addresses')
		.values({
			organisation_id: organisationAId,
			quotation_party_snapshot_id: snapshotId,
			quotation_version_id: source.versionId,
			address_role: 'business',
			line_1: '1 Credit Street',
			city: 'London',
			postal_code: 'SW1A 1AA',
			country_code: 'GB'
		})
		.executeTakeFirstOrThrow();
	const projectPublicId = randomUUID();
	const projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: 'PRJ-CCR-002',
				name: `${PREFIX}Contract Project`,
				description: 'Credit-control contract fixture.',
				status: 'proposed',
				created_by_member_id: ownerAMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values({
			project_id: projectId,
			participant_organisation_id: organisationAId,
			status: 'active',
			invited_by_member_id: null,
			joined_at: new Date('2026-08-17T10:10:00.000Z'),
			left_at: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('project_members')
		.values({
			project_id: projectId,
			participant_organisation_id: organisationAId,
			organisation_member_id: ownerAMemberId,
			status: 'active',
			joined_at: new Date('2026-08-17T10:10:00.000Z'),
			left_at: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('quotation_project_conversions')
		.values({
			organisation_id: organisationAId,
			quotation_response_id: source.responseId,
			project_id: projectId,
			created_by_member_id: ownerAMemberId
		})
		.executeTakeFirstOrThrow();
	await db
		.updateTable('quotations')
		.set({ project_id: projectId })
		.where('organisation_id', '=', organisationAId)
		.where('public_id', '=', source.quotationPublicId)
		.executeTakeFirstOrThrow();
	return projectPublicId;
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	financeAUserId = await createUser('Finance A');
	commercialAUserId = await createUser('Commercial A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	financeAMemberId = await createMember(organisationAId, financeAUserId);
	commercialAMemberId = await createMember(organisationAId, commercialAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	const ownerPermissions = [
		'crm.view',
		'commercial.view',
		'commercial.manage',
		'project.create',
		'project.view',
		'contract.view',
		'contract.manage',
		'finance.view',
		'finance.manage'
	];
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', ownerPermissions);
	await assignRole(organisationAId, financeAMemberId, 'Finance A', [
		'finance.view',
		'finance.credit_control.view',
		'finance.credit_control.policy.manage',
		'finance.credit_control.hold.manage'
	]);
	await assignRole(organisationAId, commercialAMemberId, 'Commercial A', [
		'commercial.view',
		'commercial.quotation.convert',
		'project.create'
	]);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', ownerPermissions);
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
	actorCommercialA = {
		organisationId: organisationAId,
		userId: commercialAUserId,
		memberId: commercialAMemberId,
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
			.orderBy('id')
			.executeTakeFirstOrThrow()
	).id;
	({ id: limitCustomerId, publicId: limitCustomerPublicId } =
		await createCustomer('Limit Customer'));
	limitInvoiceId = await createIssuedInvoice(limitCustomerId, 'INV-CCR-001', '120.0000');
	({ id: quoteCustomerId, publicId: quoteCustomerPublicId } =
		await createCustomer('Quote Customer'));
	quotationPublicId = (
		await createAcceptedQuotation(quoteCustomerId, 'QUO-CCR-001', `${PREFIX}Quote Works`)
	).quotationPublicId;
	({ id: contractCustomerId, publicId: contractCustomerPublicId } =
		await createCustomer('Contract Customer'));
	contractProjectPublicId = await createAcceptedProjectFixture(contractCustomerId);
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe.sequential('Package 004I controlled credit limits and holds', () => {
	it('delegates limit and hold management without granting exceptional override authority', async () => {
		const service = new CreditControlService(db, randomUUID, () => NOW);
		await service.setLimit(actorFinanceA, {
			customerPartyPublicId: limitCustomerPublicId,
			currencyCode: 'GBP',
			limitAmount: '100.0000',
			reason: 'Initial risk appetite.'
		});
		const revision = await service.setLimit(actorFinanceA, {
			customerPartyPublicId: limitCustomerPublicId,
			currencyCode: 'GBP',
			limitAmount: '110.0000',
			reason: 'Reviewed limit.'
		});
		expect(revision.versionNumber).toBe(2);
		const workspace = await service.getWorkspace(actorFinanceA);
		expect(workspace.canManagePolicies).toBe(true);
		expect(workspace.canManageHolds).toBe(true);
		expect(workspace.canOverride).toBe(false);
		const policy = workspace.policies.find(
			(item) => item.customerPartyPublicId === limitCustomerPublicId
		);
		expect(policy).toMatchObject({
			versionNumber: 2,
			creditLimitAmount: '110.0000',
			outstandingAmount: '120.0000',
			limitExhausted: true
		});
		const revisions = await db
			.selectFrom('receivable_credit_policy_revisions')
			.select('version_number as versionNumber')
			.where('organisation_id', '=', organisationAId)
			.where('credit_policy_id', '=', policy!.id)
			.orderBy('version_number')
			.execute();
		expect(revisions.map((item) => item.versionNumber)).toEqual([1, 2]);
	});

	it('derives utilisation from authoritative issued receivable facts rather than a stored used-credit balance', async () => {
		let preview = await new CreditControlService(db).commitmentPreview(
			actorFinanceA,
			limitCustomerId,
			'GBP'
		);
		expect(preview).toMatchObject({
			blocked: true,
			limitExhausted: true,
			outstandingAmount: '120.0000',
			creditLimitAmount: '110.0000'
		});
		await db
			.updateTable('financial_documents')
			.set({
				lifecycle_status: 'void',
				voided_by_member_id: ownerAMemberId,
				voided_at: NOW,
				void_reason: 'Integration receivable derivation.'
			})
			.where('organisation_id', '=', organisationAId)
			.where('id', '=', limitInvoiceId)
			.executeTakeFirstOrThrow();
		preview = await new CreditControlService(db).commitmentPreview(
			actorFinanceA,
			limitCustomerId,
			'GBP'
		);
		expect(preview).toMatchObject({
			blocked: false,
			limitExhausted: false,
			outstandingAmount: '0.0000',
			creditLimitAmount: '110.0000'
		});
	});

	it('makes one active customer hold idempotent and records controlled release evidence', async () => {
		const service = new CreditControlService(db, randomUUID, () => NOW);
		const first = await service.placeHold(actorFinanceA, {
			customerPartyPublicId: quoteCustomerPublicId,
			reason: 'Customer account requires review.'
		});
		const retry = await service.placeHold(actorFinanceA, {
			customerPartyPublicId: quoteCustomerPublicId,
			reason: 'Retry should not duplicate.'
		});
		expect(retry).toBe(first);
		let active = await db
			.selectFrom('receivable_credit_holds')
			.select(['public_id as publicId', 'status'])
			.where('organisation_id', '=', organisationAId)
			.where('customer_party_id', '=', quoteCustomerId)
			.where('status', '=', 'active')
			.execute();
		expect(active).toEqual([{ publicId: first, status: 'active' }]);
		await service.releaseHold(actorFinanceA, { holdPublicId: first, reason: 'Review completed.' });
		active = await db
			.selectFrom('receivable_credit_holds')
			.select(['public_id as publicId', 'status'])
			.where('organisation_id', '=', organisationAId)
			.where('customer_party_id', '=', quoteCustomerId)
			.where('status', '=', 'active')
			.execute();
		expect(active).toHaveLength(0);
		await service.placeHold(actorFinanceA, {
			customerPartyPublicId: quoteCustomerPublicId,
			reason: 'New stop-trading decision.'
		});
	});

	it('blocks accepted-quotation conversion for ordinary commercial authority, masks finance details, and records one transactional owner override', async () => {
		const conversion = new QuotationProjectConversionService(db, randomUUID, () => NOW);
		const workspace = await conversion.getWorkspace(actorCommercialA, quotationPublicId, 1);
		expect(workspace.creditControl).toMatchObject({
			blocked: true,
			hasActiveHold: true,
			detailsVisible: false,
			outstandingAmount: null,
			creditLimitAmount: null,
			canOverride: false
		});
		expect(workspace.canConvert).toBe(false);
		await expect(
			conversion.convert(actorCommercialA, quotationPublicId, 1, 'Commercial user cannot override.')
		).rejects.toBeInstanceOf(CommercialValidationError);
		await expect(conversion.convert(actorOwnerA, quotationPublicId, 1)).rejects.toBeInstanceOf(
			CommercialValidationError
		);
		const project = await conversion.convert(
			actorOwnerA,
			quotationPublicId,
			1,
			'Owner authorises commitment while the customer hold is reviewed.'
		);
		const retried = await conversion.convert(actorOwnerA, quotationPublicId, 1);
		expect(retried.publicId).toBe(project.publicId);
		const overrides = await db
			.selectFrom('receivable_credit_control_overrides')
			.select(['workflow_type as workflowType', 'subject_public_id as subjectPublicId'])
			.where('organisation_id', '=', organisationAId)
			.where('workflow_type', '=', 'quotation_conversion')
			.where('subject_public_id', '=', quotationPublicId)
			.execute();
		expect(overrides).toEqual([
			{ workflowType: 'quotation_conversion', subjectPublicId: quotationPublicId }
		]);
	});

	it('allows contract issue under a hold but blocks execution until a separately authorised reasoned override is recorded', async () => {
		const contracts = new ContractService(db, randomUUID, () => NOW);
		const created = await contracts.createFromProject(actorOwnerA, {
			projectPublicId: contractProjectPublicId,
			contractTypeCode: 'construction_contract',
			title: `${PREFIX}Controlled Contract`,
			customerReference: 'CCR-002'
		});
		contractPublicId = created.publicId;
		await contracts.addKeyDate(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			typeCode: 'commencement',
			label: 'Commencement',
			dateValue: '2026-09-01'
		});
		await new CreditControlService(db, randomUUID, () => NOW).placeHold(actorFinanceA, {
			customerPartyPublicId: contractCustomerPublicId,
			reason: 'Stop new contractual commitment.'
		});
		await contracts.issue(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			deliveryChannel: 'manual',
			recipientName: `${PREFIX}Contract Signatory`,
			recipientEmail: 'contract@example.test',
			note: 'Issue remains permitted under hold.'
		});
		await expect(
			contracts.execute(actorOwnerA, {
				contractPublicId,
				versionNumber: 1,
				executionMethod: 'manual',
				executedAt: '2026-08-17T15:35:00.000Z',
				signatoryName: `${PREFIX}Contract Signatory`,
				signatoryEmail: 'contract@example.test',
				signingRole: 'Director',
				externalTransactionReference: 'CCR-EXEC-1',
				note: 'Should block.'
			})
		).rejects.toBeInstanceOf(ContractValidationError);
		const permission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.credit_control.override')
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
			contracts.execute(actorOwnerA, {
				contractPublicId,
				versionNumber: 1,
				executionMethod: 'manual',
				executedAt: '2026-08-17T15:35:00.000Z',
				signatoryName: `${PREFIX}Contract Signatory`,
				signingRole: 'Director',
				creditOverrideReason: 'Explicit deny must beat finance.manage.'
			})
		).rejects.toBeInstanceOf(ContractValidationError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationAId)
			.where('organisation_member_id', '=', ownerAMemberId)
			.where('permission_id', '=', permission.id)
			.execute();
		await contracts.execute(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			executionMethod: 'manual',
			executedAt: '2026-08-17T15:35:00.000Z',
			signatoryName: `${PREFIX}Contract Signatory`,
			signatoryEmail: 'contract@example.test',
			signingRole: 'Director',
			externalTransactionReference: 'CCR-EXEC-2',
			note: 'Authorised execution.',
			creditOverrideReason: 'Owner authorises contract execution while hold remains active.'
		});
		const execution = await db
			.selectFrom('contract_execution_events')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where(
				'contract_version_id',
				'=',
				(
					await db
						.selectFrom('contract_versions')
						.select('id')
						.where('organisation_id', '=', organisationAId)
						.where('contract_id', '=', created.id)
						.where('version_number', '=', 1)
						.executeTakeFirstOrThrow()
				).id
			)
			.execute();
		expect(execution).toHaveLength(1);
		const overrides = await db
			.selectFrom('receivable_credit_control_overrides')
			.select('workflow_type as workflowType')
			.where('organisation_id', '=', organisationAId)
			.where('workflow_type', '=', 'contract_execution')
			.where('subject_public_id', '=', contractPublicId)
			.execute();
		expect(overrides).toEqual([{ workflowType: 'contract_execution' }]);
	});

	it('rolls override evidence back with a failed surrounding transaction and tenant-masks foreign customer identity', async () => {
		const service = new CreditControlService(db, randomUUID, () => NOW);
		const hold = await service.placeHold(actorFinanceA, {
			customerPartyPublicId: limitCustomerPublicId,
			reason: 'Rollback fixture hold.'
		});
		await expect(
			db.transaction().execute(async (trx) => {
				await service.enforceCommitment(
					actorOwnerA,
					{
						customerPartyId: limitCustomerId,
						currencyCode: 'GBP',
						workflowType: 'contract_execution',
						subjectPublicId: 'rollback-subject',
						overrideReason: 'This evidence must roll back.'
					},
					trx
				);
				throw new Error('Force rollback');
			})
		).rejects.toThrow('Force rollback');
		const persisted = await db
			.selectFrom('receivable_credit_control_overrides')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('subject_public_id', '=', 'rollback-subject')
			.execute();
		expect(persisted).toHaveLength(0);
		await expect(
			service.commitmentPreview(actorOwnerB, limitCustomerId, 'GBP')
		).rejects.toBeInstanceOf(RecordNotFoundError);
		await expect(
			new CreditControlService(db).releaseHold(actorOwnerB, {
				holdPublicId: hold,
				reason: 'Foreign tenant attempt.'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
