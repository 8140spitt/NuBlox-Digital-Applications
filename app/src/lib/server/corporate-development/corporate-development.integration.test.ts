import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { closeDatabase, getDatabase } from '$lib/server/db/database';
import { CorporateDevelopmentService } from './corporate-development-service';

const ids: string[] = [];
let actor: { organisationId: string; userId: string; memberId: string; correlationId: string };

async function seedActor() {
	const db = getDatabase();
	const suffix = Math.random().toString(36).slice(2, 10);
	const organisationPublicId = crypto.randomUUID();
	const userPublicId = crypto.randomUUID();
	await db
		.insertInto('organisations')
		.values({
			public_id: organisationPublicId,
			name: `F04 Test ${suffix}`,
			slug: `f04-${suffix}`,
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const organisation = await db
		.selectFrom('organisations')
		.selectAll()
		.where('public_id', '=', organisationPublicId)
		.executeTakeFirstOrThrow();
	ids.push(organisation.id);
	await db
		.insertInto('users')
		.values({
			public_id: userPublicId,
			email: `f04-${suffix}@example.test`,
			display_name: 'F04 Owner',
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const user = await db
		.selectFrom('users')
		.selectAll()
		.where('public_id', '=', userPublicId)
		.executeTakeFirstOrThrow();
	await db
		.insertInto('organisation_members')
		.values({
			public_id: crypto.randomUUID(),
			organisation_id: organisation.id,
			user_id: user.id,
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const member = await db
		.selectFrom('organisation_members')
		.selectAll()
		.where('organisation_id', '=', organisation.id)
		.where('user_id', '=', user.id)
		.executeTakeFirstOrThrow();
	actor = {
		organisationId: organisation.id,
		userId: user.id,
		memberId: member.id,
		correlationId: crypto.randomUUID()
	};
	return { db, organisation, user, member };
}

describe('F04 corporate development', () => {
	beforeAll(async () => {
		await seedActor();
	});
	beforeEach(() => {
		actor.correlationId = crypto.randomUUID();
	});

	it('creates an opportunity and governed valuation thread', async () => {
		const db = getDatabase();
		const permissionRows = await db
			.selectFrom('permissions')
			.select(['id', 'permission_key'])
			.where('permission_key', 'in', ['strategy.view', 'strategy.manage', 'strategy.approve'])
			.execute();
		for (const permission of permissionRows) {
			await db
				.insertInto('member_permission_overrides')
				.values({
					organisation_member_id: actor.memberId,
					permission_id: permission.id,
					effect: 'allow',
					created_by_user_id: actor.userId
				})
				.executeTakeFirst();
		}
		const service = new CorporateDevelopmentService(db);
		const opportunity = await service.createOpportunity(actor, {
			opportunityCode: `F04-${Date.now()}`,
			title: 'Strategic acquisition',
			dealType: 'acquisition',
			targetName: 'Target Ltd',
			strategicThesis: 'Acquire differentiated capability.',
			strategicRationale: 'Accelerate strategic outcomes.',
			ownerMemberId: actor.memberId,
			priority: 'high',
			identifiedOn: '2026-09-10',
			targetSourceDomain: 'crm',
			targetSourceRecordType: 'organisation',
			targetSourcePublicId: crypto.randomUUID()
		});
		expect(opportunity.pipeline_stage).toBe('identified');
		const valuation = await service.createValuation(actor, {
			opportunityPublicId: opportunity.public_id,
			valuationCode: 'VAL-01',
			title: 'Base investment case',
			valuationDate: '2026-09-10',
			currencyCode: 'GBP',
			primaryMethod: 'dcf',
			enterpriseValueLow: '9000000',
			enterpriseValueBase: '10000000',
			enterpriseValueHigh: '11000000',
			recommendation: 'Proceed to diligence.'
		});
		expect(valuation.version_number).toBe(1);
		const approved = await service.approveValuation(actor, valuation.public_id);
		expect(approved.lifecycle_status).toBe('approved');
		const workspace = await service.getWorkspace(actor, opportunity.public_id);
		expect(workspace.stageHistory.length).toBeGreaterThan(0);
		expect(workspace.valuations).toHaveLength(1);
	});
});
