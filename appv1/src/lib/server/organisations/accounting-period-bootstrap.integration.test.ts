import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { AccountingPeriodService } from '$lib/server/finance/accounting-period-service';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationBootstrapService } from './bootstrap-service';

const PREFIX = 'Accounting Period Bootstrap Integration ';
let db: Database;
let userId = '';
let organisationId = '';
let memberId = '';

async function cleanup() {
	if (!db) return;
	if (organisationId) {
		await db
			.deleteFrom('accounting_period_status_events')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('accounting_periods')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('accounting_financial_years')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationId)
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

async function periodPermissionKeys(roleName: string): Promise<string[]> {
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
		.where('permission.permission_key', 'like', 'finance.accounting.period.%')
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

describe('Package 004M future organisation bootstrap parity', () => {
	it('reserves period governance for Owner/Admin and preserves explicit granular deny precedence', async () => {
		const created = await new OrganisationBootstrapService(db).createForExistingUser(
			{ userId, correlationId: `accounting-period-bootstrap-${randomUUID()}` },
			{
				legalName: `${PREFIX}Organisation`,
				defaultTimezone: 'Europe/London',
				defaultCurrencyCode: 'GBP'
			}
		);
		organisationId = created.organisationId;
		memberId = created.memberId;

		const allThree = [
			'finance.accounting.period.close',
			'finance.accounting.period.configure',
			'finance.accounting.period.reopen'
		];
		await expect(periodPermissionKeys('Owner')).resolves.toEqual(allThree);
		await expect(periodPermissionKeys('Administrator')).resolves.toEqual(allThree);
		await expect(periodPermissionKeys('Finance/Commercial')).resolves.toEqual([]);

		const actor: TenantActorContext = {
			organisationId,
			userId,
			memberId,
			correlationId: `accounting-period-bootstrap-${randomUUID()}`
		};
		const periods = new AccountingPeriodService(
			db,
			randomUUID,
			() => new Date('2026-08-18T12:00:00.000Z')
		);
		const year = await periods.createFinancialYear(actor, {
			yearCode: 'FY26-P',
			name: 'Period parity FY26',
			startsOn: '2026-01-01',
			endsOn: '2026-12-31'
		});
		const period = await periods.createPeriod(actor, {
			financialYearPublicId: year.publicId,
			periodNumber: 8,
			name: 'August 2026',
			startsOn: '2026-08-01',
			endsOn: '2026-08-31'
		});

		const closePermission = await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'finance.accounting.period.close')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_id: organisationId,
				organisation_member_id: memberId,
				permission_id: closePermission.id,
				effect: 'deny',
				reason: 'Package 004M explicit-deny precedence test'
			})
			.executeTakeFirstOrThrow();

		await expect(
			periods.softClose(actor, period.publicId, 'Should be blocked by explicit deny.')
		).rejects.toBeInstanceOf(TenantAccessError);
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', memberId)
			.where('permission_id', '=', closePermission.id)
			.execute();
		await periods.softClose(actor, period.publicId, 'Close after removing explicit deny.');
	});
});
