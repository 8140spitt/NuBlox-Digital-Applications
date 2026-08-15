import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { PermissionService } from './permission-service';

let db: Database;
let userId = '';
let organisationId = '';
let memberId = '';
let roleId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (memberId) {
		await db.deleteFrom('member_permission_overrides').where('organisation_member_id', '=', memberId).execute();
		await db.deleteFrom('member_roles').where('organisation_member_id', '=', memberId).execute();
	}
	if (roleId) await db.deleteFrom('role_permissions').where('organisation_role_id', '=', roleId).execute();
	if (roleId) await db.deleteFrom('organisation_roles').where('id', '=', roleId).execute();
	if (memberId) await db.deleteFrom('organisation_members').where('id', '=', memberId).execute();
	if (organisationId) await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	if (userId) await db.deleteFrom('users').where('id', '=', userId).execute();
}

describe('granular permission umbrella semantics', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();

		userId = insertedId(
			await db
				.insertInto('users')
				.values({ public_id: randomUUID(), display_name: 'Permission Granularity User', status: 'active' })
				.executeTakeFirstOrThrow()
		);
		organisationId = insertedId(
			await db
				.insertInto('organisations')
				.values({ public_id: randomUUID(), legal_name: 'Permission Granularity Organisation', status: 'active' })
				.executeTakeFirstOrThrow()
		);
		memberId = insertedId(
			await db
				.insertInto('organisation_members')
				.values({
					organisation_id: organisationId,
					user_id: userId,
					public_id: randomUUID(),
					status: 'active',
					joined_at: new Date()
				})
				.executeTakeFirstOrThrow()
		);
		roleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: `Granularity ${randomUUID()}`,
					description: 'Integration-test umbrella role',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);

		const permissions = await db
			.selectFrom('permissions')
			.select(['id', 'permission_key'])
			.where('permission_key', 'in', [
				'project.manage',
				'project.team.manage',
				'crm.manage',
				'crm.contact.manage'
			])
			.where('is_active', '=', 1)
			.execute();
		const permissionId = new Map(permissions.map((row) => [row.permission_key, row.id]));
		for (const key of ['project.manage', 'project.team.manage', 'crm.manage', 'crm.contact.manage']) {
			if (!permissionId.has(key)) throw new Error(`Required permission missing from migration stream: ${key}`);
		}

		await db
			.insertInto('role_permissions')
			.values([
				{
					organisation_id: organisationId,
					organisation_role_id: roleId,
					permission_id: permissionId.get('project.manage')!
				},
				{
					organisation_id: organisationId,
					organisation_role_id: roleId,
					permission_id: permissionId.get('crm.manage')!
				}
			])
			.execute();
		await db
			.insertInto('member_roles')
			.values({
				organisation_id: organisationId,
				organisation_member_id: memberId,
				organisation_role_id: roleId
			})
			.executeTakeFirstOrThrow();

		await db
			.insertInto('member_permission_overrides')
			.values([
				{
					organisation_id: organisationId,
					organisation_member_id: memberId,
					permission_id: permissionId.get('project.team.manage')!,
					effect: 'deny',
					reason: 'integration test granular project deny'
				},
				{
					organisation_id: organisationId,
					organisation_member_id: memberId,
					permission_id: permissionId.get('crm.contact.manage')!,
					effect: 'deny',
					reason: 'integration test granular CRM deny'
				}
			])
			.execute();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('allows umbrella grants when no granular exception exists', async () => {
		const actor = {
			organisationId,
			userId,
			memberId,
			correlationId: `permission-granularity-${randomUUID()}`
		};
		const permissions = new PermissionService(db);

		await expect(
			permissions.decideWithUmbrella(actor, 'project.participant.manage', 'project.manage')
		).resolves.toEqual({ allowed: true, reason: 'role-grant' });
		await expect(
			permissions.decideWithUmbrella(actor, 'crm.party.manage', 'crm.manage')
		).resolves.toEqual({ allowed: true, reason: 'role-grant' });
	});

	it('does not let an umbrella grant bypass a granular member deny', async () => {
		const actor = {
			organisationId,
			userId,
			memberId,
			correlationId: `permission-granularity-${randomUUID()}`
		};
		const permissions = new PermissionService(db);

		await expect(
			permissions.decideWithUmbrella(actor, 'project.team.manage', 'project.manage')
		).resolves.toEqual({ allowed: false, reason: 'member-deny' });
		await expect(
			permissions.decideWithUmbrella(actor, 'crm.contact.manage', 'crm.manage')
		).resolves.toEqual({ allowed: false, reason: 'member-deny' });
	});
});
