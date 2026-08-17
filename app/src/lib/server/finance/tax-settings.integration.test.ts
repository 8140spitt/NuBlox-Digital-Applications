import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { TaxSettingsService } from './tax-settings-service';

const PREFIX = 'Tax Settings Integration ';

let db: Database;
let organisationId = '';
let preservingOrganisationId = '';
let ownerUserId = '';
let readerUserId = '';
let ownerMemberId = '';
let readerMemberId = '';
let actorOwner: TenantActorContext;
let actorReader: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createUser(name: string): Promise<string> {
	return insertedId(await db.insertInto('users').values({
		public_id: randomUUID(),
		display_name: `${PREFIX}${name}`,
		status: 'active'
	}).executeTakeFirstOrThrow());
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(await db.insertInto('organisations').values({
		public_id: randomUUID(),
		legal_name: `${PREFIX}${name}`,
		default_currency_code: 'GBP',
		status: 'active'
	}).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({
		organisation_id: organisationId,
		user_id: userId,
		public_id: randomUUID(),
		status: 'active',
		joined_at: new Date('2026-08-17T08:00:00.000Z')
	}).executeTakeFirstOrThrow());
}

async function assignRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({
		organisation_id: organisationId,
		public_id: randomUUID(),
		name: `${PREFIX}${name}`,
		is_active: 1
	}).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({
		organisation_id: organisationId,
		organisation_role_id: roleId,
		permission_id: permission.id
	}))).execute();
	await db.insertInto('member_roles').values({
		organisation_id: organisationId,
		organisation_member_id: memberId,
		organisation_role_id: roleId
	}).executeTakeFirstOrThrow();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length === 0) return;
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_category_rates').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('tax_categories').where('organisation_id', 'in', ids).execute();
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
	ownerUserId = await createUser('Owner');
	readerUserId = await createUser('Reader');
	organisationId = await createOrganisation('Primary');
	preservingOrganisationId = await createOrganisation('Preserve existing');
	ownerMemberId = await createMember(organisationId, ownerUserId);
	readerMemberId = await createMember(organisationId, readerUserId);
	await assignRole(organisationId, ownerMemberId, 'Owner', ['finance.view', 'finance.billing.manage']);
	await assignRole(organisationId, readerMemberId, 'Reader', ['finance.view']);
	actorOwner = { organisationId, userId: ownerUserId, memberId: ownerMemberId, correlationId: randomUUID() };
	actorReader = { organisationId, userId: readerUserId, memberId: readerMemberId, correlationId: randomUUID() };

	const existingCategoryId = insertedId(await db.insertInto('tax_categories').values({
		organisation_id: preservingOrganisationId,
		public_id: randomUUID(),
		code: 'VAT_STANDARD',
		name: 'Tenant-owned standard VAT',
		treatment: 'taxable',
		is_active: 1
	}).executeTakeFirstOrThrow());
	await db.insertInto('tax_category_rates').values({
		organisation_id: preservingOrganisationId,
		tax_category_id: existingCategoryId,
		rate_percent: '17.5000',
		valid_from: new Date('2025-01-01T00:00:00.000Z'),
		valid_to: null
	}).executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('invoice tax configuration', () => {
	it('provisions the UK starter catalogue for a tenant with no tax setup', async () => {
		const workspace = await new TaxSettingsService(db, randomUUID).getWorkspace(actorOwner);
		expect(workspace.canManage).toBe(true);
		expect(workspace.categories.map((category) => category.code).sort()).toEqual([
			'OUTSIDE_SCOPE', 'VAT_EXEMPT', 'VAT_REDUCED', 'VAT_STANDARD', 'VAT_ZERO'
		]);
		expect(workspace.categories.find((category) => category.code === 'VAT_STANDARD')?.rates[0]?.ratePercent).toBe('20.0000');
		expect(workspace.categories.find((category) => category.code === 'VAT_REDUCED')?.rates[0]?.ratePercent).toBe('5.0000');
		expect(workspace.categories.find((category) => category.code === 'VAT_ZERO')?.rates[0]?.ratePercent).toBe('0.0000');
	});

	it('allows delegated billing administrators to add a category and append future rate history', async () => {
		const service = new TaxSettingsService(db, randomUUID);
		const publicId = await service.createCategory(actorOwner, {
			code: 'VAT_SPECIAL',
			name: 'Special VAT',
			treatment: 'taxable',
			ratePercent: '12.5000',
			validFrom: '2026-08-17'
		});
		await service.addRate(actorOwner, {
			categoryPublicId: publicId,
			ratePercent: '15.0000',
			validFrom: '2026-09-01'
		});
		const workspace = await service.getWorkspace(actorOwner);
		const category = workspace.categories.find((item) => item.publicId === publicId);
		expect(category?.rates).toHaveLength(2);
		expect(category?.rates[0]).toMatchObject({ ratePercent: '15.0000', validTo: null });
		expect(category?.rates[1]?.ratePercent).toBe('12.5000');
		expect(category?.rates[1]?.validTo?.toISOString().slice(0, 10)).toBe('2026-08-31');
	});

	it('keeps tax management separate from finance read access', async () => {
		await expect(new TaxSettingsService(db, randomUUID).createCategory(actorReader, {
			code: 'FORBIDDEN',
			name: 'Forbidden',
			treatment: 'taxable',
			ratePercent: '20',
			validFrom: '2026-08-17'
		})).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('does not overwrite existing tenant-owned rate history when defaults are ensured', async () => {
		const memberUserId = await createUser('Preserve user');
		const memberId = await createMember(preservingOrganisationId, memberUserId);
		await assignRole(preservingOrganisationId, memberId, 'Preserve reader', ['finance.view']);
		const actor: TenantActorContext = {
			organisationId: preservingOrganisationId,
			userId: memberUserId,
			memberId,
			correlationId: randomUUID()
		};
		const workspace = await new TaxSettingsService(db, randomUUID).getWorkspace(actor);
		const standard = workspace.categories.find((category) => category.code === 'VAT_STANDARD');
		expect(standard?.name).toBe('Tenant-owned standard VAT');
		expect(standard?.rates).toHaveLength(1);
		expect(standard?.rates[0]?.ratePercent).toBe('17.5000');
	});
});
