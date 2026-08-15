import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CrmService, CrmValidationError } from './crm-service';

const PREFIX = 'CRM Contacts Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let managerAMemberId = '';
let viewerAMemberId = '';
let managerBMemberId = '';
let managerAUserId = '';
let viewerAUserId = '';
let managerBUserId = '';
let actorManagerA: TenantActorContext;
let actorViewerA: TenantActorContext;
let actorManagerB: TenantActorContext;

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
	if (organisationIds.length > 0) {
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_organisation_contacts').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_role_assignments').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_phone_numbers').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_email_addresses').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_persons').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_organisations').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('parties').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
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
				joined_at: new Date('2026-08-15T21:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
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

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	managerAUserId = await createUser('Manager A');
	viewerAUserId = await createUser('Viewer A');
	managerBUserId = await createUser('Manager B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	managerAMemberId = await createMember(organisationAId, managerAUserId);
	viewerAMemberId = await createMember(organisationAId, viewerAUserId);
	managerBMemberId = await createMember(organisationBId, managerBUserId);
	await assignPermissionRole(organisationAId, managerAMemberId, 'Manager A', ['crm.view', 'crm.manage']);
	await assignPermissionRole(organisationAId, viewerAMemberId, 'Viewer A', ['crm.view']);
	await assignPermissionRole(organisationBId, managerBMemberId, 'Manager B', ['crm.view', 'crm.manage']);

	actorManagerA = {
		organisationId: organisationAId,
		userId: managerAUserId,
		memberId: managerAMemberId,
		correlationId: randomUUID()
	};
	actorViewerA = {
		organisationId: organisationAId,
		userId: viewerAUserId,
		memberId: viewerAMemberId,
		correlationId: randomUUID()
	};
	actorManagerB = {
		organisationId: organisationBId,
		userId: managerBUserId,
		memberId: managerBMemberId,
		correlationId: randomUUID()
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('CRM parties and contacts', () => {
	it('exposes CRM according to crm.view and crm.manage without broadening tenant scope', async () => {
		const manager = await new CrmService(db).listWorkspace(actorManagerA);
		expect(manager.canView).toBe(true);
		expect(manager.canManage).toBe(true);
		expect(manager.roleTypes.length).toBeGreaterThan(5);

		const viewer = await new CrmService(db).listWorkspace(actorViewerA);
		expect(viewer.canView).toBe(true);
		expect(viewer.canManage).toBe(false);
		expect(viewer.roleTypes).toEqual([]);
	});

	it('creates organisation and person parties with exactly one matching subtype, roles and primary contact methods', async () => {
		const service = new CrmService(db);
		const company = await service.createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Client Ltd`,
			tradingName: `${PREFIX}Client`,
			primaryEmail: 'hello@crm-client.example',
			primaryPhone: '+442071234567',
			roleCodes: ['client', 'developer']
		});
		const person = await service.createParty(actorManagerA, {
			kind: 'person',
			givenNames: 'Alice',
			familyName: 'Example',
			preferredName: 'Ali',
			primaryEmail: 'alice@crm-client.example',
			roleCodes: ['consultant']
		});

		expect(company.kind).toBe('organisation');
		expect(company.roles.map((role) => role.code).sort()).toEqual(['client', 'developer']);
		expect(person.kind).toBe('person');
		expect(person.displayName).toBe('Ali Example');

		const companyPersonSubtype = await db
			.selectFrom('party_persons')
			.select('party_id')
			.where('party_id', '=', company.id)
			.executeTakeFirst();
		const companyOrganisationSubtype = await db
			.selectFrom('party_organisations')
			.select('party_id')
			.where('party_id', '=', company.id)
			.executeTakeFirst();
		const personPersonSubtype = await db
			.selectFrom('party_persons')
			.select('party_id')
			.where('party_id', '=', person.id)
			.executeTakeFirst();
		const personOrganisationSubtype = await db
			.selectFrom('party_organisations')
			.select('party_id')
			.where('party_id', '=', person.id)
			.executeTakeFirst();
		expect(companyPersonSubtype).toBeUndefined();
		expect(companyOrganisationSubtype?.party_id).toBe(company.id);
		expect(personPersonSubtype?.party_id).toBe(person.id);
		expect(personOrganisationSubtype).toBeUndefined();
	});

	it('masks another tenant CRM party even when the other tenant has crm.view', async () => {
		const party = await new CrmService(db).createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Private Client`,
			roleCodes: ['client']
		});
		await expect(new CrmService(db).getPartyWorkspace(actorManagerB, party.publicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
		const tenantB = await new CrmService(db).listWorkspace(actorManagerB, { search: 'Private Client' });
		expect(tenantB.parties).toEqual([]);
	});

	it('updates identity, lifecycle, roles and primary contact methods with audit evidence', async () => {
		const service = new CrmService(db);
		const party = await service.createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Supplier Original`,
			primaryEmail: 'old@supplier.example',
			roleCodes: ['supplier']
		});
		const updated = await service.updateParty(actorManagerA, {
			partyPublicId: party.publicId,
			status: 'inactive',
			legalName: `${PREFIX}Supplier Updated`,
			tradingName: 'Updated Supplier',
			primaryEmail: 'new@supplier.example',
			primaryPhone: '+441234567890',
			roleCodes: ['supplier', 'subcontractor']
		});
		expect(updated.displayName).toBe('Updated Supplier');
		expect(updated.status).toBe('inactive');
		expect(updated.primaryEmail).toBe('new@supplier.example');
		expect(updated.roles.map((role) => role.code).sort()).toEqual(['subcontractor', 'supplier']);

		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationAId)
			.where('subject_public_id', '=', party.publicId)
			.where('action_key', '=', 'crm.party.updated')
			.executeTakeFirst();
		expect(audit?.action_key).toBe('crm.party.updated');
	});

	it('creates, links, promotes and ends current organisation contacts without duplicating party identity', async () => {
		const service = new CrmService(db);
		const company = await service.createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Contact Company`,
			roleCodes: ['client']
		});
		const firstPerson = await service.createOrganisationContact(actorManagerA, company.publicId, {
			givenNames: 'Primary',
			familyName: 'Contact',
			primaryEmail: 'primary@contact-company.example',
			jobTitle: 'Director',
			isPrimaryContact: true
		});
		const existingPerson = await service.createParty(actorManagerA, {
			kind: 'person',
			givenNames: 'Existing',
			familyName: 'Person'
		});
		await service.linkExistingOrganisationContact(actorManagerA, {
			organisationPartyPublicId: company.publicId,
			personPartyPublicId: existingPerson.publicId,
			jobTitle: 'Commercial Manager',
			department: 'Commercial'
		});

		let workspace = await service.getPartyWorkspace(actorManagerA, company.publicId);
		expect(workspace.contacts).toHaveLength(2);
		expect(workspace.contacts.find((contact) => contact.personPublicId === firstPerson.publicId)?.isPrimaryContact).toBe(true);

		await service.makePrimaryOrganisationContact(actorManagerA, company.publicId, existingPerson.publicId);
		workspace = await service.getPartyWorkspace(actorManagerA, company.publicId);
		expect(workspace.contacts.find((contact) => contact.personPublicId === existingPerson.publicId)?.isPrimaryContact).toBe(true);
		expect(workspace.contacts.find((contact) => contact.personPublicId === firstPerson.publicId)?.isPrimaryContact).toBe(false);

		await service.endOrganisationContact(actorManagerA, company.publicId, existingPerson.publicId);
		workspace = await service.getPartyWorkspace(actorManagerA, company.publicId);
		expect(workspace.contacts.map((contact) => contact.personPublicId)).toEqual([firstPerson.publicId]);
	});

	it('prevents read-only members and archived organisations from acquiring new CRM relationships', async () => {
		const service = new CrmService(db);
		await expect(
			service.createParty(actorViewerA, { kind: 'organisation', legalName: `${PREFIX}Denied` })
		).rejects.toBeInstanceOf(TenantAccessError);

		const company = await service.createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Archived Company`
		});
		await service.updateParty(actorManagerA, {
			partyPublicId: company.publicId,
			status: 'archived',
			legalName: `${PREFIX}Archived Company`,
			roleCodes: []
		});
		await expect(
			service.createOrganisationContact(actorManagerA, company.publicId, {
				givenNames: 'Blocked',
				familyName: 'Contact'
			})
		).rejects.toBeInstanceOf(CrmValidationError);
	});
});
