import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ContractAmendmentService,
	ContractAmendmentValidationError
} from './contract-amendment-service';

const PREFIX = 'Contract Amendment Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let readOnlyAUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let readOnlyAMemberId = '';
let ownerBMemberId = '';
let executedContractPublicId = '';
let draftContractPublicId = '';
let amendmentPublicId = '';
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
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;

	await db
		.deleteFrom('contract_amendment_key_date_changes')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('contract_amendment_value_adjustments')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('contract_amendments').where('organisation_id', 'in', ids).execute();
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
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
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
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}${name}`,
				status: 'active'
			})
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
				joined_at: new Date('2026-08-16T01:00:00.000Z')
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

async function createContractFixture(input: {
	organisationId: string;
	ownerMemberId: string;
	contractNumber: string;
	executed: boolean;
}): Promise<string> {
	const type = await db
		.selectFrom('contract_types')
		.select('id')
		.where('code', '=', 'construction_contract')
		.executeTakeFirstOrThrow();
	const publicId = randomUUID();
	const contractId = insertedId(
		await db
			.insertInto('contracts')
			.values({
				organisation_id: input.organisationId,
				public_id: publicId,
				contract_number: input.contractNumber,
				contract_type_id: type.id,
				project_id: null,
				opportunity_id: null,
				source_quotation_response_id: null,
				owner_member_id: input.ownerMemberId,
				title: `${PREFIX}${input.contractNumber}`,
				currency_code: 'GBP',
				lifecycle_status: input.executed ? 'active' : 'draft'
			})
			.executeTakeFirstOrThrow()
	);
	const versionId = insertedId(
		await db
			.insertInto('contract_versions')
			.values({
				organisation_id: input.organisationId,
				contract_id: contractId,
				version_number: 1,
				title: `${PREFIX}${input.contractNumber}`,
				customer_reference: null,
				version_status: input.executed ? 'executed' : 'draft',
				created_by_member_id: input.ownerMemberId,
				locked_by_member_id: input.executed ? input.ownerMemberId : null,
				locked_at: input.executed ? new Date('2026-08-16T01:10:00.000Z') : null
			})
			.executeTakeFirstOrThrow()
	);
	if (input.executed) {
		const baseScope = await db
			.selectFrom('contract_value_component_types')
			.select('id')
			.where('code', '=', 'base_scope')
			.executeTakeFirstOrThrow();
		const contingency = await db
			.selectFrom('contract_value_component_types')
			.select('id')
			.where('code', '=', 'contingency')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('contract_version_value_components')
			.values([
				{
					organisation_id: input.organisationId,
					contract_version_id: versionId,
					contract_value_component_type_id: baseScope.id,
					description: 'Executed base scope',
					amount: '1250.0000',
					sort_order: 1
				},
				{
					organisation_id: input.organisationId,
					contract_version_id: versionId,
					contract_value_component_type_id: contingency.id,
					description: 'Executed contingency',
					amount: '100.0000',
					sort_order: 2
				}
			])
			.execute();
	}
	return publicId;
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
		'contract.view',
		'contract.manage'
	]);
	await assignRole(organisationAId, readOnlyAMemberId, 'Read A', ['contract.view']);
	await assignRole(organisationBId, ownerBMemberId, 'Owner B', [
		'contract.view',
		'contract.manage'
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
	executedContractPublicId = await createContractFixture({
		organisationId: organisationAId,
		ownerMemberId: ownerAMemberId,
		contractNumber: 'CON-AMD-001',
		executed: true
	});
	draftContractPublicId = await createContractFixture({
		organisationId: organisationAId,
		ownerMemberId: ownerAMemberId,
		contractNumber: 'CON-AMD-002',
		executed: false
	});
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('controlled Package 004 contract amendments', () => {
	it('requires an active executed baseline and exposes the derived baseline value', async () => {
		const service = new ContractAmendmentService(db);
		const list = await service.listForContract(actorOwnerA, executedContractPublicId);
		expect(list.canCreate).toBe(true);
		expect(list.baselineValue).toBe('1350.0000');
		expect(list.agreedAdjustmentTotal).toBe('0.0000');
		expect(list.currentContractValue).toBe('1350.0000');
		await expect(
			service.create(actorOwnerA, {
				contractPublicId: draftContractPublicId,
				typeCode: 'scope_change',
				title: 'Invalid pre-execution amendment',
				effectiveOn: '2026-09-01'
			})
		).rejects.toBeInstanceOf(ContractAmendmentValidationError);
	});

	it('creates and maintains a draft with signed value and key-date changes without changing current value', async () => {
		const service = new ContractAmendmentService(
			db,
			randomUUID,
			() => new Date('2026-08-16T01:20:00.000Z')
		);
		const created = await service.create(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			typeCode: 'value_change',
			title: 'Client instructed scope increase',
			description: 'Add instructed works and revise completion.',
			effectiveOn: '2026-09-15'
		});
		amendmentPublicId = created.publicId;
		expect(created).toMatchObject({ amendmentNumber: 'AMD-001', lifecycleStatus: 'draft' });
		await service.addValueAdjustment(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			amendmentPublicId,
			typeCode: 'base_scope',
			description: 'Additional instructed works',
			adjustmentAmount: '250.0000'
		});
		await service.addValueAdjustment(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			amendmentPublicId,
			typeCode: 'contingency',
			description: 'Release part of contingency',
			adjustmentAmount: '-50.0000'
		});
		await service.addKeyDateChange(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			amendmentPublicId,
			typeCode: 'completion',
			label: 'Revised completion',
			newDate: '2026-10-31'
		});
		const workspace = await service.getWorkspace(
			actorOwnerA,
			executedContractPublicId,
			amendmentPublicId
		);
		expect(workspace.valueAdjustments.map((row) => row.adjustmentAmount)).toEqual([
			'250.0000',
			'-50.0000'
		]);
		expect(workspace.keyDateChanges[0]).toMatchObject({ typeCode: 'completion' });
		expect(workspace.currentContractValue).toBe('1350.0000');
	});

	it('enforces contract authority and masks foreign-tenant amendment identity', async () => {
		const service = new ContractAmendmentService(db);
		await expect(
			service.addValueAdjustment(actorReadOnlyA, {
				contractPublicId: executedContractPublicId,
				amendmentPublicId,
				typeCode: 'base_scope',
				adjustmentAmount: '10.0000'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(
			service.getWorkspace(actorOwnerB, executedContractPublicId, amendmentPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('issues an immutable amendment then agreement updates the derived current contract value', async () => {
		const issueService = new ContractAmendmentService(
			db,
			randomUUID,
			() => new Date('2026-08-16T01:30:00.000Z')
		);
		await issueService.issue(actorOwnerA, executedContractPublicId, amendmentPublicId);
		const issued = await issueService.getWorkspace(
			actorOwnerA,
			executedContractPublicId,
			amendmentPublicId
		);
		expect(issued.amendment.lifecycleStatus).toBe('issued');
		expect(issued.amendment.issuedAt).not.toBeNull();
		await expect(
			issueService.updateDraft(actorOwnerA, {
				contractPublicId: executedContractPublicId,
				amendmentPublicId,
				typeCode: 'terms_change',
				title: 'Forbidden issued edit'
			})
		).rejects.toBeInstanceOf(ContractAmendmentValidationError);

		const decisionService = new ContractAmendmentService(
			db,
			randomUUID,
			() => new Date('2026-08-16T01:40:00.000Z')
		);
		await decisionService.decide(
			actorOwnerA,
			executedContractPublicId,
			amendmentPublicId,
			'agreed'
		);
		const agreed = await decisionService.getWorkspace(
			actorOwnerA,
			executedContractPublicId,
			amendmentPublicId
		);
		expect(agreed.amendment.lifecycleStatus).toBe('agreed');
		expect(agreed.agreedAdjustmentTotal).toBe('200.0000');
		expect(agreed.currentContractValue).toBe('1550.0000');
	});

	it('keeps rejected and withdrawn amendments as history without changing current contract value', async () => {
		const service = new ContractAmendmentService(
			db,
			randomUUID,
			() => new Date('2026-08-16T01:50:00.000Z')
		);
		const rejected = await service.create(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			typeCode: 'value_change',
			title: 'Rejected increase',
			description: 'Customer did not agree this change.',
			effectiveOn: '2026-10-01'
		});
		await service.addValueAdjustment(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			amendmentPublicId: rejected.publicId,
			typeCode: 'base_scope',
			adjustmentAmount: '500.0000'
		});
		await service.issue(actorOwnerA, executedContractPublicId, rejected.publicId);
		await service.decide(actorOwnerA, executedContractPublicId, rejected.publicId, 'rejected');

		const withdrawn = await service.create(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			typeCode: 'date_change',
			title: 'Withdrawn programme proposal',
			description: 'Superseded before issue.',
			effectiveOn: '2026-10-15'
		});
		await service.withdraw(actorOwnerA, executedContractPublicId, withdrawn.publicId);

		const list = await service.listForContract(actorOwnerA, executedContractPublicId);
		expect(list.items.find((row) => row.publicId === rejected.publicId)?.lifecycleStatus).toBe(
			'rejected'
		);
		expect(list.items.find((row) => row.publicId === withdrawn.publicId)?.lifecycleStatus).toBe(
			'withdrawn'
		);
		expect(list.agreedAdjustmentTotal).toBe('200.0000');
		expect(list.currentContractValue).toBe('1550.0000');
	});

	it('refuses to issue a draft amendment without an effective date', async () => {
		const service = new ContractAmendmentService(
			db,
			randomUUID,
			() => new Date('2026-08-16T02:00:00.000Z')
		);
		const missingDate = await service.create(actorOwnerA, {
			contractPublicId: executedContractPublicId,
			typeCode: 'terms_change',
			title: 'Missing effective date',
			description:
				'This amendment has content but cannot be issued until its effective date is set.'
		});
		await expect(
			service.issue(actorOwnerA, executedContractPublicId, missingDate.publicId)
		).rejects.toThrow('Set an effective date before issuing the amendment.');
		const workspace = await service.getWorkspace(
			actorOwnerA,
			executedContractPublicId,
			missingDate.publicId
		);
		expect(workspace.amendment.lifecycleStatus).toBe('draft');
		await service.withdraw(actorOwnerA, executedContractPublicId, missingDate.publicId);
	});
});
