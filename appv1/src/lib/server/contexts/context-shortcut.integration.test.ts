import { randomUUID } from 'node:crypto';

import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ContextShortcutService } from './context-shortcut-service';

const PREFIX = 'Context Shortcut Integration ';
const PROJECT_PREFIX = 'CTX-';

let db: Database;

type Fixture = {
	organisationId: string;
	organisationPublicId: string;
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

	await sql`
		DELETE FROM member_context_preferences
		WHERE organisation_id IN (${sql.join(organisationIds)})
	`.execute(db);
	await db.deleteFrom('assets').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('asset_types').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('facilities').where('organisation_id', 'in', organisationIds).execute();

	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('owning_organisation_id', 'in', organisationIds)
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);
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
	const organisationPublicId = randomUUID();
	const organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
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
				joined_at: new Date('2026-08-24T09:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);

	return {
		organisationId,
		organisationPublicId,
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
			.set({ effect, reason: 'Context shortcut integration test' })
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
			reason: 'Context shortcut integration test'
		})
		.executeTakeFirstOrThrow();
}

async function createProject(fixture: Fixture, label: string) {
	const repository = new ProjectRepository(db);
	const publicId = randomUUID();
	const id = await repository.insert({
		owningOrganisationId: fixture.organisationId,
		publicId,
		projectNumber: `${PROJECT_PREFIX}${label}`,
		name: `${PREFIX}${label} Project`,
		description: 'Context shortcut project',
		createdByMemberId: fixture.memberId
	});
	const joinedAt = new Date('2026-08-24T09:05:00.000Z');
	await repository.insertOwningParticipation(id, fixture.organisationId, joinedAt);
	await repository.insertProjectMember(id, fixture.organisationId, fixture.memberId, joinedAt);
	return { id, publicId };
}

async function createFacilityAndAsset(fixture: Fixture, label: string) {
	const facilityPublicId = randomUUID();
	const facilityId = insertedId(
		await db
			.insertInto('facilities')
			.values({
				organisation_id: fixture.organisationId,
				public_id: facilityPublicId,
				facility_code: `FAC-${label}`,
				name: `${PREFIX}${label} Facility`,
				description: 'Context shortcut property',
				created_by_member_id: fixture.memberId
			})
			.executeTakeFirstOrThrow()
	);
	const category = await db
		.selectFrom('asset_categories')
		.select('id')
		.where('is_active', '=', 1)
		.orderBy('id')
		.executeTakeFirstOrThrow();
	const assetTypeId = insertedId(
		await db
			.insertInto('asset_types')
			.values({
				organisation_id: fixture.organisationId,
				public_id: randomUUID(),
				asset_category_id: category.id,
				code: `TYPE-${label}`,
				name: `${PREFIX}${label} Asset Type`,
				description: 'Context shortcut asset type'
			})
			.executeTakeFirstOrThrow()
	);
	const assetPublicId = randomUUID();
	await db
		.insertInto('assets')
		.values({
			organisation_id: fixture.organisationId,
			public_id: assetPublicId,
			facility_id: facilityId,
			asset_type_id: assetTypeId,
			asset_tag: `ASSET-${label}`,
			name: `${PREFIX}${label} Asset`,
			description: 'Context shortcut asset',
			created_by_member_id: fixture.memberId
		})
		.executeTakeFirstOrThrow();

	return { facilityPublicId, assetPublicId };
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('personal context shortcuts', () => {
	it('keeps recent, favourite and pinned contexts tenant-safe and permission-aware', async () => {
		const allowed = await createFixture('Allowed');
		const other = await createFixture('Other');
		for (const permissionKey of ['project.view', 'facilities.view', 'assets.view']) {
			await setPermission(allowed, permissionKey, 'allow');
		}

		const allowedProject = await createProject(allowed, 'Allowed');
		const allowedEstate = await createFacilityAndAsset(allowed, 'Allowed');
		await createProject(other, 'Secret');
		await createFacilityAndAsset(other, 'Secret');

		const service = new ContextShortcutService(db, () => new Date('2026-08-24T10:00:00.000Z'));
		const initial = await service.getCentre(allowed.actor);
		expect(initial.items.map((item) => item.kind)).toEqual([
			'organisation',
			'project',
			'facility',
			'asset'
		]);
		expect(initial.items.some((item) => item.label.includes('Secret'))).toBe(false);

		await service.setPreference(allowed.actor, {
			kind: 'project',
			publicId: allowedProject.publicId,
			isFavourite: true,
			isPinned: true
		});
		await expect(
			service.openContext(allowed.actor, 'facility', allowedEstate.facilityPublicId)
		).resolves.toContain('/assets?facility=');
		await service.setPreference(allowed.actor, {
			kind: 'asset',
			publicId: allowedEstate.assetPublicId,
			isFavourite: true,
			isPinned: false
		});

		const personalised = await service.getCentre(allowed.actor);
		expect(personalised.pinned).toEqual([
			expect.objectContaining({ kind: 'project', publicId: allowedProject.publicId })
		]);
		expect(personalised.favourites).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'project', publicId: allowedProject.publicId }),
				expect.objectContaining({ kind: 'asset', publicId: allowedEstate.assetPublicId })
			])
		);
		expect(personalised.recent[0]).toEqual(
			expect.objectContaining({ kind: 'facility', publicId: allowedEstate.facilityPublicId })
		);

		await setPermission(allowed, 'assets.view', 'deny');
		const afterDeny = await service.getCentre(allowed.actor);
		expect(afterDeny.items.some((item) => item.kind === 'asset')).toBe(false);
		expect(afterDeny.favourites.some((item) => item.kind === 'asset')).toBe(false);
	});
});
