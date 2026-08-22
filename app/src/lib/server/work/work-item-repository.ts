import { sql } from 'kysely';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type WorkItemKind =
	| 'action'
	| 'task'
	| 'approval'
	| 'review'
	| 'decision'
	| 'acknowledgement';

export type WorkItemPriority = 'low' | 'normal' | 'high' | 'urgent' | 'critical';
export type WorkItemStatus = 'open' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type WorkItemAssignmentScope = 'organisation' | 'team' | 'member';
export type WorkItemDecision = 'approved' | 'rejected' | 'returned' | 'acknowledged';

export type WorkItemRecord = {
	id: string;
	owningOrganisationId: string;
	publicId: string;
	projectId: string | null;
	kind: WorkItemKind;
	sourceDomain: string;
	sourceType: string | null;
	sourcePublicId: string | null;
	title: string;
	description: string | null;
	priority: WorkItemPriority;
	status: WorkItemStatus;
	dueAt: Date | null;
	createdByMemberId: string;
	startedAt: Date | null;
	completedByMemberId: string | null;
	completedAt: Date | null;
	cancelledByMemberId: string | null;
	cancelledAt: Date | null;
	completionNote: string | null;
	createdAt: Date;
	updatedAt: Date;
};

type WorkItemRow = {
	id: string;
	owning_organisation_id: string;
	public_id: string;
	project_id: string | null;
	work_item_kind: WorkItemKind;
	source_domain: string;
	source_type: string | null;
	source_public_id: string | null;
	title: string;
	description: string | null;
	priority: WorkItemPriority;
	status: WorkItemStatus;
	due_at: Date | null;
	created_by_member_id: string;
	started_at: Date | null;
	completed_by_member_id: string | null;
	completed_at: Date | null;
	cancelled_by_member_id: string | null;
	cancelled_at: Date | null;
	completion_note: string | null;
	created_at: Date;
	updated_at: Date;
};

export type CreateWorkItemRecord = {
	publicId: string;
	owningOrganisationId: string;
	projectId?: string | null;
	kind: WorkItemKind;
	sourceDomain: string;
	sourceType?: string | null;
	sourcePublicId?: string | null;
	title: string;
	description?: string | null;
	priority: WorkItemPriority;
	dueAt?: Date | null;
	createdByMemberId: string;
};

export type CreateWorkItemAssignment = {
	workItemId: string;
	workItemOwnerOrganisationId: string;
	scope: WorkItemAssignmentScope;
	assignedOrganisationId: string;
	assignedMemberId?: string | null;
	assignedTeamId?: string | null;
	assignedByMemberId: string;
	note?: string | null;
};

export type AppendWorkItemEvent = {
	workItemId: string;
	workItemOwnerOrganisationId: string;
	eventPublicId: string;
	eventType: string;
	fromStatus?: WorkItemStatus | null;
	toStatus?: WorkItemStatus | null;
	actingOrganisationId?: string | null;
	actorMemberId?: string | null;
	correlationId: string;
	reason?: string | null;
	metadata?: Record<string, unknown> | null;
};

function mapWorkItem(row: WorkItemRow): WorkItemRecord {
	return {
		id: row.id,
		owningOrganisationId: row.owning_organisation_id,
		publicId: row.public_id,
		projectId: row.project_id,
		kind: row.work_item_kind,
		sourceDomain: row.source_domain,
		sourceType: row.source_type,
		sourcePublicId: row.source_public_id,
		title: row.title,
		description: row.description,
		priority: row.priority,
		status: row.status,
		dueAt: row.due_at,
		createdByMemberId: row.created_by_member_id,
		startedAt: row.started_at,
		completedByMemberId: row.completed_by_member_id,
		completedAt: row.completed_at,
		cancelledByMemberId: row.cancelled_by_member_id,
		cancelledAt: row.cancelled_at,
		completionNote: row.completion_note,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

const WORK_ITEM_COLUMNS = sql.raw(`
	id,
	owning_organisation_id,
	public_id,
	project_id,
	work_item_kind,
	source_domain,
	source_type,
	source_public_id,
	title,
	description,
	priority,
	status,
	due_at,
	created_by_member_id,
	started_at,
	completed_by_member_id,
	completed_at,
	cancelled_by_member_id,
	cancelled_at,
	completion_note,
	created_at,
	updated_at
`);

export class WorkItemRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async create(input: CreateWorkItemRecord): Promise<WorkItemRecord> {
		await sql`
			INSERT INTO work_items (
				owning_organisation_id,
				public_id,
				project_id,
				work_item_kind,
				source_domain,
				source_type,
				source_public_id,
				title,
				description,
				priority,
				due_at,
				created_by_member_id
			)
			VALUES (
				${input.owningOrganisationId},
				${input.publicId},
				${input.projectId ?? null},
				${input.kind},
				${input.sourceDomain},
				${input.sourceType ?? null},
				${input.sourcePublicId ?? null},
				${input.title},
				${input.description ?? null},
				${input.priority},
				${input.dueAt ?? null},
				${input.createdByMemberId}
			)
		`.execute(this.db);

		const created = await this.findByPublicId(input.owningOrganisationId, input.publicId);
		if (!created) throw new Error('Created Work Kernel item could not be reloaded.');
		return created;
	}

	async findByPublicId(
		owningOrganisationId: string,
		publicId: string
	): Promise<WorkItemRecord | null> {
		const result = await sql<WorkItemRow>`
			SELECT ${WORK_ITEM_COLUMNS}
			FROM work_items
			WHERE owning_organisation_id = ${owningOrganisationId}
			  AND public_id = ${publicId}
			LIMIT 1
		`.execute(this.db);
		const row = result.rows[0];
		return row ? mapWorkItem(row) : null;
	}

	async listAssignedToMember(
		owningOrganisationId: string,
		memberId: string,
		limit = 100
	): Promise<WorkItemRecord[]> {
		const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 250));
		const result = await sql<WorkItemRow>`
			SELECT ${sql.raw(
				WORK_ITEM_COLUMNS.sql
					.split(',')
					.map((column) => `wi.${column.trim()}`)
					.join(', ')
			)}
			FROM work_items AS wi
			INNER JOIN work_item_assignments AS assignment
				ON assignment.work_item_id = wi.id
				AND assignment.work_item_owner_organisation_id = wi.owning_organisation_id
			WHERE wi.owning_organisation_id = ${owningOrganisationId}
			  AND assignment.assigned_organisation_id = ${owningOrganisationId}
			  AND assignment.assignment_scope = 'member'
			  AND assignment.assigned_member_id = ${memberId}
			  AND assignment.ended_at IS NULL
			  AND wi.status NOT IN ('completed', 'cancelled')
			ORDER BY
				CASE wi.priority
					WHEN 'critical' THEN 1
					WHEN 'urgent' THEN 2
					WHEN 'high' THEN 3
					WHEN 'normal' THEN 4
					ELSE 5
				END,
				wi.due_at IS NULL,
				wi.due_at,
				wi.created_at
			LIMIT ${safeLimit}
		`.execute(this.db);
		return result.rows.map(mapWorkItem);
	}

	async assign(input: CreateWorkItemAssignment): Promise<void> {
		await sql`
			INSERT INTO work_item_assignments (
				work_item_id,
				work_item_owner_organisation_id,
				assignment_scope,
				assigned_organisation_id,
				assigned_member_id,
				assigned_team_id,
				assigned_by_member_id,
				assignment_note
			)
			VALUES (
				${input.workItemId},
				${input.workItemOwnerOrganisationId},
				${input.scope},
				${input.assignedOrganisationId},
				${input.assignedMemberId ?? null},
				${input.assignedTeamId ?? null},
				${input.assignedByMemberId},
				${input.note ?? null}
			)
		`.execute(this.db);
	}

	async endActiveAssignments(
		workItemId: string,
		workItemOwnerOrganisationId: string,
		endedByMemberId: string
	): Promise<void> {
		await sql`
			UPDATE work_item_assignments
			SET ended_by_member_id = ${endedByMemberId},
				ended_at = CURRENT_TIMESTAMP(6)
			WHERE work_item_id = ${workItemId}
			  AND work_item_owner_organisation_id = ${workItemOwnerOrganisationId}
			  AND ended_at IS NULL
		`.execute(this.db);
	}

	async transition(
		workItem: WorkItemRecord,
		toStatus: WorkItemStatus,
		actorMemberId: string,
		note?: string | null
	): Promise<boolean> {
		const result = await sql`
			UPDATE work_items
			SET status = ${toStatus},
				started_at = CASE
					WHEN ${toStatus} IN ('in_progress', 'blocked', 'completed')
						THEN COALESCE(started_at, CURRENT_TIMESTAMP(6))
					ELSE started_at
				END,
				completed_by_member_id = CASE WHEN ${toStatus} = 'completed' THEN ${actorMemberId} ELSE NULL END,
				completed_at = CASE WHEN ${toStatus} = 'completed' THEN CURRENT_TIMESTAMP(6) ELSE NULL END,
				cancelled_by_member_id = CASE WHEN ${toStatus} = 'cancelled' THEN ${actorMemberId} ELSE NULL END,
				cancelled_at = CASE WHEN ${toStatus} = 'cancelled' THEN CURRENT_TIMESTAMP(6) ELSE NULL END,
				completion_note = CASE WHEN ${toStatus} = 'completed' THEN ${note ?? null} ELSE completion_note END
			WHERE id = ${workItem.id}
			  AND owning_organisation_id = ${workItem.owningOrganisationId}
			  AND status = ${workItem.status}
		`.execute(this.db);
		return (result.numAffectedRows ?? 0n) === 1n;
	}

	async recordDecision(
		workItem: WorkItemRecord,
		decision: WorkItemDecision,
		decidedByMemberId: string,
		note?: string | null
	): Promise<void> {
		await sql`
			INSERT INTO work_item_decisions (
				work_item_id,
				work_item_owner_organisation_id,
				decision,
				decided_by_member_id,
				decision_note
			)
			VALUES (
				${workItem.id},
				${workItem.owningOrganisationId},
				${decision},
				${decidedByMemberId},
				${note ?? null}
			)
		`.execute(this.db);
	}

	async appendEvent(event: AppendWorkItemEvent): Promise<void> {
		await sql`
			INSERT INTO work_item_events (
				work_item_id,
				work_item_owner_organisation_id,
				event_public_id,
				event_type,
				from_status,
				to_status,
				acting_organisation_id,
				actor_member_id,
				correlation_id,
				reason,
				event_metadata
			)
			VALUES (
				${event.workItemId},
				${event.workItemOwnerOrganisationId},
				${event.eventPublicId},
				${event.eventType},
				${event.fromStatus ?? null},
				${event.toStatus ?? null},
				${event.actingOrganisationId ?? null},
				${event.actorMemberId ?? null},
				${event.correlationId},
				${event.reason ?? null},
				${event.metadata === undefined || event.metadata === null
					? null
					: JSON.stringify(event.metadata)}
			)
		`.execute(this.db);
	}
}
