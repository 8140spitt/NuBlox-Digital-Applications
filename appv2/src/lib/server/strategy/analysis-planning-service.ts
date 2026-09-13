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

export type EvidenceType =
	| 'internal_data'
	| 'external_report'
	| 'market_intelligence'
	| 'regulatory'
	| 'expert_judgement'
	| 'stakeholder'
	| 'other';
export type EnvironmentScope = 'internal' | 'external';
export type EnvironmentDimension =
	'economic' | 'competitive' | 'market' | 'technology' | 'regulatory' | 'operational' | 'other';
export type EnvironmentDirection = 'strength' | 'weakness' | 'opportunity' | 'threat' | 'neutral';
export type OptionDecisionStatus = 'proposed' | 'selected' | 'rejected';
export type AssumptionStatus =
	'unvalidated' | 'validated' | 'challenged' | 'invalidated' | 'retired';
export type ObjectiveStatus = 'draft' | 'active' | 'achieved' | 'retired';

export type StrategyEvidenceItem = {
	publicId: string;
	evidenceType: EvidenceType;
	title: string;
	sourceReference: string | null;
	sourceUri: string | null;
	publisherName: string | null;
	publishedOn: string | null;
	observedOn: string | null;
	summaryText: string;
	reliabilityScore: number | null;
	factorCount: number;
};

export type StrategyEnvironmentFactor = {
	publicId: string;
	contextScope: EnvironmentScope;
	dimension: EnvironmentDimension;
	direction: EnvironmentDirection;
	title: string;
	analysisText: string;
	implicationText: string | null;
	observedOn: string | null;
	likelihoodScore: number | null;
	impactScore: number | null;
	confidenceScore: number | null;
	evidenceCount: number;
	optionCount: number;
};

export type StrategyAssumption = {
	publicId: string;
	statementText: string;
	rationaleText: string | null;
	confidenceScore: number | null;
	reviewBy: string | null;
	validationStatus: AssumptionStatus;
	optionCount: number;
};

export type StrategyOption = {
	publicId: string;
	title: string;
	description: string;
	evaluationSummary: string | null;
	decisionStatus: OptionDecisionStatus;
	decisionRationale: string | null;
	priorityRank: number | null;
	factorCount: number;
	assumptionCount: number;
	objectiveCount: number;
};

export type StrategyTheme = {
	publicId: string;
	code: string;
	title: string;
	description: string;
	priorityRank: number;
	objectiveCount: number;
};

export type StrategyObjective = {
	publicId: string;
	code: string;
	title: string;
	description: string;
	priorityRank: number;
	targetDate: string | null;
	lifecycleStatus: ObjectiveStatus;
	parentPublicId: string | null;
	parentCode: string | null;
	optionCount: number;
	themeCount: number;
};

export type StrategyAnalysisPlanningWorkspace = {
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
	evidence: StrategyEvidenceItem[];
	factors: StrategyEnvironmentFactor[];
	assumptions: StrategyAssumption[];
	options: StrategyOption[];
	themes: StrategyTheme[];
	objectives: StrategyObjective[];
};

type FrameworkContextRow = RowDataPacket & {
	id: string | number;
	publicId: string;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
	horizonStart: Date | string;
	horizonEnd: Date | string;
};

type EvidenceRow = RowDataPacket & {
	publicId: string;
	evidenceType: EvidenceType;
	title: string;
	sourceReference: string | null;
	sourceUri: string | null;
	publisherName: string | null;
	publishedOn: Date | string | null;
	observedOn: Date | string | null;
	summaryText: string;
	reliabilityScore: number | string | null;
	factorCount: number | string;
};

type FactorRow = RowDataPacket & {
	publicId: string;
	contextScope: EnvironmentScope;
	dimension: EnvironmentDimension;
	direction: EnvironmentDirection;
	title: string;
	analysisText: string;
	implicationText: string | null;
	observedOn: Date | string | null;
	likelihoodScore: number | string | null;
	impactScore: number | string | null;
	confidenceScore: number | string | null;
	evidenceCount: number | string;
	optionCount: number | string;
};

type AssumptionRow = RowDataPacket & {
	publicId: string;
	statementText: string;
	rationaleText: string | null;
	confidenceScore: number | string | null;
	reviewBy: Date | string | null;
	validationStatus: AssumptionStatus;
	optionCount: number | string;
};

type OptionRow = RowDataPacket & {
	publicId: string;
	title: string;
	description: string;
	evaluationSummary: string | null;
	decisionStatus: OptionDecisionStatus;
	decisionRationale: string | null;
	priorityRank: number | string | null;
	factorCount: number | string;
	assumptionCount: number | string;
	objectiveCount: number | string;
};

type ThemeRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	description: string;
	priorityRank: number | string;
	objectiveCount: number | string;
};

type ObjectiveRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
	description: string;
	priorityRank: number | string;
	targetDate: Date | string | null;
	lifecycleStatus: ObjectiveStatus;
	parentPublicId: string | null;
	parentCode: string | null;
	optionCount: number | string;
	themeCount: number | string;
};

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

function score(value: number | null | undefined, label: string, required = false): number | null {
	if (value == null || Number.isNaN(value)) {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	if (!Number.isInteger(value) || value < 1 || value > 5) {
		throw new StrategyValidationError(`${label} must be an integer from 1 to 5.`);
	}
	return value;
}

function positiveInteger(
	value: number | null | undefined,
	label: string,
	required = false
): number | null {
	if (value == null || Number.isNaN(value)) {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	if (!Number.isInteger(value) || value < 1) {
		throw new StrategyValidationError(`${label} must be a positive integer.`);
	}
	return value;
}

function dateValue(value: Date | string | null): string | null {
	if (!value) return null;
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value).slice(0, 10);
}

function numeric(value: number | string | null): number | null {
	return value == null ? null : Number(value);
}

function uniquePublicIds(values: readonly string[] | undefined): string[] {
	return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
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

async function requireManage(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<void> {
	const { framework, permissions } = await requireWorkspace(input);
	if (!permissions.canManage) {
		throw new StrategyAccessError('You do not have authority to develop enterprise strategy.');
	}
	if (framework.lifecycleStatus !== 'draft') {
		throw new StrategyValidationError(
			'Approved or superseded strategy is immutable. Create a controlled revision before changing it.'
		);
	}
}

async function lockFramework(
	connection: PoolConnection,
	organisationId: string,
	frameworkPublicId: string
): Promise<FrameworkContextRow> {
	const [rows] = await connection.execute<FrameworkContextRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        lifecycle_status AS lifecycleStatus,
		        horizon_start AS horizonStart,
		        horizon_end AS horizonEnd
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND public_id = ?
		 LIMIT 1
		 FOR UPDATE`,
		[organisationId, frameworkPublicId]
	);
	const framework = rows[0];
	if (!framework)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	if (framework.lifecycleStatus !== 'draft') {
		throw new StrategyValidationError(
			'Approved or superseded strategy is immutable. Create a controlled revision before changing it.'
		);
	}
	return framework;
}

async function internalIdsByPublicId(
	connection: PoolConnection,
	input: {
		table:
			| 'strategy_evidence_items'
			| 'strategy_environment_factors'
			| 'strategy_assumptions'
			| 'strategy_options'
			| 'strategy_themes'
			| 'strategy_objectives';
		organisationId: string;
		frameworkId: string;
		publicIds: readonly string[];
	}
): Promise<Map<string, string>> {
	const publicIds = uniquePublicIds(input.publicIds);
	if (publicIds.length === 0) return new Map();
	const placeholders = publicIds.map(() => '?').join(', ');
	const [rows] = await connection.execute<
		(RowDataPacket & { id: string | number; publicId: string })[]
	>(
		`SELECT id, public_id AS publicId
		 FROM ${input.table}
		 WHERE organisation_id = ?
		   AND strategy_framework_id = ?
		   AND public_id IN (${placeholders})`,
		[input.organisationId, input.frameworkId, ...publicIds]
	);
	if (rows.length !== publicIds.length) {
		throw new StrategyValidationError(
			'One or more linked strategy records are not available in this strategy cycle.'
		);
	}
	return new Map(rows.map((row) => [row.publicId, row.id.toString()]));
}

function requireMappedId(ids: Map<string, string>, publicId: string): string {
	const id = ids.get(publicId);
	if (!id) {
		throw new StrategyValidationError(
			'Linked strategy record is no longer available in this strategy cycle.'
		);
	}
	return id;
}

async function listEvidence(frameworkId: string): Promise<StrategyEvidenceItem[]> {
	const [rows] = await getPool().execute<EvidenceRow[]>(
		`SELECT evidence.public_id AS publicId,
		        evidence.evidence_type AS evidenceType,
		        evidence.title,
		        evidence.source_reference AS sourceReference,
		        evidence.source_uri AS sourceUri,
		        evidence.publisher_name AS publisherName,
		        evidence.published_on AS publishedOn,
		        evidence.observed_on AS observedOn,
		        evidence.summary_text AS summaryText,
		        evidence.reliability_score AS reliabilityScore,
		        (SELECT COUNT(*) FROM strategy_environment_factor_evidence_links link
		          WHERE link.strategy_evidence_item_id = evidence.id) AS factorCount
		 FROM strategy_evidence_items evidence
		 WHERE evidence.strategy_framework_id = ?
		   AND evidence.lifecycle_status = 'active'
		 ORDER BY evidence.observed_on DESC, evidence.created_at DESC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		evidenceType: row.evidenceType,
		title: row.title,
		sourceReference: row.sourceReference,
		sourceUri: row.sourceUri,
		publisherName: row.publisherName,
		publishedOn: dateValue(row.publishedOn),
		observedOn: dateValue(row.observedOn),
		summaryText: row.summaryText,
		reliabilityScore: numeric(row.reliabilityScore),
		factorCount: Number(row.factorCount)
	}));
}

async function listFactors(frameworkId: string): Promise<StrategyEnvironmentFactor[]> {
	const [rows] = await getPool().execute<FactorRow[]>(
		`SELECT factor.public_id AS publicId,
		        factor.context_scope AS contextScope,
		        factor.dimension,
		        factor.direction,
		        factor.title,
		        factor.analysis_text AS analysisText,
		        factor.implication_text AS implicationText,
		        factor.observed_on AS observedOn,
		        factor.likelihood_score AS likelihoodScore,
		        factor.impact_score AS impactScore,
		        factor.confidence_score AS confidenceScore,
		        (SELECT COUNT(*) FROM strategy_environment_factor_evidence_links evidence_link
		          WHERE evidence_link.strategy_environment_factor_id = factor.id) AS evidenceCount,
		        (SELECT COUNT(*) FROM strategy_option_factor_links option_link
		          WHERE option_link.strategy_environment_factor_id = factor.id) AS optionCount
		 FROM strategy_environment_factors factor
		 WHERE factor.strategy_framework_id = ?
		   AND factor.lifecycle_status = 'active'
		 ORDER BY factor.impact_score DESC, factor.likelihood_score DESC, factor.created_at DESC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		contextScope: row.contextScope,
		dimension: row.dimension,
		direction: row.direction,
		title: row.title,
		analysisText: row.analysisText,
		implicationText: row.implicationText,
		observedOn: dateValue(row.observedOn),
		likelihoodScore: numeric(row.likelihoodScore),
		impactScore: numeric(row.impactScore),
		confidenceScore: numeric(row.confidenceScore),
		evidenceCount: Number(row.evidenceCount),
		optionCount: Number(row.optionCount)
	}));
}

async function listAssumptions(frameworkId: string): Promise<StrategyAssumption[]> {
	const [rows] = await getPool().execute<AssumptionRow[]>(
		`SELECT assumption.public_id AS publicId,
		        assumption.statement_text AS statementText,
		        assumption.rationale_text AS rationaleText,
		        assumption.confidence_score AS confidenceScore,
		        assumption.review_by AS reviewBy,
		        assumption.validation_status AS validationStatus,
		        (SELECT COUNT(*) FROM strategy_option_assumption_links option_link
		          WHERE option_link.strategy_assumption_id = assumption.id) AS optionCount
		 FROM strategy_assumptions assumption
		 WHERE assumption.strategy_framework_id = ?
		   AND assumption.validation_status <> 'retired'
		 ORDER BY assumption.review_by ASC, assumption.created_at DESC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		statementText: row.statementText,
		rationaleText: row.rationaleText,
		confidenceScore: numeric(row.confidenceScore),
		reviewBy: dateValue(row.reviewBy),
		validationStatus: row.validationStatus,
		optionCount: Number(row.optionCount)
	}));
}

async function listOptions(frameworkId: string): Promise<StrategyOption[]> {
	const [rows] = await getPool().execute<OptionRow[]>(
		`SELECT option_record.public_id AS publicId,
		        option_record.title,
		        option_record.description,
		        option_record.evaluation_summary AS evaluationSummary,
		        option_record.decision_status AS decisionStatus,
		        option_record.decision_rationale AS decisionRationale,
		        option_record.priority_rank AS priorityRank,
		        (SELECT COUNT(*) FROM strategy_option_factor_links factor_link
		          WHERE factor_link.strategy_option_id = option_record.id) AS factorCount,
		        (SELECT COUNT(*) FROM strategy_option_assumption_links assumption_link
		          WHERE assumption_link.strategy_option_id = option_record.id) AS assumptionCount,
		        (SELECT COUNT(*) FROM strategy_objective_option_links objective_link
		          WHERE objective_link.strategy_option_id = option_record.id) AS objectiveCount
		 FROM strategy_options option_record
		 WHERE option_record.strategy_framework_id = ?
		 ORDER BY
		   CASE option_record.decision_status WHEN 'selected' THEN 0 WHEN 'proposed' THEN 1 ELSE 2 END,
		   option_record.priority_rank ASC,
		   option_record.created_at ASC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		title: row.title,
		description: row.description,
		evaluationSummary: row.evaluationSummary,
		decisionStatus: row.decisionStatus,
		decisionRationale: row.decisionRationale,
		priorityRank: numeric(row.priorityRank),
		factorCount: Number(row.factorCount),
		assumptionCount: Number(row.assumptionCount),
		objectiveCount: Number(row.objectiveCount)
	}));
}

async function listThemes(frameworkId: string): Promise<StrategyTheme[]> {
	const [rows] = await getPool().execute<ThemeRow[]>(
		`SELECT theme.public_id AS publicId,
		        theme.theme_code AS code,
		        theme.title,
		        theme.description,
		        theme.priority_rank AS priorityRank,
		        (SELECT COUNT(*) FROM strategy_objective_theme_links objective_link
		          WHERE objective_link.strategy_theme_id = theme.id) AS objectiveCount
		 FROM strategy_themes theme
		 WHERE theme.strategy_framework_id = ?
		   AND theme.lifecycle_status = 'active'
		 ORDER BY theme.priority_rank ASC, theme.theme_code ASC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		title: row.title,
		description: row.description,
		priorityRank: Number(row.priorityRank),
		objectiveCount: Number(row.objectiveCount)
	}));
}

async function listObjectives(frameworkId: string): Promise<StrategyObjective[]> {
	const [rows] = await getPool().execute<ObjectiveRow[]>(
		`SELECT objective.public_id AS publicId,
		        objective.objective_code AS code,
		        objective.title,
		        objective.description,
		        objective.priority_rank AS priorityRank,
		        objective.target_date AS targetDate,
		        objective.lifecycle_status AS lifecycleStatus,
		        parent.public_id AS parentPublicId,
		        parent.objective_code AS parentCode,
		        (SELECT COUNT(*) FROM strategy_objective_option_links option_link
		          WHERE option_link.strategy_objective_id = objective.id) AS optionCount,
		        (SELECT COUNT(*) FROM strategy_objective_theme_links theme_link
		          WHERE theme_link.strategy_objective_id = objective.id) AS themeCount
		 FROM strategy_objectives objective
		 LEFT JOIN strategy_objectives parent ON parent.id = objective.parent_strategy_objective_id
		 WHERE objective.strategy_framework_id = ?
		   AND objective.lifecycle_status <> 'retired'
		 ORDER BY objective.priority_rank ASC, objective.objective_code ASC`,
		[frameworkId]
	);
	return rows.map((row) => ({
		publicId: row.publicId,
		code: row.code,
		title: row.title,
		description: row.description,
		priorityRank: Number(row.priorityRank),
		targetDate: dateValue(row.targetDate),
		lifecycleStatus: row.lifecycleStatus,
		parentPublicId: row.parentPublicId,
		parentCode: row.parentCode,
		optionCount: Number(row.optionCount),
		themeCount: Number(row.themeCount)
	}));
}

async function nextCode(
	connection: PoolConnection,
	frameworkId: string,
	table: 'strategy_themes' | 'strategy_objectives',
	column: 'theme_code' | 'objective_code',
	prefix: 'THEME' | 'OBJ'
): Promise<string> {
	const [rows] = await connection.execute<(RowDataPacket & { code: string })[]>(
		`SELECT ${column} AS code FROM ${table}
		 WHERE strategy_framework_id = ?
		 ORDER BY id`,
		[frameworkId]
	);
	const used = new Set(rows.map((row) => row.code));
	let sequence = 1;
	while (used.has(`${prefix}-${String(sequence).padStart(2, '0')}`)) sequence += 1;
	return `${prefix}-${String(sequence).padStart(2, '0')}`;
}

export async function getStrategyAnalysisPlanningWorkspace(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<StrategyAnalysisPlanningWorkspace> {
	const { framework, permissions } = await requireWorkspace(input);
	const [contextRows] = await getPool().execute<FrameworkContextRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        lifecycle_status AS lifecycleStatus,
		        horizon_start AS horizonStart,
		        horizon_end AS horizonEnd
		 FROM strategy_frameworks
		 WHERE organisation_id = ? AND public_id = ?
		 LIMIT 1`,
		[input.organisationId, input.frameworkPublicId]
	);
	const context = contextRows[0];
	if (!context) throw new StrategyAccessError();
	const frameworkId = context.id.toString();
	const [evidence, factors, assumptions, options, themes, objectives] = await Promise.all([
		listEvidence(frameworkId),
		listFactors(frameworkId),
		listAssumptions(frameworkId),
		listOptions(frameworkId),
		listThemes(frameworkId),
		listObjectives(frameworkId)
	]);
	return { framework, permissions, evidence, factors, assumptions, options, themes, objectives };
}

export async function createStrategyEvidenceItem(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	evidenceType: EvidenceType;
	title: string;
	sourceReference?: string | null;
	sourceUri?: string | null;
	publisherName?: string | null;
	publishedOn?: string | null;
	observedOn?: string | null;
	summaryText: string;
	reliabilityScore: number | null;
}): Promise<{ publicId: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const allowedTypes: EvidenceType[] = [
		'internal_data',
		'external_report',
		'market_intelligence',
		'regulatory',
		'expert_judgement',
		'stakeholder',
		'other'
	];
	if (!allowedTypes.includes(input.evidenceType))
		throw new StrategyValidationError('Evidence type is invalid.');
	const title = requiredText(input.title, 'Evidence title', 255);
	const sourceReference = optionalText(input.sourceReference, 512);
	const sourceUri = optionalText(input.sourceUri, 2048);
	const publisherName = optionalText(input.publisherName, 255);
	if (!sourceReference && !sourceUri && !publisherName) {
		throw new StrategyValidationError('Identify the source using a reference, URI or publisher.');
	}
	const publishedOn = dateOnly(input.publishedOn, 'Published date');
	const observedOn = dateOnly(input.observedOn, 'Observed date', true);
	const summaryText = requiredText(input.summaryText, 'Evidence summary', 20_000);
	const reliabilityScore = score(input.reliabilityScore, 'Reliability', true);
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		await connection.execute(
			`INSERT INTO strategy_evidence_items
				(organisation_id, strategy_framework_id, public_id, evidence_type, title,
				 source_reference, source_uri, publisher_name, published_on, observed_on,
				 summary_text, reliability_score, lifecycle_status, owner_member_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				input.evidenceType,
				title,
				sourceReference,
				sourceUri,
				publisherName,
				publishedOn,
				observedOn,
				summaryText,
				reliabilityScore,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.evidence.create',
			subjectType: 'strategy_evidence_item',
			subjectPublicId: publicId,
			changeSummary: { evidenceType: input.evidenceType, reliabilityScore, observedOn },
			eventMetadata: { function: 'F01', subfunctions: ['F01.02'] }
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

export async function createStrategyEnvironmentFactor(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	contextScope: EnvironmentScope;
	dimension: EnvironmentDimension;
	direction: EnvironmentDirection;
	title: string;
	analysisText: string;
	implicationText: string;
	observedOn: string;
	likelihoodScore: number | null;
	impactScore: number | null;
	confidenceScore: number | null;
	evidencePublicIds: string[];
}): Promise<{ publicId: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (!['internal', 'external'].includes(input.contextScope))
		throw new StrategyValidationError('Context scope is invalid.');
	if (
		![
			'economic',
			'competitive',
			'market',
			'technology',
			'regulatory',
			'operational',
			'other'
		].includes(input.dimension)
	) {
		throw new StrategyValidationError('Environmental dimension is invalid.');
	}
	if (!['strength', 'weakness', 'opportunity', 'threat', 'neutral'].includes(input.direction)) {
		throw new StrategyValidationError('Environmental direction is invalid.');
	}
	const title = requiredText(input.title, 'Factor title', 255);
	const analysisText = requiredText(input.analysisText, 'Analysis', 20_000);
	const implicationText = requiredText(input.implicationText, 'Strategic implication', 20_000);
	const observedOn = dateOnly(input.observedOn, 'Observed date', true)!;
	const likelihoodScore = score(input.likelihoodScore, 'Likelihood', true);
	const impactScore = score(input.impactScore, 'Impact', true);
	const confidenceScore = score(input.confidenceScore, 'Confidence', true);
	const evidencePublicIds = uniquePublicIds(input.evidencePublicIds);
	if (evidencePublicIds.length === 0) {
		throw new StrategyValidationError(
			'Link at least one structured evidence item to the environmental factor.'
		);
	}
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const evidenceIds = await internalIdsByPublicId(connection, {
			table: 'strategy_evidence_items',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: evidencePublicIds
		});
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_environment_factors
				(organisation_id, strategy_framework_id, public_id, context_scope, dimension, direction,
				 title, analysis_text, implication_text, evidence_reference, observed_on,
				 likelihood_score, impact_score, confidence_score, lifecycle_status,
				 owner_member_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 'active', ?, ?)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				input.contextScope,
				input.dimension,
				input.direction,
				title,
				analysisText,
				implicationText,
				observedOn,
				likelihoodScore,
				impactScore,
				confidenceScore,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		for (const evidencePublicId of evidencePublicIds) {
			await connection.execute(
				`INSERT INTO strategy_environment_factor_evidence_links
					(organisation_id, strategy_environment_factor_id, strategy_evidence_item_id,
					 relationship_type, note_text, linked_by_member_id)
				 VALUES (?, ?, ?, 'supports', NULL, ?)`,
				[
					input.actor.organisationId,
					result.insertId,
					requireMappedId(evidenceIds, evidencePublicId),
					input.actor.memberId
				]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.environment-factor.create',
			subjectType: 'strategy_environment_factor',
			subjectPublicId: publicId,
			changeSummary: {
				contextScope: input.contextScope,
				dimension: input.dimension,
				direction: input.direction,
				likelihoodScore,
				impactScore,
				confidenceScore,
				evidenceCount: evidencePublicIds.length
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.02'] }
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

export async function createStrategyAssumption(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	statementText: string;
	rationaleText: string;
	confidenceScore: number | null;
	reviewBy: string;
}): Promise<{ publicId: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const statementText = requiredText(input.statementText, 'Assumption', 20_000);
	const rationaleText = requiredText(input.rationaleText, 'Assumption rationale', 20_000);
	const confidenceScore = score(input.confidenceScore, 'Confidence', true);
	const reviewBy = dateOnly(input.reviewBy, 'Review date', true)!;
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		await connection.execute(
			`INSERT INTO strategy_assumptions
				(organisation_id, strategy_framework_id, public_id, statement_text, rationale_text,
				 confidence_score, review_by, validation_status, owner_member_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'unvalidated', ?, ?)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				statementText,
				rationaleText,
				confidenceScore,
				reviewBy,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.assumption.create',
			subjectType: 'strategy_assumption',
			subjectPublicId: publicId,
			changeSummary: { confidenceScore, reviewBy, validationStatus: 'unvalidated' },
			eventMetadata: { function: 'F01', subfunctions: ['F01.02', 'F01.03'] }
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

export async function createStrategyOption(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	title: string;
	description: string;
	evaluationSummary: string;
	priorityRank: number | null;
	factorPublicIds: string[];
	assumptionPublicIds: string[];
}): Promise<{ publicId: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'Option title', 255);
	const description = requiredText(input.description, 'Option description', 20_000);
	const evaluationSummary = requiredText(input.evaluationSummary, 'Option evaluation', 20_000);
	const priorityRank = positiveInteger(input.priorityRank, 'Priority rank', true);
	const factorPublicIds = uniquePublicIds(input.factorPublicIds);
	const assumptionPublicIds = uniquePublicIds(input.assumptionPublicIds);
	if (factorPublicIds.length === 0 && assumptionPublicIds.length === 0) {
		throw new StrategyValidationError(
			'A strategic option must trace to at least one environmental factor or assumption.'
		);
	}
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const factorIds = await internalIdsByPublicId(connection, {
			table: 'strategy_environment_factors',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: factorPublicIds
		});
		const assumptionIds = await internalIdsByPublicId(connection, {
			table: 'strategy_assumptions',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: assumptionPublicIds
		});
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_options
				(organisation_id, strategy_framework_id, public_id, title, description,
				 evaluation_summary, decision_status, decision_rationale, priority_rank,
				 created_by_member_id, decided_by_member_id, decided_at)
			 VALUES (?, ?, ?, ?, ?, ?, 'proposed', NULL, ?, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				title,
				description,
				evaluationSummary,
				priorityRank,
				input.actor.memberId
			]
		);
		for (const factorPublicId of factorPublicIds) {
			await connection.execute(
				`INSERT INTO strategy_option_factor_links
					(organisation_id, strategy_option_id, strategy_environment_factor_id,
					 relationship_type, linked_by_member_id)
				 VALUES (?, ?, ?, 'responds_to', ?)`,
				[
					input.actor.organisationId,
					result.insertId,
					requireMappedId(factorIds, factorPublicId),
					input.actor.memberId
				]
			);
		}
		for (const assumptionPublicId of assumptionPublicIds) {
			await connection.execute(
				`INSERT INTO strategy_option_assumption_links
					(organisation_id, strategy_option_id, strategy_assumption_id,
					 relationship_type, linked_by_member_id)
				 VALUES (?, ?, ?, 'depends_on', ?)`,
				[
					input.actor.organisationId,
					result.insertId,
					requireMappedId(assumptionIds, assumptionPublicId),
					input.actor.memberId
				]
			);
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.option.create',
			subjectType: 'strategy_option',
			subjectPublicId: publicId,
			changeSummary: {
				decisionStatus: 'proposed',
				priorityRank,
				factorCount: factorPublicIds.length,
				assumptionCount: assumptionPublicIds.length
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.03'] }
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

export async function decideStrategyOption(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	optionPublicId: string;
	decisionStatus: Exclude<OptionDecisionStatus, 'proposed'>;
	decisionRationale: string;
}): Promise<void> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (!['selected', 'rejected'].includes(input.decisionStatus)) {
		throw new StrategyValidationError('Option decision is invalid.');
	}
	const decisionRationale = requiredText(input.decisionRationale, 'Decision rationale', 20_000);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const optionIds = await internalIdsByPublicId(connection, {
			table: 'strategy_options',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: [input.optionPublicId]
		});
		await connection.execute(
			`UPDATE strategy_options
			 SET decision_status = ?, decision_rationale = ?, decided_by_member_id = ?, decided_at = CURRENT_TIMESTAMP(6)
			 WHERE id = ?`,
			[
				input.decisionStatus,
				decisionRationale,
				input.actor.memberId,
				requireMappedId(optionIds, input.optionPublicId)
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.option.decide',
			subjectType: 'strategy_option',
			subjectPublicId: input.optionPublicId,
			changeSummary: { decisionStatus: input.decisionStatus, decisionRationale },
			eventMetadata: { function: 'F01', subfunctions: ['F01.03'] }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function createStrategyTheme(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	title: string;
	description: string;
	priorityRank: number | null;
}): Promise<{ publicId: string; code: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'Theme title', 255);
	const description = requiredText(input.description, 'Theme description', 20_000);
	const priorityRank = positiveInteger(input.priorityRank, 'Priority rank', true)!;
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const code = await nextCode(
			connection,
			framework.id.toString(),
			'strategy_themes',
			'theme_code',
			'THEME'
		);
		await connection.execute(
			`INSERT INTO strategy_themes
				(organisation_id, strategy_framework_id, public_id, theme_code, title, description,
				 priority_rank, lifecycle_status, owner_member_id, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				code,
				title,
				description,
				priorityRank,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.theme.create',
			subjectType: 'strategy_theme',
			subjectPublicId: publicId,
			changeSummary: { code, priorityRank },
			eventMetadata: { function: 'F01', subfunctions: ['F01.03'] }
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

export async function createStrategyObjective(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	title: string;
	description: string;
	priorityRank: number | null;
	targetDate: string;
	parentObjectivePublicId?: string | null;
	optionPublicIds: string[];
	themePublicId: string;
}): Promise<{ publicId: string; code: string }> {
	await requireManage({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const title = requiredText(input.title, 'Objective title', 255);
	const description = requiredText(input.description, 'Objective description', 20_000);
	const priorityRank = positiveInteger(input.priorityRank, 'Priority rank', true)!;
	const targetDate = dateOnly(input.targetDate, 'Target date', true)!;
	const optionPublicIds = uniquePublicIds(input.optionPublicIds);
	if (optionPublicIds.length === 0) {
		throw new StrategyValidationError(
			'An objective must trace to at least one selected strategic option.'
		);
	}
	const themePublicId = requiredText(input.themePublicId, 'Strategic theme', 36);
	const parentObjectivePublicId = optionalText(input.parentObjectivePublicId, 36);
	const publicId = randomUUID();
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		const horizonStart = dateValue(framework.horizonStart)!;
		const horizonEnd = dateValue(framework.horizonEnd)!;
		if (targetDate < horizonStart || targetDate > horizonEnd) {
			throw new StrategyValidationError(
				'Objective target date must fall within the strategy horizon.'
			);
		}
		const optionIds = await internalIdsByPublicId(connection, {
			table: 'strategy_options',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: optionPublicIds
		});
		const placeholders = optionPublicIds.map(() => '?').join(', ');
		const [selectedRows] = await connection.execute<(RowDataPacket & { publicId: string })[]>(
			`SELECT public_id AS publicId
			 FROM strategy_options
			 WHERE organisation_id = ?
			   AND strategy_framework_id = ?
			   AND public_id IN (${placeholders})
			   AND decision_status = 'selected'`,
			[input.actor.organisationId, framework.id, ...optionPublicIds]
		);
		if (selectedRows.length !== optionPublicIds.length) {
			throw new StrategyValidationError(
				'Objectives can only derive from selected strategic options.'
			);
		}
		const themeIds = await internalIdsByPublicId(connection, {
			table: 'strategy_themes',
			organisationId: input.actor.organisationId,
			frameworkId: framework.id.toString(),
			publicIds: [themePublicId]
		});
		let parentObjectiveId: string | null = null;
		if (parentObjectivePublicId) {
			if (parentObjectivePublicId === publicId)
				throw new StrategyValidationError('An objective cannot be its own parent.');
			const parentIds = await internalIdsByPublicId(connection, {
				table: 'strategy_objectives',
				organisationId: input.actor.organisationId,
				frameworkId: framework.id.toString(),
				publicIds: [parentObjectivePublicId]
			});
			parentObjectiveId = parentIds.get(parentObjectivePublicId) ?? null;
		}
		const code = await nextCode(
			connection,
			framework.id.toString(),
			'strategy_objectives',
			'objective_code',
			'OBJ'
		);
		const [result] = await connection.execute<ResultSetHeader>(
			`INSERT INTO strategy_objectives
				(organisation_id, strategy_framework_id, public_id, objective_code, title, description,
				 priority_rank, parent_strategy_objective_id, owner_member_id, target_date,
				 lifecycle_status, created_by_member_id)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
			[
				input.actor.organisationId,
				framework.id,
				publicId,
				code,
				title,
				description,
				priorityRank,
				parentObjectiveId,
				input.actor.memberId,
				targetDate,
				input.actor.memberId
			]
		);
		for (const optionPublicId of optionPublicIds) {
			await connection.execute(
				`INSERT INTO strategy_objective_option_links
					(organisation_id, strategy_objective_id, strategy_option_id,
					 relationship_type, linked_by_member_id)
				 VALUES (?, ?, ?, 'derived_from', ?)`,
				[
					input.actor.organisationId,
					result.insertId,
					requireMappedId(optionIds, optionPublicId),
					input.actor.memberId
				]
			);
		}
		await connection.execute(
			`INSERT INTO strategy_objective_theme_links
				(organisation_id, strategy_objective_id, strategy_theme_id,
				 relationship_type, linked_by_member_id)
			 VALUES (?, ?, ?, 'primary', ?)`,
			[
				input.actor.organisationId,
				result.insertId,
				requireMappedId(themeIds, themePublicId),
				input.actor.memberId
			]
		);
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.objective.create',
			subjectType: 'strategy_objective',
			subjectPublicId: publicId,
			changeSummary: {
				code,
				priorityRank,
				targetDate,
				optionCount: optionPublicIds.length,
				themePublicId,
				parentObjectivePublicId
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.03'] }
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
