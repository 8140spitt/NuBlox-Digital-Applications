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

export type BusinessPlanStatus = 'draft' | 'approved' | 'superseded';
export type InitiativeStatus = 'proposed' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
export type RequirementType =
	'funding' | 'workforce' | 'capacity' | 'technology' | 'asset' | 'supplier' | 'other';
export type RequirementStatus =
	'identified' | 'requested' | 'committed' | 'satisfied' | 'cancelled';
export type HandoffType =
	'funding' | 'workforce' | 'delivery' | 'change' | 'risk' | 'procurement' | 'technology' | 'other';
export type HandoffStatus = 'requested' | 'accepted' | 'rejected' | 'fulfilled' | 'cancelled';
export type KpiDirection = 'higher_is_better' | 'lower_is_better' | 'target_is_best' | 'band';
export type KpiStatus = 'draft' | 'approved' | 'superseded' | 'retired';
export type ReviewStatus = 'draft' | 'approved';
export type ReviewDecisionType =
	| 'continue'
	| 'accelerate'
	| 'rephase'
	| 'pause'
	| 'stop'
	| 'revise_strategy'
	| 'revise_plan'
	| 'corrective_action';
export type ReviewDecisionStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';

export type StrategyExecutionObjective = {
	publicId: string;
	code: string;
	title: string;
	priorityRank: number;
	targetDate: string | null;
};

export type StrategyBusinessPlan = {
	publicId: string;
	code: string;
	versionNumber: number;
	title: string;
	periodStart: string;
	periodEnd: string;
	narrative: string;
	currencyCode: string;
	plannedRevenueAmount: string;
	plannedOpexAmount: string;
	plannedCapexAmount: string;
	lifecycleStatus: BusinessPlanStatus;
	objectivePublicIds: string[];
	objectiveCount: number;
	initiativeCount: number;
};

export type StrategyInitiative = {
	publicId: string;
	code: string;
	planPublicId: string;
	planCode: string;
	objectivePublicId: string;
	objectiveCode: string;
	objectiveTitle: string;
	title: string;
	outcomeText: string;
	benefitStatement: string | null;
	priorityRank: number;
	startDate: string;
	endDate: string;
	plannedInvestmentAmount: string;
	plannedFte: string;
	currencyCode: string;
	lifecycleStatus: InitiativeStatus;
	resourceRequirementCount: number;
	handoffCount: number;
	kpiCount: number;
};

export type StrategyResourceRequirement = {
	publicId: string;
	initiativePublicId: string;
	initiativeCode: string;
	requirementType: RequirementType;
	title: string;
	description: string;
	amount: string | null;
	currencyCode: string | null;
	quantity: string | null;
	unitLabel: string | null;
	targetFunctionCode: string;
	needBy: string | null;
	lifecycleStatus: RequirementStatus;
	canonicalRecordType: string | null;
	canonicalPublicId: string | null;
};

export type StrategyInitiativeHandoff = {
	publicId: string;
	initiativePublicId: string;
	initiativeCode: string;
	resourceRequirementPublicId: string | null;
	handoffType: HandoffType;
	targetFunctionCode: string;
	requestSummary: string;
	lifecycleStatus: HandoffStatus;
	targetRecordType: string | null;
	targetPublicId: string | null;
	requestedAt: string;
	responseNote: string | null;
};

export type StrategyKpi = {
	publicId: string;
	code: string;
	title: string;
	objectivePublicId: string;
	objectiveCode: string;
	objectiveTitle: string;
	unitLabel: string;
	direction: KpiDirection;
	baselineValue: string;
	targetValue: string;
	targetDate: string | null;
	lifecycleStatus: KpiStatus;
	linkedInitiativeCount: number;
	latestActualValue: string | null;
	latestObservedOn: string | null;
};

export type StrategyReview = {
	publicId: string;
	code: string;
	reviewDate: string;
	title: string;
	summary: string;
	lifecycleStatus: ReviewStatus;
	kpiSnapshotCount: number;
	decisionCount: number;
	openDecisionCount: number;
};

export type StrategyReviewDecision = {
	publicId: string;
	reviewPublicId: string;
	reviewCode: string;
	decisionCode: string;
	decisionType: ReviewDecisionType;
	decisionText: string;
	rationale: string;
	ownerMemberId: string;
	dueDate: string | null;
	lifecycleStatus: ReviewDecisionStatus;
	objectiveCode: string | null;
	initiativeCode: string | null;
	kpiCode: string | null;
};

export type StrategyExecutionReviewWorkspace = {
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
	objectives: StrategyExecutionObjective[];
	plans: StrategyBusinessPlan[];
	initiatives: StrategyInitiative[];
	resourceRequirements: StrategyResourceRequirement[];
	handoffs: StrategyInitiativeHandoff[];
	kpis: StrategyKpi[];
	reviews: StrategyReview[];
	decisions: StrategyReviewDecision[];
};

type FrameworkContext = {
	id: string;
	publicId: string;
	horizonStart: string;
	horizonEnd: string;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
};

type FrameworkContextRow = RowDataPacket & {
	id: string | number;
	publicId: string;
	horizonStart: Date | string;
	horizonEnd: Date | string;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
};

type ObjectiveRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	priorityRank: number | string;
	targetDate: Date | string | null;
};

type PlanRow = RowDataPacket & {
	publicId: string;
	code: string;
	versionNumber: number | string;
	title: string;
	periodStart: Date | string;
	periodEnd: Date | string;
	narrative: string;
	currencyCode: string;
	plannedRevenueAmount: string | number;
	plannedOpexAmount: string | number;
	plannedCapexAmount: string | number;
	lifecycleStatus: BusinessPlanStatus;
	objectiveCount: number | string;
	initiativeCount: number | string;
};

type PlanObjectiveLinkRow = RowDataPacket & {
	planPublicId: string;
	objectivePublicId: string;
};

type InitiativeRow = RowDataPacket & {
	publicId: string;
	code: string;
	planPublicId: string;
	planCode: string;
	objectivePublicId: string;
	objectiveCode: string;
	objectiveTitle: string;
	title: string;
	outcomeText: string;
	benefitStatement: string | null;
	priorityRank: number | string;
	startDate: Date | string;
	endDate: Date | string;
	plannedInvestmentAmount: string | number;
	plannedFte: string | number;
	currencyCode: string;
	lifecycleStatus: InitiativeStatus;
	resourceRequirementCount: number | string;
	handoffCount: number | string;
	kpiCount: number | string;
};

type RequirementRow = RowDataPacket & {
	publicId: string;
	initiativePublicId: string;
	initiativeCode: string;
	requirementType: RequirementType;
	title: string;
	description: string;
	amount: string | number | null;
	currencyCode: string | null;
	quantity: string | number | null;
	unitLabel: string | null;
	targetFunctionCode: string;
	needBy: Date | string | null;
	lifecycleStatus: RequirementStatus;
	canonicalRecordType: string | null;
	canonicalPublicId: string | null;
};

type HandoffRow = RowDataPacket & {
	publicId: string;
	initiativePublicId: string;
	initiativeCode: string;
	resourceRequirementPublicId: string | null;
	handoffType: HandoffType;
	targetFunctionCode: string;
	requestSummary: string;
	lifecycleStatus: HandoffStatus;
	targetRecordType: string | null;
	targetPublicId: string | null;
	requestedAt: Date | string;
	responseNote: string | null;
};

type KpiRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	objectivePublicId: string;
	objectiveCode: string;
	objectiveTitle: string;
	unitLabel: string;
	direction: KpiDirection;
	baselineValue: string | number;
	targetValue: string | number;
	targetDate: Date | string | null;
	lifecycleStatus: KpiStatus;
	linkedInitiativeCount: number | string;
	latestActualValue: string | number | null;
	latestObservedOn: Date | string | null;
};

type ReviewRow = RowDataPacket & {
	publicId: string;
	code: string;
	reviewDate: Date | string;
	title: string;
	summary: string;
	lifecycleStatus: ReviewStatus;
	kpiSnapshotCount: number | string;
	decisionCount: number | string;
	openDecisionCount: number | string;
};

type DecisionRow = RowDataPacket & {
	publicId: string;
	reviewPublicId: string;
	reviewCode: string;
	decisionCode: string;
	decisionType: ReviewDecisionType;
	decisionText: string;
	rationale: string;
	ownerMemberId: string | number;
	dueDate: Date | string | null;
	lifecycleStatus: ReviewDecisionStatus;
	objectiveCode: string | null;
	initiativeCode: string | null;
	kpiCode: string | null;
};

const FUNCTION_CODE = /^F\d{2}$/;
const CURRENCY = /^[A-Z]{3}$/;

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

function dateOnly(
	value: string | null | undefined,
	label: string,
	required = false
): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${normalized}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	return normalized;
}

function dateValue(value: Date | string | null): string | null {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value).slice(0, 10);
}

function dateTimeValue(value: Date | string): string {
	if (value instanceof Date) return value.toISOString();
	return String(value);
}

function currency(value: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CURRENCY.test(normalized)) {
		throw new StrategyValidationError('Currency code must be a three-letter code such as GBP.');
	}
	return normalized;
}

function functionCode(value: string, label = 'Target function'): string {
	const normalized = value.trim().toUpperCase();
	if (!FUNCTION_CODE.test(normalized)) {
		throw new StrategyValidationError(`${label} must use an enterprise function code such as F14.`);
	}
	return normalized;
}

function positiveInteger(value: number | string, label: string): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new StrategyValidationError(`${label} must be a positive whole number.`);
	}
	return parsed;
}

function fixedPoint(
	value: number | string | null | undefined,
	label: string,
	scale: number,
	maximumIntegerDigits: number,
	required = false
): string | null {
	if (value === null || value === undefined || value === '') {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	const raw = typeof value === 'number' ? String(value) : value.trim();
	if (!/^\d+(?:\.\d+)?$/.test(raw)) {
		throw new StrategyValidationError(`${label} must be a non-negative number.`);
	}
	const [integerRaw, fractionRaw = ''] = raw.split('.');
	const integer = integerRaw.replace(/^0+(?=\d)/, '');
	if (integer.length > maximumIntegerDigits || fractionRaw.length > scale) {
		throw new StrategyValidationError(`${label} exceeds the supported numeric range.`);
	}
	return `${integer}.${fractionRaw.padEnd(scale, '0')}`;
}

function decimalString(value: string | number | null): string | null {
	return value == null ? null : String(value);
}

function unique(values: readonly string[] | undefined): string[] {
	return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function assertWithin(
	value: string,
	start: string,
	end: string,
	label: string,
	contextLabel = 'governing planning horizon'
): void {
	if (value < start || value > end) {
		throw new StrategyValidationError(
			`${label} must fall between ${start} and ${end} within the ${contextLabel}.`
		);
	}
}

async function requireWorkspace(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.organisationId,
		memberId: input.memberId
	});
	const framework = workspace.frameworks.find((item) => item.publicId === input.frameworkPublicId);
	if (!framework)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	return { framework, permissions: workspace.permissions };
}

async function requireManageApproved(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {
	const context = await requireWorkspace(input);
	if (!context.permissions.canManage) {
		throw new StrategyAccessError('You do not have authority to manage enterprise planning.');
	}
	if (context.framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Business planning and execution must be governed by an approved strategy version.'
		);
	}
	return context;
}

async function requireApprove(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {
	const context = await requireWorkspace(input);
	if (!context.permissions.canApprove) {
		throw new StrategyAccessError(
			'You do not have authority to approve enterprise planning records.'
		);
	}
	if (context.framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Approval actions require an approved governing strategy version.'
		);
	}
	return context;
}

async function frameworkContext(
	organisationId: string,
	frameworkPublicId: string
): Promise<FrameworkContext> {
	const [rows] = await getPool().execute<FrameworkContextRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        horizon_start AS horizonStart,
		        horizon_end AS horizonEnd,
		        lifecycle_status AS lifecycleStatus
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND public_id = ?
		 LIMIT 1`,
		[organisationId, frameworkPublicId]
	);
	const row = rows[0];
	if (!row)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	return {
		id: row.id.toString(),
		publicId: row.publicId,
		horizonStart: dateValue(row.horizonStart) ?? '',
		horizonEnd: dateValue(row.horizonEnd) ?? '',
		lifecycleStatus: row.lifecycleStatus
	};
}

async function lockApprovedFramework(
	connection: PoolConnection,
	organisationId: string,
	frameworkPublicId: string
): Promise<FrameworkContext> {
	const [rows] = await connection.execute<FrameworkContextRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        horizon_start AS horizonStart,
		        horizon_end AS horizonEnd,
		        lifecycle_status AS lifecycleStatus
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND public_id = ?
		 LIMIT 1
		 FOR UPDATE`,
		[organisationId, frameworkPublicId]
	);
	const row = rows[0];
	if (!row)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	if (row.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Execution records require an approved governing strategy version.'
		);
	}
	return {
		id: row.id.toString(),
		publicId: row.publicId,
		horizonStart: dateValue(row.horizonStart) ?? '',
		horizonEnd: dateValue(row.horizonEnd) ?? '',
		lifecycleStatus: row.lifecycleStatus
	};
}

async function nextScopedCode(
	connection: PoolConnection,
	input: {
		table:
			| 'strategy_business_plans'
			| 'strategy_initiatives'
			| 'strategy_kpis'
			| 'strategy_reviews'
			| 'strategy_review_decisions';
		codeColumn: 'plan_code' | 'initiative_code' | 'kpi_code' | 'review_code' | 'decision_code';
		prefix: string;
		whereSql: string;
		whereValues: readonly (string | number)[];
	}
): Promise<string> {
	const [rows] = await connection.execute<(RowDataPacket & { code: string })[]>(
		`SELECT ${input.codeColumn} AS code
		 FROM ${input.table}
		 WHERE ${input.whereSql}
		   AND ${input.codeColumn} LIKE ?
		 ORDER BY ${input.codeColumn}
		 FOR UPDATE`,
		[...input.whereValues, `${input.prefix}-%`]
	);
	const used = new Set(rows.map((row) => row.code));
	let sequence = 1;
	let candidate = `${input.prefix}-${String(sequence).padStart(3, '0')}`;
	while (used.has(candidate)) {
		sequence += 1;
		candidate = `${input.prefix}-${String(sequence).padStart(3, '0')}`;
	}
	return candidate;
}

async function objectiveIds(
	connection: PoolConnection,
	organisationId: string,
	frameworkId: string,
	publicIds: readonly string[]
): Promise<Map<string, string>> {
	const ids = unique(publicIds);
	if (ids.length === 0) return new Map();
	const placeholders = ids.map(() => '?').join(', ');
	const [rows] = await connection.execute<
		(RowDataPacket & { id: string | number; publicId: string })[]
	>(
		`SELECT DISTINCT objective.id, objective.public_id AS publicId
		 FROM strategy_objectives objective
		 JOIN strategy_objective_option_links option_link
		   ON option_link.strategy_objective_id = objective.id
		 JOIN strategy_options option_record
		   ON option_record.id = option_link.strategy_option_id
		  AND option_record.decision_status = 'selected'
		 JOIN strategy_objective_theme_links theme_link
		   ON theme_link.strategy_objective_id = objective.id
		  AND theme_link.relationship_type = 'primary'
		 WHERE objective.organisation_id = ?
		   AND objective.strategy_framework_id = ?
		   AND objective.lifecycle_status = 'active'
		   AND objective.public_id IN (${placeholders})`,
		[organisationId, frameworkId, ...ids]
	);
	if (rows.length !== ids.length) {
		throw new StrategyValidationError(
			'Every planned objective must be active and retain selected-option and primary-theme lineage.'
		);
	}
	return new Map(rows.map((row) => [row.publicId, row.id.toString()]));
}

function requireMappedId(ids: Map<string, string>, publicId: string): string {
	const id = ids.get(publicId);
	if (!id)
		throw new StrategyValidationError(
			'Linked strategy record is no longer available in this strategy cycle.'
		);
	return id;
}

async function listObjectives(frameworkId: string): Promise<StrategyExecutionObjective[]> {
	const [rows] = await getPool().execute<ObjectiveRow[]>(
		`SELECT public_id AS publicId,
		        objective_code AS code,
		        title,
		        priority_rank AS priorityRank,
		        target_date AS targetDate
		 FROM strategy_objectives
		 WHERE strategy_framework_id = ?
		   AND lifecycle_status = 'active'
		 ORDER BY priority_rank, objective_code`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		title: row.title,
		priorityRank: Number(row.priorityRank),
		targetDate: dateValue(row.targetDate)
	}));
}

async function listPlans(frameworkId: string): Promise<StrategyBusinessPlan[]> {
	const [rows] = await getPool().execute<PlanRow[]>(
		`SELECT plan.public_id AS publicId,
		        plan.plan_code AS code,
		        plan.version_number AS versionNumber,
		        plan.title,
		        plan.period_start AS periodStart,
		        plan.period_end AS periodEnd,
		        plan.narrative,
		        plan.currency_code AS currencyCode,
		        plan.planned_revenue_amount AS plannedRevenueAmount,
		        plan.planned_opex_amount AS plannedOpexAmount,
		        plan.planned_capex_amount AS plannedCapexAmount,
		        plan.lifecycle_status AS lifecycleStatus,
		        (SELECT COUNT(*) FROM strategy_business_plan_objective_links objective_link
		          WHERE objective_link.strategy_business_plan_id = plan.id) AS objectiveCount,
		        (SELECT COUNT(*) FROM strategy_initiatives initiative
		          WHERE initiative.strategy_business_plan_id = plan.id
		            AND initiative.lifecycle_status NOT IN ('completed', 'cancelled')) AS initiativeCount
		 FROM strategy_business_plans plan
		 WHERE plan.strategy_framework_id = ?
		 ORDER BY CASE plan.lifecycle_status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
		          plan.period_start,
		          plan.version_number DESC`,
		[frameworkId]
	);
	const [objectiveLinkRows] = await getPool().execute<PlanObjectiveLinkRow[]>(
		`SELECT plan.public_id AS planPublicId,
		        objective.public_id AS objectivePublicId
		 FROM strategy_business_plan_objective_links objective_link
		 JOIN strategy_business_plans plan
		   ON plan.id = objective_link.strategy_business_plan_id
		 JOIN strategy_objectives objective
		   ON objective.id = objective_link.strategy_objective_id
		 WHERE plan.strategy_framework_id = ?
		 ORDER BY plan.id, objective.priority_rank, objective.objective_code`,
		[frameworkId]
	);
	const objectivePublicIdsByPlan = new Map<string, string[]>();
	for (const link of objectiveLinkRows) {
		const objectivePublicIds = objectivePublicIdsByPlan.get(link.planPublicId) ?? [];
		objectivePublicIds.push(link.objectivePublicId);
		objectivePublicIdsByPlan.set(link.planPublicId, objectivePublicIds);
	}
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		versionNumber: Number(row.versionNumber),
		title: row.title,
		periodStart: dateValue(row.periodStart) ?? '',
		periodEnd: dateValue(row.periodEnd) ?? '',
		narrative: row.narrative,
		currencyCode: row.currencyCode,
		plannedRevenueAmount: String(row.plannedRevenueAmount),
		plannedOpexAmount: String(row.plannedOpexAmount),
		plannedCapexAmount: String(row.plannedCapexAmount),
		lifecycleStatus: row.lifecycleStatus,
		objectivePublicIds: objectivePublicIdsByPlan.get(row.publicId) ?? [],
		objectiveCount: Number(row.objectiveCount),
		initiativeCount: Number(row.initiativeCount)
	}));
}

async function listInitiatives(frameworkId: string): Promise<StrategyInitiative[]> {
	const [rows] = await getPool().execute<InitiativeRow[]>(
		`SELECT initiative.public_id AS publicId,
		        initiative.initiative_code AS code,
		        plan.public_id AS planPublicId,
		        plan.plan_code AS planCode,
		        objective.public_id AS objectivePublicId,
		        objective.objective_code AS objectiveCode,
		        objective.title AS objectiveTitle,
		        initiative.title,
		        initiative.outcome_text AS outcomeText,
		        initiative.benefit_statement AS benefitStatement,
		        initiative.priority_rank AS priorityRank,
		        initiative.start_date AS startDate,
		        initiative.end_date AS endDate,
		        initiative.planned_investment_amount AS plannedInvestmentAmount,
		        initiative.planned_fte AS plannedFte,
		        initiative.currency_code AS currencyCode,
		        initiative.lifecycle_status AS lifecycleStatus,
		        (SELECT COUNT(*) FROM strategy_initiative_resource_requirements requirement
		          WHERE requirement.strategy_initiative_id = initiative.id
		            AND requirement.lifecycle_status <> 'cancelled') AS resourceRequirementCount,
		        (SELECT COUNT(*) FROM strategy_initiative_handoffs handoff
		          WHERE handoff.strategy_initiative_id = initiative.id
		            AND handoff.lifecycle_status <> 'cancelled') AS handoffCount,
		        (SELECT COUNT(*) FROM strategy_initiative_kpi_links kpi_link
		          WHERE kpi_link.strategy_initiative_id = initiative.id) AS kpiCount
		 FROM strategy_initiatives initiative
		 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
		 JOIN strategy_objectives objective ON objective.id = initiative.strategy_objective_id
		 WHERE plan.strategy_framework_id = ?
		   AND plan.lifecycle_status <> 'superseded'
		 ORDER BY initiative.priority_rank, initiative.start_date, initiative.initiative_code`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		planPublicId: row.planPublicId,
		planCode: row.planCode,
		objectivePublicId: row.objectivePublicId,
		objectiveCode: row.objectiveCode,
		objectiveTitle: row.objectiveTitle,
		title: row.title,
		outcomeText: row.outcomeText,
		benefitStatement: row.benefitStatement,
		priorityRank: Number(row.priorityRank),
		startDate: dateValue(row.startDate) ?? '',
		endDate: dateValue(row.endDate) ?? '',
		plannedInvestmentAmount: String(row.plannedInvestmentAmount),
		plannedFte: String(row.plannedFte),
		currencyCode: row.currencyCode,
		lifecycleStatus: row.lifecycleStatus,
		resourceRequirementCount: Number(row.resourceRequirementCount),
		handoffCount: Number(row.handoffCount),
		kpiCount: Number(row.kpiCount)
	}));
}

async function listRequirements(frameworkId: string): Promise<StrategyResourceRequirement[]> {
	const [rows] = await getPool().execute<RequirementRow[]>(
		`SELECT requirement.public_id AS publicId,
		        initiative.public_id AS initiativePublicId,
		        initiative.initiative_code AS initiativeCode,
		        requirement.requirement_type AS requirementType,
		        requirement.title,
		        requirement.description,
		        requirement.amount,
		        requirement.currency_code AS currencyCode,
		        requirement.quantity,
		        requirement.unit_label AS unitLabel,
		        requirement.target_function_code AS targetFunctionCode,
		        requirement.need_by AS needBy,
		        requirement.lifecycle_status AS lifecycleStatus,
		        requirement.canonical_record_type AS canonicalRecordType,
		        requirement.canonical_public_id AS canonicalPublicId
		 FROM strategy_initiative_resource_requirements requirement
		 JOIN strategy_initiatives initiative ON initiative.id = requirement.strategy_initiative_id
		 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
		 WHERE plan.strategy_framework_id = ?
		   AND plan.lifecycle_status <> 'superseded'
		 ORDER BY requirement.need_by, requirement.created_at`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		initiativePublicId: row.initiativePublicId,
		initiativeCode: row.initiativeCode,
		requirementType: row.requirementType,
		title: row.title,
		description: row.description,
		amount: decimalString(row.amount),
		currencyCode: row.currencyCode,
		quantity: decimalString(row.quantity),
		unitLabel: row.unitLabel,
		targetFunctionCode: row.targetFunctionCode,
		needBy: dateValue(row.needBy),
		lifecycleStatus: row.lifecycleStatus,
		canonicalRecordType: row.canonicalRecordType,
		canonicalPublicId: row.canonicalPublicId
	}));
}

async function listHandoffs(frameworkId: string): Promise<StrategyInitiativeHandoff[]> {
	const [rows] = await getPool().execute<HandoffRow[]>(
		`SELECT handoff.public_id AS publicId,
		        initiative.public_id AS initiativePublicId,
		        initiative.initiative_code AS initiativeCode,
		        requirement.public_id AS resourceRequirementPublicId,
		        handoff.handoff_type AS handoffType,
		        handoff.target_function_code AS targetFunctionCode,
		        handoff.request_summary AS requestSummary,
		        handoff.lifecycle_status AS lifecycleStatus,
		        handoff.target_record_type AS targetRecordType,
		        handoff.target_public_id AS targetPublicId,
		        handoff.requested_at AS requestedAt,
		        handoff.response_note AS responseNote
		 FROM strategy_initiative_handoffs handoff
		 JOIN strategy_initiatives initiative ON initiative.id = handoff.strategy_initiative_id
		 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
		 LEFT JOIN strategy_initiative_resource_requirements requirement
		   ON requirement.id = handoff.strategy_resource_requirement_id
		 WHERE plan.strategy_framework_id = ?
		   AND plan.lifecycle_status <> 'superseded'
		 ORDER BY handoff.requested_at DESC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		initiativePublicId: row.initiativePublicId,
		initiativeCode: row.initiativeCode,
		resourceRequirementPublicId: row.resourceRequirementPublicId,
		handoffType: row.handoffType,
		targetFunctionCode: row.targetFunctionCode,
		requestSummary: row.requestSummary,
		lifecycleStatus: row.lifecycleStatus,
		targetRecordType: row.targetRecordType,
		targetPublicId: row.targetPublicId,
		requestedAt: dateTimeValue(row.requestedAt),
		responseNote: row.responseNote
	}));
}

async function listKpis(frameworkId: string): Promise<StrategyKpi[]> {
	const [rows] = await getPool().execute<KpiRow[]>(
		`SELECT kpi.public_id AS publicId,
		        kpi.kpi_code AS code,
		        kpi.title,
		        objective.public_id AS objectivePublicId,
		        objective.objective_code AS objectiveCode,
		        objective.title AS objectiveTitle,
		        kpi.unit_label AS unitLabel,
		        kpi.direction,
		        kpi.baseline_value AS baselineValue,
		        kpi.target_value AS targetValue,
		        kpi.target_date AS targetDate,
		        kpi.lifecycle_status AS lifecycleStatus,
		        (SELECT COUNT(*) FROM strategy_initiative_kpi_links link
		          WHERE link.strategy_kpi_id = kpi.id) AS linkedInitiativeCount,
		        (SELECT observation.actual_value
		           FROM strategy_kpi_observations observation
		          WHERE observation.strategy_kpi_id = kpi.id
		          ORDER BY observation.observed_on DESC, observation.created_at DESC
		          LIMIT 1) AS latestActualValue,
		        (SELECT observation.observed_on
		           FROM strategy_kpi_observations observation
		          WHERE observation.strategy_kpi_id = kpi.id
		          ORDER BY observation.observed_on DESC, observation.created_at DESC
		          LIMIT 1) AS latestObservedOn
		 FROM strategy_kpis kpi
		 JOIN strategy_objectives objective ON objective.id = kpi.strategy_objective_id
		 WHERE kpi.strategy_framework_id = ?
		   AND kpi.lifecycle_status NOT IN ('superseded', 'retired')
		 ORDER BY objective.priority_rank, kpi.kpi_code`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		title: row.title,
		objectivePublicId: row.objectivePublicId,
		objectiveCode: row.objectiveCode,
		objectiveTitle: row.objectiveTitle,
		unitLabel: row.unitLabel,
		direction: row.direction,
		baselineValue: String(row.baselineValue),
		targetValue: String(row.targetValue),
		targetDate: dateValue(row.targetDate),
		lifecycleStatus: row.lifecycleStatus,
		linkedInitiativeCount: Number(row.linkedInitiativeCount),
		latestActualValue: decimalString(row.latestActualValue),
		latestObservedOn: dateValue(row.latestObservedOn)
	}));
}

async function listReviews(frameworkId: string): Promise<StrategyReview[]> {
	const [rows] = await getPool().execute<ReviewRow[]>(
		`SELECT review.public_id AS publicId,
		        review.review_code AS code,
		        review.review_date AS reviewDate,
		        review.title,
		        review.summary,
		        review.lifecycle_status AS lifecycleStatus,
		        (SELECT COUNT(*) FROM strategy_review_kpis snapshot
		          WHERE snapshot.strategy_review_id = review.id) AS kpiSnapshotCount,
		        (SELECT COUNT(*) FROM strategy_review_decisions decision_record
		          WHERE decision_record.strategy_review_id = review.id) AS decisionCount,
		        (SELECT COUNT(*) FROM strategy_review_decisions decision_record
		          WHERE decision_record.strategy_review_id = review.id
		            AND decision_record.lifecycle_status IN ('open', 'in_progress')) AS openDecisionCount
		 FROM strategy_reviews review
		 WHERE review.strategy_framework_id = ?
		 ORDER BY review.review_date DESC, review.created_at DESC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		reviewDate: dateValue(row.reviewDate) ?? '',
		title: row.title,
		summary: row.summary,
		lifecycleStatus: row.lifecycleStatus,
		kpiSnapshotCount: Number(row.kpiSnapshotCount),
		decisionCount: Number(row.decisionCount),
		openDecisionCount: Number(row.openDecisionCount)
	}));
}

async function listDecisions(frameworkId: string): Promise<StrategyReviewDecision[]> {
	const [rows] = await getPool().execute<DecisionRow[]>(
		`SELECT decision_record.public_id AS publicId,
		        review.public_id AS reviewPublicId,
		        review.review_code AS reviewCode,
		        decision_record.decision_code AS decisionCode,
		        decision_record.decision_type AS decisionType,
		        decision_record.decision_text AS decisionText,
		        decision_record.rationale,
		        decision_record.owner_member_id AS ownerMemberId,
		        decision_record.due_date AS dueDate,
		        decision_record.lifecycle_status AS lifecycleStatus,
		        objective.objective_code AS objectiveCode,
		        initiative.initiative_code AS initiativeCode,
		        kpi.kpi_code AS kpiCode
		 FROM strategy_review_decisions decision_record
		 JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id
		 LEFT JOIN strategy_objectives objective ON objective.id = decision_record.strategy_objective_id
		 LEFT JOIN strategy_initiatives initiative ON initiative.id = decision_record.strategy_initiative_id
		 LEFT JOIN strategy_kpis kpi ON kpi.id = decision_record.strategy_kpi_id
		 WHERE review.strategy_framework_id = ?
		 ORDER BY review.review_date DESC, decision_record.created_at`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		reviewPublicId: row.reviewPublicId,
		reviewCode: row.reviewCode,
		decisionCode: row.decisionCode,
		decisionType: row.decisionType,
		decisionText: row.decisionText,
		rationale: row.rationale,
		ownerMemberId: row.ownerMemberId.toString(),
		dueDate: dateValue(row.dueDate),
		lifecycleStatus: row.lifecycleStatus,
		objectiveCode: row.objectiveCode,
		initiativeCode: row.initiativeCode,
		kpiCode: row.kpiCode
	}));
}

export async function getStrategyExecutionReviewWorkspace(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<StrategyExecutionReviewWorkspace> {
	const { framework, permissions } = await requireWorkspace(input);
	const context = await frameworkContext(input.organisationId, input.frameworkPublicId);
	const [objectives, plans, initiatives, resourceRequirements, handoffs, kpis, reviews, decisions] =
		await Promise.all([
			listObjectives(context.id),
			listPlans(context.id),
			listInitiatives(context.id),
			listRequirements(context.id),
			listHandoffs(context.id),
			listKpis(context.id),
			listReviews(context.id),
			listDecisions(context.id)
		]);
	return {
		framework,
		permissions,
		objectives,
		plans,
		initiatives,
		resourceRequirements,
		handoffs,
		kpis,
		reviews,
		decisions
	};
}

export async function createStrategyBusinessPlan(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	title: string;
	periodStart: string;
	periodEnd: string;
	narrative: string;
	currencyCode: string;
	plannedRevenueAmount?: string | number | null;
	plannedOpexAmount?: string | number | null;
	plannedCapexAmount?: string | number | null;
	objectivePublicIds: readonly string[];
}): Promise<{ publicId: string; code: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'Business plan title', 255);
	const periodStart = dateOnly(input.periodStart, 'Planning period start', true) ?? '';
	const periodEnd = dateOnly(input.periodEnd, 'Planning period end', true) ?? '';
	if (periodEnd < periodStart)
		throw new StrategyValidationError('Planning period end must not be before its start.');
	const narrative = requiredText(input.narrative, 'Planning narrative', 20_000);
	const currencyCode = currency(input.currencyCode);
	const plannedRevenueAmount =
		fixedPoint(input.plannedRevenueAmount ?? '0', 'Planned revenue', 4, 15, true) ?? '0.0000';
	const plannedOpexAmount =
		fixedPoint(input.plannedOpexAmount ?? '0', 'Planned operating expenditure', 4, 15, true) ??
		'0.0000';
	const plannedCapexAmount =
		fixedPoint(input.plannedCapexAmount ?? '0', 'Planned capital expenditure', 4, 15, true) ??
		'0.0000';
	const objectivePublicIds = unique(input.objectivePublicIds);
	if (objectivePublicIds.length < 1) {
		throw new StrategyValidationError(
			'A business plan must contribute to at least one strategic objective.'
		);
	}

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		assertWithin(
			periodStart,
			framework.horizonStart,
			framework.horizonEnd,
			'Planning period start',
			'strategy horizon'
		);
		assertWithin(
			periodEnd,
			framework.horizonStart,
			framework.horizonEnd,
			'Planning period end',
			'strategy horizon'
		);
		const objectives = await objectiveIds(
			connection,
			input.actor.organisationId,
			framework.id,
			objectivePublicIds
		);
		const code = await nextScopedCode(connection, {
			table: 'strategy_business_plans',
			codeColumn: 'plan_code',
			prefix: `PLAN-${periodStart.slice(0, 4)}`,
			whereSql: 'organisation_id = ?',
			whereValues: [input.actor.organisationId]
		});
		const publicId = randomUUID();
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_business_plans
				(organisation_id, strategy_framework_id, public_id, plan_code, version_number,
				 title, period_start, period_end, narrative, currency_code,
				 planned_revenue_amount, planned_opex_amount, planned_capex_amount,
				 lifecycle_status, supersedes_business_plan_id, owner_member_id,
				 created_by_member_id, approved_by_member_id, approved_at)
			 VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				code,
				title,
				periodStart,
				periodEnd,
				narrative,
				currencyCode,
				plannedRevenueAmount,
				plannedOpexAmount,
				plannedCapexAmount,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		const planId = result.insertId.toString();
		for (const [index, objectivePublicId] of objectivePublicIds.entries()) {
			await connection.execute(
				`INSERT INTO strategy_business_plan_objective_links
					(organisation_id, strategy_business_plan_id, strategy_objective_id,
					 contribution_type, created_by_member_id)
				 VALUES (?, ?, ?, ?, ?)`,
				[
					input.actor.organisationId,
					planId,
					requireMappedId(objectives, objectivePublicId),
					index === 0 ? 'primary' : 'supporting',
					input.actor.memberId
				]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.business-plan.create',
			subjectType: 'strategy_business_plan',
			subjectPublicId: publicId,
			changeSummary: {
				planCode: code,
				periodStart,
				periodEnd,
				currencyCode,
				objectivePublicIds,
				plannedRevenueAmount,
				plannedOpexAmount,
				plannedCapexAmount
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.04'] }
		});
		await connection.commit();
		return { publicId, code };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function createStrategyInitiative(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	planPublicId: string;
	objectivePublicId: string;
	title: string;
	outcomeText: string;
	benefitStatement?: string | null;
	priorityRank: number | string;
	startDate: string;
	endDate: string;
	plannedInvestmentAmount?: string | number | null;
	plannedFte?: string | number | null;
	currencyCode: string;
}): Promise<{ publicId: string; code: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'Initiative title', 255);
	const outcomeText = requiredText(input.outcomeText, 'Intended outcome', 20_000);
	const benefitStatement = optionalText(input.benefitStatement, 20_000);
	const priorityRank = positiveInteger(input.priorityRank, 'Priority rank');
	const startDate = dateOnly(input.startDate, 'Initiative start', true) ?? '';
	const endDate = dateOnly(input.endDate, 'Initiative end', true) ?? '';
	if (endDate < startDate)
		throw new StrategyValidationError('Initiative end must not be before its start.');
	const plannedInvestmentAmount =
		fixedPoint(input.plannedInvestmentAmount ?? '0', 'Planned investment', 4, 15, true) ?? '0.0000';
	const plannedFte = fixedPoint(input.plannedFte ?? '0', 'Planned FTE', 2, 10, true) ?? '0.00';
	const currencyCode = currency(input.currencyCode);

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [planRows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				periodStart: Date | string;
				periodEnd: Date | string;
				lifecycleStatus: BusinessPlanStatus;
			})[]
		>(
			`SELECT id, period_start AS periodStart, period_end AS periodEnd, lifecycle_status AS lifecycleStatus
			 FROM strategy_business_plans
			 WHERE organisation_id = ? AND strategy_framework_id = ? AND public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.planPublicId]
		);
		const plan = planRows[0];
		if (!plan)
			throw new StrategyValidationError('Business plan is not available in this strategy cycle.');
		if (plan.lifecycleStatus !== 'draft')
			throw new StrategyValidationError(
				'Approved business plans are immutable; create a controlled revision before adding initiatives.'
			);
		const planStart = dateValue(plan.periodStart) ?? '';
		const planEnd = dateValue(plan.periodEnd) ?? '';
		assertWithin(
			startDate,
			planStart,
			planEnd,
			'Initiative start',
			'selected business plan period'
		);
		assertWithin(endDate, planStart, planEnd, 'Initiative end', 'selected business plan period');

		const [objectiveRows] = await connection.execute<(RowDataPacket & { id: string | number })[]>(
			`SELECT objective.id
			 FROM strategy_objectives objective
			 JOIN strategy_business_plan_objective_links link
			   ON link.strategy_objective_id = objective.id
			  AND link.strategy_business_plan_id = ?
			 WHERE objective.organisation_id = ?
			   AND objective.strategy_framework_id = ?
			   AND objective.public_id = ?
			   AND objective.lifecycle_status = 'active'
			 LIMIT 1`,
			[plan.id, input.actor.organisationId, framework.id, input.objectivePublicId]
		);
		const objective = objectiveRows[0];
		if (!objective)
			throw new StrategyValidationError(
				'Initiative objective must be an active objective within the selected business plan.'
			);
		const code = await nextScopedCode(connection, {
			table: 'strategy_initiatives',
			codeColumn: 'initiative_code',
			prefix: 'INIT',
			whereSql: 'strategy_business_plan_id = ?',
			whereValues: [plan.id.toString()]
		});
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_initiatives
				(organisation_id, strategy_business_plan_id, strategy_objective_id,
				 public_id, initiative_code, title, outcome_text, benefit_statement,
				 resource_assumptions, risk_summary, priority_rank, start_date, end_date,
				 owner_member_id, sponsor_member_id, planned_investment_amount, planned_fte,
				 currency_code, project_id, project_budget_id, project_budget_version_id,
				 lifecycle_status, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'proposed', ?)`,
			[
				input.actor.organisationId,
				plan.id,
				objective.id,
				publicId,
				code,
				title,
				outcomeText,
				benefitStatement,
				priorityRank,
				startDate,
				endDate,
				input.actor.memberId,
				input.actor.memberId,
				plannedInvestmentAmount,
				plannedFte,
				currencyCode,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.initiative.create',
			subjectType: 'strategy_initiative',
			subjectPublicId: publicId,
			changeSummary: {
				initiativeCode: code,
				planPublicId: input.planPublicId,
				objectivePublicId: input.objectivePublicId,
				startDate,
				endDate,
				plannedInvestmentAmount,
				plannedFte,
				currencyCode
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.04'] }
		});
		await connection.commit();
		return { publicId, code };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function createStrategyResourceRequirement(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	initiativePublicId: string;
	requirementType: RequirementType;
	title: string;
	description: string;
	amount?: string | number | null;
	currencyCode?: string | null;
	quantity?: string | number | null;
	unitLabel?: string | null;
	targetFunctionCode: string;
	needBy?: string | null;
}): Promise<{ publicId: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const allowedTypes: RequirementType[] = [
		'funding',
		'workforce',
		'capacity',
		'technology',
		'asset',
		'supplier',
		'other'
	];
	if (!allowedTypes.includes(input.requirementType))
		throw new StrategyValidationError('Resource requirement type is invalid.');
	const title = requiredText(input.title, 'Requirement title', 255);
	const description = requiredText(input.description, 'Requirement description', 20_000);
	const amount = fixedPoint(input.amount, 'Amount', 4, 15);
	const quantity = fixedPoint(input.quantity, 'Quantity', 4, 15);
	if (!amount && !quantity)
		throw new StrategyValidationError('Quantify the requirement with an amount or quantity.');
	const currencyCode = amount ? currency(input.currencyCode ?? '') : null;
	const unitLabel = quantity ? requiredText(input.unitLabel ?? '', 'Unit', 64) : null;
	const targetFunctionCode = functionCode(input.targetFunctionCode);
	const needBy = dateOnly(input.needBy, 'Need-by date');

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [rows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				planStatus: BusinessPlanStatus;
				startDate: Date | string;
				endDate: Date | string;
			})[]
		>(
			`SELECT initiative.id,
			        plan.lifecycle_status AS planStatus,
			        initiative.start_date AS startDate,
			        initiative.end_date AS endDate
			 FROM strategy_initiatives initiative
			 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
			 WHERE initiative.organisation_id = ?
			   AND plan.strategy_framework_id = ?
			   AND initiative.public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.initiativePublicId]
		);
		const initiative = rows[0];
		if (!initiative)
			throw new StrategyValidationError('Initiative is not available in this strategy cycle.');
		if (initiative.planStatus !== 'draft')
			throw new StrategyValidationError(
				'Resource requirements can only be changed while the governing business plan is draft.'
			);
		if (needBy)
			assertWithin(
				needBy,
				dateValue(initiative.startDate) ?? framework.horizonStart,
				dateValue(initiative.endDate) ?? framework.horizonEnd,
				'Need-by date',
				'selected initiative period'
			);
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_initiative_resource_requirements
				(organisation_id, strategy_initiative_id, public_id, requirement_type,
				 title, description, amount, currency_code, quantity, unit_label,
				 target_function_code, need_by, lifecycle_status,
				 canonical_record_type, canonical_public_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'identified', NULL, NULL, ?)`,
			[
				input.actor.organisationId,
				initiative.id,
				publicId,
				input.requirementType,
				title,
				description,
				amount,
				currencyCode,
				quantity,
				unitLabel,
				targetFunctionCode,
				needBy,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.resource-requirement.create',
			subjectType: 'strategy_resource_requirement',
			subjectPublicId: publicId,
			changeSummary: {
				initiativePublicId: input.initiativePublicId,
				requirementType: input.requirementType,
				amount,
				currencyCode,
				quantity,
				unitLabel,
				targetFunctionCode,
				needBy
			},
			eventMetadata: {
				function: 'F01',
				subfunctions: ['F01.04'],
				handoffTarget: targetFunctionCode
			}
		});
		await connection.commit();
		return { publicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function requestStrategyInitiativeHandoff(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	initiativePublicId: string;
	resourceRequirementPublicId?: string | null;
	handoffType: HandoffType;
	targetFunctionCode: string;
	requestSummary: string;
}): Promise<{ publicId: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const allowedTypes: HandoffType[] = [
		'funding',
		'workforce',
		'delivery',
		'change',
		'risk',
		'procurement',
		'technology',
		'other'
	];
	if (!allowedTypes.includes(input.handoffType))
		throw new StrategyValidationError('Handoff type is invalid.');
	const targetFunctionCode = functionCode(input.targetFunctionCode);
	const requestSummary = requiredText(input.requestSummary, 'Handoff request', 20_000);
	const requirementPublicId = input.resourceRequirementPublicId?.trim() || null;

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [initiativeRows] = await connection.execute<
			(RowDataPacket & { id: string | number; planStatus: BusinessPlanStatus })[]
		>(
			`SELECT initiative.id, plan.lifecycle_status AS planStatus
			 FROM strategy_initiatives initiative
			 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
			 WHERE initiative.organisation_id = ?
			   AND plan.strategy_framework_id = ?
			   AND initiative.public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.initiativePublicId]
		);
		const initiative = initiativeRows[0];
		if (!initiative)
			throw new StrategyValidationError('Initiative is not available in this strategy cycle.');
		if (initiative.planStatus !== 'draft')
			throw new StrategyValidationError(
				'New handoffs can only be requested while the governing business plan is draft.'
			);

		let requirementId: string | null = null;
		if (requirementPublicId) {
			const [requirementRows] = await connection.execute<
				(RowDataPacket & { id: string | number; targetFunctionCode: string })[]
			>(
				`SELECT id, target_function_code AS targetFunctionCode
				 FROM strategy_initiative_resource_requirements
				 WHERE organisation_id = ?
				   AND strategy_initiative_id = ?
				   AND public_id = ?
				   AND lifecycle_status NOT IN ('satisfied', 'cancelled')
				 LIMIT 1 FOR UPDATE`,
				[input.actor.organisationId, initiative.id, requirementPublicId]
			);
			const requirement = requirementRows[0];
			if (!requirement)
				throw new StrategyValidationError(
					'Resource requirement is not available for this initiative.'
				);
			if (requirement.targetFunctionCode !== targetFunctionCode) {
				throw new StrategyValidationError(
					'Handoff target must match the linked resource requirement target function.'
				);
			}
			requirementId = requirement.id.toString();
		}
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_initiative_handoffs
				(organisation_id, strategy_initiative_id, strategy_resource_requirement_id,
				 public_id, handoff_type, target_function_code, request_summary,
				 lifecycle_status, target_record_type, target_public_id, response_note,
				 requested_by_member_id, responded_by_member_id, responded_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'requested', NULL, NULL, NULL, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				initiative.id,
				requirementId,
				publicId,
				input.handoffType,
				targetFunctionCode,
				requestSummary,
				input.actor.memberId
			]
		);
		if (requirementId) {
			await connection.execute(
				`UPDATE strategy_initiative_resource_requirements
				 SET lifecycle_status = 'requested'
				 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'identified'`,
				[input.actor.organisationId, requirementId]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.execution-handoff.request',
			subjectType: 'strategy_initiative_handoff',
			subjectPublicId: publicId,
			changeSummary: {
				initiativePublicId: input.initiativePublicId,
				resourceRequirementPublicId: requirementPublicId,
				handoffType: input.handoffType,
				targetFunctionCode
			},
			eventMetadata: {
				function: 'F01',
				subfunctions: ['F01.04'],
				handoffTarget: targetFunctionCode
			}
		});
		await connection.commit();
		return { publicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function createStrategyKpi(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	objectivePublicId: string;
	initiativePublicIds?: readonly string[];
	title: string;
	description: string;
	unitLabel: string;
	direction: KpiDirection;
	baselineValue: string | number;
	targetValue: string | number;
	targetDate?: string | null;
}): Promise<{ publicId: string; code: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'KPI title', 255);
	const description = requiredText(input.description, 'KPI description', 20_000);
	const unitLabel = requiredText(input.unitLabel, 'KPI unit', 64);
	const allowedDirections: KpiDirection[] = [
		'higher_is_better',
		'lower_is_better',
		'target_is_best',
		'band'
	];
	if (!allowedDirections.includes(input.direction))
		throw new StrategyValidationError('KPI direction is invalid.');
	const baselineValue =
		fixedPoint(input.baselineValue, 'Baseline value', 8, 16, true) ?? '0.00000000';
	const targetValue = fixedPoint(input.targetValue, 'Target value', 8, 16, true) ?? '0.00000000';
	const targetDate = dateOnly(input.targetDate, 'Target date');
	const initiativePublicIds = unique(input.initiativePublicIds);

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		if (targetDate)
			assertWithin(
				targetDate,
				framework.horizonStart,
				framework.horizonEnd,
				'Target date',
				'strategy horizon'
			);
		const objectives = await objectiveIds(connection, input.actor.organisationId, framework.id, [
			input.objectivePublicId
		]);
		const objectiveId = requireMappedId(objectives, input.objectivePublicId);

		const initiativeIds = new Map<string, string>();
		if (initiativePublicIds.length > 0) {
			const placeholders = initiativePublicIds.map(() => '?').join(', ');
			const [rows] = await connection.execute<
				(RowDataPacket & { id: string | number; publicId: string })[]
			>(
				`SELECT initiative.id, initiative.public_id AS publicId
				 FROM strategy_initiatives initiative
				 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
				 WHERE initiative.organisation_id = ?
				   AND plan.strategy_framework_id = ?
				   AND initiative.strategy_objective_id = ?
				   AND initiative.public_id IN (${placeholders})
				   AND initiative.lifecycle_status NOT IN ('completed', 'cancelled')`,
				[input.actor.organisationId, framework.id, objectiveId, ...initiativePublicIds]
			);
			if (rows.length !== initiativePublicIds.length) {
				throw new StrategyValidationError(
					'Every linked initiative must contribute to the selected objective in this strategy cycle.'
				);
			}
			for (const row of rows) initiativeIds.set(row.publicId, row.id.toString());
		}
		const code = await nextScopedCode(connection, {
			table: 'strategy_kpis',
			codeColumn: 'kpi_code',
			prefix: 'KPI',
			whereSql: 'strategy_framework_id = ?',
			whereValues: [framework.id]
		});
		const publicId = randomUUID();
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_kpis
				(organisation_id, strategy_framework_id, strategy_objective_id, public_id,
				 kpi_code, version_number, title, description, unit_label, direction,
				 aggregation_method, baseline_value, target_value, warning_threshold,
				 critical_threshold, target_date, source_mode, source_domain,
				 source_record_type, source_measure_key, owner_member_id, lifecycle_status,
				 supersedes_strategy_kpi_id, created_by_member_id, approved_by_member_id, approved_at)
			 VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'latest', ?, ?, NULL, NULL, ?,
			         'manual', NULL, NULL, NULL, ?, 'draft', NULL, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				framework.id,
				objectiveId,
				publicId,
				code,
				title,
				description,
				unitLabel,
				input.direction,
				baselineValue,
				targetValue,
				targetDate,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		const kpiId = result.insertId.toString();
		for (const initiativePublicId of initiativePublicIds) {
			await connection.execute(
				`INSERT INTO strategy_initiative_kpi_links
					(organisation_id, strategy_initiative_id, strategy_kpi_id, contribution_type, created_by_member_id)
				 VALUES (?, ?, ?, 'contributing', ?)`,
				[
					input.actor.organisationId,
					requireMappedId(initiativeIds, initiativePublicId),
					kpiId,
					input.actor.memberId
				]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.kpi.create',
			subjectType: 'strategy_kpi',
			subjectPublicId: publicId,
			changeSummary: {
				kpiCode: code,
				objectivePublicId: input.objectivePublicId,
				initiativePublicIds,
				baselineValue,
				targetValue,
				targetDate,
				direction: input.direction
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.06'] }
		});
		await connection.commit();
		return { publicId, code };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function approveStrategyKpi(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kpiPublicId: string;
}): Promise<void> {
	await requireApprove({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [rows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				code: string;
				lifecycleStatus: KpiStatus;
				supersedesKpiId: string | number | null;
			})[]
		>(
			`SELECT id, kpi_code AS code, lifecycle_status AS lifecycleStatus,
			        supersedes_strategy_kpi_id AS supersedesKpiId
			 FROM strategy_kpis
			 WHERE organisation_id = ? AND strategy_framework_id = ? AND public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.kpiPublicId]
		);
		const kpi = rows[0];
		if (!kpi) throw new StrategyValidationError('KPI is not available in this strategy cycle.');
		if (kpi.lifecycleStatus !== 'draft')
			throw new StrategyValidationError('Only a draft KPI can be approved.');
		const [approvedRows] = await connection.execute<
			(RowDataPacket & { id: string | number; publicId: string })[]
		>(
			`SELECT id, public_id AS publicId FROM strategy_kpis
			 WHERE organisation_id = ? AND strategy_framework_id = ? AND kpi_code = ?
			   AND lifecycle_status = 'approved' AND id <> ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, kpi.code, kpi.id]
		);
		const previousApproved = approvedRows[0] ?? null;
		if (previousApproved) {
			if (kpi.supersedesKpiId?.toString() !== previousApproved.id.toString()) {
				throw new StrategyValidationError(
					'An approved version of this KPI already exists. Approve only a controlled revision of the current definition.'
				);
			}
			await connection.execute(
				`UPDATE strategy_kpis SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,
				[input.actor.organisationId, previousApproved.id]
			);
		} else if (kpi.supersedesKpiId) {
			throw new StrategyValidationError(
				'The KPI revision is stale because its predecessor is no longer the current approved definition.'
			);
		}
		await connection.execute(
			`UPDATE strategy_kpis
			 SET lifecycle_status = 'approved', approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, kpi.id]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.kpi.approve',
			subjectType: 'strategy_kpi',
			subjectPublicId: input.kpiPublicId,
			changeSummary: {
				kpiCode: kpi.code,
				lifecycleStatus: 'approved',
				supersededKpiPublicId: previousApproved?.publicId ?? null
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.06'] }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function recordStrategyKpiObservation(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kpiPublicId: string;
	observedOn: string;
	actualValue: string | number;
	forecastValue?: string | number | null;
	commentary?: string | null;
}): Promise<{ publicId: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const observedOn = dateOnly(input.observedOn, 'Observation date', true) ?? '';
	const actualValue = fixedPoint(input.actualValue, 'Actual value', 8, 16, true) ?? '0.00000000';
	const forecastValue = fixedPoint(input.forecastValue, 'Forecast value', 8, 16);
	const commentary = optionalText(input.commentary, 20_000);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		assertWithin(
			observedOn,
			framework.horizonStart,
			framework.horizonEnd,
			'Observation date',
			'strategy horizon'
		);
		const [rows] = await connection.execute<
			(RowDataPacket & { id: string | number; lifecycleStatus: KpiStatus; code: string })[]
		>(
			`SELECT id, lifecycle_status AS lifecycleStatus, kpi_code AS code
			 FROM strategy_kpis
			 WHERE organisation_id = ? AND strategy_framework_id = ? AND public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.kpiPublicId]
		);
		const kpi = rows[0];
		if (!kpi) throw new StrategyValidationError('KPI is not available in this strategy cycle.');
		if (kpi.lifecycleStatus !== 'approved')
			throw new StrategyValidationError(
				'Actual performance can only be recorded against an approved KPI definition.'
			);
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_kpi_observations
				(organisation_id, strategy_kpi_id, public_id, observed_on, actual_value,
				 forecast_value, commentary, source_mode, source_domain, source_record_type,
				 source_public_id, source_measure_key, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', NULL, NULL, NULL, NULL, ?)`,
			[
				input.actor.organisationId,
				kpi.id,
				publicId,
				observedOn,
				actualValue,
				forecastValue,
				commentary,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.kpi-observation.record',
			subjectType: 'strategy_kpi_observation',
			subjectPublicId: publicId,
			changeSummary: {
				kpiPublicId: input.kpiPublicId,
				kpiCode: kpi.code,
				observedOn,
				actualValue,
				forecastValue
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.06'], sourceMode: 'manual' }
		});
		await connection.commit();
		return { publicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

function assessPerformance(input: {
	direction: KpiDirection;
	actual: number;
	target: number;
	warning: number | null;
}): 'on_track' | 'watch' | 'off_track' {
	if (input.direction === 'higher_is_better') {
		if (input.actual >= input.target) return 'on_track';
		if (input.warning !== null && input.actual >= input.warning) return 'watch';
		return 'off_track';
	}
	if (input.direction === 'lower_is_better') {
		if (input.actual <= input.target) return 'on_track';
		if (input.warning !== null && input.actual <= input.warning) return 'watch';
		return 'off_track';
	}
	const variance = Math.abs(input.actual - input.target);
	if (variance === 0) return 'on_track';
	if (input.warning !== null && variance <= Math.abs(input.warning)) return 'watch';
	return 'off_track';
}

export async function createStrategyReview(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	reviewDate: string;
	title: string;
	summary: string;
}): Promise<{ publicId: string; code: string; snapshotCount: number }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const reviewDate = dateOnly(input.reviewDate, 'Review date', true) ?? '';
	const title = requiredText(input.title, 'Review title', 255);
	const summary = requiredText(input.summary, 'Review summary', 20_000);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		assertWithin(
			reviewDate,
			framework.horizonStart,
			framework.horizonEnd,
			'Review date',
			'strategy horizon'
		);
		const [kpiRows] = await connection.execute<
			(RowDataPacket & {
				kpiId: string | number;
				observationId: string | number;
				actualValue: string | number;
				targetValue: string | number;
				direction: KpiDirection;
				warningThreshold: string | number | null;
			})[]
		>(
			`SELECT kpi.id AS kpiId,
			        observation.id AS observationId,
			        observation.actual_value AS actualValue,
			        kpi.target_value AS targetValue,
			        kpi.direction,
			        kpi.warning_threshold AS warningThreshold
			 FROM strategy_kpis kpi
			 JOIN strategy_kpi_observations observation
			   ON observation.id = (
			       SELECT latest.id
			       FROM strategy_kpi_observations latest
			       WHERE latest.strategy_kpi_id = kpi.id
			         AND latest.observed_on <= ?
			       ORDER BY latest.observed_on DESC, latest.created_at DESC
			       LIMIT 1
			   )
			 WHERE kpi.organisation_id = ?
			   AND kpi.strategy_framework_id = ?
			   AND kpi.lifecycle_status = 'approved'
			 ORDER BY kpi.kpi_code`,
			[reviewDate, input.actor.organisationId, framework.id]
		);
		if (kpiRows.length < 1) {
			throw new StrategyValidationError(
				'A strategic review requires at least one approved KPI with an actual observation on or before the review date.'
			);
		}
		const code = await nextScopedCode(connection, {
			table: 'strategy_reviews',
			codeColumn: 'review_code',
			prefix: `REV-${reviewDate.replaceAll('-', '')}`,
			whereSql: 'strategy_framework_id = ?',
			whereValues: [framework.id]
		});
		const publicId = randomUUID();
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_reviews
				(organisation_id, strategy_framework_id, public_id, review_code, review_date,
				 title, summary, decisions_text, lifecycle_status, created_by_member_id,
				 approved_by_member_id, approved_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'draft', ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				code,
				reviewDate,
				title,
				summary,
				input.actor.memberId
			]
		);
		const reviewId = result.insertId.toString();
		for (const kpi of kpiRows) {
			const actual = Number(kpi.actualValue);
			const target = Number(kpi.targetValue);
			const variance = actual - target;
			const variancePercent = target === 0 ? null : (variance / Math.abs(target)) * 100;
			const warning = kpi.warningThreshold == null ? null : Number(kpi.warningThreshold);
			const assessment = assessPerformance({ direction: kpi.direction, actual, target, warning });
			await connection.execute(
				`INSERT INTO strategy_review_kpis
					(organisation_id, strategy_review_id, strategy_kpi_id, strategy_kpi_observation_id,
					 actual_value_snapshot, target_value_snapshot, variance_value, variance_percent,
					 assessment, commentary, created_by_member_id)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
				[
					input.actor.organisationId,
					reviewId,
					kpi.kpiId,
					kpi.observationId,
					String(actual),
					String(target),
					String(variance),
					variancePercent == null ? null : String(variancePercent),
					assessment,
					input.actor.memberId
				]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.review.create',
			subjectType: 'strategy_review',
			subjectPublicId: publicId,
			changeSummary: { reviewCode: code, reviewDate, kpiSnapshotCount: kpiRows.length },
			eventMetadata: { function: 'F01', subfunctions: ['F01.07'] }
		});
		await connection.commit();
		return { publicId, code, snapshotCount: kpiRows.length };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function createStrategyReviewDecision(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	reviewPublicId: string;
	decisionType: ReviewDecisionType;
	decisionText: string;
	rationale: string;
	dueDate?: string | null;
	objectivePublicId?: string | null;
	initiativePublicId?: string | null;
	kpiPublicId?: string | null;
}): Promise<{ publicId: string; code: string }> {
	await requireManageApproved({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const allowedTypes: ReviewDecisionType[] = [
		'continue',
		'accelerate',
		'rephase',
		'pause',
		'stop',
		'revise_strategy',
		'revise_plan',
		'corrective_action'
	];
	if (!allowedTypes.includes(input.decisionType))
		throw new StrategyValidationError('Review decision type is invalid.');
	const decisionText = requiredText(input.decisionText, 'Decision', 20_000);
	const rationale = requiredText(input.rationale, 'Decision rationale', 20_000);
	const dueDate = dateOnly(input.dueDate, 'Decision due date');
	const objectivePublicId = input.objectivePublicId?.trim() || null;
	const initiativePublicId = input.initiativePublicId?.trim() || null;
	const kpiPublicId = input.kpiPublicId?.trim() || null;

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [reviewRows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				code: string;
				reviewDate: Date | string;
				lifecycleStatus: ReviewStatus;
			})[]
		>(
			`SELECT id, review_code AS code, review_date AS reviewDate, lifecycle_status AS lifecycleStatus
			 FROM strategy_reviews
			 WHERE organisation_id = ? AND strategy_framework_id = ? AND public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.reviewPublicId]
		);
		const review = reviewRows[0];
		if (!review)
			throw new StrategyValidationError(
				'Strategic review is not available in this strategy cycle.'
			);
		if (review.lifecycleStatus !== 'draft')
			throw new StrategyValidationError('Approved reviews are immutable enterprise evidence.');
		if (dueDate && dueDate < (dateValue(review.reviewDate) ?? ''))
			throw new StrategyValidationError('Decision due date cannot be before the review date.');

		const resolveOptional = async (
			table: 'strategy_objectives' | 'strategy_kpis',
			publicId: string | null
		): Promise<string | null> => {
			if (!publicId) return null;
			const [rows] = await connection.execute<(RowDataPacket & { id: string | number })[]>(
				`SELECT id FROM ${table}
				 WHERE organisation_id = ? AND strategy_framework_id = ? AND public_id = ? LIMIT 1`,
				[input.actor.organisationId, framework.id, publicId]
			);
			if (!rows[0])
				throw new StrategyValidationError(
					'Linked review subject is not available in this strategy cycle.'
				);
			return rows[0].id.toString();
		};
		const objectiveId = await resolveOptional('strategy_objectives', objectivePublicId);
		const kpiId = await resolveOptional('strategy_kpis', kpiPublicId);
		let initiativeId: string | null = null;
		if (initiativePublicId) {
			const [rows] = await connection.execute<(RowDataPacket & { id: string | number })[]>(
				`SELECT initiative.id
				 FROM strategy_initiatives initiative
				 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
				 WHERE initiative.organisation_id = ? AND plan.strategy_framework_id = ? AND initiative.public_id = ? LIMIT 1`,
				[input.actor.organisationId, framework.id, initiativePublicId]
			);
			if (!rows[0])
				throw new StrategyValidationError(
					'Linked initiative is not available in this strategy cycle.'
				);
			initiativeId = rows[0].id.toString();
		}
		const code = await nextScopedCode(connection, {
			table: 'strategy_review_decisions',
			codeColumn: 'decision_code',
			prefix: 'DEC',
			whereSql: 'strategy_review_id = ?',
			whereValues: [review.id.toString()]
		});
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_review_decisions
				(organisation_id, strategy_review_id, public_id, decision_code, decision_type,
				 strategy_objective_id, strategy_initiative_id, strategy_kpi_id,
				 decision_text, rationale, owner_member_id, due_date, lifecycle_status,
				 completion_note, completed_by_member_id, completed_at, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', NULL, NULL, NULL, ?)`,
			[
				input.actor.organisationId,
				review.id,
				publicId,
				code,
				input.decisionType,
				objectiveId,
				initiativeId,
				kpiId,
				decisionText,
				rationale,
				input.actor.memberId,
				dueDate,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.review-decision.create',
			subjectType: 'strategy_review_decision',
			subjectPublicId: publicId,
			changeSummary: {
				reviewPublicId: input.reviewPublicId,
				reviewCode: review.code,
				decisionCode: code,
				decisionType: input.decisionType,
				objectivePublicId,
				initiativePublicId,
				kpiPublicId,
				dueDate
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.07'] }
		});
		await connection.commit();
		return { publicId, code };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function approveStrategyReview(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	reviewPublicId: string;
}): Promise<void> {
	await requireApprove({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockApprovedFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const [rows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				code: string;
				lifecycleStatus: ReviewStatus;
				snapshotCount: number | string;
			})[]
		>(
			`SELECT review.id,
			        review.review_code AS code,
			        review.lifecycle_status AS lifecycleStatus,
			        (SELECT COUNT(*) FROM strategy_review_kpis snapshot WHERE snapshot.strategy_review_id = review.id) AS snapshotCount
			 FROM strategy_reviews review
			 WHERE review.organisation_id = ? AND review.strategy_framework_id = ? AND review.public_id = ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, framework.id, input.reviewPublicId]
		);
		const review = rows[0];
		if (!review)
			throw new StrategyValidationError(
				'Strategic review is not available in this strategy cycle.'
			);
		if (review.lifecycleStatus !== 'draft')
			throw new StrategyValidationError('Only a draft strategic review can be approved.');
		if (Number(review.snapshotCount) < 1)
			throw new StrategyValidationError(
				'A strategic review cannot be approved without frozen KPI evidence.'
			);
		await connection.execute(
			`UPDATE strategy_reviews
			 SET lifecycle_status = 'approved', approved_by_member_id = ?, approved_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, review.id]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.review.approve',
			subjectType: 'strategy_review',
			subjectPublicId: input.reviewPublicId,
			changeSummary: {
				reviewCode: review.code,
				lifecycleStatus: 'approved',
				kpiSnapshotCount: Number(review.snapshotCount)
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.07'] }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
