import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';
import type { F01ManagedRecordKind } from './f01-lifecycle';

type SupportedRelationshipKind =
	'factor' | 'option' | 'objective' | 'plan' | 'initiative' | 'kpi' | 'decision';

export type F01RelationshipOption = {
	value: string;
	label: string;
	selected: boolean;
};

export type F01RelationshipGroup = {
	key: string;
	label: string;
	description: string;
	mode: 'single' | 'multiple';
	required?: boolean;
	options: F01RelationshipOption[];
};

export type F01RelationshipEditor = {
	groups: F01RelationshipGroup[];
};

type OptionRow = RowDataPacket & {
	value: string;
	label: string;
	selected: number | string;
};
type IdRow = RowDataPacket & { id: string | number; publicId: string; label?: string };
type StatusRow = RowDataPacket & { status: string };
type CountRow = RowDataPacket & { count: number | string };

const supportedKinds = new Set<SupportedRelationshipKind>([
	'factor',
	'option',
	'objective',
	'plan',
	'initiative',
	'kpi',
	'decision'
]);

export function normaliseRelationshipPublicIds(values: readonly string[]): string[] {
	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function selected(value: number | string): boolean {
	return Number(value) > 0;
}

function optionRows(rows: OptionRow[]): F01RelationshipOption[] {
	return rows.map((row) => ({
		value: row.value,
		label: row.label,
		selected: selected(row.selected)
	}));
}

function supportedKind(kind: F01ManagedRecordKind): SupportedRelationshipKind | null {
	return supportedKinds.has(kind as SupportedRelationshipKind)
		? (kind as SupportedRelationshipKind)
		: null;
}

async function context(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}) {
	const workspace = await getStrategyWorkspace({
		organisationId: input.organisationId,
		memberId: input.memberId
	});
	const framework = workspace.frameworks.find(
		(candidate) => candidate.publicId === input.frameworkPublicId
	);
	if (!framework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}
	return { framework, permissions: workspace.permissions };
}

function phaseAllows(kind: SupportedRelationshipKind, frameworkStatus: string): boolean {
	if (['factor', 'option', 'objective'].includes(kind)) return frameworkStatus === 'draft';
	return frameworkStatus === 'approved';
}

function relationshipStatusIsEditable(kind: SupportedRelationshipKind, status: string): boolean {
	switch (kind) {
		case 'factor':
			return status === 'active';
		case 'option':
			return status === 'proposed';
		case 'objective':
			return status === 'draft';
		case 'plan':
			return status === 'draft';
		case 'initiative':
			return status === 'proposed';
		case 'kpi':
			return status === 'draft';
		case 'decision':
			return ['open', 'in_progress'].includes(status);
	}
}

async function recordStatus(input: {
	organisationId: string;
	frameworkPublicId: string;
	kind: SupportedRelationshipKind;
	recordPublicId: string;
}): Promise<string> {
	const queries: Record<SupportedRelationshipKind, string> = {
		factor: `SELECT factor.lifecycle_status AS status FROM strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.public_id = ? LIMIT 1`,
		option: `SELECT option_record.decision_status AS status FROM strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.public_id = ? LIMIT 1`,
		objective: `SELECT objective.lifecycle_status AS status FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id = ? LIMIT 1`,
		plan: `SELECT plan.lifecycle_status AS status FROM strategy_business_plans plan JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE plan.organisation_id = ? AND framework.public_id = ? AND plan.public_id = ? LIMIT 1`,
		initiative: `SELECT initiative.lifecycle_status AS status FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE initiative.organisation_id = ? AND framework.public_id = ? AND initiative.public_id = ? LIMIT 1`,
		kpi: `SELECT kpi.lifecycle_status AS status FROM strategy_kpis kpi JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND framework.public_id = ? AND kpi.public_id = ? LIMIT 1`,
		decision: `SELECT decision_record.lifecycle_status AS status FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? LIMIT 1`
	};
	const [rows] = await getPool().execute<StatusRow[]>(queries[input.kind], [
		input.organisationId,
		input.frameworkPublicId,
		input.recordPublicId
	]);
	const row = rows[0];
	if (!row) throw new StrategyValidationError('The requested F01 record is no longer available.');
	return row.status;
}

async function rows(query: string, params: Array<string | number>): Promise<OptionRow[]> {
	const [result] = await getPool().execute<OptionRow[]>(query, params);
	return result;
}

export async function getF01RelationshipEditor(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
}): Promise<F01RelationshipEditor | null> {
	const kind = supportedKind(input.kind);
	if (!kind) return null;
	const { framework, permissions } = await context(input);
	if (!permissions.canManage || !phaseAllows(kind, framework.lifecycleStatus)) return null;
	const status = await recordStatus({ ...input, kind });
	if (!relationshipStatusIsEditable(kind, status)) return null;
	const org = input.organisationId;
	const strategy = input.frameworkPublicId;
	const record = input.recordPublicId;

	switch (kind) {
		case 'factor': {
			const evidence = await rows(
				`SELECT evidence.public_id AS value,
				        evidence.title AS label,
				        EXISTS(SELECT 1 FROM strategy_environment_factor_evidence_links link
				               JOIN strategy_environment_factors linked_factor ON linked_factor.id = link.strategy_environment_factor_id
				              WHERE linked_factor.public_id = ?
				                AND linked_factor.organisation_id = ?
				                AND link.strategy_evidence_item_id = evidence.id
				                AND link.relationship_type = 'supports') AS selected
				 FROM strategy_evidence_items evidence
				 JOIN strategy_frameworks framework ON framework.id = evidence.strategy_framework_id
				 WHERE evidence.organisation_id = ? AND framework.public_id = ? AND evidence.lifecycle_status = 'active'
				 ORDER BY evidence.observed_on DESC, evidence.title`,
				[record, org, org, strategy]
			);
			return {
				groups: [
					{
						key: 'evidencePublicIds',
						label: 'Supporting evidence',
						description: 'Select the evidence that directly supports this environmental factor.',
						mode: 'multiple',
						required: true,
						options: optionRows(evidence)
					}
				]
			};
		}
		case 'option': {
			const factors = await rows(
				`SELECT factor.public_id AS value, factor.title AS label,
				        EXISTS(SELECT 1 FROM strategy_option_factor_links link
				               JOIN strategy_options linked_option ON linked_option.id = link.strategy_option_id
				              WHERE linked_option.public_id = ? AND linked_option.organisation_id = ?
				                AND link.strategy_environment_factor_id = factor.id
				                AND link.relationship_type = 'responds_to') AS selected
				 FROM strategy_environment_factors factor
				 JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id
				 WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.lifecycle_status = 'active'
				 ORDER BY factor.title`,
				[record, org, org, strategy]
			);
			const assumptions = await rows(
				`SELECT assumption.public_id AS value, LEFT(assumption.statement_text, 160) AS label,
				        EXISTS(SELECT 1 FROM strategy_option_assumption_links link
				               JOIN strategy_options linked_option ON linked_option.id = link.strategy_option_id
				              WHERE linked_option.public_id = ? AND linked_option.organisation_id = ?
				                AND link.strategy_assumption_id = assumption.id
				                AND link.relationship_type = 'depends_on') AS selected
				 FROM strategy_assumptions assumption
				 JOIN strategy_frameworks framework ON framework.id = assumption.strategy_framework_id
				 WHERE assumption.organisation_id = ? AND framework.public_id = ? AND assumption.validation_status <> 'retired'
				 ORDER BY assumption.created_at DESC`,
				[record, org, org, strategy]
			);
			return {
				groups: [
					{
						key: 'factorPublicIds',
						label: 'Environmental drivers',
						description: 'Factors this option responds to.',
						mode: 'multiple',
						options: optionRows(factors)
					},
					{
						key: 'assumptionPublicIds',
						label: 'Assumption dependencies',
						description:
							'Assumptions this option depends on. At least one driver or assumption is required overall.',
						mode: 'multiple',
						options: optionRows(assumptions)
					}
				]
			};
		}
		case 'objective': {
			const options = await rows(
				`SELECT option_record.public_id AS value, option_record.title AS label,
				        EXISTS(SELECT 1 FROM strategy_objective_option_links link
				               JOIN strategy_objectives linked_objective ON linked_objective.id = link.strategy_objective_id
				              WHERE linked_objective.public_id = ? AND linked_objective.organisation_id = ?
				                AND link.strategy_option_id = option_record.id) AS selected
				 FROM strategy_options option_record
				 JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id
				 WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.decision_status = 'selected'
				 ORDER BY option_record.priority_rank, option_record.title`,
				[record, org, org, strategy]
			);
			const primaryThemes = await rows(
				`SELECT theme.public_id AS value, CONCAT(theme.theme_code, ' · ', theme.title) AS label,
				        EXISTS(SELECT 1 FROM strategy_objective_theme_links link
				               JOIN strategy_objectives linked_objective ON linked_objective.id = link.strategy_objective_id
				              WHERE linked_objective.public_id = ? AND linked_objective.organisation_id = ?
				                AND link.strategy_theme_id = theme.id AND link.relationship_type = 'primary') AS selected
				 FROM strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id
				 WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.lifecycle_status = 'active'
				 ORDER BY theme.priority_rank, theme.title`,
				[record, org, org, strategy]
			);
			const secondaryThemes = await rows(
				`SELECT theme.public_id AS value, CONCAT(theme.theme_code, ' · ', theme.title) AS label,
				        EXISTS(SELECT 1 FROM strategy_objective_theme_links link
				               JOIN strategy_objectives linked_objective ON linked_objective.id = link.strategy_objective_id
				              WHERE linked_objective.public_id = ? AND linked_objective.organisation_id = ?
				                AND link.strategy_theme_id = theme.id AND link.relationship_type = 'secondary') AS selected
				 FROM strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id
				 WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.lifecycle_status = 'active'
				 ORDER BY theme.priority_rank, theme.title`,
				[record, org, org, strategy]
			);
			const parents = await rows(
				`SELECT candidate.public_id AS value, CONCAT(candidate.objective_code, ' · ', candidate.title) AS label,
				        (candidate.id = objective.parent_strategy_objective_id) AS selected
				 FROM strategy_objectives objective
				 JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id
				 JOIN strategy_objectives candidate ON candidate.strategy_framework_id = objective.strategy_framework_id AND candidate.id <> objective.id
				 WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id = ?
				   AND candidate.lifecycle_status IN ('draft', 'active')
				 ORDER BY candidate.priority_rank, candidate.title`,
				[org, strategy, record]
			);
			return {
				groups: [
					{
						key: 'optionPublicIds',
						label: 'Selected-option lineage',
						description:
							'Every objective must remain traceable to at least one selected strategic option.',
						mode: 'multiple',
						required: true,
						options: optionRows(options)
					},
					{
						key: 'primaryThemePublicId',
						label: 'Primary strategic theme',
						description: 'The principal strategic theme accountable for this objective.',
						mode: 'single',
						required: true,
						options: optionRows(primaryThemes)
					},
					{
						key: 'secondaryThemePublicIds',
						label: 'Secondary themes',
						description: 'Optional additional themes supported by the objective.',
						mode: 'multiple',
						options: optionRows(secondaryThemes)
					},
					{
						key: 'parentObjectivePublicId',
						label: 'Parent objective',
						description: 'Optional explicit objective cascade. Cycles are rejected.',
						mode: 'single',
						options: optionRows(parents)
					}
				]
			};
		}
		case 'plan': {
			const primary = await rows(
				`SELECT objective.public_id AS value, CONCAT(objective.objective_code, ' · ', objective.title) AS label,
				        EXISTS(SELECT 1 FROM strategy_business_plan_objective_links link WHERE link.strategy_business_plan_id = plan.id AND link.strategy_objective_id = objective.id AND link.contribution_type = 'primary') AS selected
				 FROM strategy_business_plans plan
				 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
				 JOIN strategy_objectives objective ON objective.strategy_framework_id = framework.id
				 WHERE plan.organisation_id = ? AND framework.public_id = ? AND plan.public_id = ? AND objective.lifecycle_status = 'active'
				 ORDER BY objective.priority_rank, objective.title`,
				[org, strategy, record]
			);
			const supporting = await rows(
				`SELECT objective.public_id AS value, CONCAT(objective.objective_code, ' · ', objective.title) AS label,
				        EXISTS(SELECT 1 FROM strategy_business_plan_objective_links link WHERE link.strategy_business_plan_id = plan.id AND link.strategy_objective_id = objective.id AND link.contribution_type = 'supporting') AS selected
				 FROM strategy_business_plans plan
				 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
				 JOIN strategy_objectives objective ON objective.strategy_framework_id = framework.id
				 WHERE plan.organisation_id = ? AND framework.public_id = ? AND plan.public_id = ? AND objective.lifecycle_status = 'active'
				 ORDER BY objective.priority_rank, objective.title`,
				[org, strategy, record]
			);
			return {
				groups: [
					{
						key: 'primaryObjectivePublicId',
						label: 'Primary objective',
						description: 'The principal strategic objective funded by this plan.',
						mode: 'single',
						required: true,
						options: optionRows(primary)
					},
					{
						key: 'supportingObjectivePublicIds',
						label: 'Supporting objectives',
						description: 'Additional strategic objectives served by this plan.',
						mode: 'multiple',
						options: optionRows(supporting)
					}
				]
			};
		}
		case 'initiative': {
			const objectives = await rows(
				`SELECT objective.public_id AS value, CONCAT(objective.objective_code, ' · ', objective.title) AS label,
				        (objective.id = initiative.strategy_objective_id) AS selected
				 FROM strategy_initiatives initiative
				 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
				 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
				 JOIN strategy_business_plan_objective_links plan_link ON plan_link.strategy_business_plan_id = plan.id
				 JOIN strategy_objectives objective ON objective.id = plan_link.strategy_objective_id
				 WHERE initiative.organisation_id = ? AND framework.public_id = ? AND initiative.public_id = ? AND objective.lifecycle_status = 'active'
				 ORDER BY plan_link.contribution_type, objective.priority_rank, objective.title`,
				[org, strategy, record]
			);
			return {
				groups: [
					{
						key: 'objectivePublicId',
						label: 'Contributing objective',
						description:
							'The initiative must contribute to an objective already scoped into its governing business plan.',
						mode: 'single',
						required: true,
						options: optionRows(objectives)
					}
				]
			};
		}
		case 'kpi': {
			const initiatives = await rows(
				`SELECT initiative.public_id AS value, CONCAT(initiative.initiative_code, ' · ', initiative.title) AS label,
				        EXISTS(SELECT 1 FROM strategy_initiative_kpi_links link WHERE link.strategy_kpi_id = kpi.id AND link.strategy_initiative_id = initiative.id) AS selected
				 FROM strategy_kpis kpi
				 JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id
				 JOIN strategy_initiatives initiative ON initiative.strategy_objective_id = kpi.strategy_objective_id
				 JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id AND plan.strategy_framework_id = framework.id
				 WHERE kpi.organisation_id = ? AND framework.public_id = ? AND kpi.public_id = ?
				   AND plan.lifecycle_status <> 'superseded' AND initiative.lifecycle_status <> 'cancelled'
				 ORDER BY initiative.priority_rank, initiative.title`,
				[org, strategy, record]
			);
			return {
				groups: [
					{
						key: 'initiativePublicIds',
						label: 'Contributing initiatives',
						description:
							'Execution initiatives whose delivery contributes to this strategic measure.',
						mode: 'multiple',
						options: optionRows(initiatives)
					}
				]
			};
		}
		case 'decision': {
			const objectives = await rows(
				`SELECT objective.public_id AS value, CONCAT(objective.objective_code, ' · ', objective.title) AS label,
				        (objective.id = decision_record.strategy_objective_id) AS selected
				 FROM strategy_review_decisions decision_record
				 JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id
				 JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id
				 JOIN strategy_objectives objective ON objective.strategy_framework_id = framework.id
				 WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? AND objective.lifecycle_status <> 'retired'
				 ORDER BY objective.priority_rank, objective.title`,
				[org, strategy, record]
			);
			const initiatives = await rows(
				`SELECT initiative.public_id AS value, CONCAT(initiative.initiative_code, ' · ', initiative.title) AS label,
				        (initiative.id = decision_record.strategy_initiative_id) AS selected
				 FROM strategy_review_decisions decision_record
				 JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id
				 JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id
				 JOIN strategy_business_plans plan ON plan.strategy_framework_id = framework.id AND plan.lifecycle_status <> 'superseded'
				 JOIN strategy_initiatives initiative ON initiative.strategy_business_plan_id = plan.id
				 WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? AND initiative.lifecycle_status <> 'cancelled'
				 ORDER BY initiative.priority_rank, initiative.title`,
				[org, strategy, record]
			);
			const kpis = await rows(
				`SELECT kpi.public_id AS value, CONCAT(kpi.kpi_code, ' · ', kpi.title) AS label,
				        (kpi.id = decision_record.strategy_kpi_id) AS selected
				 FROM strategy_review_decisions decision_record
				 JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id
				 JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id
				 JOIN strategy_kpis kpi ON kpi.strategy_framework_id = framework.id
				 WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND decision_record.public_id = ? AND kpi.lifecycle_status NOT IN ('retired', 'superseded')
				 ORDER BY kpi.kpi_code, kpi.title`,
				[org, strategy, record]
			);
			return {
				groups: [
					{
						key: 'objectivePublicId',
						label: 'Affected objective',
						description: 'Optional strategic objective affected by this decision.',
						mode: 'single',
						options: optionRows(objectives)
					},
					{
						key: 'initiativePublicId',
						label: 'Affected initiative',
						description: 'Optional delivery initiative affected by this decision.',
						mode: 'single',
						options: optionRows(initiatives)
					},
					{
						key: 'kpiPublicId',
						label: 'Affected KPI',
						description: 'Optional strategic measure affected by this decision.',
						mode: 'single',
						options: optionRows(kpis)
					}
				]
			};
		}
	}
}

async function targetId(
	connection: PoolConnection,
	query: string,
	params: Array<string | number>
): Promise<string> {
	const [result] = await connection.execute<IdRow[]>(query, params);
	const row = result[0];
	if (!row)
		throw new StrategyValidationError(
			'The record is no longer mutable in its current lifecycle state.'
		);
	return row.id.toString();
}

async function candidateMap(
	connection: PoolConnection,
	query: string,
	params: Array<string | number>
): Promise<Map<string, string>> {
	const [result] = await connection.execute<IdRow[]>(query, params);
	return new Map(result.map((row) => [row.publicId, row.id.toString()]));
}

function selectedIds(input: Readonly<Record<string, readonly string[]>>, key: string): string[] {
	return normaliseRelationshipPublicIds(input[key] ?? []);
}

function one(input: Readonly<Record<string, readonly string[]>>, key: string): string | null {
	return selectedIds(input, key)[0] ?? null;
}

function mapSelections(values: string[], candidates: Map<string, string>, label: string): string[] {
	return values.map((value) => {
		const id = candidates.get(value);
		if (!id)
			throw new StrategyValidationError(
				`${label} contains a record outside the governing strategy context.`
			);
		return id;
	});
}

export async function updateF01Relationships(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	kind: F01ManagedRecordKind;
	recordPublicId: string;
	selections: Readonly<Record<string, readonly string[]>>;
}): Promise<void> {
	const kind = supportedKind(input.kind);
	if (!kind)
		throw new StrategyValidationError('This F01 record type has no editable association set.');
	const { framework, permissions } = await context({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		frameworkPublicId: input.frameworkPublicId
	});
	if (!permissions.canManage)
		throw new StrategyAccessError('You do not have authority to manage F01 associations.');
	if (!phaseAllows(kind, framework.lifecycleStatus)) {
		throw new StrategyValidationError(
			'Associations are immutable in the governing strategy lifecycle state. Create the appropriate controlled revision.'
		);
	}
	const status = await recordStatus({
		organisationId: input.actor.organisationId,
		frameworkPublicId: input.frameworkPublicId,
		kind,
		recordPublicId: input.recordPublicId
	});
	if (!relationshipStatusIsEditable(kind, status)) {
		throw new StrategyValidationError('Associations are immutable in this record lifecycle state.');
	}

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const org = input.actor.organisationId;
		const strategy = input.frameworkPublicId;
		const record = input.recordPublicId;

		switch (kind) {
			case 'factor': {
				const factorId = await targetId(
					connection,
					`SELECT factor.id, factor.public_id AS publicId FROM strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id WHERE factor.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'draft' AND factor.public_id = ? AND factor.lifecycle_status = 'active' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const chosen = selectedIds(input.selections, 'evidencePublicIds');
				if (chosen.length < 1)
					throw new StrategyValidationError(
						'An environmental factor must retain at least one supporting evidence item.'
					);
				const candidates = await candidateMap(
					connection,
					`SELECT evidence.id, evidence.public_id AS publicId FROM strategy_evidence_items evidence JOIN strategy_frameworks framework ON framework.id = evidence.strategy_framework_id WHERE evidence.organisation_id = ? AND framework.public_id = ? AND evidence.lifecycle_status = 'active'`,
					[org, strategy]
				);
				const evidenceIds = mapSelections(chosen, candidates, 'Supporting evidence');
				await connection.execute(
					`DELETE FROM strategy_environment_factor_evidence_links WHERE strategy_environment_factor_id = ? AND relationship_type = 'supports'`,
					[factorId]
				);
				for (const evidenceId of evidenceIds)
					await connection.execute(
						`INSERT INTO strategy_environment_factor_evidence_links (organisation_id, strategy_environment_factor_id, strategy_evidence_item_id, relationship_type, note_text, linked_by_member_id) VALUES (?, ?, ?, 'supports', NULL, ?)`,
						[org, factorId, evidenceId, input.actor.memberId]
					);
				break;
			}
			case 'option': {
				const optionId = await targetId(
					connection,
					`SELECT option_record.id, option_record.public_id AS publicId FROM strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id WHERE option_record.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'draft' AND option_record.public_id = ? AND option_record.decision_status = 'proposed' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const factorPublicIds = selectedIds(input.selections, 'factorPublicIds');
				const assumptionPublicIds = selectedIds(input.selections, 'assumptionPublicIds');
				if (factorPublicIds.length + assumptionPublicIds.length < 1)
					throw new StrategyValidationError(
						'A strategic option must retain at least one environmental driver or assumption dependency.'
					);
				const factors = await candidateMap(
					connection,
					`SELECT factor.id, factor.public_id AS publicId FROM strategy_environment_factors factor JOIN strategy_frameworks framework ON framework.id = factor.strategy_framework_id WHERE factor.organisation_id = ? AND framework.public_id = ? AND factor.lifecycle_status = 'active'`,
					[org, strategy]
				);
				const assumptions = await candidateMap(
					connection,
					`SELECT assumption.id, assumption.public_id AS publicId FROM strategy_assumptions assumption JOIN strategy_frameworks framework ON framework.id = assumption.strategy_framework_id WHERE assumption.organisation_id = ? AND framework.public_id = ? AND assumption.validation_status <> 'retired'`,
					[org, strategy]
				);
				const factorIds = mapSelections(factorPublicIds, factors, 'Environmental drivers');
				const assumptionIds = mapSelections(
					assumptionPublicIds,
					assumptions,
					'Assumption dependencies'
				);
				await connection.execute(
					`DELETE FROM strategy_option_factor_links WHERE strategy_option_id = ? AND relationship_type = 'responds_to'`,
					[optionId]
				);
				await connection.execute(
					`DELETE FROM strategy_option_assumption_links WHERE strategy_option_id = ? AND relationship_type = 'depends_on'`,
					[optionId]
				);
				for (const factorId of factorIds)
					await connection.execute(
						`INSERT INTO strategy_option_factor_links (organisation_id, strategy_option_id, strategy_environment_factor_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, 'responds_to', ?)`,
						[org, optionId, factorId, input.actor.memberId]
					);
				for (const assumptionId of assumptionIds)
					await connection.execute(
						`INSERT INTO strategy_option_assumption_links (organisation_id, strategy_option_id, strategy_assumption_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, 'depends_on', ?)`,
						[org, optionId, assumptionId, input.actor.memberId]
					);
				break;
			}
			case 'objective': {
				const objectiveId = await targetId(
					connection,
					`SELECT objective.id, objective.public_id AS publicId FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'draft' AND objective.public_id = ? AND objective.lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const optionPublicIds = selectedIds(input.selections, 'optionPublicIds');
				const primaryThemePublicId = one(input.selections, 'primaryThemePublicId');
				const secondaryThemePublicIds = selectedIds(
					input.selections,
					'secondaryThemePublicIds'
				).filter((value) => value !== primaryThemePublicId);
				const parentObjectivePublicId = one(input.selections, 'parentObjectivePublicId');
				if (optionPublicIds.length < 1)
					throw new StrategyValidationError(
						'An objective must retain lineage to at least one selected strategic option.'
					);
				if (!primaryThemePublicId)
					throw new StrategyValidationError('An objective must have one primary strategic theme.');
				const options = await candidateMap(
					connection,
					`SELECT option_record.id, option_record.public_id AS publicId FROM strategy_options option_record JOIN strategy_frameworks framework ON framework.id = option_record.strategy_framework_id WHERE option_record.organisation_id = ? AND framework.public_id = ? AND option_record.decision_status = 'selected'`,
					[org, strategy]
				);
				const themes = await candidateMap(
					connection,
					`SELECT theme.id, theme.public_id AS publicId FROM strategy_themes theme JOIN strategy_frameworks framework ON framework.id = theme.strategy_framework_id WHERE theme.organisation_id = ? AND framework.public_id = ? AND theme.lifecycle_status = 'active'`,
					[org, strategy]
				);
				const objectives = await candidateMap(
					connection,
					`SELECT objective.id, objective.public_id AS publicId FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.public_id <> ? AND objective.lifecycle_status IN ('draft','active')`,
					[org, strategy, record]
				);
				const optionIds = mapSelections(optionPublicIds, options, 'Selected-option lineage');
				const primaryThemeId = mapSelections([primaryThemePublicId], themes, 'Primary theme')[0];
				const secondaryThemeIds = mapSelections(
					secondaryThemePublicIds,
					themes,
					'Secondary themes'
				);
				const parentId = parentObjectivePublicId
					? mapSelections([parentObjectivePublicId], objectives, 'Parent objective')[0]
					: null;
				if (parentId) {
					const [cycleRows] = await connection.execute<CountRow[]>(
						`WITH RECURSIVE descendants AS (SELECT id FROM strategy_objectives WHERE parent_strategy_objective_id = ? UNION ALL SELECT child.id FROM strategy_objectives child JOIN descendants parent ON child.parent_strategy_objective_id = parent.id) SELECT COUNT(*) AS count FROM descendants WHERE id = ?`,
						[objectiveId, parentId]
					);
					if (Number(cycleRows[0]?.count ?? 0) > 0)
						throw new StrategyValidationError('Objective hierarchy cannot contain a cycle.');
				}
				await connection.execute(
					`UPDATE strategy_objectives SET parent_strategy_objective_id = ? WHERE id = ?`,
					[parentId, objectiveId]
				);
				await connection.execute(
					`DELETE FROM strategy_objective_option_links WHERE strategy_objective_id = ?`,
					[objectiveId]
				);
				await connection.execute(
					`DELETE FROM strategy_objective_theme_links WHERE strategy_objective_id = ?`,
					[objectiveId]
				);
				for (const optionId of optionIds)
					await connection.execute(
						`INSERT INTO strategy_objective_option_links (organisation_id, strategy_objective_id, strategy_option_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, 'derived_from', ?)`,
						[org, objectiveId, optionId, input.actor.memberId]
					);
				await connection.execute(
					`INSERT INTO strategy_objective_theme_links (organisation_id, strategy_objective_id, strategy_theme_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, 'primary', ?)`,
					[org, objectiveId, primaryThemeId, input.actor.memberId]
				);
				for (const themeId of secondaryThemeIds)
					await connection.execute(
						`INSERT INTO strategy_objective_theme_links (organisation_id, strategy_objective_id, strategy_theme_id, relationship_type, linked_by_member_id) VALUES (?, ?, ?, 'secondary', ?)`,
						[org, objectiveId, themeId, input.actor.memberId]
					);
				break;
			}
			case 'plan': {
				const planId = await targetId(
					connection,
					`SELECT plan.id, plan.public_id AS publicId FROM strategy_business_plans plan JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE plan.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'approved' AND plan.public_id = ? AND plan.lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const primaryPublicId = one(input.selections, 'primaryObjectivePublicId');
				const supportingPublicIds = selectedIds(
					input.selections,
					'supportingObjectivePublicIds'
				).filter((value) => value !== primaryPublicId);
				if (!primaryPublicId)
					throw new StrategyValidationError(
						'A business plan must retain one primary strategic objective.'
					);
				const objectives = await candidateMap(
					connection,
					`SELECT objective.id, objective.public_id AS publicId FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.lifecycle_status = 'active'`,
					[org, strategy]
				);
				const primaryId = mapSelections([primaryPublicId], objectives, 'Primary objective')[0];
				const supportingIds = mapSelections(
					supportingPublicIds,
					objectives,
					'Supporting objectives'
				);
				const selectedObjectiveIds = new Set([primaryId, ...supportingIds]);
				const [initiativeRows] = await connection.execute<IdRow[]>(
					`SELECT DISTINCT objective.id, objective.public_id AS publicId FROM strategy_initiatives initiative JOIN strategy_objectives objective ON objective.id = initiative.strategy_objective_id WHERE initiative.strategy_business_plan_id = ? AND initiative.lifecycle_status <> 'cancelled'`,
					[planId]
				);
				if (initiativeRows.some((row) => !selectedObjectiveIds.has(row.id.toString())))
					throw new StrategyValidationError(
						'The revised objective scope would orphan an existing initiative. Reassign or cancel the initiative first.'
					);
				await connection.execute(
					`DELETE FROM strategy_business_plan_objective_links WHERE strategy_business_plan_id = ?`,
					[planId]
				);
				await connection.execute(
					`INSERT INTO strategy_business_plan_objective_links (organisation_id, strategy_business_plan_id, strategy_objective_id, contribution_type, created_by_member_id) VALUES (?, ?, ?, 'primary', ?)`,
					[org, planId, primaryId, input.actor.memberId]
				);
				for (const objectiveId of supportingIds)
					await connection.execute(
						`INSERT INTO strategy_business_plan_objective_links (organisation_id, strategy_business_plan_id, strategy_objective_id, contribution_type, created_by_member_id) VALUES (?, ?, ?, 'supporting', ?)`,
						[org, planId, objectiveId, input.actor.memberId]
					);
				break;
			}
			case 'initiative': {
				const initiativeId = await targetId(
					connection,
					`SELECT initiative.id, initiative.public_id AS publicId FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE initiative.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'approved' AND initiative.public_id = ? AND initiative.lifecycle_status = 'proposed' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const objectivePublicId = one(input.selections, 'objectivePublicId');
				if (!objectivePublicId)
					throw new StrategyValidationError(
						'An initiative must remain associated with one plan-scoped objective.'
					);
				const candidates = await candidateMap(
					connection,
					`SELECT objective.id, objective.public_id AS publicId FROM strategy_initiatives initiative JOIN strategy_business_plan_objective_links link ON link.strategy_business_plan_id = initiative.strategy_business_plan_id JOIN strategy_objectives objective ON objective.id = link.strategy_objective_id WHERE initiative.organisation_id = ? AND initiative.public_id = ? AND objective.lifecycle_status = 'active'`,
					[org, record]
				);
				const objectiveId = mapSelections(
					[objectivePublicId],
					candidates,
					'Initiative objective'
				)[0];
				await connection.execute(
					`UPDATE strategy_initiatives SET strategy_objective_id = ? WHERE id = ?`,
					[objectiveId, initiativeId]
				);
				break;
			}
			case 'kpi': {
				const kpiId = await targetId(
					connection,
					`SELECT kpi.id, kpi.public_id AS publicId FROM strategy_kpis kpi JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'approved' AND kpi.public_id = ? AND kpi.lifecycle_status = 'draft' LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const initiativePublicIds = selectedIds(input.selections, 'initiativePublicIds');
				const candidates = await candidateMap(
					connection,
					`SELECT initiative.id, initiative.public_id AS publicId FROM strategy_kpis kpi JOIN strategy_initiatives initiative ON initiative.strategy_objective_id = kpi.strategy_objective_id JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id AND plan.strategy_framework_id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND kpi.public_id = ? AND plan.lifecycle_status <> 'superseded' AND initiative.lifecycle_status <> 'cancelled'`,
					[org, record]
				);
				const initiativeIds = mapSelections(
					initiativePublicIds,
					candidates,
					'Contributing initiatives'
				);
				await connection.execute(
					`DELETE FROM strategy_initiative_kpi_links WHERE strategy_kpi_id = ?`,
					[kpiId]
				);
				for (const initiativeId of initiativeIds)
					await connection.execute(
						`INSERT INTO strategy_initiative_kpi_links (organisation_id, strategy_initiative_id, strategy_kpi_id, contribution_type, created_by_member_id) VALUES (?, ?, ?, 'contributing', ?)`,
						[org, initiativeId, kpiId, input.actor.memberId]
					);
				break;
			}
			case 'decision': {
				const decisionId = await targetId(
					connection,
					`SELECT decision_record.id, decision_record.public_id AS publicId FROM strategy_review_decisions decision_record JOIN strategy_reviews review ON review.id = decision_record.strategy_review_id JOIN strategy_frameworks framework ON framework.id = review.strategy_framework_id WHERE decision_record.organisation_id = ? AND framework.public_id = ? AND framework.lifecycle_status = 'approved' AND decision_record.public_id = ? AND decision_record.lifecycle_status IN ('open','in_progress') LIMIT 1 FOR UPDATE`,
					[org, strategy, record]
				);
				const objectivePublicId = one(input.selections, 'objectivePublicId');
				const initiativePublicId = one(input.selections, 'initiativePublicId');
				const kpiPublicId = one(input.selections, 'kpiPublicId');
				const objectives = await candidateMap(
					connection,
					`SELECT objective.id, objective.public_id AS publicId FROM strategy_objectives objective JOIN strategy_frameworks framework ON framework.id = objective.strategy_framework_id WHERE objective.organisation_id = ? AND framework.public_id = ? AND objective.lifecycle_status <> 'retired'`,
					[org, strategy]
				);
				const initiatives = await candidateMap(
					connection,
					`SELECT initiative.id, initiative.public_id AS publicId FROM strategy_initiatives initiative JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id WHERE initiative.organisation_id = ? AND framework.public_id = ? AND plan.lifecycle_status <> 'superseded' AND initiative.lifecycle_status <> 'cancelled'`,
					[org, strategy]
				);
				const kpis = await candidateMap(
					connection,
					`SELECT kpi.id, kpi.public_id AS publicId FROM strategy_kpis kpi JOIN strategy_frameworks framework ON framework.id = kpi.strategy_framework_id WHERE kpi.organisation_id = ? AND framework.public_id = ? AND kpi.lifecycle_status NOT IN ('retired','superseded')`,
					[org, strategy]
				);
				const objectiveId = objectivePublicId
					? mapSelections([objectivePublicId], objectives, 'Affected objective')[0]
					: null;
				const initiativeId = initiativePublicId
					? mapSelections([initiativePublicId], initiatives, 'Affected initiative')[0]
					: null;
				const kpiId = kpiPublicId ? mapSelections([kpiPublicId], kpis, 'Affected KPI')[0] : null;
				await connection.execute(
					`UPDATE strategy_review_decisions SET strategy_objective_id = ?, strategy_initiative_id = ?, strategy_kpi_id = ? WHERE id = ?`,
					[objectiveId, initiativeId, kpiId, decisionId]
				);
				break;
			}
		}

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: `strategy.${kind}.relationships.update`,
			subjectType: `strategy_${kind}`,
			subjectPublicId: input.recordPublicId,
			changeSummary: { selections: input.selections },
			eventMetadata: { function: 'F01', mutation: 'relationships' }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
