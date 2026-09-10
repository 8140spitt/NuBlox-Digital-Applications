import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { EnterprisePerformanceService } from './enterprise-performance-service';

const PREFIX = 'F03 Enterprise Performance Integration ';
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let kpiPublicId = '';
let observationPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const ids = organisations.map((row) => row.id);
	if (!ids.length) return;
	await db.deleteFrom('strategy_performance_benefit_measurements').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_benefits').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_benchmark_results').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_benchmarks').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_reviews').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_actions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_variances').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_pack_kpis').where('organisation_id', 'in', ids).execute();
	await db.updateTable('strategy_performance_packs').set({ supersedes_performance_pack_id: null }).where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_packs').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_periods').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_framework_kpis').where('organisation_id', 'in', ids).execute();
	await db.updateTable('strategy_performance_frameworks').set({ supersedes_performance_framework_id: null }).where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_performance_frameworks').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_kpi_observations').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_kpis').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('strategy_objectives').where('organisation_id', 'in', ids).execute();
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
	userId = insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' }).executeTakeFirstOrThrow());
	organisationId = insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, default_timezone: 'Europe/London', default_currency_code: 'GBP', status: 'active' }).executeTakeFirstOrThrow());
	memberId = insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: new Date('2026-09-01T08:00:00.000Z') }).executeTakeFirstOrThrow());
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}Owner role`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', ['strategy.view', 'strategy.manage', 'strategy.approve']).where('is_active', '=', 1).execute();
	expect(permissions).toHaveLength(3);
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).execute();
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	const strategyFrameworkId = insertedId(await db.insertInto('strategy_frameworks').values({
		organisation_id: organisationId, public_id: randomUUID(), framework_code: 'F03-STRATEGY', version_number: 1,
		title: 'F03 approved strategy', horizon_start: new Date('2026-01-01T00:00:00.000Z'), horizon_end: new Date('2028-12-31T00:00:00.000Z'),
		purpose_text: 'Drive enterprise performance.', vision_text: 'Measured outcomes.', mission_text: 'Operate a closed performance loop.', lifecycle_status: 'approved',
		supersedes_strategy_framework_id: null, owner_member_id: memberId, created_by_member_id: memberId, approved_by_member_id: memberId, approved_at: new Date('2026-01-02T10:00:00.000Z')
	}).executeTakeFirstOrThrow());
	const objectiveId = insertedId(await db.insertInto('strategy_objectives').values({ organisation_id: organisationId, strategy_framework_id: strategyFrameworkId, public_id: randomUUID(), objective_code: 'OBJ-F03', title: 'Improve operating margin', description: 'Create measurable enterprise value.', priority_rank: 1, owner_member_id: memberId, target_date: new Date('2027-12-31T00:00:00.000Z'), lifecycle_status: 'active', created_by_member_id: memberId }).executeTakeFirstOrThrow());
	kpiPublicId = randomUUID();
	const kpiId = insertedId(await db.insertInto('strategy_kpis').values({ organisation_id: organisationId, strategy_framework_id: strategyFrameworkId, strategy_objective_id: objectiveId, public_id: kpiPublicId, kpi_code: 'KPI-MARGIN', version_number: 1, title: 'Operating margin', description: 'Canonical enterprise operating margin.', unit_label: '%', direction: 'higher_is_better', aggregation_method: 'latest', baseline_value: '8.5', target_value: '12', warning_threshold: '10', critical_threshold: '9', target_date: new Date('2027-12-31T00:00:00.000Z'), source_mode: 'manual', source_domain: null, source_record_type: null, source_measure_key: null, owner_member_id: memberId, lifecycle_status: 'approved', supersedes_strategy_kpi_id: null, created_by_member_id: memberId, approved_by_member_id: memberId, approved_at: new Date('2026-01-03T10:00:00.000Z') }).executeTakeFirstOrThrow());
	observationPublicId = randomUUID();
	await db.insertInto('strategy_kpi_observations').values({ organisation_id: organisationId, strategy_kpi_id: kpiId, public_id: observationPublicId, observed_on: new Date('2026-08-31T00:00:00.000Z'), actual_value: '9.5', forecast_value: '10.8', commentary: 'Below target; intervention required.', source_mode: 'manual', source_domain: null, source_record_type: null, source_public_id: null, source_measure_key: null, created_by_member_id: memberId }).execute();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F03 enterprise performance management', () => {
	it('runs framework → reporting → variance/action → review → benchmark → benefit measurement as one governed thread', async () => {
		const service = new EnterprisePerformanceService(db, randomUUID);
		const framework = await service.createFramework(actor, { frameworkCode: 'PERF-2026', title: 'Enterprise performance framework', purposeText: 'Operate one governed enterprise performance cycle.', reportingCadence: 'monthly', scopeText: 'Enterprise KPIs and executive interventions.', ownerMemberId: memberId, effectiveFrom: '2026-01-01' });
		await service.addFrameworkKpi(actor, { frameworkPublicId: framework.public_id, kpiPublicId, displayOrder: 1, materialityThresholdPercent: '5', commentaryRequired: true });
		const approvedFramework = await service.approveFramework(actor, framework.public_id);
		expect(approvedFramework.lifecycle_status).toBe('approved');

		const period = await service.createPeriod(actor, { frameworkPublicId: framework.public_id, periodCode: '2026-08', title: 'August 2026 performance', periodStart: '2026-08-01', periodEnd: '2026-08-31', reportingDate: '2026-09-05' });
		const pack = await service.createPack(actor, { periodPublicId: period.public_id, packCode: 'PACK-2026-08', title: 'August executive performance pack', executiveSummary: 'Operating margin is below target and requires intervention.' });
		const approvedPack = await service.approvePack(actor, pack.public_id);
		expect(approvedPack.lifecycle_status).toBe('approved');

		const workspaceAfterPack = await service.getWorkspace(actor, framework.public_id);
		const packKpi = workspaceAfterPack.packKpis.find((row) => row.performance_pack_id === pack.id);
		expect(packKpi?.assessment).not.toBe('on_track');
		if (!packKpi) throw new Error('Expected performance pack KPI snapshot.');
		const variance = await service.createVariance(actor, { packKpiId: packKpi.id, varianceCode: 'VAR-MARGIN-01', materiality: 'high', causeCategory: 'productivity', rootCauseText: 'Cost productivity is behind the approved operating plan.', impactText: 'Operating margin remains below the approved target.', ownerMemberId: memberId });
		const action = await service.createCorrectiveAction(actor, { variancePublicId: variance.public_id, actionCode: 'ACT-MARGIN-01', title: 'Recover margin gap', actionText: 'Execute the approved cost productivity recovery plan.', ownerMemberId: memberId, dueDate: '2026-10-31', sourceDomain: 'projects', sourceRecordType: 'project_action', sourcePublicId: 'project-action-f03' });
		await service.completeCorrectiveAction(actor, action.public_id, 'Recovery work mobilised and verified.');
		const closedVariance = await service.closeVariance(actor, variance.public_id, 'Corrective action completed with governed evidence.');
		expect(closedVariance.lifecycle_status).toBe('closed');

		const review = await service.createReview(actor, { packPublicId: pack.public_id, reviewCode: 'REV-2026-08', reviewDate: '2026-09-07', title: 'August executive performance review', summary: 'Executive review accepted the margin intervention.', decisionText: 'Maintain target and monitor recovery weekly.' });
		const approvedReview = await service.approveReview(actor, review.public_id);
		expect(approvedReview.lifecycle_status).toBe('approved');

		const benchmark = await service.createBenchmark(actor, { kpiPublicId, benchmarkCode: 'BM-MARGIN-PEER', benchmarkType: 'peer', title: 'Peer operating margin', scopeText: 'Comparable peer benchmark.', unitLabel: '%', periodStart: '2026-01-01', periodEnd: '2026-08-31', benchmarkValue: '11.5', provenanceText: 'Controlled peer benchmark evidence.', sourceReference: 'peer-set-2026' });
		const comparison = await service.compareBenchmark(actor, benchmark.public_id, observationPublicId, 'Current margin trails the peer benchmark and validates the recovery intervention.');
		expect(Number(comparison.gap_value)).toBeCloseTo(-2);

		const benefit = await service.createBenefit(actor, { kpiPublicId, benefitCode: 'BEN-MARGIN', title: 'Margin recovery benefit', benefitType: 'financial', unitLabel: '%', baselineValue: '9.5', targetValue: '12', targetDate: '2027-03-31', ownerMemberId: memberId, reviewCadence: 'monthly', sourceDomain: 'projects', sourceRecordType: 'programme', sourcePublicId: 'margin-recovery-programme' });
		const measurement = await service.recordBenefitMeasurement(actor, { benefitPublicId: benefit.public_id, measuredOn: '2026-09-30', realisedValue: '10.25', confidencePercent: '85', evidenceText: 'September finance close confirms the first realised margin improvement.', sourceDomain: 'finance', sourceRecordType: 'period_close', sourcePublicId: '2026-09' });
		expect(Number(measurement.realised_value)).toBeCloseTo(10.25);

		const finalWorkspace = await service.getWorkspace(actor, framework.public_id);
		expect(finalWorkspace.frameworkKpis).toHaveLength(1);
		expect(finalWorkspace.packs).toHaveLength(1);
		expect(finalWorkspace.variances).toHaveLength(1);
		expect(finalWorkspace.actions).toHaveLength(1);
		expect(finalWorkspace.reviews).toHaveLength(1);
		expect(finalWorkspace.benchmarks).toHaveLength(1);
		expect(finalWorkspace.benchmarkResults).toHaveLength(1);
		expect(finalWorkspace.benefits).toHaveLength(1);
		expect(finalWorkspace.benefitMeasurements).toHaveLength(1);

		const auditCount = await db.selectFrom('audit_events').select(({ fn }) => fn.countAll<number>().as('count')).where('acting_organisation_id', '=', organisationId).where('action_key', 'like', 'performance.%').executeTakeFirstOrThrow();
		const outboxCount = await db.selectFrom('outbox_events').select(({ fn }) => fn.countAll<number>().as('count')).where('organisation_id', '=', organisationId).where('topic', 'like', 'performance.%').executeTakeFirstOrThrow();
		expect(Number(auditCount.count)).toBeGreaterThanOrEqual(15);
		expect(Number(outboxCount.count)).toBeGreaterThanOrEqual(15);
	});
});
