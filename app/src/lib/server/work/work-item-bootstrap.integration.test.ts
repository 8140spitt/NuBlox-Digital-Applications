import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import {
	WORK_KERNEL_STANDARD_ROLE_PERMISSIONS,
	ensureWorkKernelStandardRoleDefaults
} from './work-item-bootstrap';

const TEST_NAME_PREFIX = 'Work Kernel Bootstrap ';
let db: Database;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${TEST_NAME_PREFIX}%`)
		.execute();
	const ids = organisations.map((organisation) => organisation.id);
	if (ids.length > 0) {
		await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${TEST_NAME_PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('Work Kernel standard role bootstrap', () => {
	it('grants the Owner defaults to an organisation created after the migration', async () => {
		const userId = insertedId(
			await db
				.insertInto('users')
				.values({
					public_id: randomUUID(),
					display_name: `${TEST_NAME_PREFIX}User ${randomUUID().slice(0, 8)}`,
					status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
		const organisationId = insertedId(
			await db
				.insertInto('organisations')
				.values({
					public_id: randomUUID(),
					legal_name: `${TEST_NAME_PREFIX}Organisation ${randomUUID().slice(0, 8)}`,
					status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
		const memberId = insertedId(
			await db
				.insertInto('organisation_members')
				.values({
					organisation_id: organisationId,
					user_id: userId,
					public_id: randomUUID(),
					status: 'active',
					joined_at: new Date('2026-08-22T08:00:00.000Z')
				})
				.executeTakeFirstOrThrow()
		);
		const ownerRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Owner',
					description: 'Future organisation Owner role',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		await db
			.insertInto('member_roles')
			.values({
				organisation_id: organisationId,
				organisation_member_id: memberId,
				organisation_role_id: ownerRoleId
			})
			.executeTakeFirstOrThrow();

		await ensureWorkKernelStandardRoleDefaults(db, organisationId);

		const actor: TenantActorContext = {
			organisationId,
			userId,
			memberId,
			correlationId: randomUUID()
		};
		const permissionKeys = [...WORK_KERNEL_STANDARD_ROLE_PERMISSIONS.Owner];
		const decisions = await new PermissionService(db).decideMany(actor, permissionKeys);
		for (const permissionKey of permissionKeys) {
			expect(decisions.get(permissionKey)).toEqual({ allowed: true, reason: 'role-grant' });
		}
	});
});
