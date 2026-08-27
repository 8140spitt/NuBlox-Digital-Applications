import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectInformationRequirementsService,
	ProjectInformationRequirementValidationError
} from './project-information-requirements-service';

const PREFIX = 'Information Requirement Integration ';
const PROJECT_PREFIX = 'INFOREQ-';

let db: Database;
let organisationId = '';
let organisationPublicId = '';
let ownerUserId = '';
let viewerUserId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let projectId = '';
let projectPublicId = '';
let projectManagerRoleId = '';
let projectManagerRoleKey = '';
let containerTypeId = 0;
let containerTypeCode = '';
let alternateContainerTypeId = 0;
let purposeId = 0;
let purposeCode = '';
let alternatePurposeId = 0;
let owner: TenantActorContext;
let viewer: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);
	if (projectIds.length > 0) {
		await db
			.deleteFrom('project_information_requirements')
			.where('project_id', 'in', projectIds)
			.execute();
		const containers = await db
			.selectFrom('information_containers')
			.select('id')
			.where('project_id', 'in', projectIds)
			.execute();
		const containerIds = containers.map((row) => row.id);
		if (containerIds.length > 0) {
			await db
				.deleteFrom('information_version_issue_events')
				.where(
					'information_container_version_id',
					'in',
					db
						.selectFrom('information_container_versions')
						.select('id')
						.where('information_container_id', 'in', containerIds)
				)
				.execute();
			await db
				.deleteFrom('information_container_versions')
				.where('information_container_id', 'in', containerIds)
				.execute();
			await db.deleteFrom('information_containers').where('id', 'in', containerIds).execute();
		}
		await db.deleteFrom('audit_events').where('project_id', 'in', projectIds).execute();
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
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
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
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-27T07:30:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
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
		.execute();
}

async function createContainer(options: {
	containerTypeId?: number;
	number: string;
	title: string;
}): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('information_containers')
			.values({
				project_id: projectId,
				owning_organisation_id: organisationId,
				public_id: publicId,
				information_container_type_id: options.containerTypeId ?? containerTypeId,
				container_number: options.number,
				title: options.title,
				discipline_code: null,
				classification_code: null,
				project_site_id: null,
				lifecycle_status: 'active',
				created_by_member_id: ownerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
}

async function createIssuedVersion(options: {
	containerId: string;
	sequence: number;
	revisionCode: string;
	purposeId: number;
	suitabilityCode: string;
}): Promise<void> {
	const versionPublicId = randomUUID();
	const result = await db
		.insertInto('information_container_versions')
		.values({
			owning_organisation_id: organisationId,
			project_id: projectId,
			public_id: versionPublicId,
			information_container_id: options.containerId,
			version_sequence: options.sequence,
			revision_code: options.revisionCode,
			title_at_version: 'Controlled issued revision',
			information_purpose_code_id: options.purposeId,
			suitability_code: options.suitabilityCode,
			version_status: 'issued',
			created_by_member_id: ownerMemberId,
			locked_at: new Date('2026-08-27T08:00:00.000Z'),
			locked_by_member_id: ownerMemberId
		})
		.executeTakeFirstOrThrow();
	const versionId = insertedId(result);
	await db
		.insertInto('information_version_issue_events')
		.values({
			project_id: projectId,
			issuing_organisation_id: organisationId,
			information_container_version_id: versionId,
			version_owner_organisation_id: organisationId,
			issue_sequence: 1,
			issued_by_member_id: ownerMemberId,
			issue_channel: 'cde',
			note: null
		})
		.execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();

	const containerTypes = await db
		.selectFrom('information_container_types')
		.select(['id', 'code'])
		.where('is_active', '=', 1)
		.orderBy('id', 'asc')
		.limit(2)
		.execute();
	expect(containerTypes.length).toBeGreaterThanOrEqual(2);
	containerTypeId = containerTypes[0]!.id;
	containerTypeCode = containerTypes[0]!.code;
	alternateContainerTypeId = containerTypes[1]!.id;

	const purposes = await db
		.selectFrom('information_purpose_codes')
		.select(['id', 'code'])
		.where('is_active', '=', 1)
		.orderBy('id', 'asc')
		.limit(2)
		.execute();
	expect(purposes.length).toBeGreaterThanOrEqual(2);
	purposeId = purposes[0]!.id;
	purposeCode = purposes[0]!.code;
	alternatePurposeId = purposes[1]!.id;

	const projectManagerRole = await db
		.selectFrom('project_role_types')
		.select(['id', 'role_key'])
		.where('role_key', '=', 'project_manager')
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	projectManagerRoleId = projectManagerRole.id;
	projectManagerRoleKey = projectManagerRole.role_key;

	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	organisationPublicId = randomUUID();
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: organisationPublicId,
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	ownerMemberId = await createMember(ownerUserId);
	viewerMemberId = await createMember(viewerUserId);

	await assignPermissionRole(ownerMemberId, 'Owner role', [
		'project.view',
		'information.view',
		'information.requirement.manage',
		'information.requirement.approve',
		'information.responsibility.manage',
		'information.requirement.link'
	]);
	await assignPermissionRole(viewerMemberId, 'Viewer role', ['project.view', 'information.view']);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationId,
				public_id: projectPublicId,
				project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
				name: `${PREFIX}Controlled delivery`,
				status: 'active',
				created_by_member_id: ownerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values({
			project_id: projectId,
			participant_organisation_id: organisationId,
			status: 'active',
			invited_by_member_id: null,
			joined_at: new Date('2026-08-27T07:45:00.000Z'),
			left_at: null
		})
		.execute();
	await db
		.insertInto('project_members')
		.values([
			{
				project_id: projectId,
				participant_organisation_id: organisationId,
				organisation_member_id: ownerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-27T07:45:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationId,
				organisation_member_id: viewerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-27T07:46:00.000Z'),
				left_at: null
			}
		])
		.execute();
	await db
		.insertInto('project_organisation_roles')
		.values({
			project_id: projectId,
			participant_organisation_id: organisationId,
			project_role_type_id: projectManagerRoleId
		})
		.execute();

	owner = {
		organisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: randomUUID()
	};
	viewer = {
		organisationId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: randomUUID()
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project information requirements and responsibility governance', () => {
	it('creates a draft, assigns a project-role RACI and locks the definition on approval', async () => {
		const service = new ProjectInformationRequirementsService(db, randomUUID, () =>
			new Date('2026-08-27T09:00:00.000Z')
		);
		const publicId = await service.createRequirement(owner, {
			projectPublicId,
			requirementCode: 'PIR-001',
			requirementType: 'PIR',
			title: 'Coordinated design information',
			description: 'Provide coordinated design information for construction.',
			containerTypeCode,
			requiredPurposeCode: purposeCode,
			requiredSuitabilityCode: 'S1',
			requiredByOn: new Date('2026-09-15T12:00:00.000Z')
		});
		await service.replaceResponsibilities(owner, {
			projectPublicId,
			requirementPublicId: publicId,
			responsibilities: [
				{
					organisationPublicId,
					roleKey: projectManagerRoleKey,
					responsibilityCode: 'accountable'
				}
			]
		});
		await service.approveRequirement(owner, projectPublicId, publicId);

		const workspace = await service.getWorkspace(owner, projectPublicId);
		const requirement = workspace.requirements.find((item) => item.publicId === publicId);
		expect(requirement).toMatchObject({
			requirementCode: 'PIR-001',
			requirementType: 'PIR',
			status: 'approved',
			health: 'open',
			requiredPurposeCode: purposeCode,
			requiredSuitabilityCode: 'S1'
		});
		expect(requirement?.responsibilities).toHaveLength(1);
		expect(requirement?.responsibilities[0]).toMatchObject({
			organisationPublicId,
			roleKey: projectManagerRoleKey,
			responsibilityCode: 'accountable'
		});

		await expect(
			service.updateRequirement(owner, {
				projectPublicId,
				requirementPublicId: publicId,
				requirementCode: 'PIR-001',
				requirementType: 'PIR',
				title: 'Changed after approval'
			})
		).rejects.toBeInstanceOf(ProjectInformationRequirementValidationError);
	});

	it('derives fulfilment only from an issued revision matching the required purpose and suitability', async () => {
		const service = new ProjectInformationRequirementsService(db, randomUUID, () =>
			new Date('2026-08-27T09:10:00.000Z')
		);
		const requirementPublicId = await service.createRequirement(owner, {
			projectPublicId,
			requirementCode: 'EIR-001',
			requirementType: 'EIR',
			title: 'Construction issue drawing',
			containerTypeCode,
			requiredPurposeCode: purposeCode,
			requiredSuitabilityCode: 'S1'
		});
		await service.replaceResponsibilities(owner, {
			projectPublicId,
			requirementPublicId,
			responsibilities: [
				{
					organisationPublicId,
					roleKey: projectManagerRoleKey,
					responsibilityCode: 'responsible'
				}
			]
		});
		await service.approveRequirement(owner, projectPublicId, requirementPublicId);

		const container = await createContainer({ number: 'DRG-001', title: 'General arrangement' });
		await service.linkContainer(owner, projectPublicId, requirementPublicId, container.publicId);
		await createIssuedVersion({
			containerId: container.id,
			sequence: 1,
			revisionCode: 'P01',
			purposeId: alternatePurposeId,
			suitabilityCode: 'S1'
		});
		let requirement = (await service.getWorkspace(owner, projectPublicId)).requirements.find(
			(item) => item.publicId === requirementPublicId
		);
		expect(requirement?.health).toBe('open');
		expect(requirement?.evidence[0]?.qualifyingRevisionPublicId).toBeNull();

		await createIssuedVersion({
			containerId: container.id,
			sequence: 2,
			revisionCode: 'C01',
			purposeId,
			suitabilityCode: 'S1'
		});
		requirement = (await service.getWorkspace(owner, projectPublicId)).requirements.find(
			(item) => item.publicId === requirementPublicId
		);
		expect(requirement?.health).toBe('fulfilled');
		expect(requirement?.evidence[0]).toMatchObject({
			containerPublicId: container.publicId,
			qualifyingRevisionCode: 'C01',
			qualifyingPurposeCode: purposeCode,
			qualifyingSuitabilityCode: 'S1'
		});
	});

	it('enforces permission boundaries and requires R or A before approval', async () => {
		const service = new ProjectInformationRequirementsService(db);
		await expect(
			service.createRequirement(viewer, {
				projectPublicId,
				requirementCode: 'PIR-VIEWER',
				requirementType: 'PIR',
				title: 'Viewer must not create this'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		const publicId = await service.createRequirement(owner, {
			projectPublicId,
			requirementCode: 'AIR-001',
			requirementType: 'AIR',
			title: 'Asset information handover'
		});
		await expect(service.approveRequirement(owner, projectPublicId, publicId)).rejects.toThrow(
			'Responsible or Accountable'
		);

		const wrongType = await createContainer({
			containerTypeId: alternateContainerTypeId,
			number: 'MODEL-WRONG-TYPE',
			title: 'Different information type'
		});
		expect(wrongType.publicId).toBeTruthy();
	});
});