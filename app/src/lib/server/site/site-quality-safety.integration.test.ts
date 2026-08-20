import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { InformationService } from '$lib/server/information/information-service';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import {
	ensureSiteQualitySafetyStandardRoleDefaults,
	SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS
} from './site-quality-safety-bootstrap';
import {
	SiteQualitySafetyService,
	SiteQualitySafetyValidationError
} from './site-quality-safety-service';

const PREFIX = 'Slice 5 Integration ';
const ALL_PERMISSIONS = [
	...SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS.Owner,
	'information.view',
	'information.manage',
	'information.issue'
] as const;

let db: Database;
let organisationId = '';
let ownerUserId = '';
let fieldUserId = '';
let outsiderUserId = '';
let ownerMemberId = '';
let fieldMemberId = '';
let outsiderMemberId = '';
let actorOwner: TenantActorContext;
let actorField: TenantActorContext;
let actorOutsider: TenantActorContext;
let projectId = '';
let projectPublicId = '';
let sitePublicId = '';
let inspectionPublicId = '';
let findingPublicId = '';
let defectPublicId = '';
let safetyEventPublicId = '';
let evidenceVersionPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
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
				joined_at: new Date('2026-08-20T12:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	memberId: string,
	name: string,
	permissionKeys: readonly string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisationId, public_id: randomUUID(), name, is_active: 1 })
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [...permissionKeys])
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

beforeAll(async () => {
	db = getDatabase();
	ownerUserId = await createUser('Owner');
	fieldUserId = await createUser('Field');
	outsiderUserId = await createUser('Outsider');
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	ownerMemberId = await createMember(ownerUserId);
	fieldMemberId = await createMember(fieldUserId);
	outsiderMemberId = await createMember(outsiderUserId);
	await assignPermissionRole(ownerMemberId, `${PREFIX}Owner role`, [
		'project.create',
		'project.view',
		'project.manage',
		...ALL_PERMISSIONS
	]);
	await assignPermissionRole(fieldMemberId, `${PREFIX}Field role`, [
		'project.view',
		'site.view',
		'site.diary.manage',
		'site.diary.submit',
		'quality.view',
		'quality.inspection.manage',
		'quality.defect.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	]);
	await assignPermissionRole(outsiderMemberId, `${PREFIX}Outsider role`, [
		'project.view',
		...SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS.Owner
	]);

	actorOwner = {
		organisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `slice5-owner-${randomUUID()}`
	};
	actorField = {
		organisationId,
		userId: fieldUserId,
		memberId: fieldMemberId,
		correlationId: `slice5-field-${randomUUID()}`
	};
	actorOutsider = {
		organisationId,
		userId: outsiderUserId,
		memberId: outsiderMemberId,
		correlationId: `slice5-outsider-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actorOwner, {
		projectNumber: `S5-${randomUUID().slice(0, 8)}`,
		name: 'Site, quality and safety project'
	});
	projectId = project.id;
	projectPublicId = project.publicId;
	await new ProjectRepository(db).insertProjectMember(
		project.id,
		organisationId,
		fieldMemberId,
		new Date('2026-08-20T12:05:00.000Z')
	);
});

afterAll(async () => {
	await closeDatabase();
});

describe('V1 site, quality and safety activation', () => {
	it('keeps standard read-only visibility separate from field mutation permissions', async () => {
		const readOnlyRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Read Only',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		const fieldWorkerRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Field Worker',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		await ensureSiteQualitySafetyStandardRoleDefaults(db, organisationId);
		const grantsFor = async (roleId: string) =>
			(
				await db
					.selectFrom('role_permissions as grant')
					.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
					.select('permission.permission_key as permissionKey')
					.where('grant.organisation_id', '=', organisationId)
					.where('grant.organisation_role_id', '=', roleId)
					.where('permission.permission_key', 'in', [
						...SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS.Owner
					])
					.orderBy('permission.permission_key')
					.execute()
			).map((row) => row.permissionKey);
		expect(await grantsFor(readOnlyRoleId)).toEqual(['quality.view', 'safety.view', 'site.view']);
		expect(await grantsFor(fieldWorkerRoleId)).toEqual(
			[...SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS['Field Worker']].sort()
		);
	});

	it('controls project site and diary evidence and denies a permissioned non-participant', async () => {
		const service = new SiteQualitySafetyService(db);
		sitePublicId = await service.createSite(actorOwner, {
			projectPublicId,
			siteCode: 'MAIN',
			name: 'Main works',
			timezone: 'Europe/London'
		});
		await expect(
			service.createSite(actorOutsider, {
				projectPublicId,
				siteCode: 'OUT',
				name: 'Out of scope'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		const diaryPublicId = await service.createDiary(actorField, {
			projectPublicId,
			sitePublicId,
			diaryDate: '2026-08-20',
			shiftLabel: 'Day shift',
			summary: 'Containment first-fix progressed.',
			activityDescription: 'Installed containment to Level 02.',
			locationDescription: 'Level 02 east corridor',
			progressPercent: '55'
		});
		await service.submitDiary(actorField, diaryPublicId);
		await expect(service.approveDiary(actorField, diaryPublicId)).rejects.toBeInstanceOf(
			TenantAccessError
		);
		await service.approveDiary(actorOwner, diaryPublicId);
		const diary = await db
			.selectFrom('site_diaries')
			.select(['status', 'submitted_by_member_id', 'approved_by_member_id'])
			.where('public_id', '=', diaryPublicId)
			.executeTakeFirstOrThrow();
		expect(diary).toMatchObject({
			status: 'approved',
			submitted_by_member_id: fieldMemberId,
			approved_by_member_id: ownerMemberId
		});
	});

	it('executes an exact-version inspection and closes linked defect and NCR evidence', async () => {
		const service = new SiteQualitySafetyService(db);
		await service.createInspectionTemplate(actorOwner, {
			code: `S5-${randomUUID().slice(0, 6)}`,
			name: 'Containment first-fix checklist',
			description: 'Published exact V1 field checklist.',
			checklistPrompts: 'Containment securely fixed\nRoutes match issued coordination drawing'
		});
		let workspace = await service.getWorkspace(actorOwner, projectPublicId);
		const template = workspace.templates.find(
			(row) => row.name === 'Containment first-fix checklist'
		);
		expect(template).toBeTruthy();
		inspectionPublicId = await service.createInspection(actorOwner, {
			projectPublicId,
			sitePublicId,
			templateVersionPublicId: template!.versionPublicId,
			title: 'Level 02 containment inspection',
			locationDescription: 'Level 02 east corridor'
		});
		await expect(service.completeInspection(actorOwner, inspectionPublicId)).rejects.toBeInstanceOf(
			SiteQualitySafetyValidationError
		);

		workspace = await service.getWorkspace(actorOwner, projectPublicId);
		let inspection = workspace.inspections.find((row) => row.publicId === inspectionPublicId)!;
		expect(inspection.items).toHaveLength(2);
		await service.recordInspectionResponse(actorOwner, {
			inspectionPublicId,
			templateItemId: inspection.items[0]!.id,
			resultCode: 'fail',
			comments: 'One support spacing exceeds requirement.'
		});
		await service.recordInspectionResponse(actorOwner, {
			inspectionPublicId,
			templateItemId: inspection.items[1]!.id,
			resultCode: 'pass',
			comments: 'Route matches issued coordination.'
		});
		findingPublicId = await service.raiseInspectionFinding(actorOwner, {
			inspectionPublicId,
			templateItemId: inspection.items[0]!.id,
			findingTypeCode: 'defect',
			title: 'Containment support spacing',
			description: 'Additional support required to meet installation standard.',
			severity: 'medium'
		});
		await service.completeInspection(actorOwner, inspectionPublicId);
		inspection = (await service.getWorkspace(actorOwner, projectPublicId)).inspections.find(
			(row) => row.publicId === inspectionPublicId
		)!;
		expect(inspection.status).toBe('completed');
		expect(inspection.findings).toContainEqual(
			expect.objectContaining({ publicId: findingPublicId })
		);

		defectPublicId = await service.createDefect(actorOwner, {
			projectPublicId,
			sitePublicId,
			findingPublicId,
			title: 'Install additional containment support',
			description: 'Correct support spacing at Level 02 east corridor.',
			locationDescription: 'Level 02 east corridor',
			severity: 'medium',
			targetDate: '2026-08-25'
		});
		const ncrPublicId = await service.createNcr(actorOwner, {
			projectPublicId,
			sitePublicId,
			findingPublicId,
			title: 'Containment installation non-conformance',
			statement:
				'Installed support spacing does not comply with the project installation standard.',
			severity: 'medium',
			immediateContainment: 'Affected section identified and held from close-up.',
			targetDate: '2026-08-26'
		});
		await service.closeDefect(actorOwner, defectPublicId);
		await service.closeNcr(actorOwner, ncrPublicId);
		const [defect, ncr] = await Promise.all([
			db
				.selectFrom('defect_records')
				.select(['status', 'closed_by_member_id'])
				.where('public_id', '=', defectPublicId)
				.executeTakeFirstOrThrow(),
			db
				.selectFrom('nonconformance_reports')
				.select(['status', 'closed_by_member_id'])
				.where('public_id', '=', ncrPublicId)
				.executeTakeFirstOrThrow()
		]);
		expect(defect).toMatchObject({ status: 'closed', closed_by_member_id: ownerMemberId });
		expect(ncr).toMatchObject({ status: 'closed', closed_by_member_id: ownerMemberId });
	});

	it('reuses issued project-information revisions as field photo/evidence links', async () => {
		const information = new InformationService(db);
		const informationWorkspace = await information.getWorkspace(actorOwner);
		const type = informationWorkspace.containerTypes[0];
		expect(type).toBeTruthy();
		const containerPublicId = await information.createDocument(actorOwner, {
			projectPublicId,
			typeCode: type!.code,
			containerNumber: `S5-EVID-${randomUUID().slice(0, 6)}`,
			title: 'Containment defect photograph',
			revisionCode: 'P01'
		});
		const created = (await information.getWorkspace(actorOwner)).documents.find(
			(row) => row.publicId === containerPublicId
		);
		expect(created?.versions[0]).toBeTruthy();
		evidenceVersionPublicId = created!.versions[0]!.publicId;
		await information.issueRevision(actorOwner, {
			versionPublicId: evidenceVersionPublicId,
			channel: 'portal',
			note: 'Controlled field evidence.'
		});
		const service = new SiteQualitySafetyService(db);
		await service.linkEvidence(actorOwner, {
			projectPublicId,
			subjectType: 'defect',
			subjectPublicId: defectPublicId,
			informationVersionPublicId: evidenceVersionPublicId,
			linkRole: 'photo'
		});
		const link = await db
			.selectFrom('defect_information_links as link')
			.innerJoin(
				'information_container_versions as version',
				'version.id',
				'link.information_container_version_id'
			)
			.select(['link.link_role as linkRole', 'version.public_id as versionPublicId'])
			.where('version.public_id', '=', evidenceVersionPublicId)
			.executeTakeFirstOrThrow();
		expect(link).toEqual({ linkRole: 'photo', versionPublicId: evidenceVersionPublicId });
	});

	it('requires safety actions to complete before an observation can close', async () => {
		const service = new SiteQualitySafetyService(db);
		safetyEventPublicId = await service.createSafetyObservation(actorField, {
			projectPublicId,
			sitePublicId,
			title: 'Trailing lead at access route',
			description: 'Temporary lead crossed a pedestrian access route.',
			locationDescription: 'Level 01 access route',
			occurredAt: '2026-08-20T12:30',
			observationCategory: 'condition',
			isPositiveObservation: false,
			immediateActionTaken: 'Lead moved clear pending permanent reroute.'
		});
		await service.createSafetyAction(actorField, {
			safetyEventPublicId,
			actionType: 'corrective',
			actionText: 'Install protected temporary cable route.',
			targetDate: '2026-08-21'
		});
		await expect(service.closeSafetyEvent(actorField, safetyEventPublicId)).rejects.toBeInstanceOf(
			SiteQualitySafetyValidationError
		);
		let safety = (await service.getWorkspace(actorField, projectPublicId)).safetyEvents.find(
			(row) => row.publicId === safetyEventPublicId
		)!;
		expect(safety.actions).toHaveLength(1);
		await service.completeSafetyAction(
			actorField,
			safetyEventPublicId,
			safety.actions[0]!.id,
			'Protected route installed and checked.'
		);
		await service.closeSafetyEvent(actorField, safetyEventPublicId);
		safety = (await service.getWorkspace(actorField, projectPublicId)).safetyEvents.find(
			(row) => row.publicId === safetyEventPublicId
		)!;
		expect(safety.status).toBe('closed');
		expect(safety.actions[0]).toMatchObject({ status: 'completed' });
		const completion = await db
			.selectFrom('safety_actions')
			.select(['completed_by_member_id', 'completed_by_organisation_id'])
			.where('id', '=', safety.actions[0]!.id)
			.executeTakeFirstOrThrow();
		expect(completion).toEqual({
			completed_by_member_id: fieldMemberId,
			completed_by_organisation_id: organisationId
		});
	});

	it('shows read permissions without leaking mutation authority', async () => {
		const viewerUserId = await createUser('Viewer');
		const viewerMemberId = await createMember(viewerUserId);
		await assignPermissionRole(viewerMemberId, `${PREFIX}Viewer role`, [
			'project.view',
			'site.view',
			'quality.view',
			'safety.view'
		]);
		await new ProjectRepository(db).insertProjectMember(
			projectId,
			organisationId,
			viewerMemberId,
			new Date('2026-08-20T13:00:00.000Z')
		);
		const actorViewer: TenantActorContext = {
			organisationId,
			userId: viewerUserId,
			memberId: viewerMemberId,
			correlationId: `slice5-viewer-${randomUUID()}`
		};
		const workspace = await new SiteQualitySafetyService(db).getWorkspace(
			actorViewer,
			projectPublicId
		);
		expect(workspace).toMatchObject({
			canViewSite: true,
			canViewQuality: true,
			canViewSafety: true,
			canManageSites: false,
			canManageDiaries: false,
			canManageInspections: false,
			canManageDefects: false,
			canManageSafetyEvents: false,
			canManageSafetyActions: false
		});
		expect(workspace.sites).toContainEqual(expect.objectContaining({ publicId: sitePublicId }));
		expect(workspace.inspections).toContainEqual(
			expect.objectContaining({ publicId: inspectionPublicId })
		);
		expect(workspace.safetyEvents).toContainEqual(
			expect.objectContaining({ publicId: safetyEventPublicId })
		);
	});
});
