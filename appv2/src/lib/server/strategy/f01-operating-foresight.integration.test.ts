import { randomUUID } from 'node:crypto';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getPool } from '$lib/server/db/pool';
import { approveStrategyBusinessPlan } from './business-plan-approval-service';
import { createStrategyFramework } from './f01-service';
import {
	addOperatingModelAccountability,
	addScenarioAssumption,
	addScenarioProjection,
	approveStrategyScenario,
	createOperatingModelComponent,
	createStrategyScenario,
	getForesightWorkspace,
	getOperatingModelWorkspace,
	linkInitiativeToOperatingModel,
	reviseStrategyScenario
} from './operating-foresight-service';

type Actor = { organisationId: string; userId: string; memberId: string };
type SqlValue = string | number | boolean | Date | null;

const PREFIX = 'V2 F01 Operating Foresight';
let organisationId = '';
let userId = '';
let actor: Actor;
let frameworkPublicId = '';
let planPublicId = '';
let initiativePublicId = '';
let kpiPublicId = '';

async function insertId(sql: string, values: SqlValue[]): Promise<string> {
	const [result] = await getPool().execute<ResultSetHeader>(sql, values);
	return result.insertId.toString();
}

async function seed(): Promise<void> {
	userId = await insertId(
		`INSERT INTO users (public_id, display_name, status) VALUES (?, ?, 'active')`,
		[randomUUID(), `${PREFIX} User`]
	);
	organisationId = await insertId(
		`INSERT INTO organisations (public_id, legal_name, default_timezone, default_currency_code, status)
		 VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[randomUUID(), `${PREFIX} Organisation`]
	);
	const memberPublicId = randomUUID();
	const memberId = await insertId(
		`INSERT INTO organisation_members (organisation_id, user_id, public_id, status, joined_at)
		 VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP(6))`,
		[organisationId, userId, memberPublicId]
	);
	const roleId = await insertId(
		`INSERT INTO organisation_roles (organisation_id, public_id, name, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, randomUUID(), `${PREFIX} Owner`]
	);
	const [permissions] = await getPool().execute<Array<RowDataPacket & { id: string | number }>>(
		`SELECT id FROM permissions
		 WHERE permission_key IN ('strategy.view','strategy.manage','strategy.approve') AND is_active = 1`
	);
	expect(permissions).toHaveLength(3);
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

	const framework = await createStrategyFramework({
		actor,
		title: 'Operating model and foresight strategy',
		horizonStart: '2027-01-01',
		horizonEnd: '2030-12-31',
		purpose: 'Prove the complete F01 enterprise-management thread.',
		vision: 'A measurable target operating model tested against alternative futures.',
		mission: 'Connect strategic intent to accountable enterprise design and foresight.'
	});
	frameworkPublicId = framework.publicId;
	await getPool().execute(
		`UPDATE strategy_frameworks
		 SET lifecycle_status = 'approved', minor_version_number = 0,
		     approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)
		 WHERE organisation_id = ? AND public_id = ?`,
		[memberId, organisationId, frameworkPublicId]
	);
	const [frameworkRows] = await getPool().execute<Array<RowDataPacket & { id: string | number }>>(
		`SELECT id FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
		[organisationId, frameworkPublicId]
	);
	const frameworkId = frameworkRows[0]!.id;

	const objectivePublicId = randomUUID();
	const objectiveId = await insertId(
		`INSERT INTO strategy_objectives
			(organisation_id, strategy_framework_id, public_id, objective_code, title, description,
			 priority_rank, owner_member_id, target_date, lifecycle_status, created_by_member_id)
		 VALUES (?, ?, ?, 'OBJ-001', 'Operating resilience', 'Create a resilient target operating model.',
		         1, ?, '2030-12-31', 'active', ?)`,
		[organisationId, frameworkId, objectivePublicId, memberId, memberId]
	);

	planPublicId = randomUUID();
	const planId = await insertId(
		`INSERT INTO strategy_business_plans
			(organisation_id, strategy_framework_id, public_id, plan_code, version_number, minor_version_number,
			 title, period_start, period_end, narrative, currency_code, planned_revenue_amount,
			 planned_opex_amount, planned_capex_amount, lifecycle_status, owner_member_id, created_by_member_id)
		 VALUES (?, ?, ?, 'PLAN-001', 1, 1, 'Enterprise delivery plan', '2027-01-01', '2030-12-31',
		         'Deliver the approved strategy through a controlled target operating model.', 'GBP', 0, 100000, 250000,
		         'draft', ?, ?)`,
		[organisationId, frameworkId, planPublicId, memberId, memberId]
	);
	await getPool().execute(
		`INSERT INTO strategy_business_plan_objective_links
			(organisation_id, strategy_business_plan_id, strategy_objective_id, contribution_type, created_by_member_id)
		 VALUES (?, ?, ?, 'primary', ?)`,
		[organisationId, planId, objectiveId, memberId]
	);

	initiativePublicId = randomUUID();
	await getPool().execute(
		`INSERT INTO strategy_initiatives
			(organisation_id, strategy_business_plan_id, strategy_objective_id, public_id, initiative_code,
			 title, outcome_text, benefit_statement, resource_assumptions, risk_summary, priority_rank,
			 start_date, end_date, owner_member_id, sponsor_member_id, planned_investment_amount,
			 planned_fte, currency_code, lifecycle_status, created_by_member_id)
		 VALUES (?, ?, ?, ?, 'INIT-001', 'Transform delivery model', 'Target operating model implemented.',
		         'Improved resilience and execution speed.', 'Core team funded.', 'Controlled implementation risk.', 1,
		         '2027-01-01', '2029-12-31', ?, ?, 250000, 3, 'GBP', 'proposed', ?)`,
		[organisationId, planId, objectiveId, initiativePublicId, memberId, memberId, memberId]
	);

	kpiPublicId = randomUUID();
	await getPool().execute(
		`INSERT INTO strategy_kpis
			(organisation_id, strategy_framework_id, strategy_objective_id, public_id, kpi_code, version_number,
			 minor_version_number, title, description, unit_label, direction, aggregation_method,
			 baseline_value, target_value, target_date, source_mode, owner_member_id, lifecycle_status,
			 created_by_member_id, approved_by_member_id, approved_at)
		 VALUES (?, ?, ?, ?, 'KPI-001', 1, 0, 'Delivery cycle time', 'Average cycle time for strategic delivery.',
		         'days', 'lower_is_better', 'latest', 30, 15, '2030-12-31', 'manual', ?, 'approved', ?, ?, CURRENT_TIMESTAMP(6))`,
		[organisationId, frameworkId, objectiveId, kpiPublicId, memberId, memberId, memberId]
	);
}

async function cleanup(): Promise<void> {
	if (!organisationId) return;
	const connection = await getPool().getConnection();
	try {
		await connection.query('SET FOREIGN_KEY_CHECKS = 0');
		const [tables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND (COLUMN_NAME = 'organisation_id' OR COLUMN_NAME = 'owning_organisation_id')`
		);
		for (const table of tables) {
			if (!/^[A-Za-z0-9_]+$/.test(table.tableName)) continue;
			const [columns] = await connection.query<Array<RowDataPacket & { columnName: string }>>(
				`SELECT COLUMN_NAME AS columnName FROM information_schema.COLUMNS
				 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME IN ('organisation_id','owning_organisation_id')`,
				[table.tableName]
			);
			for (const column of columns) {
				await connection.query(`DELETE FROM \`${table.tableName}\` WHERE \`${column.columnName}\` = ?`, [organisationId]);
			}
		}
		const [actingTables] = await connection.query<Array<RowDataPacket & { tableName: string }>>(
			`SELECT DISTINCT TABLE_NAME AS tableName FROM information_schema.COLUMNS
			 WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'acting_organisation_id'`
		);
		for (const table of actingTables) {
			if (/^[A-Za-z0-9_]+$/.test(table.tableName)) {
				await connection.query(`DELETE FROM \`${table.tableName}\` WHERE acting_organisation_id = ?`, [organisationId]);
			}
		}
		await connection.query('DELETE FROM organisations WHERE id = ?', [organisationId]);
		await connection.query('DELETE FROM users WHERE id = ?', [userId]);
	} finally {
		await connection.query('SET FOREIGN_KEY_CHECKS = 1');
		connection.release();
	}
}

beforeAll(seed);
afterAll(async () => {
	await cleanup();
	await getPool().end();
});

describe('F01.05 operating model and F01.08 scenario & foresight', () => {
	it('governs target operating model with the business plan and proves scenario revision history', async () => {
		const component = await createOperatingModelComponent({
			actor,
			frameworkPublicId,
			planPublicId,
			componentCode: 'TOM-CAP-01',
			componentType: 'business_capability',
			title: 'Integrated delivery control',
			currentState: 'Fragmented process ownership and disconnected reporting.',
			targetState: 'One accountable capability with connected operating evidence.'
		});
		await addOperatingModelAccountability({
			actor,
			frameworkPublicId,
			componentPublicId: component.publicId,
			accountabilityType: 'accountable',
			positionLabel: 'Chief Operating Officer'
		});
		await linkInitiativeToOperatingModel({
			actor,
			frameworkPublicId,
			componentPublicId: component.publicId,
			initiativePublicId,
			changeRole: 'transform'
		});
		let operating = await getOperatingModelWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId
		});
		expect(operating.components).toMatchObject([
			{ publicId: component.publicId, status: 'proposed', accountabilityCount: 1, initiativeCount: 1 }
		]);

		await approveStrategyBusinessPlan({ actor, frameworkPublicId, planPublicId });
		operating = await getOperatingModelWorkspace({
			organisationId,
			memberId: actor.memberId,
			frameworkPublicId
		});
		expect(operating.components[0]).toMatchObject({ publicId: component.publicId, status: 'approved' });

		const scenario = await createStrategyScenario({
			actor,
			frameworkPublicId,
			scenarioCode: 'SCN-STRESS-01',
			title: 'Capacity stress',
			scenarioType: 'stress',
			horizonStart: '2027-01-01',
			horizonEnd: '2030-12-31',
			narrative: 'Demand grows materially faster than the delivery operating model can absorb.'
		});
		await addScenarioAssumption({
			actor,
			frameworkPublicId,
			scenarioPublicId: scenario.publicId,
			assumptionCode: 'ASM-001',
			title: 'Demand growth',
			description: 'Annual demand growth exceeds the base case.',
			variableKey: 'market.demandGrowth',
			unitLabel: '%',
			baselineValue: '8',
			scenarioValue: '20',
			sensitivityPercent: '15'
		});
		await addScenarioProjection({
			actor,
			frameworkPublicId,
			scenarioPublicId: scenario.publicId,
			kpiPublicId,
			projectionDate: '2030-12-31',
			projectedValue: '24',
			rationale: 'Capacity pressure slows end-to-end delivery.'
		});
		await approveStrategyScenario({ actor, frameworkPublicId, scenarioPublicId: scenario.publicId });
		let foresight = await getForesightWorkspace({ organisationId, memberId: actor.memberId, frameworkPublicId });
		expect(foresight.scenarios.find((item) => item.publicId === scenario.publicId)).toMatchObject({
			status: 'approved',
			assumptionCount: 1,
			projectionCount: 1
		});

		const revision = await reviseStrategyScenario({ actor, frameworkPublicId, scenarioPublicId: scenario.publicId });
		foresight = await getForesightWorkspace({ organisationId, memberId: actor.memberId, frameworkPublicId });
		expect(foresight.scenarios.find((item) => item.publicId === scenario.publicId)?.status).toBe('approved');
		expect(foresight.scenarios.find((item) => item.publicId === revision.publicId)).toMatchObject({
			status: 'draft',
			versionNumber: 2,
			assumptionCount: 1,
			projectionCount: 1
		});

		await approveStrategyScenario({ actor, frameworkPublicId, scenarioPublicId: revision.publicId });
		foresight = await getForesightWorkspace({ organisationId, memberId: actor.memberId, frameworkPublicId });
		expect(foresight.scenarios.find((item) => item.publicId === scenario.publicId)?.status).toBe('superseded');
		expect(foresight.scenarios.find((item) => item.publicId === revision.publicId)?.status).toBe('approved');
	});
});
