import type { RowDataPacket } from 'mysql2/promise';
import { hasPermission } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from './evidence';
import { appendGovernedVersion } from './governed-versioning';
import { loadWorkflowDefinitionById } from './workflow-admin-service';

export class WorkflowDesignerAccessError extends Error {}
export class WorkflowDesignerValidationError extends Error {}

type TemplateRow = RowDataPacket & {
	id: number | string;
	publicId: string;
	templateKey: string;
	versionNumber: number | string;
	minorVersionNumber: number | string;
	status: 'draft' | 'published' | 'superseded';
};

type NodeRow = RowDataPacket & {
	nodeKey: string;
	nodeType: string;
};

async function requireManage(actor: EvidenceActor): Promise<void> {
	const allowed = await hasPermission({
		organisationId: actor.organisationId,
		memberId: actor.memberId,
		permissionKey: 'workflow.manage'
	});
	if (!allowed) throw new WorkflowDesignerAccessError('Workflow design access is required.');
}

export async function reorderWorkflowNodes(input: {
	actor: EvidenceActor;
	publicId: string;
	nodeKeys: string[];
}): Promise<void> {
	await requireManage(input.actor);
	const requested = input.nodeKeys.map((value) => value.trim()).filter(Boolean);
	if (requested.length < 2) {
		throw new WorkflowDesignerValidationError('A workflow must contain at least Start and End.');
	}
	if (new Set(requested).size !== requested.length) {
		throw new WorkflowDesignerValidationError('Workflow design order contains duplicate nodes.');
	}

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [templates] = await connection.execute<TemplateRow[]>(
			`SELECT id, public_id AS publicId, template_key AS templateKey,
			        version_number AS versionNumber, minor_version_number AS minorVersionNumber,
			        lifecycle_status AS status
			 FROM workflow_templates
			 WHERE organisation_id = ? AND public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.publicId]
		);
		const template = templates[0];
		if (!template) throw new WorkflowDesignerValidationError('Workflow template was not found.');
		if (template.status !== 'draft') {
			throw new WorkflowDesignerValidationError(
				'Published workflow versions are immutable. Create a revision before changing the design.'
			);
		}

		const templateId = Number(template.id);
		const [nodes] = await connection.execute<NodeRow[]>(
			`SELECT node_key AS nodeKey, node_type AS nodeType
			 FROM workflow_template_nodes
			 WHERE organisation_id = ? AND workflow_template_id = ?
			 ORDER BY display_order, id
			 FOR UPDATE`,
			[input.actor.organisationId, templateId]
		);
		const actual = new Set(nodes.map((node) => node.nodeKey));
		if (requested.length !== nodes.length || requested.some((nodeKey) => !actual.has(nodeKey))) {
			throw new WorkflowDesignerValidationError(
				'The workflow changed while you were designing it. Refresh before reordering again.'
			);
		}
		const start = nodes.find((node) => node.nodeType === 'start');
		const end = nodes.find((node) => node.nodeType === 'end');
		if (!start || !end || requested[0] !== start.nodeKey || requested.at(-1) !== end.nodeKey) {
			throw new WorkflowDesignerValidationError('Start must remain first and End must remain last.');
		}

		for (const [index, nodeKey] of requested.entries()) {
			await connection.execute(
				`UPDATE workflow_template_nodes
				 SET display_order = ?
				 WHERE organisation_id = ? AND workflow_template_id = ? AND node_key = ?`,
				[(index + 1) * 10, input.actor.organisationId, templateId, nodeKey]
			);
		}
		await connection.execute(
			`UPDATE workflow_templates
			 SET minor_version_number = minor_version_number + 1
			 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
			[input.actor.organisationId, templateId]
		);
		const [refreshedRows] = await connection.execute<Array<RowDataPacket & { minorVersionNumber: number | string }>>(
			`SELECT minor_version_number AS minorVersionNumber
			 FROM workflow_templates WHERE organisation_id = ? AND id = ? LIMIT 1`,
			[input.actor.organisationId, templateId]
		);
		const definition = await loadWorkflowDefinitionById(
			connection,
			input.actor.organisationId,
			templateId
		);
		await appendGovernedVersion(connection, {
			actor: input.actor,
			domainCode: 'PLATFORM',
			recordType: 'workflow_template',
			lineageKey: template.templateKey,
			recordPublicId: template.publicId,
			versionNumber: Number(template.versionNumber),
			minorVersionNumber: Number(refreshedRows[0]?.minorVersionNumber ?? template.minorVersionNumber),
			lifecycleStatus: 'draft',
			snapshot: JSON.parse(JSON.stringify(definition)) as Record<string, unknown>,
			changeNote: 'Workflow graphical design reordered'
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'workflow.template.reordered',
			subjectType: 'workflow_template',
			subjectPublicId: template.publicId,
			changeSummary: { nodeOrder: requested },
			eventMetadata: { function: 'PLATFORM', mutation: 'graphical-reorder' }
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
