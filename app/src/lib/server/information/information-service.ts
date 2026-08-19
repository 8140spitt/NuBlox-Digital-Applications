import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	InformationRepository,
	type InformationContainerSummary,
	type InformationFileSummary,
	type InformationVersionSummary,
	type InstructionSummary,
	type RfiSummary,
	type SubmittalSummary
} from './information-repository';

export type DocumentRegisterItem = InformationContainerSummary & {
	versions: Array<InformationVersionSummary & { files: InformationFileSummary[] }>;
};

export type WorkspaceSubmittal = SubmittalSummary & {
	canCurrentActorReview: boolean;
};

export type InformationWorkspace = {
	canView: boolean;
	canManage: boolean;
	canManageFiles: boolean;
	canIssue: boolean;
	canManageRfis: boolean;
	canRespondRfis: boolean;
	canManageSubmittals: boolean;
	canReviewSubmittals: boolean;
	canManageInstructions: boolean;
	canIssueInstructions: boolean;
	projects: ProjectRecord[];
	containerTypes: Awaited<ReturnType<InformationRepository['listContainerTypes']>>;
	purposeCodes: Awaited<ReturnType<InformationRepository['listPurposeCodes']>>;
	submittalTypes: Awaited<ReturnType<InformationRepository['listSubmittalTypes']>>;
	instructionTypes: Awaited<ReturnType<InformationRepository['listInstructionTypes']>>;
	documents: DocumentRegisterItem[];
	rfis: RfiSummary[];
	submittals: WorkspaceSubmittal[];
	instructions: InstructionSummary[];
};

export class InformationValidationError extends Error {
	readonly code = 'INFORMATION_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'InformationValidationError';
	}
}

const FILE_ROLES = new Set(['authoritative', 'native', 'rendition', 'thumbnail', 'attachment']);
const ISSUE_CHANNELS = new Set(['transmittal', 'portal', 'email', 'manual', 'api', 'other']);
const RFI_PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const REVIEW_OUTCOMES = new Set([
	'approved',
	'approved_with_comments',
	'revise_resubmit',
	'rejected',
	'no_objection',
	'for_information'
]);

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new InformationValidationError(`${label} is required.`);
	if (text.length > max) throw new InformationValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max) throw new InformationValidationError('A supplied value is too long.');
	return text;
}

function optionalDateTime(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const date = new Date(text.endsWith('Z') ? text : `${text}:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new InformationValidationError(`${label} is invalid.`);
	return date;
}

function positiveInteger(value: string, label: string): string {
	const text = value.trim();
	if (!/^\d+$/.test(text) || BigInt(text) <= 0n) {
		throw new InformationValidationError(`${label} must be a positive whole number.`);
	}
	return text;
}

export class InformationService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async requirePermission(actor: TenantActorContext, permissionKey: string): Promise<void> {
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) {
			throw new TenantAccessError('This project information action is not permitted.');
		}
	}

	private async requireProject(actor: TenantActorContext, publicId: string): Promise<ProjectRecord> {
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId
		);
		if (!project) {
			throw new TenantAccessError('The project is outside your effective project scope.');
		}
		return project;
	}

	private async requireProjectById(
		actor: TenantActorContext,
		projectId: string
	): Promise<ProjectRecord> {
		const row = await this.db
			.selectFrom('projects')
			.select('public_id')
			.where('id', '=', projectId)
			.executeTakeFirst();
		if (!row) throw new TenantAccessError('The project is unavailable.');
		return this.requireProject(actor, row.public_id);
	}

	private async containerForVersion(
		repository: InformationRepository,
		actor: TenantActorContext,
		version: InformationVersionSummary
	): Promise<InformationContainerSummary> {
		const container = (await repository.listContainers(actor.organisationId)).find(
			(row) => row.id === version.containerId
		);
		if (!container) throw new TenantAccessError('Document not found in this organisation.');
		await this.requireProject(actor, container.projectPublicId);
		return container;
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
			eventPublicId: randomUUID(),
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

	async getWorkspace(actor: TenantActorContext): Promise<InformationWorkspace> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, [
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
		]);
		const allowed = (key: string) => decisions.get(key)?.allowed ?? false;
		const canView = allowed('information.view');
		if (!canView) {
			return {
				canView: false,
				canManage: false,
				canManageFiles: false,
				canIssue: false,
				canManageRfis: false,
				canRespondRfis: false,
				canManageSubmittals: false,
				canReviewSubmittals: false,
				canManageInstructions: false,
				canIssueInstructions: false,
				projects: [],
				containerTypes: [],
				purposeCodes: [],
				submittalTypes: [],
				instructionTypes: [],
				documents: [],
				rfis: [],
				submittals: [],
				instructions: []
			};
		}

		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const accessibleProjectIds = new Set(projects.map((project) => project.id));
		const repository = new InformationRepository(this.db);
		const [
			containerTypes,
			purposeCodes,
			submittalTypes,
			instructionTypes,
			containers,
			rfis,
			submittals,
			instructions
		] = await Promise.all([
			repository.listContainerTypes(),
			repository.listPurposeCodes(),
			repository.listSubmittalTypes(),
			repository.listInstructionTypes(),
			repository.listContainers(actor.organisationId),
			repository.listRfis(actor.organisationId),
			repository.listSubmittals(actor.organisationId),
			repository.listInstructions(actor.organisationId)
		]);

		const documents = await Promise.all(
			containers
				.filter((container) => accessibleProjectIds.has(container.projectId))
				.map(async (container) => ({
					...container,
					versions: await Promise.all(
						(await repository.listVersions(container.id, actor.organisationId)).map(
							async (version) => ({
								...version,
								files: await repository.listFiles(version.id, actor.organisationId)
							})
						)
					)
				}))
		);

		return {
			canView,
			canManage: allowed('information.manage'),
			canManageFiles: allowed('information.file.manage'),
			canIssue: allowed('information.issue'),
			canManageRfis: allowed('information.rfi.manage'),
			canRespondRfis: allowed('information.rfi.respond'),
			canManageSubmittals: allowed('information.submittal.manage'),
			canReviewSubmittals: allowed('information.submittal.review'),
			canManageInstructions: allowed('information.instruction.manage'),
			canIssueInstructions: allowed('information.instruction.issue'),
			projects,
			containerTypes,
			purposeCodes,
			submittalTypes,
			instructionTypes,
			documents,
			rfis: rfis.filter((row) => accessibleProjectIds.has(row.projectId)),
			submittals: submittals
				.filter((row) => accessibleProjectIds.has(row.projectId))
				.map((row) => ({
					...row,
					canCurrentActorReview: row.createdByMemberId !== actor.memberId
				})),
			instructions: instructions.filter((row) => accessibleProjectIds.has(row.projectId))
		};
	}

	async createDocument(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			typeCode: string;
			containerNumber: string;
			title: string;
			disciplineCode?: string;
			classificationCode?: string;
			revisionCode: string;
			purposeCode?: string;
			suitabilityCode?: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.manage');
		const project = await this.requireProject(
			actor,
			requiredText(input.projectPublicId, 'Project', 36)
		);
		const repository = new InformationRepository(this.db);
		const type = await repository.findContainerTypeByCode(
			requiredText(input.typeCode, 'Document type', 64)
		);
		if (!type) throw new InformationValidationError('Document type is not available.');
		const purposeText = input.purposeCode?.trim() ?? '';
		const purpose = purposeText ? await repository.findPurposeByCode(purposeText) : null;
		if (purposeText && !purpose) {
			throw new InformationValidationError('Purpose of issue is not available.');
		}

		const containerPublicId = randomUUID();
		const versionPublicId = randomUUID();
		const containerNumber = requiredText(input.containerNumber, 'Document number', 160);
		const title = requiredText(input.title, 'Document title');
		const revisionCode = requiredText(input.revisionCode, 'Revision code', 80);

		await this.db.transaction().execute(async (trx) => {
			const txRepository = new InformationRepository(trx);
			const containerId = await txRepository.insertContainer({
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId: containerPublicId,
				typeId: type.id,
				containerNumber,
				title,
				disciplineCode: optionalText(input.disciplineCode, 64),
				classificationCode: optionalText(input.classificationCode, 120),
				createdByMemberId: actor.memberId
			});
			await txRepository.insertVersion({
				containerId,
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId: versionPublicId,
				revisionCode,
				versionSequence: 1,
				titleAtVersion: title,
				purposeId: purpose?.id ?? null,
				suitabilityCode: optionalText(input.suitabilityCode, 64),
				createdByMemberId: actor.memberId
			});
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'information.document.create',
				subjectType: 'information_container',
				subjectPublicId: containerPublicId,
				changeSummary: { containerNumber, title, revisionCode, versionPublicId }
			});
		});
		return containerPublicId;
	}

	async createRevision(
		actor: TenantActorContext,
		input: {
			containerPublicId: string;
			revisionCode: string;
			titleAtVersion: string;
			purposeCode?: string;
			suitabilityCode?: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.manage');
		const repository = new InformationRepository(this.db);
		const container = await repository.findContainerByPublicId(
			actor.organisationId,
			requiredText(input.containerPublicId, 'Document', 36)
		);
		if (!container) throw new TenantAccessError('Document not found in this organisation.');
		await this.requireProject(actor, container.projectPublicId);

		const purposeText = input.purposeCode?.trim() ?? '';
		const purpose = purposeText ? await repository.findPurposeByCode(purposeText) : null;
		if (purposeText && !purpose) {
			throw new InformationValidationError('Purpose of issue is not available.');
		}
		const versionPublicId = randomUUID();
		const revisionCode = requiredText(input.revisionCode, 'Revision code', 80);
		const titleAtVersion = requiredText(input.titleAtVersion, 'Revision title');

		await this.db.transaction().execute(async (trx) => {
			const txRepository = new InformationRepository(trx);
			const sequence = await txRepository.nextVersionSequence(
				container.id,
				actor.organisationId
			);
			await txRepository.insertVersion({
				containerId: container.id,
				projectId: container.projectId,
				organisationId: actor.organisationId,
				publicId: versionPublicId,
				revisionCode,
				versionSequence: sequence,
				titleAtVersion,
				purposeId: purpose?.id ?? null,
				suitabilityCode: optionalText(input.suitabilityCode, 64),
				createdByMemberId: actor.memberId
			});
			await this.appendAudit(trx, actor, {
				projectId: container.projectId,
				actionKey: 'information.revision.create',
				subjectType: 'information_container_version',
				subjectPublicId: versionPublicId,
				changeSummary: { containerPublicId: container.publicId, revisionCode, sequence }
			});
		});
		return versionPublicId;
	}

	async updateDraftRevision(
		actor: TenantActorContext,
		input: {
			versionPublicId: string;
			titleAtVersion: string;
			purposeCode?: string;
			suitabilityCode?: string;
		}
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.manage');
		const repository = new InformationRepository(this.db);
		const version = await repository.findVersionByPublicId(
			actor.organisationId,
			requiredText(input.versionPublicId, 'Revision', 36)
		);
		if (!version) throw new TenantAccessError('Revision not found in this organisation.');
		if (version.status !== 'draft') {
			throw new InformationValidationError(
				'Issued revisions are immutable; create a new revision instead.'
			);
		}
		const container = await this.containerForVersion(repository, actor, version);
		const purposeText = input.purposeCode?.trim() ?? '';
		const purpose = purposeText ? await repository.findPurposeByCode(purposeText) : null;
		if (purposeText && !purpose) {
			throw new InformationValidationError('Purpose of issue is not available.');
		}
		const titleAtVersion = requiredText(input.titleAtVersion, 'Revision title');
		const updated = await repository.updateDraftVersion({
			versionId: version.id,
			organisationId: actor.organisationId,
			titleAtVersion,
			purposeId: purpose?.id ?? null,
			suitabilityCode: optionalText(input.suitabilityCode, 64)
		});
		if (updated !== 1) {
			throw new InformationValidationError('The revision changed before it could be updated.');
		}
		await this.appendAudit(this.db, actor, {
			projectId: container.projectId,
			actionKey: 'information.revision.update',
			subjectType: 'information_container_version',
			subjectPublicId: version.publicId,
			changeSummary: { titleAtVersion, purposeCode: purpose?.code ?? null }
		});
	}

	async registerFileMetadata(
		actor: TenantActorContext,
		input: {
			versionPublicId: string;
			fileRole: string;
			storageProvider: string;
			storageBucket: string;
			storageKey: string;
			originalFilename: string;
			contentType?: string;
			sizeBytes: string;
			checksumAlgorithm: string;
			checksumValue: string;
		}
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.file.manage');
		const repository = new InformationRepository(this.db);
		const version = await repository.findVersionByPublicId(
			actor.organisationId,
			requiredText(input.versionPublicId, 'Revision', 36)
		);
		if (!version) throw new TenantAccessError('Revision not found in this organisation.');
		if (version.status !== 'draft') {
			throw new InformationValidationError(
				'File metadata is immutable after a revision is issued.'
			);
		}
		if (!FILE_ROLES.has(input.fileRole)) {
			throw new InformationValidationError('File role is invalid.');
		}
		const container = await this.containerForVersion(repository, actor, version);
		const fileId = await repository.insertFile({
			versionId: version.id,
			organisationId: actor.organisationId,
			fileRole: input.fileRole,
			storageProvider: requiredText(input.storageProvider, 'Storage provider', 64),
			storageBucket: requiredText(input.storageBucket, 'Storage bucket', 255),
			storageKey: requiredText(input.storageKey, 'Storage key', 1000),
			originalFilename: requiredText(input.originalFilename, 'Original filename'),
			contentType: optionalText(input.contentType, 255),
			sizeBytes: positiveInteger(input.sizeBytes, 'File size'),
			checksumAlgorithm: requiredText(input.checksumAlgorithm, 'Checksum algorithm', 32),
			checksumValue: requiredText(input.checksumValue, 'Checksum value', 256),
			malwareScanStatus: 'pending'
		});
		await this.appendAudit(this.db, actor, {
			projectId: container.projectId,
			actionKey: 'information.file_metadata.register',
			subjectType: 'information_file',
			subjectPublicId: version.publicId,
			changeSummary: {
				fileId,
				originalFilename: input.originalFilename,
				fileRole: input.fileRole
			}
		});
	}

	async issueRevision(
		actor: TenantActorContext,
		input: { versionPublicId: string; channel?: string; note?: string }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.issue');
		const repository = new InformationRepository(this.db);
		const version = await repository.findVersionByPublicId(
			actor.organisationId,
			requiredText(input.versionPublicId, 'Revision', 36)
		);
		if (!version) throw new TenantAccessError('Revision not found in this organisation.');
		if (version.status !== 'draft') {
			throw new InformationValidationError('Only a draft revision can be issued.');
		}
		const container = await this.containerForVersion(repository, actor, version);
		const channel = input.channel?.trim() || 'portal';
		if (!ISSUE_CHANNELS.has(channel)) {
			throw new InformationValidationError('Issue channel is invalid.');
		}

		await this.db.transaction().execute(async (trx) => {
			const txRepository = new InformationRepository(trx);
			const locked = await txRepository.issueVersion({
				versionId: version.id,
				organisationId: actor.organisationId,
				memberId: actor.memberId
			});
			if (locked !== 1) {
				throw new InformationValidationError('The revision changed before it could be issued.');
			}
			const issueSequence = await txRepository.nextIssueSequence(
				version.id,
				actor.organisationId
			);
			await txRepository.insertIssueEvent({
				projectId: container.projectId,
				organisationId: actor.organisationId,
				versionId: version.id,
				issueSequence,
				memberId: actor.memberId,
				channel,
				note: optionalText(input.note, 1000)
			});
			await this.appendAudit(trx, actor, {
				projectId: container.projectId,
				actionKey: 'information.revision.issue',
				subjectType: 'information_container_version',
				subjectPublicId: version.publicId,
				changeSummary: { revisionCode: version.revisionCode, issueSequence, channel }
			});
		});
	}

	async createRfi(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			rfiNumber: string;
			subject: string;
			question: string;
			priority?: string;
			dueAt?: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.rfi.manage');
		const project = await this.requireProject(
			actor,
			requiredText(input.projectPublicId, 'Project', 36)
		);
		const priority = input.priority?.trim() || 'normal';
		if (!RFI_PRIORITIES.has(priority)) {
			throw new InformationValidationError('RFI priority is invalid.');
		}
		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			await new InformationRepository(trx).insertRfi({
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId,
				rfiNumber: requiredText(input.rfiNumber, 'RFI number', 120),
				subject: requiredText(input.subject, 'RFI subject'),
				question: requiredText(input.question, 'RFI question', 10000),
				priority,
				dueAt: optionalDateTime(input.dueAt, 'RFI due date'),
				memberId: actor.memberId
			});
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'information.rfi.create',
				subjectType: 'rfi',
				subjectPublicId: publicId
			});
		});
		return publicId;
	}

	async openRfi(actor: TenantActorContext, publicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.rfi.manage');
		const repository = new InformationRepository(this.db);
		const rfi = await repository.findRfiByPublicId(
			actor.organisationId,
			requiredText(publicId, 'RFI', 36)
		);
		if (!rfi) throw new TenantAccessError('RFI not found.');
		await this.requireProjectById(actor, rfi.projectId);
		if ((await repository.openRfi(rfi.id, actor.organisationId)) !== 1) {
			throw new InformationValidationError('Only a draft RFI can be opened.');
		}
		await this.appendAudit(this.db, actor, {
			projectId: rfi.projectId,
			actionKey: 'information.rfi.open',
			subjectType: 'rfi',
			subjectPublicId: rfi.publicId
		});
	}

	async respondToRfi(
		actor: TenantActorContext,
		input: { rfiPublicId: string; responseText: string; final?: boolean }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.rfi.respond');
		const repository = new InformationRepository(this.db);
		const rfi = await repository.findRfiByPublicId(
			actor.organisationId,
			requiredText(input.rfiPublicId, 'RFI', 36)
		);
		if (!rfi) throw new TenantAccessError('RFI not found.');
		await this.requireProjectById(actor, rfi.projectId);
		if (!['open', 'reopened'].includes(rfi.status)) {
			throw new InformationValidationError('Only an open RFI can receive a response.');
		}
		const sequence = await repository.nextRfiResponseSequence(rfi.id, actor.organisationId);
		const final = input.final ?? true;
		await repository.insertRfiResponse({
			projectId: rfi.projectId,
			rfiId: rfi.id,
			organisationId: actor.organisationId,
			responseSequence: sequence,
			responseText: requiredText(input.responseText, 'RFI response', 20000),
			memberId: actor.memberId,
			isFinal: final
		});
		if (final) await repository.markRfiAnswered(rfi.id, actor.organisationId);
		await this.appendAudit(this.db, actor, {
			projectId: rfi.projectId,
			actionKey: 'information.rfi.respond',
			subjectType: 'rfi',
			subjectPublicId: rfi.publicId,
			changeSummary: { responseSequence: sequence, final }
		});
	}

	async closeRfi(actor: TenantActorContext, publicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.rfi.manage');
		const repository = new InformationRepository(this.db);
		const rfi = await repository.findRfiByPublicId(
			actor.organisationId,
			requiredText(publicId, 'RFI', 36)
		);
		if (!rfi) throw new TenantAccessError('RFI not found.');
		await this.requireProjectById(actor, rfi.projectId);
		if ((await repository.closeRfi(rfi.id, actor.organisationId)) !== 1) {
			throw new InformationValidationError('An RFI must be answered before it can be closed.');
		}
		await this.appendAudit(this.db, actor, {
			projectId: rfi.projectId,
			actionKey: 'information.rfi.close',
			subjectType: 'rfi',
			subjectPublicId: rfi.publicId
		});
	}

	async createSubmittal(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			number: string;
			typeCode: string;
			title: string;
			dueAt?: string;
			versionPublicId?: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.submittal.manage');
		const project = await this.requireProject(
			actor,
			requiredText(input.projectPublicId, 'Project', 36)
		);
		const repository = new InformationRepository(this.db);
		const type = await repository.findSubmittalTypeByCode(
			requiredText(input.typeCode, 'Submittal type', 64)
		);
		if (!type) throw new InformationValidationError('Submittal type is not available.');

		const versionPublicId = input.versionPublicId?.trim() ?? '';
		const version = versionPublicId
			? await repository.findVersionByPublicId(actor.organisationId, versionPublicId)
			: null;
		if (versionPublicId && !version) {
			throw new InformationValidationError('Selected document revision is unavailable.');
		}
		if (version) {
			const container = await this.containerForVersion(repository, actor, version);
			if (container.projectId !== project.id) {
				throw new InformationValidationError(
					'Submittal revisions must belong to the selected project.'
				);
			}
		}

		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			const txRepository = new InformationRepository(trx);
			const id = await txRepository.insertSubmittal({
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId,
				number: requiredText(input.number, 'Submittal number', 120),
				typeId: type.id,
				title: requiredText(input.title, 'Submittal title'),
				dueAt: optionalDateTime(input.dueAt, 'Submittal due date'),
				memberId: actor.memberId
			});
			if (version) {
				await txRepository.addSubmittalItem({
					submittalId: id,
					organisationId: actor.organisationId,
					versionId: version.id,
					sortOrder: 1
				});
			}
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'information.submittal.create',
				subjectType: 'submittal',
				subjectPublicId: publicId,
				changeSummary: { versionPublicId: version?.publicId ?? null }
			});
		});
		return publicId;
	}

	async submitSubmittal(actor: TenantActorContext, publicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.submittal.manage');
		const repository = new InformationRepository(this.db);
		const submittal = await repository.findSubmittalByPublicId(
			actor.organisationId,
			requiredText(publicId, 'Submittal', 36)
		);
		if (!submittal) throw new TenantAccessError('Submittal not found.');
		await this.requireProjectById(actor, submittal.projectId);
		const submitted = await repository.submitSubmittal({
			id: submittal.id,
			projectId: submittal.projectId,
			organisationId: actor.organisationId,
			dueAt: submittal.dueAt
		});
		if (submitted !== 1) {
			throw new InformationValidationError('Only a draft submittal can be submitted.');
		}
		await this.appendAudit(this.db, actor, {
			projectId: submittal.projectId,
			actionKey: 'information.submittal.submit',
			subjectType: 'submittal',
			subjectPublicId: submittal.publicId
		});
	}

	async reviewSubmittal(
		actor: TenantActorContext,
		input: { publicId: string; outcome: string; comments?: string }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.submittal.review');
		const repository = new InformationRepository(this.db);
		const submittal = await repository.findSubmittalByPublicId(
			actor.organisationId,
			requiredText(input.publicId, 'Submittal', 36)
		);
		if (!submittal) throw new TenantAccessError('Submittal not found.');
		await this.requireProjectById(actor, submittal.projectId);
		if (!['submitted', 'under_review'].includes(submittal.status)) {
			throw new InformationValidationError('Only a submitted submittal can be reviewed.');
		}
		if (submittal.createdByMemberId === actor.memberId) {
			throw new InformationValidationError(
				'The submitting member cannot review their own submittal.'
			);
		}
		if (!REVIEW_OUTCOMES.has(input.outcome)) {
			throw new InformationValidationError('Submittal review outcome is invalid.');
		}
		const sequence = await repository.nextSubmittalReviewSequence(
			submittal.id,
			actor.organisationId
		);
		await repository.insertSubmittalReview({
			submittalId: submittal.id,
			organisationId: actor.organisationId,
			reviewSequence: sequence,
			outcome: input.outcome,
			comments: optionalText(input.comments, 20000),
			memberId: actor.memberId
		});
		await repository.markSubmittalReviewed(submittal.id, actor.organisationId);
		await this.appendAudit(this.db, actor, {
			projectId: submittal.projectId,
			actionKey: 'information.submittal.review',
			subjectType: 'submittal',
			subjectPublicId: submittal.publicId,
			changeSummary: { outcome: input.outcome, reviewSequence: sequence }
		});
	}

	async createInstruction(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			number: string;
			typeCode: string;
			subject: string;
			instructionText: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.instruction.manage');
		const project = await this.requireProject(
			actor,
			requiredText(input.projectPublicId, 'Project', 36)
		);
		const repository = new InformationRepository(this.db);
		const type = await repository.findInstructionTypeByCode(
			requiredText(input.typeCode, 'Instruction type', 64)
		);
		if (!type) throw new InformationValidationError('Instruction type is not available.');
		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			await new InformationRepository(trx).insertInstruction({
				projectId: project.id,
				organisationId: actor.organisationId,
				publicId,
				number: requiredText(input.number, 'Instruction number', 120),
				typeId: type.id,
				subject: requiredText(input.subject, 'Instruction subject'),
				instructionText: requiredText(input.instructionText, 'Instruction text', 20000),
				memberId: actor.memberId
			});
			await this.appendAudit(trx, actor, {
				projectId: project.id,
				actionKey: 'information.instruction.create',
				subjectType: 'project_instruction',
				subjectPublicId: publicId
			});
		});
		return publicId;
	}

	async issueInstruction(actor: TenantActorContext, publicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.instruction.issue');
		const repository = new InformationRepository(this.db);
		const instruction = await repository.findInstructionByPublicId(
			actor.organisationId,
			requiredText(publicId, 'Instruction', 36)
		);
		if (!instruction) throw new TenantAccessError('Instruction not found.');
		await this.requireProjectById(actor, instruction.projectId);
		if ((await repository.issueInstruction(instruction.id, actor.organisationId)) !== 1) {
			throw new InformationValidationError('Only a draft instruction can be issued.');
		}
		await this.appendAudit(this.db, actor, {
			projectId: instruction.projectId,
			actionKey: 'information.instruction.issue',
			subjectType: 'project_instruction',
			subjectPublicId: instruction.publicId
		});
	}
}
