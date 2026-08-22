import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	MemberPermissionOverrideService,
	MemberPermissionOverrideValidationError
} from './member-permission-override-service';

const PREFIX = 'Member Permission Override Integration ';

let db: Database;
let organisationId: string;
let organisationPublicId: string;
let managerUserId: string;
let managerMemberId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let ordinaryUserId: string;
let ordinaryMemberId: string;
let managerRoleId: string;
let targetRoleId: string;
let organisationManagePermissionId: string;
let crmViewPermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function actor(userId: string, memberId: string): TenantActorContext {
	return {
		organisationId,
		userId,
		memberId,
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

async function createMember(
	userId: string,
	name: string
): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: publicId,
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('user_emails')
		.values({
			user_id: userId,
			email: `${name.toLowerCase()}-${randomUUID()}@example.test`,
			is_primary: 1,
			is_verified: 1,
			verified_at: new Date()
		})
		.executeTakeFirstOrThrow();
	return { id, publicId };
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await db.deleteFrom('outbox_events').where('organisation_id', '=', organisationId).execute();
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
	const userIds = [managerUserId, targetUserId, ordinaryUserId].filter(Boolean);
	if (userIds.length > 0) {
		await db.deleteFrom('user_emails').where('user_id', 'in', userIds).execute();
		await db.deleteFrom('users').where('id', 'in', userIds).execute();
	}
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
	crmViewPermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'crm.view')
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

	managerUserId = await createUser('Manager');
	targetUserId = await createUser('Target');
	ordinaryUserId = await createUser('Ordinary');
	const managerMember = await createMember(managerUserId, 'manager');
	const targetMember = await createMember(targetUserId, 'target');
	const ordinaryMember = await createMember(ordinaryUserId, 'ordinary');
	managerMemberId = managerMember.id;
	targetMemberId = targetMember.id;
	targetMemberPublicId = targetMember.publicId;
	ordinaryMemberId = ordinaryMember.id;

	managerRoleId = insertedId(
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
	targetRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}CRM Reader`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: managerRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: targetRoleId,
				permission_id: crmViewPermissionId
			}
		])
		.execute();
	await db
		.insertInto('member_roles')
		.values([
			{
				organisation_id: organisationId,
				organisation_member_id: managerMemberId,
				organisation_role_id: managerRoleId
			},
			{
				organisation_id: organisationId,
				organisation_member_id: targetMemberId,
				organisation_role_id: targetRoleId
			}
		])
		.execute();
}

describe('member permission override governance', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('enforces deny, allow and role-grant precedence with audit and outbox evidence', async () => {
		const manager = actor(managerUserId, managerMemberId);
		const target = actor(targetUserId, targetMemberId);
		const service = new MemberPermissionOverrideService(db);
		const permissionService = new PermissionService(db);

		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: true,
			reason: 'role-grant'
		});

		await service.setOverride(manager, {
			memberPublicId: targetMemberPublicId,
			permissionKey: 'crm.view',
			effect: 'deny',
			reason: 'Temporary segregation of duties restriction.'
		});
		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: false,
			reason: 'member-deny'
		});

		await service.setOverride(manager, {
			memberPublicId: targetMemberPublicId,
			permissionKey: 'crm.view',
			effect: 'allow',
			reason: 'Approved individual exception.'
		});
		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: true,
			reason: 'member-allow'
		});

		await service.removeOverride(manager, {
			memberPublicId: targetMemberPublicId,
			permissionKey: 'crm.view'
		});
		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: true,
			reason: 'role-grant'
		});

		const auditCount = await db
			.selectFrom('audit_events')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('acting_organisation_id', '=', organisationId)
			.where('subject_public_id', '=', targetMemberPublicId)
			.where('action_key', 'in', [
				'organisation.member.permission_override.set',
				'organisation.member.permission_override.remove'
			])
			.executeTakeFirstOrThrow();
		expect(Number(auditCount.count)).toBe(3);

		const eventCount = await db
			.selectFrom('outbox_events')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('organisation_id', '=', organisationId)
			.where('topic', '=', 'organisation.member.permission-override.changed')
			.where('aggregate_public_id', '=', organisationPublicId)
			.executeTakeFirstOrThrow();
		expect(Number(eventCount.count)).toBe(3);
	});

	it('blocks self-overrides and unauthorised administrators', async () => {
		const service = new MemberPermissionOverrideService(db);
		const manager = actor(managerUserId, managerMemberId);

		await expect(
			service.setOverride(manager, {
				memberPublicId: (
					await db
						.selectFrom('organisation_members')
						.select('public_id')
						.where('id', '=', managerMemberId)
						.executeTakeFirstOrThrow()
				).public_id,
				permissionKey: 'crm.view',
				effect: 'deny',
				reason: 'Self change should be rejected.'
			})
		).rejects.toBeInstanceOf(MemberPermissionOverrideValidationError);

		await expect(
			service.setOverride(actor(ordinaryUserId, ordinaryMemberId), {
				memberPublicId: targetMemberPublicId,
				permissionKey: 'crm.view',
				effect: 'deny',
				reason: 'Unauthorised change.'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
