import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '$lib/server/db/pool';
import {
	addLifecycleAccessRule,
	addLifecyclePhase,
	addLifecycleRole,
	addLifecycleTransition,
	createLifecycleTemplate,
	getLifecycleTemplate,
	updateLifecyclePhase
} from './lifecycle-admin-service';
import type { EvidenceActor } from './evidence';

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
		[randomUUID(), 'Lifecycle phase editor user']
	);
	organisationId = await insertId(
		`INSERT INTO organisations (public_id, legal_name, default_timezone, default_currency_code, status)
		 VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[randomUUID(), 'Lifecycle phase editor organisation']
	);
	const memberId = await insertId(
		`INSERT INTO organisation_members (organisation_id, user_id, public_id, status, joined_at)
		 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6))`,
		[organisationId, userId, randomUUID()]
	);
	const roleId = await insertId(
		`INSERT INTO organisation_roles (organisation_id, public_id, name, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, randomUUID(), 'Lifecycle Administrator']
	);
	const [permissions] = await getPool().execute<Array<RowDataPacket & { id: number | string }>>(
		`SELECT id FROM permissions
		 WHERE permission_key IN ('lifecycle.view', 'lifecycle.manage', 'lifecycle.publish') AND is_active = 1`
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
		const [organisationTables] = await connection.query<
			Array<RowDataPacket & { tableName: string }>
		>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'organisation_id'`
		);
		for (const table of organisationTables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(`DELETE FROM \`${table.tableName}\` WHERE organisation_id = ?`, [
				organisationId
			]);
		}
		const [actingTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'acting_organisation_id'`
		);
		for (const table of actingTables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			await connection.query(
				`DELETE FROM \`${table.tableName}\` WHERE acting_organisation_id = ?`,
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

describe('lifecycle phase editing', () => {
	it('edits phase identity and capability while preserving transition, access-rule and initial-state references', async () => {
		const created = await createLifecycleTemplate({
			actor,
			templateKey: `phase-edit-${randomUUID().slice(0, 8)}`,
			name: 'Phase editing lifecycle',
			description: 'Proves controlled phase editing.',
			objectType: 'Test.phase-edit',
			mode: 'advanced'
		});
		await addLifecyclePhase({
			actor,
			publicId: created.publicId,
			phaseKey: 'under_review',
			label: 'Under review',
			displayOrder: 20,
			editable: false,
			deletable: false,
			revisable: false
		});
		await addLifecyclePhase({
			actor,
			publicId: created.publicId,
			phaseKey: 'released',
			label: 'Released',
			displayOrder: 30,
			editable: false,
			deletable: false,
			revisable: true
		});
		await addLifecycleRole({
			actor,
			publicId: created.publicId,
			roleKey: 'approver',
			label: 'Approver',
			description: 'Reviews lifecycle-controlled records.'
		});
		await addLifecycleAccessRule({
			actor,
			publicId: created.publicId,
			phaseKey: 'under_review',
			roleKey: 'approver',
			permissionKey: 'lifecycle.manage'
		});
		await addLifecycleTransition({
			actor,
			publicId: created.publicId,
			fromState: 'draft',
			toState: 'under_review',
			label: 'Submit for review',
			requiresNote: true,
			requiresTargetReference: false,
			tone: 'default',
			requiredPermissionKey: 'lifecycle.manage',
			workflowKey: 'test.phase-review'
		});

		await updateLifecyclePhase({
			actor,
			publicId: created.publicId,
			phaseKey: 'under_review',
			nextPhaseKey: 'in_review',
			label: 'In review',
			displayOrder: 25,
			editable: true,
			deletable: false,
			revisable: false
		});

		let detail = await getLifecycleTemplate(actor, created.publicId);
		const edited = detail.phases.find((phase) => phase.phaseKey === 'in_review');
		expect(edited).toMatchObject({ label: 'In review', displayOrder: 25, editable: true });
		expect(detail.phases.some((phase) => phase.phaseKey === 'under_review')).toBe(false);
		expect(detail.transitions[0]).toMatchObject({ fromState: 'draft', toState: 'in_review' });
		expect(detail.accessRules[0]?.phaseKey).toBe('in_review');
		expect(
			detail.versionHistory.some((version) => version.changeNote?.includes('renamed to in_review'))
		).toBe(true);

		await updateLifecyclePhase({
			actor,
			publicId: created.publicId,
			phaseKey: 'draft',
			nextPhaseKey: 'working_draft',
			label: 'Working draft',
			displayOrder: 10,
			editable: true,
			deletable: true,
			revisable: false
		});
		detail = await getLifecycleTemplate(actor, created.publicId);
		expect(detail.initialState).toBe('working_draft');
		expect(detail.transitions[0]?.fromState).toBe('working_draft');
	});
});
