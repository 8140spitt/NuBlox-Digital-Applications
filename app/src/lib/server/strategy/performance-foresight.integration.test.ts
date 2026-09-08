import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import {
	PerformanceForesightService,
	PerformanceForesightValidationError
} from './performance-foresight-service';

const PREFIX = 'Performance Foresight Integration ';
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerUserId = '';
let viewerUserId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let frameworkId = '';
let frameworkPublicId = '';
let objectivePublicId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${label}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-09-07T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((permission) => permission.permission_key).sort()).toEqual(
		[...permissionKeys].sort()
	);
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (!ids.length) return;
	await db
		.deleteFrom('strategy_scenario_kpi_projections')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('strategy_scenario_assumptions')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.updateTable('strategy_scenarios')
		.set({ supersedes_strategy_scenario_id: null })
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('strategy_scenarios').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_review_kpis').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_reviews').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_kpi_actions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_kpi_observations').where('organisation_id', 'in', ids).execute();
	await db
		.updateTable('strategy_kpis')
		.set({ supersedes_strategy_kpi_id: null })
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('strategy_kpis').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_objectives').where('organisation_id', 'in', ids).execute();
	await db
		.updateTable('strategy_frameworks')
		.set({ supersedes_strategy_framework_id: null })
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('strategy_frameworks').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('outbox_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	viewerMemberId = await createMember(organisationBId, viewerUserId);
	await assignPermissionRole(organisationAId, ownerMemberId, 'Strategy owner', [
		'strategy.view',
		'strategy.manage',
		'strategy.approve'
	]);
	await assignPermissionRole(organisationBId, viewerMemberId, 'Strategy viewer', ['strategy.view']);
	owner = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: randomUUID()
	};
	viewer = {
		organisationId: organisationBId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: randomUUID()
	};

	frameworkPublicId = randomUUID();
	frameworkId = insertedId(
		await db
			.insertInto('strategy_frameworks')
			.values({
				organisation_id: organisationAId,
				public_id: frameworkPublicId,
				framework_code: 'PERF-INT',
				version_number: 1,
				title: `${PREFIX}Approved strategy`,
				horizon_start: new Date('2027-01-01T00:00:00.000Z'),
				horizon_end: new Date('2030-12-31T00:00:00.000Z'),
				purpose_text: 'Govern strategy through measurable enterprise outcomes.',
				vision_text: 'One continuous strategy-to-performance evidence chain.',
				mission_text: 'Connect objectives, KPIs, actuals, actions, reviews and scenarios.',
				lifecycle_status: 'approved',
				supersedes_strategy_framework_id: null,
				owner_member_id: ownerMemberId,
				created_by_member_id: ownerMemberId,
				approved_by_member_id: ownerMemberId,
				approved_at: new Date('2026-09-07T09:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	objectivePublicId = randomUUID();
	await db
		.insertInto('strategy_objectives')
		.values({
			organisation_id: organisationAId,
			strategy_framework_id: frameworkId,
			public_id: objectivePublicId,
			objective_code: 'OBJ-PERF-01',
			title: 'Improve enterprise operating margin',
			description: 'Translate approved strategy into measurable economic performance.',
			priority_rank: 1,
			owner_member_id: ownerMemberId,
			target_date: new Date('2028-12-31T00:00:00.000Z'),
			lifecycle_status: 'active',
			created_by_member_id: ownerMemberId
		})
		.executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F01 strategy performance and foresight', () => {
	it('governs objective → KPI → actual/forecast → action → review → scenario with source evidence', async () => {
		const service = new PerformanceForesightService(
			db,
			randomUUID,
			() => new Date('2027-06-30T12:00:00.000Z')
		);
		const kpi = await service.createKpi(owner, {
			frameworkPublicId,
			objectivePublicId,
			kpiCode: 'KPI-MARGIN',
			title: 'Operating margin',
			description: 'Enterprise operating margin sourced from canonical finance reporting.',
			unitLabel: '%',
			direction: 'higher_is_better',
			aggregationMethod: 'latest',
			baselineValue: '8.5',
			targetValue: '12.0',
			warningThreshold: '10.0',
			criticalThreshold: '9.0',
			targetDate: '2028-12-31',
			sourceMode: 'canonical',
			sourceDomain: 'finance',
			sourceRecordType: 'accounting_report',
			sourceMeasureKey: 'operating_margin_percent',
			ownerMemberId
		});
		expect(kpi.lifecycle_status).toBe('draft');
		const approvedKpi = await service.approveKpi(owner, kpi.public_id);
		expect(approvedKpi.lifecycle_status).toBe('approved');

		const observation = await service.recordObservation(owner, {
			kpiPublicId: approvedKpi.public_id,
			observedOn: '2027-06-30',
			actualValue: '9.75',
			forecastValue: '11.4',
			commentary: 'Margin is improving but remains below target.',
			sourceMode: 'canonical',
			sourceDomain: 'finance',
			sourceRecordType: 'accounting_report',
			sourcePublicId: 'REPORT-2027-H1',
			sourceMeasureKey: 'operating_margin_percent'
		});
		expect(observation.source_public_id).toBe('REPORT-2027-H1');

		const action = await service.createAction(owner, {
			kpiPublicId: approvedKpi.public_id,
			observationPublicId: observation.public_id,
			actionCode: 'ACT-MARGIN-01',
			title: 'Accelerate cost productivity programme',
			actionText: 'Close the forecast-to-target margin gap through governed cost actions.',
			ownerMemberId,
			dueDate: '2027-09-30'
		});
		const completedAction = await service.completeAction(
			owner,
			action.public_id,
			'Programme actions approved and mobilised.'
		);
		expect(completedAction.lifecycle_status).toBe('completed');

		const review = await service.createReview(owner, {
			frameworkPublicId,
			reviewCode: 'REV-2027-H1',
			reviewDate: '2027-06-30',
			title: 'H1 strategic performance review',
			summary: 'Review performance against approved strategy and agree corrective response.',
			decisionsText: 'Maintain target and accelerate productivity actions.'
		});
		const snapshot = await service.addReviewKpi(
			owner,
			review.public_id,
			approvedKpi.public_id,
			observation.public_id,
			'watch',
			'Forecast remains below target.'
		);
		expect(Number(snapshot.variance_value)).toBeCloseTo(-2.25);
		expect(Number(snapshot.variance_percent)).toBeCloseTo(-18.75);
		const approvedReview = await service.approveReview(owner, review.public_id);
		expect(approvedReview.lifecycle_status).toBe('approved');

		const scenario = await service.createScenario(owner, {
			frameworkPublicId,
			scenarioCode: 'SCN-DOWNSIDE',
			title: 'Demand downside',
			scenarioType: 'downside',
			horizonStart: '2027-07-01',
			horizonEnd: '2028-12-31',
			narrative: 'Test margin resilience under weaker demand and higher input costs.'
		});
		await service.addScenarioAssumption(owner, scenario.public_id, {
			assumptionCode: 'ASSUMP-DEMAND',
			title: 'Revenue demand',
			description: 'Revenue demand falls below baseline planning assumption.',
			variableKey: 'revenue_growth_percent',
			unitLabel: '%',
			baselineValue: '5',
			scenarioValue: '-3',
			sensitivityPercent: '8'
		});
		await service.addScenarioProjection(
			owner,
			scenario.public_id,
			approvedKpi.public_id,
			'2028-12-31',
			'8.2',
			'Downside demand and input-cost assumptions compress operating margin.'
		);
		const approvedScenario = await service.approveScenario(owner, scenario.public_id);
		expect(approvedScenario.lifecycle_status).toBe('approved');
		const scenarioRevision = await service.reviseScenario(owner, approvedScenario.public_id);
		expect(scenarioRevision.version_number).toBe(2);
		expect(scenarioRevision.lifecycle_status).toBe('draft');

		const workspace = await service.getWorkspace(owner, frameworkPublicId);
		expect(workspace.kpis).toHaveLength(1);
		expect(workspace.observations).toHaveLength(1);
		expect(workspace.actions).toHaveLength(1);
		expect(workspace.reviews).toHaveLength(1);
		expect(workspace.scenarios).toHaveLength(2);
		expect(workspace.scenarioAssumptions).toHaveLength(2);
		expect(workspace.scenarioProjections).toHaveLength(2);
		expect(workspace.reviewKpis).toHaveLength(1);

		await expect(service.approveReview(owner, approvedReview.public_id)).rejects.toBeInstanceOf(
			PerformanceForesightValidationError
		);
		await expect(service.getWorkspace(viewer, frameworkPublicId)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationAId)
			.where('action_key', 'like', 'strategy.%')
			.execute();
		expect(auditActions.some((row) => row.action_key === 'strategy.kpi.observe')).toBe(true);
		expect(auditActions.some((row) => row.action_key === 'strategy.review.approve')).toBe(true);
		expect(auditActions.some((row) => row.action_key === 'strategy.scenario.approve')).toBe(true);
		const outbox = await db
			.selectFrom('outbox_events')
			.select('topic')
			.where('organisation_id', '=', organisationAId)
			.where('topic', 'like', 'strategy.%')
			.execute();
		expect(outbox.some((row) => row.topic === 'strategy.scenario.revise')).toBe(true);
	});

	it('requires complete canonical source provenance', async () => {
		const service = new PerformanceForesightService(db);
		await expect(
			service.createKpi(owner, {
				frameworkPublicId,
				objectivePublicId,
				kpiCode: 'KPI-BAD-SOURCE',
				title: 'Incomplete source KPI',
				description: 'Must not claim canonical truth without source semantics.',
				unitLabel: '%',
				direction: 'higher_is_better',
				aggregationMethod: 'latest',
				baselineValue: '1',
				targetValue: '2',
				sourceMode: 'canonical',
				sourceDomain: 'finance',
				ownerMemberId
			})
		).rejects.toBeInstanceOf(PerformanceForesightValidationError);
	});
});
