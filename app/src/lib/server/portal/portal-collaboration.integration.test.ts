import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { InformationService } from '$lib/server/information/information-service';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectTeamService } from '$lib/server/projects/project-team-service';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import {
	ensurePortalCollaborationStandardRoleDefaults,
	PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS
} from './portal-collaboration-bootstrap';
import { PortalCollaborationService } from './portal-collaboration-service';

const PREFIX = 'Slice 7 Integration ';
const PROJECT_PREFIX = 'S7-';

let db: Database;
let ownerOrganisationId = '';
let ownerOrganisationPublicId = '';
let partnerOrganisationId = '';
let partnerOrganisationPublicId = '';
let outsiderOrganisationId = '';
let ownerUserId = '';
let ownerMemberId = '';
let partnerUserId = '';
let partnerMemberId = '';
let partnerViewerUserId = '';
let partnerViewerMemberId = '';
let outsiderUserId = '';
let outsiderMemberId = '';
let ownerActor: TenantActorContext;
let partnerActor: TenantActorContext;
let partnerViewerActor: TenantActorContext;
let outsiderActor: TenantActorContext;
let projectId = '';
let projectPublicId = '';
let rfiPublicId = '';
let submittalPublicId = '';
let instructionPublicId = '';
let issuedVersionPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT ID.');
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

async function createOrganisation(label: string): Promise<{ id: string; publicId: string }> {
	const publicId = randomUUID();
	const id = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: publicId,
				legal_name: `${PREFIX}${label}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	return { id, publicId };
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
				joined_at: new Date('2026-08-20T18:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
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
	const ownerOrganisation = await createOrganisation('Owner Organisation');
	const partnerOrganisation = await createOrganisation('Partner Organisation');
	const outsiderOrganisation = await createOrganisation('Outsider Organisation');
	ownerOrganisationId = ownerOrganisation.id;
	ownerOrganisationPublicId = ownerOrganisation.publicId;
	partnerOrganisationId = partnerOrganisation.id;
	partnerOrganisationPublicId = partnerOrganisation.publicId;
	outsiderOrganisationId = outsiderOrganisation.id;

	ownerUserId = await createUser('Owner');
	partnerUserId = await createUser('Partner Manager');
	partnerViewerUserId = await createUser('Partner Viewer');
	outsiderUserId = await createUser('Outsider');
	ownerMemberId = await createMember(ownerOrganisationId, ownerUserId);
	partnerMemberId = await createMember(partnerOrganisationId, partnerUserId);
	partnerViewerMemberId = await createMember(partnerOrganisationId, partnerViewerUserId);
	outsiderMemberId = await createMember(outsiderOrganisationId, outsiderUserId);

	await assignPermissionRole(ownerOrganisationId, ownerMemberId, `${PREFIX}Owner Role`, [
		'project.create',
		'project.view',
		'project.manage',
		'information.view',
		'information.manage',
		'information.issue',
		'information.rfi.manage',
		'information.submittal.manage',
		'information.instruction.manage',
		'information.instruction.issue',
		'portal.view',
		'portal.respond',
		'portal.manage'
	]);
	await assignPermissionRole(partnerOrganisationId, partnerMemberId, `${PREFIX}Partner Role`, [
		'project.view',
		'project.manage',
		'portal.view',
		'portal.respond'
	]);
	await assignPermissionRole(
		partnerOrganisationId,
		partnerViewerMemberId,
		`${PREFIX}Partner Viewer Role`,
		['project.view', 'portal.view']
	);
	await assignPermissionRole(outsiderOrganisationId, outsiderMemberId, `${PREFIX}Outsider Role`, [
		'project.view',
		'portal.view',
		'portal.respond'
	]);

	ownerActor = {
		organisationId: ownerOrganisationId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: `slice7-owner-${randomUUID()}`
	};
	partnerActor = {
		organisationId: partnerOrganisationId,
		userId: partnerUserId,
		memberId: partnerMemberId,
		correlationId: `slice7-partner-${randomUUID()}`
	};
	partnerViewerActor = {
		organisationId: partnerOrganisationId,
		userId: partnerViewerUserId,
		memberId: partnerViewerMemberId,
		correlationId: `slice7-viewer-${randomUUID()}`
	};
	outsiderActor = {
		organisationId: outsiderOrganisationId,
		userId: outsiderUserId,
		memberId: outsiderMemberId,
		correlationId: `slice7-outsider-${randomUUID()}`
	};
});

afterAll(async () => {
	await closeDatabase();
});

describe('V1 portal and cross-organisation collaboration', () => {
	it('keeps portal administration separate from response and view-only defaults', async () => {
		const roleIds = new Map<string, string>();
		for (const name of ['Read Only', 'Field Worker', 'Manager']) {
			roleIds.set(
				name,
				insertedId(
					await db
						.insertInto('organisation_roles')
						.values({
							organisation_id: ownerOrganisationId,
							public_id: randomUUID(),
							name,
							is_active: 1
						})
						.executeTakeFirstOrThrow()
				)
			);
		}
		await ensurePortalCollaborationStandardRoleDefaults(db, ownerOrganisationId);
		const grantsFor = async (name: string) =>
			(
				await db
					.selectFrom('role_permissions as grant')
					.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
					.select('permission.permission_key as permissionKey')
					.where('grant.organisation_id', '=', ownerOrganisationId)
					.where('grant.organisation_role_id', '=', roleIds.get(name)!)
					.where('permission.permission_key', 'like', 'portal.%')
					.orderBy('permission.permission_key')
					.execute()
			).map((row) => row.permissionKey);
		expect(await grantsFor('Read Only')).toEqual(['portal.view']);
		expect(await grantsFor('Field Worker')).toEqual(
			[...PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS['Field Worker']].sort()
		);
		expect(await grantsFor('Manager')).toEqual(
			[...PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS.Manager].sort()
		);
	});

	it('requires an accepted project invitation before the partner receives project scope', async () => {
		const project = await new ProjectWorkspaceService(db).createProject(ownerActor, {
			projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Cross-organisation delivery project'
		});
		projectId = project.id;
		projectPublicId = project.publicId;

		await new ProjectTeamService(db).inviteParticipant(ownerActor, {
			projectPublicId,
			organisationPublicId: partnerOrganisationPublicId,
			roleKeys: []
		});
		expect(
			(await new PortalCollaborationService(db).getWorkspace(partnerActor)).projects
		).toHaveLength(0);
		await new ProjectTeamService(db).respondToInvitation(partnerActor, {
			projectPublicId,
			response: 'accept'
		});
		await new ProjectRepository(db).insertProjectMember(
			projectId,
			partnerOrganisationId,
			partnerViewerMemberId,
			new Date('2026-08-20T18:30:00.000Z')
		);
		const workspace = await new PortalCollaborationService(db).getWorkspace(partnerActor);
		expect(workspace.projects).toEqual([
			expect.objectContaining({
				publicId: projectPublicId,
				owningOrganisationId: ownerOrganisationId,
				isOwnedByCurrentOrganisation: false
			})
		]);
	});

	it('shows an RFI only after explicit assignment and attributes the partner response', async () => {
		const information = new InformationService(db);
		rfiPublicId = await information.createRfi(ownerActor, {
			projectPublicId,
			rfiNumber: `RFI-${randomUUID().slice(0, 8)}`,
			subject: 'Confirm builders work opening',
			question: 'Confirm the required coordinated opening size.',
			priority: 'high',
			dueAt: '2026-08-28T12:00'
		});
		await information.openRfi(ownerActor, rfiPublicId);
		let partnerWorkspace = await new PortalCollaborationService(db).getWorkspace(partnerActor);
		expect(partnerWorkspace.rfis).toHaveLength(0);

		await new PortalCollaborationService(db).assignRfiAddressee(ownerActor, {
			projectPublicId,
			rfiPublicId,
			organisationPublicId: partnerOrganisationPublicId
		});
		partnerWorkspace = await new PortalCollaborationService(db).getWorkspace(partnerActor);
		expect(partnerWorkspace.rfis).toEqual([
			expect.objectContaining({ publicId: rfiPublicId, status: 'open', responseCount: 0 })
		]);
		await new PortalCollaborationService(db).respondToRfi(partnerActor, {
			rfiPublicId,
			responseText: 'Provide a 650 × 450 mm coordinated opening.',
			final: true
		});
		const response = await db
			.selectFrom('rfi_responses as response')
			.innerJoin('rfis as rfi', 'rfi.id', 'response.rfi_id')
			.select([
				'response.responding_organisation_id as organisationId',
				'response.responded_by_member_id as memberId',
				'response.is_final_response as final',
				'rfi.status as rfiStatus'
			])
			.where('rfi.public_id', '=', rfiPublicId)
			.executeTakeFirstOrThrow();
		expect(response).toEqual({
			organisationId: partnerOrganisationId,
			memberId: partnerMemberId,
			final: 1,
			rfiStatus: 'answered'
		});
	});

	it('routes submittal review and instruction acknowledgement to the explicitly assigned organisation', async () => {
		const information = new InformationService(db);
		const documentPublicId = await information.createDocument(ownerActor, {
			projectPublicId,
			typeCode: 'drawing',
			containerNumber: `A-${randomUUID().slice(0, 8)}`,
			title: 'Portal coordination drawing',
			revisionCode: 'P01',
			purposeCode: 'review'
		});
		const ownerWorkspace = await information.getWorkspace(ownerActor);
		issuedVersionPublicId = ownerWorkspace.documents.find(
			(document) => document.publicId === documentPublicId
		)!.versions[0]!.publicId;
		await information.issueRevision(ownerActor, {
			versionPublicId: issuedVersionPublicId,
			channel: 'portal'
		});

		submittalPublicId = await information.createSubmittal(ownerActor, {
			projectPublicId,
			number: `SUB-${randomUUID().slice(0, 8)}`,
			typeCode: 'technical',
			title: 'External coordination review',
			versionPublicId: issuedVersionPublicId
		});
		await information.submitSubmittal(ownerActor, submittalPublicId);
		await new PortalCollaborationService(db).assignSubmittalReviewer(ownerActor, {
			projectPublicId,
			submittalPublicId,
			organisationPublicId: partnerOrganisationPublicId,
			dueAt: '2026-08-30T17:00'
		});
		await new PortalCollaborationService(db).reviewSubmittal(partnerActor, {
			submittalPublicId,
			outcome: 'approved_with_comments',
			comments: 'Coordinate final sleeve position before release.'
		});
		const review = await db
			.selectFrom('submittal_reviews as review')
			.innerJoin('submittals as submittal', 'submittal.id', 'review.submittal_id')
			.select([
				'review.reviewer_organisation_id as organisationId',
				'review.reviewed_by_member_id as memberId',
				'review.outcome as outcome',
				'submittal.status as submittalStatus'
			])
			.where('submittal.public_id', '=', submittalPublicId)
			.executeTakeFirstOrThrow();
		expect(review).toEqual({
			organisationId: partnerOrganisationId,
			memberId: partnerMemberId,
			outcome: 'approved_with_comments',
			submittalStatus: 'reviewed'
		});

		instructionPublicId = await information.createInstruction(ownerActor, {
			projectPublicId,
			number: `PI-${randomUUID().slice(0, 8)}`,
			typeCode: 'project',
			subject: 'Proceed with coordinated opening',
			instructionText: 'Proceed using the reviewed coordination information.'
		});
		await information.issueInstruction(ownerActor, instructionPublicId);
		await new PortalCollaborationService(db).assignInstructionRecipient(ownerActor, {
			projectPublicId,
			instructionPublicId,
			organisationPublicId: partnerOrganisationPublicId
		});
		await new PortalCollaborationService(db).acknowledgeInstruction(
			partnerActor,
			instructionPublicId
		);
		const acknowledgement = await db
			.selectFrom('instruction_recipients as recipient')
			.innerJoin(
				'project_instructions as instruction',
				'instruction.id',
				'recipient.instruction_id'
			)
			.select([
				'recipient.acknowledged_by_member_id as memberId',
				'recipient.acknowledged_at as acknowledgedAt',
				'instruction.status as instructionStatus'
			])
			.where('instruction.public_id', '=', instructionPublicId)
			.where('recipient.recipient_organisation_id', '=', partnerOrganisationId)
			.executeTakeFirstOrThrow();
		expect(acknowledgement.memberId).toBe(partnerMemberId);
		expect(acknowledgement.acknowledgedAt).toBeInstanceOf(Date);
		expect(acknowledgement.instructionStatus).toBe('acknowledged');
	});

	it('issues an exact controlled revision through a transmittal instead of exposing the document register', async () => {
		const transmittalPublicId = await new PortalCollaborationService(db).issueTransmittal(
			ownerActor,
			{
				projectPublicId,
				organisationPublicId: partnerOrganisationPublicId,
				versionPublicId: issuedVersionPublicId,
				transmittalNumber: `TR-${randomUUID().slice(0, 8)}`,
				subject: 'Coordinated opening information',
				purpose: 'For construction'
			}
		);
		const workspace = await new PortalCollaborationService(db).getWorkspace(partnerActor);
		const received = workspace.transmittals.find(
			(transmittal) => transmittal.publicId === transmittalPublicId
		);
		expect(received).toMatchObject({
			projectPublicId,
			issuingOrganisationId: ownerOrganisationId,
			deliveryStatus: 'delivered'
		});
		expect(received?.items).toHaveLength(1);
		expect(received?.items[0]?.versionPublicId).toBe(issuedVersionPublicId);
	});

	it('blocks unrelated organisations and view-only members from shared mutations', async () => {
		const outsiderWorkspace = await new PortalCollaborationService(db).getWorkspace(outsiderActor);
		expect(outsiderWorkspace.projects).toHaveLength(0);
		expect(outsiderWorkspace.rfis).toHaveLength(0);
		await expect(
			new PortalCollaborationService(db).respondToRfi(outsiderActor, {
				rfiPublicId,
				responseText: 'Out of scope response.',
				final: true
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
		const viewerWorkspace = await new PortalCollaborationService(db).getWorkspace(
			partnerViewerActor
		);
		expect(viewerWorkspace.canView).toBe(true);
		expect(viewerWorkspace.canRespond).toBe(false);
		await expect(
			new PortalCollaborationService(db).acknowledgeInstruction(
				partnerViewerActor,
				instructionPublicId
			)
		).rejects.toBeInstanceOf(TenantAccessError);

		const audit = await db
			.selectFrom('audit_events')
			.select(['action_key as actionKey', 'actor_member_id as memberId'])
			.where('acting_organisation_id', '=', partnerOrganisationId)
			.where('action_key', 'in', [
				'portal.rfi.respond',
				'portal.submittal.review',
				'portal.instruction.acknowledge'
			])
			.orderBy('id')
			.execute();
		expect(audit.map((row) => row.actionKey)).toEqual([
			'portal.rfi.respond',
			'portal.submittal.review',
			'portal.instruction.acknowledge'
		]);
		expect(audit.every((row) => row.memberId === partnerMemberId)).toBe(true);
		expect(ownerOrganisationPublicId).toHaveLength(36);
	});
});
