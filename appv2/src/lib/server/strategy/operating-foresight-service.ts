import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import {
	getStrategyWorkspace,
	StrategyAccessError,
	StrategyValidationError,
	type StrategyFrameworkSummary,
	type StrategyPermissionFlags
} from './f01-service';

export type OperatingModelComponentType =
	| 'business_capability'
	| 'value_stream'
	| 'organisation_design'
	| 'process'
	| 'governance'
	| 'information'
	| 'technology'
	| 'partner_ecosystem'
	| 'location';
export type OperatingModelAccountabilityType =
	| 'accountable'
	| 'responsible'
	| 'consulted'
	| 'informed'
	| 'assured';
export type OperatingModelChangeRole = 'create' | 'transform' | 'enable' | 'consume' | 'retire';
export type ScenarioType = 'baseline' | 'upside' | 'downside' | 'stress' | 'custom';
export type ScenarioStatus = 'draft' | 'approved' | 'superseded';

export type OperatingModelPlan = {
	publicId: string;
	code: string;
	title: string;
	status: 'draft' | 'approved';
};

export type OperatingModelInitiative = {
	publicId: string;
	code: string;
	title: string;
	planPublicId: string;
};

export type OperatingModelComponent = {
	publicId: string;
	code: string;
	planPublicId: string;
	planCode: string;
	componentType: OperatingModelComponentType;
	title: string;
	currentState: string | null;
	targetState: string;
	status: 'proposed' | 'approved' | 'retired';
	parentPublicId: string | null;
	parentTitle: string | null;
	accountabilityCount: number;
	initiativeCount: number;
};

export type OperatingModelAccountability = {
	publicId: string;
	componentPublicId: string;
	componentCode: string;
	accountabilityType: OperatingModelAccountabilityType;
	positionLabel: string;
	memberPublicId: string | null;
	memberName: string | null;
	notes: string | null;
};

export type OperatingModelLink = {
	componentPublicId: string;
	componentCode: string;
	initiativePublicId: string;
	initiativeCode: string;
	initiativeTitle: string;
	changeRole: OperatingModelChangeRole;
};

export type MemberOption = { publicId: string; name: string };

export type OperatingModelWorkspace = {
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
	plans: OperatingModelPlan[];
	initiatives: OperatingModelInitiative[];
	components: OperatingModelComponent[];
	accountabilities: OperatingModelAccountability[];
	links: OperatingModelLink[];
	members: MemberOption[];
};

export type StrategyScenario = {
	publicId: string;
	code: string;
	versionNumber: number;
	title: string;
	scenarioType: ScenarioType;
	horizonStart: string;
	horizonEnd: string;
	narrative: string;
	status: ScenarioStatus;
	assumptionCount: number;
	projectionCount: number;
};

export type ScenarioAssumption = {
	publicId: string;
	scenarioPublicId: string;
	code: string;
	title: string;
	description: string;
	variableKey: string;
	unitLabel: string;
	baselineValue: string;
	scenarioValue: string;
	sensitivityPercent: string | null;
};

export type ScenarioProjection = {
	publicId: string;
	scenarioPublicId: string;
	kpiPublicId: string;
	kpiCode: string;
	kpiTitle: string;
	unitLabel: string;
	projectionDate: string;
	projectedValue: string;
	rationale: string;
};

export type ForesightKpi = {
	publicId: string;
	code: string;
	title: string;
	unitLabel: string;
	targetValue: string;
	latestActualValue: string | null;
};

export type ForesightWorkspace = {
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
	scenarios: StrategyScenario[];
	assumptions: ScenarioAssumption[];
	projections: ScenarioProjection[];
	kpis: ForesightKpi[];
};

type ContextRow = RowDataPacket & {
	id: string | number;
	horizonStart: Date | string;
	horizonEnd: Date | string;
	status: 'draft' | 'approved' | 'superseded';
};

type PlanRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	status: 'draft' | 'approved';
};

type InitiativeRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	planPublicId: string;
};

type ComponentRow = RowDataPacket & {
	publicId: string;
	code: string;
	planPublicId: string;
	planCode: string;
	componentType: OperatingModelComponentType;
	title: string;
	currentState: string | null;
	targetState: string;
	status: 'proposed' | 'approved' | 'retired';
	parentPublicId: string | null;
	parentTitle: string | null;
	accountabilityCount: number | string;
	initiativeCount: number | string;
};

type AccountabilityRow = RowDataPacket & {
	publicId: string;
	componentPublicId: string;
	componentCode: string;
	accountabilityType: OperatingModelAccountabilityType;
	positionLabel: string;
	memberPublicId: string | null;
	memberName: string | null;
	notes: string | null;
};

type LinkRow = RowDataPacket & {
	componentPublicId: string;
	componentCode: string;
	initiativePublicId: string;
	initiativeCode: string;
	initiativeTitle: string;
	changeRole: OperatingModelChangeRole;
};

type MemberRow = RowDataPacket & { publicId: string; name: string };

type ScenarioRow = RowDataPacket & {
	publicId: string;
	code: string;
	versionNumber: number | string;
	title: string;
	scenarioType: ScenarioType;
	horizonStart: Date | string;
	horizonEnd: Date | string;
	narrative: string;
	status: ScenarioStatus;
	assumptionCount: number | string;
	projectionCount: number | string;
};

type ScenarioAssumptionRow = RowDataPacket & {
	publicId: string;
	scenarioPublicId: string;
	code: string;
	title: string;
	description: string;
	variableKey: string;
	unitLabel: string;
	baselineValue: string | number;
	scenarioValue: string | number;
	sensitivityPercent: string | number | null;
};

type ProjectionRow = RowDataPacket & {
	publicId: string;
	scenarioPublicId: string;
	kpiPublicId: string;
	kpiCode: string;
	kpiTitle: string;
	unitLabel: string;
	projectionDate: Date | string;
	projectedValue: string | number;
	rationale: string;
};

type KpiRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	unitLabel: string;
	targetValue: string | number;
	latestActualValue: string | number | null;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
const VARIABLE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{1,127}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new StrategyValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) {
		throw new StrategyValidationError(`Text must not exceed ${maximum} characters.`);
	}
	return normalized;
}

function controlledCode(value: string, label: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized)) throw new StrategyValidationError(`${label} has an invalid format.`);
	return normalized;
}

function variableKey(value: string): string {
	const normalized = value.trim();
	if (!VARIABLE_KEY.test(normalized)) {
		throw new StrategyValidationError(
			'Variable key must begin with a letter and use only letters, numbers, dots, dashes or underscores.'
		);
	}
	return normalized;
}

function dateOnly(value: string, label: string): string {
	const normalized = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${normalized}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	return normalized;
}

function dateValue(value: Date | string): string {
	return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function decimal(value: string | number, label: string): string {
	const raw = String(value).trim();
	if (!/^-?\d+(?:\.\d+)?$/.test(raw)) throw new StrategyValidationError(`${label} must be numeric.`);
	const number = Number(raw);
	if (!Number.isFinite(number)) throw new StrategyValidationError(`${label} must be numeric.`);
	return raw;
}

function nonNegativeDecimal(value: string | number | null | undefined, label: string): string | null {
	if (value === null || value === undefined || String(value).trim() === '') return null;
	const parsed = decimal(value, label);
	if (Number(parsed) < 0) throw new StrategyValidationError(`${label} must not be negative.`);
	return parsed;
}

async function requireContext(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<{
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
	frameworkId: string;
	horizonStart: string;
	horizonEnd: string;
}> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.organisationId,
		memberId: input.memberId
	});
	const framework = workspace.frameworks.find((item) => item.publicId === input.frameworkPublicId);
	if (!framework) throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	const [rows] = await getPool().execute<ContextRow[]>(
		`SELECT id, horizon_start AS horizonStart, horizon_end AS horizonEnd, lifecycle_status AS status
		 FROM strategy_frameworks
		 WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
		[input.organisationId, input.frameworkPublicId]
	);
	const row = rows[0];
	if (!row) throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	return {
		framework,
		permissions: workspace.permissions,
		frameworkId: String(row.id),
		horizonStart: dateValue(row.horizonStart),
		horizonEnd: dateValue(row.horizonEnd)
	};
}

async function requireManage(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
}): Promise<Awaited<ReturnType<typeof requireContext>>> {
	const context = await requireContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (!context.permissions.canManage) {
		throw new StrategyAccessError('You do not have authority to manage enterprise strategy.');
	}
	if (context.framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Operating-model and foresight work requires the current approved strategy.'
		);
	}
	return context;
}

async function evidence(
	connection: PoolConnection,
	input: {
		actor: EvidenceActor;
		actionKey: string;
		subjectType: string;
		subjectPublicId: string;
		changeSummary: Record<string, unknown>;
		subfunction: 'F01.05' | 'F01.08';
	}
): Promise<void> {
	await appendDomainEvidence(connection, {
		actor: input.actor,
		actionKey: input.actionKey,
		subjectType: input.subjectType,
		subjectPublicId: input.subjectPublicId,
		changeSummary: input.changeSummary,
		eventMetadata: { function: 'F01', subfunctions: [input.subfunction] }
	});
}

export async function getOperatingModelWorkspace(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<OperatingModelWorkspace> {
	const context = await requireContext(input);
	const [plans] = await getPool().execute<PlanRow[]>(
		`SELECT public_id AS publicId, plan_code AS code, title, lifecycle_status AS status
		 FROM strategy_business_plans
		 WHERE organisation_id = ? AND strategy_framework_id = ? AND lifecycle_status IN ('draft','approved')
		 ORDER BY CASE lifecycle_status WHEN 'draft' THEN 0 ELSE 1 END, period_start, plan_code`,
		[input.organisationId, context.frameworkId]
	);
	const [initiatives] = await getPool().execute<InitiativeRow[]>(
		`SELECT initiative.public_id AS publicId, initiative.initiative_code AS code, initiative.title,
		        plan.public_id AS planPublicId
		 FROM strategy_initiatives initiative
		 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
		 WHERE initiative.organisation_id = ? AND plan.strategy_framework_id = ?
		   AND plan.lifecycle_status IN ('draft','approved') AND initiative.lifecycle_status <> 'cancelled'
		 ORDER BY plan.plan_code, initiative.priority_rank, initiative.initiative_code`,
		[input.organisationId, context.frameworkId]
	);
	const [components] = await getPool().execute<ComponentRow[]>(
		`SELECT component.public_id AS publicId, component.component_code AS code,
		        plan.public_id AS planPublicId, plan.plan_code AS planCode,
		        component.component_type AS componentType, component.title,
		        component.current_state_text AS currentState, component.target_state_text AS targetState,
		        component.lifecycle_status AS status, parent.public_id AS parentPublicId,
		        parent.title AS parentTitle,
		        (SELECT COUNT(*) FROM strategy_operating_model_accountabilities accountability
		          WHERE accountability.operating_model_component_id = component.id) AS accountabilityCount,
		        (SELECT COUNT(*) FROM strategy_initiative_operating_model_links link
		          WHERE link.operating_model_component_id = component.id) AS initiativeCount
		 FROM strategy_operating_model_components component
		 JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
		 LEFT JOIN strategy_operating_model_components parent ON parent.id = component.parent_component_id
		 WHERE component.organisation_id = ? AND plan.strategy_framework_id = ?
		 ORDER BY plan.plan_code, component.component_type, component.component_code`,
		[input.organisationId, context.frameworkId]
	);
	const [accountabilities] = await getPool().execute<AccountabilityRow[]>(
		`SELECT accountability.public_id AS publicId, component.public_id AS componentPublicId,
		        component.component_code AS componentCode,
		        accountability.accountability_type AS accountabilityType,
		        accountability.position_label AS positionLabel,
		        member.public_id AS memberPublicId, user.display_name AS memberName, accountability.notes
		 FROM strategy_operating_model_accountabilities accountability
		 JOIN strategy_operating_model_components component ON component.id = accountability.operating_model_component_id
		 JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
		 LEFT JOIN organisation_members member ON member.id = accountability.member_id
		 LEFT JOIN users user ON user.id = member.user_id
		 WHERE accountability.organisation_id = ? AND plan.strategy_framework_id = ?
		 ORDER BY component.component_code, FIELD(accountability.accountability_type, 'accountable','responsible','assured','consulted','informed'), accountability.position_label`,
		[input.organisationId, context.frameworkId]
	);
	const [links] = await getPool().execute<LinkRow[]>(
		`SELECT component.public_id AS componentPublicId, component.component_code AS componentCode,
		        initiative.public_id AS initiativePublicId, initiative.initiative_code AS initiativeCode,
		        initiative.title AS initiativeTitle, link.change_role AS changeRole
		 FROM strategy_initiative_operating_model_links link
		 JOIN strategy_operating_model_components component ON component.id = link.operating_model_component_id
		 JOIN strategy_initiatives initiative ON initiative.id = link.initiative_id
		 JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
		 WHERE link.organisation_id = ? AND plan.strategy_framework_id = ?
		 ORDER BY component.component_code, initiative.initiative_code`,
		[input.organisationId, context.frameworkId]
	);
	const [members] = await getPool().execute<MemberRow[]>(
		`SELECT member.public_id AS publicId, user.display_name AS name
		 FROM organisation_members member
		 JOIN users user ON user.id = member.user_id
		 WHERE member.organisation_id = ? AND member.status = 'active'
		 ORDER BY user.display_name`,
		[input.organisationId]
	);
	return {
		framework: context.framework,
		permissions: context.permissions,
		plans,
		initiatives,
		components: components.map((row) => ({
			...row,
			accountabilityCount: Number(row.accountabilityCount),
			initiativeCount: Number(row.initiativeCount)
		})),
		accountabilities,
		links,
		members
	};
}

export async function createOperatingModelComponent(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	planPublicId: string;
	componentCode: string;
	componentType: OperatingModelComponentType;
	title: string;
	currentState?: string | null;
	targetState: string;
	parentComponentPublicId?: string | null;
}): Promise<{ publicId: string }> {
	await requireManage(input);
	const code = controlledCode(input.componentCode, 'Component code');
	const title = requiredText(input.title, 'Component title', 255);
	const currentState = optionalText(input.currentState, 20_000);
	const targetState = requiredText(input.targetState, 'Target state', 20_000);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [plans] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT plan.id FROM strategy_business_plans plan
			 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
			 WHERE plan.organisation_id = ? AND plan.public_id = ? AND framework.public_id = ?
			   AND plan.lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.planPublicId, input.frameworkPublicId]
		);
		const plan = plans[0];
		if (!plan) {
			throw new StrategyValidationError(
				'Target operating-model design belongs to a draft business plan. Create a controlled plan revision before changing an approved target state.'
			);
		}
		let parentId: string | number | null = null;
		if (input.parentComponentPublicId?.trim()) {
			const [parents] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
				`SELECT id FROM strategy_operating_model_components
				 WHERE organisation_id = ? AND strategy_business_plan_id = ? AND public_id = ?
				   AND lifecycle_status = 'proposed' LIMIT 1`,
				[input.actor.organisationId, plan.id, input.parentComponentPublicId.trim()]
			);
			if (!parents[0]) throw new StrategyValidationError('Parent component must be proposed in the same draft business plan.');
			parentId = parents[0].id;
		}
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_operating_model_components
				(organisation_id, strategy_business_plan_id, public_id, component_code, parent_component_id,
				 component_type, title, current_state_text, target_state_text, lifecycle_status, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?)`,
			[
				input.actor.organisationId,
				plan.id,
				publicId,
				code,
				parentId,
				input.componentType,
				title,
				currentState,
				targetState,
				input.actor.memberId
			]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.operating-model-component.create',
			subjectType: 'strategy_operating_model_component',
			subjectPublicId: publicId,
			changeSummary: { componentCode: code, componentType: input.componentType, planPublicId: input.planPublicId },
			subfunction: 'F01.05'
		});
		await connection.commit();
		return { publicId };
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function addOperatingModelAccountability(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	componentPublicId: string;
	accountabilityType: OperatingModelAccountabilityType;
	positionLabel: string;
	memberPublicId?: string | null;
	notes?: string | null;
}): Promise<void> {
	await requireManage(input);
	const positionLabel = requiredText(input.positionLabel, 'Position / role', 255);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [components] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT component.id FROM strategy_operating_model_components component
			 JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
			 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
			 WHERE component.organisation_id = ? AND component.public_id = ? AND framework.public_id = ?
			   AND component.lifecycle_status = 'proposed' AND plan.lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.componentPublicId, input.frameworkPublicId]
		);
		if (!components[0]) throw new StrategyValidationError('Accountabilities can only be changed while the target operating model is in a draft business plan.');
		let memberId: string | number | null = null;
		if (input.memberPublicId?.trim()) {
			const [members] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
				`SELECT id FROM organisation_members WHERE organisation_id = ? AND public_id = ? AND status = 'active' LIMIT 1`,
				[input.actor.organisationId, input.memberPublicId.trim()]
			);
			if (!members[0]) throw new StrategyValidationError('Assigned member must be active in this organisation.');
			memberId = members[0].id;
		}
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_operating_model_accountabilities
				(organisation_id, operating_model_component_id, public_id, accountability_type,
				 position_label, member_id, notes, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				components[0].id,
				publicId,
				input.accountabilityType,
				positionLabel,
				memberId,
				optionalText(input.notes, 20_000),
				input.actor.memberId
			]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.operating-model-accountability.assign',
			subjectType: 'strategy_operating_model_component',
			subjectPublicId: input.componentPublicId,
			changeSummary: { accountabilityType: input.accountabilityType, positionLabel, memberPublicId: input.memberPublicId ?? null },
			subfunction: 'F01.05'
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function linkInitiativeToOperatingModel(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	componentPublicId: string;
	initiativePublicId: string;
	changeRole: OperatingModelChangeRole;
}): Promise<void> {
	await requireManage(input);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [rows] = await connection.execute<
			Array<RowDataPacket & { componentId: string | number; initiativeId: string | number }>
		>(
			`SELECT component.id AS componentId, initiative.id AS initiativeId
			 FROM strategy_operating_model_components component
			 JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
			 JOIN strategy_initiatives initiative ON initiative.strategy_business_plan_id = plan.id
			 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
			 WHERE component.organisation_id = ? AND framework.public_id = ?
			   AND component.public_id = ? AND initiative.public_id = ?
			   AND component.lifecycle_status = 'proposed' AND plan.lifecycle_status = 'draft'
			   AND initiative.lifecycle_status = 'proposed' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.frameworkPublicId, input.componentPublicId, input.initiativePublicId]
		);
		const row = rows[0];
		if (!row) throw new StrategyValidationError('The component and initiative must belong to the same draft business plan.');
		await connection.execute(
			`INSERT INTO strategy_initiative_operating_model_links
				(organisation_id, initiative_id, operating_model_component_id, change_role, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?)
			 ON DUPLICATE KEY UPDATE change_role = VALUES(change_role), created_by_member_id = VALUES(created_by_member_id)`,
			[input.actor.organisationId, row.initiativeId, row.componentId, input.changeRole, input.actor.memberId]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.operating-model-component.link-initiative',
			subjectType: 'strategy_operating_model_component',
			subjectPublicId: input.componentPublicId,
			changeSummary: { initiativePublicId: input.initiativePublicId, changeRole: input.changeRole },
			subfunction: 'F01.05'
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function getForesightWorkspace(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<ForesightWorkspace> {
	const context = await requireContext(input);
	const [scenarios] = await getPool().execute<ScenarioRow[]>(
		`SELECT scenario.public_id AS publicId, scenario.scenario_code AS code,
		        scenario.version_number AS versionNumber, scenario.title,
		        scenario.scenario_type AS scenarioType, scenario.horizon_start AS horizonStart,
		        scenario.horizon_end AS horizonEnd, scenario.narrative,
		        scenario.lifecycle_status AS status,
		        (SELECT COUNT(*) FROM strategy_scenario_assumptions assumption_record
		          WHERE assumption_record.strategy_scenario_id = scenario.id) AS assumptionCount,
		        (SELECT COUNT(*) FROM strategy_scenario_kpi_projections projection
		          WHERE projection.strategy_scenario_id = scenario.id) AS projectionCount
		 FROM strategy_scenarios scenario
		 WHERE scenario.organisation_id = ? AND scenario.strategy_framework_id = ?
		 ORDER BY scenario.scenario_code, scenario.version_number DESC`,
		[input.organisationId, context.frameworkId]
	);
	const [assumptions] = await getPool().execute<ScenarioAssumptionRow[]>(
		`SELECT assumption_record.public_id AS publicId, scenario.public_id AS scenarioPublicId,
		        assumption_record.assumption_code AS code, assumption_record.title,
		        assumption_record.description, assumption_record.variable_key AS variableKey,
		        assumption_record.unit_label AS unitLabel, assumption_record.baseline_value AS baselineValue,
		        assumption_record.scenario_value AS scenarioValue,
		        assumption_record.sensitivity_percent AS sensitivityPercent
		 FROM strategy_scenario_assumptions assumption_record
		 JOIN strategy_scenarios scenario ON scenario.id = assumption_record.strategy_scenario_id
		 WHERE assumption_record.organisation_id = ? AND scenario.strategy_framework_id = ?
		 ORDER BY scenario.scenario_code, ABS(assumption_record.scenario_value - assumption_record.baseline_value) DESC, assumption_record.assumption_code`,
		[input.organisationId, context.frameworkId]
	);
	const [projections] = await getPool().execute<ProjectionRow[]>(
		`SELECT projection.public_id AS publicId, scenario.public_id AS scenarioPublicId,
		        kpi.public_id AS kpiPublicId, kpi.kpi_code AS kpiCode, kpi.title AS kpiTitle,
		        kpi.unit_label AS unitLabel, projection.projection_date AS projectionDate,
		        projection.projected_value AS projectedValue, projection.rationale
		 FROM strategy_scenario_kpi_projections projection
		 JOIN strategy_scenarios scenario ON scenario.id = projection.strategy_scenario_id
		 JOIN strategy_kpis kpi ON kpi.id = projection.strategy_kpi_id
		 WHERE projection.organisation_id = ? AND scenario.strategy_framework_id = ?
		 ORDER BY kpi.kpi_code, projection.projection_date, scenario.scenario_code`,
		[input.organisationId, context.frameworkId]
	);
	const [kpis] = await getPool().execute<KpiRow[]>(
		`SELECT kpi.public_id AS publicId, kpi.kpi_code AS code, kpi.title,
		        kpi.unit_label AS unitLabel, kpi.target_value AS targetValue,
		        (SELECT observation.actual_value FROM strategy_kpi_observations observation
		          WHERE observation.strategy_kpi_id = kpi.id
		          ORDER BY observation.observed_on DESC, observation.created_at DESC LIMIT 1) AS latestActualValue
		 FROM strategy_kpis kpi
		 WHERE kpi.organisation_id = ? AND kpi.strategy_framework_id = ? AND kpi.lifecycle_status = 'approved'
		 ORDER BY kpi.kpi_code`,
		[input.organisationId, context.frameworkId]
	);
	return {
		framework: context.framework,
		permissions: context.permissions,
		scenarios: scenarios.map((row) => ({
			...row,
			versionNumber: Number(row.versionNumber),
			horizonStart: dateValue(row.horizonStart),
			horizonEnd: dateValue(row.horizonEnd),
			assumptionCount: Number(row.assumptionCount),
			projectionCount: Number(row.projectionCount)
		})),
		assumptions: assumptions.map((row) => ({
			...row,
			baselineValue: String(row.baselineValue),
			scenarioValue: String(row.scenarioValue),
			sensitivityPercent: row.sensitivityPercent == null ? null : String(row.sensitivityPercent)
		})),
		projections: projections.map((row) => ({
			...row,
			projectionDate: dateValue(row.projectionDate),
			projectedValue: String(row.projectedValue)
		})),
		kpis: kpis.map((row) => ({
			...row,
			targetValue: String(row.targetValue),
			latestActualValue: row.latestActualValue == null ? null : String(row.latestActualValue)
		}))
	};
}

async function scenarioLock(
	connection: PoolConnection,
	input: { organisationId: string; frameworkPublicId: string; scenarioPublicId: string; status?: ScenarioStatus }
): Promise<
	RowDataPacket & {
		id: string | number;
		code: string;
		versionNumber: number | string;
		title: string;
		scenarioType: ScenarioType;
		horizonStart: Date | string;
		horizonEnd: Date | string;
		narrative: string;
		status: ScenarioStatus;
		supersedesId: string | number | null;
	}
> {
	const values: Array<string | number> = [input.organisationId, input.scenarioPublicId, input.frameworkPublicId];
	const statusSql = input.status ? ' AND scenario.lifecycle_status = ?' : '';
	if (input.status) values.push(input.status);
	const [rows] = await connection.execute<
		Array<
			RowDataPacket & {
				id: string | number;
				code: string;
				versionNumber: number | string;
				title: string;
				scenarioType: ScenarioType;
				horizonStart: Date | string;
				horizonEnd: Date | string;
				narrative: string;
				status: ScenarioStatus;
				supersedesId: string | number | null;
			}
		>
	>(
		`SELECT scenario.id, scenario.scenario_code AS code, scenario.version_number AS versionNumber,
		        scenario.title, scenario.scenario_type AS scenarioType, scenario.horizon_start AS horizonStart,
		        scenario.horizon_end AS horizonEnd, scenario.narrative, scenario.lifecycle_status AS status,
		        scenario.supersedes_strategy_scenario_id AS supersedesId
		 FROM strategy_scenarios scenario
		 JOIN strategy_frameworks framework ON framework.id = scenario.strategy_framework_id
		 WHERE scenario.organisation_id = ? AND scenario.public_id = ? AND framework.public_id = ?${statusSql}
		 LIMIT 1 FOR UPDATE`,
		values
	);
	if (!rows[0]) throw new StrategyValidationError('Scenario is not available in the required state.');
	return rows[0];
}

export async function createStrategyScenario(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	scenarioCode: string;
	title: string;
	scenarioType: ScenarioType;
	horizonStart: string;
	horizonEnd: string;
	narrative: string;
}): Promise<{ publicId: string }> {
	const context = await requireManage(input);
	const code = controlledCode(input.scenarioCode, 'Scenario code');
	const start = dateOnly(input.horizonStart, 'Scenario horizon start');
	const end = dateOnly(input.horizonEnd, 'Scenario horizon end');
	if (end < start) throw new StrategyValidationError('Scenario horizon end must not precede its start.');
	if (start < context.horizonStart || end > context.horizonEnd) {
		throw new StrategyValidationError('Scenario horizon must sit inside the governing strategy horizon.');
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const [existing] = await connection.execute<RowDataPacket[]>(
			`SELECT 1 FROM strategy_scenarios WHERE organisation_id = ? AND strategy_framework_id = ? AND scenario_code = ? LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, context.frameworkId, code]
		);
		if (existing.length) throw new StrategyValidationError('Scenario code already exists in this strategy cycle.');
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_scenarios
				(organisation_id, strategy_framework_id, public_id, scenario_code, version_number, title,
				 scenario_type, horizon_start, horizon_end, narrative, lifecycle_status,
				 supersedes_strategy_scenario_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, 'draft', NULL, ?)`,
			[
				input.actor.organisationId,
				context.frameworkId,
				publicId,
				code,
				requiredText(input.title, 'Scenario title', 255),
				input.scenarioType,
				start,
				end,
				requiredText(input.narrative, 'Scenario narrative', 20_000),
				input.actor.memberId
			]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.scenario.create',
			subjectType: 'strategy_scenario',
			subjectPublicId: publicId,
			changeSummary: { scenarioCode: code, scenarioType: input.scenarioType, horizonStart: start, horizonEnd: end },
			subfunction: 'F01.08'
		});
		await connection.commit();
		return { publicId };
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function addScenarioAssumption(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	scenarioPublicId: string;
	assumptionCode: string;
	title: string;
	description: string;
	variableKey: string;
	unitLabel: string;
	baselineValue: string | number;
	scenarioValue: string | number;
	sensitivityPercent?: string | number | null;
}): Promise<void> {
	await requireManage(input);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const scenario = await scenarioLock(connection, {
			organisationId: input.actor.organisationId,
			frameworkPublicId: input.frameworkPublicId,
			scenarioPublicId: input.scenarioPublicId,
			status: 'draft'
		});
		await connection.execute(
			`INSERT INTO strategy_scenario_assumptions
				(organisation_id, strategy_scenario_id, public_id, assumption_code, title, description,
				 variable_key, unit_label, baseline_value, scenario_value, sensitivity_percent, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				scenario.id,
				randomUUID(),
				controlledCode(input.assumptionCode, 'Assumption code'),
				requiredText(input.title, 'Assumption title', 255),
				requiredText(input.description, 'Assumption description', 20_000),
				variableKey(input.variableKey),
				requiredText(input.unitLabel, 'Unit', 64),
				decimal(input.baselineValue, 'Baseline value'),
				decimal(input.scenarioValue, 'Scenario value'),
				nonNegativeDecimal(input.sensitivityPercent, 'Sensitivity'),
				input.actor.memberId
			]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.scenario-assumption.add',
			subjectType: 'strategy_scenario',
			subjectPublicId: input.scenarioPublicId,
			changeSummary: { assumptionCode: controlledCode(input.assumptionCode, 'Assumption code'), variableKey: variableKey(input.variableKey) },
			subfunction: 'F01.08'
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function addScenarioProjection(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	scenarioPublicId: string;
	kpiPublicId: string;
	projectionDate: string;
	projectedValue: string | number;
	rationale: string;
}): Promise<void> {
	await requireManage(input);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const scenario = await scenarioLock(connection, {
			organisationId: input.actor.organisationId,
			frameworkPublicId: input.frameworkPublicId,
			scenarioPublicId: input.scenarioPublicId,
			status: 'draft'
		});
		const projectionDate = dateOnly(input.projectionDate, 'Projection date');
		if (projectionDate < dateValue(scenario.horizonStart) || projectionDate > dateValue(scenario.horizonEnd)) {
			throw new StrategyValidationError('Projection date must sit inside the scenario horizon.');
		}
		const [kpis] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT kpi.id FROM strategy_kpis kpi
			 JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id
			 WHERE kpi.organisation_id = ? AND kpi.public_id = ? AND framework.public_id = ?
			   AND kpi.lifecycle_status = 'approved' LIMIT 1`,
			[input.actor.organisationId, input.kpiPublicId, input.frameworkPublicId]
		);
		if (!kpis[0]) throw new StrategyValidationError('Scenario projection requires an approved KPI from this strategy.');
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_scenario_kpi_projections
				(organisation_id, strategy_scenario_id, strategy_kpi_id, public_id,
				 projection_date, projected_value, rationale, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.actor.organisationId,
				scenario.id,
				kpis[0].id,
				publicId,
				projectionDate,
				decimal(input.projectedValue, 'Projected value'),
				requiredText(input.rationale, 'Projection rationale', 20_000),
				input.actor.memberId
			]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.scenario-projection.add',
			subjectType: 'strategy_scenario',
			subjectPublicId: input.scenarioPublicId,
			changeSummary: { kpiPublicId: input.kpiPublicId, projectionDate, projectedValue: String(input.projectedValue) },
			subfunction: 'F01.08'
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function approveStrategyScenario(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	scenarioPublicId: string;
}): Promise<void> {
	const context = await requireContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (!context.permissions.canApprove) throw new StrategyAccessError('You do not have authority to approve strategic scenarios.');
	if (context.framework.lifecycleStatus !== 'approved') throw new StrategyValidationError('Scenario approval requires the current approved strategy.');
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const scenario = await scenarioLock(connection, {
			organisationId: input.actor.organisationId,
			frameworkPublicId: input.frameworkPublicId,
			scenarioPublicId: input.scenarioPublicId,
			status: 'draft'
		});
		const [counts] = await connection.execute<Array<RowDataPacket & { assumptions: number | string; projections: number | string }>>(
			`SELECT
			   (SELECT COUNT(*) FROM strategy_scenario_assumptions WHERE strategy_scenario_id = ?) AS assumptions,
			   (SELECT COUNT(*) FROM strategy_scenario_kpi_projections WHERE strategy_scenario_id = ?) AS projections`,
			[scenario.id, scenario.id]
		);
		if (Number(counts[0]?.assumptions ?? 0) < 1 || Number(counts[0]?.projections ?? 0) < 1) {
			throw new StrategyValidationError('Scenario approval requires at least one explicit assumption and one KPI projection.');
		}
		if (scenario.supersedesId) {
			const [predecessors] = await connection.execute<Array<RowDataPacket & { status: ScenarioStatus }>>(
				`SELECT lifecycle_status AS status FROM strategy_scenarios WHERE organisation_id = ? AND id = ? LIMIT 1 FOR UPDATE`,
				[input.actor.organisationId, scenario.supersedesId]
			);
			if (predecessors[0]?.status !== 'approved') {
				throw new StrategyValidationError('Scenario revision is stale because its predecessor is no longer current.');
			}
			await connection.execute(
				`UPDATE strategy_scenarios SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,
				[input.actor.organisationId, scenario.supersedesId]
			);
		}
		await connection.execute(
			`UPDATE strategy_scenarios
			 SET lifecycle_status = 'approved', approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, scenario.id]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.scenario.approve',
			subjectType: 'strategy_scenario',
			subjectPublicId: input.scenarioPublicId,
			changeSummary: {
				scenarioCode: scenario.code,
				versionNumber: Number(scenario.versionNumber),
				assumptionCount: Number(counts[0]?.assumptions ?? 0),
				projectionCount: Number(counts[0]?.projections ?? 0)
			},
			subfunction: 'F01.08'
		});
		await connection.commit();
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}

export async function reviseStrategyScenario(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	scenarioPublicId: string;
}): Promise<{ publicId: string }> {
	await requireManage(input);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const source = await scenarioLock(connection, {
			organisationId: input.actor.organisationId,
			frameworkPublicId: input.frameworkPublicId,
			scenarioPublicId: input.scenarioPublicId,
			status: 'approved'
		});
		const [drafts] = await connection.execute<RowDataPacket[]>(
			`SELECT 1 FROM strategy_scenarios
			 WHERE organisation_id = ? AND scenario_code = ? AND lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, source.code]
		);
		if (drafts.length) throw new StrategyValidationError('A working revision of this scenario already exists.');
		const publicId = randomUUID();
		const nextVersion = Number(source.versionNumber) + 1;
		const [frameworkRows] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT id FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
			[input.actor.organisationId, input.frameworkPublicId]
		);
		await connection.execute(
			`INSERT INTO strategy_scenarios
				(organisation_id, strategy_framework_id, public_id, scenario_code, version_number, title,
				 scenario_type, horizon_start, horizon_end, narrative, lifecycle_status,
				 supersedes_strategy_scenario_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
			[
				input.actor.organisationId,
				frameworkRows[0]!.id,
				publicId,
				source.code,
				nextVersion,
				source.title,
				source.scenarioType,
				source.horizonStart,
				source.horizonEnd,
				source.narrative,
				source.id,
				input.actor.memberId
			]
		);
		const [newRows] = await connection.execute<Array<RowDataPacket & { id: string | number }>>(
			`SELECT id FROM strategy_scenarios WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
			[input.actor.organisationId, publicId]
		);
		const newId = newRows[0]!.id;
		await connection.execute(
			`INSERT INTO strategy_scenario_assumptions
				(organisation_id, strategy_scenario_id, public_id, assumption_code, title, description,
				 variable_key, unit_label, baseline_value, scenario_value, sensitivity_percent, created_by_member_id)
			 SELECT organisation_id, ?, UUID(), assumption_code, title, description, variable_key,
			        unit_label, baseline_value, scenario_value, sensitivity_percent, ?
			 FROM strategy_scenario_assumptions WHERE strategy_scenario_id = ?`,
			[newId, input.actor.memberId, source.id]
		);
		await connection.execute(
			`INSERT INTO strategy_scenario_kpi_projections
				(organisation_id, strategy_scenario_id, strategy_kpi_id, public_id,
				 projection_date, projected_value, rationale, created_by_member_id)
			 SELECT organisation_id, ?, strategy_kpi_id, UUID(), projection_date, projected_value, rationale, ?
			 FROM strategy_scenario_kpi_projections WHERE strategy_scenario_id = ?`,
			[newId, input.actor.memberId, source.id]
		);
		await evidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.scenario.revise',
			subjectType: 'strategy_scenario',
			subjectPublicId: publicId,
			changeSummary: { scenarioCode: source.code, versionNumber: nextVersion, supersedesPublicId: input.scenarioPublicId },
			subfunction: 'F01.08'
		});
		await connection.commit();
		return { publicId };
	} catch (cause) {
		await connection.rollback();
		throw cause;
	} finally {
		connection.release();
	}
}
