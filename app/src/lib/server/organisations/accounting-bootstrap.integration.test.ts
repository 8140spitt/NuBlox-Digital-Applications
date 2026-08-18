import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { OrganisationBootstrapService } from './bootstrap-service';

const PREFIX = 'Accounting Bootstrap Integration ';
let db: Database;
let userId = '';
let organisationId = '';

async function cleanup() {
	if (!db) return;
	if (organisationId) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	}
	if (userId) await db.deleteFrom('users').where('id', '=', userId).execute();
}

async function permissionKeys(roleName: string): Promise<string[]> {
	const rows = await db
		.selectFrom('role_permissions as grant')
		.innerJoin('organisation_roles as role', (join) =>
			join
				.onRef('role.id', '=', 'grant.organisation_role_id')
				.onRef('role.organisation_id', '=', 'grant.organisation_id')
		)
		.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
		.select('permission.permission_key as permissionKey')
		.where('grant.organisation_id', '=', organisationId)
		.where('role.name', '=', roleName)
		.where('permission.permission_key', 'like', 'finance.accounting.%')
		.orderBy('permission.permission_key')
		.execute();
	return rows.map((row) => row.permissionKey);
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	const result = await db
		.insertInto('users')
		.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
		.executeTakeFirstOrThrow();
	if (result.insertId === undefined) throw new Error('Expected user insert ID.');
	userId = result.insertId.toString();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004L/004M/004O future organisation bootstrap parity', () => {
	it('keeps accounting viewing delegated while reserving configuration, posting, reversal, export, period governance and year-end authority', async () => {
		const created = await new OrganisationBootstrapService(db).createForExistingUser(
			{ userId, correlationId: `accounting-bootstrap-${randomUUID()}` },
			{
				legalName: `${PREFIX}Organisation`,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			}
		);
		organisationId = created.organisationId;

		const ownerAccountingKeys = [
			'finance.accounting.configure',
			'finance.accounting.export',
			'finance.accounting.export.reverse',
			'finance.accounting.period.close',
			'finance.accounting.period.configure',
			'finance.accounting.period.reopen',
			'finance.accounting.post',
			'finance.accounting.reverse',
			'finance.accounting.view',
			'finance.accounting.year_end.authorise',
			'finance.accounting.year_end.prepare',
			'finance.accounting.year_end.reverse'
		].sort();

		await expect(permissionKeys('Owner')).resolves.toEqual(ownerAccountingKeys);
		await expect(permissionKeys('Administrator')).resolves.toEqual(ownerAccountingKeys);
		await expect(permissionKeys('Finance/Commercial')).resolves.toEqual([
			'finance.accounting.view'
		]);
	});
});
