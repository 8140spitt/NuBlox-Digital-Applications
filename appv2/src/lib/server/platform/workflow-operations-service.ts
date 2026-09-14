import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { hasPermission } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';

export class WorkflowOperationsAccessError extends Error {}
export class WorkflowOperationsValidationError extends Error {}

export type WorkflowHealth = 'green' | 'amber' | 'red';
export type WorkflowOperation = {
	requestPublicId: string;
	workItemPublicId: string;
	workflowKey: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
	contextPublicId: string;
	fromState: string;
	toState: string;
	transitionLabel: string;
	requestStatus: string;
	workStatus: string;
	priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
	submittedAt: string;
	dueAt: string | null;
	decidedAt: string | null;
	health: WorkflowHealth;
};

export type WorkflowOperationDetail = WorkflowOperation & {
	submissionNote: string | null;
	decisionNote: string | null;
	assignments: Array<{
		id: number;
		assignmentScope: string;
		assignedMemberId: number | null;
		memberName: string | null;
		assignedAt: string;
		endedAt: string | null;
		assignmentNote: string | null;
	}>;
	events: Array<{
		id: number;
		eventType: string;
		fromStatus: string | null;
		toStatus: string | null;
		actorName: string | null;
		reason: string | null;
		occurredAt: string;
	}>;
	members: Array<{ memberId: number; displayName: string }>;
};

type OperationRow = RowDataPacket & {
	requestPublicId: string;
	workItemPublicId: string;
	workItemId: number;
	workflowKey: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
	contextPublicId: string;
	fromState: string;
	toState: string;
	transitionLabel: string;
	requestStatus: string;
	workStatus: string;
	priority: WorkflowOperation['priority'];
	submissionNote: string | null;
	decisionNote: string | null;
	submittedAt: Date | string;
	dueAt: Date | string | null;
	decidedAt: Date | string | null;
};

type AssignmentRow = RowDataPacket & {
	id: number;
	assignmentScope: string;
	assignedMemberId: number | null;
	memberName: string | null;
	assignedAt: Date | string;
	endedAt: Date | string | null;
	assignmentNote: string | null;
};

type EventRow = RowDataPacket & {
	id: number;
	eventType: string;
	fromStatus: string | null;
	toStatus: string | null;
	actorName: string | null;
	reason: string | null;
	occurredAt: Date | string;
};

type MemberRow = RowDataPacket & { memberId: number; displayName: string };
type LockedRow = RowDataPacket & { workItemId: number; workStatus: string; requestStatus: string };

function iso(value: Date | string | null): string | null {
	if (value === null) return null;
	return new Date(value).toISOString();
}

function health(row: Pick<OperationRow, 'requestStatus' | 'workStatus' | 'dueAt'>): WorkflowHealth {
	if (row.requestStatus === 'stale') return 'red';
	if (row.requestStatus === 'pending') {
		if (row.workStatus === 'blocked') return 'amber';
		if (row.dueAt && new Date(row.dueAt).getTime() < Date.now()) return 'amber';
	}
	return 'green';
}

function mapOperation(row: OperationRow): WorkflowOperation {
	return {
		requestPublicId: row.requestPublicId,
		workItemPublicId: row.workItemPublicId,
		workflowKey: row.workflowKey,
		sourceDomain: row.sourceDomain,
		sourceType: row.sourceType,
		sourcePublicId: row.sourcePublicId,
		contextPublicId: row.contextPublicId,
		fromState: row.fromState,
		toState: row.toState,
		transitionLabel: row.transitionLabel,
		requestStatus: row.requestStatus,
		workStatus: row.workStatus,
		priority: row.priority,
		submittedAt: iso(row.submittedAt)!,
		dueAt: iso(row.dueAt),
		decidedAt: iso(row.decidedAt),
		health: health(row)
	};
}

async function requireManage(actor: EvidenceActor): Promise<void> {
	const allowed = await hasPermission({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKey: 'workflow.manage'
	});
	if (!allowed) throw new WorkflowOperationsAccessError('Workflow operations access is required.');
}

async function operationRows(organisationId: string, requestPublicId?: string): Promise<OperationRow[]> {
	const params: Array<string> = [organisationId];
	const filter = requestPublicId ? ' AND request.public_id = ?' : '';
	if (requestPublicId) params.push(requestPublicId);
	const [rows] = await getPool().execute<OperationRow[]>(
		`SELECT request.public_id AS requestPublicId,
		        item.public_id AS workItemPublicId,
		        item.id AS workItemId,
		        request.workflow_key AS workflowKey,
		        request.source_domain AS sourceDomain,
		        request.source_type AS sourceType,
		        request.source_public_id AS sourcePublicId,
		        request.context_public_id AS contextPublicId,
		        request.lifecycle_from_state AS fromState,
		        request.lifecycle_to_state AS toState,
		        request.transition_label AS transitionLabel,
		        request.status AS requestStatus,
		        item.status AS workStatus,
		        item.priority,
		        request.submission_note AS submissionNote,
		        request.decision_note AS decisionNote,
		        request.submitted_at AS submittedAt,
		        request.due_at AS dueAt,
		        request.decided_at AS decidedAt
		 FROM workflow_requests request
		 JOIN work_items item
		   ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 WHERE request.organisation_id = ?${filter}
		 ORDER BY CASE request.status WHEN 'pending' THEN 0 WHEN 'stale' THEN 1 ELSE 2 END,
		          CASE item.priority WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 ELSE 3 END,
		          COALESCE(request.due_at, '9999-12-31'), request.submitted_at DESC
		 LIMIT 250`,
		params
	);
	return rows;
}

export async function listWorkflowOperations(actor: EvidenceActor): Promise<WorkflowOperation[]> {
	await requireManage(actor);
	return (await operationRows(actor.organisationId)).map(mapOperation);
}

export async function getWorkflowOperation(
	actor: EvidenceActor,
	requestPublicId: string
): Promise<WorkflowOperationDetail> {
	await requireManage(actor);
	const row = (await operationRows(actor.organisationId, requestPublicId))[0];
	if (!row) throw new WorkflowOperationsValidationError('Workflow operation was not found.');
	const [assignments] = await getPool().execute<AssignmentRow[]>(
		`SELECT assignment.id,
		        assignment.assignment_scope AS assignmentScope,
		        assignment.assigned_member_id AS assignedMemberId,
		        user.display_name AS memberName,
		        assignment.assigned_at AS assignedAt,
		        assignment.ended_at AS endedAt,
		        assignment.assignment_note AS assignmentNote
		 FROM work_item_assignments assignment
		 LEFT JOIN organisation_members member
		   ON member.id = assignment.assigned_member_id
		  AND member.organisation_id = assignment.assigned_organisation_id
		 LEFT JOIN users user ON user.id = member.user_id
		 WHERE assignment.work_item_id = ?
		   AND assignment.work_item_owner_organisation_id = ?
		 ORDER BY assignment.assigned_at DESC`,
		[row.workItemId, actor.organisationId]
	);
	const [events] = await getPool().execute<EventRow[]>(
		`SELECT event.id,
		        event.event_type AS eventType,
		        event.from_status AS fromStatus,
		        event.to_status AS toStatus,
		        user.display_name AS actorName,
		        event.reason,
		        event.occurred_at AS occurredAt
		 FROM work_item_events event
		 LEFT JOIN organisation_members member
		   ON member.id = event.actor_member_id
		  AND member.organisation_id = event.acting_organisation_id
		 LEFT JOIN users user ON user.id = member.user_id
		 WHERE event.work_item_id = ?
		   AND event.work_item_owner_organisation_id = ?
		 ORDER BY event.occurred_at DESC, event.id DESC`,
		[row.workItemId, actor.organisationId]
	);
	const [members] = await getPool().execute<MemberRow[]>(
		`SELECT member.id AS memberId, user.display_name AS displayName
		 FROM organisation_members member
		 JOIN users user ON user.id = member.user_id
		 WHERE member.organisation_id = ?
		   AND member.status = 'active'
		   AND user.status = 'active'
		 ORDER BY user.display_name`,
		[actor.organisationId]
	);
	return {
		...mapOperation(row),
		submissionNote: row.submissionNote,
		decisionNote: row.decisionNote,
		assignments: assignments.map((assignment) => ({
			...assignment,
			assignedAt: iso(assignment.assignedAt)!,
			endedAt: iso(assignment.endedAt)
		})),
		events: events.map((event) => ({ ...event, occurredAt: iso(event.occurredAt)! })),
		members: members.map((member) => ({ memberId: Number(member.memberId), displayName: member.displayName }))
	};
}

async function lockPending(
	connection: PoolConnection,
	actor: EvidenceActor,
	requestPublicId: string
): Promise<LockedRow> {
	const [rows] = await connection.execute<LockedRow[]>(
		`SELECT request.work_item_id AS workItemId,
		        request.status AS requestStatus,
		        item.status AS workStatus
		 FROM workflow_requests request
		 JOIN work_items item
		   ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 WHERE request.organisation_id = ? AND request.public_id = ?
		 LIMIT 1 FOR UPDATE`,
		[actor.organisationId, requestPublicId]
	);
	const row = rows[0];
	if (!row) throw new WorkflowOperationsValidationError('Workflow operation was not found.');
	if (row.requestStatus !== 'pending') {
		throw new WorkflowOperationsValidationError('Only a pending workflow can be operationally changed.');
	}
	return row;
}

async function event(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		workItemId: number;
		eventType: string;
		fromStatus: string | null;
		toStatus: string | null;
		reason: string | null;
		metadata?: Record<string, unknown>;
	}
): Promise<void> {
	await connection.execute(
		`INSERT INTO work_item_events
			(work_item_id, work_item_owner_organisation_id, event_public_id, event_type,
			 from_status, to_status, acting_organisation_id, actor_member_id,
			 correlation_id, reason, event_metadata)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			input.workItemId,
			input.actor.organisationId,
			randomUUID(),
			input.eventType,
			input.fromStatus,
			input.toStatus,
			input.actor.organisationId,
			input.actor.memberId,
			randomUUID(),
			input.reason,
			input.metadata ? JSON.stringify(input.metadata) : null
		]
	);
}

export async function setWorkflowPriority(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	priority: WorkflowOperation['priority'];
	reason?: string | null;
}): Promise<void> {
	await requireManage(input.actor);
	if (!['low', 'normal', 'high', 'urgent', 'critical'].includes(input.priority)) {
		throw new WorkflowOperationsValidationError('Invalid workflow priority.');
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const locked = await lockPending(connection, input.actor, input.requestPublicId);
		await connection.execute(
			`UPDATE work_items SET priority = ? WHERE id = ? AND owning_organisation_id = ?`,
			[input.priority, locked.workItemId, input.actor.organisationId]
		);
		await event(connection, {
			actor: input.actor,
			workItemId: locked.workItemId,
			eventType: 'workflow_priority_changed',
			fromStatus: locked.workStatus,
			toStatus: locked.workStatus,
			reason: input.reason?.trim() || null,
			metadata: { priority: input.priority }
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.operation.priority_changed',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: { priority: input.priority },
			eventMetadata: { mutation: 'workflow-operation-priority' }
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function setWorkflowWorkStatus(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	status: 'open' | 'in_progress' | 'blocked';
	reason?: string | null;
}): Promise<void> {
	await requireManage(input.actor);
	if (!['open', 'in_progress', 'blocked'].includes(input.status)) {
		throw new WorkflowOperationsValidationError('Invalid operational status.');
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const locked = await lockPending(connection, input.actor, input.requestPublicId);
		if (input.status === 'open') {
			await connection.execute(
				`UPDATE work_items SET status = 'open', started_at = NULL
				 WHERE id = ? AND owning_organisation_id = ?`,
				[locked.workItemId, input.actor.organisationId]
			);
		} else {
			await connection.execute(
				`UPDATE work_items SET status = ?, started_at = COALESCE(started_at, CURRENT_TIMESTAMP(6))
				 WHERE id = ? AND owning_organisation_id = ?`,
				[input.status, locked.workItemId, input.actor.organisationId]
			);
		}
		await event(connection, {
			actor: input.actor,
			workItemId: locked.workItemId,
			eventType: 'workflow_operational_status',
			fromStatus: locked.workStatus,
			toStatus: input.status,
			reason: input.reason?.trim() || null
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.operation.status_changed',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: { fromStatus: locked.workStatus, toStatus: input.status },
			eventMetadata: { mutation: 'workflow-operation-status' }
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function reassignWorkflowWorkItem(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	memberId: number;
	reason?: string | null;
}): Promise<void> {
	await requireManage(input.actor);
	if (!Number.isInteger(input.memberId) || input.memberId <= 0) {
		throw new WorkflowOperationsValidationError('Select an active member.');
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const locked = await lockPending(connection, input.actor, input.requestPublicId);
		const [members] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM organisation_members
			 WHERE id = ? AND organisation_id = ? AND status = 'active' LIMIT 1`,
			[input.memberId, input.actor.organisationId]
		);
		if (!members[0]) throw new WorkflowOperationsValidationError('The selected member is not active.');
		await connection.execute(
			`UPDATE work_item_assignments
			 SET ended_by_member_id = ?, ended_at = CURRENT_TIMESTAMP(6)
			 WHERE work_item_id = ? AND work_item_owner_organisation_id = ? AND ended_at IS NULL`,
			[input.actor.memberId, locked.workItemId, input.actor.organisationId]
		);
		await connection.execute(
			`INSERT INTO work_item_assignments
				(work_item_id, work_item_owner_organisation_id, assignment_scope,
				 assigned_organisation_id, assigned_member_id, assigned_team_id,
				 assigned_by_member_id, assignment_note)
			 VALUES (?, ?, 'member', ?, ?, NULL, ?, ?)`,
			[
				locked.workItemId,
				input.actor.organisationId,
				input.actor.organisationId,
				input.memberId,
				input.actor.memberId,
				input.reason?.trim() || 'Workflow operational reassignment'
			]
		);
		await event(connection, {
			actor: input.actor,
			workItemId: locked.workItemId,
			eventType: 'workflow_reassigned',
			fromStatus: locked.workStatus,
			toStatus: locked.workStatus,
			reason: input.reason?.trim() || null,
			metadata: { assignedMemberId: input.memberId }
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.operation.reassigned',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: { assignedMemberId: input.memberId },
			eventMetadata: { mutation: 'workflow-operation-reassign' }
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function cancelWorkflowOperation(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	reason: string;
}): Promise<void> {
	await requireManage(input.actor);
	const reason = input.reason.trim();
	if (!reason) throw new WorkflowOperationsValidationError('A cancellation reason is required.');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const locked = await lockPending(connection, input.actor, input.requestPublicId);
		await connection.execute(
			`UPDATE workflow_requests
			 SET status = 'withdrawn', active_key = NULL, decided_by_member_id = ?,
			     decided_at = CURRENT_TIMESTAMP(6), decision_note = ?
			 WHERE organisation_id = ? AND public_id = ? AND status = 'pending'`,
			[input.actor.memberId, reason, input.actor.organisationId, input.requestPublicId]
		);
		await connection.execute(
			`UPDATE work_items
			 SET status = 'cancelled', cancelled_by_member_id = ?, cancelled_at = CURRENT_TIMESTAMP(6),
			     completion_note = ?
			 WHERE id = ? AND owning_organisation_id = ?`,
			[input.actor.memberId, reason, locked.workItemId, input.actor.organisationId]
		);
		await connection.execute(
			`UPDATE work_item_assignments
			 SET ended_by_member_id = ?, ended_at = CURRENT_TIMESTAMP(6)
			 WHERE work_item_id = ? AND work_item_owner_organisation_id = ? AND ended_at IS NULL`,
			[input.actor.memberId, locked.workItemId, input.actor.organisationId]
		);
		await event(connection, {
			actor: input.actor,
			workItemId: locked.workItemId,
			eventType: 'workflow_cancelled',
			fromStatus: locked.workStatus,
			toStatus: 'cancelled',
			reason
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.operation.cancelled',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: { fromStatus: 'pending', toStatus: 'withdrawn', reason },
			eventMetadata: { mutation: 'workflow-operation-cancel' }
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
