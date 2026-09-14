import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { decidePermissions, hasPermission } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';

export class WorkflowValidationError extends Error {}
export class WorkflowAccessError extends Error {}

export type WorkflowDecision = 'approved' | 'returned' | 'rejected';

export type PendingWorkflowTask = {
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
	requiredPermissionKey: string;
	title: string;
	description: string | null;
	priority: 'low' | 'normal' | 'high' | 'urgent' | 'critical';
	workStatus: 'open' | 'in_progress' | 'blocked';
	submissionNote: string | null;
	submittedAt: Date | string;
	dueAt: Date | string | null;
};

type ExistingRequestRow = RowDataPacket & { publicId: string };
type WorkflowTaskRow = RowDataPacket & PendingWorkflowTask;
type WorkflowRequestLockRow = RowDataPacket & {
	requestPublicId: string;
	workItemId: string | number;
	workItemPublicId: string;
	workflowKey: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
	contextPublicId: string;
	fromState: string;
	toState: string;
	transitionLabel: string;
	requiredPermissionKey: string;
	status: string;
};

function activeKey(input: {
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
	workflowKey: string;
	toState: string;
}): string {
	return [
		input.sourceDomain,
		input.sourceType,
		input.sourcePublicId,
		input.workflowKey,
		input.toState
	]
		.join(':')
		.slice(0, 255);
}

function normalizeNote(value: string | null | undefined): string | null {
	const normalized = value?.trim() ?? '';
	return normalized ? normalized.slice(0, 10000) : null;
}

async function insertWorkItem(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		publicId: string;
		sourceDomain: string;
		sourceType: string;
		sourcePublicId: string;
		title: string;
		description: string | null;
		dueAt: Date | null;
	}
): Promise<number> {
	const [result] = await connection.execute<ResultSetHeader>(
		`INSERT INTO work_items
			(owning_organisation_id, public_id, project_id, work_item_kind, source_domain,
			 source_type, source_public_id, title, description, priority, status, due_at,
			 created_by_member_id)
		 VALUES (?, ?, NULL, 'approval', ?, ?, ?, ?, ?, 'normal', 'open', ?, ?)`,
		[
			input.actor.organisationId,
			input.publicId,
			input.sourceDomain,
			input.sourceType,
			input.sourcePublicId,
			input.title,
			input.description,
			input.dueAt,
			input.actor.memberId
		]
	);
	return result.insertId;
}

export async function submitLifecycleWorkflow(input: {
	actor: EvidenceActor;
	workflowKey: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
	contextPublicId: string;
	fromState: string;
	toState: string;
	transitionLabel: string;
	requiredPermissionKey: string;
	note?: string | null;
	dueAt?: Date | null;
}): Promise<{ requestPublicId: string; workItemPublicId: string }> {
	if (!input.workflowKey.trim()) throw new WorkflowValidationError('Workflow key is required.');
	if (!input.requiredPermissionKey.trim()) {
		throw new WorkflowValidationError('Workflow approval permission is required.');
	}
	const pool = getPool();
	const connection = await pool.getConnection();
	const requestPublicId = randomUUID();
	const workItemPublicId = randomUUID();
	const requestActiveKey = activeKey(input);
	const note = normalizeNote(input.note);
	try {
		await connection.beginTransaction();
		const [existing] = await connection.execute<ExistingRequestRow[]>(
			`SELECT public_id AS publicId
			 FROM workflow_requests
			 WHERE organisation_id = ? AND active_key = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, requestActiveKey]
		);
		if (existing[0]) {
			throw new WorkflowValidationError(
				'A workflow request is already pending for this transition.'
			);
		}

		const workItemId = await insertWorkItem(connection, {
			actor: input.actor,
			publicId: workItemPublicId,
			sourceDomain: input.sourceDomain,
			sourceType: input.sourceType,
			sourcePublicId: input.sourcePublicId,
			title: input.transitionLabel,
			description: note,
			dueAt: input.dueAt ?? null
		});

		await connection.execute(
			`INSERT INTO work_item_assignments
				(work_item_id, work_item_owner_organisation_id, assignment_scope,
				 assigned_organisation_id, assigned_member_id, assigned_team_id,
				 assigned_by_member_id, assignment_note)
			 VALUES (?, ?, 'organisation', ?, NULL, NULL, ?, ?)`,
			[
				workItemId,
				input.actor.organisationId,
				input.actor.organisationId,
				input.actor.memberId,
				`Governed workflow gate: ${input.requiredPermissionKey}`
			]
		);

		await connection.execute(
			`INSERT INTO workflow_requests
				(organisation_id, public_id, workflow_key, source_domain, source_type,
				 source_public_id, context_public_id, lifecycle_from_state, lifecycle_to_state,
				 transition_label, required_permission_key, status, active_key, work_item_id,
				 submitted_by_member_id, submission_note, due_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				requestPublicId,
				input.workflowKey,
				input.sourceDomain,
				input.sourceType,
				input.sourcePublicId,
				input.contextPublicId,
				input.fromState,
				input.toState,
				input.transitionLabel,
				input.requiredPermissionKey,
				requestActiveKey,
				workItemId,
				input.actor.memberId,
				note,
				input.dueAt ?? null
			]
		);

		await connection.execute(
			`INSERT INTO work_item_events
				(work_item_id, work_item_owner_organisation_id, event_public_id, event_type,
				 from_status, to_status, acting_organisation_id, actor_member_id,
				 correlation_id, reason, event_metadata)
			 VALUES (?, ?, ?, 'workflow_requested', NULL, 'open', ?, ?, ?, ?, ?)`,
			[
				workItemId,
				input.actor.organisationId,
				randomUUID(),
				input.actor.organisationId,
				input.actor.memberId,
				randomUUID(),
				note,
				JSON.stringify({
					workflowKey: input.workflowKey,
					fromState: input.fromState,
					toState: input.toState,
					requiredPermissionKey: input.requiredPermissionKey
				})
			]
		);

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.requested',
			subjectType: 'workflow_request',
			subjectPublicId: requestPublicId,
			changeSummary: {
				workflowKey: input.workflowKey,
				sourceDomain: input.sourceDomain,
				sourceType: input.sourceType,
				sourcePublicId: input.sourcePublicId,
				fromState: input.fromState,
				toState: input.toState
			},
			eventMetadata: { mutation: 'workflow-submit' }
		});

		await connection.commit();
		return { requestPublicId, workItemPublicId };
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

async function taskRows(
	organisationId: string,
	requestPublicId?: string
): Promise<WorkflowTaskRow[]> {
	const params: string[] = [organisationId];
	let requestFilter = '';
	if (requestPublicId) {
		requestFilter = ' AND request.public_id = ?';
		params.push(requestPublicId);
	}
	const [rows] = await getPool().execute<WorkflowTaskRow[]>(
		`SELECT request.public_id AS requestPublicId,
		        item.public_id AS workItemPublicId,
		        request.workflow_key AS workflowKey,
		        request.source_domain AS sourceDomain,
		        request.source_type AS sourceType,
		        request.source_public_id AS sourcePublicId,
		        request.context_public_id AS contextPublicId,
		        request.lifecycle_from_state AS fromState,
		        request.lifecycle_to_state AS toState,
		        request.transition_label AS transitionLabel,
		        request.required_permission_key AS requiredPermissionKey,
		        item.title,
		        item.description,
		        item.priority,
		        item.status AS workStatus,
		        request.submission_note AS submissionNote,
		        request.submitted_at AS submittedAt,
		        request.due_at AS dueAt
		 FROM workflow_requests request
		 JOIN work_items item
		   ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 WHERE request.organisation_id = ?
		   AND request.status = 'pending'
		   ${requestFilter}
		 ORDER BY CASE item.priority
		            WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
		            WHEN 'normal' THEN 3 ELSE 4 END,
		          COALESCE(request.due_at, '9999-12-31'), request.submitted_at`,
		params
	);
	return rows;
}

export async function listPendingWorkflowTasks(input: {
	organisationId: string;
	memberId: string;
}): Promise<PendingWorkflowTask[]> {
	const rows = await taskRows(input.organisationId);
	const permissionKeys = [...new Set(rows.map((row) => row.requiredPermissionKey))];
	const decisions = await decidePermissions({
		organisationId: input.organisationId,
		memberId: input.memberId,
		permissionKeys
	});
	return rows.filter((row) => decisions.get(row.requiredPermissionKey)?.allowed === true);
}

export async function getPendingWorkflowTask(input: {
	organisationId: string;
	memberId: string;
	requestPublicId: string;
}): Promise<PendingWorkflowTask> {
	const rows = await taskRows(input.organisationId, input.requestPublicId);
	const task = rows[0];
	if (!task) throw new WorkflowValidationError('Workflow task is no longer pending.');
	const allowed = await hasPermission({
		organisationId: input.organisationId,
		memberId: input.memberId,
		permissionKey: task.requiredPermissionKey
	});
	if (!allowed)
		throw new WorkflowAccessError('You are not authorised to decide this workflow task.');
	return task;
}

export async function finaliseWorkflowRequest(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	decision: WorkflowDecision;
	note?: string | null;
}): Promise<void> {
	const note = normalizeNote(input.note);
	if (input.decision !== 'approved' && !note) {
		throw new WorkflowValidationError('A reason is required when returning or rejecting work.');
	}
	const pool = getPool();
	const connection = await pool.getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.execute<WorkflowRequestLockRow[]>(
			`SELECT request.public_id AS requestPublicId,
			        request.work_item_id AS workItemId,
			        item.public_id AS workItemPublicId,
			        request.workflow_key AS workflowKey,
			        request.source_domain AS sourceDomain,
			        request.source_type AS sourceType,
			        request.source_public_id AS sourcePublicId,
			        request.context_public_id AS contextPublicId,
			        request.lifecycle_from_state AS fromState,
			        request.lifecycle_to_state AS toState,
			        request.transition_label AS transitionLabel,
			        request.required_permission_key AS requiredPermissionKey,
			        request.status
			 FROM workflow_requests request
			 JOIN work_items item
			   ON item.id = request.work_item_id
			  AND item.owning_organisation_id = request.organisation_id
			 WHERE request.organisation_id = ? AND request.public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.requestPublicId]
		);
		const request = rows[0];
		if (!request) throw new WorkflowValidationError('Workflow request was not found.');
		if (request.status !== 'pending')
			throw new WorkflowValidationError('Workflow request has already been decided.');

		const allowed = await hasPermission({
			organisationId: input.actor.organisationId,
			memberId: input.actor.memberId,
			permissionKey: request.requiredPermissionKey
		});
		if (!allowed)
			throw new WorkflowAccessError('You are not authorised to decide this workflow task.');

		await connection.execute(
			`UPDATE workflow_requests
			 SET status = ?, active_key = NULL, decided_by_member_id = ?, decided_at = CURRENT_TIMESTAMP(6), decision_note = ?
			 WHERE organisation_id = ? AND public_id = ? AND status = 'pending'`,
			[
				input.decision,
				input.actor.memberId,
				note,
				input.actor.organisationId,
				input.requestPublicId
			]
		);

		await connection.execute(
			`UPDATE work_items
			 SET status = 'completed', completed_by_member_id = ?, completed_at = CURRENT_TIMESTAMP(6), completion_note = ?
			 WHERE id = ? AND owning_organisation_id = ?`,
			[input.actor.memberId, note ?? input.decision, request.workItemId, input.actor.organisationId]
		);
		await connection.execute(
			`UPDATE work_item_assignments
			 SET ended_by_member_id = ?, ended_at = CURRENT_TIMESTAMP(6)
			 WHERE work_item_id = ? AND work_item_owner_organisation_id = ? AND ended_at IS NULL`,
			[input.actor.memberId, request.workItemId, input.actor.organisationId]
		);
		await connection.execute(
			`INSERT INTO work_item_decisions
				(work_item_id, work_item_owner_organisation_id, decision, decided_by_member_id, decision_note)
			 VALUES (?, ?, ?, ?, ?)`,
			[request.workItemId, input.actor.organisationId, input.decision, input.actor.memberId, note]
		);
		await connection.execute(
			`INSERT INTO work_item_events
				(work_item_id, work_item_owner_organisation_id, event_public_id, event_type,
				 from_status, to_status, acting_organisation_id, actor_member_id,
				 correlation_id, reason, event_metadata)
			 VALUES (?, ?, ?, 'workflow_decided', 'open', 'completed', ?, ?, ?, ?, ?)`,
			[
				request.workItemId,
				input.actor.organisationId,
				randomUUID(),
				input.actor.organisationId,
				input.actor.memberId,
				randomUUID(),
				note,
				JSON.stringify({ decision: input.decision, workflowKey: request.workflowKey })
			]
		);

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.decided',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: {
				decision: input.decision,
				workflowKey: request.workflowKey,
				sourceDomain: request.sourceDomain,
				sourceType: request.sourceType,
				sourcePublicId: request.sourcePublicId,
				fromState: request.fromState,
				toState: request.toState
			},
			eventMetadata: { mutation: 'workflow-decision' }
		});

		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
