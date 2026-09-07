import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	PerformanceForesightRepository,
	type StrategyKpiActionRecord,
	type StrategyKpiObservationRecord,
	type StrategyKpiRecord,
	type StrategyReviewKpiRecord,
	type StrategyReviewRecord,
	type StrategyScenarioAssumptionRecord,
	type StrategyScenarioKpiProjectionRecord,
	type StrategyScenarioRecord
} from './performance-foresight-repository';
import {
	StrategyRepository,
	type StrategyFrameworkRecord,
	type StrategyObjectiveRecord
} from './strategy-repository';

export class PerformanceForesightValidationError extends Error {
	readonly code = 'STRATEGY_PERFORMANCE_FORESIGHT_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'PerformanceForesightValidationError';
	}
}

export type PerformanceForesightWorkspace = {
	frameworks: StrategyFrameworkRecord[];
	selectedFramework: StrategyFrameworkRecord | null;
	objectives: StrategyObjectiveRecord[];
	kpis: StrategyKpiRecord[];
	observations: StrategyKpiObservationRecord[];
	actions: StrategyKpiActionRecord[];
	reviews: StrategyReviewRecord[];
	reviewKpis: StrategyReviewKpiRecord[];
	scenarios: StrategyScenarioRecord[];
	scenarioAssumptions: StrategyScenarioAssumptionRecord[];
	scenarioProjections: StrategyScenarioKpiProjectionRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type KpiInput = {
	frameworkPublicId: string;
	objectivePublicId: string;
	kpiCode: string;
	title: string;
	description: string;
	unitLabel: string;
	direction: 'higher_is_better' | 'lower_is_better' | 'target_is_best' | 'band';
	aggregationMethod: 'latest' | 'sum' | 'average' | 'minimum' | 'maximum' | 'ratio';
	baselineValue: string | number;
	targetValue: string | number;
	warningThreshold?: string | number | null;
	criticalThreshold?: string | number | null;
	targetDate?: string | Date | null;
	sourceMode: 'manual' | 'canonical';
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourceMeasureKey?: string | null;
	ownerMemberId: string;
};

export type KpiObservationInput = {
	kpiPublicId: string;
	observedOn: string | Date;
	actualValue: string | number;
	forecastValue?: string | number | null;
	commentary?: string | null;
	sourceMode: 'manual' | 'canonical';
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
	sourceMeasureKey?: string | null;
};

export type KpiActionInput = {
	kpiPublicId: string;
	observationPublicId?: string | null;
	actionCode: string;
	title: string;
	actionText: string;
	ownerMemberId: string;
	dueDate: string | Date;
};

export type StrategyReviewInput = {
	frameworkPublicId: string;
	reviewCode: string;
	reviewDate: string | Date;
	title: string;
	summary: string;
	decisionsText?: string | null;
};

export type StrategyScenarioInput = {
	frameworkPublicId: string;
	scenarioCode: string;
	title: string;
	scenarioType: 'baseline' | 'upside' | 'downside' | 'stress' | 'custom';
	horizonStart: string | Date;
	horizonEnd: string | Date;
	narrative: string;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
const SOURCE_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new PerformanceForesightValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) throw new PerformanceForesightValidationError(`Text must not exceed ${maximum} characters.`);
	return normalized;
}

function normalizedCode(value: string, label: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized)) throw new PerformanceForesightValidationError(`${label} has an invalid format.`);
	return normalized;
}

function sourceToken(value: string | null | undefined, label: string): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (!SOURCE_TOKEN.test(normalized)) throw new PerformanceForesightValidationError(`${label} has an invalid format.`);
	return normalized;
}

function decimal(value: string | number, label: string): string {
	const normalized = typeof value === 'number' ? String(value) : value.trim();
	if (!normalized || !Number.isFinite(Number(normalized))) throw new PerformanceForesightValidationError(`${label} must be a finite number.`);
	return normalized;
}

function optionalDecimal(value: string | number | null | undefined, label: string): string | null {
	if (value === null || value === undefined || value === '') return null;
	return decimal(value, label);
}

function dateOnly(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? value : new Date(`${value.trim()}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) throw new PerformanceForesightValidationError(`${label} is invalid.`);
	return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function optionalDateOnly(value: string | Date | null | undefined, label: string): Date | null {
	if (value === null || value === undefined || value === '') return null;
	return dateOnly(value, label);
}

function assertCanonicalSource(
	mode: 'manual' | 'canonical',
	parts: Record<string, string | null>
): void {
	if (mode !== 'canonical') return;
	if (Object.values(parts).some((value) => !value)) {
		throw new PerformanceForesightValidationError('Canonical source evidence requires domain, record and measure identifiers.');
	}
}

export class PerformanceForesightService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async permissionFlags(actor: TenantActorContext) {
		await this.assertActiveActor(actor);
		const permissions = new PermissionService(this.db);
		const [view, manage, approve] = await Promise.all([
			permissions.decide(actor, 'strategy.view'),
			permissions.decide(actor, 'strategy.manage'),
			permissions.decide(actor, 'strategy.approve')
		]);
		if (!view.allowed && !manage.allowed && !approve.allowed) throw new RecordNotFoundError('Strategy performance workspace not found in the active scope.');
		return { canManage: manage.allowed, canApprove: approve.allowed };
	}

	private async requirePermission(actor: TenantActorContext, permissionKey: 'strategy.manage' | 'strategy.approve'): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('Strategy performance action is not permitted.');
	}

	private async activeMember(db: DatabaseExecutor, organisationId: string, memberId: string, label: string): Promise<string> {
		const normalized = memberId.trim();
		const row = await db.selectFrom('organisation_members').select('id').where('organisation_id', '=', organisationId).where('id', '=', normalized).where('status', '=', 'active').executeTakeFirst();
		if (!row) throw new PerformanceForesightValidationError(`${label} must be an active organisation member.`);
		return row.id;
	}

	private async approvedFramework(db: DatabaseExecutor, organisationId: string, publicId: string): Promise<StrategyFrameworkRecord> {
		const framework = await new StrategyRepository(db).findFrameworkByPublicId(organisationId, publicId.trim());
		if (!framework) throw new RecordNotFoundError('Approved strategy framework not found.');
		if (framework.lifecycle_status !== 'approved') throw new PerformanceForesightValidationError('Performance management requires an approved strategy framework.');
		return framework;
	}

	private async appendEvidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>,
		subfunctions: string[]
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			actionKey,
			subjectType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary,
			eventMetadata: { function: 'F01', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F01', subfunctions }
		});
	}

	async getWorkspace(actor: TenantActorContext, selectedFrameworkPublicId?: string | null): Promise<PerformanceForesightWorkspace> {
		const flags = await this.permissionFlags(actor);
		const strategy = new StrategyRepository(this.db);
		const frameworks = (await strategy.listFrameworks(actor.organisationId)).filter((row) => row.lifecycle_status === 'approved');
		let selectedFramework = frameworks[0] ?? null;
		if (selectedFrameworkPublicId?.trim()) {
			selectedFramework = frameworks.find((row) => row.public_id === selectedFrameworkPublicId.trim()) ?? null;
			if (!selectedFramework) throw new RecordNotFoundError('Approved strategy framework not found.');
		}
		if (!selectedFramework) {
			return { frameworks, selectedFramework: null, objectives: [], kpis: [], observations: [], actions: [], reviews: [], reviewKpis: [], scenarios: [], scenarioAssumptions: [], scenarioProjections: [], ...flags };
		}
		const repository = new PerformanceForesightRepository(this.db);
		const [objectives, kpis, observations, actions, reviews, reviewKpis, scenarios, scenarioAssumptions, scenarioProjections] = await Promise.all([
			strategy.listObjectives(selectedFramework.id),
			repository.listKpis(selectedFramework.id),
			repository.listObservations(selectedFramework.id),
			repository.listActions(selectedFramework.id),
			repository.listReviews(selectedFramework.id),
			repository.listReviewKpis(selectedFramework.id),
			repository.listScenarios(selectedFramework.id),
			repository.listScenarioAssumptions(selectedFramework.id),
			repository.listScenarioProjections(selectedFramework.id)
		]);
		return { frameworks, selectedFramework, objectives, kpis, observations, actions, reviews, reviewKpis, scenarios, scenarioAssumptions, scenarioProjections, ...flags };
	}

	async createKpi(actor: TenantActorContext, input: KpiInput): Promise<StrategyKpiRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.approvedFramework(trx, actor.organisationId, input.frameworkPublicId);
			const objective = await trx.selectFrom('strategy_objectives').selectAll().where('organisation_id', '=', actor.organisationId).where('strategy_framework_id', '=', framework.id).where('public_id', '=', input.objectivePublicId.trim()).where('lifecycle_status', '=', 'active').executeTakeFirst();
			if (!objective) throw new RecordNotFoundError('Active strategy objective not found.');
			const repository = new PerformanceForesightRepository(trx);
			const kpiCode = normalizedCode(input.kpiCode, 'KPI code');
			if (await repository.findLatestKpiVersion(actor.organisationId, kpiCode)) throw new PerformanceForesightValidationError('A KPI with this code already exists; create a controlled revision instead.');
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'KPI owner');
			const sourceDomain = sourceToken(input.sourceDomain, 'Source domain');
			const sourceRecordType = sourceToken(input.sourceRecordType, 'Source record type');
			const sourceMeasureKey = sourceToken(input.sourceMeasureKey, 'Source measure key');
			assertCanonicalSource(input.sourceMode, { sourceDomain, sourceRecordType, sourceMeasureKey });
			const kpi = await repository.insertKpi({
				organisation_id: actor.organisationId,
				strategy_framework_id: framework.id,
				strategy_objective_id: objective.id,
				public_id: this.publicIdFactory(),
				kpi_code: kpiCode,
				version_number: 1,
				title: requiredText(input.title, 'KPI title', 255),
				description: requiredText(input.description, 'KPI description', 20_000),
				unit_label: requiredText(input.unitLabel, 'Unit', 64),
				direction: input.direction,
				aggregation_method: input.aggregationMethod,
				baseline_value: decimal(input.baselineValue, 'Baseline'),
				target_value: decimal(input.targetValue, 'Target'),
				warning_threshold: optionalDecimal(input.warningThreshold, 'Warning threshold'),
				critical_threshold: optionalDecimal(input.criticalThreshold, 'Critical threshold'),
				target_date: optionalDateOnly(input.targetDate, 'Target date'),
				source_mode: input.sourceMode,
				source_domain: sourceDomain,
				source_record_type: sourceRecordType,
				source_measure_key: sourceMeasureKey,
				owner_member_id: ownerMemberId,
				lifecycle_status: 'draft',
				supersedes_strategy_kpi_id: null,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await this.appendEvidence(trx, actor, 'strategy.kpi.create', 'strategy_kpi', kpi.public_id, { kpiCode, objectivePublicId: objective.public_id, sourceMode: input.sourceMode }, ['F01.06']);
			return kpi;
		});
	}

	async approveKpi(actor: TenantActorContext, kpiPublicId: string): Promise<StrategyKpiRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, kpiPublicId.trim());
			if (!kpi) throw new RecordNotFoundError('Strategy KPI not found.');
			if (kpi.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Only draft KPIs can be approved.');
			const approved = await repository.updateKpi(actor.organisationId, kpi.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: this.now() });
			await this.appendEvidence(trx, actor, 'strategy.kpi.approve', 'strategy_kpi', approved.public_id, { kpiCode: approved.kpi_code, versionNumber: approved.version_number }, ['F01.06']);
			return approved;
		});
	}

	async reviseKpi(actor: TenantActorContext, kpiPublicId: string): Promise<StrategyKpiRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, kpiPublicId.trim());
			if (!kpi) throw new RecordNotFoundError('Strategy KPI not found.');
			if (kpi.lifecycle_status !== 'approved') throw new PerformanceForesightValidationError('Only approved KPIs can start a controlled revision.');
			await repository.updateKpi(actor.organisationId, kpi.id, { lifecycle_status: 'superseded' });
			const revision = await repository.insertKpi({
				organisation_id: actor.organisationId, strategy_framework_id: kpi.strategy_framework_id, strategy_objective_id: kpi.strategy_objective_id,
				public_id: this.publicIdFactory(), kpi_code: kpi.kpi_code, version_number: kpi.version_number + 1, title: kpi.title, description: kpi.description,
				unit_label: kpi.unit_label, direction: kpi.direction, aggregation_method: kpi.aggregation_method, baseline_value: kpi.baseline_value, target_value: kpi.target_value,
				warning_threshold: kpi.warning_threshold, critical_threshold: kpi.critical_threshold, target_date: kpi.target_date, source_mode: kpi.source_mode,
				source_domain: kpi.source_domain, source_record_type: kpi.source_record_type, source_measure_key: kpi.source_measure_key, owner_member_id: kpi.owner_member_id,
				lifecycle_status: 'draft', supersedes_strategy_kpi_id: kpi.id, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null
			});
			await this.appendEvidence(trx, actor, 'strategy.kpi.revise', 'strategy_kpi', revision.public_id, { kpiCode: revision.kpi_code, versionNumber: revision.version_number, supersedesPublicId: kpi.public_id }, ['F01.06']);
			return revision;
		});
	}

	async recordObservation(actor: TenantActorContext, input: KpiObservationInput): Promise<StrategyKpiObservationRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved strategy KPI not found.');
			const sourceDomain = sourceToken(input.sourceDomain, 'Source domain');
			const sourceRecordType = sourceToken(input.sourceRecordType, 'Source record type');
			const sourcePublicId = sourceToken(input.sourcePublicId, 'Source public ID');
			const sourceMeasureKey = sourceToken(input.sourceMeasureKey, 'Source measure key');
			assertCanonicalSource(input.sourceMode, { sourceDomain, sourceRecordType, sourcePublicId, sourceMeasureKey });
			const observation = await repository.insertObservation({
				organisation_id: actor.organisationId, strategy_kpi_id: kpi.id, public_id: this.publicIdFactory(), observed_on: dateOnly(input.observedOn, 'Observed date'),
				actual_value: decimal(input.actualValue, 'Actual value'), forecast_value: optionalDecimal(input.forecastValue, 'Forecast value'), commentary: optionalText(input.commentary, 20_000),
				source_mode: input.sourceMode, source_domain: sourceDomain, source_record_type: sourceRecordType, source_public_id: sourcePublicId, source_measure_key: sourceMeasureKey,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'strategy.kpi.observe', 'strategy_kpi_observation', observation.public_id, { kpiPublicId: kpi.public_id, actualValue: observation.actual_value, forecastValue: observation.forecast_value, sourceMode: observation.source_mode }, ['F01.06', 'F01.07']);
			return observation;
		});
	}

	async createAction(actor: TenantActorContext, input: KpiActionInput): Promise<StrategyKpiActionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved strategy KPI not found.');
			let observationId: string | null = null;
			if (input.observationPublicId?.trim()) {
				const observation = await repository.findObservationByPublicId(actor.organisationId, input.observationPublicId.trim());
				if (!observation || observation.strategy_kpi_id !== kpi.id) throw new PerformanceForesightValidationError('Corrective-action observation must belong to the selected KPI.');
				observationId = observation.id;
			}
			const action = await repository.insertAction({
				organisation_id: actor.organisationId, strategy_kpi_id: kpi.id, strategy_kpi_observation_id: observationId, public_id: this.publicIdFactory(),
				action_code: normalizedCode(input.actionCode, 'Action code'), title: requiredText(input.title, 'Action title', 255), action_text: requiredText(input.actionText, 'Action', 20_000),
				owner_member_id: await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Action owner'), due_date: dateOnly(input.dueDate, 'Due date'), lifecycle_status: 'open',
				completion_note: null, completed_at: null, completed_by_member_id: null, created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'strategy.kpi.action.create', 'strategy_kpi_action', action.public_id, { kpiPublicId: kpi.public_id, actionCode: action.action_code, dueDate: action.due_date.toISOString().slice(0, 10) }, ['F01.06', 'F01.07']);
			return action;
		});
	}

	async completeAction(actor: TenantActorContext, actionPublicId: string, completionNote: string): Promise<StrategyKpiActionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const action = await repository.findActionByPublicId(actor.organisationId, actionPublicId.trim());
			if (!action) throw new RecordNotFoundError('Strategy corrective action not found.');
			if (!['open', 'in_progress'].includes(action.lifecycle_status)) throw new PerformanceForesightValidationError('Only open or in-progress actions can be completed.');
			const completed = await repository.updateAction(actor.organisationId, action.id, { lifecycle_status: 'completed', completion_note: requiredText(completionNote, 'Completion note', 20_000), completed_at: this.now(), completed_by_member_id: actor.memberId });
			await this.appendEvidence(trx, actor, 'strategy.kpi.action.complete', 'strategy_kpi_action', completed.public_id, { actionCode: completed.action_code, lifecycleStatus: 'completed' }, ['F01.06', 'F01.07']);
			return completed;
		});
	}

	async createReview(actor: TenantActorContext, input: StrategyReviewInput): Promise<StrategyReviewRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.approvedFramework(trx, actor.organisationId, input.frameworkPublicId);
			const review = await new PerformanceForesightRepository(trx).insertReview({
				organisation_id: actor.organisationId, strategy_framework_id: framework.id, public_id: this.publicIdFactory(), review_code: normalizedCode(input.reviewCode, 'Review code'),
				review_date: dateOnly(input.reviewDate, 'Review date'), title: requiredText(input.title, 'Review title', 255), summary: requiredText(input.summary, 'Review summary', 20_000), decisions_text: optionalText(input.decisionsText, 20_000),
				lifecycle_status: 'draft', created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null
			});
			await this.appendEvidence(trx, actor, 'strategy.review.create', 'strategy_review', review.public_id, { reviewCode: review.review_code, frameworkPublicId: framework.public_id }, ['F01.07']);
			return review;
		});
	}

	async addReviewKpi(actor: TenantActorContext, reviewPublicId: string, kpiPublicId: string, observationPublicId: string, assessment: 'on_track' | 'watch' | 'off_track' | 'not_measured', commentary?: string | null): Promise<StrategyReviewKpiRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const review = await repository.findReviewByPublicId(actor.organisationId, reviewPublicId.trim());
			if (!review) throw new RecordNotFoundError('Strategy review not found.');
			if (review.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Approved strategy reviews are immutable.');
			const kpi = await repository.findKpiByPublicId(actor.organisationId, kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved' || kpi.strategy_framework_id !== review.strategy_framework_id) throw new PerformanceForesightValidationError('Review KPI must be an approved KPI in the same strategy framework.');
			const observation = await repository.findObservationByPublicId(actor.organisationId, observationPublicId.trim());
			if (!observation || observation.strategy_kpi_id !== kpi.id) throw new PerformanceForesightValidationError('Review observation must belong to the selected KPI.');
			const actual = Number(observation.actual_value);
			const target = Number(kpi.target_value);
			const variance = actual - target;
			const snapshot = await repository.insertReviewKpi({
				organisation_id: actor.organisationId, strategy_review_id: review.id, strategy_kpi_id: kpi.id, strategy_kpi_observation_id: observation.id,
				actual_value_snapshot: observation.actual_value, target_value_snapshot: kpi.target_value, variance_value: String(variance), variance_percent: target === 0 ? null : String((variance / Math.abs(target)) * 100),
				assessment, commentary: optionalText(commentary, 20_000), created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'strategy.review.kpi.snapshot', 'strategy_review', review.public_id, { kpiPublicId: kpi.public_id, observationPublicId: observation.public_id, assessment, varianceValue: snapshot.variance_value }, ['F01.07']);
			return snapshot;
		});
	}

	async approveReview(actor: TenantActorContext, reviewPublicId: string): Promise<StrategyReviewRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const review = await repository.findReviewByPublicId(actor.organisationId, reviewPublicId.trim());
			if (!review) throw new RecordNotFoundError('Strategy review not found.');
			if (review.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Only draft strategy reviews can be approved.');
			if (!(await repository.listReviewKpisForReview(review.id)).length) throw new PerformanceForesightValidationError('A strategic review requires at least one KPI observation snapshot.');
			const approved = await repository.updateReview(actor.organisationId, review.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: this.now() });
			await this.appendEvidence(trx, actor, 'strategy.review.approve', 'strategy_review', approved.public_id, { reviewCode: approved.review_code, reviewDate: approved.review_date.toISOString().slice(0, 10) }, ['F01.07']);
			return approved;
		});
	}

	async createScenario(actor: TenantActorContext, input: StrategyScenarioInput): Promise<StrategyScenarioRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		const horizonStart = dateOnly(input.horizonStart, 'Scenario horizon start');
		const horizonEnd = dateOnly(input.horizonEnd, 'Scenario horizon end');
		if (horizonEnd < horizonStart) throw new PerformanceForesightValidationError('Scenario horizon end must not precede its start.');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.approvedFramework(trx, actor.organisationId, input.frameworkPublicId);
			const repository = new PerformanceForesightRepository(trx);
			const scenarioCode = normalizedCode(input.scenarioCode, 'Scenario code');
			if (await repository.findLatestScenarioVersion(actor.organisationId, scenarioCode)) throw new PerformanceForesightValidationError('A scenario with this code already exists; create a controlled revision instead.');
			const scenario = await repository.insertScenario({
				organisation_id: actor.organisationId, strategy_framework_id: framework.id, public_id: this.publicIdFactory(), scenario_code: scenarioCode, version_number: 1,
				title: requiredText(input.title, 'Scenario title', 255), scenario_type: input.scenarioType, horizon_start: horizonStart, horizon_end: horizonEnd, narrative: requiredText(input.narrative, 'Scenario narrative', 20_000),
				lifecycle_status: 'draft', supersedes_strategy_scenario_id: null, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null
			});
			await this.appendEvidence(trx, actor, 'strategy.scenario.create', 'strategy_scenario', scenario.public_id, { scenarioCode, scenarioType: scenario.scenario_type, frameworkPublicId: framework.public_id }, ['F01.08']);
			return scenario;
		});
	}

	async addScenarioAssumption(actor: TenantActorContext, scenarioPublicId: string, input: { assumptionCode: string; title: string; description: string; variableKey: string; unitLabel: string; baselineValue: string | number; scenarioValue: string | number; sensitivityPercent?: string | number | null }): Promise<StrategyScenarioAssumptionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const scenario = await repository.findScenarioByPublicId(actor.organisationId, scenarioPublicId.trim());
			if (!scenario) throw new RecordNotFoundError('Strategy scenario not found.');
			if (scenario.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Approved scenarios are immutable; create a controlled revision instead.');
			const sensitivity = optionalDecimal(input.sensitivityPercent, 'Sensitivity percent');
			if (sensitivity !== null && Number(sensitivity) < 0) throw new PerformanceForesightValidationError('Sensitivity percent must not be negative.');
			const assumption = await repository.insertScenarioAssumption({
				organisation_id: actor.organisationId, strategy_scenario_id: scenario.id, public_id: this.publicIdFactory(), assumption_code: normalizedCode(input.assumptionCode, 'Assumption code'),
				title: requiredText(input.title, 'Assumption title', 255), description: requiredText(input.description, 'Assumption description', 20_000), variable_key: sourceToken(input.variableKey, 'Variable key') ?? '', unit_label: requiredText(input.unitLabel, 'Unit', 64),
				baseline_value: decimal(input.baselineValue, 'Baseline value'), scenario_value: decimal(input.scenarioValue, 'Scenario value'), sensitivity_percent: sensitivity, created_by_member_id: actor.memberId
			});
			await this.appendEvidence(trx, actor, 'strategy.scenario.assumption.add', 'strategy_scenario', scenario.public_id, { assumptionCode: assumption.assumption_code, variableKey: assumption.variable_key }, ['F01.08']);
			return assumption;
		});
	}

	async addScenarioProjection(actor: TenantActorContext, scenarioPublicId: string, kpiPublicId: string, projectionDate: string | Date, projectedValue: string | number, rationale: string): Promise<StrategyScenarioKpiProjectionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const scenario = await repository.findScenarioByPublicId(actor.organisationId, scenarioPublicId.trim());
			if (!scenario) throw new RecordNotFoundError('Strategy scenario not found.');
			if (scenario.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Approved scenarios are immutable; create a controlled revision instead.');
			const kpi = await repository.findKpiByPublicId(actor.organisationId, kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved' || kpi.strategy_framework_id !== scenario.strategy_framework_id) throw new PerformanceForesightValidationError('Scenario projection KPI must be approved in the same strategy framework.');
			const date = dateOnly(projectionDate, 'Projection date');
			if (date < scenario.horizon_start || date > scenario.horizon_end) throw new PerformanceForesightValidationError('Projection date must sit inside the scenario horizon.');
			const projection = await repository.insertScenarioProjection({ organisation_id: actor.organisationId, strategy_scenario_id: scenario.id, strategy_kpi_id: kpi.id, public_id: this.publicIdFactory(), projection_date: date, projected_value: decimal(projectedValue, 'Projected value'), rationale: requiredText(rationale, 'Projection rationale', 20_000), created_by_member_id: actor.memberId });
			await this.appendEvidence(trx, actor, 'strategy.scenario.projection.add', 'strategy_scenario', scenario.public_id, { kpiPublicId: kpi.public_id, projectionDate: date.toISOString().slice(0, 10), projectedValue: projection.projected_value }, ['F01.08']);
			return projection;
		});
	}

	async approveScenario(actor: TenantActorContext, scenarioPublicId: string): Promise<StrategyScenarioRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const scenario = await repository.findScenarioByPublicId(actor.organisationId, scenarioPublicId.trim());
			if (!scenario) throw new RecordNotFoundError('Strategy scenario not found.');
			if (scenario.lifecycle_status !== 'draft') throw new PerformanceForesightValidationError('Only draft scenarios can be approved.');
			const [assumptions, projections] = await Promise.all([repository.listScenarioAssumptionsForScenario(scenario.id), repository.listScenarioProjectionsForScenario(scenario.id)]);
			if (!assumptions.length || !projections.length) throw new PerformanceForesightValidationError('Scenario approval requires at least one assumption and one KPI projection.');
			const approved = await repository.updateScenario(actor.organisationId, scenario.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: this.now() });
			await this.appendEvidence(trx, actor, 'strategy.scenario.approve', 'strategy_scenario', approved.public_id, { scenarioCode: approved.scenario_code, versionNumber: approved.version_number, assumptions: assumptions.length, projections: projections.length }, ['F01.08']);
			return approved;
		});
	}

	async reviseScenario(actor: TenantActorContext, scenarioPublicId: string): Promise<StrategyScenarioRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new PerformanceForesightRepository(trx);
			const scenario = await repository.findScenarioByPublicId(actor.organisationId, scenarioPublicId.trim());
			if (!scenario) throw new RecordNotFoundError('Strategy scenario not found.');
			if (scenario.lifecycle_status !== 'approved') throw new PerformanceForesightValidationError('Only approved scenarios can start a controlled revision.');
			const [assumptions, projections] = await Promise.all([repository.listScenarioAssumptionsForScenario(scenario.id), repository.listScenarioProjectionsForScenario(scenario.id)]);
			await repository.updateScenario(actor.organisationId, scenario.id, { lifecycle_status: 'superseded' });
			const revision = await repository.insertScenario({ organisation_id: actor.organisationId, strategy_framework_id: scenario.strategy_framework_id, public_id: this.publicIdFactory(), scenario_code: scenario.scenario_code, version_number: scenario.version_number + 1, title: scenario.title, scenario_type: scenario.scenario_type, horizon_start: scenario.horizon_start, horizon_end: scenario.horizon_end, narrative: scenario.narrative, lifecycle_status: 'draft', supersedes_strategy_scenario_id: scenario.id, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null });
			for (const assumption of assumptions) {
				await repository.insertScenarioAssumption({ organisation_id: actor.organisationId, strategy_scenario_id: revision.id, public_id: this.publicIdFactory(), assumption_code: assumption.assumption_code, title: assumption.title, description: assumption.description, variable_key: assumption.variable_key, unit_label: assumption.unit_label, baseline_value: assumption.baseline_value, scenario_value: assumption.scenario_value, sensitivity_percent: assumption.sensitivity_percent, created_by_member_id: actor.memberId });
			}
			for (const projection of projections) {
				await repository.insertScenarioProjection({ organisation_id: actor.organisationId, strategy_scenario_id: revision.id, strategy_kpi_id: projection.strategy_kpi_id, public_id: this.publicIdFactory(), projection_date: projection.projection_date, projected_value: projection.projected_value, rationale: projection.rationale, created_by_member_id: actor.memberId });
			}
			await this.appendEvidence(trx, actor, 'strategy.scenario.revise', 'strategy_scenario', revision.public_id, { scenarioCode: revision.scenario_code, versionNumber: revision.version_number, supersedesPublicId: scenario.public_id }, ['F01.08']);
			return revision;
		});
	}
}
