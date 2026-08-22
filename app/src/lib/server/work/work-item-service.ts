import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import {
	WorkItemRepository,
	type WorkItemAssignmentScope,
	type WorkItemDecision,
	type WorkItemKind,
	type WorkItemPriority,
	type WorkItemRecord,
	type WorkItemStatus
} from './work-item-repository';

export class WorkKernelValidationError extends Error {
	readonly code = 'WORK_KERNEL_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'WorkKernelValidationError';
	}
}

export type CreateWorkItemInput = {
	projectId?: string | null;
	kind?: WorkItemKind;
	sourceDomain: string;
	sourceType?: string | null;
	sourcePublicId?: string | null;
	title: string;
	description?: string | null;
	priority?: WorkItemPriority;
	dueAt?: Date | null;
};

export type AssignWorkItemInput = {
	scope: WorkItemAssignmentScope;
	assignedOrganisationId: string;
	assignedMemberId?: string | null;
	assignedTeamId?: string | null;
	note?: string | null;
	replaceExisting?: boolean;
};

const TRANSITIONS: Readonly<Record<WorkItemStatus, readonly WorkItemStatus[]>> = {
	open: ['in_progress', 'cancelled'],
	in_progress: ['blocked', 'completed', 'cancelled'],
	blocked: ['in_progress', 'cancelled'],
	completed: [],
	cancelled: []
};

function assertText(value: string, name: string, maxLength: number): string {
	const normalized = value.trim();
	if (!normalized) throw new WorkKernelValidationError(`${name} is required.`);
	if (normalized.length > maxLength) {
		throw new WorkKernelValidationError(`${name} must be ${maxLength} characters or fewer.`);
	}
	return normalized;
}

function assertSourcePair(sourceType?: string | null, sourcePublicId?: string | null): void {
	const hasType = Boolean(sourceType?.trim());
	const hasId = Boolean(sourcePublicId?.trim());
	if (hasType !== hasId) {
		throw new WorkKernelValidationError(
			'sourceType and sourcePublicId must either both be supplied or both be omitted.'
		);
	}
}

function assertAssignmentTarget(input: AssignWorkItemInput): void {
	const hasMember = Boolean(input.assignedMemberId);
	const hasTeam = Boolean(input.assignedTeamId);
	if (input.scope === 'organisation' && (hasMember || hasTeam)) {
		throw new WorkKernelValidationError('Organisation assignment cannot include member or team IDs.');
	}
	if (input.scope === 'member' && (!hasMember || hasTeam)) {
		throw new WorkKernelValidationError('Member assignment requires only assignedMemberId.');
	}
	if (input.scope === 'team' && (hasMember || !hasTeam)) {
		throw new WorkKernelValidationError('Team assignment requires only assignedTeamId.');
	}
}

export class WorkItemService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: string,
		projectId?: string | null
	): Promise<void> {
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			permissionKey,
			'work.manage',
			projectId ? { projectId } : {}
		);
		if (!decision.allowed) {
			throw new TenantAccessError(`Permission '${permissionKey}' is required for this work operation.`);
		}
	}

	private async requireManagePermission(
		actor: TenantActorContext,
		projectId?: string | null
	): Promise<void> {
		const decision = await new PermissionService(this.db).decide(
			actor,
			'work.manage',
			projectId ? { projectId } : {}
		);
		if (!decision.allowed) {
			throw new TenantAccessError("Permission 'work.manage' is required for this work operation.");
		}
	}

	private async getOwnedWorkItem(
		actor: TenantActorContext,
		publicId: string
	): Promise<WorkItemRecord> {
		const workItem = await new WorkItemRepository(this.db).findByPublicId(
			actor.organisationId,
			publicId
		);
		if (!workItem) throw new RecordNotFoundError('The requested work item was not found.');
		return workItem;
	}

	async create(actor: TenantActorContext, input: CreateWorkItemInput): Promise<WorkItemRecord> {
		assertSourcePair(input.sourceType, input.sourcePublicId);
		const sourceDomain = assertText(input.sourceDomain, 'sourceDomain', 64);
		const title = assertText(input.title, 'title', 255);
		await this.requirePermission(actor, 'work.create', input.projectId);

		return this.db.transaction().execute(async (trx) => {
			const repository = new WorkItemRepository(trx);
			const publicId = randomUUID();
			const created = await repository.create({
				publicId,
				owningOrganisationId: actor.organisationId,
				projectId: input.projectId ?? null,
				kind: input.kind ?? 'action',
				sourceDomain,
				sourceType: input.sourceType?.trim() || null,
				sourcePublicId: input.sourcePublicId?.trim() || null,
				title,
				description: input.description?.trim() || null,
				priority: input.priority ?? 'normal',
				dueAt: input.dueAt ?? null,
				createdByMemberId: actor.memberId
			});

			await repository.appendEvent({
				workItemId: created.id,
				workItemOwnerOrganisationId: created.owningOrganisationId,
				eventPublicId: randomUUID(),
				eventType: 'created',
				toStatus: 'open',
				actingOrganisationId: actor.organisationId,
				actorMemberId: actor.memberId,
				correlationId: actor.correlationId,
				metadata: { sourceDomain: created.sourceDomain, kind: created.kind }
			});

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: created.projectId,
				actionKey: 'work.item.created',
				subjectType: 'work_item',
				subjectPublicId: created.publicId,
				correlationId: actor.correlationId,
				changeSummary: { status: 'open', title: created.title }
			});

			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'work.item.created',
				aggregateType: 'work_item',
				aggregatePublicId: created.publicId,
				correlationId: actor.correlationId,
				payload: {
					workItemPublicId: created.publicId,
					projectId: created.projectId,
					kind: created.kind,
					priority: created.priority,
					dueAt: created.dueAt?.toISOString() ?? null
				}
			});

			return created;
		});
	}

	async listMyWork(actor: TenantActorContext, limit = 100): Promise<WorkItemRecord[]> {
		await this.requirePermission(actor, 'work.view');
		return new WorkItemRepository(this.db).listAssignedToMember(
			actor.organisationId,
			actor.memberId,
			limit
		);
	}

	async assign(
		actor: TenantActorContext,
		workItemPublicId: string,
		input: AssignWorkItemInput
	): Promise<WorkItemRecord> {
		assertAssignmentTarget(input);
		const workItem = await this.getOwnedWorkItem(actor, workItemPublicId);
		await this.requirePermission(actor, 'work.assign', workItem.projectId);

		return this.db.transaction().execute(async (trx) => {
			const repository = new WorkItemRepository(trx);
			const current = await repository.findByPublicId(actor.organisationId, workItemPublicId);
			if (!current) throw new RecordNotFoundError('The requested work item was not found.');
			if (current.status === 'completed' || current.status === 'cancelled') {
				throw new WorkKernelValidationError('Closed work items cannot be reassigned.');
			}

			if (input.replaceExisting) {
				await repository.endActiveAssignments(current.id, current.owningOrganisationId, actor.memberId);
			}
			await repository.assign({
				workItemId: current.id,
				workItemOwnerOrganisationId: current.owningOrganisationId,
				scope: input.scope,
				assignedOrganisationId: input.assignedOrganisationId,
				assignedMemberId: input.assignedMemberId ?? null,
				assignedTeamId: input.assignedTeamId ?? null,
				assignedByMemberId: actor.memberId,
				note: input.note?.trim() || null
			});

			await repository.appendEvent({
				workItemId: current.id,
				workItemOwnerOrganisationId: current.owningOrganisationId,
				eventPublicId: randomUUID(),
				eventType: 'assigned',
				actingOrganisationId: actor.organisationId,
				actorMemberId: actor.memberId,
				correlationId: actor.correlationId,
				metadata: {
					scope: input.scope,
					assignedOrganisationId: input.assignedOrganisationId,
					assignedMemberId: input.assignedMemberId ?? null,
					assignedTeamId: input.assignedTeamId ?? null
				}
			});

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: current.projectId,
				actionKey: 'work.item.assigned',
				subjectType: 'work_item',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: { scope: input.scope, assignedOrganisationId: input.assignedOrganisationId }
			});

			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'work.item.assigned',
				aggregateType: 'work_item',
				aggregatePublicId: current.publicId,
				correlationId: actor.correlationId,
				payload: {
					workItemPublicId: current.publicId,
					scope: input.scope,
					assignedOrganisationId: input.assignedOrganisationId,
					assignedMemberId: input.assignedMemberId ?? null,
					assignedTeamId: input.assignedTeamId ?? null
				}
			});

			return current;
		});
	}

	async transition(
		actor: TenantActorContext,
		workItemPublicId: string,
		toStatus: WorkItemStatus,
		note?: string | null
	): Promise<WorkItemRecord> {
		const workItem = await this.getOwnedWorkItem(actor, workItemPublicId);
		if (!TRANSITIONS[workItem.status].includes(toStatus)) {
			throw new InvalidLifecycleTransitionError(workItem.status, toStatus);
		}

		if (toStatus === 'completed') {
			await this.requirePermission(actor, 'work.complete', workItem.projectId);
		} else if (toStatus === 'cancelled') {
			await this.requireManagePermission(actor, workItem.projectId);
		} else {
			await this.requirePermission(actor, 'work.progress', workItem.projectId);
		}

		return this.db.transaction().execute(async (trx) => {
			const repository = new WorkItemRepository(trx);
			const current = await repository.findByPublicId(actor.organisationId, workItemPublicId);
			if (!current) throw new RecordNotFoundError('The requested work item was not found.');
			if (!TRANSITIONS[current.status].includes(toStatus)) {
				throw new InvalidLifecycleTransitionError(current.status, toStatus);
			}

			const changed = await repository.transition(current, toStatus, actor.memberId, note?.trim() || null);
			if (!changed) throw new ConcurrentUpdateError();

			await repository.appendEvent({
				workItemId: current.id,
				workItemOwnerOrganisationId: current.owningOrganisationId,
				eventPublicId: randomUUID(),
				eventType: 'status_changed',
				fromStatus: current.status,
				toStatus,
				actingOrganisationId: actor.organisationId,
				actorMemberId: actor.memberId,
				correlationId: actor.correlationId,
				reason: note?.trim() || null
			});

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: current.projectId,
				actionKey: 'work.item.status_changed',
				subjectType: 'work_item',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: { from: current.status, to: toStatus, note: note?.trim() || null }
			});

			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'work.item.status_changed',
				aggregateType: 'work_item',
				aggregatePublicId: current.publicId,
				correlationId: actor.correlationId,
				payload: {
					workItemPublicId: current.publicId,
					fromStatus: current.status,
					toStatus
				}
			});

			const updated = await repository.findByPublicId(actor.organisationId, workItemPublicId);
			if (!updated) throw new RecordNotFoundError('The updated work item could not be reloaded.');
			return updated;
		});
	}

	async recordDecision(
		actor: TenantActorContext,
		workItemPublicId: string,
		decision: WorkItemDecision,
		note?: string | null
	): Promise<WorkItemRecord> {
		const workItem = await this.getOwnedWorkItem(actor, workItemPublicId);
		if (!['approval', 'review', 'decision', 'acknowledgement'].includes(workItem.kind)) {
			throw new WorkKernelValidationError('Decisions may only be recorded against decision-capable work items.');
		}
		if (workItem.status === 'completed' || workItem.status === 'cancelled') {
			throw new WorkKernelValidationError('A decision cannot be added to a closed work item.');
		}
		await this.requirePermission(actor, 'work.approve', workItem.projectId);

		return this.db.transaction().execute(async (trx) => {
			const repository = new WorkItemRepository(trx);
			const current = await repository.findByPublicId(actor.organisationId, workItemPublicId);
			if (!current) throw new RecordNotFoundError('The requested work item was not found.');
			await repository.recordDecision(current, decision, actor.memberId, note?.trim() || null);
			await repository.appendEvent({
				workItemId: current.id,
				workItemOwnerOrganisationId: current.owningOrganisationId,
				eventPublicId: randomUUID(),
				eventType: 'decision_recorded',
				actingOrganisationId: actor.organisationId,
				actorMemberId: actor.memberId,
				correlationId: actor.correlationId,
				reason: note?.trim() || null,
				metadata: { decision }
			});

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: current.projectId,
				actionKey: 'work.item.decision_recorded',
				subjectType: 'work_item',
				subjectPublicId: current.publicId,
				correlationId: actor.correlationId,
				changeSummary: { decision, note: note?.trim() || null }
			});

			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'work.item.decision_recorded',
				aggregateType: 'work_item',
				aggregatePublicId: current.publicId,
				correlationId: actor.correlationId,
				payload: { workItemPublicId: current.publicId, decision }
			});

			return current;
		});
	}
}
