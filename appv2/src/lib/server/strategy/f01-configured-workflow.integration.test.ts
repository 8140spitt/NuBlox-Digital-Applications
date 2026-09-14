import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { workflowTemplateKey } from '$lib/platform/object-template-registry';
import { getPool } from '$lib/server/db/pool';
import {
	activateLifecycleTemplate,
	publishLifecycleTemplate
} from '$lib/server/platform/lifecycle-admin-service';
import { installObjectTemplatePack } from '$lib/server/platform/object-template-library-service';
import { publishWorkflowTemplate } from '$lib/server/platform/workflow-admin-service';
import { listPendingWorkflowTasks } from '$lib/server/platform/workflow-request-service';
import { createStrategyFramework } from './f01-service';
import { getF01ManagedRecord } from './f01-record-management-service';
import { decideF01WorkflowRequest, submitF01WorkflowTransition } from './f01-workflow-service';

type Actor = { organisationId: string; userId: string; memberId: string };
type SqlValue = string | number | boolean | Date | null;

const PREFIX = 'V2 Configured Workflow';
let actor: Actor;
let organisationId = '';
let userId = '';

async function insertId(sql: string, values: SqlValue[]): Promise<string> {
	const [result] = await getPool().execute<ResultSetHeader>(sql, values);
	return result.insertId.toString();
}

async function seedAuthority(): Promise<void> {
	userId = await insertId(
		`INSERT INTO users (public_id, display_name, status) VALUES (?, ?, 'active')`,
		[randomUUID(), `${PREFIX} User`]
	);
	organisationId = await insertId(
		`INSERT INTO organisations (public_id, legal_name, default_timezone, default_currency_code, status)
		 VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[randomUUID(), `${PREFIX} Organisation`]
	);
	const memberId = await insertId(
		`INSERT INTO organisation_members (organisation_id, user_id, public_id, status, joined_at)
		 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6))`,
		[organisationId, userId, randomUUID()]
	);
	const roleId = await insertId(
		`INSERT INTO organisation_roles (organisation_id, public_id, name, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, randomUUID(), `${PREFIX} Administrator`]
	);
	const permissionKeys = [
		'strategy.view',
		'strategy.manage',
		'strategy.approve',
		'lifecycle.view',
		'lifecycle.manage',
		'lifecycle.publish',
		'workflow.view',
		'workflow.manage',
		'workflow.publish'
	];
	const [permissions] = await getPool().execute<
		Array<RowDataPacket & { id: string | number; permissionKey: string }>
	>(
		`SELECT id, permission_key AS permissionKey FROM permissions
		 WHERE permission_key IN (${permissionKeys.map(() => '?').join(',')}) AND is_active = 1`,
		permissionKeys
	);
	expect(permissions).toHaveLength(permissionKeys.length);
	for (const permission of permissions) {
		await getPool().execute(
			`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
			 VALUES (?, ?, ?)`,
			[organisationId, roleId, permission.id]
		);
	}
	await getPool().execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		 VALUES (?, ?, ?)`,
		[organisationId, memberId, roleId]
	);
	actor = { organisationId, userId, memberId };
}

async function cleanup(): Promise<void> {
	if (!organisationId) return;
	const connection = await getPool().getConnection();
	try {
		await connection.query('SET FOREIGN_KEY_CHECKS = 0');
		const [tables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName
			 FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'organisation_id'`
		);
		for (const table of tables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(`DELETE FROM \`${table.tableName}\` WHERE organisation_id = ?`, [
				organisationId
			]);
		}
		const [ownerTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName
			 FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'owning_organisation_id'`
		);
		for (const table of ownerTables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(
				`DELETE FROM \`${table.tableName}\` WHERE owning_organisation_id = ?`,
				[organisationId]
			);
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

describe('configured lifecycle and authored workflow runtime', () => {
	it('executes the installed published graph before advancing a native F01 lifecycle', async () => {
		const installed = await installObjectTemplatePack({
			actor,
			objectType: 'strategy.strategy-cycle'
		});
		await publishLifecycleTemplate({ actor, publicId: installed.lifecyclePublicId });
		await activateLifecycleTemplate({ actor, publicId: installed.lifecyclePublicId });

		const approvalKey = workflowTemplateKey('strategy.strategy-cycle', 'approval');
		const [workflowRows] = await getPool().execute<Array<RowDataPacket & { publicId: string }>>(
			`SELECT public_id AS publicId FROM workflow_templates
			 WHERE organisation_id = ? AND template_key = ? ORDER BY version_number DESC LIMIT 1`,
			[organisationId, approvalKey]
		);
		expect(workflowRows[0]?.publicId).toBeTruthy();
		await publishWorkflowTemplate({ actor, publicId: workflowRows[0]!.publicId });

		const framework = await createStrategyFramework({
			actor,
			title: 'Configured workflow strategy',
			horizonStart: '2027-01-01',
			horizonEnd: '2030-12-31',
			purpose: 'Prove installed lifecycle and workflow execution.',
			vision: 'Configured policy drives native business execution.',
			mission: 'Eliminate disconnected administration-only workflow.'
		});

		let managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: framework.publicId,
			kind: 'framework',
			recordPublicId: framework.publicId
		});
		expect(managed.status).toBe('draft');
		expect(managed.transitions.find((transition) => transition.to === 'approved')?.workflowKey).toBe(
			approvalKey
		);

		const request = await submitF01WorkflowTransition({
			actor,
			frameworkPublicId: framework.publicId,
			kind: 'framework',
			recordPublicId: framework.publicId,
			targetStatus: 'approved',
			note: 'Submit through the installed configured workflow.'
		});
		expect(request).not.toBeNull();

		let pending = await listPendingWorkflowTasks({ organisationId, memberId: actor.memberId });
		let task = pending.find((item) => item.requestPublicId === request!.requestPublicId);
		expect(task).toMatchObject({
			workflowKey: approvalKey,
			nodeKey: 'prepare',
			stepNumber: 1,
			workflowState: 'running',
			willCompleteOnApprove: false
		});

		await decideF01WorkflowRequest({
			actor,
			requestPublicId: request!.requestPublicId,
			decision: 'approved',
			note: 'Decision pack prepared.'
		});
		managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: framework.publicId,
			kind: 'framework',
			recordPublicId: framework.publicId
		});
		expect(managed.status).toBe('draft');

		pending = await listPendingWorkflowTasks({ organisationId, memberId: actor.memberId });
		task = pending.find((item) => item.requestPublicId === request!.requestPublicId);
		expect(task).toMatchObject({ nodeKey: 'review', stepNumber: 2, willCompleteOnApprove: false });

		await decideF01WorkflowRequest({
			actor,
			requestPublicId: request!.requestPublicId,
			decision: 'approved',
			note: 'Evidence reviewed.'
		});
		managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: framework.publicId,
			kind: 'framework',
			recordPublicId: framework.publicId
		});
		expect(managed.status).toBe('draft');

		pending = await listPendingWorkflowTasks({ organisationId, memberId: actor.memberId });
		task = pending.find((item) => item.requestPublicId === request!.requestPublicId);
		expect(task).toMatchObject({ nodeKey: 'approve', stepNumber: 3, willCompleteOnApprove: true });

		const completed = await decideF01WorkflowRequest({
			actor,
			requestPublicId: request!.requestPublicId,
			decision: 'approved',
			note: 'Strategy approved after configured workflow completion.'
		});
		expect(completed.workflowCompleted).toBe(true);

		managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: framework.publicId,
			kind: 'framework',
			recordPublicId: framework.publicId
		});
		expect(managed.status).toBe('approved');

		pending = await listPendingWorkflowTasks({ organisationId, memberId: actor.memberId });
		expect(pending.some((item) => item.requestPublicId === request!.requestPublicId)).toBe(false);

		const [steps] = await getPool().execute<
			Array<RowDataPacket & { nodeKey: string; stepStatus: string; outcome: string | null }>
		>(
			`SELECT step.node_key AS nodeKey, step.step_status AS stepStatus, step.outcome
			 FROM workflow_request_steps step
			 JOIN workflow_requests request ON request.id = step.workflow_request_id
			  AND request.organisation_id = step.organisation_id
			 WHERE step.organisation_id = ? AND request.public_id = ? ORDER BY step.step_number`,
			[organisationId, request!.requestPublicId]
		);
		expect(steps.map((step) => step.nodeKey)).toEqual(['prepare', 'review', 'approve', 'end']);
		expect(steps.every((step) => step.stepStatus === 'completed')).toBe(true);

		const [runtimeRows] = await getPool().execute<
			Array<RowDataPacket & { status: string; workflowState: string; currentNodeKey: string }>
		>(
			`SELECT status, workflow_state AS workflowState, current_node_key AS currentNodeKey
			 FROM workflow_requests WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
			[organisationId, request!.requestPublicId]
		);
		expect(runtimeRows[0]).toMatchObject({
			status: 'approved',
			workflowState: 'completed',
			currentNodeKey: 'end'
		});
	});
});
