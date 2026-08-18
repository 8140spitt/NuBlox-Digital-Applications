import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CrmPipelineProvisioningService } from './crm-pipeline-provisioning';

const PREFIX = 'CRM Pipeline Provisioning Integration ';
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (ids.length > 0) {
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_pipeline_stages').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_pipelines').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Tenant`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date()
			})
			.executeTakeFirstOrThrow()
	);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Owner Role`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const crmManage = await db
		.selectFrom('permissions')
		.select('id')
		.where('permission_key', '=', 'crm.manage')
		.where('is_active', '=', 1)
		.executeTakeFirstOrThrow();
	await db
		.insertInto('role_permissions')
		.values({
			organisation_id: organisationId,
			organisation_role_id: roleId,
			permission_id: crmManage.id
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('CRM pipeline first-use provisioning', () => {
	it('creates exactly one default Sales pipeline for a permitted future tenant and is idempotent', async () => {
		const service = new CrmPipelineProvisioningService(db, () => randomUUID());
		await service.ensureDefaultPipeline(actor);
		await service.ensureDefaultPipeline(actor);
		const pipelines = await db
			.selectFrom('crm_pipelines')
			.select(['id', 'name', 'is_default as isDefault'])
			.where('organisation_id', '=', organisationId)
			.execute();
		expect(pipelines).toHaveLength(1);
		expect(pipelines[0]).toMatchObject({ name: 'Sales', isDefault: 1 });
		const stages = await db
			.selectFrom('crm_pipeline_stages')
			.select(['name', 'sort_order as sortOrder', 'probability_percent as probability'])
			.where('organisation_id', '=', organisationId)
			.where('crm_pipeline_id', '=', pipelines[0]!.id)
			.orderBy('sort_order', 'asc')
			.execute();
		expect(stages.map((stage) => [stage.name, stage.sortOrder, stage.probability])).toEqual([
			['Lead', 10, '10.00'],
			['Qualified', 20, '30.00'],
			['Proposal', 30, '60.00'],
			['Negotiation', 40, '80.00']
		]);
		const audits = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', '=', 'crm.pipeline.initialized')
			.execute();
		expect(audits).toHaveLength(1);
	});
});
