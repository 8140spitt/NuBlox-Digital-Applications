import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { InvalidLifecycleTransitionError, RecordNotFoundError, TenantAccessError } from './errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { OrganisationService } from '$lib/server/organisations/organisation-service';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectService } from '$lib/server/projects/project-service';

const TEST_NAME_PREFIX = 'Kernel Integration ';
const TEST_PROJECT_PREFIX = 'KIT-';
const TEST_CORRELATION_PREFIX = 'kernel-it-';

let db: Database;

type KernelFixture = {
	userId: string;
	organisationAId: string;
	organisationBId: string;
	memberAId: string;
	memberBId: string;
	actorA: TenantActorContext;
	actorB: TenantActorContext;
};

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanupKernelIntegrationRows(): Promise<void> {
	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('project_number', 'like', `${TEST_PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((project) => project.id);

	await db
		.deleteFrom('audit_events')
		.where('correlation_id', 'like', `${TEST_CORRELATION_PREFIX}%`)
		.execute();

	if (projectIds.length > 0) {
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('project_organisation_roles')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${TEST_NAME_PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((organisation) => organisation.id);

	if (organisationIds.length > 0) {
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}

	await db.deleteFrom('users').where('display_name', 'like', `${TEST_NAME_PREFIX}%`).execute();
}

async function createFixture(): Promise<KernelFixture> {
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

	const joinedAt = new Date('2026-08-15T12:00:00.000Z');
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
			correlationId: `${TEST_CORRELATION_PREFIX}${randomUUID()}`
		},
		actorB: {
			organisationId: organisationBId,
			userId,
			memberId: memberBId,
			correlationId: `${TEST_CORRELATION_PREFIX}${randomUUID()}`
		}
	};
}

function createProjectService(): ProjectService {
	return new ProjectService(db, randomUUID, () => new Date('2026-08-15T12:00:00.000Z'));
}

beforeAll(async () => {
	db = getDatabase();
	await cleanupKernelIntegrationRows();
});

afterAll(async () => {
	await cleanupKernelIntegrationRows();
	await closeDatabase();
});

describe('Platform Kernel tenant isolation', () => {
	it('requires the organisation, user and member tuple to match an active membership', async () => {
		const fixture = await createFixture();
		const repository = new OrganisationMembershipRepository(db);

		await expect(repository.findActiveActorMembership(fixture.actorA)).resolves.toMatchObject({
			id: fixture.memberAId,
			organisationId: fixture.organisationAId,
			userId: fixture.userId,
			status: 'active'
		});

		await expect(
			repository.findActiveActorMembership({
				organisationId: fixture.organisationBId,
				userId: fixture.userId,
				memberId: fixture.memberAId
			})
		).resolves.toBeNull();

		await expect(
			new OrganisationService(db).getCurrentOrganisation(fixture.actorB)
		).resolves.toMatchObject({
			id: fixture.organisationBId,
			status: 'active'
		});

		await expect(
			new OrganisationService(db).getCurrentOrganisation({
				...fixture.actorB,
				memberId: fixture.memberAId
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('keeps a new project invisible to organisations that do not participate', async () => {
		const fixture = await createFixture();
		const project = await createProjectService().createProject(fixture.actorA, {
			projectNumber: `${TEST_PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Tenant-isolated project'
		});

		const repository = new ProjectRepository(db);
		await expect(
			repository.findParticipatingByPublicId(fixture.organisationAId, project.publicId)
		).resolves.toMatchObject({ id: project.id });
		await expect(
			repository.findParticipatingByPublicId(fixture.organisationBId, project.publicId)
		).resolves.toBeNull();
	});

	it('has a database-level composite FK that rejects a member from another tenant', async () => {
		const fixture = await createFixture();
		const project = await createProjectService().createProject(fixture.actorA, {
			projectNumber: `${TEST_PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Composite tenant key project'
		});

		await expect(
			db
				.insertInto('project_members')
				.values({
					project_id: project.id,
					participant_organisation_id: fixture.organisationAId,
					organisation_member_id: fixture.memberBId,
					status: 'active',
					joined_at: new Date('2026-08-15T12:00:00.000Z'),
					left_at: null
				})
				.executeTakeFirstOrThrow()
		).rejects.toThrow();
	});
});

describe('Platform Kernel project lifecycle', () => {
	it('creates owner participation, creator membership and audit evidence atomically', async () => {
		const fixture = await createFixture();
		const project = await createProjectService().createProject(fixture.actorA, {
			projectNumber: `${TEST_PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Atomic project creation',
			description: 'Kernel integration test'
		});

		await expect(
			db
				.selectFrom('project_organisations')
				.select(['participant_organisation_id', 'status'])
				.where('project_id', '=', project.id)
				.executeTakeFirst()
		).resolves.toMatchObject({
			participant_organisation_id: fixture.organisationAId,
			status: 'active'
		});

		await expect(
			db
				.selectFrom('project_members')
				.select(['organisation_member_id', 'participant_organisation_id', 'status'])
				.where('project_id', '=', project.id)
				.executeTakeFirst()
		).resolves.toMatchObject({
			organisation_member_id: fixture.memberAId,
			participant_organisation_id: fixture.organisationAId,
			status: 'active'
		});

		await expect(
			db
				.selectFrom('audit_events')
				.select(['action_key', 'acting_organisation_id', 'actor_user_id', 'actor_member_id'])
				.where('project_id', '=', project.id)
				.where('action_key', '=', 'project.created')
				.executeTakeFirst()
		).resolves.toMatchObject({
			action_key: 'project.created',
			acting_organisation_id: fixture.organisationAId,
			actor_user_id: fixture.userId,
			actor_member_id: fixture.memberAId
		});
	});

	it('enforces the project lifecycle and records each accepted transition', async () => {
		const fixture = await createFixture();
		const service = createProjectService();
		const project = await service.createProject(fixture.actorA, {
			projectNumber: `${TEST_PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Lifecycle project'
		});

		await expect(
			service.transitionProject(fixture.actorA, {
				projectPublicId: project.publicId,
				toStatus: 'completed'
			})
		).rejects.toBeInstanceOf(InvalidLifecycleTransitionError);

		const active = await service.transitionProject(fixture.actorA, {
			projectPublicId: project.publicId,
			toStatus: 'active',
			effectiveDate: new Date('2026-08-10T00:00:00.000Z')
		});
		expect(active.status).toBe('active');
		expect(active.startedOn?.toISOString().slice(0, 10)).toBe('2026-08-10');

		const completed = await service.transitionProject(fixture.actorA, {
			projectPublicId: project.publicId,
			toStatus: 'completed',
			effectiveDate: new Date('2026-08-15T00:00:00.000Z')
		});
		expect(completed.status).toBe('completed');
		expect(completed.completedOn?.toISOString().slice(0, 10)).toBe('2026-08-15');

		const archived = await service.transitionProject(fixture.actorA, {
			projectPublicId: project.publicId,
			toStatus: 'archived'
		});
		expect(archived.status).toBe('archived');
		expect(archived.archivedAt).not.toBeNull();

		const auditRows = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('project_id', '=', project.id)
			.orderBy('id')
			.execute();
		expect(auditRows.map((row) => row.action_key)).toEqual([
			'project.created',
			'project.status_changed',
			'project.status_changed',
			'project.status_changed'
		]);
	});

	it('does not allow another tenant to change an owning-organisation lifecycle state', async () => {
		const fixture = await createFixture();
		const service = createProjectService();
		const project = await service.createProject(fixture.actorA, {
			projectNumber: `${TEST_PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Owner-only lifecycle project'
		});

		await expect(
			service.transitionProject(fixture.actorB, {
				projectPublicId: project.publicId,
				toStatus: 'active'
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);

		await expect(
			new ProjectRepository(db).findOwnedByPublicId(fixture.organisationAId, project.publicId)
		).resolves.toMatchObject({ status: 'proposed' });
	});
});
