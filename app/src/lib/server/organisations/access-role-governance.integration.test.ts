import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import {
	OrganisationAdminValidationError,
	OrganisationAdminService
} from './organisation-admin-service';

const PREFIX = 'Access Role Governance Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let administratorUserId: string;
let administratorMemberId: string;
let ordinaryUserId: string;
let ordinaryMemberId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let ownerRoleId: string;
let ownerRolePublicId: string;
let administratorRoleId: string;
let ordinaryRoleId: string;
let ordinaryRolePublicId: string;
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

function actor(userId: string, memberId: string) {
	return {
		organisationId,
		userId,
		memberId,
		correlationId: `access-role-governance-${randomUUID()}`
	};
}

async function cleanup(): Promise<void> {
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
	const userIds = [ownerUserId, administratorUserId, ordinaryUserId, targetUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createMember(
	userId: string,
	publicId = randomUUID()
): Promise<{ id: string; publicId: string }> {
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
	return { id, publicId };
}

async function createFixture(): Promise<void> {
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
	administratorUserId = await createUser('Administrator');
	ordinaryUserId = await createUser('Ordinary');
	targetUserId = await createUser('Target');

	ownerMemberId = (await createMember(ownerUserId)).id;
	administratorMemberId = (await createMember(administratorUserId)).id;
	ordinaryMemberId = (await createMember(ordinaryUserId)).id;
	const target = await createMember(targetUserId);
	targetMemberId = target.id;
	targetMemberPublicId = target.publicId;

	ownerRolePublicId = randomUUID();
	ownerRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: ownerRolePublicId,
				name: 'Owner',
				description: 'Governed owner role fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	administratorRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: 'Administrator',
				description: 'Governed administrator role fixture.',
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	ordinaryRolePublicId = randomUUID();
	ordinaryRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: ordinaryRolePublicId,
				name: `${PREFIX}Ordinary Role`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);

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
				organisation_role_id: administratorRoleId,
				permission_id: organisationManagePermissionId
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
				organisation_member_id: administratorMemberId,
				organisation_role_id: administratorRoleId
			}
		])
		.execute();
}

describe('governed organisation access roles', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('does not let organisation administrators delegate ownership', async () => {
		const service = new OrganisationAdminService(db);
		await expect(
			service.replaceMemberRoles(
				actor(administratorUserId, administratorMemberId),
				targetMemberPublicId,
				[ownerRolePublicId]
			)
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		const assignments = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(assignments).toEqual([]);
	});

	it('allows an active Owner to delegate the Owner role', async () => {
		const service = new OrganisationAdminService(db);
		await service.replaceMemberRoles(actor(ownerUserId, ownerMemberId), targetMemberPublicId, [
			ownerRolePublicId
		]);

		const assignment = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.executeTakeFirstOrThrow();
		expect(assignment.organisation_role_id).toBe(ownerRoleId);
	});

	it('enforces member-management authority at the service boundary', async () => {
		await db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();

		const service = new OrganisationAdminService(db);
		await expect(
			service.replaceMemberRoles(actor(ordinaryUserId, ordinaryMemberId), targetMemberPublicId, [
				ordinaryRolePublicId
			])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		const assignments = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(assignments).toEqual([]);
		expect(ordinaryRoleId).toBeTruthy();
	});
});
