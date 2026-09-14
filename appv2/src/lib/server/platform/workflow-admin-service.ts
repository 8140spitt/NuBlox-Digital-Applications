import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';
import {
	appendGovernedVersion,
	listGovernedVersionHistory,
	markPublishedVersionHistorical,
	type GovernedVersionHistoryItem
} from './governed-versioning';
import {
	defineWorkflowTemplate,
	type WorkflowNodeType,
	type WorkflowParticipantType,
	type WorkflowRule,
	type WorkflowTemplate,
	type WorkflowVariableDefinition
} from './workflow-kernel';

const TEMPLATE_KEY = /^[a-z][a-z0-9._:-]{1,159}$/;
const ITEM_KEY = /^[a-z][a-z0-9._:-]{0,159}$/;
const BINDING_KEY = /^[A-Za-z][A-Za-z0-9._:-]{0,159}$/;

export class WorkflowAdministrationAccessError extends Error {}
export class WorkflowAdministrationValidationError extends Error {}

export type WorkflowTemplateSummary = {
	publicId: string;
	templateKey: string;
	name: string;
	description: string | null;
	status: 'draft' | 'published' | 'superseded';
	versionLabel: string;
	nodeCount: number;
	linkCount: number;
	bindingCount: number;
	updatedAt: string;
};

export type WorkflowRoleAdmin = {
	roleKey: string;
	label: string;
	description: string | null;
};

export type WorkflowVariableAdmin = {
	variableKey: string;
	variableType: WorkflowVariableDefinition['type'];
	variableScope: WorkflowVariableDefinition['scope'];
	visible: boolean;
	required: boolean;
	readOnly: boolean;
	resettable: boolean;
	defaultValue: unknown;
};

export type WorkflowNodeAdmin = {
	publicId: string;
	nodeKey: string;
	label: string;
	nodeType: WorkflowNodeType;
	responsibleRoleKey: string | null;
	completionRuleType: 'any' | 'all' | 'count' | null;
	completionCount: number | null;
	routingEvents: string[];
	deadlineMinutes: number | null;
	deadlineRelativeTo: 'node_start' | 'process_start' | null;
	overdueAction: 'notify' | 'reassign' | 'skip' | 'complete' | 'escalate' | 'block' | null;
	deadlineResponsibleRoleKey: string | null;
	deadlineNotifyRoleKeys: string[];
	requiresElectronicSignature: boolean;
	thresholdCount: number | null;
	subprocessKey: string | null;
	serviceActionKey: string | null;
	integrationKey: string | null;
	timerMinutes: number | null;
	synchronizeEventKey: string | null;
	recordVariableChanges: boolean;
	recordVotes: boolean;
	recordReassignments: boolean;
	abortOnError: boolean;
	abortParentOnError: boolean;
	displayOrder: number;
};

export type WorkflowParticipantAdmin = {
	id: number;
	nodeKey: string;
	participantType: WorkflowParticipantType;
	participantKey: string;
	required: boolean;
};

export type WorkflowLinkAdmin = {
	publicId: string;
	fromNodeKey: string;
	toNodeKey: string;
	eventKey: string | null;
	condition: WorkflowRule | null;
	loop: boolean;
	terminateOpenPredecessors: boolean;
	displayOrder: number;
};

export type WorkflowBindingAdmin = {
	id: number;
	sourceDomain: string;
	sourceType: string;
	eventKey: string;
};

export type WorkflowTemplateDetail = WorkflowTemplateSummary & {
	roles: WorkflowRoleAdmin[];
	variables: WorkflowVariableAdmin[];
	nodes: WorkflowNodeAdmin[];
	participants: WorkflowParticipantAdmin[];
	links: WorkflowLinkAdmin[];
	bindings: WorkflowBindingAdmin[];
	versionHistory: GovernedVersionHistoryItem[];
	canManage: boolean;
	canPublish: boolean;
};

type TemplateRow = RowDataPacket & {
	id: number | string;
	publicId: string;
	templateKey: string;
	versionNumber: number | string;
	minorVersionNumber: number | string;
	name: string;
	description: string | null;
	status: 'draft' | 'published' | 'superseded';
	supersedesId: number | string | null;
	updatedAt: Date | string;
};

type NodeRow = RowDataPacket & {
	id: number | string;
	publicId: string;
	nodeKey: string;
	label: string;
	nodeType: WorkflowNodeType;
	responsibleRoleKey: string | null;
	completionRuleType: 'any' | 'all' | 'count' | null;
	completionCount: number | string | null;
	routingEvents: unknown;
	deadlineMinutes: number | string | null;
	deadlineRelativeTo: 'node_start' | 'process_start' | null;
	overdueAction: WorkflowNodeAdmin['overdueAction'];
	deadlineResponsibleRoleKey: string | null;
	deadlineNotifyRoleKeys: unknown;
	requiresElectronicSignature: number | boolean;
	thresholdCount: number | string | null;
	subprocessKey: string | null;
	serviceActionKey: string | null;
	integrationKey: string | null;
	timerMinutes: number | string | null;
	synchronizeEventKey: string | null;
	recordVariableChanges: number | boolean;
	recordVotes: number | boolean;
	recordReassignments: number | boolean;
	abortOnError: number | boolean;
	abortParentOnError: number | boolean;
	displayOrder: number | string;
};

function bool(value: unknown): boolean {
	return value === true || Number(value) === 1;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : String(value);
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

function versionLabel(row: Pick<TemplateRow, 'status' | 'versionNumber' | 'minorVersionNumber'>) {
	const major = Number(row.versionNumber);
	const minor = Number(row.minorVersionNumber);
	return row.status === 'draft' ? `${Math.max(0, major - 1)}.${Math.max(1, minor)}` : `${major}.0`;
}

function requiredText(value: string | undefined, label: string, max: number): string {
	const normalized = value?.trim() ?? '';
	if (!normalized || normalized.length > max) {
		throw new WorkflowAdministrationValidationError(
			`${label} must be between 1 and ${max} characters.`
		);
	}
	return normalized;
}

function optionalText(value: string | undefined, max: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new WorkflowAdministrationValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function templateKey(value: string | undefined): string {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!TEMPLATE_KEY.test(normalized)) {
		throw new WorkflowAdministrationValidationError(
			'Template key must start with a letter and use lowercase letters, numbers, dots, colons, underscores or hyphens.'
		);
	}
	return normalized;
}

function itemKey(value: string | undefined, label: string): string {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!ITEM_KEY.test(normalized)) {
		throw new WorkflowAdministrationValidationError(
			`${label} must start with a letter and use lowercase letters, numbers, dots, colons, underscores or hyphens.`
		);
	}
	return normalized;
}

function bindingKey(value: string | undefined, label: string): string {
	const normalized = value?.trim() ?? '';
	if (!BINDING_KEY.test(normalized)) {
		throw new WorkflowAdministrationValidationError(`${label} contains unsupported characters.`);
	}
	return normalized;
}

function nonNegativeInteger(value: number | null | undefined, label: string): number | null {
	if (value === null || value === undefined) return null;
	if (!Number.isInteger(value) || value < 0) {
		throw new WorkflowAdministrationValidationError(
			`${label} must be a non-negative whole number.`
		);
	}
	return value;
}

async function requirePermission(actor: EvidenceActor, permissionKey: string): Promise<void> {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: [permissionKey]
	});
	if (!decisions.get(permissionKey)?.allowed) {
		throw new WorkflowAdministrationAccessError(
			`You do not have ${permissionKey} authority in this organisation.`
		);
	}
}

async function permissionFlags(actor: EvidenceActor) {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys: ['workflow.manage', 'workflow.publish']
	});
	return {
		canManage: decisions.get('workflow.manage')?.allowed === true,
		canPublish: decisions.get('workflow.publish')?.allowed === true
	};
}

async function templateRow(
	connection: PoolConnection,
	actor: EvidenceActor,
	publicId: string,
	forUpdate = false
): Promise<TemplateRow> {
	const [rows] = await connection.execute<TemplateRow[]>(
		`SELECT id, public_id AS publicId, template_key AS templateKey,
		        version_number AS versionNumber, minor_version_number AS minorVersionNumber,
		        name, description, lifecycle_status AS status,
		        supersedes_workflow_template_id AS supersedesId, updated_at AS updatedAt
		 FROM workflow_templates
		 WHERE organisation_id = ? AND public_id = ?
		 LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
		[actor.organisationId, publicId]
	);
	const row = rows[0];
	if (!row) throw new WorkflowAdministrationValidationError('Workflow template was not found.');
	return row;
}

async function nodeRows(
	connection: PoolConnection,
	organisationId: string,
	templateId: number
): Promise<NodeRow[]> {
	const [rows] = await connection.execute<NodeRow[]>(
		`SELECT id, public_id AS publicId, node_key AS nodeKey, label, node_type AS nodeType,
		        responsible_role_key AS responsibleRoleKey,
		        completion_rule_type AS completionRuleType, completion_count AS completionCount,
		        routing_events AS routingEvents, deadline_minutes AS deadlineMinutes,
		        deadline_relative_to AS deadlineRelativeTo, overdue_action AS overdueAction,
		        deadline_responsible_role_key AS deadlineResponsibleRoleKey,
		        deadline_notify_role_keys AS deadlineNotifyRoleKeys,
		        requires_electronic_signature AS requiresElectronicSignature,
		        threshold_count AS thresholdCount, subprocess_key AS subprocessKey,
		        service_action_key AS serviceActionKey, integration_key AS integrationKey,
		        timer_minutes AS timerMinutes, synchronize_event_key AS synchronizeEventKey,
		        record_variable_changes AS recordVariableChanges, record_votes AS recordVotes,
		        record_reassignments AS recordReassignments, abort_on_error AS abortOnError,
		        abort_parent_on_error AS abortParentOnError, display_order AS displayOrder
		 FROM workflow_template_nodes
		 WHERE organisation_id = ? AND workflow_template_id = ?
		 ORDER BY display_order, id`,
		[organisationId, templateId]
	);
	return rows;
}

function adminNode(row: NodeRow): WorkflowNodeAdmin {
	return {
		publicId: row.publicId,
		nodeKey: row.nodeKey,
		label: row.label,
		nodeType: row.nodeType,
		responsibleRoleKey: row.responsibleRoleKey,
		completionRuleType: row.completionRuleType,
		completionCount: row.completionCount === null ? null : Number(row.completionCount),
		routingEvents: jsonValue<string[]>(row.routingEvents, []),
		deadlineMinutes: row.deadlineMinutes === null ? null : Number(row.deadlineMinutes),
		deadlineRelativeTo: row.deadlineRelativeTo,
		overdueAction: row.overdueAction,
		deadlineResponsibleRoleKey: row.deadlineResponsibleRoleKey,
		deadlineNotifyRoleKeys: jsonValue<string[]>(row.deadlineNotifyRoleKeys, []),
		requiresElectronicSignature: bool(row.requiresElectronicSignature),
		thresholdCount: row.thresholdCount === null ? null : Number(row.thresholdCount),
		subprocessKey: row.subprocessKey,
		serviceActionKey: row.serviceActionKey,
		integrationKey: row.integrationKey,
		timerMinutes: row.timerMinutes === null ? null : Number(row.timerMinutes),
		synchronizeEventKey: row.synchronizeEventKey,
		recordVariableChanges: bool(row.recordVariableChanges),
		recordVotes: bool(row.recordVotes),
		recordReassignments: bool(row.recordReassignments),
		abortOnError: bool(row.abortOnError),
		abortParentOnError: bool(row.abortParentOnError),
		displayOrder: Number(row.displayOrder)
	};
}

async function definitionForTemplate(
	connection: PoolConnection,
	organisationId: string,
	row: TemplateRow
): Promise<WorkflowTemplate> {
	const templateId = Number(row.id);
	const [roleRows] = await connection.execute<Array<RowDataPacket & { roleKey: string }>>(
		`SELECT role_key AS roleKey FROM workflow_template_roles
		 WHERE organisation_id = ? AND workflow_template_id = ? ORDER BY role_key`,
		[organisationId, templateId]
	);
	const [variableRows] = await connection.execute<
		Array<
			RowDataPacket & {
				variableKey: string;
				variableType: WorkflowVariableDefinition['type'];
				variableScope: WorkflowVariableDefinition['scope'];
				visible: number | boolean;
				required: number | boolean;
				readOnly: number | boolean;
				resettable: number | boolean;
				defaultValue: unknown;
			}
		>
	>(
		`SELECT variable_key AS variableKey, variable_type AS variableType,
		        variable_scope AS variableScope, is_visible AS visible, is_required AS required,
		        is_read_only AS readOnly, is_resettable AS resettable, default_value AS defaultValue
		 FROM workflow_template_variables
		 WHERE organisation_id = ? AND workflow_template_id = ? ORDER BY variable_key`,
		[organisationId, templateId]
	);
	const nodes = await nodeRows(connection, organisationId, templateId);
	const [participantRows] = await connection.execute<
		Array<
			RowDataPacket & {
				nodeId: number | string;
				participantType: WorkflowParticipantType;
				participantKey: string;
				required: number | boolean;
			}
		>
	>(
		`SELECT workflow_node_id AS nodeId, participant_type AS participantType,
		        participant_key AS participantKey, is_required AS required
		 FROM workflow_node_participants
		 WHERE organisation_id = ? AND workflow_template_id = ? ORDER BY id`,
		[organisationId, templateId]
	);
	const [linkRows] = await connection.execute<
		Array<
			RowDataPacket & {
				fromNodeKey: string;
				toNodeKey: string;
				eventKey: string | null;
				conditionJson: unknown;
				loop: number | boolean;
				terminateOpenPredecessors: number | boolean;
			}
		>
	>(
		`SELECT source.node_key AS fromNodeKey, target.node_key AS toNodeKey,
		        link.event_key AS eventKey, link.condition_json AS conditionJson,
		        link.is_loop AS loop, link.terminate_open_predecessors AS terminateOpenPredecessors
		 FROM workflow_template_links link
		 JOIN workflow_template_nodes source ON source.id = link.from_node_id
		 JOIN workflow_template_nodes target ON target.id = link.to_node_id
		 WHERE link.organisation_id = ? AND link.workflow_template_id = ?
		 ORDER BY link.display_order, link.id`,
		[organisationId, templateId]
	);
	const roleKeys = new Set(roleRows.map((role) => role.roleKey));
	const variableKeys = new Set(variableRows.map((variable) => variable.variableKey));

	for (const node of nodes) {
		for (const roleKey of [node.responsibleRoleKey, node.deadlineResponsibleRoleKey]) {
			if (roleKey && !roleKeys.has(roleKey)) {
				throw new WorkflowAdministrationValidationError(
					`Workflow node ${node.nodeKey} references undefined workflow role ${roleKey}.`
				);
			}
		}
		for (const roleKey of jsonValue<string[]>(node.deadlineNotifyRoleKeys, [])) {
			if (!roleKeys.has(roleKey)) {
				throw new WorkflowAdministrationValidationError(
					`Workflow node ${node.nodeKey} notifies undefined workflow role ${roleKey}.`
				);
			}
		}
	}
	for (const participant of participantRows) {
		if (
			participant.participantType === 'workflow_role' &&
			!roleKeys.has(participant.participantKey)
		) {
			throw new WorkflowAdministrationValidationError(
				`Workflow participant references undefined workflow role ${participant.participantKey}.`
			);
		}
		if (
			participant.participantType === 'variable' &&
			!variableKeys.has(participant.participantKey)
		) {
			throw new WorkflowAdministrationValidationError(
				`Workflow participant references undefined variable ${participant.participantKey}.`
			);
		}
	}

	const definition: WorkflowTemplate = {
		key: row.templateKey,
		version: `${Number(row.versionNumber)}.0`,
		status: row.status,
		name: row.name,
		description: row.description ?? undefined,
		roles: roleRows.map((role) => role.roleKey),
		variables: variableRows.map((variable) => ({
			key: variable.variableKey,
			type: variable.variableType,
			scope: variable.variableScope,
			visible: bool(variable.visible),
			required: bool(variable.required),
			readOnly: bool(variable.readOnly),
			resettable: bool(variable.resettable),
			defaultValue: jsonValue(variable.defaultValue, undefined)
		})),
		nodes: nodes.map((node) => {
			const completionRule = node.completionRuleType
				? node.completionRuleType === 'count'
					? { type: 'count' as const, count: Number(node.completionCount ?? 0) }
					: { type: node.completionRuleType }
				: undefined;
			const deadline =
				node.deadlineMinutes !== null && node.deadlineRelativeTo
					? {
							minutes: Number(node.deadlineMinutes),
							relativeTo: node.deadlineRelativeTo,
							overdueAction: node.overdueAction ?? undefined,
							responsibleRoleKey: node.deadlineResponsibleRoleKey ?? undefined,
							notifyRoleKeys: jsonValue<string[]>(node.deadlineNotifyRoleKeys, [])
						}
					: undefined;
			return {
				key: node.nodeKey,
				label: node.label,
				type: node.nodeType,
				responsibleRoleKey: node.responsibleRoleKey ?? undefined,
				participants: participantRows
					.filter((participant) => Number(participant.nodeId) === Number(node.id))
					.map((participant) => ({
						participantType: participant.participantType,
						participantKey: participant.participantKey,
						required: bool(participant.required)
					})),
				completionRule,
				routingEvents: jsonValue<string[]>(node.routingEvents, []),
				deadline,
				requiresElectronicSignature: bool(node.requiresElectronicSignature),
				threshold: node.thresholdCount === null ? undefined : Number(node.thresholdCount),
				subprocessKey: node.subprocessKey ?? undefined,
				serviceActionKey: node.serviceActionKey ?? undefined,
				integrationKey: node.integrationKey ?? undefined,
				timerMinutes: node.timerMinutes === null ? undefined : Number(node.timerMinutes),
				synchronizeEventKey: node.synchronizeEventKey ?? undefined,
				recordVariableChanges: bool(node.recordVariableChanges),
				recordVotes: bool(node.recordVotes),
				recordReassignments: bool(node.recordReassignments),
				abortOnError: bool(node.abortOnError),
				abortParentOnError: bool(node.abortParentOnError)
			};
		}),
		links: linkRows.map((link) => ({
			from: link.fromNodeKey,
			to: link.toNodeKey,
			event: link.eventKey ?? undefined,
			condition: link.conditionJson
				? jsonValue<WorkflowRule | undefined>(link.conditionJson, undefined)
				: undefined,
			loop: bool(link.loop),
			terminateOpenPredecessors: bool(link.terminateOpenPredecessors)
		}))
	};

	try {
		return defineWorkflowTemplate(definition);
	} catch (cause) {
		throw new WorkflowAdministrationValidationError(
			cause instanceof Error ? cause.message : 'Workflow template is structurally invalid.'
		);
	}
}

export async function loadWorkflowDefinitionById(
	connection: PoolConnection,
	organisationId: string,
	templateId: number
): Promise<WorkflowTemplate> {
	const [rows] = await connection.execute<TemplateRow[]>(
		`SELECT id, public_id AS publicId, template_key AS templateKey,
		        version_number AS versionNumber, minor_version_number AS minorVersionNumber,
		        name, description, lifecycle_status AS status,
		        supersedes_workflow_template_id AS supersedesId, updated_at AS updatedAt
		 FROM workflow_templates WHERE organisation_id = ? AND id = ? LIMIT 1`,
		[organisationId, templateId]
	);
	const row = rows[0];
	if (!row) throw new WorkflowAdministrationValidationError('Workflow template was not found.');
	return definitionForTemplate(connection, organisationId, row);
}

async function snapshot(connection: PoolConnection, actor: EvidenceActor, row: TemplateRow) {
	const definition = await definitionForTemplate(connection, actor.organisationId, row);
	return JSON.parse(JSON.stringify(definition)) as Record<string, unknown>;
}

async function appendTemplateVersion(
	connection: PoolConnection,
	actor: EvidenceActor,
	row: TemplateRow,
	changeNote: string,
	published = false
) {
	await appendGovernedVersion(connection, {
		actor,
		domainCode: 'PLATFORM',
		recordType: 'workflow_template',
		lineageKey: row.templateKey,
		recordPublicId: row.publicId,
		versionNumber: Number(row.versionNumber),
		minorVersionNumber: Number(row.minorVersionNumber),
		lifecycleStatus: published ? 'approved' : 'draft',
		snapshot: await snapshot(connection, actor, row),
		changeNote,
		published
	});
}

async function bumpDraft(
	connection: PoolConnection,
	actor: EvidenceActor,
	row: TemplateRow,
	changeNote: string
) {
	if (row.status !== 'draft') {
		throw new WorkflowAdministrationValidationError(
			'Published workflow templates are immutable. Create a controlled revision to amend them.'
		);
	}
	await connection.execute(
		`UPDATE workflow_templates SET minor_version_number = minor_version_number + 1
		 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
		[actor.organisationId, row.id]
	);
	const refreshed = await templateRow(connection, actor, row.publicId, true);
	await appendTemplateVersion(connection, actor, refreshed, changeNote);
}

export async function listWorkflowTemplates(
	actor: EvidenceActor
): Promise<WorkflowTemplateSummary[]> {
	await requirePermission(actor, 'workflow.view');
	const [rows] = await getPool().execute<
		Array<
			TemplateRow & {
				nodeCount: number | string;
				linkCount: number | string;
				bindingCount: number | string;
			}
		>
	>(
		`SELECT template.id, template.public_id AS publicId, template.template_key AS templateKey,
		        template.version_number AS versionNumber, template.minor_version_number AS minorVersionNumber,
		        template.name, template.description, template.lifecycle_status AS status,
		        template.supersedes_workflow_template_id AS supersedesId, template.updated_at AS updatedAt,
		        (SELECT COUNT(*) FROM workflow_template_nodes node WHERE node.workflow_template_id = template.id) AS nodeCount,
		        (SELECT COUNT(*) FROM workflow_template_links link_record WHERE link_record.workflow_template_id = template.id) AS linkCount,
		        (SELECT COUNT(*) FROM workflow_object_bindings binding WHERE binding.organisation_id = template.organisation_id AND binding.workflow_template_id = template.id) AS bindingCount
		 FROM workflow_templates template
		 WHERE template.organisation_id = ?
		 ORDER BY template.template_key, template.version_number DESC`,
		[actor.organisationId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		templateKey: row.templateKey,
		name: row.name,
		description: row.description,
		status: row.status,
		versionLabel: versionLabel(row),
		nodeCount: Number(row.nodeCount),
		linkCount: Number(row.linkCount),
		bindingCount: Number(row.bindingCount),
		updatedAt: iso(row.updatedAt)
	}));
}

export async function getWorkflowTemplate(
	actor: EvidenceActor,
	publicId: string
): Promise<WorkflowTemplateDetail> {
	await requirePermission(actor, 'workflow.view');
	const flags = await permissionFlags(actor);
	const connection = await getPool().getConnection();
	try {
		const row = await templateRow(connection, actor, publicId);
		const templateId = Number(row.id);
		const [roles] = await connection.execute<WorkflowRoleAdmin[]>(
			`SELECT role_key AS roleKey, label, description FROM workflow_template_roles
			 WHERE organisation_id = ? AND workflow_template_id = ? ORDER BY role_key`,
			[actor.organisationId, templateId]
		);
		const [variables] = await connection.execute<
			Array<
				RowDataPacket &
					WorkflowVariableAdmin & {
						visible: number | boolean;
						required: number | boolean;
						readOnly: number | boolean;
						resettable: number | boolean;
					}
			>
		>(
			`SELECT variable_key AS variableKey, variable_type AS variableType,
			        variable_scope AS variableScope, is_visible AS visible, is_required AS required,
			        is_read_only AS readOnly, is_resettable AS resettable, default_value AS defaultValue
			 FROM workflow_template_variables WHERE organisation_id = ? AND workflow_template_id = ?
			 ORDER BY variable_key`,
			[actor.organisationId, templateId]
		);
		const nodes = (await nodeRows(connection, actor.organisationId, templateId)).map(adminNode);
		const [participants] = await connection.execute<
			Array<
				RowDataPacket & {
					id: number | string;
					nodeKey: string;
					participantType: WorkflowParticipantType;
					participantKey: string;
					required: number | boolean;
				}
			>
		>(
			`SELECT participant.id, node.node_key AS nodeKey,
			        participant.participant_type AS participantType,
			        participant.participant_key AS participantKey, participant.is_required AS required
			 FROM workflow_node_participants participant
			 JOIN workflow_template_nodes node ON node.id = participant.workflow_node_id
			 WHERE participant.organisation_id = ? AND participant.workflow_template_id = ?
			 ORDER BY node.display_order, participant.id`,
			[actor.organisationId, templateId]
		);
		const [links] = await connection.execute<
			Array<
				RowDataPacket & {
					publicId: string;
					fromNodeKey: string;
					toNodeKey: string;
					eventKey: string | null;
					conditionJson: unknown;
					loop: number | boolean;
					terminateOpenPredecessors: number | boolean;
					displayOrder: number | string;
				}
			>
		>(
			`SELECT link.public_id AS publicId, source.node_key AS fromNodeKey,
			        target.node_key AS toNodeKey, link.event_key AS eventKey,
			        link.condition_json AS conditionJson, link.is_loop AS loop,
			        link.terminate_open_predecessors AS terminateOpenPredecessors,
			        link.display_order AS displayOrder
			 FROM workflow_template_links link
			 JOIN workflow_template_nodes source ON source.id = link.from_node_id
			 JOIN workflow_template_nodes target ON target.id = link.to_node_id
			 WHERE link.organisation_id = ? AND link.workflow_template_id = ?
			 ORDER BY link.display_order, link.id`,
			[actor.organisationId, templateId]
		);
		const [bindings] = await connection.execute<
			Array<RowDataPacket & WorkflowBindingAdmin & { id: number | string }>
		>(
			`SELECT id, source_domain AS sourceDomain, source_type AS sourceType, event_key AS eventKey
			 FROM workflow_object_bindings WHERE organisation_id = ? AND workflow_template_id = ?
			 ORDER BY source_domain, source_type, event_key`,
			[actor.organisationId, templateId]
		);
		const history = await listGovernedVersionHistory(connection, {
			organisationId: actor.organisationId,
			domainCode: 'PLATFORM',
			recordType: 'workflow_template',
			lineageKey: row.templateKey,
			limit: 30
		});
		return {
			publicId: row.publicId,
			templateKey: row.templateKey,
			name: row.name,
			description: row.description,
			status: row.status,
			versionLabel: versionLabel(row),
			nodeCount: nodes.length,
			linkCount: links.length,
			bindingCount: bindings.length,
			updatedAt: iso(row.updatedAt),
			roles,
			variables: variables.map((variable) => ({
				...variable,
				visible: bool(variable.visible),
				required: bool(variable.required),
				readOnly: bool(variable.readOnly),
				resettable: bool(variable.resettable),
				defaultValue: jsonValue(variable.defaultValue, null)
			})),
			nodes,
			participants: participants.map((participant) => ({
				...participant,
				id: Number(participant.id),
				required: bool(participant.required)
			})),
			links: links.map((link) => ({
				publicId: link.publicId,
				fromNodeKey: link.fromNodeKey,
				toNodeKey: link.toNodeKey,
				eventKey: link.eventKey,
				condition: link.conditionJson
					? jsonValue<WorkflowRule | null>(link.conditionJson, null)
					: null,
				loop: bool(link.loop),
				terminateOpenPredecessors: bool(link.terminateOpenPredecessors),
				displayOrder: Number(link.displayOrder)
			})),
			bindings: bindings.map((binding) => ({ ...binding, id: Number(binding.id) })),
			versionHistory: history,
			...flags
		};
	} finally {
		connection.release();
	}
}

export async function createWorkflowTemplate(input: {
	actor: EvidenceActor;
	templateKey: string;
	name: string;
	description?: string;
}): Promise<{ publicId: string }> {
	await requirePermission(input.actor, 'workflow.manage');
	const key = templateKey(input.templateKey);
	const name = requiredText(input.name, 'Template name', 200);
	const description = optionalText(input.description, 4000);
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [existing] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM workflow_templates WHERE organisation_id = ? AND template_key = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, key]
		);
		if (existing[0]) {
			throw new WorkflowAdministrationValidationError(
				'That workflow template key already exists. Revise the published template instead.'
			);
		}
		const [insert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_templates
			 (organisation_id, public_id, template_key, version_number, minor_version_number,
			  name, description, lifecycle_status, created_by_member_id)
			 VALUES (?, ?, ?, 1, 1, ?, ?, 'draft', ?)`,
			[input.actor.organisationId, publicId, key, name, description, input.actor.memberId]
		);
		const startPublicId = randomUUID();
		const endPublicId = randomUUID();
		const [start] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type, display_order)
			 VALUES (?, ?, ?, 'start', 'Start', 'start', 10)`,
			[input.actor.organisationId, insert.insertId, startPublicId]
		);
		const [end] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type, display_order)
			 VALUES (?, ?, ?, 'end', 'End', 'end', 90)`,
			[input.actor.organisationId, insert.insertId, endPublicId]
		);
		await connection.execute(
			`INSERT INTO workflow_template_links
			 (organisation_id, workflow_template_id, public_id, from_node_id, to_node_id, display_order)
			 VALUES (?, ?, ?, ?, ?, 10)`,
			[input.actor.organisationId, insert.insertId, randomUUID(), start.insertId, end.insertId]
		);
		const row = await templateRow(connection, input.actor, publicId, true);
		await appendTemplateVersion(connection, input.actor, row, 'Workflow template created');
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.create',
			subjectType: 'workflow_template',
			subjectPublicId: publicId,
			changeSummary: { templateKey: key },
			eventMetadata: { function: 'PLATFORM', mutation: 'create' }
		});
		await connection.commit();
		return { publicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function updateWorkflowTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
	name: string;
	description?: string;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		await connection.execute(
			`UPDATE workflow_templates SET name = ?, description = ? WHERE organisation_id = ? AND id = ?`,
			[
				requiredText(input.name, 'Template name', 200),
				optionalText(input.description, 4000),
				input.actor.organisationId,
				row.id
			]
		);
		await bumpDraft(connection, input.actor, row, 'Workflow template metadata updated');
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addWorkflowRole(input: {
	actor: EvidenceActor;
	publicId: string;
	roleKey: string;
	label: string;
	description?: string;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const roleKey = itemKey(input.roleKey, 'Workflow role key');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		await connection.execute(
			`INSERT INTO workflow_template_roles
			 (organisation_id, workflow_template_id, role_key, label, description) VALUES (?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				roleKey,
				requiredText(input.label, 'Workflow role label', 120),
				optionalText(input.description, 2000)
			]
		);
		await bumpDraft(connection, input.actor, row, `Workflow role ${roleKey} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addWorkflowVariable(input: {
	actor: EvidenceActor;
	publicId: string;
	variableKey: string;
	variableType: WorkflowVariableDefinition['type'];
	variableScope: WorkflowVariableDefinition['scope'];
	visible?: boolean;
	required?: boolean;
	readOnly?: boolean;
	resettable?: boolean;
	defaultValue?: unknown;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const variableKey = itemKey(input.variableKey, 'Variable key');
	const validTypes = ['string', 'number', 'boolean', 'date', 'json', 'object_reference'];
	if (!validTypes.includes(input.variableType))
		throw new WorkflowAdministrationValidationError('Variable type is invalid.');
	if (!['process', 'node'].includes(input.variableScope))
		throw new WorkflowAdministrationValidationError('Variable scope is invalid.');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		await connection.execute(
			`INSERT INTO workflow_template_variables
			 (organisation_id, workflow_template_id, variable_key, variable_type, variable_scope,
			  is_visible, is_required, is_read_only, is_resettable, default_value)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
			[
				input.actor.organisationId,
				row.id,
				variableKey,
				input.variableType,
				input.variableScope,
				input.visible ?? true,
				input.required ?? false,
				input.readOnly ?? false,
				input.resettable ?? false,
				JSON.stringify(input.defaultValue ?? null)
			]
		);
		await bumpDraft(connection, input.actor, row, `Workflow variable ${variableKey} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addWorkflowNode(input: {
	actor: EvidenceActor;
	publicId: string;
	nodeKey: string;
	label: string;
	nodeType: WorkflowNodeType;
	responsibleRoleKey?: string;
	completionRuleType?: 'any' | 'all' | 'count';
	completionCount?: number;
	routingEvents?: string[];
	deadlineMinutes?: number;
	deadlineRelativeTo?: 'node_start' | 'process_start';
	overdueAction?: WorkflowNodeAdmin['overdueAction'];
	deadlineResponsibleRoleKey?: string;
	deadlineNotifyRoleKeys?: string[];
	requiresElectronicSignature?: boolean;
	thresholdCount?: number;
	subprocessKey?: string;
	serviceActionKey?: string;
	integrationKey?: string;
	timerMinutes?: number;
	synchronizeEventKey?: string;
	recordVariableChanges?: boolean;
	recordVotes?: boolean;
	recordReassignments?: boolean;
	abortOnError?: boolean;
	abortParentOnError?: boolean;
	displayOrder: number;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const nodeKey = itemKey(input.nodeKey, 'Node key');
	const validTypes: WorkflowNodeType[] = [
		'start',
		'activity',
		'ad_hoc_activity',
		'subprocess',
		'block',
		'and',
		'or',
		'threshold',
		'conditional',
		'notification',
		'timer',
		'checkpoint',
		'service',
		'synchronize',
		'integration',
		'end'
	];
	if (!validTypes.includes(input.nodeType))
		throw new WorkflowAdministrationValidationError('Workflow node type is invalid.');
	const displayOrder = nonNegativeInteger(input.displayOrder, 'Display order') ?? 0;
	const completionCount = nonNegativeInteger(input.completionCount, 'Completion count');
	const deadlineMinutes = nonNegativeInteger(input.deadlineMinutes, 'Deadline minutes');
	const thresholdCount = nonNegativeInteger(input.thresholdCount, 'Threshold count');
	const timerMinutes = nonNegativeInteger(input.timerMinutes, 'Timer minutes');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		await connection.execute(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type,
			  responsible_role_key, completion_rule_type, completion_count, routing_events,
			  deadline_minutes, deadline_relative_to, overdue_action, deadline_responsible_role_key,
			  deadline_notify_role_keys, requires_electronic_signature, threshold_count,
			  subprocess_key, service_action_key, integration_key, timer_minutes, synchronize_event_key,
			  record_variable_changes, record_votes, record_reassignments, abort_on_error,
			  abort_parent_on_error, display_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				randomUUID(),
				nodeKey,
				requiredText(input.label, 'Node label', 160),
				input.nodeType,
				input.responsibleRoleKey ? itemKey(input.responsibleRoleKey, 'Responsible role') : null,
				input.completionRuleType ?? null,
				completionCount,
				JSON.stringify((input.routingEvents ?? []).map((event) => itemKey(event, 'Routing event'))),
				deadlineMinutes,
				input.deadlineRelativeTo ?? null,
				input.overdueAction ?? null,
				input.deadlineResponsibleRoleKey
					? itemKey(input.deadlineResponsibleRoleKey, 'Deadline role')
					: null,
				JSON.stringify(
					(input.deadlineNotifyRoleKeys ?? []).map((role) => itemKey(role, 'Notify role'))
				),
				input.requiresElectronicSignature ?? false,
				thresholdCount,
				input.subprocessKey ? itemKey(input.subprocessKey, 'Subprocess key') : null,
				input.serviceActionKey ? itemKey(input.serviceActionKey, 'Service action key') : null,
				input.integrationKey ? itemKey(input.integrationKey, 'Integration key') : null,
				timerMinutes,
				input.synchronizeEventKey
					? itemKey(input.synchronizeEventKey, 'Synchronize event key')
					: null,
				input.recordVariableChanges ?? false,
				input.recordVotes ?? false,
				input.recordReassignments ?? false,
				input.abortOnError ?? false,
				input.abortParentOnError ?? false,
				displayOrder
			]
		);
		await bumpDraft(connection, input.actor, row, `Workflow node ${nodeKey} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addWorkflowParticipant(input: {
	actor: EvidenceActor;
	publicId: string;
	nodeKey: string;
	participantType: WorkflowParticipantType;
	participantKey: string;
	required?: boolean;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const nodeKey = itemKey(input.nodeKey, 'Node key');
	const participantKey = bindingKey(input.participantKey, 'Participant key');
	const validTypes: WorkflowParticipantType[] = [
		'member',
		'team',
		'organisation_role',
		'lifecycle_role',
		'workflow_role',
		'actor',
		'variable'
	];
	if (!validTypes.includes(input.participantType))
		throw new WorkflowAdministrationValidationError('Participant type is invalid.');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		const [nodes] = await connection.execute<Array<RowDataPacket & { id: number | string }>>(
			`SELECT id FROM workflow_template_nodes WHERE organisation_id = ? AND workflow_template_id = ? AND node_key = ? LIMIT 1`,
			[input.actor.organisationId, row.id, nodeKey]
		);
		if (!nodes[0])
			throw new WorkflowAdministrationValidationError(`Workflow node ${nodeKey} was not found.`);
		await connection.execute(
			`INSERT INTO workflow_node_participants
			 (organisation_id, workflow_template_id, workflow_node_id, participant_type, participant_key, is_required)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				nodes[0].id,
				input.participantType,
				participantKey,
				input.required ?? true
			]
		);
		await bumpDraft(connection, input.actor, row, `Participant added to workflow node ${nodeKey}`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function addWorkflowLink(input: {
	actor: EvidenceActor;
	publicId: string;
	fromNodeKey: string;
	toNodeKey: string;
	eventKey?: string;
	condition?: WorkflowRule;
	loop?: boolean;
	terminateOpenPredecessors?: boolean;
	displayOrder: number;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const from = itemKey(input.fromNodeKey, 'Source node');
	const to = itemKey(input.toNodeKey, 'Target node');
	const displayOrder = nonNegativeInteger(input.displayOrder, 'Display order') ?? 0;
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		const [nodes] = await connection.execute<
			Array<RowDataPacket & { id: number | string; nodeKey: string }>
		>(
			`SELECT id, node_key AS nodeKey FROM workflow_template_nodes
			 WHERE organisation_id = ? AND workflow_template_id = ? AND node_key IN (?, ?)`,
			[input.actor.organisationId, row.id, from, to]
		);
		const source = nodes.find((node) => node.nodeKey === from);
		const target = nodes.find((node) => node.nodeKey === to);
		if (!source || !target)
			throw new WorkflowAdministrationValidationError('Both workflow link nodes must exist.');
		await connection.execute(
			`INSERT INTO workflow_template_links
			 (organisation_id, workflow_template_id, public_id, from_node_id, to_node_id, event_key,
			  condition_json, is_loop, terminate_open_predecessors, display_order)
			 VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)`,
			[
				input.actor.organisationId,
				row.id,
				randomUUID(),
				source.id,
				target.id,
				input.eventKey ? itemKey(input.eventKey, 'Routing event') : null,
				JSON.stringify(input.condition ?? null),
				input.loop ?? false,
				input.terminateOpenPredecessors ?? false,
				displayOrder
			]
		);
		await bumpDraft(connection, input.actor, row, `Workflow route ${from} → ${to} added`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteWorkflowLink(input: {
	actor: EvidenceActor;
	publicId: string;
	linkPublicId: string;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		const [result] = await connection.execute<ResultSetHeader>(
			`DELETE FROM workflow_template_links WHERE organisation_id = ? AND workflow_template_id = ? AND public_id = ?`,
			[input.actor.organisationId, row.id, input.linkPublicId]
		);
		if (!result.affectedRows)
			throw new WorkflowAdministrationValidationError('Workflow route was not found.');
		await bumpDraft(connection, input.actor, row, 'Workflow route removed');
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function deleteWorkflowNode(input: {
	actor: EvidenceActor;
	publicId: string;
	nodeKey: string;
}) {
	await requirePermission(input.actor, 'workflow.manage');
	const nodeKey = itemKey(input.nodeKey, 'Node key');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be modified.'
			);
		const [result] = await connection.execute<ResultSetHeader>(
			`DELETE FROM workflow_template_nodes WHERE organisation_id = ? AND workflow_template_id = ? AND node_key = ?`,
			[input.actor.organisationId, row.id, nodeKey]
		);
		if (!result.affectedRows)
			throw new WorkflowAdministrationValidationError('Workflow node was not found.');
		await bumpDraft(connection, input.actor, row, `Workflow node ${nodeKey} removed`);
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function publishWorkflowTemplate(input: { actor: EvidenceActor; publicId: string }) {
	await requirePermission(input.actor, 'workflow.publish');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		let row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'draft')
			throw new WorkflowAdministrationValidationError(
				'Only draft workflow templates can be published.'
			);
		await definitionForTemplate(connection, input.actor.organisationId, row);
		await connection.execute(
			`UPDATE workflow_templates
			 SET lifecycle_status = 'published', minor_version_number = 0,
			     published_by_member_id = ?, published_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, row.id]
		);
		if (row.supersedesId) {
			const [previousRows] = await connection.execute<TemplateRow[]>(
				`SELECT id, public_id AS publicId, template_key AS templateKey,
				        version_number AS versionNumber, minor_version_number AS minorVersionNumber,
				        name, description, lifecycle_status AS status,
				        supersedes_workflow_template_id AS supersedesId, updated_at AS updatedAt
				 FROM workflow_templates WHERE organisation_id = ? AND id = ? LIMIT 1 FOR UPDATE`,
				[input.actor.organisationId, row.supersedesId]
			);
			const previous = previousRows[0];
			if (!previous || previous.status !== 'published') {
				throw new WorkflowAdministrationValidationError(
					'The predecessor workflow template is no longer publishable as a revision source.'
				);
			}
			await connection.execute(
				`UPDATE workflow_templates SET lifecycle_status = 'superseded'
				 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'published'`,
				[input.actor.organisationId, previous.id]
			);
			await connection.execute(
				`UPDATE workflow_object_bindings SET workflow_template_id = ?, bound_by_member_id = ?, bound_at = CURRENT_TIMESTAMP(6)
				 WHERE organisation_id = ? AND workflow_template_id = ?`,
				[row.id, input.actor.memberId, input.actor.organisationId, previous.id]
			);
			await markPublishedVersionHistorical(connection, {
				organisationId: input.actor.organisationId,
				domainCode: 'PLATFORM',
				recordType: 'workflow_template',
				lineageKey: previous.templateKey,
				majorVersion: Number(previous.versionNumber)
			});
		}
		row = await templateRow(connection, input.actor, input.publicId, true);
		await appendTemplateVersion(connection, input.actor, row, 'Workflow template published', true);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.publish',
			subjectType: 'workflow_template',
			subjectPublicId: input.publicId,
			changeSummary: { templateKey: row.templateKey, version: Number(row.versionNumber) },
			eventMetadata: { function: 'PLATFORM', mutation: 'publish' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function reviseWorkflowTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
}): Promise<{ publicId: string }> {
	await requirePermission(input.actor, 'workflow.manage');
	const nextPublicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'published')
			throw new WorkflowAdministrationValidationError(
				'Only published workflow templates can be revised.'
			);
		const [existing] = await connection.execute<RowDataPacket[]>(
			`SELECT id FROM workflow_templates WHERE organisation_id = ? AND template_key = ? AND lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, row.templateKey]
		);
		if (existing[0])
			throw new WorkflowAdministrationValidationError(
				'A working revision already exists for this workflow template.'
			);
		const [insert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_templates
			 (organisation_id, public_id, template_key, version_number, minor_version_number,
			  name, description, lifecycle_status, supersedes_workflow_template_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, 1, ?, ?, 'draft', ?, ?)`,
			[
				input.actor.organisationId,
				nextPublicId,
				row.templateKey,
				Number(row.versionNumber) + 1,
				row.name,
				row.description,
				row.id,
				input.actor.memberId
			]
		);
		const nextId = insert.insertId;
		await connection.execute(
			`INSERT INTO workflow_template_roles (organisation_id, workflow_template_id, role_key, label, description)
			 SELECT organisation_id, ?, role_key, label, description FROM workflow_template_roles
			 WHERE organisation_id = ? AND workflow_template_id = ?`,
			[nextId, input.actor.organisationId, row.id]
		);
		await connection.execute(
			`INSERT INTO workflow_template_variables
			 (organisation_id, workflow_template_id, variable_key, variable_type, variable_scope,
			  is_visible, is_required, is_read_only, is_resettable, default_value)
			 SELECT organisation_id, ?, variable_key, variable_type, variable_scope,
			        is_visible, is_required, is_read_only, is_resettable, default_value
			 FROM workflow_template_variables WHERE organisation_id = ? AND workflow_template_id = ?`,
			[nextId, input.actor.organisationId, row.id]
		);
		await connection.execute(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type,
			  responsible_role_key, completion_rule_type, completion_count, routing_events,
			  deadline_minutes, deadline_relative_to, overdue_action, deadline_responsible_role_key,
			  deadline_notify_role_keys, requires_electronic_signature, threshold_count,
			  subprocess_key, service_action_key, integration_key, timer_minutes, synchronize_event_key,
			  record_variable_changes, record_votes, record_reassignments, abort_on_error,
			  abort_parent_on_error, display_order)
			 SELECT organisation_id, ?, UUID(), node_key, label, node_type,
			        responsible_role_key, completion_rule_type, completion_count, routing_events,
			        deadline_minutes, deadline_relative_to, overdue_action, deadline_responsible_role_key,
			        deadline_notify_role_keys, requires_electronic_signature, threshold_count,
			        subprocess_key, service_action_key, integration_key, timer_minutes, synchronize_event_key,
			        record_variable_changes, record_votes, record_reassignments, abort_on_error,
			        abort_parent_on_error, display_order
			 FROM workflow_template_nodes WHERE organisation_id = ? AND workflow_template_id = ?`,
			[nextId, input.actor.organisationId, row.id]
		);
		await connection.execute(
			`INSERT INTO workflow_node_participants
			 (organisation_id, workflow_template_id, workflow_node_id, participant_type, participant_key, is_required)
			 SELECT participant.organisation_id, ?, next_node.id,
			        participant.participant_type, participant.participant_key, participant.is_required
			 FROM workflow_node_participants participant
			 JOIN workflow_template_nodes previous_node ON previous_node.id = participant.workflow_node_id
			 JOIN workflow_template_nodes next_node
			   ON next_node.organisation_id = participant.organisation_id
			  AND next_node.workflow_template_id = ?
			  AND next_node.node_key = previous_node.node_key
			 WHERE participant.organisation_id = ? AND participant.workflow_template_id = ?`,
			[nextId, nextId, input.actor.organisationId, row.id]
		);
		await connection.execute(
			`INSERT INTO workflow_template_links
			 (organisation_id, workflow_template_id, public_id, from_node_id, to_node_id, event_key,
			  condition_json, is_loop, terminate_open_predecessors, display_order)
			 SELECT link.organisation_id, ?, UUID(), next_source.id, next_target.id, link.event_key,
			        link.condition_json, link.is_loop, link.terminate_open_predecessors, link.display_order
			 FROM workflow_template_links link
			 JOIN workflow_template_nodes previous_source ON previous_source.id = link.from_node_id
			 JOIN workflow_template_nodes previous_target ON previous_target.id = link.to_node_id
			 JOIN workflow_template_nodes next_source
			   ON next_source.organisation_id = link.organisation_id
			  AND next_source.workflow_template_id = ? AND next_source.node_key = previous_source.node_key
			 JOIN workflow_template_nodes next_target
			   ON next_target.organisation_id = link.organisation_id
			  AND next_target.workflow_template_id = ? AND next_target.node_key = previous_target.node_key
			 WHERE link.organisation_id = ? AND link.workflow_template_id = ?`,
			[nextId, nextId, nextId, input.actor.organisationId, row.id]
		);
		const revision = await templateRow(connection, input.actor, nextPublicId, true);
		await appendTemplateVersion(
			connection,
			input.actor,
			revision,
			'Controlled workflow revision created'
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.revise',
			subjectType: 'workflow_template',
			subjectPublicId: nextPublicId,
			changeSummary: { templateKey: row.templateKey, supersedesPublicId: row.publicId },
			eventMetadata: { function: 'PLATFORM', mutation: 'revise' }
		});
		await connection.commit();
		return { publicId: nextPublicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function bindWorkflowTemplate(input: {
	actor: EvidenceActor;
	publicId: string;
	sourceDomain: string;
	sourceType: string;
	eventKey: string;
}) {
	await requirePermission(input.actor, 'workflow.publish');
	const sourceDomain = bindingKey(input.sourceDomain, 'Source domain');
	const sourceType = bindingKey(input.sourceType, 'Source type');
	const eventKey = bindingKey(input.eventKey, 'Event key');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const row = await templateRow(connection, input.actor, input.publicId, true);
		if (row.status !== 'published')
			throw new WorkflowAdministrationValidationError(
				'Only published workflow templates can be activated.'
			);
		await connection.execute(
			`INSERT INTO workflow_object_bindings
			 (organisation_id, source_domain, source_type, event_key, workflow_template_id, bound_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE workflow_template_id = VALUES(workflow_template_id),
			                         bound_by_member_id = VALUES(bound_by_member_id),
			                         bound_at = CURRENT_TIMESTAMP(6)`,
			[input.actor.organisationId, sourceDomain, sourceType, eventKey, row.id, input.actor.memberId]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.bind',
			subjectType: 'workflow_template',
			subjectPublicId: input.publicId,
			changeSummary: { sourceDomain, sourceType, eventKey },
			eventMetadata: { function: 'PLATFORM', mutation: 'bind' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function unbindWorkflowTemplate(input: { actor: EvidenceActor; bindingId: number }) {
	await requirePermission(input.actor, 'workflow.publish');
	if (!Number.isInteger(input.bindingId) || input.bindingId < 1)
		throw new WorkflowAdministrationValidationError('Workflow binding is invalid.');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.execute<
			Array<
				RowDataPacket & {
					id: number | string;
					templatePublicId: string;
					sourceDomain: string;
					sourceType: string;
					eventKey: string;
				}
			>
		>(
			`SELECT binding.id, template.public_id AS templatePublicId,
			        binding.source_domain AS sourceDomain, binding.source_type AS sourceType, binding.event_key AS eventKey
			 FROM workflow_object_bindings binding
			 JOIN workflow_templates template ON template.id = binding.workflow_template_id
			 WHERE binding.organisation_id = ? AND binding.id = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.bindingId]
		);
		const binding = rows[0];
		if (!binding)
			throw new WorkflowAdministrationValidationError('Workflow binding was not found.');
		await connection.execute(
			`DELETE FROM workflow_object_bindings WHERE organisation_id = ? AND id = ?`,
			[input.actor.organisationId, input.bindingId]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.unbind',
			subjectType: 'workflow_template',
			subjectPublicId: binding.templatePublicId,
			changeSummary: {
				sourceDomain: binding.sourceDomain,
				sourceType: binding.sourceType,
				eventKey: binding.eventKey
			},
			eventMetadata: { function: 'PLATFORM', mutation: 'unbind' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
