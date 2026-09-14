import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import {
	functionObjectRegistry,
	getObjectTypeDefinition,
	lifecycleTemplateKey,
	workflowTemplateKey,
	type ObjectTypeDefinition,
	type WorkflowFamilyKey
} from '$lib/platform/object-template-registry';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';
import { appendGovernedVersion } from './governed-versioning';

export class ObjectTemplateLibraryAccessError extends Error {}
export class ObjectTemplateLibraryValidationError extends Error {}

export type ObjectTemplateLibraryItem = ObjectTypeDefinition & {
	lifecycleInstalled: boolean;
	installedWorkflowCount: number;
	workflowCount: number;
	fullyInstalled: boolean;
};

export type ObjectTemplateLibraryGroup = {
	functionId: string;
	functionName: string;
	objects: ObjectTemplateLibraryItem[];
};

type WorkflowNodeBlueprint = {
	key: string;
	label: string;
	type: 'start' | 'activity' | 'checkpoint' | 'end';
	responsibleRoleKey?: string;
};

type WorkflowBlueprint = {
	roles: Array<{ key: string; label: string }>;
	nodes: WorkflowNodeBlueprint[];
};

const workflowBlueprints: Record<WorkflowFamilyKey, WorkflowBlueprint> = {
	approval: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'reviewer', label: 'Reviewer' },
			{ key: 'approver', label: 'Approver' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'prepare',
				label: 'Prepare decision pack',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{ key: 'review', label: 'Review evidence', type: 'activity', responsibleRoleKey: 'reviewer' },
			{
				key: 'approve',
				label: 'Approve or reject',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	review: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'reviewer', label: 'Reviewer' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{ key: 'gather', label: 'Gather evidence', type: 'activity', responsibleRoleKey: 'owner' },
			{ key: 'review', label: 'Review evidence', type: 'activity', responsibleRoleKey: 'reviewer' },
			{
				key: 'record',
				label: 'Record review outcome',
				type: 'checkpoint',
				responsibleRoleKey: 'reviewer'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	revision: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'reviewer', label: 'Reviewer' },
			{ key: 'approver', label: 'Approver' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'assess_change',
				label: 'Assess proposed change',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{
				key: 'revise',
				label: 'Prepare controlled revision',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{ key: 'review', label: 'Review revision', type: 'activity', responsibleRoleKey: 'reviewer' },
			{
				key: 'approve',
				label: 'Approve change',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	'case-resolution': {
		roles: [
			{ key: 'owner', label: 'Case owner' },
			{ key: 'reviewer', label: 'Resolver / reviewer' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{ key: 'triage', label: 'Triage and assign', type: 'activity', responsibleRoleKey: 'owner' },
			{
				key: 'resolve',
				label: 'Investigate and resolve',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{
				key: 'verify',
				label: 'Verify resolution',
				type: 'checkpoint',
				responsibleRoleKey: 'reviewer'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	execution: {
		roles: [
			{ key: 'owner', label: 'Work owner' },
			{ key: 'reviewer', label: 'Verifier / acceptor' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{ key: 'plan', label: 'Plan work', type: 'activity', responsibleRoleKey: 'owner' },
			{ key: 'execute', label: 'Execute work', type: 'activity', responsibleRoleKey: 'owner' },
			{
				key: 'verify',
				label: 'Verify and accept',
				type: 'checkpoint',
				responsibleRoleKey: 'reviewer'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	exception: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'approver', label: 'Escalation authority' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{ key: 'triage', label: 'Triage exception', type: 'activity', responsibleRoleKey: 'owner' },
			{
				key: 'decide',
				label: 'Decide response',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{
				key: 'implement',
				label: 'Implement response',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	'periodic-review': {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'reviewer', label: 'Reviewer' },
			{ key: 'approver', label: 'Decision authority' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'gather',
				label: 'Gather current evidence',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{ key: 'review', label: 'Conduct review', type: 'activity', responsibleRoleKey: 'reviewer' },
			{
				key: 'actions',
				label: 'Agree decisions and actions',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	closure: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'approver', label: 'Closure authority' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'evidence',
				label: 'Confirm completion evidence',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{
				key: 'close',
				label: 'Approve closure',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	qualification: {
		roles: [
			{ key: 'owner', label: 'Object owner' },
			{ key: 'reviewer', label: 'Validator' },
			{ key: 'approver', label: 'Activation authority' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'evidence',
				label: 'Collect qualification evidence',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{
				key: 'validate',
				label: 'Validate requirements',
				type: 'activity',
				responsibleRoleKey: 'reviewer'
			},
			{
				key: 'activate',
				label: 'Approve activation',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	},
	'stage-gate': {
		roles: [
			{ key: 'owner', label: 'Delivery owner' },
			{ key: 'reviewer', label: 'Gate reviewer' },
			{ key: 'approver', label: 'Gate authority' }
		],
		nodes: [
			{ key: 'start', label: 'Start', type: 'start' },
			{
				key: 'readiness',
				label: 'Prepare gate evidence',
				type: 'activity',
				responsibleRoleKey: 'owner'
			},
			{
				key: 'review',
				label: 'Review readiness',
				type: 'activity',
				responsibleRoleKey: 'reviewer'
			},
			{
				key: 'gate',
				label: 'Pass, condition or stop',
				type: 'checkpoint',
				responsibleRoleKey: 'approver'
			},
			{ key: 'end', label: 'End', type: 'end' }
		]
	}
};

async function requirePermissions(actor: EvidenceActor, permissionKeys: string[]): Promise<void> {
	const decisions = await decidePermissions({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKeys
	});
	const denied = permissionKeys.find((key) => decisions.get(key)?.allowed !== true);
	if (denied) {
		throw new ObjectTemplateLibraryAccessError(
			`You do not have ${denied} authority in this organisation.`
		);
	}
}

function lifecycleSnapshot(object: ObjectTypeDefinition, templateKey: string) {
	return {
		templateKey,
		name: `${object.name} lifecycle`,
		description: object.description,
		objectType: object.objectType,
		mode: 'advanced',
		initialState: object.lifecycle.initialState,
		lifecycleStatus: 'draft',
		phases: object.lifecycle.states.map((state, index) => ({
			phaseKey: state.key,
			label: state.label,
			displayOrder: (index + 1) * 10,
			editable: !state.terminal,
			deletable: false,
			revisable: true
		})),
		roles: [
			{ roleKey: 'owner', label: 'Object owner' },
			{ roleKey: 'reviewer', label: 'Reviewer' },
			{ roleKey: 'approver', label: 'Approver' }
		],
		accessRules: [],
		transitions: object.lifecycle.transitions.map((transition) => ({
			fromState: transition.from,
			toState: transition.to,
			label: transition.label,
			requiresNote: transition.requiresNote ?? false,
			requiresTargetReference: false,
			tone: transition.tone ?? 'default',
			requiredPermissionKey: null,
			workflowKey: transition.workflowFamily
				? workflowTemplateKey(object.objectType, transition.workflowFamily)
				: null
		}))
	};
}

function workflowSnapshot(
	object: ObjectTypeDefinition,
	family: WorkflowFamilyKey,
	name: string,
	purpose: string,
	templateKey: string
) {
	const blueprint = workflowBlueprints[family];
	return {
		key: templateKey,
		version: '1.0',
		status: 'draft',
		name: `${object.name} · ${name}`,
		description: purpose,
		roles: blueprint.roles.map((role) => role.key),
		variables: [],
		nodes: blueprint.nodes.map((node) => ({
			key: node.key,
			label: node.label,
			type: node.type,
			responsibleRoleKey: node.responsibleRoleKey
		})),
		links: blueprint.nodes.slice(0, -1).map((node, index) => ({
			from: node.key,
			to: blueprint.nodes[index + 1].key
		}))
	};
}

async function existingTemplatePublicId(
	connection: PoolConnection,
	table: 'lifecycle_templates' | 'workflow_templates',
	organisationId: string,
	templateKey: string
): Promise<string | null> {
	const [rows] = await connection.execute<Array<RowDataPacket & { publicId: string }>>(
		`SELECT public_id AS publicId FROM ${table}
		 WHERE organisation_id = ? AND template_key = ?
		 ORDER BY version_number DESC, id DESC LIMIT 1 FOR UPDATE`,
		[organisationId, templateKey]
	);
	return rows[0]?.publicId ?? null;
}

async function insertLifecycle(
	connection: PoolConnection,
	actor: EvidenceActor,
	object: ObjectTypeDefinition
): Promise<{ publicId: string; created: boolean }> {
	const templateKey = lifecycleTemplateKey(object.objectType);
	const existing = await existingTemplatePublicId(
		connection,
		'lifecycle_templates',
		actor.organisationId,
		templateKey
	);
	if (existing) return { publicId: existing, created: false };

	const publicId = randomUUID();
	const [insert] = await connection.execute<ResultSetHeader>(
		`INSERT INTO lifecycle_templates
		 (organisation_id, public_id, template_key, version_number, minor_version_number,
		  name, description, object_type, mode, initial_state, lifecycle_status, created_by_member_id)
		 VALUES (?, ?, ?, 1, 1, ?, ?, ?, 'advanced', ?, 'draft', ?)`,
		[
			actor.organisationId,
			publicId,
			templateKey,
			`${object.name} lifecycle`,
			object.description,
			object.objectType,
			object.lifecycle.initialState,
			actor.memberId
		]
	);
	const lifecycleTemplateId = insert.insertId;

	for (const [index, state] of object.lifecycle.states.entries()) {
		await connection.execute(
			`INSERT INTO lifecycle_template_phases
			 (organisation_id, lifecycle_template_id, phase_key, label, display_order,
			  is_editable, is_deletable, is_revisable)
			 VALUES (?, ?, ?, ?, ?, ?, FALSE, TRUE)`,
			[
				actor.organisationId,
				lifecycleTemplateId,
				state.key,
				state.label,
				(index + 1) * 10,
				!state.terminal
			]
		);
	}

	for (const role of [
		{ key: 'owner', label: 'Object owner' },
		{ key: 'reviewer', label: 'Reviewer' },
		{ key: 'approver', label: 'Approver' }
	]) {
		await connection.execute(
			`INSERT INTO lifecycle_template_roles
			 (organisation_id, lifecycle_template_id, role_key, label, description)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				actor.organisationId,
				lifecycleTemplateId,
				role.key,
				role.label,
				`Starter lifecycle role for ${object.name}. Map this to organisation roles before activation where required.`
			]
		);
	}

	for (const transition of object.lifecycle.transitions) {
		const starter = transition.workflowFamily
			? object.workflows.find((workflow) => workflow.family === transition.workflowFamily)
			: null;
		await connection.execute(
			`INSERT INTO lifecycle_template_transitions
			 (organisation_id, lifecycle_template_id, public_id, from_state, to_state, label,
			  requires_note, requires_target_reference, tone, required_permission_key, workflow_key)
			 VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?, NULL, ?)`,
			[
				actor.organisationId,
				lifecycleTemplateId,
				randomUUID(),
				transition.from,
				transition.to,
				transition.label,
				transition.requiresNote ?? false,
				transition.tone ?? 'default',
				starter ? workflowTemplateKey(object.objectType, starter.family) : null
			]
		);
	}

	await appendGovernedVersion(connection, {
		actor,
		domainCode: 'PLATFORM',
		recordType: 'lifecycle_template',
		lineageKey: templateKey,
		recordPublicId: publicId,
		versionNumber: 1,
		minorVersionNumber: 1,
		lifecycleStatus: 'draft',
		snapshot: lifecycleSnapshot(object, templateKey),
		changeNote: 'Starter lifecycle installed from the NuBlox object registry',
		published: false
	});

	return { publicId, created: true };
}

async function insertWorkflow(
	connection: PoolConnection,
	actor: EvidenceActor,
	object: ObjectTypeDefinition,
	workflow: ObjectTypeDefinition['workflows'][number]
): Promise<{ publicId: string; created: boolean; templateKey: string }> {
	const templateKey = workflowTemplateKey(object.objectType, workflow.family);
	const existing = await existingTemplatePublicId(
		connection,
		'workflow_templates',
		actor.organisationId,
		templateKey
	);
	if (existing) return { publicId: existing, created: false, templateKey };

	const publicId = randomUUID();
	const [insert] = await connection.execute<ResultSetHeader>(
		`INSERT INTO workflow_templates
		 (organisation_id, public_id, template_key, version_number, minor_version_number,
		  name, description, lifecycle_status, created_by_member_id)
		 VALUES (?, ?, ?, 1, 1, ?, ?, 'draft', ?)`,
		[
			actor.organisationId,
			publicId,
			templateKey,
			`${object.name} · ${workflow.name}`,
			workflow.purpose,
			actor.memberId
		]
	);
	const workflowTemplateId = insert.insertId;
	const blueprint = workflowBlueprints[workflow.family];

	for (const role of blueprint.roles) {
		await connection.execute(
			`INSERT INTO workflow_template_roles
			 (organisation_id, workflow_template_id, role_key, label, description)
			 VALUES (?, ?, ?, ?, ?)`,
			[
				actor.organisationId,
				workflowTemplateId,
				role.key,
				role.label,
				`Starter participant role for ${workflow.name}.`
			]
		);
	}

	const nodeIds = new Map<string, number>();
	for (const [index, node] of blueprint.nodes.entries()) {
		const [nodeInsert] = await connection.execute<ResultSetHeader>(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type,
			  responsible_role_key, display_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				actor.organisationId,
				workflowTemplateId,
				randomUUID(),
				node.key,
				node.label,
				node.type,
				node.responsibleRoleKey ?? null,
				(index + 1) * 10
			]
		);
		nodeIds.set(node.key, nodeInsert.insertId);
	}

	for (let index = 0; index < blueprint.nodes.length - 1; index += 1) {
		const from = blueprint.nodes[index];
		const to = blueprint.nodes[index + 1];
		await connection.execute(
			`INSERT INTO workflow_template_links
			 (organisation_id, workflow_template_id, public_id, from_node_id, to_node_id, display_order)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[
				actor.organisationId,
				workflowTemplateId,
				randomUUID(),
				nodeIds.get(from.key),
				nodeIds.get(to.key),
				(index + 1) * 10
			]
		);
	}

	await appendGovernedVersion(connection, {
		actor,
		domainCode: 'PLATFORM',
		recordType: 'workflow_template',
		lineageKey: templateKey,
		recordPublicId: publicId,
		versionNumber: 1,
		minorVersionNumber: 1,
		lifecycleStatus: 'draft',
		snapshot: workflowSnapshot(
			object,
			workflow.family,
			workflow.name,
			workflow.purpose,
			templateKey
		),
		changeNote: 'Starter workflow installed from the NuBlox object registry',
		published: false
	});

	return { publicId, created: true, templateKey };
}

export async function listObjectTemplateLibrary(
	actor: EvidenceActor
): Promise<ObjectTemplateLibraryGroup[]> {
	await requirePermissions(actor, ['lifecycle.view', 'workflow.view']);
	const [lifecycleRows] = await getPool().execute<Array<RowDataPacket & { templateKey: string }>>(
		`SELECT DISTINCT template_key AS templateKey
		 FROM lifecycle_templates WHERE organisation_id = ?`,
		[actor.organisationId]
	);
	const [workflowRows] = await getPool().execute<Array<RowDataPacket & { templateKey: string }>>(
		`SELECT DISTINCT template_key AS templateKey
		 FROM workflow_templates WHERE organisation_id = ?`,
		[actor.organisationId]
	);
	const lifecycleKeys = new Set(lifecycleRows.map((row) => row.templateKey));
	const workflowKeys = new Set(workflowRows.map((row) => row.templateKey));

	return functionObjectRegistry.map((group) => ({
		functionId: group.functionId,
		functionName: group.functionName,
		objects: group.objects.map((object) => {
			const lifecycleInstalled = lifecycleKeys.has(lifecycleTemplateKey(object.objectType));
			const installedWorkflowCount = object.workflows.filter((workflow) =>
				workflowKeys.has(workflowTemplateKey(object.objectType, workflow.family))
			).length;
			return {
				...object,
				lifecycleInstalled,
				installedWorkflowCount,
				workflowCount: object.workflows.length,
				fullyInstalled: lifecycleInstalled && installedWorkflowCount === object.workflows.length
			};
		})
	}));
}

export async function installObjectTemplatePack(input: {
	actor: EvidenceActor;
	objectType: string;
}): Promise<{
	lifecyclePublicId: string;
	workflowPublicIds: string[];
	createdLifecycle: boolean;
	createdWorkflowCount: number;
}> {
	await requirePermissions(input.actor, ['lifecycle.manage', 'workflow.manage']);
	const object = getObjectTypeDefinition(input.objectType);
	if (!object) {
		throw new ObjectTemplateLibraryValidationError(
			'The selected object type is not present in the canonical NuBlox object registry.'
		);
	}

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const lifecycle = await insertLifecycle(connection, input.actor, object);
		const workflowResults = [] as Array<{
			publicId: string;
			created: boolean;
			templateKey: string;
		}>;
		for (const workflow of object.workflows) {
			workflowResults.push(await insertWorkflow(connection, input.actor, object, workflow));
		}
		const createdWorkflowCount = workflowResults.filter((result) => result.created).length;
		if (lifecycle.created || createdWorkflowCount > 0) {
			await appendDomainEvidence(connection, {
				actor: input.actor,
				actionKey: 'platform.object-template.install',
				subjectType: 'object_type',
				subjectPublicId: object.objectType,
				changeSummary: {
					functionId: object.functionId,
					objectType: object.objectType,
					lifecycleTemplateKey: lifecycleTemplateKey(object.objectType),
					workflowTemplateKeys: workflowResults.map((result) => result.templateKey),
					createdLifecycle: lifecycle.created,
					createdWorkflowCount
				},
				eventMetadata: { function: 'PLATFORM', mutation: 'install-object-template-pack' }
			});
		}
		await connection.commit();
		return {
			lifecyclePublicId: lifecycle.publicId,
			workflowPublicIds: workflowResults.map((result) => result.publicId),
			createdLifecycle: lifecycle.created,
			createdWorkflowCount
		};
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
