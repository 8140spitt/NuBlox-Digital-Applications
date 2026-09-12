import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationTeamService,
	OrganisationTeamValidationError
} from './organisation-team-service';

const PREFIX = 'Organisation Team Integration ';

let db: Database;
let organisationId: string;
let organisationPublicId: string;
let otherOrganisationId: string;
let managerUserId: string;
let managerMemberId: string;
let managerMemberPublicId: string;
let targetUserId: string;
let targetMemberId: string;
let targetMemberPublicId: string;
let ordinaryUserId: string;
let ordinaryMemberId: string;
let otherUserId: string;
let otherMemberPublicId: string;
let managerRoleId: string;
let memberManagePermissionId: string;

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
	organisation: string,
	userId: string
): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisation,
				user_id: userId,
				public_id: publicId,
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisationIds = [organisationId, otherOrganisationId].filter(Boolean);
	if (organisationIds.length > 0) {
		await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('team_members').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('teams').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	const userIds = [managerUserId, targetUserId, ordinaryUserId, otherUserId].filter(Boolean);
	if (userIds.length > 0) await db.deleteFrom('users').where('id', 'in', userIds).execute();
}

async function createFixture(): Promise<void> {
	memberManagePermissionId = (
		await db
			.selectFrom('permissions')
			.select('id')
			.where('permission_key', '=', 'member.manage')
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
	otherOrganisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Other Organisation`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	managerUserId = await createUser('Manager');
	targetUserId = await createUser('Target');
	ordinaryUserId = await createUser('Ordinary');
	otherUserId = await createUser('Other tenant member');

	const managerMember = await createMember(organisationId, managerUserId);
	const targetMember = await createMember(organisationId, targetUserId);
	const ordinaryMember = await createMember(organisationId, ordinaryUserId);
	const otherMember = await createMember(otherOrganisationId, otherUserId);
	managerMemberId = managerMember.id;
	managerMemberPublicId = managerMember.publicId;
	targetMemberId = targetMember.id;
	targetMemberPublicId = targetMember.publicId;
	ordinaryMemberId = ordinaryMember.id;
	otherMemberPublicId = otherMember.publicId;

	managerRoleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Member Manager`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('role_permissions')
		.values({
			organisation_id: organisationId,
			organisation_role_id: managerRoleId,
			permission_id: memberManagePermissionId
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: managerMemberId,
			organisation_role_id: managerRoleId
		})
		.executeTakeFirstOrThrow();
}

describe('organisation team governance', () => {
	beforeAll(async () => {
		db = getDatabase();
		await cleanup();
		await createFixture();
	});

	afterAll(async () => {
		await cleanup();
		await closeDatabase();
	});

	it('creates and updates organisation teams without changing member permissions', async () => {
		const manager = actor(managerUserId, managerMemberId);
		const target = actor(targetUserId, targetMemberId);
		const service = new OrganisationTeamService(db);
		const permissionService = new PermissionService(db);

		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: false,
			reason: 'default-deny'
		});

		const teamPublicId = await service.createTeam(manager, {
			name: ' Delivery Team ',
			description: ' Core delivery unit. ',
			memberPublicIds: [managerMemberPublicId, targetMemberPublicId]
		});

		const loaded = await service.load(manager);
		expect(loaded.teams).toEqual([
			expect.objectContaining({
				publicId: teamPublicId,
				name: 'Delivery Team',
				description: 'Core delivery unit.',
				isActive: true,
				members: expect.arrayContaining([
					expect.objectContaining({ publicId: managerMemberPublicId }),
					expect.objectContaining({ publicId: targetMemberPublicId })
				])
			})
		]);

		await expect(permissionService.decide(target, 'crm.view')).resolves.toEqual({
			allowed: false,
			reason: 'default-deny'
		});

		await service.updateTeam(manager, {
			teamPublicId,
			name: 'Delivery & Controls',
			description: 'Updated organisation unit.',
			isActive: false,
			memberPublicIds: [targetMemberPublicId]
		});

		const updated = (await service.load(manager)).teams[0]!;
		expect(updated).toMatchObject({
			publicId: teamPublicId,
			name: 'Delivery & Controls',
			description: 'Updated organisation unit.',
			isActive: false
		});
		expect(updated.members.map((member) => member.publicId)).toEqual([targetMemberPublicId]);

		const auditCount = await db
			.selectFrom('audit_events')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('acting_organisation_id', '=', organisationId)
			.where('subject_public_id', '=', teamPublicId)
			.where('action_key', 'in', ['organisation.team.create', 'organisation.team.update'])
			.executeTakeFirstOrThrow();
		expect(Number(auditCount.count)).toBe(2);

		const events = await db
			.selectFrom('outbox_events')
			.select(['topic', 'aggregate_public_id'])
			.where('organisation_id', '=', organisationId)
			.where('aggregate_public_id', '=', organisationPublicId)
			.where('topic', 'in', ['organisation.team.created', 'organisation.team.updated'])
			.orderBy('id', 'asc')
			.execute();
		expect(events).toEqual([
			{ topic: 'organisation.team.created', aggregate_public_id: organisationPublicId },
			{ topic: 'organisation.team.updated', aggregate_public_id: organisationPublicId }
		]);
	});

	it('rejects cross-tenant members, duplicate names and unauthorised administrators', async () => {
		const service = new OrganisationTeamService(db);
		const manager = actor(managerUserId, managerMemberId);

		await expect(
			service.createTeam(manager, {
				name: 'Cross tenant team',
				description: null,
				memberPublicIds: [otherMemberPublicId]
			})
		).rejects.toBeInstanceOf(OrganisationTeamValidationError);

		await service.createTeam(manager, {
			name: 'Commercial',
			description: null,
			memberPublicIds: []
		});
		await expect(
			service.createTeam(manager, {
				name: 'commercial',
				description: null,
				memberPublicIds: []
			})
		).rejects.toBeInstanceOf(OrganisationTeamValidationError);

		await expect(
			service.createTeam(actor(ordinaryUserId, ordinaryMemberId), {
				name: 'Unauthorised',
				description: null,
				memberPublicIds: []
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
