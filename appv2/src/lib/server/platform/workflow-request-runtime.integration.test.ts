import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '$lib/server/db/pool';
import {
	WorkflowAccessError,
	finaliseWorkflowRequest,
	getPendingWorkflowTask,
	listPendingWorkflowTasks,
	submitLifecycleWorkflow
} from './workflow-request-service';

type Actor = { organisationId: string; userId: string; memberId: string };
type SqlValue = string | number | boolean | Date | null;

const PREFIX = 'V2 Workflow Runtime Review';
let organisationId = '';
const userIds: string[] = [];
let actor: Actor;
let reviewer: Actor;
let actorMemberPublicId = '';
let teamPublicId = '';

async function insertId(sql: string, values: SqlValue[]): Promise<string> {
	const [result] = await getPool().execute<ResultSetHeader>(sql, values);
	return result.insertId.toString();
}

async function createMember(name: string): Promise<{ actor: Actor; publicId: string }> {
	const userId = await insertId(
		`INSERT INTO users (public_id, display_name, status) VALUES (?, ?, 'active')`,
		[randomUUID(), name]
	);
	userIds.push(userId);
	const publicId = randomUUID();
	const memberId = await insertId(
		`INSERT INTO organisation_members (organisation_id, user_id, public_id, status, joined_at)
		 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6))`,
		[organisationId, userId, publicId]
	);
	return { actor: { organisationId, userId, memberId }, publicId };
}

async function seed(): Promise<void> {
	organisationId = await insertId(
		`INSERT INTO organisations (public_id, legal_name, default_timezone, default_currency_code, status)
		 VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[randomUUID(), `${PREFIX} Organisation`]
	);
	const owner = await createMember(`${PREFIX} Owner`);
	actor = owner.actor;
	actorMemberPublicId = owner.publicId;
	const reviewMember = await createMember(`${PREFIX} Reviewer`);
	reviewer = reviewMember.actor;

	const roleId = await insertId(
		`INSERT INTO organisation_roles (organisation_id, public_id, name, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, randomUUID(), `${PREFIX} Approver`]
	);
	const [permissions] = await getPool().execute<Array<RowDataPacket & { id: string | number }>>(
		`SELECT id FROM permissions WHERE permission_key = 'strategy.approve' AND is_active = 1 LIMIT 1`
	);
	expect(permissions[0]).toBeTruthy();
	await getPool().execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id) VALUES (?, ?, ?)`,
		[organisationId, roleId, permissions[0]!.id]
	);
	await getPool().execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id) VALUES (?, ?, ?)`,
		[organisationId, actor.memberId, roleId]
	);

	teamPublicId = randomUUID();
	const teamId = await insertId(
		`INSERT INTO teams (organisation_id, public_id, name, description, is_active)
		 VALUES (?, ?, ?, ?, 1)`,
		[organisationId, teamPublicId, `${PREFIX} Review Team`, 'Exact workflow assignment team']
	);
	await getPool().execute(
		`INSERT INTO team_members (organisation_id, team_id, organisation_member_id) VALUES (?, ?, ?)`,
		[organisationId, teamId, reviewer.memberId]
	);

	const templateId = await insertId(
		`INSERT INTO workflow_templates
		 (organisation_id, public_id, template_key, version_number, minor_version_number, name,
		  description, lifecycle_status, created_by_member_id, published_by_member_id, published_at)
		 VALUES (?, ?, 'test.runtime-routing', 1, 0, ?, ?, 'published', ?, ?, CURRENT_TIMESTAMP(6))`,
		[
			organisationId,
			randomUUID(),
			`${PREFIX} Template`,
			'Exact participants and authored decision routing.',
			actor.memberId,
			actor.memberId
		]
	);
	const nodeIds = new Map<string, string>();
	const nodes: Array<[string, string, string]> = [
		['start', 'Start', 'start'],
		['prepare', 'Prepare', 'activity'],
		['review', 'Review', 'activity'],
		['approve', 'Approve or reject', 'checkpoint'],
		['end', 'End', 'end']
	];
	for (const [index, [key, label, type]] of nodes.entries()) {
		const id = await insertId(
			`INSERT INTO workflow_template_nodes
			 (organisation_id, workflow_template_id, public_id, node_key, label, node_type, display_order)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[organisationId, templateId, randomUUID(), key, label, type, (index + 1) * 10]
		);
		nodeIds.set(key, id);
	}
	await getPool().execute(
		`INSERT INTO workflow_node_participants
		 (organisation_id, workflow_template_id, workflow_node_id, participant_type, participant_key, is_required)
		 VALUES (?, ?, ?, 'member', ?, 1), (?, ?, ?, 'team', ?, 1)`,
		[
			organisationId,
			templateId,
			nodeIds.get('prepare'),
			actorMemberPublicId,
			organisationId,
			templateId,
			nodeIds.get('review'),
			teamPublicId
		]
	);
	const links: Array<[string, string, string | null]> = [
		['start', 'prepare', null],
		['prepare', 'review', null],
		['review', 'approve', null],
		['approve', 'end', null],
		['approve', 'review', 'return'],
		['approve', 'end', 'reject']
	];
	for (const [index, [from, to, event]] of links.entries()) {
		await getPool().execute(
			`INSERT INTO workflow_template_links
			 (organisation_id, workflow_template_id, public_id, from_node_id, to_node_id, event_key,
			  is_loop, terminate_open_predecessors, display_order)
			 VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?)`,
			[
				organisationId,
				templateId,
				randomUUID(),
				nodeIds.get(from),
				nodeIds.get(to),
				event,
				(index + 1) * 10
			]
		);
	}
}

async function cleanup(): Promise<void> {
	if (!organisationId) return;
	const connection = await getPool().getConnection();
	try {
		await connection.query('SET FOREIGN_KEY_CHECKS = 0');
		const [tables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'organisation_id'`
		);
		for (const table of tables) {
			if (/^[A-Za-z0-9_]+$/.test(table.tableName)) {
				await connection.query(`DELETE FROM \`${table.tableName}\` WHERE organisation_id = ?`, [
					organisationId
				]);
			}
		}
		const [ownerTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'owning_organisation_id'`
		);
		for (const table of ownerTables) {
			if (/^[A-Za-z0-9_]+$/.test(table.tableName)) {
				await connection.query(
					`DELETE FROM \`${table.tableName}\` WHERE owning_organisation_id = ?`,
					[organisationId]
				);
			}
		}
		await connection.query('DELETE FROM organisations WHERE id = ?', [organisationId]);
		for (const userId of userIds)
			await connection.query('DELETE FROM users WHERE id = ?', [userId]);
	} finally {
		await connection.query('SET FOREIGN_KEY_CHECKS = 1');
		connection.release();
	}
}

beforeAll(seed);
afterAll(cleanup);

describe('workflow runtime assignment and authored decision routing', () => {
	it('enforces member/team targets and follows return/reject routes', async () => {
		const request = await submitLifecycleWorkflow({
			actor,
			workflowKey: 'test.runtime-routing',
			sourceDomain: 'test',
			sourceType: 'controlled-object',
			sourcePublicId: randomUUID(),
			contextPublicId: randomUUID(),
			fromState: 'draft',
			toState: 'approved',
			transitionLabel: 'Approve',
			requiredPermissionKey: 'strategy.approve',
			note: 'Start participant and routing regression.'
		});

		await expect(
			getPendingWorkflowTask({
				organisationId,
				memberId: reviewer.memberId,
				requestPublicId: request.requestPublicId
			})
		).rejects.toBeInstanceOf(WorkflowAccessError);
		let task = await getPendingWorkflowTask({
			organisationId,
			memberId: actor.memberId,
			requestPublicId: request.requestPublicId
		});
		expect(task).toMatchObject({
			nodeKey: 'prepare',
			assignmentScope: 'member',
			assignedMemberId: actor.memberId
		});

		await finaliseWorkflowRequest({
			actor,
			requestPublicId: request.requestPublicId,
			decision: 'approved',
			note: 'Prepared.'
		});
		await expect(
			getPendingWorkflowTask({
				organisationId,
				memberId: actor.memberId,
				requestPublicId: request.requestPublicId
			})
		).rejects.toBeInstanceOf(WorkflowAccessError);
		task = await getPendingWorkflowTask({
			organisationId,
			memberId: reviewer.memberId,
			requestPublicId: request.requestPublicId
		});
		expect(task).toMatchObject({ nodeKey: 'review', assignmentScope: 'team' });

		await finaliseWorkflowRequest({
			actor: reviewer,
			requestPublicId: request.requestPublicId,
			decision: 'approved',
			note: 'Reviewed.'
		});
		task = await getPendingWorkflowTask({
			organisationId,
			memberId: actor.memberId,
			requestPublicId: request.requestPublicId
		});
		expect(task).toMatchObject({ nodeKey: 'approve', assignmentScope: 'organisation' });

		const returned = await finaliseWorkflowRequest({
			actor,
			requestPublicId: request.requestPublicId,
			decision: 'returned',
			note: 'Return to the authored review route.'
		});
		expect(returned).toEqual({ completed: false, decision: null, currentNodeKey: 'review' });
		await expect(
			getPendingWorkflowTask({
				organisationId,
				memberId: actor.memberId,
				requestPublicId: request.requestPublicId
			})
		).rejects.toBeInstanceOf(WorkflowAccessError);
		task = await getPendingWorkflowTask({
			organisationId,
			memberId: reviewer.memberId,
			requestPublicId: request.requestPublicId
		});
		expect(task).toMatchObject({ nodeKey: 'review', stepNumber: 4, assignmentScope: 'team' });

		await finaliseWorkflowRequest({
			actor: reviewer,
			requestPublicId: request.requestPublicId,
			decision: 'approved',
			note: 'Re-review complete.'
		});
		task = await getPendingWorkflowTask({
			organisationId,
			memberId: actor.memberId,
			requestPublicId: request.requestPublicId
		});
		expect(task).toMatchObject({ nodeKey: 'approve', stepNumber: 5 });

		const rejected = await finaliseWorkflowRequest({
			actor,
			requestPublicId: request.requestPublicId,
			decision: 'rejected',
			note: 'Reject through the authored terminal route.'
		});
		expect(rejected).toEqual({ completed: true, decision: 'rejected', currentNodeKey: 'end' });
		expect(
			(await listPendingWorkflowTasks({ organisationId, memberId: actor.memberId })).some(
				(item) => item.requestPublicId === request.requestPublicId
			)
		).toBe(false);

		const [runtime] = await getPool().execute<
			Array<
				RowDataPacket & {
					status: string;
					workflowState: string;
					currentNodeKey: string;
					stepNumber: number | string;
				}
			>
		>(
			`SELECT status, workflow_state AS workflowState, current_node_key AS currentNodeKey, step_number AS stepNumber
			 FROM workflow_requests WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
			[organisationId, request.requestPublicId]
		);
		expect(runtime[0]).toMatchObject({
			status: 'rejected',
			workflowState: 'terminated',
			currentNodeKey: 'end'
		});
		expect(Number(runtime[0]!.stepNumber)).toBe(6);

		const [steps] = await getPool().execute<
			Array<RowDataPacket & { nodeKey: string; outcome: string | null }>
		>(
			`SELECT node_key AS nodeKey, outcome FROM workflow_request_steps
			 WHERE organisation_id = ? AND workflow_request_id = (
			   SELECT id FROM workflow_requests WHERE organisation_id = ? AND public_id = ? LIMIT 1
			 ) ORDER BY step_number`,
			[organisationId, organisationId, request.requestPublicId]
		);
		expect(steps.map((step) => [step.nodeKey, step.outcome])).toEqual([
			['prepare', 'approved'],
			['review', 'approved'],
			['approve', 'returned'],
			['review', 'approved'],
			['approve', 'rejected'],
			['end', 'automatic']
		]);
	});
});
