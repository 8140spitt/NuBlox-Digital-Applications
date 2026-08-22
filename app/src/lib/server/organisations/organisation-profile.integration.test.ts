import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationProfileValidationError,
	OrganisationService
} from './organisation-service';

const PREFIX = 'Organisation Profile Integration ';

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
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
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
				legal_name: `${PREFIX}Original Legal Name`,
				trading_name: `${PREFIX}Original Trading Name`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
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

describe('organisation profile governance', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('updates the canonical organisation profile with permission and audit evidence', async () => {
		const manager = actor(managerUserId, managerMemberId);
		const updated = await new OrganisationService(db).updateCurrentOrganisationProfile(manager, {
			legalName: '  NuBlox Profile Test Ltd  ',
			tradingName: '  NuBlox Profile Test  ',
			defaultTimezone: 'Europe/Paris',
			defaultCurrencyCode: 'eur'
		});

		expect(updated).toMatchObject({
			publicId: organisationPublicId,
			legalName: 'NuBlox Profile Test Ltd',
			tradingName: 'NuBlox Profile Test',
			defaultTimezone: 'Europe/Paris',
			defaultCurrencyCode: 'EUR'
		});

		const row = await db
			.selectFrom('organisations')
			.select(['legal_name', 'trading_name', 'default_timezone', 'default_currency_code'])
			.where('id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(row).toEqual({
			legal_name: 'NuBlox Profile Test Ltd',
			trading_name: 'NuBlox Profile Test',
			default_timezone: 'Europe/Paris',
			default_currency_code: 'EUR'
		});

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key', 'subject_type', 'subject_public_id', 'actor_member_id'])
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.profile.update')
			.orderBy('id', 'desc')
			.executeTakeFirstOrThrow();
		expect(audit).toMatchObject({
			action_key: 'organisation.profile.update',
			subject_type: 'organisation',
			subject_public_id: organisationPublicId,
			actor_member_id: managerMemberId
		});
	});

	it('requires organisation.manage and the full active membership tuple', async () => {
		await expect(
			new OrganisationService(db).updateCurrentOrganisationProfile(actor(memberUserId, memberId), {
				legalName: 'Unauthorised change',
				tradingName: null,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		await expect(
			new OrganisationService(db).updateCurrentOrganisationProfile(
				{
					organisationId: otherOrganisationId,
					userId: managerUserId,
					memberId: managerMemberId,
					correlationId: randomUUID()
				},
				{
					legalName: 'Forged tenant change',
					tradingName: null,
					defaultTimezone: 'Europe/London',
					defaultCurrencyCode: 'GBP'
				}
			)
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('rejects invalid organisation master-data values before mutation', async () => {
		const manager = actor(managerUserId, managerMemberId);
		await expect(
			new OrganisationService(db).updateCurrentOrganisationProfile(manager, {
				legalName: '',
				tradingName: null,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(OrganisationProfileValidationError);

		await expect(
			new OrganisationService(db).updateCurrentOrganisationProfile(manager, {
				legalName: 'Valid legal name',
				tradingName: null,
				defaultTimezone: 'Not/A-Timezone',
				defaultCurrencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(OrganisationProfileValidationError);

		await expect(
			new OrganisationService(db).updateCurrentOrganisationProfile(manager, {
				legalName: 'Valid legal name',
				tradingName: null,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GB'
			})
		).rejects.toBeInstanceOf(OrganisationProfileValidationError);
	});
});
