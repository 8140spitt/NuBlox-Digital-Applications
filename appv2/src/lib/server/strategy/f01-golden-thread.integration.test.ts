import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '$lib/server/db/pool';
import {
	createStrategyAssumption,
	createStrategyEnvironmentFactor,
	createStrategyEvidenceItem,
	createStrategyObjective,
	createStrategyOption,
	createStrategyTheme,
	getStrategyAnalysisPlanningWorkspace
} from './analysis-planning-service';
import {
	createStrategyBusinessPlan,
	createStrategyInitiative,
	createStrategyKpi,
	createStrategyResourceRequirement,
	createStrategyReview,
	createStrategyReviewDecision,
	getStrategyExecutionReviewWorkspace,
	recordStrategyKpiObservation,
	requestStrategyInitiativeHandoff
} from './execution-review-service';
import {
	createStrategyFramework,
	getStrategyWorkspace,
	StrategyValidationError
} from './f01-service';
import {
	deleteF01Record,
	getF01ManagedRecord,
	reviseF01Record,
	transitionF01Record,
	updateF01Record
} from './f01-record-management-service';
import { getF01RelationshipEditor, updateF01Relationships } from './f01-relationship-service';

type Actor = { organisationId: string; userId: string; memberId: string };
type IdRow = RowDataPacket & { id: string | number };
type VersionRow = RowDataPacket & { versionStatus: string };
type SqlValue = string | number | boolean | Date | null;

const PREFIX = 'V2 F01 Golden Thread';
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
		[organisationId, randomUUID(), `${PREFIX} Owner`]
	);
	const [permissions] = await getPool().execute<
		Array<RowDataPacket & { id: string | number; permissionKey: string }>
	>(
		`SELECT id, permission_key AS permissionKey FROM permissions
		 WHERE permission_key IN ('strategy.view','strategy.manage','strategy.approve') AND is_active = 1`
	);
	expect(permissions.map((permission) => permission.permissionKey).sort()).toEqual([
		'strategy.approve',
		'strategy.manage',
		'strategy.view'
	]);
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
		const [actingTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName
			 FROM information_schema.COLUMNS
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

describe('F01 V2 governed golden thread', () => {
	it('proves create, amend, associate, publish, revise, lifecycle and controlled delete across the implemented thread', async () => {
		const created = await createStrategyFramework({
			actor,
			title: 'Integrated enterprise strategy',
			horizonStart: '2027-01-01',
			horizonEnd: '2030-12-31',
			purpose: 'Create durable value through governed enterprise execution.',
			vision: 'One strategy thread from evidence to measurable outcomes.',
			mission: 'Connect strategic choices to accountable delivery.'
		});
		const frameworkId = created.publicId;
		let managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId,
			kind: 'framework',
			recordPublicId: frameworkId
		});
		expect(managed.versionLabel).toBe('0.1');

		await updateF01Record({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'framework',
			recordPublicId: frameworkId,
			values: {
				title: 'Integrated enterprise strategy — refined',
				horizonStart: '2027-01-01',
				horizonEnd: '2030-12-31',
				purpose: 'Create durable value through governed enterprise execution.',
				vision: 'One strategy thread from evidence to measurable outcomes.',
				mission: 'Connect strategic choices to accountable delivery.'
			}
		});
		managed = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId,
			kind: 'framework',
			recordPublicId: frameworkId
		});
		expect(managed.versionLabel).toBe('0.2');

		const evidenceA = await createStrategyEvidenceItem({
			actor,
			frameworkPublicId: frameworkId,
			evidenceType: 'market_intelligence',
			title: 'Market evidence A',
			sourceReference: 'MI-A',
			observedOn: '2026-12-01',
			summaryText: 'Customers require connected delivery and operational evidence.',
			reliabilityScore: 4
		});
		const evidenceB = await createStrategyEvidenceItem({
			actor,
			frameworkPublicId: frameworkId,
			evidenceType: 'external_report',
			title: 'Market evidence B',
			sourceReference: 'ER-B',
			observedOn: '2026-12-05',
			summaryText: 'Digital integration materially improves decision latency.',
			reliabilityScore: 5
		});
		const disposableEvidence = await createStrategyEvidenceItem({
			actor,
			frameworkPublicId: frameworkId,
			evidenceType: 'other',
			title: 'Disposable evidence',
			observedOn: '2026-12-06',
			summaryText: 'Temporary evidence used to prove controlled draft deletion.',
			reliabilityScore: 2
		});
		await deleteF01Record({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'evidence',
			recordPublicId: disposableEvidence.publicId
		});

		await createStrategyEnvironmentFactor({
			actor,
			frameworkPublicId: frameworkId,
			contextScope: 'external',
			dimension: 'market',
			direction: 'opportunity',
			title: 'Integrated digital demand',
			analysisText: 'Buyers increasingly expect one controlled digital thread.',
			implicationText: 'NuBlox should make traceable execution a strategic differentiator.',
			observedOn: '2026-12-10',
			likelihoodScore: 5,
			impactScore: 5,
			confidenceScore: 4,
			evidencePublicIds: [evidenceA.publicId]
		});
		let planning = await getStrategyAnalysisPlanningWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId
		});
		const factor = planning.factors.find((item) => item.title === 'Integrated digital demand');
		expect(factor).toBeDefined();
		await updateF01Relationships({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'factor',
			recordPublicId: factor!.publicId,
			selections: { evidencePublicIds: [evidenceB.publicId] }
		});
		const factorRelationships = await getF01RelationshipEditor({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId,
			kind: 'factor',
			recordPublicId: factor!.publicId
		});
		expect(
			factorRelationships?.groups[0]?.options.find((option) => option.value === evidenceB.publicId)
				?.selected
		).toBe(true);
		expect(
			factorRelationships?.groups[0]?.options.find((option) => option.value === evidenceA.publicId)
				?.selected
		).toBe(false);

		const assumptionA = await createStrategyAssumption({
			actor,
			frameworkPublicId: frameworkId,
			statementText: 'Clients continue to value auditable digital handover.',
			rationaleText: 'Current market evidence supports sustained demand.',
			confidenceScore: 4,
			reviewBy: '2027-06-30'
		});
		const assumptionB = await createStrategyAssumption({
			actor,
			frameworkPublicId: frameworkId,
			statementText: 'Integrated data materially reduces management latency.',
			rationaleText: 'This assumption will be tested through operating evidence.',
			confidenceScore: 3,
			reviewBy: '2027-09-30'
		});
		await createStrategyOption({
			actor,
			frameworkPublicId: frameworkId,
			title: 'Lead with governed integration',
			description: 'Differentiate with one governed strategy-to-delivery digital thread.',
			evaluationSummary: 'Strong market fit with measurable execution value.',
			priorityRank: 1,
			factorPublicIds: [factor!.publicId],
			assumptionPublicIds: [assumptionA.publicId]
		});
		planning = await getStrategyAnalysisPlanningWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId
		});
		const option = planning.options.find((item) => item.title === 'Lead with governed integration');
		expect(option).toBeDefined();
		await updateF01Relationships({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'option',
			recordPublicId: option!.publicId,
			selections: {
				factorPublicIds: [factor!.publicId],
				assumptionPublicIds: [assumptionB.publicId]
			}
		});
		await transitionF01Record({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'option',
			recordPublicId: option!.publicId,
			targetStatus: 'selected',
			note: 'Selected as the primary strategic response to the evidenced opportunity.'
		});

		await createStrategyTheme({
			actor,
			frameworkPublicId: frameworkId,
			title: 'Governed growth',
			description: 'Scale through traceable, controlled digital execution.',
			priorityRank: 1
		});
		await createStrategyTheme({
			actor,
			frameworkPublicId: frameworkId,
			title: 'Operational intelligence',
			description: 'Use authoritative evidence to improve management decisions.',
			priorityRank: 2
		});
		planning = await getStrategyAnalysisPlanningWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId
		});
		const themeA = planning.themes.find((item) => item.title === 'Governed growth')!;
		const themeB = planning.themes.find((item) => item.title === 'Operational intelligence')!;
		await createStrategyObjective({
			actor,
			frameworkPublicId: frameworkId,
			title: 'Create a measurable enterprise digital thread',
			description: 'Connect strategic intent, execution and outcome evidence across the enterprise.',
			priorityRank: 1,
			targetDate: '2029-12-31',
			parentObjectivePublicId: '',
			optionPublicIds: [option!.publicId],
			themePublicId: themeA.publicId
		});
		planning = await getStrategyAnalysisPlanningWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: frameworkId
		});
		const objective = planning.objectives.find(
			(item) => item.title === 'Create a measurable enterprise digital thread'
		)!;
		await updateF01Relationships({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'objective',
			recordPublicId: objective.publicId,
			selections: {
				optionPublicIds: [option!.publicId],
				primaryThemePublicId: [themeB.publicId],
				secondaryThemePublicIds: [themeA.publicId],
				parentObjectivePublicId: []
			}
		});

		await transitionF01Record({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'framework',
			recordPublicId: frameworkId,
			targetStatus: 'approved'
		});
		let workspace = await getStrategyWorkspace({ organisationId, memberId: actor.memberId });
		expect(workspace.activeFramework?.versionLabel).toBe('1.0');

		const revision = await reviseF01Record({
			actor,
			frameworkPublicId: frameworkId,
			kind: 'framework',
			recordPublicId: frameworkId
		});
		let revisionManaged = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId,
			kind: 'framework',
			recordPublicId: revision.publicId
		});
		expect(revisionManaged.versionLabel).toBe('1.1');
		await updateF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'framework',
			recordPublicId: revision.publicId,
			values: {
				title: 'Integrated enterprise strategy — controlled revision',
				horizonStart: '2027-01-01',
				horizonEnd: '2030-12-31',
				purpose: 'Create durable value through governed enterprise execution.',
				vision: 'One strategy thread from evidence to measurable outcomes.',
				mission: 'Connect strategic choices to accountable delivery and learning.'
			}
		});
		revisionManaged = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId,
			kind: 'framework',
			recordPublicId: revision.publicId
		});
		expect(revisionManaged.versionLabel).toBe('1.2');
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'framework',
			recordPublicId: revision.publicId,
			targetStatus: 'approved'
		});
		workspace = await getStrategyWorkspace({ organisationId, memberId: actor.memberId });
		expect(workspace.activeFramework?.publicId).toBe(revision.publicId);
		expect(workspace.activeFramework?.versionLabel).toBe('2.0');
		expect(workspace.frameworks.find((item) => item.publicId === frameworkId)?.lifecycleStatus).toBe(
			'superseded'
		);

		planning = await getStrategyAnalysisPlanningWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const activeObjective = planning.objectives.find((item) => item.lifecycleStatus === 'active')!;
		expect(activeObjective.optionCount).toBeGreaterThan(0);
		expect(activeObjective.themeCount).toBeGreaterThan(0);

		await createStrategyBusinessPlan({
			actor,
			frameworkPublicId: revision.publicId,
			title: 'Enterprise execution plan',
			periodStart: '2027-01-01',
			periodEnd: '2030-12-31',
			narrative: 'Fund and govern the initiatives required to realise the approved strategy.',
			currencyCode: 'GBP',
			plannedRevenueAmount: '1000000',
			plannedOpexAmount: '400000',
			plannedCapexAmount: '250000',
			objectivePublicIds: [activeObjective.publicId]
		});
		let execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const plan = execution.plans.find((item) => item.title === 'Enterprise execution plan')!;
		expect(plan.versionLabel).toBe('0.1');
		await updateF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'plan',
			recordPublicId: plan.publicId,
			values: {
				title: 'Enterprise execution plan',
				periodStart: '2027-01-01',
				periodEnd: '2030-12-31',
				narrative: 'Fund, resource and govern the initiatives required to realise the approved strategy.',
				currencyCode: 'GBP',
				plannedRevenueAmount: '1000000',
				plannedOpexAmount: '400000',
				plannedCapexAmount: '250000'
			}
		});
		const planManaged = await getF01ManagedRecord({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId,
			kind: 'plan',
			recordPublicId: plan.publicId
		});
		expect(planManaged.versionLabel).toBe('0.2');

		await createStrategyInitiative({
			actor,
			frameworkPublicId: revision.publicId,
			planPublicId: plan.publicId,
			objectivePublicId: activeObjective.publicId,
			title: 'Mobilise integrated delivery',
			outcomeText: 'Operationalise the strategic digital thread across enterprise delivery.',
			benefitStatement: 'Faster, more reliable decisions with traceable accountability.',
			priorityRank: '1',
			startDate: '2027-02-01',
			endDate: '2029-12-31',
			plannedInvestmentAmount: '150000',
			plannedFte: '5',
			currencyCode: 'GBP'
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const initiative = execution.initiatives.find((item) => item.title === 'Mobilise integrated delivery')!;
		await createStrategyResourceRequirement({
			actor,
			frameworkPublicId: revision.publicId,
			initiativePublicId: initiative.publicId,
			requirementType: 'funding',
			title: 'Transformation funding',
			description: 'Funding required to mobilise the strategic initiative.',
			amount: '150000',
			currencyCode: 'GBP',
			quantity: '',
			unitLabel: '',
			targetFunctionCode: 'F14',
			needBy: '2027-03-31'
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const requirement = execution.resourceRequirements.find(
			(item) => item.title === 'Transformation funding'
		)!;
		await requestStrategyInitiativeHandoff({
			actor,
			frameworkPublicId: revision.publicId,
			initiativePublicId: initiative.publicId,
			resourceRequirementPublicId: requirement.publicId,
			handoffType: 'funding',
			targetFunctionCode: 'F14',
			requestSummary: 'Validate and govern the required funding envelope.'
		});
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'plan',
			recordPublicId: plan.publicId,
			targetStatus: 'approved'
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		expect(execution.plans.find((item) => item.publicId === plan.publicId)?.versionLabel).toBe('1.0');
		expect(execution.initiatives.find((item) => item.publicId === initiative.publicId)?.lifecycleStatus).toBe(
			'approved'
		);
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'initiative',
			recordPublicId: initiative.publicId,
			targetStatus: 'in_progress',
			note: 'Mobilisation authorised by the approved business plan.'
		});

		await createStrategyKpi({
			actor,
			frameworkPublicId: revision.publicId,
			objectivePublicId: activeObjective.publicId,
			initiativePublicIds: [initiative.publicId],
			title: 'Strategic digital adoption',
			description: 'Percentage of governed enterprise workflows operating on the target digital thread.',
			unitLabel: '%',
			direction: 'higher_is_better',
			baselineValue: '10',
			targetValue: '90',
			targetDate: '2029-12-31'
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const kpi = execution.kpis.find((item) => item.title === 'Strategic digital adoption')!;
		await updateF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'kpi',
			recordPublicId: kpi.publicId,
			values: {
				title: 'Strategic digital adoption',
				description: 'Percentage of governed enterprise workflows operating on the target digital thread.',
				unitLabel: '%',
				direction: 'higher_is_better',
				baselineValue: '10',
				targetValue: '95',
				targetDate: '2029-12-31'
			}
		});
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'kpi',
			recordPublicId: kpi.publicId,
			targetStatus: 'approved'
		});
		await recordStrategyKpiObservation({
			actor,
			frameworkPublicId: revision.publicId,
			kpiPublicId: kpi.publicId,
			observedOn: '2028-06-01',
			actualValue: '55',
			forecastValue: '92',
			commentary: 'Adoption is progressing against the governed implementation plan.'
		});

		await createStrategyReview({
			actor,
			frameworkPublicId: revision.publicId,
			reviewDate: '2028-06-30',
			title: 'Mid-horizon strategic review',
			summary: 'Performance evidence supports continued execution with focused acceleration.'
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const review = execution.reviews.find((item) => item.title === 'Mid-horizon strategic review')!;
		expect(review.kpiSnapshotCount).toBeGreaterThan(0);
		await createStrategyReviewDecision({
			actor,
			frameworkPublicId: revision.publicId,
			reviewPublicId: review.publicId,
			decisionType: 'accelerate',
			decisionText: 'Accelerate adoption in lagging enterprise workflows.',
			rationale: 'Current evidence shows value but uneven adoption.',
			dueDate: '2028-09-30',
			objectivePublicId: activeObjective.publicId,
			initiativePublicId: initiative.publicId,
			kpiPublicId: kpi.publicId
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const decision = execution.decisions.find(
			(item) => item.decisionText === 'Accelerate adoption in lagging enterprise workflows.'
		)!;
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'decision',
			recordPublicId: decision.publicId,
			targetStatus: 'in_progress',
			note: 'Action assigned and mobilisation started.'
		});
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'decision',
			recordPublicId: decision.publicId,
			targetStatus: 'completed',
			note: 'Acceleration action implemented and evidenced.'
		});
		await transitionF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'review',
			recordPublicId: review.publicId,
			targetStatus: 'approved'
		});

		await createStrategyBusinessPlan({
			actor,
			frameworkPublicId: revision.publicId,
			title: 'Disposable draft plan',
			periodStart: '2027-01-01',
			periodEnd: '2027-12-31',
			narrative: 'Temporary plan used to prove governed draft discard semantics.',
			currencyCode: 'GBP',
			plannedRevenueAmount: '0',
			plannedOpexAmount: '0',
			plannedCapexAmount: '0',
			objectivePublicIds: [activeObjective.publicId]
		});
		execution = await getStrategyExecutionReviewWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId: revision.publicId
		});
		const disposablePlan = execution.plans.find((item) => item.title === 'Disposable draft plan')!;
		await deleteF01Record({
			actor,
			frameworkPublicId: revision.publicId,
			kind: 'plan',
			recordPublicId: disposablePlan.publicId
		});
		const [discardedRows] = await getPool().execute<VersionRow[]>(
			`SELECT version_status AS versionStatus FROM governed_record_versions
			 WHERE organisation_id = ? AND record_public_id = ? ORDER BY id DESC LIMIT 1`,
			[organisationId, disposablePlan.publicId]
		);
		expect(discardedRows[0]?.versionStatus).toBe('discarded');

		await expect(
			deleteF01Record({
				actor,
				frameworkPublicId: revision.publicId,
				kind: 'plan',
				recordPublicId: plan.publicId
			})
		).rejects.toBeInstanceOf(StrategyValidationError);

		const [auditRows] = await getPool().execute<IdRow[]>(
			`SELECT id FROM audit_events WHERE acting_organisation_id = ?`,
			[organisationId]
		);
		const [outboxRows] = await getPool().execute<IdRow[]>(
			`SELECT id FROM outbox_events WHERE organisation_id = ?`,
			[organisationId]
		);
		expect(auditRows.length).toBeGreaterThan(10);
		expect(outboxRows.length).toBeGreaterThan(10);
	});
});
