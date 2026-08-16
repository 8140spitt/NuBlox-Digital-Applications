import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ContractService, ContractValidationError } from './contract-service';

const PREFIX = 'Contract Formation Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let readOnlyAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let readOnlyAMemberId = '';
let ownerBMemberId = '';
let projectPublicId = '';
let contractPublicId = '';
let actorOwnerA: TenantActorContext;
let actorReadOnlyA: TenantActorContext;
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
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length === 0) return;

	await db.deleteFrom('contract_execution_signatories').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_execution_events').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_issue_recipients').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_issue_events').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_version_party_addresses').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_version_parties').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_version_key_dates').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_version_value_components').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contract_versions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('contracts').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_project_conversions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_responses').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_party_snapshot_addresses').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_party_snapshots').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_items').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotation_versions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('quotations').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('project_members').where('participant_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('project_organisations').where('participant_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('projects').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
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
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, status: 'active' })
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
				joined_at: new Date('2026-08-16T00:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignRole(
	organisationId: string,
	memberId: string,
	name: string,
	permissionKeys: string[]
): Promise<void> {
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

async function createAcceptedProjectFixture(): Promise<void> {
	const customerPartyId = insertedId(
		await db
			.insertInto('parties')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				party_kind: 'organisation',
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
			trading_name: `${PREFIX}Client`
		})
		.executeTakeFirstOrThrow();

	const quotationId = insertedId(
		await db
			.insertInto('quotations')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				quotation_number: 'QUO-CTR-001',
				opportunity_id: null,
				project_id: null,
				customer_party_id: customerPartyId,
				primary_contact_party_id: null,
				owner_member_id: ownerAMemberId,
				lifecycle_status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const quotationVersionId = insertedId(
		await db
			.insertInto('quotation_versions')
			.values({
				organisation_id: organisationAId,
				quotation_id: quotationId,
				version_number: 1,
				title: `${PREFIX}Accepted Works`,
				currency_code: 'GBP',
				customer_reference: 'CLIENT-001',
				version_status: 'issued',
				created_by_member_id: ownerAMemberId,
				locked_by_member_id: ownerAMemberId,
				locked_at: new Date('2026-08-16T00:20:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const labour = await db
		.selectFrom('sales_item_types')
		.select('id')
		.where('code', '=', 'labour')
		.executeTakeFirstOrThrow();
	const hour = await db
		.selectFrom('units_of_measure')
		.select('id')
		.where('code', '=', 'hour')
		.executeTakeFirstOrThrow();
	await db
		.insertInto('quotation_items')
		.values({
			organisation_id: organisationAId,
			quotation_version_id: quotationVersionId,
			quotation_section_id: null,
			source_estimate_item_id: null,
			sales_item_type_id: labour.id,
			sales_catalog_item_id: null,
			unit_of_measure_id: hour.id,
			line_number: 1,
			description: 'Accepted contract scope',
			quantity: '10.000000',
			unit_rate: '125.0000',
			is_optional: 0
		})
		.executeTakeFirstOrThrow();
	const customerSnapshotId = insertedId(
		await db
			.insertInto('quotation_party_snapshots')
			.values({
				organisation_id: organisationAId,
				quotation_version_id: quotationVersionId,
				source_party_id: customerPartyId,
				snapshot_role: 'customer',
				display_name: `${PREFIX}Client Ltd`,
				email: 'contracts@example.test',
				phone: null,
				reference_identifier: 'CLIENT-001',
				sort_order: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('quotation_party_snapshot_addresses')
		.values({
			organisation_id: organisationAId,
			quotation_party_snapshot_id: customerSnapshotId,
			quotation_version_id: quotationVersionId,
			address_role: 'business',
			line_1: '1 Contract Street',
			city: 'London',
			postal_code: 'SW1A 1AA',
			country_code: 'GB'
		})
		.executeTakeFirstOrThrow();

	const responseId = insertedId(
		await db
			.insertInto('quotation_responses')
			.values({
				organisation_id: organisationAId,
				public_id: randomUUID(),
				quotation_id: quotationId,
				quotation_version_id: quotationVersionId,
				quotation_issue_event_id: null,
				response_type: 'accepted',
				responded_at: new Date('2026-08-16T00:25:00.000Z'),
				responding_party_id: customerPartyId,
				respondent_name: `${PREFIX}Client Signatory`,
				respondent_email: 'signatory@example.test',
				recorded_by_member_id: ownerAMemberId,
				notes: 'Accepted for contract formation.'
			})
			.executeTakeFirstOrThrow()
	);
	projectPublicId = randomUUID();
	const projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: 'PRJ-CTR-001',
				name: `${PREFIX}Project`,
				description: 'Created from accepted quotation.',
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
			joined_at: new Date('2026-08-16T00:30:00.000Z'),
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
			joined_at: new Date('2026-08-16T00:30:00.000Z'),
			left_at: null
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('quotation_project_conversions')
		.values({
			organisation_id: organisationAId,
			quotation_response_id: responseId,
			project_id: projectId,
			created_by_member_id: ownerAMemberId
		})
		.executeTakeFirstOrThrow();
	await db
		.updateTable('quotations')
		.set({ project_id: projectId })
		.where('id', '=', quotationId)
		.where('organisation_id', '=', organisationAId)
		.executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	readOnlyAUserId = await createUser('Read A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	readOnlyAMemberId = await createMember(organisationAId, readOnlyAUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);
	await assignRole(organisationAId, ownerAMemberId, 'Owner A', [
		'project.view',
		'commercial.view',
		'commercial.manage'
	]);
	await assignRole(organisationAId, readOnlyAMemberId, 'Read A', ['contract.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', [
		'project.view',
		'commercial.view',
		'commercial.manage'
	]);
	actorOwnerA = {
		organisationId: organisationAId,
		userId: ownerAUserId,
		memberId: ownerAMemberId,
		correlationId: randomUUID()
	};
	actorReadOnlyA = {
		organisationId: organisationAId,
		userId: readOnlyAUserId,
		memberId: readOnlyAMemberId,
		correlationId: randomUUID()
	};
	actorOwnerB = {
		organisationId: organisationBId,
		userId: ownerBUserId,
		memberId: ownerBMemberId,
		correlationId: randomUUID()
	};
	await createAcceptedProjectFixture();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('controlled Package 004 contract formation', () => {
	it('forms one draft contract from the accepted quotation project with immutable source provenance', async () => {
		const service = new ContractService(db, randomUUID, () => new Date('2026-08-16T00:40:00.000Z'));
		const formation = await service.getFormationWorkspace(actorOwnerA, projectPublicId);
		expect(formation.canCreate).toBe(true);
		expect(formation.quotation.netAmount).toBe('1250.0000');
		expect(formation.existingContract).toBeNull();

		const created = await service.createFromProject(actorOwnerA, {
			projectPublicId,
			contractTypeCode: 'construction_contract',
			title: `${PREFIX}Construction Contract`,
			customerReference: 'CLIENT-001'
		});
		contractPublicId = created.publicId;
		expect(created.contractNumber).toBe('CON-CTR-001');
		expect(created.lifecycleStatus).toBe('draft');

		const workspace = await service.getWorkspace(actorOwnerA, contractPublicId);
		expect(workspace.version).toMatchObject({ versionNumber: 1, versionStatus: 'draft' });
		expect(workspace.parties).toHaveLength(1);
		expect(workspace.parties[0]).toMatchObject({
			roleCode: 'client',
			displayName: `${PREFIX}Client Ltd`
		});
		expect(workspace.valueComponents).toHaveLength(1);
		expect(workspace.valueComponents[0]).toMatchObject({ typeCode: 'base_scope', amount: '1250.0000' });
		expect(workspace.contract.sourceQuotationNumber).toBe('QUO-CTR-001');

		const address = await db
			.selectFrom('contract_version_party_addresses')
			.select(['line_1 as line1', 'city', 'country_code as countryCode'])
			.where('organisation_id', '=', organisationAId)
			.executeTakeFirstOrThrow();
		expect(address).toEqual({ line1: '1 Contract Street', city: 'London', countryCode: 'GB' });
	});

	it('is idempotent for the exact project and accepted-response source and enforces granular authority', async () => {
		const service = new ContractService(db);
		const retried = await service.createFromProject(actorOwnerA, {
			projectPublicId,
			contractTypeCode: 'construction_contract',
			title: 'A retry must not create another contract'
		});
		expect(retried.publicId).toBe(contractPublicId);
		const count = await db
			.selectFrom('contracts')
			.select(({ fn }) => fn.countAll<string>().as('count'))
			.where('organisation_id', '=', organisationAId)
			.executeTakeFirstOrThrow();
		expect(Number(count.count)).toBe(1);
		await expect(
			service.addValueComponent(actorReadOnlyA, {
				contractPublicId,
				versionNumber: 1,
				typeCode: 'contingency',
				amount: '100.0000'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('supports controlled draft values/key dates then locks the issued version', async () => {
		const service = new ContractService(db, randomUUID, () => new Date('2026-08-16T00:50:00.000Z'));
		await service.updateDraft(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			title: `${PREFIX}Executed Works Contract`,
			customerReference: 'CLIENT-CONTRACT-42'
		});
		await service.addValueComponent(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			typeCode: 'contingency',
			description: 'Controlled contingency',
			amount: '100.0000'
		});
		await service.addKeyDate(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			typeCode: 'commencement',
			label: 'Contract commencement',
			dateValue: '2026-09-01'
		});
		await service.issue(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			deliveryChannel: 'manual',
			recipientName: `${PREFIX}Client Signatory`,
			recipientEmail: 'signatory@example.test',
			note: 'Issued for execution.'
		});

		const issued = await service.getWorkspace(actorOwnerA, contractPublicId);
		expect(issued.version.versionStatus).toBe('issued');
		expect(issued.version.lockedAt).not.toBeNull();
		expect(issued.contract.lifecycleStatus).toBe('under_review');
		expect(issued.valueComponents).toHaveLength(2);
		expect(issued.keyDates).toHaveLength(1);
		expect(issued.issueEvents).toHaveLength(1);
		expect(issued.issueEvents[0]?.deliveryStatus).toBe('acknowledged');
		await expect(
			service.updateDraft(actorOwnerA, {
				contractPublicId,
				versionNumber: 1,
				title: 'Forbidden issued edit'
			})
		).rejects.toBeInstanceOf(ContractValidationError);
	});

	it('records execution evidence and activates the contract without activating the project', async () => {
		const service = new ContractService(db);
		await service.execute(actorOwnerA, {
			contractPublicId,
			versionNumber: 1,
			executionMethod: 'manual',
			executedAt: '2026-08-16T01:00:00.000Z',
			signatoryName: `${PREFIX}Client Signatory`,
			signatoryEmail: 'signatory@example.test',
			signingRole: 'Director',
			externalTransactionReference: 'SIGNED-001',
			note: 'Signed counterpart received.'
		});
		const executed = await service.getWorkspace(actorOwnerA, contractPublicId);
		expect(executed.version.versionStatus).toBe('executed');
		expect(executed.contract.lifecycleStatus).toBe('active');
		expect(executed.execution?.externalTransactionReference).toBe('SIGNED-001');
		expect(executed.execution?.signatories[0]?.signatoryName).toBe(`${PREFIX}Client Signatory`);
		const project = await db
			.selectFrom('projects')
			.select('status')
			.where('owning_organisation_id', '=', organisationAId)
			.where('public_id', '=', projectPublicId)
			.executeTakeFirstOrThrow();
		expect(project.status).toBe('proposed');
	});

	it('masks foreign-tenant contract identity', async () => {
		await expect(new ContractService(db).getWorkspace(actorOwnerB, contractPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
