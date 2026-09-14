import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { hasPermission } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';
import {
	workflowNode,
	workflowStartNode,
	type WorkflowNode,
	type WorkflowNodeType,
	type WorkflowTemplate
} from './workflow-kernel';
import { loadPublishedWorkflowTemplate } from './workflow-registry-service';

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
	nodeKey: string | null;
	nodeType: WorkflowNodeType | null;
	stepNumber: number;
	workflowState: 'running' | 'completed' | 'terminated' | 'aborted';
	assignmentScope: 'organisation' | 'team' | 'member';
	assignedMemberId: string | null;
	assignedTeamId: string | null;
	willCompleteOnApprove: boolean;
};

export type ActiveWorkflowRequest = PendingWorkflowTask & {
	actionableByMember: boolean;
	assigneeLabel: string;
};

type AssignmentTarget = {
	assignmentScope: 'organisation' | 'team' | 'member';
	assignedMemberId: string | null;
	assignedTeamId: string | null;
	requiredPermissionKey: string;
};

type ExistingRequestRow = RowDataPacket & { publicId: string };
type WorkflowTaskRow = RowDataPacket &
	Omit<PendingWorkflowTask, 'willCompleteOnApprove' | 'stepNumber'> & {
		stepNumber: number | string;
		workflowDefinition: unknown;
	};
type WorkflowRequestLockRow = RowDataPacket &
	AssignmentTarget & {
		requestId: string | number;
		requestPublicId: string;
		workItemId: string | number;
		workItemPublicId: string;
		workflowKey: string;
		workflowDefinition: unknown;
		currentNodeKey: string | null;
		currentNodeType: WorkflowNodeType | null;
		stepNumber: number | string;
		workflowState: string;
		sourceDomain: string;
		sourceType: string;
		sourcePublicId: string;
		contextPublicId: string;
		fromState: string;
		toState: string;
		transitionLabel: string;
		status: string;
		workStatus: string;
	};

const HUMAN_NODE_TYPES = new Set<WorkflowNodeType>(['activity', 'ad_hoc_activity', 'checkpoint']);
const AUTO_NODE_TYPES = new Set<WorkflowNodeType>(['start', 'notification']);

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

function jsonValue<T>(value: unknown, fallback: T): T {
	if (value === null || value === undefined) return fallback;
	if (typeof value === 'string') {
		try {
			return JSON.parse(value) as T;
		} catch {
			return fallback;
		}
	}
	return value as T;
}

function workflowDefinition(value: unknown): WorkflowTemplate | null {
	return jsonValue<WorkflowTemplate | null>(value, null);
}

function workItemKind(node: WorkflowNode): 'approval' | 'task' | 'review' | 'decision' {
	if (node.type === 'checkpoint') return 'approval';
	if (node.responsibleRoleKey === 'reviewer') return 'review';
	return 'task';
}

function nodeDueAt(node: WorkflowNode, fallback: Date | null): Date | null {
	if (fallback) return fallback;
	if (!node.deadline || node.deadline.relativeTo !== 'node_start') return null;
	return new Date(Date.now() + node.deadline.minutes * 60_000);
}

function successors(template: WorkflowTemplate, nodeKey: string, event?: string) {
	if (event) {
		const eventRoutes = template.links.filter(
			(link) => link.from === nodeKey && link.event === event
		);
		if (eventRoutes.length > 0) return eventRoutes;
	}
	return template.links.filter((link) => link.from === nodeKey && link.event === undefined);
}

function nextExecutableNode(
	template: WorkflowTemplate,
	fromNodeKey: string,
	event?: string
): { node: WorkflowNode; automaticNodes: WorkflowNode[] } {
	const automaticNodes: WorkflowNode[] = [];
	let currentKey = fromNodeKey;
	let currentEvent = event;
	const visited = new Set<string>();
	while (true) {
		if (visited.has(currentKey)) {
			throw new WorkflowValidationError(`Workflow routing loop detected at ${currentKey}.`);
		}
		visited.add(currentKey);
		const routes = successors(template, currentKey, currentEvent);
		currentEvent = undefined;
		if (routes.length !== 1) {
			throw new WorkflowValidationError(
				`Workflow node ${currentKey} must resolve to exactly one runtime route; found ${routes.length}.`
			);
		}
		const next = workflowNode(template, routes[0].to);
		if (!next) throw new WorkflowValidationError(`Workflow node ${routes[0].to} was not found.`);
		if (next.type === 'end' || HUMAN_NODE_TYPES.has(next.type)) {
			return { node: next, automaticNodes };
		}
		if (!AUTO_NODE_TYPES.has(next.type)) {
			throw new WorkflowValidationError(
				`Workflow node type ${next.type} is authored but does not yet have a safe runtime executor.`
			);
		}
		automaticNodes.push(next);
		currentKey = next.key;
	}
}

function firstExecutableNode(template: WorkflowTemplate) {
	return nextExecutableNode(template, workflowStartNode(template).key);
}

function willCompleteOnApprove(row: WorkflowTaskRow): boolean {
	const template = workflowDefinition(row.workflowDefinition);
	if (!template || !row.nodeKey) return true;
	try {
		return nextExecutableNode(template, row.nodeKey, 'approve').node.type === 'end';
	} catch {
		return false;
	}
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
		kind: 'approval' | 'task' | 'review' | 'decision';
	}
): Promise<number> {
	const [result] = await connection.execute<ResultSetHeader>(
		`INSERT INTO work_items
			(owning_organisation_id, public_id, project_id, work_item_kind, source_domain,
			 source_type, source_public_id, title, description, priority, status, due_at,
			 created_by_member_id)
		 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, 'normal', 'open', ?, ?)`,
		[
			input.actor.organisationId,
			input.publicId,
			input.kind,
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

async function resolveWorkItemAssignment(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		node: WorkflowNode;
		requiredPermissionKey: string;
	}
): Promise<{
	assignmentScope: 'organisation' | 'team' | 'member';
	assignedMemberId: string | null;
	assignedTeamId: string | null;
	assignmentNote: string;
}> {
	const participants = [...(input.node.participants ?? [])];
	if (participants.length > 1) {
		throw new WorkflowValidationError(
			`Workflow node ${input.node.key} defines multiple participants, but the current runtime requires one accountable assignment target.`
		);
	}
	const participant = participants[0];
	if (participant?.participantType === 'actor') {
		return {
			assignmentScope: 'member',
			assignedMemberId: input.actor.memberId,
			assignedTeamId: null,
			assignmentNote: `Workflow node ${input.node.key}: source actor`
		};
	}
	if (participant?.participantType === 'member') {
		const [rows] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT id FROM organisation_members
			 WHERE organisation_id = ? AND public_id = ? AND status IN ('active', 'suspended') LIMIT 1`,
			[input.actor.organisationId, participant.participantKey]
		);
		if (!rows[0]) {
			throw new WorkflowValidationError(
				`Workflow node ${input.node.key} member participant ${participant.participantKey} is not assignable in this organisation.`
			);
		}
		return {
			assignmentScope: 'member',
			assignedMemberId: String(rows[0].id),
			assignedTeamId: null,
			assignmentNote: `Workflow node ${input.node.key}: member ${participant.participantKey}`
		};
	}
	if (participant?.participantType === 'team') {
		const [rows] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT id FROM teams
			 WHERE organisation_id = ? AND public_id = ? AND is_active = 1 LIMIT 1`,
			[input.actor.organisationId, participant.participantKey]
		);
		if (!rows[0]) {
			throw new WorkflowValidationError(
				`Workflow node ${input.node.key} team participant ${participant.participantKey} is not active in this organisation.`
			);
		}
		return {
			assignmentScope: 'team',
			assignedMemberId: null,
			assignedTeamId: String(rows[0].id),
			assignmentNote: `Workflow node ${input.node.key}: team ${participant.participantKey}`
		};
	}
	if (participant) {
		throw new WorkflowValidationError(
			`Workflow node ${input.node.key} participant type ${participant.participantType} does not yet have a safe runtime resolver.`
		);
	}
	if (input.node.responsibleRoleKey === 'owner') {
		return {
			assignmentScope: 'member',
			assignedMemberId: input.actor.memberId,
			assignedTeamId: null,
			assignmentNote: `Workflow node ${input.node.key}: source actor`
		};
	}
	return {
		assignmentScope: 'organisation',
		assignedMemberId: null,
		assignedTeamId: null,
		assignmentNote: `Workflow node ${input.node.key}: governed gate ${input.requiredPermissionKey}`
	};
}

async function assignWorkItem(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		workItemId: number;
		node: WorkflowNode;
		requiredPermissionKey: string;
	}
): Promise<void> {
	const assignment = await resolveWorkItemAssignment(connection, input);
	await connection.execute(
		`INSERT INTO work_item_assignments
			(work_item_id, work_item_owner_organisation_id, assignment_scope,
			 assigned_organisation_id, assigned_member_id, assigned_team_id,
			 assigned_by_member_id, assignment_note)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			input.workItemId,
			input.actor.organisationId,
			assignment.assignmentScope,
			input.actor.organisationId,
			assignment.assignedMemberId,
			assignment.assignedTeamId,
			input.actor.memberId,
			assignment.assignmentNote
		]
	);
}

async function insertStep(
	connection: PoolConnection,
	input: {
		organisationId: string;
		requestId: number;
		stepNumber: number;
		node: WorkflowNode;
		workItemId: number | null;
		status?: 'open' | 'completed' | 'skipped' | 'failed';
		outcome?: 'approved' | 'returned' | 'rejected' | 'completed' | 'automatic' | null;
		completedByMemberId?: string | null;
		note?: string | null;
	}
): Promise<void> {
	const status = input.status ?? 'open';
	await connection.execute(
		`INSERT INTO workflow_request_steps
			(organisation_id, workflow_request_id, step_number, node_key, node_type, work_item_id,
			 step_status, outcome, completed_by_member_id, completed_at, completion_note)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ${status === 'open' ? 'NULL' : 'CURRENT_TIMESTAMP(6)'}, ?)`,
		[
			input.organisationId,
			input.requestId,
			input.stepNumber,
			input.node.key,
			input.node.type,
			input.workItemId,
			status,
			input.outcome ?? null,
			status === 'open' ? null : (input.completedByMemberId ?? null),
			input.note ?? null
		]
	);
}

async function appendWorkEvent(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		workItemId: number;
		eventType: string;
		fromStatus: string | null;
		toStatus: string | null;
		reason: string | null;
		metadata: Record<string, unknown>;
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
			JSON.stringify(input.metadata)
		]
	);
}

async function createHumanStep(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		requestId: number;
		requestPublicId: string;
		stepNumber: number;
		node: WorkflowNode;
		sourceDomain: string;
		sourceType: string;
		sourcePublicId: string;
		description: string | null;
		dueAt: Date | null;
		requiredPermissionKey: string;
		workflowKey: string;
	}
): Promise<{ workItemId: number; workItemPublicId: string }> {
	const workItemPublicId = randomUUID();
	const workItemId = await insertWorkItem(connection, {
		actor: input.actor,
		publicId: workItemPublicId,
		sourceDomain: input.sourceDomain,
		sourceType: input.sourceType,
		sourcePublicId: input.sourcePublicId,
		title: input.node.label,
		description: input.description,
		dueAt: nodeDueAt(input.node, input.dueAt),
		kind: workItemKind(input.node)
	});
	await assignWorkItem(connection, {
		actor: input.actor,
		workItemId,
		node: input.node,
		requiredPermissionKey: input.requiredPermissionKey
	});
	await insertStep(connection, {
		organisationId: input.actor.organisationId,
		requestId: input.requestId,
		stepNumber: input.stepNumber,
		node: input.node,
		workItemId
	});
	await appendWorkEvent(connection, {
		actor: input.actor,
		workItemId,
		eventType: 'workflow_step_opened',
		fromStatus: null,
		toStatus: 'open',
		reason: input.description,
		metadata: {
			requestPublicId: input.requestPublicId,
			workflowKey: input.workflowKey,
			nodeKey: input.node.key,
			stepNumber: input.stepNumber
		}
	});
	return { workItemId, workItemPublicId };
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
	fallbackTemplate?: WorkflowTemplate | null;
}): Promise<{ requestPublicId: string; workItemPublicId: string }> {
	if (!input.workflowKey.trim()) throw new WorkflowValidationError('Workflow key is required.');
	if (!input.requiredPermissionKey.trim()) {
		throw new WorkflowValidationError('Workflow approval permission is required.');
	}
	const template =
		(await loadPublishedWorkflowTemplate({
			organisationId: input.actor.organisationId,
			templateKey: input.workflowKey
		})) ??
		input.fallbackTemplate ??
		null;
	if (!template) {
		throw new WorkflowValidationError(
			`Published workflow template ${input.workflowKey} is not available for execution.`
		);
	}
	const first = firstExecutableNode(template);
	if (first.node.type === 'end') {
		throw new WorkflowValidationError('Workflow must contain at least one executable human step.');
	}

	const connection = await getPool().getConnection();
	const requestPublicId = randomUUID();
	const requestActiveKey = activeKey(input);
	const note = normalizeNote(input.note);
	try {
		await connection.beginTransaction();
		const [existing] = await connection.execute<ExistingRequestRow[]>(
			`SELECT public_id AS publicId FROM workflow_requests
			 WHERE organisation_id = ? AND active_key = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, requestActiveKey]
		);
		if (existing[0]) {
			throw new WorkflowValidationError(
				'A workflow request is already pending for this transition.'
			);
		}

		const workItemPublicId = randomUUID();
		const workItemId = await insertWorkItem(connection, {
			actor: input.actor,
			publicId: workItemPublicId,
			sourceDomain: input.sourceDomain,
			sourceType: input.sourceType,
			sourcePublicId: input.sourcePublicId,
			title: first.node.label,
			description: note,
			dueAt: nodeDueAt(first.node, input.dueAt ?? null),
			kind: workItemKind(first.node)
		});
		await assignWorkItem(connection, {
			actor: input.actor,
			workItemId,
			node: first.node,
			requiredPermissionKey: input.requiredPermissionKey
		});

		const [requestInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_requests
				(organisation_id, public_id, workflow_key, workflow_definition, current_node_key,
				 current_node_type, workflow_state, step_number, source_domain, source_type,
				 source_public_id, context_public_id, lifecycle_from_state, lifecycle_to_state,
				 transition_label, required_permission_key, status, active_key, work_item_id,
				 submitted_by_member_id, submission_note, due_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'running', 1, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				requestPublicId,
				input.workflowKey,
				JSON.stringify(template),
				first.node.key,
				first.node.type,
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
		const requestId = requestInsert.insertId;
		let stepNumber = 0;
		for (const automaticNode of first.automaticNodes) {
			stepNumber += 1;
			await insertStep(connection, {
				organisationId: input.actor.organisationId,
				requestId,
				stepNumber,
				node: automaticNode,
				workItemId: null,
				status: 'completed',
				outcome: 'automatic',
				completedByMemberId: input.actor.memberId
			});
		}
		stepNumber += 1;
		await insertStep(connection, {
			organisationId: input.actor.organisationId,
			requestId,
			stepNumber,
			node: first.node,
			workItemId
		});
		if (stepNumber !== 1) {
			await connection.execute(
				`UPDATE workflow_requests SET step_number = ? WHERE organisation_id = ? AND id = ?`,
				[stepNumber, input.actor.organisationId, requestId]
			);
		}
		await appendWorkEvent(connection, {
			actor: input.actor,
			workItemId,
			eventType: 'workflow_requested',
			fromStatus: null,
			toStatus: 'open',
			reason: note,
			metadata: {
				requestPublicId,
				workflowKey: input.workflowKey,
				nodeKey: first.node.key,
				fromState: input.fromState,
				toState: input.toState,
				requiredPermissionKey: input.requiredPermissionKey
			}
		});
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
				toState: input.toState,
				currentNodeKey: first.node.key
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
		        request.workflow_definition AS workflowDefinition,
		        request.current_node_key AS nodeKey,
		        request.current_node_type AS nodeType,
		        request.step_number AS stepNumber,
		        request.workflow_state AS workflowState,
		        request.source_domain AS sourceDomain,
		        request.source_type AS sourceType,
		        request.source_public_id AS sourcePublicId,
		        request.context_public_id AS contextPublicId,
		        request.lifecycle_from_state AS fromState,
		        request.lifecycle_to_state AS toState,
		        request.transition_label AS transitionLabel,
		        request.required_permission_key AS requiredPermissionKey,
		        item.title, item.description, item.priority, item.status AS workStatus,
		        request.submission_note AS submissionNote, request.submitted_at AS submittedAt,
		        item.due_at AS dueAt,
		        assignment.assignment_scope AS assignmentScope,
		        CAST(assignment.assigned_member_id AS CHAR) AS assignedMemberId,
		        CAST(assignment.assigned_team_id AS CHAR) AS assignedTeamId
		 FROM workflow_requests request
		 JOIN work_items item ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 JOIN work_item_assignments assignment ON assignment.work_item_id = item.id
		  AND assignment.work_item_owner_organisation_id = request.organisation_id
		  AND assignment.ended_at IS NULL
		 WHERE request.organisation_id = ? AND request.status = 'pending' ${requestFilter}
		 ORDER BY CASE item.priority
		            WHEN 'critical' THEN 0 WHEN 'urgent' THEN 1 WHEN 'high' THEN 2
		            WHEN 'normal' THEN 3 ELSE 4 END,
		          COALESCE(item.due_at, '9999-12-31'), request.submitted_at`,
		params
	);
	return rows;
}

function publicTask(row: WorkflowTaskRow): PendingWorkflowTask {
	return {
		...row,
		stepNumber: Number(row.stepNumber),
		willCompleteOnApprove: willCompleteOnApprove(row)
	};
}

async function sourceTaskRows(input: {
	organisationId: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
}): Promise<WorkflowTaskRow[]> {
	const [rows] = await getPool().execute<WorkflowTaskRow[]>(
		`SELECT request.public_id AS requestPublicId,
		        item.public_id AS workItemPublicId,
		        request.workflow_key AS workflowKey,
		        request.workflow_definition AS workflowDefinition,
		        request.current_node_key AS nodeKey,
		        request.current_node_type AS nodeType,
		        request.step_number AS stepNumber,
		        request.workflow_state AS workflowState,
		        request.source_domain AS sourceDomain,
		        request.source_type AS sourceType,
		        request.source_public_id AS sourcePublicId,
		        request.context_public_id AS contextPublicId,
		        request.lifecycle_from_state AS fromState,
		        request.lifecycle_to_state AS toState,
		        request.transition_label AS transitionLabel,
		        request.required_permission_key AS requiredPermissionKey,
		        item.title, item.description, item.priority, item.status AS workStatus,
		        request.submission_note AS submissionNote, request.submitted_at AS submittedAt,
		        item.due_at AS dueAt,
		        assignment.assignment_scope AS assignmentScope,
		        CAST(assignment.assigned_member_id AS CHAR) AS assignedMemberId,
		        CAST(assignment.assigned_team_id AS CHAR) AS assignedTeamId
		 FROM workflow_requests request
		 JOIN work_items item ON item.id = request.work_item_id
		  AND item.owning_organisation_id = request.organisation_id
		 JOIN work_item_assignments assignment ON assignment.work_item_id = item.id
		  AND assignment.work_item_owner_organisation_id = request.organisation_id
		  AND assignment.ended_at IS NULL
		 WHERE request.organisation_id = ? AND request.status = 'pending'
		   AND request.source_domain = ? AND request.source_type = ? AND request.source_public_id = ?
		 ORDER BY request.submitted_at DESC`,
		[input.organisationId, input.sourceDomain, input.sourceType, input.sourcePublicId]
	);
	return rows;
}

async function taskAllowed(
	target: AssignmentTarget,
	organisationId: string,
	memberId: string
): Promise<boolean> {
	if (target.assignmentScope === 'member') return target.assignedMemberId === memberId;
	if (target.assignmentScope === 'team') {
		const [members] = await getPool().execute<RowDataPacket[]>(
			`SELECT 1 FROM team_members
			 WHERE organisation_id = ? AND team_id = ? AND organisation_member_id = ? LIMIT 1`,
			[organisationId, target.assignedTeamId, memberId]
		);
		return members.length > 0;
	}
	return hasPermission({
		organisationId,
		memberId,
		permissionKey: target.requiredPermissionKey
	});
}

export async function listActiveWorkflowRequestsForSource(input: {
	organisationId: string;
	memberId: string;
	sourceDomain: string;
	sourceType: string;
	sourcePublicId: string;
}): Promise<ActiveWorkflowRequest[]> {
	const rows = await sourceTaskRows(input);
	const active: ActiveWorkflowRequest[] = [];
	for (const row of rows) {
		const actionableByMember = await taskAllowed(row, input.organisationId, input.memberId);
		let assigneeLabel = 'Authorised approvers';
		if (row.assignmentScope === 'member') {
			assigneeLabel = row.assignedMemberId === input.memberId ? 'You' : 'Another named member';
		} else if (row.assignmentScope === 'team') {
			assigneeLabel = actionableByMember ? 'Your assigned team' : 'Another assigned team';
		} else if (actionableByMember) {
			assigneeLabel = 'You and other authorised approvers';
		}
		active.push({ ...publicTask(row), actionableByMember, assigneeLabel });
	}
	return active;
}

export async function listPendingWorkflowTasks(input: {
	organisationId: string;
	memberId: string;
}): Promise<PendingWorkflowTask[]> {
	const rows = await taskRows(input.organisationId);
	const allowed: PendingWorkflowTask[] = [];
	for (const row of rows) {
		if (await taskAllowed(row, input.organisationId, input.memberId)) allowed.push(publicTask(row));
	}
	return allowed;
}

export async function getPendingWorkflowTask(input: {
	organisationId: string;
	memberId: string;
	requestPublicId: string;
}): Promise<PendingWorkflowTask> {
	const rows = await taskRows(input.organisationId, input.requestPublicId);
	const task = rows[0];
	if (!task) throw new WorkflowValidationError('Workflow task is no longer pending.');
	if (!(await taskAllowed(task, input.organisationId, input.memberId))) {
		throw new WorkflowAccessError('You are not authorised to act on this workflow step.');
	}
	return publicTask(task);
}

async function completeWorkItem(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		request: WorkflowRequestLockRow;
		decision: WorkflowDecision;
		note: string | null;
	}
): Promise<void> {
	await connection.execute(
		`UPDATE work_items SET status = 'completed', completed_by_member_id = ?,
		 completed_at = CURRENT_TIMESTAMP(6), completion_note = ?
		 WHERE id = ? AND owning_organisation_id = ?`,
		[
			input.actor.memberId,
			input.note ?? input.decision,
			input.request.workItemId,
			input.actor.organisationId
		]
	);
	await connection.execute(
		`UPDATE work_item_assignments SET ended_by_member_id = ?, ended_at = CURRENT_TIMESTAMP(6)
		 WHERE work_item_id = ? AND work_item_owner_organisation_id = ? AND ended_at IS NULL`,
		[input.actor.memberId, input.request.workItemId, input.actor.organisationId]
	);
	await connection.execute(
		`INSERT INTO work_item_decisions
			(work_item_id, work_item_owner_organisation_id, decision, decided_by_member_id, decision_note)
		 VALUES (?, ?, ?, ?, ?)`,
		[
			input.request.workItemId,
			input.actor.organisationId,
			input.decision,
			input.actor.memberId,
			input.note
		]
	);
	await connection.execute(
		`UPDATE workflow_request_steps SET step_status = 'completed', outcome = ?,
		 completed_by_member_id = ?, completed_at = CURRENT_TIMESTAMP(6), completion_note = ?
		 WHERE organisation_id = ? AND workflow_request_id = ? AND step_number = ? AND step_status = 'open'`,
		[
			input.decision,
			input.actor.memberId,
			input.note,
			input.actor.organisationId,
			input.request.requestId,
			input.request.stepNumber
		]
	);
	await appendWorkEvent(connection, {
		actor: input.actor,
		workItemId: Number(input.request.workItemId),
		eventType: 'workflow_step_decided',
		fromStatus: input.request.workStatus,
		toStatus: 'completed',
		reason: input.note,
		metadata: {
			decision: input.decision,
			workflowKey: input.request.workflowKey,
			nodeKey: input.request.currentNodeKey,
			stepNumber: Number(input.request.stepNumber)
		}
	});
}

async function finishRequest(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		request: WorkflowRequestLockRow;
		decision: WorkflowDecision;
		note: string | null;
	}
): Promise<void> {
	await connection.execute(
		`UPDATE workflow_requests
		 SET status = ?, active_key = NULL, workflow_state = ?, decided_by_member_id = ?,
		     decided_at = CURRENT_TIMESTAMP(6), decision_note = ?
		 WHERE organisation_id = ? AND id = ? AND status = 'pending'`,
		[
			input.decision,
			input.decision === 'rejected' ? 'terminated' : 'completed',
			input.actor.memberId,
			input.note,
			input.actor.organisationId,
			input.request.requestId
		]
	);
}

export async function finaliseWorkflowRequest(input: {
	actor: EvidenceActor;
	requestPublicId: string;
	decision: WorkflowDecision;
	note?: string | null;
	onApprovedCompletion?: (connection: PoolConnection) => Promise<void>;
}): Promise<{
	completed: boolean;
	decision: WorkflowDecision | null;
	currentNodeKey: string | null;
}> {
	const note = normalizeNote(input.note);
	if (input.decision !== 'approved' && !note) {
		throw new WorkflowValidationError('A reason is required when returning or rejecting work.');
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.execute<WorkflowRequestLockRow[]>(
			`SELECT request.id AS requestId, request.public_id AS requestPublicId,
			        request.work_item_id AS workItemId, item.public_id AS workItemPublicId,
			        request.workflow_key AS workflowKey, request.workflow_definition AS workflowDefinition,
			        request.current_node_key AS currentNodeKey, request.current_node_type AS currentNodeType,
			        request.step_number AS stepNumber, request.workflow_state AS workflowState,
			        request.source_domain AS sourceDomain, request.source_type AS sourceType,
			        request.source_public_id AS sourcePublicId, request.context_public_id AS contextPublicId,
			        request.lifecycle_from_state AS fromState, request.lifecycle_to_state AS toState,
			        request.transition_label AS transitionLabel,
			        request.required_permission_key AS requiredPermissionKey, request.status,
			        item.status AS workStatus, assignment.assignment_scope AS assignmentScope,
			        CAST(assignment.assigned_member_id AS CHAR) AS assignedMemberId,
			        CAST(assignment.assigned_team_id AS CHAR) AS assignedTeamId
			 FROM workflow_requests request
			 JOIN work_items item ON item.id = request.work_item_id
			  AND item.owning_organisation_id = request.organisation_id
			 JOIN work_item_assignments assignment ON assignment.work_item_id = item.id
			  AND assignment.work_item_owner_organisation_id = request.organisation_id
			  AND assignment.ended_at IS NULL
			 WHERE request.organisation_id = ? AND request.public_id = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.requestPublicId]
		);
		const request = rows[0];
		if (!request) throw new WorkflowValidationError('Workflow request was not found.');
		if (request.status !== 'pending') {
			throw new WorkflowValidationError('Workflow request has already been decided.');
		}
		if (!(await taskAllowed(request, input.actor.organisationId, input.actor.memberId))) {
			throw new WorkflowAccessError('You are not authorised to act on this workflow step.');
		}

		await completeWorkItem(connection, {
			actor: input.actor,
			request,
			decision: input.decision,
			note
		});
		const template = workflowDefinition(request.workflowDefinition);
		if (!template || !request.currentNodeKey) {
			if (input.decision === 'approved') {
				await input.onApprovedCompletion?.(connection);
			}
			await finishRequest(connection, {
				actor: input.actor,
				request,
				decision: input.decision,
				note
			});
			await connection.commit();
			return { completed: true, decision: input.decision, currentNodeKey: null };
		}

		const routingEvent =
			input.decision === 'approved'
				? 'approve'
				: input.decision === 'returned'
					? 'return'
					: 'reject';
		const hasAuthoredDecisionRoute = template.links.some(
			(link) => link.from === request.currentNodeKey && link.event === routingEvent
		);
		if (input.decision !== 'approved' && !hasAuthoredDecisionRoute) {
			await finishRequest(connection, {
				actor: input.actor,
				request,
				decision: input.decision,
				note
			});
			await appendDomainEvidence(connection, {
				actor: input.actor,
				actionKey: 'workflow.decided',
				subjectType: 'workflow_request',
				subjectPublicId: input.requestPublicId,
				changeSummary: {
					decision: input.decision,
					workflowKey: request.workflowKey,
					nodeKey: request.currentNodeKey
				},
				eventMetadata: { mutation: 'workflow-decision' }
			});
			await connection.commit();
			return { completed: true, decision: input.decision, currentNodeKey: null };
		}

		const next = nextExecutableNode(template, request.currentNodeKey, routingEvent);
		let stepNumber = Number(request.stepNumber);
		for (const automaticNode of next.automaticNodes) {
			stepNumber += 1;
			await insertStep(connection, {
				organisationId: input.actor.organisationId,
				requestId: Number(request.requestId),
				stepNumber,
				node: automaticNode,
				workItemId: null,
				status: 'completed',
				outcome: 'automatic',
				completedByMemberId: input.actor.memberId
			});
		}
		if (next.node.type === 'end') {
			stepNumber += 1;
			await insertStep(connection, {
				organisationId: input.actor.organisationId,
				requestId: Number(request.requestId),
				stepNumber,
				node: next.node,
				workItemId: null,
				status: 'completed',
				outcome: 'automatic',
				completedByMemberId: input.actor.memberId
			});
			if (input.decision === 'approved') {
				await input.onApprovedCompletion?.(connection);
			}
			await finishRequest(connection, {
				actor: input.actor,
				request,
				decision: input.decision,
				note
			});
			await connection.execute(
				`UPDATE workflow_requests SET current_node_key = ?, current_node_type = 'end', step_number = ?
				 WHERE organisation_id = ? AND id = ?`,
				[next.node.key, stepNumber, input.actor.organisationId, request.requestId]
			);
			await appendDomainEvidence(connection, {
				actor: input.actor,
				actionKey: input.decision === 'approved' ? 'workflow.completed' : 'workflow.decided',
				subjectType: 'workflow_request',
				subjectPublicId: input.requestPublicId,
				changeSummary: {
					decision: input.decision,
					workflowKey: request.workflowKey,
					endNodeKey: next.node.key
				},
				eventMetadata: { mutation: 'workflow-route-terminal' }
			});
			await connection.commit();
			return { completed: true, decision: input.decision, currentNodeKey: next.node.key };
		}

		stepNumber += 1;
		const created = await createHumanStep(connection, {
			actor: input.actor,
			requestId: Number(request.requestId),
			requestPublicId: input.requestPublicId,
			stepNumber,
			node: next.node,
			sourceDomain: request.sourceDomain,
			sourceType: request.sourceType,
			sourcePublicId: request.sourcePublicId,
			description: note,
			dueAt: null,
			requiredPermissionKey: request.requiredPermissionKey,
			workflowKey: request.workflowKey
		});
		await connection.execute(
			`UPDATE workflow_requests SET work_item_id = ?, current_node_key = ?, current_node_type = ?, step_number = ?
			 WHERE organisation_id = ? AND id = ? AND status = 'pending'`,
			[
				created.workItemId,
				next.node.key,
				next.node.type,
				stepNumber,
				input.actor.organisationId,
				request.requestId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.step.advanced',
			subjectType: 'workflow_request',
			subjectPublicId: input.requestPublicId,
			changeSummary: { workflowKey: request.workflowKey, nodeKey: next.node.key, stepNumber },
			eventMetadata: { mutation: 'workflow-step-advance' }
		});
		await connection.commit();
		return { completed: false, decision: null, currentNodeKey: next.node.key };
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
