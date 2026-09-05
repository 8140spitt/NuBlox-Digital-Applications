import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import type { EmailDelivery, TransactionalEmail } from '$lib/server/email/email-delivery';
import {
	DelegatedAccessAuthorityAuthorisationError,
	DelegatedAccessAuthorityService,
	DelegatedAccessAuthorityValidationError
} from './delegated-access-authority-service';
import { OrganisationInvitationService } from './invitation-service';
import {
	OrganisationAdminService,
	OrganisationAdminValidationError
} from './organisation-admin-service';
import { decideOrganisationRoleDelegation, hasActiveOwnerRole } from './role-delegation-policy';
import { ensureStandardAccessRoleBindings } from './standard-access-roles';

const PREFIX = 'Delegated Access Authority Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let ownerMemberPublicId: string;
let adminUserId: string;
let adminMemberId: string;
let adminMemberPublicId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let ownerRoleId: string;
let administratorRoleId: string;
let managerRoleId: string;
let managerRolePublicId: string;
let financeRoleId: string;
let financeRolePublicId: string;
let customRoleId: string;
let customRolePublicId: string;
let organisationManagePermissionId: string;
let workViewPermissionId: string;
let financeManagePermissionId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

class CaptureEmailDelivery implements EmailDelivery {
	readonly messages: TransactionalEmail[] = [];
	async send(message: TransactionalEmail): Promise<void> {
		this.messages.push(message);
	}
}

function actor(userId: string, memberId: string) {
	return {
		organisationId,
		userId,
		memberId,
		correlationId: `delegated-authority-${randomUUID()}`
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

async function permissionId(permissionKey: string): Promise<string> {
	return (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', permissionKey)
			.executeTakeFirstOrThrow()
	).id;
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
				description: `${PREFIX}${name}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function clearPolicies(): Promise<void> {
	if (!organisationId) return;
	await db
		.deleteFrom('organisation_delegation_policies')
		.where('organisation_id', '=', organisationId)
		.execute();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await clearPolicies();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_invitation_roles')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('organisation_invitations')
			.where('organisation_id', '=', organisationId)
			.execute();
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
	const userIds = [ownerUserId, adminUserId, targetUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	organisationManagePermissionId = await permissionId('organisation.manage');
	workViewPermissionId = await permissionId('work.view');
	financeManagePermissionId = await permissionId('finance.manage');

	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	ownerUserId = await createUser('Owner');
	adminUserId = await createUser('Administrator');
	targetUserId = await createUser('Target');
	({ id: ownerMemberId, publicId: ownerMemberPublicId } = await createMember(ownerUserId));
	({ id: adminMemberId, publicId: adminMemberPublicId } = await createMember(adminUserId));
	({ id: targetMemberId, publicId: targetMemberPublicId } = await createMember(targetUserId));

	({ id: ownerRoleId } = await createRole('Owner'));
	({ id: administratorRoleId } = await createRole('Administrator'));
	({ id: managerRoleId, publicId: managerRolePublicId } = await createRole('Manager'));
	({ id: financeRoleId, publicId: financeRolePublicId } = await createRole('Finance/Commercial'));
	({ id: customRoleId, publicId: customRolePublicId } = await createRole(`${PREFIX}Custom Role`));
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
				organisation_role_id: administratorRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: managerRoleId,
				permission_id: workViewPermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: financeRoleId,
				permission_id: financeManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: customRoleId,
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
				organisation_member_id: adminMemberId,
				organisation_role_id: administratorRoleId
			}
		])
		.execute();
}

async function setRestrictedAdminPolicy(input?: {
	effectiveFrom?: Date | null;
	expiresAt?: Date | null;
}): Promise<string> {
	return new DelegatedAccessAuthorityService(db).setPolicy(
		actor(ownerUserId, ownerMemberId),
		adminMemberPublicId,
		{
			allowedRoleKeys: ['manager'],
			allowedPermissionKeys: ['work.view'],
			effectiveFrom: input?.effectiveFrom ?? null,
			expiresAt: input?.expiresAt ?? null,
			reason: 'Limit the administrator to ordinary work-view delegation.'
		}
	);
}

describe('Owner-governed delegated access authority', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	beforeEach(async () => {
		await clearPolicies();
		await db
			.deleteFrom('member_roles')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('preserves legacy non-Owner delegation when no policy is configured', async () => {
		const decision = await decideOrganisationRoleDelegation(db, actor(adminUserId, adminMemberId), [
			financeRolePublicId
		]);
		expect(decision).toEqual({ allowed: true, deniedPermissionKeys: [] });
	});

	it('allows only an active Owner to configure a policy and never restricts an Owner', async () => {
		const service = new DelegatedAccessAuthorityService(db);
		await expect(
			service.setPolicy(actor(adminUserId, adminMemberId), targetMemberPublicId, {
				allowedRoleKeys: ['manager'],
				allowedPermissionKeys: ['work.view'],
				reason: 'Administrator cannot author delegation governance.'
			})
		).rejects.toBeInstanceOf(DelegatedAccessAuthorityAuthorisationError);
		await expect(
			service.setPolicy(actor(ownerUserId, ownerMemberId), ownerMemberPublicId, {
				allowedRoleKeys: ['manager'],
				allowedPermissionKeys: ['work.view'],
				reason: 'Owner must remain sovereign.'
			})
		).rejects.toBeInstanceOf(DelegatedAccessAuthorityValidationError);
		expect(await hasActiveOwnerRole(db, actor(ownerUserId, ownerMemberId))).toBe(true);
	});

	it('enforces stable-role and permission ceilings on member role assignment', async () => {
		await setRestrictedAdminPolicy();
		const service = new OrganisationAdminService(db);
		await service.replaceMemberRoles(actor(adminUserId, adminMemberId), targetMemberPublicId, [
			managerRolePublicId
		]);
		const assigned = await db
			.selectFrom('member_roles')
			.select('organisation_role_id')
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', targetMemberId)
			.execute();
		expect(assigned.map((row) => row.organisation_role_id)).toEqual([managerRoleId]);

		await expect(
			service.replaceMemberRoles(actor(adminUserId, adminMemberId), targetMemberPublicId, [
				financeRolePublicId
			])
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);
	});

	it('fails closed before activation and at expiry, then restores legacy behavior only after removal', async () => {
		const effectiveFrom = new Date('2030-01-01T10:00:00.000Z');
		const expiresAt = new Date('2030-01-01T12:00:00.000Z');
		await setRestrictedAdminPolicy({ effectiveFrom, expiresAt });
		const adminActor = actor(adminUserId, adminMemberId);

		expect(
			await decideOrganisationRoleDelegation(db, adminActor, [managerRolePublicId], {
				at: new Date('2030-01-01T09:59:59.000Z')
			})
		).toEqual({
			allowed: false,
			deniedPermissionKeys: ['access-delegation.policy.not-effective']
		});
		expect(
			await decideOrganisationRoleDelegation(db, adminActor, [managerRolePublicId], {
				at: effectiveFrom
			})
		).toEqual({ allowed: true, deniedPermissionKeys: [] });
		expect(
			await decideOrganisationRoleDelegation(db, adminActor, [managerRolePublicId], {
				at: expiresAt
			})
		).toEqual({
			allowed: false,
			deniedPermissionKeys: ['access-delegation.policy.expired']
		});

		await new DelegatedAccessAuthorityService(db).removePolicy(
			actor(ownerUserId, ownerMemberId),
			adminMemberPublicId
		);
		expect(
			await decideOrganisationRoleDelegation(db, adminActor, [financeRolePublicId], {
				at: expiresAt
			})
		).toEqual({ allowed: true, deniedPermissionKeys: [] });
	});

	it('enforces the same ceiling for invitations', async () => {
		await setRestrictedAdminPolicy();
		const delivery = new CaptureEmailDelivery();
		const service = new OrganisationInvitationService(db, delivery);
		await service.createInvitation({
			actor: actor(adminUserId, adminMemberId),
			email: `allowed-${randomUUID()}@example.test`,
			rolePublicIds: [managerRolePublicId]
		});
		expect(delivery.messages).toHaveLength(1);

		await expect(
			service.createInvitation({
				actor: actor(adminUserId, adminMemberId),
				email: `denied-${randomUUID()}@example.test`,
				rolePublicIds: [financeRolePublicId]
			})
		).rejects.toThrow(/Delegated authority|cannot delegate/i);
	});

	it('prevents role-catalogue changes from bypassing the permission ceiling', async () => {
		await setRestrictedAdminPolicy();
		const service = new OrganisationAdminService(db);
		await expect(
			service.createRole(actor(adminUserId, adminMemberId), {
				name: `${PREFIX}Denied New Role ${randomUUID()}`,
				permissionKeys: ['finance.manage']
			})
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);

		const allowedRolePublicId = await service.createRole(actor(adminUserId, adminMemberId), {
			name: `${PREFIX}Allowed New Role ${randomUUID()}`,
			permissionKeys: ['work.view']
		});
		expect(allowedRolePublicId).toBeTruthy();

		await expect(
			service.updateRole(actor(adminUserId, adminMemberId), {
				rolePublicId: customRolePublicId,
				name: `${PREFIX}Custom Role`,
				isActive: true,
				permissionKeys: ['finance.manage']
			})
		).rejects.toBeInstanceOf(OrganisationAdminValidationError);
	});

	it('stores the configured ceiling as auditable normalized policy state', async () => {
		const policyPublicId = await setRestrictedAdminPolicy();
		const policy = await new DelegatedAccessAuthorityService(db).getPolicy(
			actor(ownerUserId, ownerMemberId),
			adminMemberPublicId
		);
		expect(policy).toMatchObject({
			publicId: policyPublicId,
			memberPublicId: adminMemberPublicId,
			allowedRoleKeys: ['manager'],
			allowedPermissionKeys: ['work.view']
		});
		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'organisation.delegation-policy.set')
			.orderBy('id', 'desc')
			.executeTakeFirst();
		expect(audit?.action_key).toBe('organisation.delegation-policy.set');
	});

	it('rejects Owner in the database-backed stable role grant set', async () => {
		const policyId = insertedId(
			await db
				.insertInto('organisation_delegation_policies')
				.values({
					public_id: randomUUID(),
					organisation_id: organisationId,
					organisation_member_id: adminMemberId,
					effective_from: null,
					expires_at: null,
					reason: 'Database invariant test.',
					created_by_member_id: ownerMemberId
				})
				.executeTakeFirstOrThrow()
		);
		await expect(
			db
				.insertInto('organisation_delegation_role_grants')
				.values({ policy_id: policyId, role_key: 'owner' })
				.executeTakeFirstOrThrow()
		).rejects.toThrow();
	});
});
