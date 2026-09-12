import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationIdentifierValidationError, OrganisationService } from './organisation-service';

const PREFIX = 'Organisation Identifier Integration ';

let db: Database;
let organisationId: string;
let organisationPublicId: string;
let otherOrganisationId: string;
let managerUserId: string;
let managerMemberId: string;
let memberUserId: string;
let memberId: string;
let roleId: string;
let organisationManagePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function actor(userId: string, organisationMemberId: string): TenantActorContext {
	return {
		organisationId,
		userId,
		memberId: organisationMemberId,
		correlationId: randomUUID()
	};
}

async function createUser(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisation: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisation,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisationIds = [organisationId, otherOrganisationId].filter(Boolean);
	if (organisationIds.length > 0) {
		await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_identifiers')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	const userIds = [managerUserId, memberUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	organisationManagePermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'organisation.manage')
			.where('is_active', '=', 1)
			.executeTakeFirstOrThrow()
	).id;

	organisationPublicId = randomUUID();
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
				legal_name: `${PREFIX}Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	otherOrganisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Other Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	managerUserId = await createUser('Manager');
	memberUserId = await createUser('Member');
	managerMemberId = await createMember(organisationId, managerUserId);
	memberId = await createMember(organisationId, memberUserId);

	roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Manager`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('role_permissions')
		.values({
			organisation_id: organisationId,
			organisation_role_id: roleId,
			permission_id: organisationManagePermissionId
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: managerMemberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

describe('organisation identifier governance', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('adds, lists and removes canonical legal identifiers with audit and outbox evidence', async () => {
		const manager = actor(managerUserId, managerMemberId);
		const service = new OrganisationService(db);

		await service.addCurrentOrganisationIdentifier(manager, {
			identifierType: ' VAT_NUMBER ',
			identifierValue: ' GB123456789 ',
			issuingCountryCode: 'gb'
		});

		await expect(service.listCurrentOrganisationIdentifiers(manager)).resolves.toEqual([
			expect.objectContaining({
				identifierType: 'vat_number',
				identifierValue: 'GB123456789',
				issuingCountryCode: 'GB'
			})
		]);

		const addedAudit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_public_id', 'actor_member_id'])
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.identifier.add')
			.executeTakeFirstOrThrow();
		expect(addedAudit).toMatchObject({
			action_key: 'organisation.identifier.add',
			subject_public_id: organisationPublicId,
			actor_member_id: managerMemberId
		});

		const addedEvent = await db
			.selectFrom('outbox_events')
			.select(['topic', 'aggregate_type', 'aggregate_public_id'])
			.where('organisation_id', '=', organisationId)
			.where('topic', '=', 'organisation.identifier.added')
			.executeTakeFirstOrThrow();
		expect(addedEvent).toEqual({
			topic: 'organisation.identifier.added',
			aggregate_type: 'organisation',
			aggregate_public_id: organisationPublicId
		});

		await service.removeCurrentOrganisationIdentifier(manager, {
			identifierType: 'vat_number',
			identifierValue: 'GB123456789'
		});
		await expect(service.listCurrentOrganisationIdentifiers(manager)).resolves.toEqual([]);

		const removedAudit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.identifier.remove')
			.executeTakeFirstOrThrow();
		expect(removedAudit.action_key).toBe('organisation.identifier.remove');

		const removedEvent = await db
			.selectFrom('outbox_events')
			.select('topic')
			.where('organisation_id', '=', organisationId)
			.where('topic', '=', 'organisation.identifier.removed')
			.executeTakeFirstOrThrow();
		expect(removedEvent.topic).toBe('organisation.identifier.removed');
	});

	it('rejects duplicates and invalid identifier values before mutation', async () => {
		const manager = actor(managerUserId, managerMemberId);
		const service = new OrganisationService(db);
		await service.addCurrentOrganisationIdentifier(manager, {
			identifierType: 'companies_house_number',
			identifierValue: '12345678',
			issuingCountryCode: 'GB'
		});

		await expect(
			service.addCurrentOrganisationIdentifier(manager, {
				identifierType: 'COMPANIES_HOUSE_NUMBER',
				identifierValue: '12345678',
				issuingCountryCode: 'GB'
			})
		).rejects.toBeInstanceOf(OrganisationIdentifierValidationError);

		await expect(
			service.addCurrentOrganisationIdentifier(manager, {
				identifierType: 'VAT number with spaces',
				identifierValue: 'GB123',
				issuingCountryCode: 'GB'
			})
		).rejects.toBeInstanceOf(OrganisationIdentifierValidationError);

		await expect(
			service.addCurrentOrganisationIdentifier(manager, {
				identifierType: 'vat_number',
				identifierValue: 'GB123',
				issuingCountryCode: 'GBR'
			})
		).rejects.toBeInstanceOf(OrganisationIdentifierValidationError);
	});

	it('requires organisation.manage and the full active tenant membership tuple', async () => {
		const service = new OrganisationService(db);
		await expect(
			service.addCurrentOrganisationIdentifier(actor(memberUserId, memberId), {
				identifierType: 'lei',
				identifierValue: 'UNAUTHORISED'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		await expect(
			service.addCurrentOrganisationIdentifier(
				{
					organisationId: otherOrganisationId,
					userId: managerUserId,
					memberId: managerMemberId,
					correlationId: randomUUID()
				},
				{
					identifierType: 'lei',
					identifierValue: 'FORGED-TENANT'
				}
			)
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
