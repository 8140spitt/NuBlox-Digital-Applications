import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { InformationRepository } from '$lib/server/information/information-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { WorkItemRepository } from '$lib/server/work/work-item-repository';
import { EnterpriseSearchService } from './enterprise-search-service';

const PREFIX = 'Enterprise Search Integration ';
const PROJECT_PREFIX = 'ES-';

let db: Database;

type Fixture = {
	organisationId: string;
	memberId: string;
	userId: string;
	actor: TenantActorContext;
};

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length === 0) {
		await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
		return;
	}

	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('owning_organisation_id', 'in', organisationIds)
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);

	await db
		.deleteFrom('work_item_assignments')
		.where('work_item_owner_organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('work_items')
		.where('owning_organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('information_containers')
		.where('owning_organisation_id', 'in', organisationIds)
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

	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('organisation_members')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createFixture(label: string): Promise<Fixture> {
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}${label} User`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${label} Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
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
				joined_at: new Date('2026-08-24T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);

	return {
		organisationId,
		memberId,
		userId,
		actor: {
			organisationId,
			memberId,
			userId,
			correlationId: randomUUID()
		}
	};
}

async function setPermission(
	fixture: Fixture,
	permissionKey: string,
	effect: 'allow' | 'deny'
): Promise<void> {
	const permission = await db
		.selectFrom('permissions')
		.select('id')
		.where('permission_key', '=', permissionKey)
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	const existing = await db
		.selectFrom('member_permission_overrides')
		.select('permission_id')
		.where('organisation_id', '=', fixture.organisationId)
		.where('organisation_member_id', '=', fixture.memberId)
		.where('permission_id', '=', permission.id)
		.executeTakeFirst();
	if (existing) {
		await db
			.updateTable('member_permission_overrides')
			.set({ effect, reason: 'Enterprise search integration test' })
			.where('organisation_id', '=', fixture.organisationId)
			.where('organisation_member_id', '=', fixture.memberId)
			.where('permission_id', '=', permission.id)
			.executeTakeFirstOrThrow();
		return;
	}
	await db
		.insertInto('member_permission_overrides')
		.values({
			organisation_id: fixture.organisationId,
			organisation_member_id: fixture.memberId,
			permission_id: permission.id,
			effect,
			reason: 'Enterprise search integration test'
		})
		.executeTakeFirstOrThrow();
}

async function createProject(fixture: Fixture, label: string) {
	const repository = new ProjectRepository(db);
	const publicId = randomUUID();
	const projectId = await repository.insert({
		owningOrganisationId: fixture.organisationId,
		publicId,
		projectNumber: `${PROJECT_PREFIX}${label}`,
		name: `Searchable Alpha ${label} Project`,
		description: `Searchable Alpha project record for ${label}`,
		createdByMemberId: fixture.memberId
	});
	const joinedAt = new Date('2026-08-24T08:05:00.000Z');
	await repository.insertOwningParticipation(projectId, fixture.organisationId, joinedAt);
	await repository.insertProjectMember(
		projectId,
		fixture.organisationId,
		fixture.memberId,
		joinedAt
	);
	return { projectId, publicId };
}

async function createSearchableRecords(fixture: Fixture, label: string) {
	const project = await createProject(fixture, label);
	const informationRepository = new InformationRepository(db);
	const containerType = (await informationRepository.listContainerTypes())[0];
	if (!containerType) throw new Error('Expected at least one information container type.');
	const documentPublicId = randomUUID();
	await informationRepository.insertContainer({
		projectId: project.projectId,
		organisationId: fixture.organisationId,
		publicId: documentPublicId,
		typeId: containerType.id,
		containerNumber: `DOC-${label}`,
		title: `Searchable Alpha ${label} Drawing`,
		disciplineCode: null,
		classificationCode: null,
		createdByMemberId: fixture.memberId
	});

	const workRepository = new WorkItemRepository(db);
	const workPublicId = randomUUID();
	const work = await workRepository.create({
		publicId: workPublicId,
		owningOrganisationId: fixture.organisationId,
		projectId: project.projectId,
		kind: 'approval',
		sourceDomain: 'quality',
		title: `Searchable Alpha ${label} Approval`,
		description: `Searchable Alpha work item for ${label}`,
		priority: 'high',
		createdByMemberId: fixture.memberId
	});
	await workRepository.assign({
		workItemId: work.id,
		workItemOwnerOrganisationId: fixture.organisationId,
		scope: 'member',
		assignedOrganisationId: fixture.organisationId,
		assignedMemberId: fixture.memberId,
		assignedByMemberId: fixture.memberId
	});

	return {
		projectPublicId: project.publicId,
		documentPublicId,
		workPublicId
	};
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('enterprise search', () => {
	it('returns authorised cross-domain records without leaking another tenant and honours explicit denies', async () => {
		const allowedFixture = await createFixture('Allowed');
		const otherFixture = await createFixture('Other');
		await setPermission(allowedFixture, 'project.view', 'allow');
		await setPermission(allowedFixture, 'information.view', 'allow');
		await setPermission(allowedFixture, 'work.view', 'allow');

		const allowedRecords = await createSearchableRecords(allowedFixture, 'Allowed');
		await createSearchableRecords(otherFixture, 'Secret');

		const service = new EnterpriseSearchService(db);
		const results = await service.search(allowedFixture.actor, 'Searchable Alpha');
		expect(results.map((result) => result.kind).sort()).toEqual(['document', 'project', 'work']);
		expect(results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: `project:${allowedRecords.projectPublicId}`,
					title: 'Searchable Alpha Allowed Project'
				}),
				expect.objectContaining({
					id: `document:${allowedRecords.documentPublicId}`,
					title: 'Searchable Alpha Allowed Drawing'
				}),
				expect.objectContaining({
					id: `work:${allowedRecords.workPublicId}`,
					title: 'Searchable Alpha Allowed Approval'
				})
			])
		);
		expect(results.some((result) => result.title.includes('Secret'))).toBe(false);

		await setPermission(allowedFixture, 'information.view', 'deny');
		const deniedResults = await service.search(allowedFixture.actor, 'Searchable Alpha');
		expect(deniedResults.some((result) => result.kind === 'document')).toBe(false);
		expect(deniedResults.map((result) => result.kind).sort()).toEqual(['project', 'work']);
	});
});
