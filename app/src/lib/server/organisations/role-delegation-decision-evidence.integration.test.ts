import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { DelegatedAccessAuthorityService } from './delegated-access-authority-service';
import {
	decideOrganisationRoleDelegation,
	explainOrganisationRoleDelegation
} from './role-delegation-policy';
import { ensureStandardAccessRoleBindings } from './standard-access-roles';

const PREFIX = 'Role Delegation Decision Evidence Integration ';

let db: Database;
let organisationId: string;
let ownerUserId: string;
let ownerMemberId: string;
let adminUserId: string;
let adminMemberId: string;
let adminMemberPublicId: string;
let memberUserId: string;
let memberId: string;
let ownerRoleId: string;
let ownerRolePublicId: string;
let administratorRoleId: string;
let managerRoleId: string;
let managerRolePublicId: string;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function actor(userId: string, organisationMemberId: string) {
	return {
		organisationId,
		userId,
		memberId: organisationMemberId,
		correlationId: `role-delegation-evidence-${randomUUID()}`
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
				description: `${PREFIX}${name}`,
				is_active: 1
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
			.where('is_active', '=', 1)
			.executeTakeFirstOrThrow()
	).id;
}

async function cleanup(): Promise<void> {
	if (!db) return;
	if (organisationId) {
		await db
			.deleteFrom('organisation_delegation_policies')
			.where('organisation_id', '=', organisationId)
			.execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', '=', organisationId)
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
	const userIds = [ownerUserId, adminUserId, memberUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	ownerUserId = await createUser('Owner');
	adminUserId = await createUser('Administrator');
	memberUserId = await createUser('Member');
	({ id: ownerMemberId } = await createMember(ownerUserId));
	({ id: adminMemberId, publicId: adminMemberPublicId } = await createMember(adminUserId));
	({ id: memberId } = await createMember(memberUserId));

	({ id: ownerRoleId, publicId: ownerRolePublicId } = await createRole('Owner'));
	({ id: administratorRoleId } = await createRole('Administrator'));
	({ id: managerRoleId, publicId: managerRolePublicId } = await createRole('Manager'));
	await ensureStandardAccessRoleBindings(db, organisationId);

	const organisationManagePermissionId = await permissionId('organisation.manage');
	const workViewPermissionId = await permissionId('work.view');
	await db
		.insertInto('role_permissions')
		.values([
			{
				organisation_id: organisationId,
				organisation_role_id: administratorRoleId,
				permission_id: organisationManagePermissionId
			},
			{
				organisation_id: organisationId,
				organisation_role_id: managerRoleId,
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
			},
			{
				organisation_id: organisationId,
				organisation_member_id: memberId,
				organisation_role_id: managerRoleId
			}
		])
		.execute();
}

describe('role delegation decision evidence', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	beforeEach(async () => {
		await db
			.deleteFrom('organisation_delegation_policies')
			.where('organisation_id', '=', organisationId)
			.execute();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('explains the existing owner, organisation-manager, effective-ceiling and owner-boundary paths', async () => {
		const at = new Date('2030-06-01T12:00:00.000Z');

		const ownerEvaluation = await explainOrganisationRoleDelegation(
			db,
			actor(ownerUserId, ownerMemberId),
			[managerRolePublicId],
			{ at }
		);
		expect(ownerEvaluation).toEqual({
			decision: { allowed: true, deniedPermissionKeys: [] },
			evidence: {
				evaluatedAt: at.toISOString(),
				basis: 'active-owner',
				policyPublicId: null,
				policyState: null
			}
		});

		const adminActor = actor(adminUserId, adminMemberId);
		const managerEvaluation = await explainOrganisationRoleDelegation(
			db,
			adminActor,
			[managerRolePublicId],
			{ at }
		);
		expect(managerEvaluation.evidence).toEqual({
			evaluatedAt: at.toISOString(),
			basis: 'organisation-manage',
			policyPublicId: null,
			policyState: null
		});
		expect(await decideOrganisationRoleDelegation(db, adminActor, [managerRolePublicId], { at })).toEqual(
			managerEvaluation.decision
		);

		const memberEvaluation = await explainOrganisationRoleDelegation(
			db,
			actor(memberUserId, memberId),
			[managerRolePublicId],
			{ at }
		);
		expect(memberEvaluation.decision).toEqual({ allowed: true, deniedPermissionKeys: [] });
		expect(memberEvaluation.evidence.basis).toBe('effective-permission-ceiling');

		const ownerBoundary = await explainOrganisationRoleDelegation(
			db,
			adminActor,
			[ownerRolePublicId],
			{ at }
		);
		expect(ownerBoundary.decision).toEqual({
			allowed: false,
			deniedPermissionKeys: ['access-role.owner.delegate']
		});
		expect(ownerBoundary.evidence.basis).toBe('owner-required');
	});

	it('identifies configured policy provenance and lifecycle state without changing decision semantics', async () => {
		const effectiveFrom = new Date('2030-07-01T09:00:00.000Z');
		const expiresAt = new Date('2030-07-01T17:00:00.000Z');
		const policyPublicId = await new DelegatedAccessAuthorityService(db).setPolicy(
			actor(ownerUserId, ownerMemberId),
			adminMemberPublicId,
			{
				allowedRoleKeys: ['manager'],
				allowedPermissionKeys: ['work.view'],
				effectiveFrom,
				expiresAt,
				reason: 'Evidence fixture for a time-bounded delegated authority policy.'
			}
		);
		const adminActor = actor(adminUserId, adminMemberId);

		for (const [at, policyState, allowed, deniedPermissionKeys] of [
			[
				new Date('2030-07-01T08:59:59.000Z'),
				'not-effective',
				false,
				['access-delegation.policy.not-effective']
			],
			[effectiveFrom, 'active', true, []],
			[expiresAt, 'expired', false, ['access-delegation.policy.expired']]
		] as const) {
			const explained = await explainOrganisationRoleDelegation(
				db,
				adminActor,
				[managerRolePublicId],
				{ at }
			);
			expect(explained.decision).toEqual({ allowed, deniedPermissionKeys: [...deniedPermissionKeys] });
			expect(explained.evidence).toEqual({
				evaluatedAt: at.toISOString(),
				basis: 'configured-policy',
				policyPublicId,
				policyState
			});
			expect(await decideOrganisationRoleDelegation(db, adminActor, [managerRolePublicId], { at })).toEqual(
				explained.decision
			);
		}
	});
});
