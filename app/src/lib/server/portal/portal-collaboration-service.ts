import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { ConcurrentUpdateError, RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectParticipantOrganisation } from '$lib/server/projects/project-repository';
import {
	PortalCollaborationRepository,
	type PortalInstructionTask,
	type PortalManageInstruction,
	type PortalManageRfi,
	type PortalManageSubmittal,
	type PortalManageVersion,
	type PortalProjectSummary,
	type PortalRfiTask,
	type PortalSubmittalTask,
	type PortalTransmittalSummary
} from './portal-collaboration-repository';

const REVIEW_OUTCOMES = new Set([
	'approved',
	'approved_with_comments',
	'revise_resubmit',
	'rejected',
	'no_objection',
	'for_information'
]);

export type PortalWorkspace = {
	canView: boolean;
	canRespond: boolean;
	canManage: boolean;
	projects: PortalProjectSummary[];
	rfis: PortalRfiTask[];
	submittals: PortalSubmittalTask[];
	instructions: PortalInstructionTask[];
	transmittals: PortalTransmittalSummary[];
};

export type PortalManagementWorkspace = {
	canManage: boolean;
	projects: PortalProjectSummary[];
	selectedProject: PortalProjectSummary | null;
	participants: ProjectParticipantOrganisation[];
	rfis: PortalManageRfi[];
	submittals: PortalManageSubmittal[];
	instructions: PortalManageInstruction[];
	versions: PortalManageVersion[];
};

export class PortalCollaborationValidationError extends Error {
	readonly code = 'PORTAL_COLLABORATION_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'PortalCollaborationValidationError';
	}
}

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new PortalCollaborationValidationError(`${label} is required.`);
	if (text.length > max) throw new PortalCollaborationValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max) throw new PortalCollaborationValidationError('A supplied value is too long.');
	return text;
}

function optionalDateTime(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const date = new Date(text.endsWith('Z') ? text : `${text}:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new PortalCollaborationValidationError(`${label} is invalid.`);
	return date;
}

export class PortalCollaborationService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: 'portal.view' | 'portal.respond' | 'portal.manage',
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('Portal collaboration is not permitted.');
	}

	private async requireDomainPermission(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed) {
			throw new TenantAccessError('The controlled information action is not permitted.');
		}
	}

	private async appendAudit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		input: {
			projectId: string;
			actionKey: string;
			subjectType: string;
			subjectPublicId: string;
			changeSummary?: unknown;
		}
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			projectId: input.projectId,
			actionKey: input.actionKey,
			subjectType: input.subjectType,
			subjectPublicId: input.subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary: input.changeSummary
		});
	}

	private async requireOwnedProject(
		actor: TenantActorContext,
		projectPublicId: string,
		db: DatabaseExecutor = this.db
	) {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			requiredText(projectPublicId, 'Project', 36)
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Owned project not found in your active project scope.');
		}
		if (['cancelled', 'archived'].includes(project.status)) {
			throw new PortalCollaborationValidationError('This project is read-only for new collaboration.');
		}
		return project;
	}

	async getWorkspace(actor: TenantActorContext): Promise<PortalWorkspace> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'portal.view',
			'portal.respond',
			'portal.manage'
		]);
		const canView = decisions.get('portal.view')?.allowed ?? false;
		if (!canView) {
			return {
				canView: false,
				canRespond: false,
				canManage: false,
				projects: [],
				rfis: [],
				submittals: [],
				instructions: [],
				transmittals: []
			};
		}
		const repository = new PortalCollaborationRepository(this.db);
		const [projects, rfis, submittals, instructions, transmittals] = await Promise.all([
			repository.listProjects(actor.organisationId, actor.memberId),
			repository.listAssignedRfis(actor.organisationId, actor.memberId),
			repository.listAssignedSubmittals(actor.organisationId, actor.memberId),
			repository.listAssignedInstructions(actor.organisationId, actor.memberId),
			repository.listReceivedTransmittals(actor.organisationId, actor.memberId)
		]);
		return {
			canView,
			canRespond: decisions.get('portal.respond')?.allowed ?? false,
			canManage: decisions.get('portal.manage')?.allowed ?? false,
			projects,
			rfis,
			submittals,
			instructions,
			transmittals
		};
	}

	async getManagementWorkspace(
		actor: TenantActorContext,
		selectedProjectPublicId?: string | null
	): Promise<PortalManagementWorkspace> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'portal.manage');
		const repository = new PortalCollaborationRepository(this.db);
		const projects = (await repository.listProjects(actor.organisationId, actor.memberId)).filter(
			(project) => project.isOwnedByCurrentOrganisation
		);
		const selectedProject = selectedProjectPublicId
			? projects.find((project) => project.publicId === selectedProjectPublicId) ?? null
			: projects[0] ?? null;
		if (!selectedProject) {
			return {
				canManage: true,
				projects,
				selectedProject: null,
				participants: [],
				rfis: [],
				submittals: [],
				instructions: [],
				versions: []
			};
		}
		const projectRepository = new ProjectRepository(this.db);
		const [participants, rfis, submittals, instructions, versions] = await Promise.all([
			projectRepository.listActiveParticipantOrganisations(selectedProject.id),
			repository.listManageRfis(actor.organisationId, selectedProject.id),
			repository.listManageSubmittals(actor.organisationId, selectedProject.id),
			repository.listManageInstructions(actor.organisationId, selectedProject.id),
			repository.listManageVersions(actor.organisationId, selectedProject.id)
		]);
		return {
			canManage: true,
			projects,
			selectedProject,
			participants: participants.filter(
				(participant) => participant.organisationId !== actor.organisationId
			),
			rfis,
			submittals,
			instructions,
			versions
		};
	}

	async respondToRfi(
		actor: TenantActorContext,
		input: { rfiPublicId: string; responseText: string; final?: boolean }
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.respond', trx);
			const repository = new PortalCollaborationRepository(trx);
			const rfi = await repository.findAssignedRfiForUpdate(
				actor.organisationId,
				actor.memberId,
				requiredText(input.rfiPublicId, 'RFI', 36)
			);
			if (!rfi) throw new RecordNotFoundError('Assigned RFI not found in this portal scope.');
			if (!['open', 'reopened'].includes(rfi.status)) {
				throw new PortalCollaborationValidationError('Only an open RFI can receive a response.');
			}
			const sequence = await repository.nextRfiResponseSequence(rfi.id, actor.organisationId);
			const final = input.final ?? true;
			await repository.insertRfiResponse({
				projectId: rfi.projectId,
				rfiId: rfi.id,
				rfiOwnerOrganisationId: rfi.owningOrganisationId,
				respondingOrganisationId: actor.organisationId,
				sequence,
				responseText: requiredText(input.responseText, 'RFI response', 20000),
				memberId: actor.memberId,
				final
			});
			if (final && !(await repository.markRfiAnswered(rfi.id))) {
				throw new ConcurrentUpdateError();
			}
			await this.appendAudit(trx, actor, {
				projectId: rfi.projectId,
				actionKey: 'portal.rfi.respond',
				subjectType: 'rfi',
				subjectPublicId: rfi.publicId,
				changeSummary: { responseSequence: sequence, final }
			});
		});
	}

	async reviewSubmittal(
		actor: TenantActorContext,
		input: { submittalPublicId: string; outcome: string; comments?: string }
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.respond', trx);
			if (!REVIEW_OUTCOMES.has(input.outcome)) {
				throw new PortalCollaborationValidationError('Submittal review outcome is invalid.');
			}
			const repository = new PortalCollaborationRepository(trx);
			const submittal = await repository.findAssignedSubmittalForUpdate(
				actor.organisationId,
				actor.memberId,
				requiredText(input.submittalPublicId, 'Submittal', 36)
			);
			if (!submittal) {
				throw new RecordNotFoundError('Assigned submittal not found in this portal scope.');
			}
			if (!['submitted', 'under_review'].includes(submittal.status)) {
				throw new PortalCollaborationValidationError(
					'Only a submitted submittal can receive a review.'
				);
			}
			const sequence = await repository.nextSubmittalReviewSequence(
				submittal.id,
				actor.organisationId
			);
			await repository.insertSubmittalReview({
				submittalId: submittal.id,
				organisationId: actor.organisationId,
				sequence,
				outcome: input.outcome,
				comments: optionalText(input.comments, 20000),
				memberId: actor.memberId
			});
			if (!(await repository.markSubmittalReviewed(submittal.id))) {
				throw new ConcurrentUpdateError();
			}
			await this.appendAudit(trx, actor, {
				projectId: submittal.projectId,
				actionKey: 'portal.submittal.review',
				subjectType: 'submittal',
				subjectPublicId: submittal.publicId,
				changeSummary: { reviewSequence: sequence, outcome: input.outcome }
			});
		});
	}

	async acknowledgeInstruction(actor: TenantActorContext, instructionPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.respond', trx);
			const repository = new PortalCollaborationRepository(trx);
			const instruction = await repository.findAssignedInstructionForUpdate(
				actor.organisationId,
				actor.memberId,
				requiredText(instructionPublicId, 'Instruction', 36)
			);
			if (!instruction) {
				throw new RecordNotFoundError('Assigned instruction not found in this portal scope.');
			}
			if (!['issued', 'acknowledged'].includes(instruction.status)) {
				throw new PortalCollaborationValidationError('This instruction cannot be acknowledged.');
			}
			const at = this.now();
			if (!(await repository.acknowledgeInstruction(instruction.id, actor.organisationId, actor.memberId, at))) {
				throw new ConcurrentUpdateError();
			}
			await repository.markInstructionAcknowledgedWhenComplete(instruction.id);
			await this.appendAudit(trx, actor, {
				projectId: instruction.projectId,
				actionKey: 'portal.instruction.acknowledge',
				subjectType: 'project_instruction',
				subjectPublicId: instruction.publicId
			});
		});
	}

	async assignRfiAddressee(
		actor: TenantActorContext,
		input: { projectPublicId: string; rfiPublicId: string; organisationPublicId: string }
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.manage', trx);
			await this.requireDomainPermission(actor, 'information.rfi.manage', trx);
			const project = await this.requireOwnedProject(actor, input.projectPublicId, trx);
			const repository = new PortalCollaborationRepository(trx);
			const target = await repository.findActiveShareTarget(
				project.id,
				requiredText(input.organisationPublicId, 'Participant organisation', 36)
			);
			if (!target || target.id === actor.organisationId) {
				throw new PortalCollaborationValidationError('Select an active external project participant.');
			}
			const rfi = await repository.findOwnedRfiForUpdate(
				actor.organisationId,
				project.id,
				requiredText(input.rfiPublicId, 'RFI', 36)
			);
			if (!rfi || !['open', 'reopened'].includes(rfi.status)) {
				throw new PortalCollaborationValidationError('Select an open RFI owned by this organisation.');
			}
			if (!(await repository.addRfiAddressee({
				projectId: project.id,
				rfiId: rfi.id,
				rfiOwnerOrganisationId: actor.organisationId,
				addresseeOrganisationId: target.id
			}))) {
				throw new PortalCollaborationValidationError('That organisation is already an RFI addressee.');
			}
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'portal.rfi.assign',
				subjectType: 'rfi',
				subjectPublicId: rfi.publicId,
				changeSummary: { participantOrganisationPublicId: target.publicId }
			});
		});
	}

	async assignSubmittalReviewer(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			submittalPublicId: string;
			organisationPublicId: string;
			dueAt?: string;
		}
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.manage', trx);
			await this.requireDomainPermission(actor, 'information.submittal.manage', trx);
			const project = await this.requireOwnedProject(actor, input.projectPublicId, trx);
			const repository = new PortalCollaborationRepository(trx);
			const target = await repository.findActiveShareTarget(
				project.id,
				requiredText(input.organisationPublicId, 'Participant organisation', 36)
			);
			if (!target || target.id === actor.organisationId) {
				throw new PortalCollaborationValidationError('Select an active external project participant.');
			}
			const submittal = await repository.findOwnedSubmittalForUpdate(
				actor.organisationId,
				project.id,
				requiredText(input.submittalPublicId, 'Submittal', 36)
			);
			if (!submittal || !['submitted', 'under_review'].includes(submittal.status)) {
				throw new PortalCollaborationValidationError('Select a submitted submittal owned by this organisation.');
			}
			if (!(await repository.addSubmittalReviewer({
				projectId: project.id,
				submittalId: submittal.id,
				submittalOwnerOrganisationId: actor.organisationId,
				reviewerOrganisationId: target.id,
				dueAt: optionalDateTime(input.dueAt, 'Review due date')
			}))) {
				throw new PortalCollaborationValidationError('That organisation is already a reviewer.');
			}
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'portal.submittal.assign',
				subjectType: 'submittal',
				subjectPublicId: submittal.publicId,
				changeSummary: { participantOrganisationPublicId: target.publicId }
			});
		});
	}

	async assignInstructionRecipient(
		actor: TenantActorContext,
		input: { projectPublicId: string; instructionPublicId: string; organisationPublicId: string }
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.manage', trx);
			await this.requireDomainPermission(actor, 'information.instruction.manage', trx);
			const project = await this.requireOwnedProject(actor, input.projectPublicId, trx);
			const repository = new PortalCollaborationRepository(trx);
			const target = await repository.findActiveShareTarget(
				project.id,
				requiredText(input.organisationPublicId, 'Participant organisation', 36)
			);
			if (!target || target.id === actor.organisationId) {
				throw new PortalCollaborationValidationError('Select an active external project participant.');
			}
			const instruction = await repository.findOwnedInstructionForUpdate(
				actor.organisationId,
				project.id,
				requiredText(input.instructionPublicId, 'Instruction', 36)
			);
			if (!instruction || !['issued', 'acknowledged'].includes(instruction.status)) {
				throw new PortalCollaborationValidationError('Select an issued instruction owned by this organisation.');
			}
			if (!(await repository.addInstructionRecipient({
				projectId: project.id,
				instructionId: instruction.id,
				issuingOrganisationId: actor.organisationId,
				recipientOrganisationId: target.id
			}))) {
				throw new PortalCollaborationValidationError('That organisation already receives this instruction.');
			}
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'portal.instruction.assign',
				subjectType: 'project_instruction',
				subjectPublicId: instruction.publicId,
				changeSummary: { participantOrganisationPublicId: target.publicId }
			});
		});
	}

	async issueTransmittal(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			organisationPublicId: string;
			versionPublicId: string;
			transmittalNumber: string;
			subject: string;
			purpose?: string;
		}
	): Promise<string> {
		return this.db.transaction().execute(async (trx) => {
			await this.assertActiveActor(actor, trx);
			await this.requirePermission(actor, 'portal.manage', trx);
			await this.requireDomainPermission(actor, 'information.issue', trx);
			const project = await this.requireOwnedProject(actor, input.projectPublicId, trx);
			const repository = new PortalCollaborationRepository(trx);
			const target = await repository.findActiveShareTarget(
				project.id,
				requiredText(input.organisationPublicId, 'Participant organisation', 36)
			);
			if (!target || target.id === actor.organisationId) {
				throw new PortalCollaborationValidationError('Select an active external project participant.');
			}
			const version = await repository.findOwnedIssuedVersion(
				actor.organisationId,
				project.id,
				requiredText(input.versionPublicId, 'Document revision', 36)
			);
			if (!version) {
				throw new PortalCollaborationValidationError('Select an issued or superseded revision owned by this organisation.');
			}
			const publicId = this.publicIdFactory();
			const issuedAt = this.now();
			await repository.insertTransmittal({
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId,
				number: requiredText(input.transmittalNumber, 'Transmittal number', 120),
				subject: requiredText(input.subject, 'Transmittal subject'),
				purpose: optionalText(input.purpose, 160),
				memberId: actor.memberId,
				issuedAt,
				versionId: version.id,
				recipientOrganisationId: target.id,
				recipientName: target.name
			});
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'portal.transmittal.issue',
				subjectType: 'transmittal',
				subjectPublicId: publicId,
				changeSummary: {
					participantOrganisationPublicId: target.publicId,
					versionPublicId: version.publicId,
					transmittalNumber: input.transmittalNumber
				}
			});
			return publicId;
		});
	}
}
