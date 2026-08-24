import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { WorkItemService, WorkKernelValidationError } from './work-item-service';

const TEST_NAME_PREFIX = 'Work Kernel Integration ';

let db: Database;

type WorkFixture = {
	userId: string;
	organisationAId: string;
	organisationBId: string;
	memberAId: string;
	memberBId: string;
	actorA: TenantActorContext;
};

type CountRow = { count: string | number | bigint };
type ActionRow = { action_key: string };

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanupWorkKernelIntegrationRows(): Promise<void> {
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${TEST_NAME_PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((organisation) => organisation.id);

	if (organisationIds.length > 0) {
		await sql`
			DELETE FROM work_item_decisions
			WHERE work_item_owner_organisation_id IN (${sql.join(organisationIds)})
		`.execute(db);
		await sql`
			DELETE FROM work_item_events
			WHERE work_item_owner_organisation_id IN (${sql.join(organisationIds)})
		`.execute(db);
		await sql`
			DELETE FROM work_item_assignments
			WHERE work_item_owner_organisation_id IN (${sql.join(organisationIds)})
		`.execute(db);
		await sql`
			DELETE FROM work_items
			WHERE owning_organisation_id IN (${sql.join(organisationIds)})
		`.execute(db);
		await sql`
			DELETE FROM outbox_events
			WHERE organisation_id IN (${sql.join(organisationIds)})
		`.execute(db);

		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}

	await db.deleteFrom('users').where('display_name', 'like', `${TEST_NAME_PREFIX}%`).execute();
}

async function createFixture(): Promise<WorkFixture> {
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

	const organisationAId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${TEST_NAME_PREFIX}Organisation A ${randomUUID().slice(0, 8)}`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const organisationBId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${TEST_NAME_PREFIX}Organisation B ${randomUUID().slice(0, 8)}`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);

	const joinedAt = new Date('2026-08-22T08:00:00.000Z');
	const memberAId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationAId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: joinedAt
			})
			.executeTakeFirstOrThrow()
	);
	const memberBId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationBId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: joinedAt
			})
			.executeTakeFirstOrThrow()
	);

	return {
		userId,
		organisationAId,
		organisationBId,
		memberAId,
		memberBId,
		actorA: {
			organisationId: organisationAId,
			userId,
			memberId: memberAId,
			correlationId: randomUUID()
		}
	};
}

async function setPermission(
	fixture: WorkFixture,
	permissionKey: string,
	effect: 'allow' | 'deny'
): Promise<void> {
	const permission = await db
		.selectFrom('permissions')
		.select('id')
		.where('permission_key', '=', permissionKey)
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();

	await db
		.insertInto('member_permission_overrides')
		.values({
			organisation_id: fixture.organisationAId,
			organisation_member_id: fixture.memberAId,
			permission_id: permission.id,
			effect,
			reason: 'Work Kernel integration test'
		})
		.executeTakeFirstOrThrow();
}

async function allow(fixture: WorkFixture, ...permissionKeys: string[]): Promise<void> {
	for (const permissionKey of permissionKeys) await setPermission(fixture, permissionKey, 'allow');
}

beforeAll(async () => {
	db = getDatabase();
	await cleanupWorkKernelIntegrationRows();
});

afterAll(async () => {
	await cleanupWorkKernelIntegrationRows();
	await closeDatabase();
});

describe('NuBlox Work Kernel', () => {
	it('creates, assigns, progresses and decides work with atomic audit and outbox evidence', async () => {
		const fixture = await createFixture();
		await allow(
			fixture,
			'work.view',
			'work.create',
			'work.assign',
			'work.progress',
			'work.complete',
			'work.approve'
		);

		const service = new WorkItemService(db);
		const created = await service.create(fixture.actorA, {
			kind: 'approval',
			sourceDomain: 'quality',
			title: 'Approve corrective action',
			priority: 'high',
			dueAt: new Date('2026-08-25T12:00:00.000Z')
		});
		expect(created.status).toBe('open');

		await service.assign(fixture.actorA, created.publicId, {
			scope: 'member',
			assignedOrganisationId: fixture.organisationAId,
			assignedMemberId: fixture.memberAId
		});

		await expect(service.listMyWork(fixture.actorA)).resolves.toEqual(
			expect.arrayContaining([expect.objectContaining({ publicId: created.publicId })])
		);

		const started = await service.transition(fixture.actorA, created.publicId, 'in_progress');
		expect(started.status).toBe('in_progress');
		await service.recordDecision(
			fixture.actorA,
			created.publicId,
			'approved',
			'Evidence reviewed.'
		);
		const completed = await service.transition(
			fixture.actorA,
			created.publicId,
			'completed',
			'Approved action completed.'
		);
		expect(completed.status).toBe('completed');
		expect(completed.completedByMemberId).toBe(fixture.memberAId);

		const workEventCount = await sql<CountRow>`
			SELECT COUNT(*) AS count
			FROM work_item_events
			WHERE work_item_id = ${created.id}
		`.execute(db);
		expect(Number(workEventCount.rows[0]?.count ?? 0)).toBe(5);

		const outboxCount = await sql<CountRow>`
			SELECT COUNT(*) AS count
			FROM outbox_events
			WHERE aggregate_type = 'work_item'
			  AND aggregate_public_id = ${created.publicId}
		`.execute(db);
		expect(Number(outboxCount.rows[0]?.count ?? 0)).toBe(5);

		const auditRows = await sql<ActionRow>`
			SELECT action_key
			FROM audit_events
			WHERE subject_type = 'work_item'
			  AND subject_public_id = ${created.publicId}
			ORDER BY id
		`.execute(db);
		expect(auditRows.rows.map((row) => row.action_key)).toEqual([
			'work.item.created',
			'work.item.assigned',
			'work.item.status_changed',
			'work.item.decision_recorded',
			'work.item.status_changed'
		]);
	});

	it('does not let work.manage bypass an explicit granular completion deny', async () => {
		const fixture = await createFixture();
		await setPermission(fixture, 'work.manage', 'allow');
		await setPermission(fixture, 'work.complete', 'deny');

		const service = new WorkItemService(db);
		const created = await service.create(fixture.actorA, {
			sourceDomain: 'project',
			title: 'Controlled completion permission test'
		});
		await service.transition(fixture.actorA, created.publicId, 'in_progress');

		await expect(
			service.transition(fixture.actorA, created.publicId, 'completed')
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('does not let work.manage bypass an explicit granular approval deny', async () => {
		const fixture = await createFixture();
		await setPermission(fixture, 'work.manage', 'allow');
		await setPermission(fixture, 'work.approve', 'deny');

		const service = new WorkItemService(db);
		const created = await service.create(fixture.actorA, {
			kind: 'approval',
			sourceDomain: 'commercial',
			title: 'Controlled approval permission test'
		});

		await expect(
			service.recordDecision(fixture.actorA, created.publicId, 'approved')
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('keeps cross-organisation assignment closed until participant validation is activated', async () => {
		const fixture = await createFixture();
		await allow(fixture, 'work.create', 'work.assign');

		const service = new WorkItemService(db);
		const created = await service.create(fixture.actorA, {
			sourceDomain: 'safety',
			title: 'Cross-organisation boundary test'
		});

		await expect(
			service.assign(fixture.actorA, created.publicId, {
				scope: 'member',
				assignedOrganisationId: fixture.organisationBId,
				assignedMemberId: fixture.memberBId
			})
		).rejects.toBeInstanceOf(WorkKernelValidationError);
	});
});