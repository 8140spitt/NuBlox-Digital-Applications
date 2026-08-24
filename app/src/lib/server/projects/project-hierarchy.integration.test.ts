import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { ProjectHierarchyService, ProjectHierarchyValidationError } from './project-hierarchy-service';
import { ProjectRepository } from './project-repository';
import { ProjectWorkspaceService } from './project-workspace-service';

const PREFIX = 'Project Hierarchy Integration ';
const PROJECT_PREFIX = 'PHI-P-';
const PORTFOLIO_PREFIX = 'PHI-PORT-';
const PROGRAMME_PREFIX = 'PHI-PROG-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let outsiderMemberId = '';
let ownerUserId = '';
let viewerUserId = '';
let outsiderUserId = '';
let ownerActor: TenantActorContext;
let viewerActor: TenantActorContext;
let outsiderActor: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: randomUUID(),
				display_name: `${PREFIX}${label}`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-24T14:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function grantRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();

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

		await db.deleteFrom('programmes').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('portfolios').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	outsiderUserId = await createUser('Outsider');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	outsiderMemberId = await createMember(organisationBId, outsiderUserId);

	await grantRole(organisationAId, ownerMemberId, 'Hierarchy Manager', [
		'project.create',
		'project.view',
		'project.manage',
		'project.portfolio.view',
		'project.portfolio.manage',
		'project.programme.view',
		'project.programme.manage'
	]);
	await grantRole(organisationAId, viewerMemberId, 'Project Viewer', ['project.view']);
	await grantRole(organisationBId, outsiderMemberId, 'Other Organisation Manager', [
		'project.manage',
		'project.portfolio.view',
		'project.portfolio.manage',
		'project.programme.view',
		'project.programme.manage'
	]);

	ownerActor = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `project-hierarchy-${randomUUID()}`
	};
	viewerActor = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `project-hierarchy-${randomUUID()}`
	};
	outsiderActor = {
		organisationId: organisationBId,
		userId: outsiderUserId,
		memberId: outsiderMemberId,
		correlationId: `project-hierarchy-${randomUUID()}`
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('portfolio, programme and project hierarchy', () => {
	it('creates an audited portfolio and programme, then attaches an organisation-owned project', async () => {
		const hierarchy = new ProjectHierarchyService(db);
		const portfolio = await hierarchy.createPortfolio(ownerActor, {
			portfolioNumber: `${PORTFOLIO_PREFIX}001`,
			name: 'Capital Investment Portfolio',
			description: 'Strategic projects grouped under one owned portfolio.'
		});
		const programme = await hierarchy.createProgramme(ownerActor, {
			programmeNumber: `${PROGRAMME_PREFIX}001`,
			name: 'Regional Delivery Programme',
			portfolioPublicId: portfolio.publicId
		});
		expect(programme.portfolioPublicId).toBe(portfolio.publicId);

		const project = await new ProjectWorkspaceService(db).createProject(ownerActor, {
			projectNumber: `${PROJECT_PREFIX}001`,
			name: 'Hierarchy Project'
		});
		await new ProjectRepository(db).insertProjectMember(
			project.id,
			organisationAId,
			viewerMemberId,
			new Date('2026-08-24T14:10:00.000Z')
		);

		const assigned = await hierarchy.assignProjectToProgramme(ownerActor, {
			projectPublicId: project.publicId,
			programmePublicId: programme.publicId
		});
		expect(assigned).toMatchObject({
			projectId: project.id,
			programmePublicId: programme.publicId,
			programmeName: programme.name,
			portfolioPublicId: portfolio.publicId,
			portfolioName: portfolio.name
		});

		const workspace = await new ProjectWorkspaceService(db).getWorkspace(ownerActor, project.publicId);
		expect(workspace.hierarchy?.programmePublicId).toBe(programme.publicId);
		expect(workspace.hierarchy?.portfolioPublicId).toBe(portfolio.publicId);

		const audit = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationAId)
			.where('action_key', 'in', [
				'portfolio.created',
				'programme.created',
				'project.programme_assigned'
			])
			.orderBy('id', 'asc')
			.execute();
		expect(audit.map((event) => event.action_key)).toEqual([
			'portfolio.created',
			'programme.created',
			'project.programme_assigned'
		]);
	});

	it('keeps organisation-wide hierarchy permissions separate from authorised project parent context', async () => {
		const hierarchy = await new ProjectHierarchyService(db).listHierarchy(viewerActor);
		expect(hierarchy.canViewPortfolios).toBe(false);
		expect(hierarchy.canViewProgrammes).toBe(false);
		expect(hierarchy.portfolios).toEqual([]);
		expect(hierarchy.programmes).toEqual([]);

		const projects = await new ProjectWorkspaceService(db).listProjects(viewerActor);
		expect(projects.projects).toHaveLength(1);
		expect(projects.projects[0]?.hierarchy?.portfolioName).toBe('Capital Investment Portfolio');
		expect(projects.projects[0]?.hierarchy?.programmeName).toBe('Regional Delivery Programme');
	});

	it('does not allow another organisation to reference a portfolio it does not own', async () => {
		const ownerHierarchy = await new ProjectHierarchyService(db).listHierarchy(ownerActor);
		const portfolio = ownerHierarchy.portfolios[0];
		expect(portfolio).toBeDefined();
		await expect(
			new ProjectHierarchyService(db).createProgramme(outsiderActor, {
				programmeNumber: `${PROGRAMME_PREFIX}OUT`,
				name: 'Cross-tenant programme',
				portfolioPublicId: portfolio!.publicId
			})
		).rejects.toBeInstanceOf(ProjectHierarchyValidationError);
	});

	it('can return an assigned project to standalone status without deleting hierarchy records', async () => {
		const projects = await new ProjectWorkspaceService(db).listProjects(ownerActor);
		const project = projects.projects.find((candidate) => candidate.projectNumber === `${PROJECT_PREFIX}001`);
		expect(project).toBeDefined();
		const context = await new ProjectHierarchyService(db).assignProjectToProgramme(ownerActor, {
			projectPublicId: project!.publicId,
			programmePublicId: null
		});
		expect(context.programmeId).toBeNull();
		expect(context.portfolioId).toBeNull();

		const hierarchy = await new ProjectHierarchyService(db).listHierarchy(ownerActor);
		expect(hierarchy.portfolios).toHaveLength(1);
		expect(hierarchy.programmes).toHaveLength(1);
	});
});
