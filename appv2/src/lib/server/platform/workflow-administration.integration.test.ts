import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '$lib/server/db/pool';
import {
	addWorkflowLink,
	addWorkflowNode,
	addWorkflowParticipant,
	addWorkflowRole,
	addWorkflowVariable,
	bindWorkflowTemplate,
	createWorkflowTemplate,
	deleteWorkflowLink,
	getWorkflowTemplate,
	publishWorkflowTemplate,
	reviseWorkflowTemplate,
	updateWorkflowTemplate,
	WorkflowAdministrationValidationError
} from './workflow-admin-service';
import type { EvidenceActor } from './evidence';
import { resolveWorkflowTemplateForEvent } from './workflow-registry-service';

type SqlValue = string | number | boolean | Date | null;

let actor: EvidenceActor;
let organisationId = '';
let userId = '';

async function insertId(sql: string, values: SqlValue[]): Promise<string> {
	const [result] = await getPool().execute<ResultSetHeader>(sql, values);
	return result.insertId.toString();
}

async function seedAuthority(): Promise<void> {
	userId = await insertId(
		`INSERT INTO users (public_id, display_name, status) VALUES (?, ?, 'active')`,
		[randomUUID(), 'Workflow administrator user']
	);
	organisationId = await insertId(
		`INSERT INTO organisations (public_id, legal_name, default_timezone, default_currency_code, status)
		 VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[randomUUID(), 'Workflow administration organisation']
	);
	const memberId = await insertId(
		`INSERT INTO organisation_members (organisation_id, user_id, public_id, status, joined_at)
		 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6))`,
		[organisationId, userId, randomUUID()]
	);
	const roleId = await insertId(
		`INSERT INTO organisation_roles (organisation_id, public_id, name, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, randomUUID(), 'Workflow Administrator']
	);
	const [permissions] = await getPool().execute<Array<RowDataPacket & { id: number | string }>>(
		`SELECT id FROM permissions
		 WHERE permission_key IN ('workflow.view', 'workflow.manage', 'workflow.publish') AND is_active = 1`
	);
	expect(permissions).toHaveLength(3);
	for (const permission of permissions) {
		await getPool().execute(
			`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id) VALUES (?, ?, ?)`,
			[organisationId, roleId, permission.id]
		);
	}
	await getPool().execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id) VALUES (?, ?, ?)`,
		[organisationId, memberId, roleId]
	);
	actor = { organisationId, userId, memberId };
}

async function cleanup(): Promise<void> {
	if (!organisationId) return;
	const connection = await getPool().getConnection();
	try {
		await connection.query('SET FOREIGN_KEY_CHECKS = 0');
		const [organisationTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'organisation_id'`
		);
		for (const table of organisationTables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(`DELETE FROM \`${table.tableName}\` WHERE organisation_id = ?`, [organisationId]);
		}
		const [actingTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'acting_organisation_id'`
		);
		for (const table of actingTables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(`DELETE FROM \`${table.tableName}\` WHERE acting_organisation_id = ?`, [organisationId]);
		}
		await connection.query('DELETE FROM organisations WHERE id = ?', [organisationId]);
		await connection.query('DELETE FROM users WHERE id = ?', [userId]);
	} finally {
		await connection.query('SET FOREIGN_KEY_CHECKS = 1');
		connection.release();
	}
}

beforeAll(async () => {
	await seedAuthority();
});

afterAll(async () => {
	await cleanup();
	await getPool().end();
});

describe('workflow administration', () => {
	it('creates, publishes, binds and revises a typed workflow without mutating published definitions', async () => {
		const created = await createWorkflowTemplate({
			actor,
			templateKey: `approval-${randomUUID().slice(0, 8)}`,
			name: 'Governed approval',
			description: 'Production proving template.'
		});
		let detail = await getWorkflowTemplate(actor, created.publicId);
		expect(detail.status).toBe('draft');
		expect(detail.nodes.map((node) => node.nodeKey)).toEqual(['start', 'end']);
		expect(detail.links).toHaveLength(1);

		await deleteWorkflowLink({
			actor,
			publicId: created.publicId,
			linkPublicId: detail.links[0]!.publicId
		});
		await addWorkflowRole({
			actor,
			publicId: created.publicId,
			roleKey: 'approver',
			label: 'Approver',
			description: 'Makes the governed decision.'
		});
		await addWorkflowVariable({
			actor,
			publicId: created.publicId,
			variableKey: 'source_reference',
			variableType: 'object_reference',
			variableScope: 'process',
			required: true
		});
		await addWorkflowNode({
			actor,
			publicId: created.publicId,
			nodeKey: 'review',
			label: 'Review and decide',
			nodeType: 'activity',
			responsibleRoleKey: 'approver',
			completionRuleType: 'all',
			deadlineMinutes: 1440,
			deadlineRelativeTo: 'node_start',
			overdueAction: 'escalate',
			recordReassignments: true,
			displayOrder: 50
		});
		await addWorkflowParticipant({
			actor,
			publicId: created.publicId,
			nodeKey: 'review',
			participantType: 'workflow_role',
			participantKey: 'approver',
			required: true
		});
		await addWorkflowLink({
			actor,
			publicId: created.publicId,
			fromNodeKey: 'start',
			toNodeKey: 'review',
			displayOrder: 10
		});
		await addWorkflowLink({
			actor,
			publicId: created.publicId,
			fromNodeKey: 'review',
			toNodeKey: 'end',
			eventKey: 'approved',
			displayOrder: 20
		});

		await publishWorkflowTemplate({ actor, publicId: created.publicId });
		detail = await getWorkflowTemplate(actor, created.publicId);
		expect(detail.status).toBe('published');
		expect(detail.versionLabel).toBe('1.0');
		expect(detail.nodes.find((node) => node.nodeKey === 'review')).toMatchObject({
			responsibleRoleKey: 'approver',
			deadlineMinutes: 1440
		});

		await bindWorkflowTemplate({
			actor,
			publicId: created.publicId,
			sourceDomain: 'strategy',
			sourceType: 'framework',
			eventKey: 'submit_for_approval'
		});
		const runtime = await resolveWorkflowTemplateForEvent({
			organisationId,
			sourceDomain: 'strategy',
			sourceType: 'framework',
			eventKey: 'submit_for_approval'
		});
		expect(runtime).not.toBeNull();
		expect(runtime?.key).toBe(detail.templateKey);
		expect(runtime?.nodes.find((node) => node.key === 'review')?.participants).toEqual([
			{ participantType: 'workflow_role', participantKey: 'approver', required: true }
		]);

		await expect(
			updateWorkflowTemplate({
				actor,
				publicId: created.publicId,
				name: 'Illegal published mutation'
			})
		).rejects.toBeInstanceOf(WorkflowAdministrationValidationError);

		const revision = await reviseWorkflowTemplate({ actor, publicId: created.publicId });
		let revisionDetail = await getWorkflowTemplate(actor, revision.publicId);
		expect(revisionDetail.status).toBe('draft');
		expect(revisionDetail.versionLabel).toBe('1.1');
		expect(revisionDetail.nodes.map((node) => node.nodeKey)).toEqual(['start', 'review', 'end']);
		expect(revisionDetail.participants).toHaveLength(1);
		expect(revisionDetail.links).toHaveLength(2);

		await updateWorkflowTemplate({
			actor,
			publicId: revision.publicId,
			name: 'Governed approval v2',
			description: 'Controlled successor definition.'
		});
		await publishWorkflowTemplate({ actor, publicId: revision.publicId });
		revisionDetail = await getWorkflowTemplate(actor, revision.publicId);
		expect(revisionDetail.status).toBe('published');
		expect(revisionDetail.versionLabel).toBe('2.0');
		expect((await getWorkflowTemplate(actor, created.publicId)).status).toBe('superseded');

		const reboundRuntime = await resolveWorkflowTemplateForEvent({
			organisationId,
			sourceDomain: 'strategy',
			sourceType: 'framework',
			eventKey: 'submit_for_approval'
		});
		expect(reboundRuntime?.name).toBe('Governed approval v2');
		expect(reboundRuntime?.version).toBe('2.0');
	});
});
