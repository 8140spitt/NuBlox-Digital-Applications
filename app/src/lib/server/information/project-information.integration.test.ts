import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ensureInformationStandardRoleDefaults } from './information-bootstrap';
import { InformationRepository } from './information-repository';
import { InformationService, InformationValidationError } from './information-service';

const PREFIX = 'Information Slice 3 Integration ';
const PROJECT_PREFIX = 'IS3-';

let db: Database;
let organisationId = '';
let managerUserId = '';
let reviewerUserId = '';
let outsiderUserId = '';
let managerMemberId = '';
let reviewerMemberId = '';
let outsiderMemberId = '';
let actorManager: TenantActorContext;
let actorReviewer: TenantActorContext;
let actorOutsider: TenantActorContext;
let projectId = '';
let projectPublicId = '';
let documentPublicId = '';
let issuedVersionPublicId = '';
let draftVersionPublicId = '';

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

	await db.deleteFrom('submittal_reviews').where('reviewer_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('submittal_reviewers').where('reviewer_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('submittal_items').where('submittal_owner_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('submittals').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('rfi_responses').where('responding_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('rfi_addressees').where('rfi_owner_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('rfis').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('project_instruction_links').where('instruction_owner_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('project_instruction_recipients').where('instruction_owner_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('project_instructions').where('issuing_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('information_version_issue_events').where('issuing_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('information_version_supersessions').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('information_files').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('information_container_versions').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('information_containers').where('owning_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();

	if (projectIds.length > 0) {
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisation_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
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

async function createMember(organisation: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisation,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-19T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisation: string,
	memberId: string,
	name: string,
	permissionKeys: readonly string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisation, public_id: randomUUID(), name, is_active: 1 })
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
				organisation_id: organisation,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisation,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	managerUserId = await createUser('Manager');
	reviewerUserId = await createUser('Reviewer');
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
	managerMemberId = await createMember(organisationId, managerUserId);
	reviewerMemberId = await createMember(organisationId, reviewerUserId);
	outsiderMemberId = await createMember(organisationId, outsiderUserId);

	const allInformationPermissions = [
		'information.view',
		'information.manage',
		'information.file.manage',
		'information.issue',
		'information.rfi.manage',
		'information.rfi.respond',
		'information.submittal.manage',
		'information.submittal.review',
		'information.instruction.manage',
		'information.instruction.issue'
	] as const;
	await assignPermissionRole(organisationId, managerMemberId, `${PREFIX}Manager Role`, [
		'project.create',
		'project.view',
		'project.manage',
		...allInformationPermissions
	]);
	await assignPermissionRole(organisationId, reviewerMemberId, `${PREFIX}Reviewer Role`, [
		'project.view',
		'information.view',
		'information.rfi.respond',
		'information.submittal.review'
	]);
	await assignPermissionRole(organisationId, outsiderMemberId, `${PREFIX}Outsider Role`, [
		'project.view',
		'information.view',
		'information.manage',
		'information.rfi.manage'
	]);

	actorManager = {
		organisationId,
		userId: managerUserId,
		memberId: managerMemberId,
		correlationId: `information-manager-${randomUUID()}`
	};
	actorReviewer = {
		organisationId,
		userId: reviewerUserId,
		memberId: reviewerMemberId,
		correlationId: `information-reviewer-${randomUUID()}`
	};
	actorOutsider = {
		organisationId,
		userId: outsiderUserId,
		memberId: outsiderMemberId,
		correlationId: `information-outsider-${randomUUID()}`
	};

	const project = await new ProjectWorkspaceService(db).createProject(actorManager, {
		projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
		name: 'Slice 3 controlled information project'
	});
	projectId = project.id;
	projectPublicId = project.publicId;
	await new ProjectRepository(db).insertProjectMember(
		project.id,
		organisationId,
		reviewerMemberId,
		new Date('2026-08-19T09:00:00.000Z')
	);
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('V1 documents and project information activation', () => {
	it('seeds standard information role defaults for newly created organisation roles', async () => {
		const roleId = insertedId(
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
		await ensureInformationStandardRoleDefaults(db, organisationId);
		const grants = await db
			.selectFrom('role_permissions as grant')
			.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
			.select('permission.permission_key as permissionKey')
			.where('grant.organisation_id', '=', organisationId)
			.where('grant.organisation_role_id', '=', roleId)
			.orderBy('permission.permission_key')
			.execute();
		expect(grants.map((row) => row.permissionKey)).toEqual(['information.view']);
	});

	it('creates a stable document identity with an initial draft revision and audit evidence', async () => {
		const service = new InformationService(db);
		documentPublicId = await service.createDocument(actorManager, {
			projectPublicId,
			typeCode: 'drawing',
			containerNumber: `A-${randomUUID().slice(0, 8)}`,
			title: 'Ground floor containment plan',
			disciplineCode: 'E',
			classificationCode: 'EF_70_20',
			revisionCode: 'P01',
			purposeCode: 'review',
			suitabilityCode: 'S3'
		});
		const workspace = await service.getWorkspace(actorManager);
		const document = workspace.documents.find((candidate) => candidate.publicId === documentPublicId);
		expect(document).toMatchObject({
			projectId,
			title: 'Ground floor containment plan',
			disciplineCode: 'E',
			classificationCode: 'EF_70_20'
		});
		expect(document?.versions).toHaveLength(1);
		expect(document?.versions[0]).toMatchObject({ revisionCode: 'P01', versionSequence: 1, status: 'draft' });
		issuedVersionPublicId = document!.versions[0]!.publicId;

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key as actionKey', 'subject_public_id as subjectPublicId'])
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'information.document.create')
			.where('subject_public_id', '=', documentPublicId)
			.executeTakeFirstOrThrow();
		expect(audit).toEqual({ actionKey: 'information.document.create', subjectPublicId: documentPublicId });
	});

	it('locks an issued revision, preserves issue evidence and requires corrections to use a new revision', async () => {
		const service = new InformationService(db);
		await service.issueRevision(actorManager, {
			versionPublicId: issuedVersionPublicId,
			channel: 'portal',
			note: 'Issued for coordinated review.'
		});
		const issued = await new InformationRepository(db).findVersionByPublicId(
			organisationId,
			issuedVersionPublicId
		);
		expect(issued?.status).toBe('issued');
		expect(issued?.lockedAt).toBeInstanceOf(Date);
		const issueEvent = await db
			.selectFrom('information_version_issue_events')
			.select(['issue_sequence as issueSequence', 'issue_channel as issueChannel'])
			.where('information_container_version_id', '=', issued!.id)
			.executeTakeFirstOrThrow();
		expect(issueEvent).toEqual({ issueSequence: 1, issueChannel: 'portal' });

		await expect(
			service.updateDraftRevision(actorManager, {
				versionPublicId: issuedVersionPublicId,
				titleAtVersion: 'Attempted overwrite'
			})
		).rejects.toBeInstanceOf(InformationValidationError);

		draftVersionPublicId = await service.createRevision(actorManager, {
			containerPublicId: documentPublicId,
			revisionCode: 'P02',
			titleAtVersion: 'Ground floor containment plan - coordinated',
			purposeCode: 'approval',
			suitabilityCode: 'S4'
		});
		const draft = await new InformationRepository(db).findVersionByPublicId(
			organisationId,
			draftVersionPublicId
		);
		expect(draft).toMatchObject({ revisionCode: 'P02', versionSequence: 2, status: 'draft' });
	});

	it('keeps information invisible and immutable outside effective project membership', async () => {
		const service = new InformationService(db);
		const outsiderWorkspace = await service.getWorkspace(actorOutsider);
		expect(outsiderWorkspace.canView).toBe(true);
		expect(outsiderWorkspace.documents).toHaveLength(0);
		await expect(
			service.createDocument(actorOutsider, {
				projectPublicId,
				typeCode: 'report',
				containerNumber: `OUT-${randomUUID().slice(0, 8)}`,
				title: 'Out of scope document',
				revisionCode: 'P01'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('controls the RFI draft, open, final response and close lifecycle', async () => {
		const service = new InformationService(db);
		const rfiPublicId = await service.createRfi(actorManager, {
			projectPublicId,
			rfiNumber: `RFI-${randomUUID().slice(0, 8)}`,
			subject: 'Containment clearance at riser',
			question: 'Confirm the minimum coordinated containment clearance.',
			priority: 'high'
		});
		await service.openRfi(actorManager, rfiPublicId);
		await service.respondToRfi(actorManager, {
			rfiPublicId,
			responseText: 'Maintain 150 mm clear separation from the coordinated service zone.',
			final: true
		});
		await service.closeRfi(actorManager, rfiPublicId);
		const rfi = await new InformationRepository(db).findRfiByPublicId(organisationId, rfiPublicId);
		expect(rfi?.status).toBe('closed');
		const responses = await db
			.selectFrom('rfi_responses')
			.select(['response_sequence as responseSequence', 'is_final_response as final'])
			.where('rfi_id', '=', rfi!.id)
			.execute();
		expect(responses).toEqual([{ responseSequence: 1, final: 1 }]);
	});

	it('requires independent review after a controlled submittal is submitted', async () => {
		const service = new InformationService(db);
		const submittalPublicId = await service.createSubmittal(actorManager, {
			projectPublicId,
			number: `SUB-${randomUUID().slice(0, 8)}`,
			typeCode: 'technical',
			title: 'Containment coordination submittal',
			versionPublicId: draftVersionPublicId
		});
		await service.submitSubmittal(actorManager, submittalPublicId);
		await expect(
			service.reviewSubmittal(actorManager, {
				publicId: submittalPublicId,
				outcome: 'approved'
			})
		).rejects.toBeInstanceOf(InformationValidationError);
		await service.reviewSubmittal(actorReviewer, {
			publicId: submittalPublicId,
			outcome: 'approved_with_comments',
			comments: 'Coordinate final support spacing before construction issue.'
		});
		const submittal = await new InformationRepository(db).findSubmittalByPublicId(
			organisationId,
			submittalPublicId
		);
		expect(submittal?.status).toBe('reviewed');
		const review = await db
			.selectFrom('submittal_reviews')
			.select(['outcome', 'reviewed_by_member_id as reviewedByMemberId'])
			.where('submittal_id', '=', submittal!.id)
			.executeTakeFirstOrThrow();
		expect(review).toMatchObject({ outcome: 'approved_with_comments', reviewedByMemberId: reviewerMemberId });
	});

	it('issues formal instructions once and preserves the issued evidence', async () => {
		const service = new InformationService(db);
		const instructionPublicId = await service.createInstruction(actorManager, {
			projectPublicId,
			number: `PI-${randomUUID().slice(0, 8)}`,
			typeCode: 'project',
			subject: 'Proceed with coordinated containment route',
			instructionText: 'Proceed in accordance with the coordinated route identified in the current project information.'
		});
		await service.issueInstruction(actorManager, instructionPublicId);
		const instruction = await new InformationRepository(db).findInstructionByPublicId(
			organisationId,
			instructionPublicId
		);
		expect(instruction?.status).toBe('issued');
		expect(instruction?.issuedAt).toBeInstanceOf(Date);
		await expect(service.issueInstruction(actorManager, instructionPublicId)).rejects.toBeInstanceOf(
			InformationValidationError
		);
	});
});
