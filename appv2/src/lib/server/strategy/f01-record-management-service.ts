import { randomUUID } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import {
	appendGovernedVersion,
	governedVersionCoordinates,
	listGovernedVersionHistory,
	markWorkingVersionDiscarded,
	type GovernedVersionHistoryItem
} from '$lib/server/platform/governed-versioning';
import { approveStrategyFramework } from './approval-service';
import { approveStrategyBusinessPlan } from './business-plan-approval-service';
import { decideStrategyOption, type OptionDecisionStatus } from './analysis-planning-service';
import { approveStrategyKpi, approveStrategyReview } from './execution-review-service';
import {
	getStrategyWorkspace,
	StrategyAccessError,
	StrategyValidationError,
	type StrategyFrameworkSummary,
	type StrategyPermissionFlags
} from './f01-service';
import type { F01LifecycleTransition, F01ManagedRecordKind } from './f01-lifecycle';
import {
	assertF01LifecycleTransition,
	canF01LifecycleOperation,
	decideF01LifecyclePermission,
	f01LifecycleTransitions
} from './f01-lifecycle-resolver';

export type F01ManagedField = {
	name: string;
	label: string;
	type: 'text' | 'textarea' | 'date' | 'number' | 'url' | 'select';
	value: string;
	required?: boolean;
	hint?: string;
	min?: string;
	max?: string;
	step?: string;
	options?: readonly { value: string; label: string }[];
};

export type F01ManagedRecord = {
	kind: F01ManagedRecordKind;
	publicId: string;
	code: string | null;
	title: string;
	status: string;
	versionLabel: string | null;
	versionStage: 'draft' | 'published' | 'historical' | null;
	versionHistory: GovernedVersionHistoryItem[];
	section: 'framework' | 'analysis' | 'planning' | 'business-planning' | 'performance' | 'review';
	fields: F01ManagedField[];
	canEdit: boolean;
	canDelete: boolean;
	canRevise: boolean;
	transitions: readonly F01LifecycleTransition[];
	framework: StrategyFrameworkSummary;
	permissions: StrategyPermissionFlags;
};

type StatusRow = RowDataPacket & { status: string };
type IdRow = RowDataPacket & { id: string | number };
type CountRow = RowDataPacket & { count: number | string };

const CURRENCY = /^[A-Z]{3}$/;
const FUNCTION_CODE = /^F\d{2}$/;

const evidenceTypes = [
	'internal_data',
	'external_report',
	'market_intelligence',
	'regulatory',
	'expert_judgement',
	'stakeholder',
	'other'
] as const;
const factorScopes = ['internal', 'external'] as const;
const factorDimensions = [
	'economic',
	'competitive',
	'market',
	'technology',
	'regulatory',
	'operational',
	'other'
] as const;
const factorDirections = ['strength', 'weakness', 'opportunity', 'threat', 'neutral'] as const;
const requirementTypes = [
	'funding',
	'workforce',
	'capacity',
	'technology',
	'asset',
	'supplier',
	'other'
] as const;
const handoffTypes = [
	'funding',
	'workforce',
	'delivery',
	'change',
	'risk',
	'procurement',
	'technology',
	'other'
] as const;
const kpiDirections = ['higher_is_better', 'lower_is_better', 'target_is_best', 'band'] as const;
const decisionTypes = [
	'continue',
	'accelerate',
	'rephase',
	'pause',
	'stop',
	'revise_strategy',
	'revise_plan',
	'corrective_action'
] as const;

function requiredText(value: string | undefined, label: string, maximum: number): string {
	const normalized = value?.trim() ?? '';
	if (!normalized || normalized.length > maximum) {
		throw new StrategyValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) {
		throw new StrategyValidationError(`Text must not exceed ${maximum} characters.`);
	}
	return normalized;
}

function dateOnly(value: string | undefined, label: string, required = false): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	const parsed = new Date(`${normalized}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	return normalized;
}

function positiveInteger(value: string | undefined, label: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new StrategyValidationError(`${label} must be a positive whole number.`);
	}
	return parsed;
}

function score(value: string | undefined, label: string): number | null {
	if (!value?.trim()) return null;
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
		throw new StrategyValidationError(`${label} must be a whole number from 1 to 5.`);
	}
	return parsed;
}

function decimal(value: string | undefined, label: string, required = false): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) {
		if (required) throw new StrategyValidationError(`${label} is required.`);
		return null;
	}
	if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
		throw new StrategyValidationError(`${label} must be a non-negative number.`);
	}
	return normalized;
}

function currency(value: string | undefined): string {
	const normalized = value?.trim().toUpperCase() ?? '';
	if (!CURRENCY.test(normalized)) {
		throw new StrategyValidationError('Currency must be a three-letter code such as GBP.');
	}
	return normalized;
}

function functionCode(value: string | undefined): string {
	const normalized = value?.trim().toUpperCase() ?? '';
	if (!FUNCTION_CODE.test(normalized)) {
		throw new StrategyValidationError('Target function must use an enterprise code such as F14.');
	}
	return normalized;
}

function selectOptions(values: readonly string[]): readonly { value: string; label: string }[] {
	return values.map((value) => ({
		value,
		label: value
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ')
	}));
}

function str(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value);
}

function sectionFor(kind: F01ManagedRecordKind): F01ManagedRecord['section'] {
	if (kind === 'framework') return 'framework';
	if (['evidence', 'factor', 'assumption'].includes(kind)) return 'analysis';
	if (['option', 'theme', 'objective'].includes(kind)) return 'planning';
	if (['plan', 'initiative', 'requirement', 'handoff'].includes(kind)) return 'business-planning';
	if (kind === 'kpi') return 'performance';
	return 'review';
}

async function frameworkContext(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<{ framework: StrategyFrameworkSummary; permissions: StrategyPermissionFlags }> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.organisationId,
		memberId: input.memberId
	});
	const framework = workspace.frameworks.find(
		(candidate) => candidate.publicId === input.frameworkPublicId
	);
	if (!framework)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	return { framework, permissions: workspace.permissions };
}

async function singleRow<T extends RowDataPacket>(
	query: string,
	params: Array<string | number | boolean | Date | null>
): Promise<T> {
	const [rows] = await getPool().execute<T[]>(query, params);
	const row = rows[0];
	if (!row) throw new StrategyValidationError('The requested F01 record is no longer available.');
	return row;
}

async function singleConnectionRow<T extends RowDataPacket>(
	connection: PoolConnection,
	query: string,
	params: Array<string | number | boolean | Date | null>
): Promise<T> {
	const [rows] = await connection.execute<T[]>(query, params);
	const row = rows[0];
	if (!row) throw new StrategyValidationError('The requested F01 record is no longer available.');
	return row;
}

async function statusFor(input: {
	organisationId: string;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
}): Promise<string> {
	const queries: Record<F01ManagedRecordKind, string> = {
		framework: `SELECT lifecycle_status AS status FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? AND public_id = ? LIMIT 1`,
		evidence: `SELECT evidence.lifecycle_status AS status FROM strategy_evidence_items evidence JOIN strategy_frameworks framework ON framework.id = evidence.strategy_framework_id WHERE evidence.organisation_id = ? AND framework.public_id = ? AND evidence.public_id = ? LIMIT 1`,
		factor: `SELECT factor.lifecycle_status AS status FROM strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.public_id = ? LIMIT 1`,
		assumption: `SELECT assumption.validation_status AS status FROM strategy_assumptions assumption JOIN strategy_frameworks framework ON framework.id = assumption.strategy_framework_id WHERE assumption.organisation_id = ? AND framework.public_id = ? AND assumption.public_id = ? LIMIT 1`,
		option: `SELECT option_record.decision_status AS status FROM strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.public_id = ? LIMIT 1`,
		theme: `SELECT theme.lifecycle_status AS status FROM strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.public_id = ? LIMIT 1`,
		objective: `SELECT objective.lifecycle_status AS status FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id = ? LIMIT 1`,
		plan: `SELECT plan.lifecycle_status AS status FROM strategy_business_plans plan JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE plan.organisation_id = ? AND framework.public_id = ? AND plan.public_id = ? LIMIT 1`,
		initiative: `SELECT initiative.lifecycle_status AS status FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE initiative.organisation_id = ? AND framework.public_id = ? AND initiative.public_id = ? LIMIT 1`,
		requirement: `SELECT requirement.lifecycle_status AS status FROM strategy_initiative_resource_requirements requirement JOIN strategy_initiatives initiative ON initiative.id = requirement.strategy_initiative_id JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE requirement.organisation_id = ? AND framework.public_id = ? AND requirement.public_id = ? LIMIT 1`,
		handoff: `SELECT handoff.lifecycle_status AS status FROM strategy_initiative_handoffs handoff JOIN strategy_initiatives initiative ON initiative.id = handoff.strategy_initiative_id JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE handoff.organisation_id = ? AND framework.public_id = ? AND handoff.public_id = ? LIMIT 1`,
		kpi: `SELECT kpi.lifecycle_status AS status FROM strategy_kpis kpi JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND framework.public_id = ? AND kpi.public_id = ? LIMIT 1`,
		review: `SELECT review.lifecycle_status AS status FROM strategy_reviews review JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE review.organisation_id = ? AND framework.public_id = ? AND review.public_id = ? LIMIT 1`,
		decision: `SELECT decision_record.lifecycle_status AS status FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? LIMIT 1`
	};
	const row = await singleRow<StatusRow>(queries[input.kind], [
		input.organisationId,
		input.frameworkPublicId,
		input.recordPublicId
	]);
	return row.status;
}

async function permissionFilteredTransitions(
	organisationId: string,
	memberId: string,
	kind: F01ManagedRecordKind,
	status: string
): Promise<readonly F01LifecycleTransition[]> {
	const transitions = await f01LifecycleTransitions(organisationId, kind, status);
	const decisions = await Promise.all(
		transitions.map(async (transition) => {
			const requiredPermissionKey =
				transition.requiredPermissionKey ??
				(transition.to === 'approved' ||
				(kind === 'option' && ['selected', 'rejected'].includes(transition.to))
					? 'strategy.approve'
					: 'strategy.manage');
			const decision = await decideF01LifecyclePermission({
				organisationId,
				memberId,
				kind,
				state: status,
				permissionKey: requiredPermissionKey
			});
			return decision.allowed ? transition : null;
		})
	);
	return decisions.filter(
		(transition): transition is F01LifecycleTransition => transition !== null
	);
}

export async function getF01ManagedRecord(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
}): Promise<F01ManagedRecord> {
	const { framework, permissions } = await frameworkContext(input);
	const organisationId = input.organisationId;
	const frameworkPublicId = input.frameworkPublicId;
	const publicId = input.recordPublicId;
	let code: string | null = null;
	let title = '';
	let status = '';
	let versionNumber: number | null = null;
	let minorVersionNumber: number | null = null;
	let fields: F01ManagedField[] = [];

	switch (input.kind) {
		case 'framework': {
			const row = await singleRow<
				RowDataPacket & {
					publicId: string;
					code: string;
					versionNumber: number | string;
					minorVersionNumber: number | string;
					title: string;
					horizonStart: Date | string;
					horizonEnd: Date | string;
					purpose: string;
					vision: string;
					mission: string;
					status: string;
				}
			>(
				`SELECT public_id AS publicId, framework_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, title, horizon_start AS horizonStart, horizon_end AS horizonEnd, purpose_text AS purpose, vision_text AS vision, mission_text AS mission, lifecycle_status AS status FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? AND public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			versionNumber = Number(row.versionNumber);
			minorVersionNumber = Number(row.minorVersionNumber);
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'Strategy title', type: 'text', value: row.title, required: true },
				{
					name: 'horizonStart',
					label: 'Horizon start',
					type: 'date',
					value: str(row.horizonStart),
					required: true
				},
				{
					name: 'horizonEnd',
					label: 'Horizon end',
					type: 'date',
					value: str(row.horizonEnd),
					required: true
				},
				{ name: 'purpose', label: 'Purpose', type: 'textarea', value: row.purpose, required: true },
				{ name: 'vision', label: 'Vision', type: 'textarea', value: row.vision, required: true },
				{ name: 'mission', label: 'Mission', type: 'textarea', value: row.mission }
			];
			break;
		}
		case 'evidence': {
			const row = await singleRow<
				RowDataPacket & {
					evidenceType: string;
					title: string;
					sourceReference: string | null;
					sourceUri: string | null;
					publisherName: string | null;
					publishedOn: Date | string | null;
					observedOn: Date | string | null;
					summaryText: string;
					reliabilityScore: number | string | null;
					status: string;
				}
			>(
				`SELECT evidence.evidence_type AS evidenceType, evidence.title, evidence.source_reference AS sourceReference, evidence.source_uri AS sourceUri, evidence.publisher_name AS publisherName, evidence.published_on AS publishedOn, evidence.observed_on AS observedOn, evidence.summary_text AS summaryText, evidence.reliability_score AS reliabilityScore, evidence.lifecycle_status AS status FROM strategy_evidence_items evidence JOIN strategy_frameworks framework ON framework.id = evidence.strategy_framework_id WHERE evidence.organisation_id = ? AND framework.public_id = ? AND evidence.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = row.title;
			status = row.status;
			fields = [
				{
					name: 'evidenceType',
					label: 'Evidence type',
					type: 'select',
					value: row.evidenceType,
					required: true,
					options: selectOptions(evidenceTypes)
				},
				{ name: 'title', label: 'Evidence title', type: 'text', value: row.title, required: true },
				{
					name: 'publisherName',
					label: 'Publisher / source owner',
					type: 'text',
					value: str(row.publisherName)
				},
				{
					name: 'sourceReference',
					label: 'Source reference',
					type: 'text',
					value: str(row.sourceReference)
				},
				{ name: 'sourceUri', label: 'Source URI', type: 'url', value: str(row.sourceUri) },
				{ name: 'publishedOn', label: 'Published date', type: 'date', value: str(row.publishedOn) },
				{
					name: 'observedOn',
					label: 'Observed date',
					type: 'date',
					value: str(row.observedOn),
					required: true
				},
				{
					name: 'summaryText',
					label: 'Evidence summary',
					type: 'textarea',
					value: row.summaryText,
					required: true
				},
				{
					name: 'reliabilityScore',
					label: 'Reliability (1–5)',
					type: 'number',
					value: str(row.reliabilityScore),
					min: '1',
					max: '5',
					step: '1'
				}
			];
			break;
		}
		case 'factor': {
			const row = await singleRow<
				RowDataPacket & {
					contextScope: string;
					dimension: string;
					direction: string;
					title: string;
					observedOn: Date | string | null;
					analysisText: string;
					implicationText: string | null;
					likelihoodScore: number | string | null;
					impactScore: number | string | null;
					confidenceScore: number | string | null;
					status: string;
				}
			>(
				`SELECT factor.context_scope AS contextScope, factor.dimension, factor.direction, factor.title, factor.observed_on AS observedOn, factor.analysis_text AS analysisText, factor.implication_text AS implicationText, factor.likelihood_score AS likelihoodScore, factor.impact_score AS impactScore, factor.confidence_score AS confidenceScore, factor.lifecycle_status AS status FROM strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = row.title;
			status = row.status;
			fields = [
				{
					name: 'contextScope',
					label: 'Scope',
					type: 'select',
					value: row.contextScope,
					required: true,
					options: selectOptions(factorScopes)
				},
				{
					name: 'dimension',
					label: 'Dimension',
					type: 'select',
					value: row.dimension,
					required: true,
					options: selectOptions(factorDimensions)
				},
				{
					name: 'direction',
					label: 'Direction',
					type: 'select',
					value: row.direction,
					required: true,
					options: selectOptions(factorDirections)
				},
				{ name: 'title', label: 'Factor title', type: 'text', value: row.title, required: true },
				{
					name: 'observedOn',
					label: 'Observed date',
					type: 'date',
					value: str(row.observedOn),
					required: true
				},
				{
					name: 'analysisText',
					label: 'Analysis',
					type: 'textarea',
					value: row.analysisText,
					required: true
				},
				{
					name: 'implicationText',
					label: 'Strategic implication',
					type: 'textarea',
					value: str(row.implicationText),
					required: true
				},
				{
					name: 'likelihoodScore',
					label: 'Likelihood (1–5)',
					type: 'number',
					value: str(row.likelihoodScore),
					min: '1',
					max: '5',
					step: '1',
					required: true
				},
				{
					name: 'impactScore',
					label: 'Impact (1–5)',
					type: 'number',
					value: str(row.impactScore),
					min: '1',
					max: '5',
					step: '1',
					required: true
				},
				{
					name: 'confidenceScore',
					label: 'Confidence (1–5)',
					type: 'number',
					value: str(row.confidenceScore),
					min: '1',
					max: '5',
					step: '1',
					required: true
				}
			];
			break;
		}
		case 'assumption': {
			const row = await singleRow<
				RowDataPacket & {
					statementText: string;
					rationaleText: string | null;
					confidenceScore: number | string | null;
					reviewBy: Date | string | null;
					status: string;
				}
			>(
				`SELECT assumption.statement_text AS statementText, assumption.rationale_text AS rationaleText, assumption.confidence_score AS confidenceScore, assumption.review_by AS reviewBy, assumption.validation_status AS status FROM strategy_assumptions assumption JOIN strategy_frameworks framework ON framework.id = assumption.strategy_framework_id WHERE assumption.organisation_id = ? AND framework.public_id = ? AND assumption.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = row.statementText.slice(0, 120);
			status = row.status;
			fields = [
				{
					name: 'statementText',
					label: 'Assumption',
					type: 'textarea',
					value: row.statementText,
					required: true
				},
				{
					name: 'rationaleText',
					label: 'Rationale',
					type: 'textarea',
					value: str(row.rationaleText),
					required: true
				},
				{
					name: 'confidenceScore',
					label: 'Confidence (1–5)',
					type: 'number',
					value: str(row.confidenceScore),
					min: '1',
					max: '5',
					step: '1',
					required: true
				},
				{
					name: 'reviewBy',
					label: 'Review by',
					type: 'date',
					value: str(row.reviewBy),
					required: true
				}
			];
			break;
		}
		case 'option': {
			const row = await singleRow<
				RowDataPacket & {
					title: string;
					description: string;
					evaluationSummary: string | null;
					priorityRank: number | string | null;
					status: string;
				}
			>(
				`SELECT option_record.title, option_record.description, option_record.evaluation_summary AS evaluationSummary, option_record.priority_rank AS priorityRank, option_record.decision_status AS status FROM strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'Option title', type: 'text', value: row.title, required: true },
				{
					name: 'description',
					label: 'Description',
					type: 'textarea',
					value: row.description,
					required: true
				},
				{
					name: 'evaluationSummary',
					label: 'Evaluation summary',
					type: 'textarea',
					value: str(row.evaluationSummary),
					required: true
				},
				{
					name: 'priorityRank',
					label: 'Priority rank',
					type: 'number',
					value: str(row.priorityRank),
					min: '1',
					step: '1',
					required: true
				}
			];
			break;
		}
		case 'theme': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					title: string;
					description: string;
					priorityRank: number | string;
					status: string;
				}
			>(
				`SELECT theme.theme_code AS code, theme.title, theme.description, theme.priority_rank AS priorityRank, theme.lifecycle_status AS status FROM strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'Theme title', type: 'text', value: row.title, required: true },
				{
					name: 'description',
					label: 'Description',
					type: 'textarea',
					value: row.description,
					required: true
				},
				{
					name: 'priorityRank',
					label: 'Priority rank',
					type: 'number',
					value: str(row.priorityRank),
					min: '1',
					step: '1',
					required: true
				}
			];
			break;
		}
		case 'objective': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					title: string;
					description: string;
					priorityRank: number | string;
					targetDate: Date | string | null;
					status: string;
				}
			>(
				`SELECT objective.objective_code AS code, objective.title, objective.description, objective.priority_rank AS priorityRank, objective.target_date AS targetDate, objective.lifecycle_status AS status FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'Objective title', type: 'text', value: row.title, required: true },
				{
					name: 'description',
					label: 'Description',
					type: 'textarea',
					value: row.description,
					required: true
				},
				{
					name: 'priorityRank',
					label: 'Priority rank',
					type: 'number',
					value: str(row.priorityRank),
					min: '1',
					step: '1',
					required: true
				},
				{
					name: 'targetDate',
					label: 'Target date',
					type: 'date',
					value: str(row.targetDate),
					min: framework.horizonStart,
					max: framework.horizonEnd,
					required: true
				}
			];
			break;
		}
		case 'plan': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					versionNumber: number | string;
					minorVersionNumber: number | string;
					title: string;
					periodStart: Date | string;
					periodEnd: Date | string;
					narrative: string;
					currencyCode: string;
					plannedRevenueAmount: string | number;
					plannedOpexAmount: string | number;
					plannedCapexAmount: string | number;
					status: string;
				}
			>(
				`SELECT plan.plan_code AS code, plan.version_number AS versionNumber, plan.minor_version_number AS minorVersionNumber, plan.title, plan.period_start AS periodStart, plan.period_end AS periodEnd, plan.narrative, plan.currency_code AS currencyCode, plan.planned_revenue_amount AS plannedRevenueAmount, plan.planned_opex_amount AS plannedOpexAmount, plan.planned_capex_amount AS plannedCapexAmount, plan.lifecycle_status AS status FROM strategy_business_plans plan JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE plan.organisation_id = ? AND framework.public_id = ? AND plan.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			versionNumber = Number(row.versionNumber);
			minorVersionNumber = Number(row.minorVersionNumber);
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'Plan title', type: 'text', value: row.title, required: true },
				{
					name: 'periodStart',
					label: 'Period start',
					type: 'date',
					value: str(row.periodStart),
					min: framework.horizonStart,
					max: framework.horizonEnd,
					required: true
				},
				{
					name: 'periodEnd',
					label: 'Period end',
					type: 'date',
					value: str(row.periodEnd),
					min: framework.horizonStart,
					max: framework.horizonEnd,
					required: true
				},
				{
					name: 'narrative',
					label: 'Planning narrative',
					type: 'textarea',
					value: row.narrative,
					required: true
				},
				{
					name: 'currencyCode',
					label: 'Currency',
					type: 'text',
					value: row.currencyCode,
					required: true
				},
				{
					name: 'plannedRevenueAmount',
					label: 'Planned revenue',
					type: 'number',
					value: str(row.plannedRevenueAmount),
					min: '0',
					step: '0.01'
				},
				{
					name: 'plannedOpexAmount',
					label: 'Planned opex',
					type: 'number',
					value: str(row.plannedOpexAmount),
					min: '0',
					step: '0.01'
				},
				{
					name: 'plannedCapexAmount',
					label: 'Planned capex',
					type: 'number',
					value: str(row.plannedCapexAmount),
					min: '0',
					step: '0.01'
				}
			];
			break;
		}
		case 'initiative': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					title: string;
					outcomeText: string;
					benefitStatement: string | null;
					priorityRank: number | string;
					startDate: Date | string;
					endDate: Date | string;
					plannedInvestmentAmount: string | number;
					plannedFte: string | number;
					currencyCode: string;
					planStart: Date | string;
					planEnd: Date | string;
					status: string;
				}
			>(
				`SELECT initiative.initiative_code AS code, initiative.title, initiative.outcome_text AS outcomeText, initiative.benefit_statement AS benefitStatement, initiative.priority_rank AS priorityRank, initiative.start_date AS startDate, initiative.end_date AS endDate, initiative.planned_investment_amount AS plannedInvestmentAmount, initiative.planned_fte AS plannedFte, initiative.currency_code AS currencyCode, initiative.lifecycle_status AS status, plan.period_start AS planStart, plan.period_end AS planEnd FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE initiative.organisation_id = ? AND framework.public_id = ? AND initiative.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			title = row.title;
			status = row.status;
			fields = [
				{
					name: 'title',
					label: 'Initiative title',
					type: 'text',
					value: row.title,
					required: true
				},
				{
					name: 'outcomeText',
					label: 'Intended outcome',
					type: 'textarea',
					value: row.outcomeText,
					required: true
				},
				{
					name: 'benefitStatement',
					label: 'Benefit statement',
					type: 'textarea',
					value: str(row.benefitStatement)
				},
				{
					name: 'priorityRank',
					label: 'Priority rank',
					type: 'number',
					value: str(row.priorityRank),
					min: '1',
					step: '1',
					required: true
				},
				{
					name: 'startDate',
					label: 'Start date',
					type: 'date',
					value: str(row.startDate),
					min: str(row.planStart),
					max: str(row.planEnd),
					required: true
				},
				{
					name: 'endDate',
					label: 'End date',
					type: 'date',
					value: str(row.endDate),
					min: str(row.planStart),
					max: str(row.planEnd),
					required: true
				},
				{
					name: 'plannedInvestmentAmount',
					label: 'Planned investment',
					type: 'number',
					value: str(row.plannedInvestmentAmount),
					min: '0',
					step: '0.01'
				},
				{
					name: 'plannedFte',
					label: 'Planned FTE',
					type: 'number',
					value: str(row.plannedFte),
					min: '0',
					step: '0.01'
				},
				{
					name: 'currencyCode',
					label: 'Currency',
					type: 'text',
					value: row.currencyCode,
					required: true
				}
			];
			break;
		}
		case 'requirement': {
			const row = await singleRow<
				RowDataPacket & {
					requirementType: string;
					title: string;
					description: string;
					amount: string | number | null;
					currencyCode: string | null;
					quantity: string | number | null;
					unitLabel: string | null;
					targetFunctionCode: string;
					needBy: Date | string | null;
					initiativeStart: Date | string;
					initiativeEnd: Date | string;
					status: string;
				}
			>(
				`SELECT requirement.requirement_type AS requirementType, requirement.title, requirement.description, requirement.amount, requirement.currency_code AS currencyCode, requirement.quantity, requirement.unit_label AS unitLabel, requirement.target_function_code AS targetFunctionCode, requirement.need_by AS needBy, requirement.lifecycle_status AS status, initiative.start_date AS initiativeStart, initiative.end_date AS initiativeEnd FROM strategy_initiative_resource_requirements requirement JOIN strategy_initiatives initiative ON initiative.id = requirement.strategy_initiative_id JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE requirement.organisation_id = ? AND framework.public_id = ? AND requirement.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = row.title;
			status = row.status;
			fields = [
				{
					name: 'requirementType',
					label: 'Requirement type',
					type: 'select',
					value: row.requirementType,
					required: true,
					options: selectOptions(requirementTypes)
				},
				{
					name: 'title',
					label: 'Requirement title',
					type: 'text',
					value: row.title,
					required: true
				},
				{
					name: 'description',
					label: 'Description',
					type: 'textarea',
					value: row.description,
					required: true
				},
				{
					name: 'amount',
					label: 'Amount',
					type: 'number',
					value: str(row.amount),
					min: '0',
					step: '0.01'
				},
				{ name: 'currencyCode', label: 'Currency', type: 'text', value: str(row.currencyCode) },
				{
					name: 'quantity',
					label: 'Quantity',
					type: 'number',
					value: str(row.quantity),
					min: '0',
					step: '0.01'
				},
				{ name: 'unitLabel', label: 'Unit', type: 'text', value: str(row.unitLabel) },
				{
					name: 'targetFunctionCode',
					label: 'Target function',
					type: 'text',
					value: row.targetFunctionCode,
					required: true
				},
				{
					name: 'needBy',
					label: 'Need by',
					type: 'date',
					value: str(row.needBy),
					min: str(row.initiativeStart),
					max: str(row.initiativeEnd)
				}
			];
			break;
		}
		case 'handoff': {
			const row = await singleRow<
				RowDataPacket & {
					handoffType: string;
					targetFunctionCode: string;
					requestSummary: string;
					status: string;
				}
			>(
				`SELECT handoff.handoff_type AS handoffType, handoff.target_function_code AS targetFunctionCode, handoff.request_summary AS requestSummary, handoff.lifecycle_status AS status FROM strategy_initiative_handoffs handoff JOIN strategy_initiatives initiative ON initiative.id = handoff.strategy_initiative_id JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE handoff.organisation_id = ? AND framework.public_id = ? AND handoff.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			title = `${row.handoffType} → ${row.targetFunctionCode}`;
			status = row.status;
			fields = [
				{
					name: 'handoffType',
					label: 'Handoff type',
					type: 'select',
					value: row.handoffType,
					required: true,
					options: selectOptions(handoffTypes)
				},
				{
					name: 'targetFunctionCode',
					label: 'Target function',
					type: 'text',
					value: row.targetFunctionCode,
					required: true
				},
				{
					name: 'requestSummary',
					label: 'Request summary',
					type: 'textarea',
					value: row.requestSummary,
					required: true
				}
			];
			break;
		}
		case 'kpi': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					versionNumber: number | string;
					minorVersionNumber: number | string;
					title: string;
					description: string;
					unitLabel: string;
					direction: string;
					baselineValue: string | number;
					targetValue: string | number;
					targetDate: Date | string | null;
					status: string;
				}
			>(
				`SELECT kpi.kpi_code AS code, kpi.version_number AS versionNumber, kpi.minor_version_number AS minorVersionNumber, kpi.title, kpi.description, kpi.unit_label AS unitLabel, kpi.direction, kpi.baseline_value AS baselineValue, kpi.target_value AS targetValue, kpi.target_date AS targetDate, kpi.lifecycle_status AS status FROM strategy_kpis kpi JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND framework.public_id = ? AND kpi.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			versionNumber = Number(row.versionNumber);
			minorVersionNumber = Number(row.minorVersionNumber);
			title = row.title;
			status = row.status;
			fields = [
				{ name: 'title', label: 'KPI title', type: 'text', value: row.title, required: true },
				{
					name: 'description',
					label: 'Definition',
					type: 'textarea',
					value: row.description,
					required: true
				},
				{ name: 'unitLabel', label: 'Unit', type: 'text', value: row.unitLabel, required: true },
				{
					name: 'direction',
					label: 'Direction',
					type: 'select',
					value: row.direction,
					required: true,
					options: selectOptions(kpiDirections)
				},
				{
					name: 'baselineValue',
					label: 'Baseline',
					type: 'number',
					value: str(row.baselineValue),
					step: 'any',
					required: true
				},
				{
					name: 'targetValue',
					label: 'Target',
					type: 'number',
					value: str(row.targetValue),
					step: 'any',
					required: true
				},
				{
					name: 'targetDate',
					label: 'Target date',
					type: 'date',
					value: str(row.targetDate),
					min: framework.horizonStart,
					max: framework.horizonEnd
				}
			];
			break;
		}
		case 'review': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					reviewDate: Date | string;
					title: string;
					summary: string;
					status: string;
				}
			>(
				`SELECT review.review_code AS code, review.review_date AS reviewDate, review.title, review.summary, review.lifecycle_status AS status FROM strategy_reviews review JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE review.organisation_id = ? AND framework.public_id = ? AND review.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			title = row.title;
			status = row.status;
			fields = [
				{
					name: 'reviewDate',
					label: 'Review date',
					type: 'date',
					value: str(row.reviewDate),
					min: framework.horizonStart,
					max: framework.horizonEnd,
					required: true
				},
				{ name: 'title', label: 'Review title', type: 'text', value: row.title, required: true },
				{
					name: 'summary',
					label: 'Management assessment',
					type: 'textarea',
					value: row.summary,
					required: true
				}
			];
			break;
		}
		case 'decision': {
			const row = await singleRow<
				RowDataPacket & {
					code: string;
					decisionType: string;
					decisionText: string;
					rationale: string;
					dueDate: Date | string | null;
					status: string;
				}
			>(
				`SELECT decision_record.decision_code AS code, decision_record.decision_type AS decisionType, decision_record.decision_text AS decisionText, decision_record.rationale, decision_record.due_date AS dueDate, decision_record.lifecycle_status AS status FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? LIMIT 1`,
				[organisationId, frameworkPublicId, publicId]
			);
			code = row.code;
			title = row.decisionText.slice(0, 120);
			status = row.status;
			fields = [
				{
					name: 'decisionType',
					label: 'Decision type',
					type: 'select',
					value: row.decisionType,
					required: true,
					options: selectOptions(decisionTypes)
				},
				{
					name: 'decisionText',
					label: 'Decision',
					type: 'textarea',
					value: row.decisionText,
					required: true
				},
				{
					name: 'rationale',
					label: 'Rationale',
					type: 'textarea',
					value: row.rationale,
					required: true
				},
				{
					name: 'dueDate',
					label: 'Due date',
					type: 'date',
					value: str(row.dueDate),
					max: framework.horizonEnd
				}
			];
			break;
		}
	}

	let versionLabel: string | null = null;
	let versionStage: 'draft' | 'published' | 'historical' | null = null;
	let versionHistory: GovernedVersionHistoryItem[] = [];
	if (versionNumber !== null && minorVersionNumber !== null && code) {
		const version = governedVersionCoordinates({
			versionNumber,
			minorVersionNumber,
			lifecycleStatus: status
		});
		versionLabel = version.label;
		versionStage = version.status;
		const recordType =
			input.kind === 'framework'
				? 'strategy_framework'
				: input.kind === 'plan'
					? 'strategy_business_plan'
					: 'strategy_kpi';
		const historyConnection = await getPool().getConnection();
		try {
			versionHistory = await listGovernedVersionHistory(historyConnection, {
				organisationId,
				domainCode: 'F01',
				recordType,
				lineageKey: code
			});
		} finally {
			historyConnection.release();
		}
	}

	const strategyAllowsEditing = [
		'evidence',
		'factor',
		'assumption',
		'option',
		'theme',
		'objective'
	].includes(input.kind)
		? framework.lifecycleStatus === 'draft'
		: input.kind === 'framework'
			? true
			: framework.lifecycleStatus === 'approved';
	const manageAuthority = await decideF01LifecyclePermission({
		organisationId,
		memberId: input.memberId,
		kind: input.kind,
		state: status,
		permissionKey: 'strategy.manage'
	});
	const [policyCanEdit, policyCanDelete, policyCanRevise, permittedTransitions] = await Promise.all(
		[
			canF01LifecycleOperation(organisationId, input.kind, status, 'edit'),
			canF01LifecycleOperation(organisationId, input.kind, status, 'delete'),
			canF01LifecycleOperation(organisationId, input.kind, status, 'revise'),
			permissionFilteredTransitions(organisationId, input.memberId, input.kind, status)
		]
	);

	return {
		kind: input.kind,
		publicId,
		code,
		title,
		status,
		versionLabel,
		versionStage,
		versionHistory,
		section: sectionFor(input.kind),
		fields,
		canEdit: manageAuthority.allowed && strategyAllowsEditing && policyCanEdit,
		canDelete: manageAuthority.allowed && strategyAllowsEditing && policyCanDelete,
		canRevise: manageAuthority.allowed && policyCanRevise,
		transitions: permittedTransitions.filter(() => {
			if (framework.lifecycleStatus === 'superseded') return false;
			if (['evidence', 'factor', 'option', 'theme'].includes(input.kind)) {
				return framework.lifecycleStatus === 'draft';
			}
			if (input.kind === 'objective') return framework.lifecycleStatus === 'approved';
			if (input.kind === 'framework') return framework.lifecycleStatus === 'draft';
			if (
				['plan', 'initiative', 'requirement', 'handoff', 'kpi', 'review', 'decision'].includes(
					input.kind
				)
			) {
				return framework.lifecycleStatus === 'approved';
			}
			return true;
		}),
		framework,
		permissions
	};
}

async function ensureFrameworkPhase(
	framework: StrategyFrameworkSummary,
	kind: F01ManagedRecordKind
): Promise<void> {
	const draftKinds: F01ManagedRecordKind[] = [
		'framework',
		'evidence',
		'factor',
		'assumption',
		'option',
		'theme',
		'objective'
	];
	if (draftKinds.includes(kind) && framework.lifecycleStatus !== 'draft' && kind !== 'framework') {
		throw new StrategyValidationError(
			'Strategic intent and choice records are immutable once the strategy is approved. Create a controlled strategy revision.'
		);
	}
	if (!draftKinds.includes(kind) && framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Execution, performance and review records require the current approved strategy.'
		);
	}
}

export async function updateF01Record(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
	values: Readonly<Record<string, string>>;
}): Promise<void> {
	const { framework } = await frameworkContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (framework.lifecycleStatus === 'superseded') {
		throw new StrategyValidationError(
			'Superseded strategy versions are immutable enterprise history.'
		);
	}
	await ensureFrameworkPhase(framework, input.kind);
	const currentStatus = await statusFor({
		organisationId: input.actor.organisationId,
		frameworkPublicId: input.frameworkPublicId,
		kind: input.kind,
		recordPublicId: input.recordPublicId
	});
	const manageAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: input.kind,
		state: currentStatus,
		permissionKey: 'strategy.manage'
	});
	if (!manageAuthority.allowed) {
		throw new StrategyAccessError(
			'You do not have authority to edit this record in its current lifecycle phase.'
		);
	}
	if (
		!(await canF01LifecycleOperation(input.actor.organisationId, input.kind, currentStatus, 'edit'))
	) {
		throw new StrategyValidationError(
			`The ${input.kind} record cannot be edited while it is ${currentStatus}.`
		);
	}
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		switch (input.kind) {
			case 'framework': {
				const horizonStart = dateOnly(input.values.horizonStart, 'Horizon start', true)!;
				const horizonEnd = dateOnly(input.values.horizonEnd, 'Horizon end', true)!;
				if (horizonEnd < horizonStart)
					throw new StrategyValidationError('Horizon end must not be before horizon start.');
				const [outside] = await connection.execute<CountRow[]>(
					`SELECT COUNT(*) AS count FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE framework.organisation_id = ? AND framework.public_id = ? AND objective.target_date IS NOT NULL AND (objective.target_date < ? OR objective.target_date > ?)`,
					[input.actor.organisationId, input.frameworkPublicId, horizonStart, horizonEnd]
				);
				if (Number(outside[0]?.count ?? 0) > 0)
					throw new StrategyValidationError(
						'The revised horizon would place an existing objective target outside the strategy period. Adjust the objectives first.'
					);
				await connection.execute(
					`UPDATE strategy_frameworks SET title = ?, horizon_start = ?, horizon_end = ?, purpose_text = ?, vision_text = ?, mission_text = ?, minor_version_number = minor_version_number + 1 WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft'`,
					[
						requiredText(input.values.title, 'Strategy title', 255),
						horizonStart,
						horizonEnd,
						requiredText(input.values.purpose, 'Purpose', 20_000),
						requiredText(input.values.vision, 'Vision', 20_000),
						optionalText(input.values.mission, 20_000) ?? '',
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'evidence':
				await connection.execute(
					`UPDATE strategy_evidence_items evidence JOIN strategy_frameworks framework ON framework.id = evidence.strategy_framework_id SET evidence.evidence_type = ?, evidence.title = ?, evidence.source_reference = ?, evidence.source_uri = ?, evidence.publisher_name = ?, evidence.published_on = ?, evidence.observed_on = ?, evidence.summary_text = ?, evidence.reliability_score = ? WHERE evidence.organisation_id = ? AND framework.public_id = ? AND evidence.public_id = ? AND evidence.lifecycle_status = 'active'`,
					[
						requiredText(input.values.evidenceType, 'Evidence type', 24),
						requiredText(input.values.title, 'Evidence title', 255),
						optionalText(input.values.sourceReference, 512),
						optionalText(input.values.sourceUri, 2048),
						optionalText(input.values.publisherName, 255),
						dateOnly(input.values.publishedOn, 'Published date'),
						dateOnly(input.values.observedOn, 'Observed date', true),
						requiredText(input.values.summaryText, 'Evidence summary', 20_000),
						score(input.values.reliabilityScore, 'Reliability'),
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			case 'factor':
				await connection.execute(
					`UPDATE strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id SET factor.context_scope = ?, factor.dimension = ?, factor.direction = ?, factor.title = ?, factor.observed_on = ?, factor.analysis_text = ?, factor.implication_text = ?, factor.likelihood_score = ?, factor.impact_score = ?, factor.confidence_score = ? WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.public_id = ? AND factor.lifecycle_status = 'active'`,
					[
						requiredText(input.values.contextScope, 'Scope', 16),
						requiredText(input.values.dimension, 'Dimension', 24),
						requiredText(input.values.direction, 'Direction', 16),
						requiredText(input.values.title, 'Factor title', 255),
						dateOnly(input.values.observedOn, 'Observed date', true),
						requiredText(input.values.analysisText, 'Analysis', 20_000),
						requiredText(input.values.implicationText, 'Strategic implication', 20_000),
						score(input.values.likelihoodScore, 'Likelihood'),
						score(input.values.impactScore, 'Impact'),
						score(input.values.confidenceScore, 'Confidence'),
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			case 'assumption':
				await connection.execute(
					`UPDATE strategy_assumptions assumption JOIN strategy_frameworks framework ON framework.id = assumption.strategy_framework_id SET assumption.statement_text = ?, assumption.rationale_text = ?, assumption.confidence_score = ?, assumption.review_by = ? WHERE assumption.organisation_id = ? AND framework.public_id = ? AND assumption.public_id = ?`,
					[
						requiredText(input.values.statementText, 'Assumption', 20_000),
						requiredText(input.values.rationaleText, 'Assumption rationale', 20_000),
						score(input.values.confidenceScore, 'Confidence'),
						dateOnly(input.values.reviewBy, 'Review by', true),
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			case 'option':
				await connection.execute(
					`UPDATE strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id SET option_record.title = ?, option_record.description = ?, option_record.evaluation_summary = ?, option_record.priority_rank = ? WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.public_id = ? AND option_record.decision_status = 'proposed'`,
					[
						requiredText(input.values.title, 'Option title', 255),
						requiredText(input.values.description, 'Option description', 20_000),
						requiredText(input.values.evaluationSummary, 'Evaluation summary', 20_000),
						positiveInteger(input.values.priorityRank, 'Priority rank'),
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			case 'theme':
				await connection.execute(
					`UPDATE strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id SET theme.title = ?, theme.description = ?, theme.priority_rank = ? WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.public_id = ? AND theme.lifecycle_status = 'active'`,
					[
						requiredText(input.values.title, 'Theme title', 255),
						requiredText(input.values.description, 'Theme description', 20_000),
						positiveInteger(input.values.priorityRank, 'Priority rank'),
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			case 'objective': {
				const targetDate = dateOnly(input.values.targetDate, 'Target date', true)!;
				if (targetDate < framework.horizonStart || targetDate > framework.horizonEnd)
					throw new StrategyValidationError(
						'Objective target date must sit inside the strategy horizon.'
					);
				await connection.execute(
					`UPDATE strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id SET objective.title = ?, objective.description = ?, objective.priority_rank = ?, objective.target_date = ? WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id = ? AND objective.lifecycle_status = 'draft'`,
					[
						requiredText(input.values.title, 'Objective title', 255),
						requiredText(input.values.description, 'Objective description', 20_000),
						positiveInteger(input.values.priorityRank, 'Priority rank'),
						targetDate,
						input.actor.organisationId,
						input.frameworkPublicId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'plan': {
				const start = dateOnly(input.values.periodStart, 'Period start', true)!;
				const end = dateOnly(input.values.periodEnd, 'Period end', true)!;
				if (end < start || start < framework.horizonStart || end > framework.horizonEnd)
					throw new StrategyValidationError(
						'Business-plan period must sit inside the strategy horizon.'
					);
				const [outside] = await connection.execute<CountRow[]>(
					`SELECT COUNT(*) AS count FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id WHERE plan.organisation_id = ? AND plan.public_id = ? AND (initiative.start_date < ? OR initiative.end_date > ?)`,
					[input.actor.organisationId, input.recordPublicId, start, end]
				);
				if (Number(outside[0]?.count ?? 0) > 0)
					throw new StrategyValidationError(
						'The revised plan period would place an existing initiative outside the plan window. Adjust the initiatives first.'
					);
				await connection.execute(
					`UPDATE strategy_business_plans SET title = ?, period_start = ?, period_end = ?, narrative = ?, currency_code = ?, planned_revenue_amount = ?, planned_opex_amount = ?, planned_capex_amount = ?, minor_version_number = minor_version_number + 1 WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft'`,
					[
						requiredText(input.values.title, 'Plan title', 255),
						start,
						end,
						requiredText(input.values.narrative, 'Planning narrative', 20_000),
						currency(input.values.currencyCode),
						decimal(input.values.plannedRevenueAmount, 'Planned revenue') ?? '0',
						decimal(input.values.plannedOpexAmount, 'Planned opex') ?? '0',
						decimal(input.values.plannedCapexAmount, 'Planned capex') ?? '0',
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'initiative': {
				const [rows] = await connection.execute<
					(RowDataPacket & { planStart: Date | string; planEnd: Date | string })[]
				>(
					`SELECT plan.period_start AS planStart, plan.period_end AS planEnd FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id WHERE initiative.organisation_id = ? AND initiative.public_id = ? LIMIT 1 FOR UPDATE`,
					[input.actor.organisationId, input.recordPublicId]
				);
				const plan = rows[0];
				if (!plan) throw new StrategyValidationError('Initiative is no longer available.');
				const start = dateOnly(input.values.startDate, 'Start date', true)!;
				const end = dateOnly(input.values.endDate, 'End date', true)!;
				if (end < start || start < str(plan.planStart) || end > str(plan.planEnd))
					throw new StrategyValidationError(
						'Initiative dates must sit inside the business-plan period.'
					);
				await connection.execute(
					`UPDATE strategy_initiatives SET title = ?, outcome_text = ?, benefit_statement = ?, priority_rank = ?, start_date = ?, end_date = ?, planned_investment_amount = ?, planned_fte = ?, currency_code = ? WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('proposed','approved','in_progress')`,
					[
						requiredText(input.values.title, 'Initiative title', 255),
						requiredText(input.values.outcomeText, 'Intended outcome', 20_000),
						optionalText(input.values.benefitStatement, 20_000),
						positiveInteger(input.values.priorityRank, 'Priority rank'),
						start,
						end,
						decimal(input.values.plannedInvestmentAmount, 'Planned investment') ?? '0',
						decimal(input.values.plannedFte, 'Planned FTE') ?? '0',
						currency(input.values.currencyCode),
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'requirement': {
				const amount = decimal(input.values.amount, 'Amount');
				const quantity = decimal(input.values.quantity, 'Quantity');
				if (!amount && !quantity)
					throw new StrategyValidationError('Quantify the requirement with an amount or quantity.');
				const [rows] = await connection.execute<
					(RowDataPacket & { startDate: Date | string; endDate: Date | string })[]
				>(
					`SELECT initiative.start_date AS startDate, initiative.end_date AS endDate FROM strategy_initiative_resource_requirements requirement JOIN strategy_initiatives initiative ON initiative.id = requirement.strategy_initiative_id WHERE requirement.organisation_id = ? AND requirement.public_id = ? LIMIT 1 FOR UPDATE`,
					[input.actor.organisationId, input.recordPublicId]
				);
				const initiative = rows[0];
				if (!initiative) throw new StrategyValidationError('Requirement is no longer available.');
				const needBy = dateOnly(input.values.needBy, 'Need by');
				if (needBy && (needBy < str(initiative.startDate) || needBy > str(initiative.endDate)))
					throw new StrategyValidationError('Need-by date must sit inside the initiative period.');
				await connection.execute(
					`UPDATE strategy_initiative_resource_requirements SET requirement_type = ?, title = ?, description = ?, amount = ?, currency_code = ?, quantity = ?, unit_label = ?, target_function_code = ?, need_by = ? WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'identified'`,
					[
						requiredText(input.values.requirementType, 'Requirement type', 24),
						requiredText(input.values.title, 'Requirement title', 255),
						requiredText(input.values.description, 'Requirement description', 20_000),
						amount,
						amount ? currency(input.values.currencyCode) : null,
						quantity,
						quantity ? requiredText(input.values.unitLabel, 'Unit', 64) : null,
						functionCode(input.values.targetFunctionCode),
						needBy,
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'handoff':
				await connection.execute(
					`UPDATE strategy_initiative_handoffs SET handoff_type = ?, target_function_code = ?, request_summary = ? WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'requested'`,
					[
						requiredText(input.values.handoffType, 'Handoff type', 24),
						functionCode(input.values.targetFunctionCode),
						requiredText(input.values.requestSummary, 'Request summary', 20_000),
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			case 'kpi': {
				const targetDate = dateOnly(input.values.targetDate, 'Target date');
				if (
					targetDate &&
					(targetDate < framework.horizonStart || targetDate > framework.horizonEnd)
				)
					throw new StrategyValidationError(
						'KPI target date must sit inside the strategy horizon.'
					);
				await connection.execute(
					`UPDATE strategy_kpis SET title = ?, description = ?, unit_label = ?, direction = ?, baseline_value = ?, target_value = ?, target_date = ?, minor_version_number = minor_version_number + 1 WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft'`,
					[
						requiredText(input.values.title, 'KPI title', 255),
						requiredText(input.values.description, 'KPI definition', 20_000),
						requiredText(input.values.unitLabel, 'Unit', 64),
						requiredText(input.values.direction, 'Direction', 24),
						decimal(input.values.baselineValue, 'Baseline', true),
						decimal(input.values.targetValue, 'Target', true),
						targetDate,
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'review': {
				const reviewDate = dateOnly(input.values.reviewDate, 'Review date', true)!;
				if (reviewDate < framework.horizonStart || reviewDate > framework.horizonEnd)
					throw new StrategyValidationError('Review date must sit inside the strategy horizon.');
				await connection.execute(
					`UPDATE strategy_reviews SET review_date = ?, title = ?, summary = ? WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft'`,
					[
						reviewDate,
						requiredText(input.values.title, 'Review title', 255),
						requiredText(input.values.summary, 'Management assessment', 20_000),
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
			case 'decision': {
				const dueDate = dateOnly(input.values.dueDate, 'Due date');
				const [rows] = await connection.execute<(RowDataPacket & { reviewDate: Date | string })[]>(
					`SELECT review.review_date AS reviewDate FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id WHERE decision_record.organisation_id = ? AND decision_record.public_id = ? LIMIT 1 FOR UPDATE`,
					[input.actor.organisationId, input.recordPublicId]
				);
				const review = rows[0];
				if (!review) throw new StrategyValidationError('Decision is no longer available.');
				if (dueDate && (dueDate < str(review.reviewDate) || dueDate > framework.horizonEnd))
					throw new StrategyValidationError(
						'Decision due date must fall between the review date and strategy horizon end.'
					);
				await connection.execute(
					`UPDATE strategy_review_decisions SET decision_type = ?, decision_text = ?, rationale = ?, due_date = ? WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('open','in_progress')`,
					[
						requiredText(input.values.decisionType, 'Decision type', 24),
						requiredText(input.values.decisionText, 'Decision', 20_000),
						requiredText(input.values.rationale, 'Rationale', 20_000),
						dueDate,
						input.actor.organisationId,
						input.recordPublicId
					]
				);
				break;
			}
		}
		if (['framework', 'plan', 'kpi'].includes(input.kind)) {
			const metadata =
				input.kind === 'framework'
					? await singleRow<
							RowDataPacket & {
								code: string;
								versionNumber: number | string;
								minorVersionNumber: number | string;
								snapshot: string | Record<string, unknown>;
							}
						>(
							`SELECT framework_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'horizonStart', horizon_start, 'horizonEnd', horizon_end, 'purpose', purpose_text, 'vision', vision_text, 'mission', mission_text, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
							[input.actor.organisationId, input.recordPublicId]
						)
					: input.kind === 'plan'
						? await singleRow<
								RowDataPacket & {
									code: string;
									versionNumber: number | string;
									minorVersionNumber: number | string;
									snapshot: string | Record<string, unknown>;
								}
							>(
								`SELECT plan_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'periodStart', period_start, 'periodEnd', period_end, 'narrative', narrative, 'currencyCode', currency_code, 'plannedRevenueAmount', planned_revenue_amount, 'plannedOpexAmount', planned_opex_amount, 'plannedCapexAmount', planned_capex_amount, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
								[input.actor.organisationId, input.recordPublicId]
							)
						: await singleRow<
								RowDataPacket & {
									code: string;
									versionNumber: number | string;
									minorVersionNumber: number | string;
									snapshot: string | Record<string, unknown>;
								}
							>(
								`SELECT kpi_code AS code, version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'description', description, 'unitLabel', unit_label, 'direction', direction, 'baselineValue', baseline_value, 'targetValue', target_value, 'targetDate', target_date, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
								[input.actor.organisationId, input.recordPublicId]
							);
			const snapshot =
				typeof metadata.snapshot === 'string' ? JSON.parse(metadata.snapshot) : metadata.snapshot;
			await appendGovernedVersion(connection, {
				actor: input.actor,
				domainCode: 'F01',
				recordType:
					input.kind === 'framework'
						? 'strategy_framework'
						: input.kind === 'plan'
							? 'strategy_business_plan'
							: 'strategy_kpi',
				lineageKey: metadata.code,
				recordPublicId: input.recordPublicId,
				versionNumber: Number(metadata.versionNumber),
				minorVersionNumber: Number(metadata.minorVersionNumber),
				lifecycleStatus: 'draft',
				snapshot,
				changeNote: 'Saved working revision'
			});
		}

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: `strategy.${input.kind}.update`,
			subjectType: `strategy_${input.kind}`,
			subjectPublicId: input.recordPublicId,
			changeSummary: { lifecycleStatus: currentStatus },
			eventMetadata: { function: 'F01', mutation: 'update' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

async function count(
	connection: PoolConnection,
	query: string,
	params: Array<string | number | boolean | Date | null>
): Promise<number> {
	const [rows] = await connection.execute<CountRow[]>(query, params);
	return Number(rows[0]?.count ?? 0);
}

export async function deleteF01Record(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
}): Promise<void> {
	const { framework } = await frameworkContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (framework.lifecycleStatus === 'superseded') {
		throw new StrategyValidationError(
			'Superseded strategy versions are immutable enterprise history.'
		);
	}
	await ensureFrameworkPhase(framework, input.kind);
	const currentStatus = await statusFor({
		organisationId: input.actor.organisationId,
		frameworkPublicId: input.frameworkPublicId,
		kind: input.kind,
		recordPublicId: input.recordPublicId
	});
	const manageAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: input.kind,
		state: currentStatus,
		permissionKey: 'strategy.manage'
	});
	if (!manageAuthority.allowed) {
		throw new StrategyAccessError(
			'You do not have authority to delete this record in its current lifecycle phase.'
		);
	}
	if (
		!(await canF01LifecycleOperation(
			input.actor.organisationId,
			input.kind,
			currentStatus,
			'delete'
		))
	)
		throw new StrategyValidationError(
			`The ${input.kind} record cannot be deleted while it is ${currentStatus}. Use its lifecycle action instead.`
		);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const org = input.actor.organisationId;
		const id = input.recordPublicId;
		if (currentStatus === 'draft' && ['framework', 'plan', 'kpi'].includes(input.kind)) {
			await markWorkingVersionDiscarded(connection, {
				organisationId: org,
				domainCode: 'F01',
				recordType:
					input.kind === 'framework'
						? 'strategy_framework'
						: input.kind === 'plan'
							? 'strategy_business_plan'
							: 'strategy_kpi',
				recordPublicId: id
			});
		}
		switch (input.kind) {
			case 'framework': {
				if (input.frameworkPublicId !== id)
					throw new StrategyValidationError('Strategy record mismatch.');
				const row = await singleConnectionRow<IdRow>(
					connection,
					`SELECT id FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`,
					[org, id]
				);
				await connection.execute(
					`DELETE FROM strategy_frameworks WHERE organisation_id = ? AND id = ?`,
					[org, row.id]
				);
				break;
			}
			case 'evidence':
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_environment_factor_evidence_links link JOIN strategy_evidence_items evidence ON evidence.id = link.strategy_evidence_item_id WHERE evidence.organisation_id = ? AND evidence.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError(
						'Evidence linked to an environmental factor cannot be deleted. Remove or replace the factor relationship first.'
					);
				await connection.execute(
					`DELETE FROM strategy_evidence_items WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'active'`,
					[org, id]
				);
				break;
			case 'factor': {
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_option_factor_links link JOIN strategy_environment_factors factor ON factor.id = link.strategy_environment_factor_id WHERE factor.organisation_id = ? AND factor.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError(
						'A factor used by a strategic option cannot be deleted.'
					);
				const row = await singleRow<IdRow>(
					`SELECT id FROM strategy_environment_factors WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
					[org, id]
				);
				await connection.execute(
					`DELETE FROM strategy_environment_factor_evidence_links WHERE strategy_environment_factor_id = ?`,
					[row.id]
				);
				await connection.execute(
					`DELETE FROM strategy_environment_factors WHERE organisation_id = ? AND id = ?`,
					[org, row.id]
				);
				break;
			}
			case 'assumption':
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_option_assumption_links link JOIN strategy_assumptions assumption ON assumption.id = link.strategy_assumption_id WHERE assumption.organisation_id = ? AND assumption.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError(
						'An assumption used by a strategic option cannot be deleted.'
					);
				await connection.execute(
					`DELETE FROM strategy_assumptions WHERE organisation_id = ? AND public_id = ? AND validation_status = 'unvalidated'`,
					[org, id]
				);
				break;
			case 'option': {
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_objective_option_links link JOIN strategy_options option_record ON option_record.id = link.strategy_option_id WHERE option_record.organisation_id = ? AND option_record.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError(
						'An option already used by an objective cannot be deleted.'
					);
				const row = await singleRow<IdRow>(
					`SELECT id FROM strategy_options WHERE organisation_id = ? AND public_id = ? AND decision_status = 'proposed' LIMIT 1`,
					[org, id]
				);
				await connection.execute(
					`DELETE FROM strategy_option_factor_links WHERE strategy_option_id = ?`,
					[row.id]
				);
				await connection.execute(
					`DELETE FROM strategy_option_assumption_links WHERE strategy_option_id = ?`,
					[row.id]
				);
				await connection.execute(`DELETE FROM strategy_options WHERE id = ?`, [row.id]);
				break;
			}
			case 'theme':
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_objective_theme_links link JOIN strategy_themes theme ON theme.id = link.strategy_theme_id WHERE theme.organisation_id = ? AND theme.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError('A theme used by an objective cannot be deleted.');
				await connection.execute(
					`DELETE FROM strategy_themes WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'active'`,
					[org, id]
				);
				break;
			case 'objective': {
				const objective = await singleRow<IdRow>(
					`SELECT id FROM strategy_objectives WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft' LIMIT 1`,
					[org, id]
				);
				const dependencies = await count(
					connection,
					`SELECT (SELECT COUNT(*) FROM strategy_objectives WHERE parent_strategy_objective_id = ?) + (SELECT COUNT(*) FROM strategy_business_plan_objective_links WHERE strategy_objective_id = ?) + (SELECT COUNT(*) FROM strategy_kpis WHERE strategy_objective_id = ?) AS count`,
					[objective.id, objective.id, objective.id]
				);
				if (dependencies)
					throw new StrategyValidationError(
						'Objective cannot be deleted because downstream or child records already depend on it.'
					);
				await connection.execute(
					`DELETE FROM strategy_objective_option_links WHERE strategy_objective_id = ?`,
					[objective.id]
				);
				await connection.execute(
					`DELETE FROM strategy_objective_theme_links WHERE strategy_objective_id = ?`,
					[objective.id]
				);
				await connection.execute(`DELETE FROM strategy_objectives WHERE id = ?`, [objective.id]);
				break;
			}
			case 'plan': {
				const row = await singleConnectionRow<IdRow>(
					connection,
					`SELECT id FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`,
					[org, id]
				);
				await connection.execute(`DELETE FROM strategy_business_plans WHERE id = ?`, [row.id]);
				break;
			}
			case 'initiative': {
				const initiative = await singleRow<IdRow>(
					`SELECT id FROM strategy_initiatives WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'proposed' LIMIT 1`,
					[org, id]
				);
				const dependencies = await count(
					connection,
					`SELECT (SELECT COUNT(*) FROM strategy_initiative_resource_requirements WHERE strategy_initiative_id = ?) + (SELECT COUNT(*) FROM strategy_initiative_handoffs WHERE strategy_initiative_id = ?) + (SELECT COUNT(*) FROM strategy_initiative_kpi_links WHERE strategy_initiative_id = ?) + (SELECT COUNT(*) FROM strategy_initiative_operating_model_links WHERE initiative_id = ?) + (SELECT COUNT(*) FROM strategy_initiative_milestones WHERE strategy_initiative_id = ?) + (SELECT COUNT(*) FROM strategy_initiative_dependencies WHERE initiative_id = ? OR depends_on_initiative_id = ?) AS count`,
					[
						initiative.id,
						initiative.id,
						initiative.id,
						initiative.id,
						initiative.id,
						initiative.id,
						initiative.id
					]
				);
				if (dependencies)
					throw new StrategyValidationError(
						'Initiative cannot be deleted because requirements, handoffs, KPI links, milestones or dependencies already exist.'
					);
				await connection.execute(`DELETE FROM strategy_initiatives WHERE id = ?`, [initiative.id]);
				break;
			}
			case 'requirement':
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_initiative_handoffs handoff JOIN strategy_initiative_resource_requirements requirement ON requirement.id = handoff.strategy_resource_requirement_id WHERE requirement.organisation_id = ? AND requirement.public_id = ?`,
						[org, id]
					)
				)
					throw new StrategyValidationError(
						'A requirement with a handoff cannot be deleted; cancel the handoff or requirement instead.'
					);
				await connection.execute(
					`DELETE FROM strategy_initiative_resource_requirements WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'identified'`,
					[org, id]
				);
				break;
			case 'handoff':
				throw new StrategyValidationError(
					'Requested handoffs are enterprise evidence and are cancelled rather than deleted.'
				);
			case 'kpi': {
				const row = await singleConnectionRow<IdRow>(
					connection,
					`SELECT id FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? AND lifecycle_status IN ('draft','approved') LIMIT 1 FOR UPDATE`,
					[org, id]
				);
				await connection.execute(`DELETE FROM strategy_kpis WHERE id = ?`, [row.id]);
				break;
			}
			case 'review': {
				const review = await singleRow<IdRow>(
					`SELECT id FROM strategy_reviews WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'draft' LIMIT 1`,
					[org, id]
				);
				await connection.execute(
					`DELETE FROM strategy_review_decisions WHERE strategy_review_id = ? AND lifecycle_status IN ('open','in_progress')`,
					[review.id]
				);
				if (
					await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_review_decisions WHERE strategy_review_id = ?`,
						[review.id]
					)
				)
					throw new StrategyValidationError(
						'Review contains completed or cancelled decisions and can no longer be deleted.'
					);
				await connection.execute(`DELETE FROM strategy_review_kpis WHERE strategy_review_id = ?`, [
					review.id
				]);
				await connection.execute(`DELETE FROM strategy_reviews WHERE id = ?`, [review.id]);
				break;
			}
			case 'decision':
				await connection.execute(
					`DELETE decision_record FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id WHERE decision_record.organisation_id = ? AND decision_record.public_id = ? AND decision_record.lifecycle_status = 'open' AND review.lifecycle_status = 'draft'`,
					[org, id]
				);
				break;
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: `strategy.${input.kind}.delete`,
			subjectType: `strategy_${input.kind}`,
			subjectPublicId: input.recordPublicId,
			changeSummary: { previousStatus: currentStatus },
			eventMetadata: { function: 'F01', mutation: 'delete' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

export async function transitionF01Record(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
	targetStatus: string;
	note?: string | null;
	targetRecordType?: string | null;
	targetPublicId?: string | null;
}): Promise<void> {
	const { framework } = await frameworkContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	const currentStatus = await statusFor({
		organisationId: input.actor.organisationId,
		frameworkPublicId: input.frameworkPublicId,
		kind: input.kind,
		recordPublicId: input.recordPublicId
	});
	if (framework.lifecycleStatus === 'superseded') {
		throw new StrategyValidationError('Superseded strategy history cannot be changed.');
	}
	if (
		['evidence', 'factor', 'option', 'theme'].includes(input.kind) &&
		framework.lifecycleStatus !== 'draft'
	) {
		throw new StrategyValidationError(
			'This strategic-intent record is immutable after strategy approval. Create a controlled strategy revision.'
		);
	}
	if (input.kind === 'objective' && framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Objective outcome transitions apply only after strategy approval.'
		);
	}
	if (
		['plan', 'initiative', 'requirement', 'handoff', 'kpi', 'review', 'decision'].includes(
			input.kind
		) &&
		framework.lifecycleStatus !== 'approved'
	) {
		throw new StrategyValidationError(
			'Execution and review lifecycle transitions require the current approved strategy.'
		);
	}
	const transition = await assertF01LifecycleTransition(
		input.actor.organisationId,
		input.kind,
		currentStatus,
		input.targetStatus
	);
	const requiredPermissionKey =
		transition.requiredPermissionKey ??
		(input.targetStatus === 'approved' ||
		(input.kind === 'option' && ['selected', 'rejected'].includes(input.targetStatus))
			? 'strategy.approve'
			: 'strategy.manage');
	const transitionAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: input.kind,
		state: currentStatus,
		permissionKey: requiredPermissionKey
	});
	if (!transitionAuthority.allowed) {
		throw new StrategyAccessError(
			`You do not have ${requiredPermissionKey} authority for this lifecycle transition.`
		);
	}
	if (transition.requiresNote && !input.note?.trim())
		throw new StrategyValidationError(
			'A rationale or completion note is required for this lifecycle transition.'
		);
	if (
		transition.requiresTargetReference &&
		(!input.targetRecordType?.trim() || !input.targetPublicId?.trim())
	)
		throw new StrategyValidationError(
			'Fulfilment requires the canonical target record type and public ID.'
		);
	if (input.kind === 'framework' && input.targetStatus === 'approved')
		return approveStrategyFramework({
			actor: input.actor,
			frameworkPublicId: input.frameworkPublicId
		});
	if (input.kind === 'plan' && input.targetStatus === 'approved')
		return approveStrategyBusinessPlan({
			actor: input.actor,
			frameworkPublicId: input.frameworkPublicId,
			planPublicId: input.recordPublicId
		});
	if (input.kind === 'kpi' && input.targetStatus === 'approved')
		return approveStrategyKpi({
			actor: input.actor,
			frameworkPublicId: input.frameworkPublicId,
			kpiPublicId: input.recordPublicId
		});
	if (input.kind === 'review' && input.targetStatus === 'approved')
		return approveStrategyReview({
			actor: input.actor,
			frameworkPublicId: input.frameworkPublicId,
			reviewPublicId: input.recordPublicId
		});
	if (input.kind === 'option' && ['selected', 'rejected'].includes(input.targetStatus))
		return decideStrategyOption({
			actor: input.actor,
			frameworkPublicId: input.frameworkPublicId,
			optionPublicId: input.recordPublicId,
			decisionStatus: input.targetStatus as Exclude<OptionDecisionStatus, 'proposed'>,
			decisionRationale: input.note ?? ''
		}).then(() => undefined);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const org = input.actor.organisationId;
		const id = input.recordPublicId;
		const note = input.note?.trim() || null;
		switch (input.kind) {
			case 'evidence':
				if (
					input.targetStatus === 'retired' &&
					(await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_environment_factor_evidence_links link JOIN strategy_evidence_items evidence ON evidence.id = link.strategy_evidence_item_id WHERE evidence.organisation_id = ? AND evidence.public_id = ?`,
						[org, id]
					))
				)
					throw new StrategyValidationError(
						'Evidence linked to an active factor cannot be retired until the factor relationship is removed or replaced.'
					);
				await connection.execute(
					`UPDATE strategy_evidence_items SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'factor':
				if (
					input.targetStatus === 'retired' &&
					(await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_option_factor_links link JOIN strategy_environment_factors factor ON factor.id = link.strategy_environment_factor_id WHERE factor.organisation_id = ? AND factor.public_id = ?`,
						[org, id]
					))
				)
					throw new StrategyValidationError(
						'A factor used by a strategic option cannot be retired.'
					);
				await connection.execute(
					`UPDATE strategy_environment_factors SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'assumption':
				await connection.execute(
					`UPDATE strategy_assumptions SET validation_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'theme':
				if (
					input.targetStatus === 'retired' &&
					(await count(
						connection,
						`SELECT COUNT(*) AS count FROM strategy_objective_theme_links link JOIN strategy_themes theme ON theme.id = link.strategy_theme_id WHERE theme.organisation_id = ? AND theme.public_id = ?`,
						[org, id]
					))
				)
					throw new StrategyValidationError('A theme used by an objective cannot be retired.');
				await connection.execute(
					`UPDATE strategy_themes SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'objective':
				if (
					input.targetStatus === 'retired' &&
					(await count(
						connection,
						`SELECT (SELECT COUNT(*) FROM strategy_business_plan_objective_links link JOIN strategy_objectives objective ON objective.id = link.strategy_objective_id WHERE objective.organisation_id = ? AND objective.public_id = ?) + (SELECT COUNT(*) FROM strategy_kpis kpi JOIN strategy_objectives objective ON objective.id = kpi.strategy_objective_id WHERE objective.organisation_id = ? AND objective.public_id = ? AND kpi.lifecycle_status NOT IN ('retired','superseded')) AS count`,
						[org, id, org, id]
					))
				)
					throw new StrategyValidationError(
						'An objective with current plans or KPIs cannot be retired.'
					);
				await connection.execute(
					`UPDATE strategy_objectives SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'initiative':
				await connection.execute(
					`UPDATE strategy_initiatives SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'requirement':
				await connection.execute(
					`UPDATE strategy_initiative_resource_requirements SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'handoff': {
				const [rows] = await connection.execute<
					(RowDataPacket & { requirementId: string | number | null })[]
				>(
					`SELECT strategy_resource_requirement_id AS requirementId FROM strategy_initiative_handoffs WHERE organisation_id = ? AND public_id = ? LIMIT 1 FOR UPDATE`,
					[org, id]
				);
				const handoff = rows[0];
				if (!handoff) throw new StrategyValidationError('Handoff is no longer available.');
				await connection.execute(
					`UPDATE strategy_initiative_handoffs SET lifecycle_status = ?, target_record_type = ?, target_public_id = ?, response_note = ?, responded_by_member_id = ?, responded_at = CURRENT_TIMESTAMP(6) WHERE organisation_id = ? AND public_id = ?`,
					[
						input.targetStatus,
						input.targetStatus === 'fulfilled' ? (input.targetRecordType?.trim() ?? null) : null,
						input.targetStatus === 'fulfilled' ? (input.targetPublicId?.trim() ?? null) : null,
						note,
						input.actor.memberId,
						org,
						id
					]
				);
				if (handoff.requirementId) {
					const requirementStatus =
						input.targetStatus === 'accepted'
							? 'committed'
							: input.targetStatus === 'fulfilled'
								? 'satisfied'
								: input.targetStatus === 'rejected' || input.targetStatus === 'cancelled'
									? 'identified'
									: null;
					if (requirementStatus)
						await connection.execute(
							`UPDATE strategy_initiative_resource_requirements SET lifecycle_status = ?, canonical_record_type = ?, canonical_public_id = ? WHERE id = ?`,
							[
								requirementStatus,
								input.targetStatus === 'fulfilled'
									? (input.targetRecordType?.trim() ?? null)
									: null,
								input.targetStatus === 'fulfilled' ? (input.targetPublicId?.trim() ?? null) : null,
								handoff.requirementId
							]
						);
				}
				break;
			}
			case 'kpi':
				await connection.execute(
					`UPDATE strategy_kpis SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
					[input.targetStatus, org, id]
				);
				break;
			case 'decision':
				if (input.targetStatus === 'completed')
					await connection.execute(
						`UPDATE strategy_review_decisions SET lifecycle_status = 'completed', completion_note = ?, completed_by_member_id = ?, completed_at = CURRENT_TIMESTAMP(6) WHERE organisation_id = ? AND public_id = ?`,
						[note, input.actor.memberId, org, id]
					);
				else
					await connection.execute(
						`UPDATE strategy_review_decisions SET lifecycle_status = ? WHERE organisation_id = ? AND public_id = ?`,
						[input.targetStatus, org, id]
					);
				break;
			case 'framework':
			case 'option':
			case 'plan':
			case 'review':
				break;
		}
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: `strategy.${input.kind}.transition`,
			subjectType: `strategy_${input.kind}`,
			subjectPublicId: id,
			changeSummary: {
				from: currentStatus,
				to: input.targetStatus,
				note,
				targetRecordType: input.targetRecordType ?? null,
				targetPublicId: input.targetPublicId ?? null
			},
			eventMetadata: { function: 'F01', mutation: 'transition' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}

async function insertAndId(
	connection: PoolConnection,
	query: string,
	params: Array<string | number | boolean | Date | null>
): Promise<string> {
	const [result] = await connection.execute<ResultSetHeader>(query, params);
	return result.insertId.toString();
}

export async function reviseF01Record(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: 'framework' | 'plan' | 'kpi';
	recordPublicId: string;
}): Promise<{ publicId: string }> {
	const { framework } = await frameworkContext({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (framework.lifecycleStatus === 'superseded') {
		throw new StrategyValidationError(
			'Superseded strategy versions are immutable enterprise history.'
		);
	}
	const currentStatus = await statusFor({
		organisationId: input.actor.organisationId,
		frameworkPublicId: input.frameworkPublicId,
		kind: input.kind,
		recordPublicId: input.recordPublicId
	});
	const manageAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: input.kind,
		state: currentStatus,
		permissionKey: 'strategy.manage'
	});
	if (!manageAuthority.allowed) {
		throw new StrategyAccessError(
			'You do not have authority to revise this record in its current lifecycle phase.'
		);
	}
	if (
		!(await canF01LifecycleOperation(
			input.actor.organisationId,
			input.kind,
			currentStatus,
			'revise'
		))
	)
		throw new StrategyValidationError(`Only an approved ${input.kind} can be revised.`);
	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		if (input.kind === 'framework') {
			const [rows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					code: string;
					versionNumber: number | string;
					title: string;
					horizonStart: Date | string;
					horizonEnd: Date | string;
					purpose: string;
					vision: string;
					mission: string;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, framework_code AS code, version_number AS versionNumber, title, horizon_start AS horizonStart, horizon_end AS horizonEnd, purpose_text AS purpose, vision_text AS vision, mission_text AS mission, owner_member_id AS ownerMemberId FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'approved' LIMIT 1 FOR UPDATE`,
				[input.actor.organisationId, input.recordPublicId]
			);
			const source = rows[0];
			if (!source) throw new StrategyValidationError('Approved strategy is no longer available.');
			if (
				await count(
					connection,
					`SELECT COUNT(*) AS count FROM strategy_frameworks WHERE organisation_id = ? AND framework_code = ? AND version_number > ?`,
					[input.actor.organisationId, source.code, Number(source.versionNumber)]
				)
			)
				throw new StrategyValidationError('A newer strategy revision already exists.');
			const revisionPublicId = randomUUID();
			const revisionId = await insertAndId(
				connection,
				`INSERT INTO strategy_frameworks (organisation_id, public_id, framework_code, version_number, minor_version_number, title, horizon_start, horizon_end, purpose_text, vision_text, mission_text, lifecycle_status, supersedes_strategy_framework_id, owner_member_id, created_by_member_id, approved_by_member_id, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NULL, NULL)`,
				[
					input.actor.organisationId,
					revisionPublicId,
					source.code,
					Number(source.versionNumber) + 1,
					1,
					source.title,
					str(source.horizonStart),
					str(source.horizonEnd),
					source.purpose,
					source.vision,
					source.mission,
					source.id,
					source.ownerMemberId,
					input.actor.memberId
				]
			);
			const evidenceMap = new Map<string, string>();
			const factorMap = new Map<string, string>();
			const assumptionMap = new Map<string, string>();
			const optionMap = new Map<string, string>();
			const themeMap = new Map<string, string>();
			const objectiveMap = new Map<string, string>();
			const [evidenceRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					evidenceType: string;
					title: string;
					sourceReference: string | null;
					sourceUri: string | null;
					publisherName: string | null;
					publishedOn: Date | string | null;
					observedOn: Date | string | null;
					summaryText: string;
					reliabilityScore: number | string | null;
					lifecycleStatus: string;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, evidence_type AS evidenceType, title, source_reference AS sourceReference, source_uri AS sourceUri, publisher_name AS publisherName, published_on AS publishedOn, observed_on AS observedOn, summary_text AS summaryText, reliability_score AS reliabilityScore, lifecycle_status AS lifecycleStatus, owner_member_id AS ownerMemberId FROM strategy_evidence_items WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of evidenceRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_evidence_items (organisation_id, strategy_framework_id, public_id, evidence_type, title, source_reference, source_uri, publisher_name, published_on, observed_on, summary_text, reliability_score, lifecycle_status, owner_member_id, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.evidenceType,
						row.title,
						row.sourceReference,
						row.sourceUri,
						row.publisherName,
						row.publishedOn,
						row.observedOn,
						row.summaryText,
						row.reliabilityScore,
						row.lifecycleStatus,
						row.ownerMemberId,
						input.actor.memberId
					]
				);
				evidenceMap.set(String(row.id), newId);
			}
			const [factorRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					contextScope: string;
					dimension: string;
					direction: string;
					title: string;
					analysisText: string;
					implicationText: string | null;
					observedOn: Date | string | null;
					likelihoodScore: number | string | null;
					impactScore: number | string | null;
					confidenceScore: number | string | null;
					lifecycleStatus: string;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, context_scope AS contextScope, dimension, direction, title, analysis_text AS analysisText, implication_text AS implicationText, observed_on AS observedOn, likelihood_score AS likelihoodScore, impact_score AS impactScore, confidence_score AS confidenceScore, lifecycle_status AS lifecycleStatus, owner_member_id AS ownerMemberId FROM strategy_environment_factors WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of factorRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_environment_factors (organisation_id, strategy_framework_id, public_id, context_scope, dimension, direction, title, analysis_text, implication_text, evidence_reference, observed_on, likelihood_score, impact_score, confidence_score, lifecycle_status, owner_member_id, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.contextScope,
						row.dimension,
						row.direction,
						row.title,
						row.analysisText,
						row.implicationText,
						row.observedOn,
						row.likelihoodScore,
						row.impactScore,
						row.confidenceScore,
						row.lifecycleStatus,
						row.ownerMemberId,
						input.actor.memberId
					]
				);
				factorMap.set(String(row.id), newId);
			}
			const [factorEvidenceLinks] = await connection.execute<
				(RowDataPacket & {
					factorId: string | number;
					evidenceId: string | number;
					relationshipType: string;
					noteText: string | null;
				})[]
			>(
				`SELECT strategy_environment_factor_id AS factorId, strategy_evidence_item_id AS evidenceId, relationship_type AS relationshipType, note_text AS noteText FROM strategy_environment_factor_evidence_links WHERE organisation_id = ? AND strategy_environment_factor_id IN (SELECT id FROM strategy_environment_factors WHERE strategy_framework_id = ?)`,
				[input.actor.organisationId, source.id]
			);
			for (const link of factorEvidenceLinks) {
				const factorId = factorMap.get(String(link.factorId));
				const evidenceId = evidenceMap.get(String(link.evidenceId));
				if (factorId && evidenceId)
					await connection.execute(
						`INSERT INTO strategy_environment_factor_evidence_links (organisation_id, strategy_environment_factor_id, strategy_evidence_item_id, relationship_type, note_text, linked_by_member_id) VALUES (?, ?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							factorId,
							evidenceId,
							link.relationshipType,
							link.noteText,
							input.actor.memberId
						]
					);
			}
			const [assumptionRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					statementText: string;
					rationaleText: string | null;
					confidenceScore: number | string | null;
					reviewBy: Date | string | null;
					validationStatus: string;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, statement_text AS statementText, rationale_text AS rationaleText, confidence_score AS confidenceScore, review_by AS reviewBy, validation_status AS validationStatus, owner_member_id AS ownerMemberId FROM strategy_assumptions WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of assumptionRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_assumptions (organisation_id, strategy_framework_id, public_id, statement_text, rationale_text, confidence_score, review_by, validation_status, owner_member_id, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.statementText,
						row.rationaleText,
						row.confidenceScore,
						row.reviewBy,
						row.validationStatus,
						row.ownerMemberId,
						input.actor.memberId
					]
				);
				assumptionMap.set(String(row.id), newId);
			}
			const [optionRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					title: string;
					description: string;
					evaluationSummary: string | null;
					decisionStatus: string;
					decisionRationale: string | null;
					priorityRank: number | string | null;
				})[]
			>(
				`SELECT id, title, description, evaluation_summary AS evaluationSummary, decision_status AS decisionStatus, decision_rationale AS decisionRationale, priority_rank AS priorityRank FROM strategy_options WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of optionRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_options (organisation_id, strategy_framework_id, public_id, title, description, evaluation_summary, decision_status, decision_rationale, priority_rank, created_by_member_id, decided_by_member_id, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.title,
						row.description,
						row.evaluationSummary,
						row.decisionStatus,
						row.decisionRationale,
						row.priorityRank,
						input.actor.memberId,
						['selected', 'rejected'].includes(row.decisionStatus) ? input.actor.memberId : null,
						['selected', 'rejected'].includes(row.decisionStatus) ? new Date() : null
					]
				);
				optionMap.set(String(row.id), newId);
			}
			const [optionFactorLinks] = await connection.execute<
				(RowDataPacket & {
					optionId: string | number;
					factorId: string | number;
					relationshipType: string;
				})[]
			>(
				`SELECT strategy_option_id AS optionId, strategy_environment_factor_id AS factorId, relationship_type AS relationshipType FROM strategy_option_factor_links WHERE strategy_option_id IN (SELECT id FROM strategy_options WHERE strategy_framework_id = ?)`,
				[source.id]
			);
			for (const link of optionFactorLinks) {
				const optionId = optionMap.get(String(link.optionId));
				const factorId = factorMap.get(String(link.factorId));
				if (optionId && factorId)
					await connection.execute(
						`INSERT INTO strategy_option_factor_links (organisation_id, strategy_option_id, strategy_environment_factor_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							optionId,
							factorId,
							link.relationshipType,
							input.actor.memberId
						]
					);
			}
			const [optionAssumptionLinks] = await connection.execute<
				(RowDataPacket & {
					optionId: string | number;
					assumptionId: string | number;
					relationshipType: string;
				})[]
			>(
				`SELECT strategy_option_id AS optionId, strategy_assumption_id AS assumptionId, relationship_type AS relationshipType FROM strategy_option_assumption_links WHERE strategy_option_id IN (SELECT id FROM strategy_options WHERE strategy_framework_id = ?)`,
				[source.id]
			);
			for (const link of optionAssumptionLinks) {
				const optionId = optionMap.get(String(link.optionId));
				const assumptionId = assumptionMap.get(String(link.assumptionId));
				if (optionId && assumptionId)
					await connection.execute(
						`INSERT INTO strategy_option_assumption_links (organisation_id, strategy_option_id, strategy_assumption_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							optionId,
							assumptionId,
							link.relationshipType,
							input.actor.memberId
						]
					);
			}
			const [themeRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					code: string;
					title: string;
					description: string;
					priorityRank: number | string;
					lifecycleStatus: string;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, theme_code AS code, title, description, priority_rank AS priorityRank, lifecycle_status AS lifecycleStatus, owner_member_id AS ownerMemberId FROM strategy_themes WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of themeRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_themes (organisation_id, strategy_framework_id, public_id, theme_code, title, description, priority_rank, lifecycle_status, owner_member_id, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.code,
						row.title,
						row.description,
						row.priorityRank,
						row.lifecycleStatus,
						row.ownerMemberId,
						input.actor.memberId
					]
				);
				themeMap.set(String(row.id), newId);
			}
			const [objectiveRows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					code: string;
					title: string;
					description: string;
					priorityRank: number | string;
					parentId: string | number | null;
					ownerMemberId: string | number | null;
					targetDate: Date | string | null;
				})[]
			>(
				`SELECT id, objective_code AS code, title, description, priority_rank AS priorityRank, parent_strategy_objective_id AS parentId, owner_member_id AS ownerMemberId, target_date AS targetDate FROM strategy_objectives WHERE strategy_framework_id = ?`,
				[source.id]
			);
			for (const row of objectiveRows) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_objectives (organisation_id, strategy_framework_id, public_id, objective_code, title, description, priority_rank, parent_strategy_objective_id, owner_member_id, target_date, lifecycle_status, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, 'draft', ?)`,
					[
						input.actor.organisationId,
						revisionId,
						randomUUID(),
						row.code,
						row.title,
						row.description,
						row.priorityRank,
						row.ownerMemberId,
						row.targetDate,
						input.actor.memberId
					]
				);
				objectiveMap.set(String(row.id), newId);
			}
			for (const row of objectiveRows)
				if (row.parentId) {
					const child = objectiveMap.get(String(row.id));
					const parent = objectiveMap.get(String(row.parentId));
					if (child && parent)
						await connection.execute(
							`UPDATE strategy_objectives SET parent_strategy_objective_id = ? WHERE id = ?`,
							[parent, child]
						);
				}
			const [objectiveOptionLinks] = await connection.execute<
				(RowDataPacket & {
					objectiveId: string | number;
					optionId: string | number;
					relationshipType: string;
				})[]
			>(
				`SELECT strategy_objective_id AS objectiveId, strategy_option_id AS optionId, relationship_type AS relationshipType FROM strategy_objective_option_links WHERE strategy_objective_id IN (SELECT id FROM strategy_objectives WHERE strategy_framework_id = ?)`,
				[source.id]
			);
			for (const link of objectiveOptionLinks) {
				const objectiveId = objectiveMap.get(String(link.objectiveId));
				const optionId = optionMap.get(String(link.optionId));
				if (objectiveId && optionId)
					await connection.execute(
						`INSERT INTO strategy_objective_option_links (organisation_id, strategy_objective_id, strategy_option_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							objectiveId,
							optionId,
							link.relationshipType,
							input.actor.memberId
						]
					);
			}
			const [objectiveThemeLinks] = await connection.execute<
				(RowDataPacket & {
					objectiveId: string | number;
					themeId: string | number;
					relationshipType: string;
				})[]
			>(
				`SELECT strategy_objective_id AS objectiveId, strategy_theme_id AS themeId, relationship_type AS relationshipType FROM strategy_objective_theme_links WHERE strategy_objective_id IN (SELECT id FROM strategy_objectives WHERE strategy_framework_id = ?)`,
				[source.id]
			);
			for (const link of objectiveThemeLinks) {
				const objectiveId = objectiveMap.get(String(link.objectiveId));
				const themeId = themeMap.get(String(link.themeId));
				if (objectiveId && themeId)
					await connection.execute(
						`INSERT INTO strategy_objective_theme_links (organisation_id, strategy_objective_id, strategy_theme_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							objectiveId,
							themeId,
							link.relationshipType,
							input.actor.memberId
						]
					);
			}
			const versionRow = await singleConnectionRow<
				RowDataPacket & {
					versionNumber: number | string;
					minorVersionNumber: number | string;
					snapshot: string | Record<string, unknown>;
				}
			>(
				connection,
				`SELECT version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'horizonStart', horizon_start, 'horizonEnd', horizon_end, 'purpose', purpose_text, 'vision', vision_text, 'mission', mission_text, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_frameworks WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
				[input.actor.organisationId, revisionPublicId]
			);
			await appendGovernedVersion(connection, {
				actor: input.actor,
				domainCode: 'F01',
				recordType: 'strategy_framework',
				lineageKey: source.code,
				recordPublicId: revisionPublicId,
				versionNumber: Number(versionRow.versionNumber),
				minorVersionNumber: Number(versionRow.minorVersionNumber),
				lifecycleStatus: 'draft',
				snapshot:
					typeof versionRow.snapshot === 'string'
						? JSON.parse(versionRow.snapshot)
						: versionRow.snapshot,
				changeNote: 'Controlled revision created from published version'
			});
			await appendDomainEvidence(connection, {
				actor: input.actor,
				actionKey: 'strategy.framework.revise',
				subjectType: 'strategy_framework',
				subjectPublicId: revisionPublicId,
				changeSummary: {
					frameworkCode: source.code,
					versionNumber: Number(source.versionNumber) + 1,
					supersedesFrameworkPublicId: input.recordPublicId
				},
				eventMetadata: { function: 'F01', mutation: 'revision' }
			});
			await connection.commit();
			return { publicId: revisionPublicId };
		}
		if (input.kind === 'plan') {
			const [rows] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					frameworkId: string | number;
					code: string;
					versionNumber: number | string;
					title: string;
					periodStart: Date | string;
					periodEnd: Date | string;
					narrative: string;
					currencyCode: string;
					revenue: string | number;
					opex: string | number;
					capex: string | number;
					ownerMemberId: string | number | null;
				})[]
			>(
				`SELECT id, strategy_framework_id AS frameworkId, plan_code AS code, version_number AS versionNumber, title, period_start AS periodStart, period_end AS periodEnd, narrative, currency_code AS currencyCode, planned_revenue_amount AS revenue, planned_opex_amount AS opex, planned_capex_amount AS capex, owner_member_id AS ownerMemberId FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'approved' LIMIT 1 FOR UPDATE`,
				[input.actor.organisationId, input.recordPublicId]
			);
			const source = rows[0];
			if (!source)
				throw new StrategyValidationError('Approved business plan is no longer available.');
			if (
				await count(
					connection,
					`SELECT COUNT(*) AS count FROM strategy_business_plans WHERE organisation_id = ? AND plan_code = ? AND version_number > ?`,
					[input.actor.organisationId, source.code, Number(source.versionNumber)]
				)
			)
				throw new StrategyValidationError('A newer business-plan revision already exists.');
			const revisionPublicId = randomUUID();
			const revisionId = await insertAndId(
				connection,
				`INSERT INTO strategy_business_plans (organisation_id, strategy_framework_id, public_id, plan_code, version_number, minor_version_number, title, period_start, period_end, narrative, currency_code, planned_revenue_amount, planned_opex_amount, planned_capex_amount, lifecycle_status, supersedes_business_plan_id, owner_member_id, created_by_member_id, approved_by_member_id, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, NULL, NULL)`,
				[
					input.actor.organisationId,
					source.frameworkId,
					revisionPublicId,
					source.code,
					Number(source.versionNumber) + 1,
					1,
					source.title,
					source.periodStart,
					source.periodEnd,
					source.narrative,
					source.currencyCode,
					source.revenue,
					source.opex,
					source.capex,
					source.id,
					source.ownerMemberId,
					input.actor.memberId
				]
			);
			await connection.execute(
				`INSERT INTO strategy_business_plan_objective_links (organisation_id, strategy_business_plan_id, strategy_objective_id, contribution_type, created_by_member_id) SELECT organisation_id, ?, strategy_objective_id, contribution_type, ? FROM strategy_business_plan_objective_links WHERE strategy_business_plan_id = ?`,
				[revisionId, input.actor.memberId, source.id]
			);
			const [initiatives] = await connection.execute<
				(RowDataPacket & {
					id: string | number;
					objectiveId: string | number;
					code: string;
					title: string;
					outcomeText: string;
					benefitStatement: string | null;
					resourceAssumptions: string | null;
					riskSummary: string | null;
					priorityRank: number | string;
					startDate: Date | string;
					endDate: Date | string;
					ownerMemberId: string | number | null;
					sponsorMemberId: string | number | null;
					investment: string | number;
					fte: string | number;
					currencyCode: string;
				})[]
			>(
				`SELECT id, strategy_objective_id AS objectiveId, initiative_code AS code, title, outcome_text AS outcomeText, benefit_statement AS benefitStatement, resource_assumptions AS resourceAssumptions, risk_summary AS riskSummary, priority_rank AS priorityRank, start_date AS startDate, end_date AS endDate, owner_member_id AS ownerMemberId, sponsor_member_id AS sponsorMemberId, planned_investment_amount AS investment, planned_fte AS fte, currency_code AS currencyCode FROM strategy_initiatives WHERE strategy_business_plan_id = ? AND lifecycle_status <> 'cancelled'`,
				[source.id]
			);
			const initiativeMap = new Map<string, string>();
			for (const row of initiatives) {
				const newId = await insertAndId(
					connection,
					`INSERT INTO strategy_initiatives (organisation_id, strategy_business_plan_id, strategy_objective_id, public_id, initiative_code, title, outcome_text, benefit_statement, resource_assumptions, risk_summary, priority_rank, start_date, end_date, owner_member_id, sponsor_member_id, planned_investment_amount, planned_fte, currency_code, project_id, project_budget_id, project_budget_version_id, lifecycle_status, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'proposed', ?)`,
					[
						input.actor.organisationId,
						revisionId,
						row.objectiveId,
						randomUUID(),
						row.code,
						row.title,
						row.outcomeText,
						row.benefitStatement,
						row.resourceAssumptions,
						row.riskSummary,
						row.priorityRank,
						row.startDate,
						row.endDate,
						row.ownerMemberId,
						row.sponsorMemberId,
						row.investment,
						row.fte,
						row.currencyCode,
						input.actor.memberId
					]
				);
				initiativeMap.set(String(row.id), newId);
			}
			const [requirements] = await connection.execute<
				(RowDataPacket & {
					initiativeId: string | number;
					requirementType: string;
					title: string;
					description: string;
					amount: string | number | null;
					currencyCode: string | null;
					quantity: string | number | null;
					unitLabel: string | null;
					targetFunctionCode: string;
					needBy: Date | string | null;
				})[]
			>(
				`SELECT strategy_initiative_id AS initiativeId, requirement_type AS requirementType, title, description, amount, currency_code AS currencyCode, quantity, unit_label AS unitLabel, target_function_code AS targetFunctionCode, need_by AS needBy FROM strategy_initiative_resource_requirements WHERE strategy_initiative_id IN (SELECT id FROM strategy_initiatives WHERE strategy_business_plan_id = ?) AND lifecycle_status <> 'cancelled'`,
				[source.id]
			);
			for (const row of requirements) {
				const newInitiativeId = initiativeMap.get(String(row.initiativeId));
				if (newInitiativeId)
					await connection.execute(
						`INSERT INTO strategy_initiative_resource_requirements (organisation_id, strategy_initiative_id, public_id, requirement_type, title, description, amount, currency_code, quantity, unit_label, target_function_code, need_by, lifecycle_status, canonical_record_type, canonical_public_id, created_by_member_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'identified', NULL, NULL, ?)`,
						[
							input.actor.organisationId,
							newInitiativeId,
							randomUUID(),
							row.requirementType,
							row.title,
							row.description,
							row.amount,
							row.currencyCode,
							row.quantity,
							row.unitLabel,
							row.targetFunctionCode,
							row.needBy,
							input.actor.memberId
						]
					);
			}
			const [kpiLinks] = await connection.execute<
				(RowDataPacket & {
					initiativeId: string | number;
					kpiId: string | number;
					contributionType: string;
				})[]
			>(
				`SELECT strategy_initiative_id AS initiativeId, strategy_kpi_id AS kpiId, contribution_type AS contributionType FROM strategy_initiative_kpi_links WHERE strategy_initiative_id IN (SELECT id FROM strategy_initiatives WHERE strategy_business_plan_id = ?)`,
				[source.id]
			);
			for (const link of kpiLinks) {
				const newInitiativeId = initiativeMap.get(String(link.initiativeId));
				if (newInitiativeId)
					await connection.execute(
						`INSERT INTO strategy_initiative_kpi_links (organisation_id, strategy_initiative_id, strategy_kpi_id, contribution_type, created_by_member_id) VALUES (?, ?, ?, ?, ?)`,
						[
							input.actor.organisationId,
							newInitiativeId,
							link.kpiId,
							link.contributionType,
							input.actor.memberId
						]
					);
			}
			const versionRow = await singleConnectionRow<
				RowDataPacket & {
					versionNumber: number | string;
					minorVersionNumber: number | string;
					snapshot: string | Record<string, unknown>;
				}
			>(
				connection,
				`SELECT version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'periodStart', period_start, 'periodEnd', period_end, 'narrative', narrative, 'currencyCode', currency_code, 'plannedRevenueAmount', planned_revenue_amount, 'plannedOpexAmount', planned_opex_amount, 'plannedCapexAmount', planned_capex_amount, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_business_plans WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
				[input.actor.organisationId, revisionPublicId]
			);
			await appendGovernedVersion(connection, {
				actor: input.actor,
				domainCode: 'F01',
				recordType: 'strategy_business_plan',
				lineageKey: source.code,
				recordPublicId: revisionPublicId,
				versionNumber: Number(versionRow.versionNumber),
				minorVersionNumber: Number(versionRow.minorVersionNumber),
				lifecycleStatus: 'draft',
				snapshot:
					typeof versionRow.snapshot === 'string'
						? JSON.parse(versionRow.snapshot)
						: versionRow.snapshot,
				changeNote: 'Controlled revision created from published version'
			});
			await appendDomainEvidence(connection, {
				actor: input.actor,
				actionKey: 'strategy.business-plan.revise',
				subjectType: 'strategy_business_plan',
				subjectPublicId: revisionPublicId,
				changeSummary: {
					planCode: source.code,
					versionNumber: Number(source.versionNumber) + 1,
					supersedesBusinessPlanPublicId: input.recordPublicId
				},
				eventMetadata: { function: 'F01', mutation: 'revision' }
			});
			await connection.commit();
			return { publicId: revisionPublicId };
		}
		const [rows] = await connection.execute<
			(RowDataPacket & {
				id: string | number;
				frameworkId: string | number;
				objectiveId: string | number;
				code: string;
				versionNumber: number | string;
				title: string;
				description: string;
				unitLabel: string;
				direction: string;
				aggregationMethod: string;
				baselineValue: string | number;
				targetValue: string | number;
				warningThreshold: string | number | null;
				criticalThreshold: string | number | null;
				targetDate: Date | string | null;
				sourceMode: string;
				sourceDomain: string | null;
				sourceRecordType: string | null;
				sourceMeasureKey: string | null;
				ownerMemberId: string | number;
			})[]
		>(
			`SELECT id, strategy_framework_id AS frameworkId, strategy_objective_id AS objectiveId, kpi_code AS code, version_number AS versionNumber, title, description, unit_label AS unitLabel, direction, aggregation_method AS aggregationMethod, baseline_value AS baselineValue, target_value AS targetValue, warning_threshold AS warningThreshold, critical_threshold AS criticalThreshold, target_date AS targetDate, source_mode AS sourceMode, source_domain AS sourceDomain, source_record_type AS sourceRecordType, source_measure_key AS sourceMeasureKey, owner_member_id AS ownerMemberId FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? AND lifecycle_status = 'approved' LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, input.recordPublicId]
		);
		const source = rows[0];
		if (!source) throw new StrategyValidationError('Approved KPI is no longer available.');
		if (
			await count(
				connection,
				`SELECT COUNT(*) AS count FROM strategy_kpis WHERE organisation_id = ? AND kpi_code = ? AND version_number > ?`,
				[input.actor.organisationId, source.code, Number(source.versionNumber)]
			)
		)
			throw new StrategyValidationError('A newer KPI revision already exists.');
		const revisionPublicId = randomUUID();
		const revisionId = await insertAndId(
			connection,
			`INSERT INTO strategy_kpis (organisation_id, strategy_framework_id, strategy_objective_id, public_id, kpi_code, version_number, minor_version_number, title, description, unit_label, direction, aggregation_method, baseline_value, target_value, warning_threshold, critical_threshold, target_date, source_mode, source_domain, source_record_type, source_measure_key, owner_member_id, lifecycle_status, supersedes_strategy_kpi_id, created_by_member_id, approved_by_member_id, approved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				source.frameworkId,
				source.objectiveId,
				revisionPublicId,
				source.code,
				Number(source.versionNumber) + 1,
				1,
				source.title,
				source.description,
				source.unitLabel,
				source.direction,
				source.aggregationMethod,
				source.baselineValue,
				source.targetValue,
				source.warningThreshold,
				source.criticalThreshold,
				source.targetDate,
				source.sourceMode,
				source.sourceDomain,
				source.sourceRecordType,
				source.sourceMeasureKey,
				source.ownerMemberId,
				source.id,
				input.actor.memberId
			]
		);
		await connection.execute(
			`INSERT INTO strategy_initiative_kpi_links (organisation_id, strategy_initiative_id, strategy_kpi_id, contribution_type, created_by_member_id) SELECT organisation_id, strategy_initiative_id, ?, contribution_type, ? FROM strategy_initiative_kpi_links WHERE strategy_kpi_id = ?`,
			[revisionId, input.actor.memberId, source.id]
		);
		const versionRow = await singleConnectionRow<
			RowDataPacket & {
				versionNumber: number | string;
				minorVersionNumber: number | string;
				snapshot: string | Record<string, unknown>;
			}
		>(
			connection,
			`SELECT version_number AS versionNumber, minor_version_number AS minorVersionNumber, JSON_OBJECT('title', title, 'description', description, 'unitLabel', unit_label, 'direction', direction, 'baselineValue', baseline_value, 'targetValue', target_value, 'targetDate', target_date, 'lifecycleStatus', lifecycle_status) AS snapshot FROM strategy_kpis WHERE organisation_id = ? AND public_id = ? LIMIT 1`,
			[input.actor.organisationId, revisionPublicId]
		);
		await appendGovernedVersion(connection, {
			actor: input.actor,
			domainCode: 'F01',
			recordType: 'strategy_kpi',
			lineageKey: source.code,
			recordPublicId: revisionPublicId,
			versionNumber: Number(versionRow.versionNumber),
			minorVersionNumber: Number(versionRow.minorVersionNumber),
			lifecycleStatus: 'draft',
			snapshot:
				typeof versionRow.snapshot === 'string'
					? JSON.parse(versionRow.snapshot)
					: versionRow.snapshot,
			changeNote: 'Controlled revision created from published version'
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.kpi.revise',
			subjectType: 'strategy_kpi',
			subjectPublicId: revisionPublicId,
			changeSummary: {
				kpiCode: source.code,
				versionNumber: Number(source.versionNumber) + 1,
				supersedesKpiPublicId: input.recordPublicId
			},
			eventMetadata: { function: 'F01', mutation: 'revision' }
		});
		await connection.commit();
		return { publicId: revisionPublicId };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
