import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { loadWorkflowDefinitionById } from './workflow-admin-service';
import type { WorkflowTemplate } from './workflow-kernel';

type BindingRow = RowDataPacket & {
	workflowTemplateId: number | string;
};

export async function resolveWorkflowTemplateForEvent(input: {
	organisationId: string;
	sourceDomain: string;
	sourceType: string;
	eventKey: string;
}): Promise<WorkflowTemplate | null> {
	const connection = await getPool().getConnection();
	try {
		const [rows] = await connection.execute<BindingRow[]>(
			`SELECT binding.workflow_template_id AS workflowTemplateId
			 FROM workflow_object_bindings binding
			 JOIN workflow_templates template
			   ON template.id = binding.workflow_template_id
			  AND template.organisation_id = binding.organisation_id
			  AND template.lifecycle_status = 'published'
			 WHERE binding.organisation_id = ?
			   AND binding.source_domain = ?
			   AND binding.source_type = ?
			   AND binding.event_key = ?
			 LIMIT 1`,
			[input.organisationId, input.sourceDomain, input.sourceType, input.eventKey]
		);
		if (!rows[0]) return null;
		return await loadWorkflowDefinitionById(
			connection,
			input.organisationId,
			Number(rows[0].workflowTemplateId)
		);
	} finally {
		connection.release();
	}
}

export async function loadPublishedWorkflowTemplate(input: {
	organisationId: string;
	templateKey: string;
	versionNumber?: number;
}): Promise<WorkflowTemplate | null> {
	const connection = await getPool().getConnection();
	try {
		const values: Array<string | number> = [input.organisationId, input.templateKey];
		let versionClause = '';
		if (input.versionNumber !== undefined) {
			versionClause = ' AND version_number = ?';
			values.push(input.versionNumber);
		}
		const [rows] = await connection.execute<BindingRow[]>(
			`SELECT id AS workflowTemplateId
			 FROM workflow_templates
			 WHERE organisation_id = ? AND template_key = ? AND lifecycle_status = 'published'
			 ${versionClause}
			 ORDER BY version_number DESC LIMIT 1`,
			values
		);
		if (!rows[0]) return null;
		return await loadWorkflowDefinitionById(
			connection,
			input.organisationId,
			Number(rows[0].workflowTemplateId)
		);
	} finally {
		connection.release();
	}
}
