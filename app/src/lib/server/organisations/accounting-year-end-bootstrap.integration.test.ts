import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { AccountingYearEndService } from '$lib/server/finance/accounting-year-end-service';
import { OrganisationBootstrapService } from './bootstrap-service';

const PREFIX = 'Accounting Year End Bootstrap Integration ';
let db: Database;
let userId = '';
let organisationId = '';
let memberId = '';

async function cleanup() {
	if (!db) return;
	if (organisationId) {
		await db.deleteFrom('accounting_year_end_close_reversals').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_year_end_closes').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('accounting_year_end_close_preparations').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('audit_events').where('acting_organisation_id', '=', organisationId).execute();
		await db.deleteFrom('member_permission_overrides').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	}
	if (userId) await db.deleteFrom('users').where('id', '=', userId).execute();
}

async function yearEndPermissionKeys(roleName: string): Promise<string[]> {
	const rows = await db.selectFrom('role_permissions as grant')
		.innerJoin('organisation_roles as role', (join) => join.onRef('role.id', '=', 'grant.organisation_role_id').onRef('role.organisation_id', '=', 'grant.organisation_id'))
		.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
		.select('permission.permission_key as permissionKey')
		.where('grant.organisation_id', '=', organisationId)
		.where('role.name', '=', roleName)
		.where('permission.permission_key', 'like', 'finance.accounting.year_end.%')
		.orderBy('permission.permission_key')
		.execute();
	return rows.map((row) => row.permissionKey);
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	const result = await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' }).executeTakeFirstOrThrow();
	if (result.insertId === undefined) throw new Error('Expected user insert ID.');
	userId = result.insertId.toString();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Package 004O future organisation bootstrap parity', () => {
	it('grants Owner/Admin year-end authority, keeps Finance/Commercial unprivileged and honours explicit prepare deny', async () => {
		const created = await new OrganisationBootstrapService(db).createForExistingUser(
			{ userId, correlationId: `year-end-bootstrap-${randomUUID()}` },
			{ legalName: `${PREFIX}Organisation`, defaultTimezone: 'Europe/London', defaultCurrencyCode: 'GBP' }
		);
		organisationId = created.organisationId;
		memberId = created.memberId;
		const expected = ['finance.accounting.year_end.authorise', 'finance.accounting.year_end.prepare', 'finance.accounting.year_end.reverse'];
		await expect(yearEndPermissionKeys('Owner')).resolves.toEqual(expected);
		await expect(yearEndPermissionKeys('Administrator')).resolves.toEqual(expected);
		await expect(yearEndPermissionKeys('Finance/Commercial')).resolves.toEqual([]);

		const actor: TenantActorContext = { organisationId, userId, memberId, correlationId: `year-end-bootstrap-${randomUUID()}` };
		const permission = await db.selectFrom('permissions').select('id').where('permission_key', '=', 'finance.accounting.year_end.prepare').executeTakeFirstOrThrow();
		await db.insertInto('member_permission_overrides').values({ organisation_id: organisationId, organisation_member_id: memberId, permission_id: permission.id, effect: 'deny', reason: 'Package 004O explicit-deny precedence test' }).executeTakeFirstOrThrow();
		const workspace = await new AccountingYearEndService(db).getWorkspace(actor);
		expect(workspace.canPrepare).toBe(false);
		expect(workspace.canAuthorise).toBe(true);
		expect(workspace.canReverse).toBe(true);
	});
});
