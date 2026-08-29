import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { decideOrganisationRoleDelegation } from './role-delegation-policy';
import { ensureStandardAccessRoleBindings } from './standard-access-roles';

const PREFIX = 'Access Lifecycle Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let workerUserId: string;
let workerMemberId: string;
let ownerRoleId: string;
let ownerRolePublicId: string;
let workerRoleId: string;
let workViewPermissionId: string;
let organisationManagePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(userId: string): Promise<string> {
	return insertedId(
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
}

function actor(userId: string, memberId: string) {
	return {
		organisationId,
		userId,
		memberId,
		correlationId: `access-lifecycle-${randomUUID()}`
	};
}

async function clearLifecycleState(): Promise<void> {
	if (!organisationId) return;
	await db
		.deleteFrom('member_permission_override_access_windows')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db
		.deleteFrom('member_role_access_windows')
		.where('organisation_id', '=', organisationId)
		.execute();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await clearLifecycleState();
		await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
		await db
			.deleteFrom('organisation_role_template_bindings')
			.where('organisation_id', '=', organisationId)
			.execute();
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
	const userIds = [ownerUserId, workerUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	workViewPermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'work.view')
			.executeTakeFirstOrThrow()
	).id;
	organisationManagePermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'organisation.manage')
			.executeTakeFirstOrThrow()
	).id;

	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	ownerUserId = await createUser('Owner');
	workerUserId = await createUser('Worker');
	ownerMemberId = await createMember(ownerUserId);
	workerMemberId = await createMember(workerUserId);

	ownerRolePublicId = randomUUID();
	ownerRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: ownerRolePublicId,
				name: 'Owner',
				description: 'Lifecycle Owner fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	workerRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Worker Role`,
				description: 'Lifecycle worker fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await ensureStandardAccessRoleBindings(db, organisationId);

	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: ownerRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: workerRoleId,
				permission_id: workViewPermissionId
			}
		])
		.execute();
	await db
		.insertInto('member_roles')
		.values([
			{
				organisation_id: organisationId,
				organisation_member_id: ownerMemberId,
				organisation_role_id: ownerRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: workerMemberId,
				organisation_role_id: workerRoleId
			}
		])
		.execute();
}

async function setWorkerRoleWindow(effectiveFrom: Date | null, expiresAt: Date | null) {
	await db.insertInto('member_role_access_windows').values({
		organisation_id: organisationId,
		organisation_member_id: workerMemberId,
		organisation_role_id: workerRoleId,
		effective_from: effectiveFrom,
		expires_at: expiresAt,
		reason: 'Integration-test access lifecycle.'
	}).executeTakeFirstOrThrow();
}

async function setWorkerOverride(
	effect: 'allow' | 'deny',
	effectiveFrom: Date | null,
	expiresAt: Date | null
) {
	await db.insertInto('member_permission_overrides').values({
		organisation_id: organisationId,
		organisation_member_id: workerMemberId,
		permission_id: workViewPermissionId,
		effect,
		reason: 'Integration-test explicit exception.'
	}).executeTakeFirstOrThrow();
	if (!effectiveFrom && !expiresAt) return;
	await db.insertInto('member_permission_override_access_windows').values({
		organisation_id: organisationId,
		organisation_member_id: workerMemberId,
		permission_id: workViewPermissionId,
		effective_from: effectiveFrom,
		expires_at: expiresAt
	}).executeTakeFirstOrThrow();
}

describe('time-bounded organisation access', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	beforeEach(async () => {
		await clearLifecycleState();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('keeps legacy assignments effective when no lifecycle row exists', async () => {
		const decision = await new PermissionService(db).decide(
			actor(workerUserId, workerMemberId),
			'work.view'
		);
		expect(decision).toEqual({ allowed: true, reason: 'role-grant' });
	});

	it('enforces role assignment windows as [effective_from, expires_at)', async () => {
		const effectiveFrom = new Date('2030-01-01T10:00:00.000Z');
		const expiresAt = new Date('2030-01-01T12:00:00.000Z');
		await setWorkerRoleWindow(effectiveFrom, expiresAt);
		const service = new PermissionService(db);
		const subject = actor(workerUserId, workerMemberId);

		expect(await service.decide(subject, 'work.view', { at: new Date('2030-01-01T09:59:59Z') })).toEqual({
			allowed: false,
			reason: 'default-deny'
		});
		expect(await service.decide(subject, 'work.view', { at: effectiveFrom })).toEqual({
			allowed: true,
			reason: 'role-grant'
		});
		expect(await service.decide(subject, 'work.view', { at: expiresAt })).toEqual({
			allowed: false,
			reason: 'default-deny'
		});
	});

	it('ignores an expired explicit deny and falls through to an active role grant', async () => {
		await setWorkerOverride(
			'deny',
			new Date('2029-01-01T10:00:00.000Z'),
			new Date('2029-01-01T11:00:00.000Z')
		);
		const decision = await new PermissionService(db).decide(
			actor(workerUserId, workerMemberId),
			'work.view',
			{ at: new Date('2029-01-01T11:00:00.000Z') }
		);
		expect(decision).toEqual({ allowed: true, reason: 'role-grant' });
	});

	it('applies an active explicit deny ahead of the role grant', async () => {
		await setWorkerOverride(
			'deny',
			new Date('2029-01-01T10:00:00.000Z'),
			new Date('2029-01-01T12:00:00.000Z')
		);
		const decision = await new PermissionService(db).decide(
			actor(workerUserId, workerMemberId),
			'work.view',
			{ at: new Date('2029-01-01T11:00:00.000Z') }
		);
		expect(decision).toEqual({ allowed: false, reason: 'member-deny' });
	});

	it('does not let an expired Owner assignment cross the ownership delegation boundary', async () => {
		await db.insertInto('member_role_access_windows').values({
			organisation_id: organisationId,
			organisation_member_id: ownerMemberId,
			organisation_role_id: ownerRoleId,
			effective_from: new Date(Date.now() - 60_000),
			expires_at: new Date(Date.now() - 1_000),
			reason: 'Expired Owner test window.'
		}).executeTakeFirstOrThrow();

		const decision = await decideOrganisationRoleDelegation(
			db,
			actor(ownerUserId, ownerMemberId),
			[ownerRolePublicId]
		);
		expect(decision.allowed).toBe(false);
		expect(decision.deniedPermissionKeys).toContain('access-role.owner.delegate');
	});

	it('enforces the database invariant that expiry must follow activation', async () => {
		const instant = new Date('2030-01-01T10:00:00.000Z');
		await expect(setWorkerRoleWindow(instant, instant)).rejects.toThrow();
	});
});
