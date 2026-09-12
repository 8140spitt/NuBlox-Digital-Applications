import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { ExternalAccessDeniedError } from '$lib/server/external-access/external-access-service';
import { ExternalWorkService } from '$lib/server/external-access/external-work-service';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import type { Actor } from '$lib/types/request-context';

const REVIEW_OUTCOMES = new Set([
	'approved',
	'approved_with_comments',
	'revise_resubmit',
	'rejected',
	'no_objection',
	'for_information'
]);

const TERMINAL_PROJECT_STATUSES = new Set(['cancelled', 'archived']);

export class ExternalProjectActionValidationError extends Error {
	readonly code = 'EXTERNAL_PROJECT_ACTION_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'ExternalProjectActionValidationError';
	}
}

export type ExternalProjectAssignmentOptions = {
	canAssignRfis: boolean;
	canAssignSubmittals: boolean;
	canAssignInstructions: boolean;
	rfis: Array<{ publicId: string; number: string; subject: string; dueAt: Date | null }>;
	submittals: Array<{ publicId: string; number: string; title: string; dueAt: Date | null }>;
	instructions: Array<{ publicId: string; number: string; subject: string; issuedAt: Date | null }>;
};

type TaskCommon = {
	workItemPublicId: string;
	state: string;
	ownerName: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	collaboratorName: string;
	dueAt: Date | null;
};

export type ExternalProjectActionTask =
	| (TaskCommon & {
			kind: 'rfi';
			publicId: string;
			number: string;
			subject: string;
			question: string;
			priority: string;
			status: string;
			previousResponses: Array<{
				sequence: number;
				responseText: string;
				final: boolean;
				respondedAt: Date;
			}>;
	  })
	| (TaskCommon & {
			kind: 'submittal';
			publicId: string;
			number: string;
			title: string;
			status: string;
			submittedAt: Date | null;
			previousReviews: Array<{
				sequence: number;
				outcome: string;
				comments: string | null;
				reviewedAt: Date;
			}>;
	  })
	| (TaskCommon & {
			kind: 'instruction';
			publicId: string;
			number: string;
			subject: string;
			instructionText: string;
			status: string;
			issuedAt: Date | null;
			acknowledgedAt: Date | null;
	  });

function requiredPublicId(value: string, label: string): string {
	const publicId = value.trim();
	if (!/^[0-9a-f-]{36}$/i.test(publicId)) {
		throw new ExternalProjectActionValidationError(`${label} is invalid.`);
	}
	return publicId;
}

function requiredText(value: string, label: string, max = 20_000): string {
	const text = value.trim();
	if (!text) throw new ExternalProjectActionValidationError(`${label} is required.`);
	if (text.length > max) throw new ExternalProjectActionValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max = 20_000): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new ExternalProjectActionValidationError('A supplied value is too long.');
	return text;
}

function organisationName(row: { legalName: string; tradingName: string | null }): string {
	return row.tradingName?.trim() || row.legalName;
}

export class ExternalProjectActionService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async requireProjectManager(
		actor: TenantActorContext,
		projectPublicIdInput: string,
		db: DatabaseExecutor = this.db
	) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			requiredPublicId(projectPublicIdInput, 'Project')
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Owned project not found in your effective project scope.');
		}
		if (TERMINAL_PROJECT_STATUSES.has(project.status)) {
			throw new ExternalProjectActionValidationError(
				'This project is read-only for external work.'
			);
		}
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'project.participant.manage',
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed)
			throw new TenantAccessError('External project work assignment is not permitted.');
		return { membership, project };
	}

	private async requireDomainPermission(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed)
			throw new TenantAccessError('This controlled information action is not permitted.');
	}

	async listAssignmentOptions(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ExternalProjectAssignmentOptions> {
		const { project } = await this.requireProjectManager(actor, projectPublicId);
		const permissions = await new PermissionService(this.db).decideMany(actor, [
			'information.rfi.manage',
			'information.submittal.manage',
			'information.instruction.manage'
		]);
		const canAssignRfis = permissions.get('information.rfi.manage')?.allowed ?? false;
		const canAssignSubmittals = permissions.get('information.submittal.manage')?.allowed ?? false;
		const canAssignInstructions =
			permissions.get('information.instruction.manage')?.allowed ?? false;
		const [rfis, submittals, instructions] = await Promise.all([
			canAssignRfis
				? this.db
						.selectFrom('rfis')
						.select(['public_id as publicId', 'rfi_number as number', 'subject', 'due_at as dueAt'])
						.where('project_id', '=', project.id)
						.where('owning_organisation_id', '=', actor.organisationId)
						.where('status', 'in', ['open', 'reopened'])
						.orderBy('due_at', 'asc')
						.orderBy('rfi_number', 'asc')
						.execute()
				: Promise.resolve([]),
			canAssignSubmittals
				? this.db
						.selectFrom('submittals')
						.select([
							'public_id as publicId',
							'submittal_number as number',
							'title',
							'due_at as dueAt'
						])
						.where('project_id', '=', project.id)
						.where('owning_organisation_id', '=', actor.organisationId)
						.where('status', 'in', ['submitted', 'under_review'])
						.orderBy('due_at', 'asc')
						.orderBy('submittal_number', 'asc')
						.execute()
				: Promise.resolve([]),
			canAssignInstructions
				? this.db
						.selectFrom('project_instructions')
						.select([
							'public_id as publicId',
							'instruction_number as number',
							'subject',
							'issued_at as issuedAt'
						])
						.where('project_id', '=', project.id)
						.where('issuing_organisation_id', '=', actor.organisationId)
						.where('status', '=', 'issued')
						.orderBy('issued_at', 'desc')
						.execute()
				: Promise.resolve([])
		]);
		return {
			canAssignRfis,
			canAssignSubmittals,
			canAssignInstructions,
			rfis,
			submittals,
			instructions
		};
	}

	private async requireCollaborator(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		projectId: string,
		collaboratorPublicIdInput: string
	) {
		const collaborator = await db
			.selectFrom('project_external_collaborators')
			.select([
				'id',
				'public_id as publicId',
				'auth_user_id as authUserId',
				'invite_email as email'
			])
			.where('public_id', '=', requiredPublicId(collaboratorPublicIdInput, 'External collaborator'))
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', actor.organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!collaborator) throw new RecordNotFoundError('Active external collaborator not found.');
		if (!collaborator.authUserId) {
			throw new ExternalProjectActionValidationError(
				'The collaborator must accept their project invitation before work can be assigned.'
			);
		}
		return collaborator;
	}

	private async upsertGrant(
		db: DatabaseExecutor,
		input: {
			owningOrganisationId: string;
			authUserId: string;
			createdByMemberId: string;
			contextPublicId: string;
			resourceType: string;
			resourcePublicId: string;
			capabilityKey: string;
		}
	): Promise<string> {
		const at = this.now();
		await db
			.insertInto('external_access_grants')
			.values({
				public_id: this.publicIdFactory(),
				owning_organisation_id: input.owningOrganisationId,
				auth_user_id: input.authUserId,
				invitation_id: null,
				context_type: 'project',
				context_public_id: input.contextPublicId,
				resource_type: input.resourceType,
				resource_public_id: input.resourcePublicId,
				capability_key: input.capabilityKey,
				valid_from: at,
				valid_until: null,
				revoked_at: null,
				created_by_member_id: input.createdByMemberId
			})
			.onDuplicateKeyUpdate({
				valid_from: at,
				valid_until: null,
				revoked_at: null,
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirst();
		const grant = await db
			.selectFrom('external_access_grants')
			.select('id')
			.where('owning_organisation_id', '=', input.owningOrganisationId)
			.where('auth_user_id', '=', input.authUserId)
			.where('context_type', '=', 'project')
			.where('context_public_id', '=', input.contextPublicId)
			.where('resource_type', '=', input.resourceType)
			.where('resource_public_id', '=', input.resourcePublicId)
			.where('capability_key', '=', input.capabilityKey)
			.executeTakeFirstOrThrow();
		return grant.id;
	}

	private async ensureProjectViewGrant(
		db: DatabaseExecutor,
		input: {
			owningOrganisationId: string;
			authUserId: string;
			createdByMemberId: string;
			projectPublicId: string;
		}
	): Promise<void> {
		await this.upsertGrant(db, {
			...input,
			contextPublicId: input.projectPublicId,
			resourceType: 'project',
			resourcePublicId: input.projectPublicId,
			capabilityKey: 'project.view'
		});
	}

	private async upsertWorkItem(
		db: DatabaseExecutor,
		input: {
			owningOrganisationId: string;
			authUserId: string;
			grantId: string;
			sourceType: string;
			sourcePublicId: string;
			actionType: string;
			title: string;
			summary: string | null;
			dueAt: Date | null;
		}
	): Promise<void> {
		await db
			.insertInto('external_work_items')
			.values({
				public_id: this.publicIdFactory(),
				owning_organisation_id: input.owningOrganisationId,
				auth_user_id: input.authUserId,
				external_access_grant_id: input.grantId,
				domain_key: 'information',
				source_type: input.sourceType,
				source_public_id: input.sourcePublicId,
				action_type: input.actionType,
				title: input.title,
				summary: input.summary,
				state: 'open',
				due_at: input.dueAt,
				completed_at: null,
				cancelled_at: null
			})
			.onDuplicateKeyUpdate({
				auth_user_id: input.authUserId,
				title: input.title,
				summary: input.summary,
				state: 'open',
				due_at: input.dueAt,
				completed_at: null,
				cancelled_at: null
			})
			.executeTakeFirst();
	}

	private async assign(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			collaboratorPublicId: string;
			resourcePublicId: string;
			kind: 'rfi' | 'submittal' | 'instruction';
		}
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const domainPermission =
				input.kind === 'rfi'
					? 'information.rfi.manage'
					: input.kind === 'submittal'
						? 'information.submittal.manage'
						: 'information.instruction.manage';
			const { membership, project } = await this.requireProjectManager(
				actor,
				input.projectPublicId,
				trx
			);
			await this.requireDomainPermission(actor, domainPermission, trx);
			const collaborator = await this.requireCollaborator(
				trx,
				actor,
				project.id,
				input.collaboratorPublicId
			);
			await this.ensureProjectViewGrant(trx, {
				owningOrganisationId: actor.organisationId,
				authUserId: collaborator.authUserId,
				createdByMemberId: membership.id,
				projectPublicId: project.publicId
			});

			let resourceType: string;
			let capabilityKey: string;
			let actionType: string;
			let title: string;
			let summary: string | null;
			let dueAt: Date | null;
			let subjectPublicId: string;
			const requestedPublicId = requiredPublicId(input.resourcePublicId, 'Shared record');

			if (input.kind === 'rfi') {
				const row = await trx
					.selectFrom('rfis')
					.select([
						'public_id as publicId',
						'rfi_number as number',
						'subject',
						'question',
						'due_at as dueAt'
					])
					.where('public_id', '=', requestedPublicId)
					.where('project_id', '=', project.id)
					.where('owning_organisation_id', '=', actor.organisationId)
					.where('status', 'in', ['open', 'reopened'])
					.forUpdate()
					.executeTakeFirst();
				if (!row)
					throw new ExternalProjectActionValidationError(
						'Select an open RFI owned by this project.'
					);
				resourceType = 'rfi';
				capabilityKey = 'information.rfi.respond';
				actionType = 'respond_rfi';
				title = `Respond to RFI ${row.number} · ${row.subject}`;
				summary = row.question;
				dueAt = row.dueAt;
				subjectPublicId = row.publicId;
			} else if (input.kind === 'submittal') {
				const row = await trx
					.selectFrom('submittals')
					.select([
						'public_id as publicId',
						'submittal_number as number',
						'title',
						'due_at as dueAt'
					])
					.where('public_id', '=', requestedPublicId)
					.where('project_id', '=', project.id)
					.where('owning_organisation_id', '=', actor.organisationId)
					.where('status', 'in', ['submitted', 'under_review'])
					.forUpdate()
					.executeTakeFirst();
				if (!row)
					throw new ExternalProjectActionValidationError(
						'Select a submitted submittal owned by this project.'
					);
				resourceType = 'submittal';
				capabilityKey = 'information.submittal.review';
				actionType = 'review_submittal';
				title = `Review submittal ${row.number} · ${row.title}`;
				summary = `Review the controlled submittal for ${project.projectNumber} · ${project.name}.`;
				dueAt = row.dueAt;
				subjectPublicId = row.publicId;
			} else {
				const row = await trx
					.selectFrom('project_instructions')
					.select([
						'public_id as publicId',
						'instruction_number as number',
						'subject',
						'instruction_text as text'
					])
					.where('public_id', '=', requestedPublicId)
					.where('project_id', '=', project.id)
					.where('issuing_organisation_id', '=', actor.organisationId)
					.where('status', '=', 'issued')
					.forUpdate()
					.executeTakeFirst();
				if (!row)
					throw new ExternalProjectActionValidationError(
						'Select an issued instruction owned by this project.'
					);
				resourceType = 'project_instruction';
				capabilityKey = 'information.instruction.acknowledge';
				actionType = 'acknowledge_instruction';
				title = `Acknowledge instruction ${row.number} · ${row.subject}`;
				summary = row.text;
				dueAt = null;
				subjectPublicId = row.publicId;
			}

			const grantId = await this.upsertGrant(trx, {
				owningOrganisationId: actor.organisationId,
				authUserId: collaborator.authUserId,
				createdByMemberId: membership.id,
				contextPublicId: project.publicId,
				resourceType,
				resourcePublicId: subjectPublicId,
				capabilityKey
			});
			await this.upsertWorkItem(trx, {
				owningOrganisationId: actor.organisationId,
				authUserId: collaborator.authUserId,
				grantId,
				sourceType: resourceType,
				sourcePublicId: subjectPublicId,
				actionType,
				title,
				summary,
				dueAt
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: `network.${input.kind}.assigned`,
				subjectType: resourceType,
				subjectPublicId,
				correlationId: actor.correlationId,
				changeSummary: { collaboratorPublicId: collaborator.publicId, capabilityKey }
			});
		});
	}

	async assignRfi(
		actor: TenantActorContext,
		input: { projectPublicId: string; collaboratorPublicId: string; rfiPublicId: string }
	) {
		return this.assign(actor, {
			projectPublicId: input.projectPublicId,
			collaboratorPublicId: input.collaboratorPublicId,
			resourcePublicId: input.rfiPublicId,
			kind: 'rfi'
		});
	}

	async assignSubmittal(
		actor: TenantActorContext,
		input: { projectPublicId: string; collaboratorPublicId: string; submittalPublicId: string }
	) {
		return this.assign(actor, {
			projectPublicId: input.projectPublicId,
			collaboratorPublicId: input.collaboratorPublicId,
			resourcePublicId: input.submittalPublicId,
			kind: 'submittal'
		});
	}

	async assignInstruction(
		actor: TenantActorContext,
		input: { projectPublicId: string; collaboratorPublicId: string; instructionPublicId: string }
	) {
		return this.assign(actor, {
			projectPublicId: input.projectPublicId,
			collaboratorPublicId: input.collaboratorPublicId,
			resourcePublicId: input.instructionPublicId,
			kind: 'instruction'
		});
	}

	private async workContext(
		db: DatabaseExecutor,
		authUserId: string,
		workItemPublicIdInput: string,
		lock = false
	) {
		let query = db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.innerJoin('projects as project', (join) =>
				join
					.onRef('project.public_id', '=', 'grant.context_public_id')
					.onRef('project.owning_organisation_id', '=', 'grant.owning_organisation_id')
			)
			.innerJoin('project_external_collaborators as collaborator', (join) =>
				join
					.onRef('collaborator.project_id', '=', 'project.id')
					.onRef('collaborator.owning_organisation_id', '=', 'grant.owning_organisation_id')
					.onRef('collaborator.auth_user_id', '=', 'grant.auth_user_id')
			)
			.innerJoin('organisations as owner', 'owner.id', 'grant.owning_organisation_id')
			.select([
				'work.id as workId',
				'work.public_id as workItemPublicId',
				'work.state as state',
				'work.due_at as dueAt',
				'work.action_type as actionType',
				'work.source_type as sourceType',
				'work.source_public_id as sourcePublicId',
				'grant.id as grantId',
				'grant.capability_key as capabilityKey',
				'grant.owning_organisation_id as owningOrganisationId',
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'collaborator.id as collaboratorId',
				'collaborator.public_id as collaboratorPublicId',
				'collaborator.invite_email as collaboratorName',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName'
			])
			.where('work.public_id', '=', requiredPublicId(workItemPublicIdInput, 'Network work item'))
			.where('work.auth_user_id', '=', authUserId)
			.where('work.domain_key', '=', 'information')
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.context_type', '=', 'project')
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', this.now())
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', this.now())])
			)
			.where('collaborator.status', '=', 'active')
			.where('project.status', 'not in', ['cancelled', 'archived']);
		if (lock) query = query.forUpdate();
		const context = await query.executeTakeFirst();
		if (!context) throw new ExternalAccessDeniedError();
		return context;
	}

	async getTask(actor: Actor, workItemPublicId: string): Promise<ExternalProjectActionTask> {
		const context = await this.workContext(this.db, actor.authUserId, workItemPublicId);
		const common: TaskCommon = {
			workItemPublicId: context.workItemPublicId,
			state: context.state,
			ownerName: organisationName({
				legalName: context.ownerLegalName,
				tradingName: context.ownerTradingName
			}),
			projectPublicId: context.projectPublicId,
			projectNumber: context.projectNumber,
			projectName: context.projectName,
			collaboratorName: actor.displayName || context.collaboratorName,
			dueAt: context.dueAt
		};

		if (
			context.actionType === 'respond_rfi' &&
			context.sourceType === 'rfi' &&
			context.capabilityKey === 'information.rfi.respond'
		) {
			const rfi = await this.db
				.selectFrom('rfis')
				.select([
					'id',
					'public_id as publicId',
					'rfi_number as number',
					'subject',
					'question',
					'priority',
					'status'
				])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('owning_organisation_id', '=', context.owningOrganisationId)
				.executeTakeFirst();
			if (!rfi) throw new ExternalAccessDeniedError();
			const previousResponses = await this.db
				.selectFrom('external_rfi_responses')
				.select([
					'response_sequence as sequence',
					'response_text as responseText',
					'is_final_response as final',
					'responded_at as respondedAt'
				])
				.where('rfi_id', '=', rfi.id)
				.where('external_collaborator_id', '=', context.collaboratorId)
				.orderBy('response_sequence', 'asc')
				.execute();
			return {
				...common,
				kind: 'rfi',
				publicId: rfi.publicId,
				number: rfi.number,
				subject: rfi.subject,
				question: rfi.question,
				priority: rfi.priority,
				status: rfi.status,
				previousResponses: previousResponses.map((row) => ({ ...row, final: Boolean(row.final) }))
			};
		}

		if (
			context.actionType === 'review_submittal' &&
			context.sourceType === 'submittal' &&
			context.capabilityKey === 'information.submittal.review'
		) {
			const submittal = await this.db
				.selectFrom('submittals')
				.select([
					'id',
					'public_id as publicId',
					'submittal_number as number',
					'title',
					'status',
					'submitted_at as submittedAt'
				])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('owning_organisation_id', '=', context.owningOrganisationId)
				.executeTakeFirst();
			if (!submittal) throw new ExternalAccessDeniedError();
			const previousReviews = await this.db
				.selectFrom('external_submittal_reviews')
				.select(['review_sequence as sequence', 'outcome', 'comments', 'reviewed_at as reviewedAt'])
				.where('submittal_id', '=', submittal.id)
				.where('external_collaborator_id', '=', context.collaboratorId)
				.orderBy('review_sequence', 'asc')
				.execute();
			return {
				...common,
				kind: 'submittal',
				publicId: submittal.publicId,
				number: submittal.number,
				title: submittal.title,
				status: submittal.status,
				submittedAt: submittal.submittedAt,
				previousReviews
			};
		}

		if (
			context.actionType === 'acknowledge_instruction' &&
			context.sourceType === 'project_instruction' &&
			context.capabilityKey === 'information.instruction.acknowledge'
		) {
			const instruction = await this.db
				.selectFrom('project_instructions')
				.select([
					'id',
					'public_id as publicId',
					'instruction_number as number',
					'subject',
					'instruction_text as instructionText',
					'status',
					'issued_at as issuedAt'
				])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('issuing_organisation_id', '=', context.owningOrganisationId)
				.executeTakeFirst();
			if (!instruction) throw new ExternalAccessDeniedError();
			const acknowledgement = await this.db
				.selectFrom('external_instruction_acknowledgements')
				.select('acknowledged_at as acknowledgedAt')
				.where('instruction_id', '=', instruction.id)
				.where('external_collaborator_id', '=', context.collaboratorId)
				.executeTakeFirst();
			return {
				...common,
				kind: 'instruction',
				publicId: instruction.publicId,
				number: instruction.number,
				subject: instruction.subject,
				instructionText: instruction.instructionText,
				status: instruction.status,
				issuedAt: instruction.issuedAt,
				acknowledgedAt: acknowledgement?.acknowledgedAt ?? null
			};
		}

		throw new ExternalAccessDeniedError();
	}

	async respondRfi(
		actor: Actor,
		input: { workItemPublicId: string; responseText: string; final?: boolean }
	): Promise<void> {
		const responseText = requiredText(input.responseText, 'RFI response');
		const final = input.final ?? true;
		await this.db.transaction().execute(async (trx) => {
			const work = await new ExternalWorkService(this.db, this.now).findAuthorisedForUpdate(
				trx,
				actor.authUserId,
				requiredPublicId(input.workItemPublicId, 'Network work item'),
				{ domainKey: 'information', actionType: 'respond_rfi' }
			);
			if (work.capabilityKey !== 'information.rfi.respond' || work.sourceType !== 'rfi')
				throw new ExternalAccessDeniedError();
			const context = await this.workContext(trx, actor.authUserId, input.workItemPublicId, true);
			const rfi = await trx
				.selectFrom('rfis')
				.select(['id', 'public_id as publicId', 'status'])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('owning_organisation_id', '=', context.owningOrganisationId)
				.forUpdate()
				.executeTakeFirst();
			if (!rfi || !['open', 'reopened'].includes(rfi.status))
				throw new ExternalProjectActionValidationError('This RFI is no longer open for response.');
			const last = await trx
				.selectFrom('external_rfi_responses')
				.select('response_sequence as sequence')
				.where('rfi_id', '=', rfi.id)
				.where('external_collaborator_id', '=', context.collaboratorId)
				.orderBy('response_sequence', 'desc')
				.limit(1)
				.executeTakeFirst();
			const sequence = Number(last?.sequence ?? 0) + 1;
			await trx
				.insertInto('external_rfi_responses')
				.values({
					public_id: this.publicIdFactory(),
					owning_organisation_id: context.owningOrganisationId,
					project_id: context.projectId,
					rfi_id: rfi.id,
					external_collaborator_id: context.collaboratorId,
					auth_user_id: actor.authUserId,
					response_sequence: sequence,
					response_text: responseText,
					is_final_response: final ? 1 : 0,
					responded_at: this.now()
				})
				.executeTakeFirstOrThrow();
			if (final) {
				const update = await trx
					.updateTable('rfis')
					.set({ status: 'answered' })
					.where('id', '=', rfi.id)
					.where('status', 'in', ['open', 'reopened'])
					.executeTakeFirst();
				if (update.numUpdatedRows !== 1n) throw new ConcurrentUpdateError();
				await new ExternalWorkService(this.db, this.now).markCompleted(trx, work.id, this.now());
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: context.owningOrganisationId,
				actorUserId: actor.userId,
				actorMemberId: null,
				externalAuthUserId: actor.authUserId,
				projectId: context.projectId,
				actionKey: 'network.rfi.responded',
				subjectType: 'rfi',
				subjectPublicId: rfi.publicId,
				correlationId: this.publicIdFactory(),
				changeSummary: { responseSequence: sequence, final }
			});
		});
	}

	async reviewSubmittal(
		actor: Actor,
		input: { workItemPublicId: string; outcome: string; comments?: string | null }
	): Promise<void> {
		if (!REVIEW_OUTCOMES.has(input.outcome))
			throw new ExternalProjectActionValidationError('Submittal review outcome is invalid.');
		const comments = optionalText(input.comments);
		await this.db.transaction().execute(async (trx) => {
			const work = await new ExternalWorkService(this.db, this.now).findAuthorisedForUpdate(
				trx,
				actor.authUserId,
				requiredPublicId(input.workItemPublicId, 'Network work item'),
				{ domainKey: 'information', actionType: 'review_submittal' }
			);
			if (work.capabilityKey !== 'information.submittal.review' || work.sourceType !== 'submittal')
				throw new ExternalAccessDeniedError();
			const context = await this.workContext(trx, actor.authUserId, input.workItemPublicId, true);
			const submittal = await trx
				.selectFrom('submittals')
				.select(['id', 'public_id as publicId', 'status'])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('owning_organisation_id', '=', context.owningOrganisationId)
				.forUpdate()
				.executeTakeFirst();
			if (!submittal || !['submitted', 'under_review'].includes(submittal.status))
				throw new ExternalProjectActionValidationError(
					'This submittal is no longer available for review.'
				);
			const last = await trx
				.selectFrom('external_submittal_reviews')
				.select('review_sequence as sequence')
				.where('submittal_id', '=', submittal.id)
				.where('external_collaborator_id', '=', context.collaboratorId)
				.orderBy('review_sequence', 'desc')
				.limit(1)
				.executeTakeFirst();
			const sequence = Number(last?.sequence ?? 0) + 1;
			await trx
				.insertInto('external_submittal_reviews')
				.values({
					public_id: this.publicIdFactory(),
					owning_organisation_id: context.owningOrganisationId,
					project_id: context.projectId,
					submittal_id: submittal.id,
					external_collaborator_id: context.collaboratorId,
					auth_user_id: actor.authUserId,
					review_sequence: sequence,
					outcome: input.outcome,
					comments,
					reviewed_at: this.now()
				})
				.executeTakeFirstOrThrow();
			const update = await trx
				.updateTable('submittals')
				.set({ status: 'reviewed' })
				.where('id', '=', submittal.id)
				.where('status', 'in', ['submitted', 'under_review'])
				.executeTakeFirst();
			if (update.numUpdatedRows !== 1n) throw new ConcurrentUpdateError();
			await new ExternalWorkService(this.db, this.now).markCompleted(trx, work.id, this.now());
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: context.owningOrganisationId,
				actorUserId: actor.userId,
				actorMemberId: null,
				externalAuthUserId: actor.authUserId,
				projectId: context.projectId,
				actionKey: 'network.submittal.reviewed',
				subjectType: 'submittal',
				subjectPublicId: submittal.publicId,
				correlationId: this.publicIdFactory(),
				changeSummary: { reviewSequence: sequence, outcome: input.outcome }
			});
		});
	}

	async acknowledgeInstruction(actor: Actor, workItemPublicIdInput: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const workItemPublicId = requiredPublicId(workItemPublicIdInput, 'Network work item');
			const work = await new ExternalWorkService(this.db, this.now).findAuthorisedForUpdate(
				trx,
				actor.authUserId,
				workItemPublicId,
				{ domainKey: 'information', actionType: 'acknowledge_instruction' }
			);
			if (
				work.capabilityKey !== 'information.instruction.acknowledge' ||
				work.sourceType !== 'project_instruction'
			)
				throw new ExternalAccessDeniedError();
			const context = await this.workContext(trx, actor.authUserId, workItemPublicId, true);
			const instruction = await trx
				.selectFrom('project_instructions')
				.select(['id', 'public_id as publicId', 'status'])
				.where('public_id', '=', context.sourcePublicId)
				.where('project_id', '=', context.projectId)
				.where('issuing_organisation_id', '=', context.owningOrganisationId)
				.forUpdate()
				.executeTakeFirst();
			if (!instruction || instruction.status !== 'issued')
				throw new ExternalProjectActionValidationError(
					'This instruction is no longer awaiting acknowledgement.'
				);
			const at = this.now();
			await trx
				.insertInto('external_instruction_acknowledgements')
				.values({
					public_id: this.publicIdFactory(),
					owning_organisation_id: context.owningOrganisationId,
					project_id: context.projectId,
					instruction_id: instruction.id,
					external_collaborator_id: context.collaboratorId,
					auth_user_id: actor.authUserId,
					acknowledged_at: at
				})
				.executeTakeFirstOrThrow();
			await new ExternalWorkService(this.db, this.now).markCompleted(trx, work.id, at);
			const internalOutstanding = await trx
				.selectFrom('instruction_recipients')
				.select('instruction_id')
				.where('instruction_id', '=', instruction.id)
				.where('acknowledged_at', 'is', null)
				.limit(1)
				.executeTakeFirst();
			const externalOutstanding = await trx
				.selectFrom('external_work_items as pending')
				.innerJoin(
					'external_access_grants as grant',
					'grant.id',
					'pending.external_access_grant_id'
				)
				.select('pending.id')
				.where('pending.source_type', '=', 'project_instruction')
				.where('pending.source_public_id', '=', instruction.publicId)
				.where('pending.action_type', '=', 'acknowledge_instruction')
				.where('pending.state', '=', 'open')
				.where('grant.revoked_at', 'is', null)
				.limit(1)
				.executeTakeFirst();
			if (!internalOutstanding && !externalOutstanding) {
				await trx
					.updateTable('project_instructions')
					.set({ status: 'acknowledged' })
					.where('id', '=', instruction.id)
					.where('status', '=', 'issued')
					.executeTakeFirst();
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: context.owningOrganisationId,
				actorUserId: actor.userId,
				actorMemberId: null,
				externalAuthUserId: actor.authUserId,
				projectId: context.projectId,
				actionKey: 'network.instruction.acknowledged',
				subjectType: 'project_instruction',
				subjectPublicId: instruction.publicId,
				correlationId: this.publicIdFactory()
			});
		});
	}
}
