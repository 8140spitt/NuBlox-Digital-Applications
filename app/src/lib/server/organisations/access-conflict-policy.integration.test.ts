import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import {
	MemberPermissionOverrideService,
	MemberPermissionOverrideValidationError
} from './member-permission-override-service';
import {
	OrganisationAdminService,
	OrganisationAdminValidationError
} from './organisation-admin-service';
import { ensureStandardAccessRoleBindings } from './standard-access-roles';

const PREFIX = 'Access Conflict Policy Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let ownerRoleId: string;
let readOnlyRoleId: string;
let readOnlyRolePublicId: string;
let financeRoleId: string;
let financeRolePublicId: string;
let customManagerRoleId: string;
let customManagerRolePublicId: string;
let organisationManagePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function actor() {
	return {
		organisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `sod-${randomUUID().slice(0, 12)}`
	};
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(userId: string): Promise<{ id: string; publicId: string }> {
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
	return { id, publicId };
}

async function createRole(name: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: publicId,
				name,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function resetTargetAccess(): Promise<void> {
	if (!targetMemberId) return;
	await db
		.deleteFrom('member_permission_override_access_windows')
		.where('organisation_id', '=', organisationId)
		.where('organisation_member_id', '=', targetMemberId)
		.execute();
	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', '=', organisationId)
		.where('organisation_member_id', '=', targetMemberId)
		.execute();
	await db
		.deleteFrom('member_role_access_windows')
		.where('organisation_id', '=', organisationId)
		.where('organisation_member_id', '=', targetMemberId)
		.execute();
	await db
		.deleteFrom('member_roles')
		.where('organisation_id', '=', organisationId)
		.where('organisation_member_id', '=', targetMemberId)
		.execute();
	await db.deleteFrom('outbox_events').where('organisation_id', '=', organisationId).execute();
	await db
		.deleteFrom('audit_events')
		.where('acting_organisation_id', '=', organisationId)
		.execute();
}

async function cleanup(): Promise<void> {
	if (!db || !organisationId) return;
	await resetTargetAccess();
	await db
		.deleteFrom('member_role_access_windows')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db.deleteFrom('member_roles').where('organisation_id', '=', organisationId).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', '=', organisationId).execute();
	await db
		.deleteFrom('organisation_role_template_bindings')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', '=', organisationId).execute();
	await db
		.deleteFrom('organisation_members')
		.where('organisation_id', '=', organisationId)
		.execute();
	await db.deleteFrom('organisations').where('id', '=', organisationId).execute();
	if (ownerUserId || targetUserId) {
		await db
			.deleteFrom('users')
			.where('id', 'in', [ownerUserId, targetUserId].filter(Boolean))
			.execute();
	}
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
	targetUserId = await createUser('Target');
	ownerMemberId = (await createMember(ownerUserId)).id;
	const target = await createMember(targetUserId);
	targetMemberId = target.id;
	targetMemberPublicId = target.publicId;

	const ownerRole = await createRole('Owner');
	ownerRoleId = ownerRole.id;
	const readOnlyRole = await createRole('Read Only');
	readOnlyRoleId = readOnlyRole.id;
	readOnlyRolePublicId = readOnlyRole.publicId;
	const financeRole = await createRole('Finance/Commercial');
	financeRoleId = financeRole.id;
	financeRolePublicId = financeRole.publicId;
	const customManagerRole = await createRole(`${PREFIX}Custom Manager`);
	customManagerRoleId = customManagerRole.id;
	customManagerRolePublicId = customManagerRole.publicId;

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
				organisation_role_id: customManagerRoleId,
				permission_id: organisationManagePermissionId
			}
		])
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: ownerMemberId,
			organisation_role_id: ownerRoleId
		})
		.execute();
}

describe('system access conflict policies', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	beforeEach(async () => {
		await resetTargetAccess();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('rejects contradictory Read Only and Finance/Commercial standard roles transactionally', async () => {
		const service = new OrganisationAdminService(db);
		await expect(
			service.replaceMemberRoles(actor(), targetMemberPublicId, [
				readOnlyRolePublicId,
				financeRolePublicId
			])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		const assignments = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(assignments).toEqual([]);
		expect(readOnlyRoleId).toBeTruthy();
		expect(financeRoleId).toBeTruthy();
	});

	it('rejects an immediate explicit organisation-management escalation for Read Only', async () => {
		const admin = new OrganisationAdminService(db);
		await admin.replaceMemberRoles(actor(), targetMemberPublicId, [readOnlyRolePublicId]);

		const overrides = new MemberPermissionOverrideService(db);
		await expect(
			overrides.setOverride(actor(), {
				memberPublicId: targetMemberPublicId,
				permissionKey: 'organisation.manage',
				effect: 'allow',
				reason: 'Conflict test'
			})
		).rejects.toBeInstanceOf(MemberPermissionOverrideValidationError);

		const stored = await db
			.selectFrom('member_permission_overrides')
			.select('permission_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.where('permission_id', '=', organisationManagePermissionId)
			.executeTakeFirst();
		expect(stored).toBeUndefined();
	});

	it('rejects a scheduled future escalation at its effective boundary', async () => {
		const admin = new OrganisationAdminService(db);
		await admin.replaceMemberRoles(actor(), targetMemberPublicId, [readOnlyRolePublicId]);
		const effectiveFrom = new Date(Date.now() + 60 * 60 * 1000).toISOString();

		const overrides = new MemberPermissionOverrideService(db);
		await expect(
			overrides.setOverride(actor(), {
				memberPublicId: targetMemberPublicId,
				permissionKey: 'organisation.manage',
				effect: 'allow',
				reason: 'Scheduled conflict test',
				effectiveFrom
			})
		).rejects.toBeInstanceOf(MemberPermissionOverrideValidationError);
	});

	it('allows a deny to neutralise a custom grant but blocks removing the deny when toxicity would reappear', async () => {
		const overrides = new MemberPermissionOverrideService(db);
		await overrides.setOverride(actor(), {
			memberPublicId: targetMemberPublicId,
			permissionKey: 'organisation.manage',
			effect: 'deny',
			reason: 'Least privilege safeguard'
		});

		const admin = new OrganisationAdminService(db);
		await admin.replaceMemberRoles(actor(), targetMemberPublicId, [
			readOnlyRolePublicId,
			customManagerRolePublicId
		]);

		await expect(
			overrides.removeOverride(actor(), {
				memberPublicId: targetMemberPublicId,
				permissionKey: 'organisation.manage'
			})
		).rejects.toBeInstanceOf(MemberPermissionOverrideValidationError);

		const stored = await db
			.selectFrom('member_permission_overrides')
			.select('effect')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.where('permission_id', '=', organisationManagePermissionId)
			.executeTakeFirstOrThrow();
		expect(stored.effect).toBe('deny');
		expect(customManagerRoleId).toBeTruthy();
	});
});
