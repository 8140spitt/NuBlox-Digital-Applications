import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	EnterprisePerformanceRepository,
	type PerformanceActionRecord,
	type PerformanceBenchmarkRecord,
	type PerformanceBenchmarkResultRecord,
	type PerformanceBenefitMeasurementRecord,
	type PerformanceBenefitRecord,
	type PerformanceFrameworkKpiRecord,
	type PerformanceFrameworkRecord,
	type PerformanceKpiRecord,
	type PerformanceObservationRecord,
	type PerformancePackKpiRecord,
	type PerformancePackRecord,
	type PerformancePeriodRecord,
	type PerformanceReviewRecord,
	type PerformanceVarianceRecord
} from './enterprise-performance-repository';

export class EnterprisePerformanceValidationError extends Error {
	readonly code = 'ENTERPRISE_PERFORMANCE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'EnterprisePerformanceValidationError';
	}
}

export type EnterprisePerformanceWorkspace = {
	frameworks: PerformanceFrameworkRecord[];
	selectedFramework: PerformanceFrameworkRecord | null;
	frameworkKpis: PerformanceFrameworkKpiRecord[];
	kpis: PerformanceKpiRecord[];
	observations: PerformanceObservationRecord[];
	periods: PerformancePeriodRecord[];
	packs: PerformancePackRecord[];
	packKpis: PerformancePackKpiRecord[];
	variances: PerformanceVarianceRecord[];
	actions: PerformanceActionRecord[];
	reviews: PerformanceReviewRecord[];
	benchmarks: PerformanceBenchmarkRecord[];
	benchmarkResults: PerformanceBenchmarkResultRecord[];
	benefits: PerformanceBenefitRecord[];
	benefitMeasurements: PerformanceBenefitMeasurementRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type PerformanceFrameworkInput = {
	frameworkCode: string;
	title: string;
	purposeText: string;
	reportingCadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
	scopeText: string;
	ownerMemberId: string;
	effectiveFrom: string | Date;
	effectiveTo?: string | Date | null;
};

export type FrameworkKpiInput = {
	frameworkPublicId: string;
	kpiPublicId: string;
	displayOrder?: number | string;
	materialityThresholdPercent?: number | string | null;
	commentaryRequired?: boolean;
};

export type PerformancePeriodInput = {
	frameworkPublicId: string;
	periodCode: string;
	title: string;
	periodStart: string | Date;
	periodEnd: string | Date;
	reportingDate: string | Date;
};

export type PerformancePackInput = {
	periodPublicId: string;
	packCode: string;
	title: string;
	executiveSummary: string;
};

export type VarianceInput = {
	packKpiId: string;
	varianceCode: string;
	materiality: 'low' | 'medium' | 'high' | 'critical';
	causeCategory: 'volume' | 'price' | 'productivity' | 'timing' | 'scope' | 'quality' | 'external' | 'forecast' | 'other';
	rootCauseText: string;
	impactText: string;
	ownerMemberId: string;
};

export type CorrectiveActionInput = {
	variancePublicId: string;
	actionCode: string;
	title: string;
	actionText: string;
	ownerMemberId: string;
	dueDate: string | Date;
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
};

export type PerformanceReviewInput = {
	packPublicId: string;
	reviewCode: string;
	reviewDate: string | Date;
	title: string;
	summary: string;
	decisionText?: string | null;
	governanceMeetingPublicId?: string | null;
	governanceDecisionPublicId?: string | null;
};

export type BenchmarkInput = {
	kpiPublicId: string;
	benchmarkCode: string;
	benchmarkType: 'internal' | 'external' | 'peer' | 'industry' | 'target';
	title: string;
	scopeText: string;
	unitLabel: string;
	periodStart: string | Date;
	periodEnd: string | Date;
	benchmarkValue: number | string;
	provenanceText: string;
	sourceReference?: string | null;
};

export type BenefitInput = {
	kpiPublicId: string;
	benefitCode: string;
	title: string;
	benefitType: 'financial' | 'operational' | 'customer' | 'people' | 'risk' | 'sustainability' | 'other';
	unitLabel: string;
	baselineValue: number | string;
	targetValue: number | string;
	targetDate: string | Date;
	ownerMemberId: string;
	reviewCadence: 'weekly' | 'monthly' | 'quarterly' | 'annual';
	sourceDomain: string;
	sourceRecordType: string;
	sourcePublicId: string;
};

export type BenefitMeasurementInput = {
	benefitPublicId: string;
	measuredOn: string | Date;
	realisedValue: number | string;
	confidencePercent: number | string;
	evidenceText: string;
	sourceDomain?: string | null;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
const TOKEN = /^[a-z0-9][a-z0-9_.:-]{1,127}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum)
		throw new EnterprisePerformanceValidationError(`${label} must be between 1 and ${maximum} characters.`);
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum)
		throw new EnterprisePerformanceValidationError(`Text must not exceed ${maximum} characters.`);
	return normalized;
}

function coded(value: string, label: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized)) throw new EnterprisePerformanceValidationError(`${label} has an invalid format.`);
	return normalized;
}

function token(value: string | null | undefined, label: string, required = false): string | null {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!normalized) {
		if (required) throw new EnterprisePerformanceValidationError(`${label} is required.`);
		return null;
	}
	if (!TOKEN.test(normalized)) throw new EnterprisePerformanceValidationError(`${label} has an invalid format.`);
	return normalized;
}

function dateOnly(value: string | Date, label: string): Date {
	const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new EnterprisePerformanceValidationError(`${label} is invalid.`);
	return date;
}

function optionalDateOnly(value: string | Date | null | undefined, label: string): Date | null {
	if (value === null || value === undefined || value === '') return null;
	return dateOnly(value, label);
}

function decimal(value: number | string, label: string): string {
	const normalized = String(value).trim();
	if (!normalized || !Number.isFinite(Number(normalized)))
		throw new EnterprisePerformanceValidationError(`${label} must be numeric.`);
	return normalized;
}

function optionalDecimal(value: number | string | null | undefined, label: string): string | null {
	if (value === null || value === undefined || value === '') return null;
	return decimal(value, label);
}

function positiveInteger(value: number | string | undefined, fallback = 1): number {
	if (value === undefined || value === '') return fallback;
	const result = Number(value);
	if (!Number.isInteger(result) || result < 1)
		throw new EnterprisePerformanceValidationError('Display order must be a positive integer.');
	return result;
}

function variance(target: string, actual: string): { value: string; percent: string | null } {
	const targetNumber = Number(target);
	const actualNumber = Number(actual);
	const value = actualNumber - targetNumber;
	return {
		value: value.toString(),
		percent: targetNumber === 0 ? null : ((value / Math.abs(targetNumber)) * 100).toString()
	};
}

function assess(
	kpi: PerformanceKpiRecord,
	actualValue: string,
	materialityThresholdPercent: string | null
): 'on_track' | 'watch' | 'off_track' {
	const actual = Number(actualValue);
	const target = Number(kpi.target_value);
	const warning = kpi.warning_threshold === null ? null : Number(kpi.warning_threshold);
	const critical = kpi.critical_threshold === null ? null : Number(kpi.critical_threshold);
	if (kpi.direction === 'higher_is_better') {
		if (actual >= target) return 'on_track';
		if (warning !== null && actual >= warning) return 'watch';
		if (critical !== null && actual >= critical) return 'watch';
		return 'off_track';
	}
	if (kpi.direction === 'lower_is_better') {
		if (actual <= target) return 'on_track';
		if (warning !== null && actual <= warning) return 'watch';
		if (critical !== null && actual <= critical) return 'watch';
		return 'off_track';
	}
	const threshold = materialityThresholdPercent === null ? 5 : Number(materialityThresholdPercent);
	const deviation = target === 0 ? Math.abs(actual - target) : (Math.abs(actual - target) / Math.abs(target)) * 100;
	if (deviation <= threshold) return 'on_track';
	if (deviation <= threshold * 2) return 'watch';
	return 'off_track';
}

export class EnterprisePerformanceService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async requirePermission(actor: TenantActorContext, permissionKey: 'strategy.view' | 'strategy.manage' | 'strategy.approve'): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('Enterprise performance action is not permitted.');
	}

	private async permissionFlags(actor: TenantActorContext) {
		await this.requirePermission(actor, 'strategy.view');
		const permissions = new PermissionService(this.db);
		const [manage, approve] = await Promise.all([
			permissions.decide(actor, 'strategy.manage'),
			permissions.decide(actor, 'strategy.approve')
		]);
		return { canManage: manage.allowed, canApprove: approve.allowed };
	}

	private async activeMember(db: DatabaseExecutor, organisationId: string, memberId: string, label: string): Promise<string> {
		const row = await db.selectFrom('organisation_members').select('id').where('organisation_id', '=', organisationId).where('id', '=', memberId.trim()).where('status', '=', 'active').executeTakeFirst();
		if (!row) throw new EnterprisePerformanceValidationError(`${label} must be an active organisation member.`);
		return row.id;
	}

	private async evidence(
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
			eventMetadata: { function: 'F03', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F03', subfunctions }
		});
	}

	async getWorkspace(actor: TenantActorContext, selectedFrameworkPublicId?: string | null): Promise<EnterprisePerformanceWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new EnterprisePerformanceRepository(this.db);
		const frameworks = await repository.listFrameworks(actor.organisationId);
		let selectedFramework: PerformanceFrameworkRecord | null = frameworks.find((row) => row.lifecycle_status === 'approved') ?? frameworks[0] ?? null;
		if (selectedFrameworkPublicId?.trim()) {
			selectedFramework = frameworks.find((row) => row.public_id === selectedFrameworkPublicId.trim()) ?? null;
			if (!selectedFramework) throw new RecordNotFoundError('Performance framework not found.');
		}
		const kpis = await repository.listApprovedKpis(actor.organisationId);
		if (!selectedFramework) {
			return { frameworks, selectedFramework: null, frameworkKpis: [], kpis, observations: [], periods: [], packs: [], packKpis: [], variances: [], actions: [], reviews: [], benchmarks: await repository.listBenchmarks(actor.organisationId), benchmarkResults: await repository.listBenchmarkResults(actor.organisationId), benefits: await repository.listBenefits(actor.organisationId), benefitMeasurements: await repository.listBenefitMeasurements(actor.organisationId), ...flags };
		}
		const frameworkKpis = await repository.listFrameworkKpis(selectedFramework.id);
		const selectedKpiIds = new Set(frameworkKpis.map((row) => row.strategy_kpi_id));
		const observations = (await Promise.all(kpis.filter((row) => selectedKpiIds.has(row.id)).map((row) => repository.listObservationsForKpi(row.id)))).flat();
		const periods = await repository.listPeriods(selectedFramework.id);
		const packs = await repository.listPacks(periods.map((row) => row.id));
		return {
			frameworks,
			selectedFramework,
			frameworkKpis,
			kpis,
			observations,
			periods,
			packs,
			packKpis: await repository.listPackKpis(packs.map((row) => row.id)),
			variances: await repository.listVariances(actor.organisationId),
			actions: await repository.listActions(actor.organisationId),
			reviews: await repository.listReviews(actor.organisationId),
			benchmarks: await repository.listBenchmarks(actor.organisationId),
			benchmarkResults: await repository.listBenchmarkResults(actor.organisationId),
			benefits: await repository.listBenefits(actor.organisationId),
			benefitMeasurements: await repository.listBenefitMeasurements(actor.organisationId),
			...flags
		};
	}

	async createFramework(actor: TenantActorContext, input: PerformanceFrameworkInput): Promise<PerformanceFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const code = coded(input.frameworkCode, 'Framework code');
			if (await repository.findLatestFrameworkVersion(actor.organisationId, code))
				throw new EnterprisePerformanceValidationError('A performance framework with this code already exists; create a controlled revision instead.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Framework owner');
			const effectiveFrom = dateOnly(input.effectiveFrom, 'Effective from');
			const effectiveTo = optionalDateOnly(input.effectiveTo, 'Effective to');
			if (effectiveTo && effectiveTo < effectiveFrom) throw new EnterprisePerformanceValidationError('Effective to must not precede effective from.');
			const row = await repository.insertFramework({
				organisation_id: actor.organisationId,
				public_id: this.publicIdFactory(),
				framework_code: code,
				version_number: 1,
				title: requiredText(input.title, 'Framework title', 255),
				purpose_text: requiredText(input.purposeText, 'Purpose', 20_000),
				reporting_cadence: input.reportingCadence,
				scope_text: requiredText(input.scopeText, 'Scope', 20_000),
				owner_member_id: owner,
				lifecycle_status: 'draft',
				effective_from: effectiveFrom,
				effective_to: effectiveTo,
				supersedes_performance_framework_id: null,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await this.evidence(trx, actor, 'performance.framework.create', 'strategy_performance_framework', row.public_id, { frameworkCode: row.framework_code, versionNumber: row.version_number }, ['F03.01']);
			return row;
		});
	}

	async createFrameworkRevision(actor: TenantActorContext, frameworkPublicId: string): Promise<PerformanceFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const source = await repository.findFrameworkByPublicId(actor.organisationId, frameworkPublicId.trim());
			if (!source) throw new RecordNotFoundError('Performance framework not found.');
			if (source.lifecycle_status !== 'approved') throw new EnterprisePerformanceValidationError('Only an approved framework can be revised.');
			const latest = await repository.findLatestFrameworkVersion(actor.organisationId, source.framework_code);
			if (!latest || latest.id !== source.id) throw new EnterprisePerformanceValidationError('Only the latest approved framework version can be revised.');
			const revision = await repository.insertFramework({
				organisation_id: actor.organisationId, public_id: this.publicIdFactory(), framework_code: source.framework_code, version_number: source.version_number + 1,
				title: source.title, purpose_text: source.purpose_text, reporting_cadence: source.reporting_cadence, scope_text: source.scope_text,
				owner_member_id: source.owner_member_id, lifecycle_status: 'draft', effective_from: source.effective_from, effective_to: source.effective_to,
				supersedes_performance_framework_id: source.id, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null
			});
			for (const link of await repository.listFrameworkKpis(source.id)) {
				await repository.insertFrameworkKpi({ organisation_id: actor.organisationId, performance_framework_id: revision.id, strategy_kpi_id: link.strategy_kpi_id, display_order: link.display_order, materiality_threshold_percent: link.materiality_threshold_percent, commentary_required: link.commentary_required, created_by_member_id: actor.memberId });
			}
			await this.evidence(trx, actor, 'performance.framework.revise', 'strategy_performance_framework', revision.public_id, { frameworkCode: revision.framework_code, versionNumber: revision.version_number, supersedesPublicId: source.public_id }, ['F03.01']);
			return revision;
		});
	}

	async addFrameworkKpi(actor: TenantActorContext, input: FrameworkKpiInput): Promise<PerformanceFrameworkKpiRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const framework = await repository.findFrameworkByPublicId(actor.organisationId, input.frameworkPublicId.trim());
			if (!framework) throw new RecordNotFoundError('Performance framework not found.');
			if (framework.lifecycle_status !== 'draft') throw new EnterprisePerformanceValidationError('KPIs can only be composed into a draft performance framework.');
			const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved canonical KPI not found.');
			const link = await repository.insertFrameworkKpi({
				organisation_id: actor.organisationId,
				performance_framework_id: framework.id,
				strategy_kpi_id: kpi.id,
				display_order: positiveInteger(input.displayOrder),
				materiality_threshold_percent: optionalDecimal(input.materialityThresholdPercent, 'Materiality threshold'),
				commentary_required: input.commentaryRequired ? 1 : 0,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'performance.framework.kpi.add', 'strategy_performance_framework', framework.public_id, { kpiPublicId: kpi.public_id, kpiCode: kpi.kpi_code }, ['F03.01']);
			return link;
		});
	}

	async approveFramework(actor: TenantActorContext, frameworkPublicId: string): Promise<PerformanceFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const framework = await repository.findFrameworkByPublicId(actor.organisationId, frameworkPublicId.trim());
			if (!framework) throw new RecordNotFoundError('Performance framework not found.');
			if (framework.lifecycle_status !== 'draft') throw new EnterprisePerformanceValidationError('Only a draft performance framework can be approved.');
			if ((await repository.listFrameworkKpis(framework.id)).length === 0) throw new EnterprisePerformanceValidationError('A performance framework requires at least one approved canonical KPI.');
			if (framework.supersedes_performance_framework_id) {
				await repository.updateFramework(actor.organisationId, framework.supersedes_performance_framework_id, { lifecycle_status: 'superseded' });
			}
			const approved = await repository.updateFramework(actor.organisationId, framework.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'performance.framework.approve', 'strategy_performance_framework', approved.public_id, { frameworkCode: approved.framework_code, versionNumber: approved.version_number }, ['F03.01']);
			return approved;
		});
	}

	async createPeriod(actor: TenantActorContext, input: PerformancePeriodInput): Promise<PerformancePeriodRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const framework = await repository.findFrameworkByPublicId(actor.organisationId, input.frameworkPublicId.trim());
			if (!framework || framework.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved performance framework not found.');
			const start = dateOnly(input.periodStart, 'Period start');
			const end = dateOnly(input.periodEnd, 'Period end');
			const reportingDate = dateOnly(input.reportingDate, 'Reporting date');
			if (end < start || reportingDate < end) throw new EnterprisePerformanceValidationError('Reporting period dates are invalid.');
			const row = await repository.insertPeriod({ organisation_id: actor.organisationId, performance_framework_id: framework.id, public_id: this.publicIdFactory(), period_code: coded(input.periodCode, 'Period code'), title: requiredText(input.title, 'Period title', 255), period_start: start, period_end: end, reporting_date: reportingDate, lifecycle_status: 'open', created_by_member_id: actor.memberId, closed_by_member_id: null, closed_at: null });
			await this.evidence(trx, actor, 'performance.period.create', 'strategy_performance_period', row.public_id, { periodCode: row.period_code }, ['F03.02']);
			return row;
		});
	}

	async createPack(actor: TenantActorContext, input: PerformancePackInput): Promise<PerformancePackRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const period = await repository.findPeriodByPublicId(actor.organisationId, input.periodPublicId.trim());
			if (!period || period.lifecycle_status === 'closed') throw new RecordNotFoundError('Open performance period not found.');
			const framework = await trx.selectFrom('strategy_performance_frameworks').selectAll().where('organisation_id', '=', actor.organisationId).where('id', '=', period.performance_framework_id).executeTakeFirst();
			if (!framework || framework.lifecycle_status !== 'approved') throw new EnterprisePerformanceValidationError('Performance packs require an approved performance framework.');
			const links = await repository.listFrameworkKpis(framework.id);
			if (!links.length) throw new EnterprisePerformanceValidationError('Performance framework contains no KPIs.');
			const pack = await repository.insertPack({ organisation_id: actor.organisationId, performance_period_id: period.id, public_id: this.publicIdFactory(), pack_code: coded(input.packCode, 'Pack code'), version_number: 1, title: requiredText(input.title, 'Pack title', 255), executive_summary: requiredText(input.executiveSummary, 'Executive summary', 20_000), lifecycle_status: 'draft', supersedes_performance_pack_id: null, created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null });
			for (const link of links) {
				const kpi = await trx.selectFrom('strategy_kpis').selectAll().where('organisation_id', '=', actor.organisationId).where('id', '=', link.strategy_kpi_id).where('lifecycle_status', '=', 'approved').executeTakeFirst();
				if (!kpi) throw new EnterprisePerformanceValidationError('Framework references a KPI that is no longer approved.');
				const observation = await trx.selectFrom('strategy_kpi_observations').selectAll().where('organisation_id', '=', actor.organisationId).where('strategy_kpi_id', '=', kpi.id).where('observed_on', '<=', period.period_end).orderBy('observed_on', 'desc').orderBy('created_at', 'desc').executeTakeFirst();
				if (!observation) throw new EnterprisePerformanceValidationError(`KPI ${kpi.kpi_code} has no authoritative observation for the reporting period.`);
				const delta = variance(kpi.target_value, observation.actual_value);
				await repository.insertPackKpi({ organisation_id: actor.organisationId, performance_pack_id: pack.id, strategy_kpi_id: kpi.id, strategy_kpi_observation_id: observation.id, target_value_snapshot: kpi.target_value, actual_value_snapshot: observation.actual_value, forecast_value_snapshot: observation.forecast_value, variance_value: delta.value, variance_percent: delta.percent, assessment: assess(kpi, observation.actual_value, link.materiality_threshold_percent), commentary: observation.commentary, source_domain: observation.source_domain, source_record_type: observation.source_record_type, source_public_id: observation.source_public_id, created_by_member_id: actor.memberId });
			}
			await repository.updatePeriod(actor.organisationId, period.id, { lifecycle_status: 'reported' });
			await this.evidence(trx, actor, 'performance.pack.create', 'strategy_performance_pack', pack.public_id, { packCode: pack.pack_code, periodPublicId: period.public_id, kpiCount: links.length }, ['F03.02']);
			return pack;
		});
	}

	async approvePack(actor: TenantActorContext, packPublicId: string): Promise<PerformancePackRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const pack = await repository.findPackByPublicId(actor.organisationId, packPublicId.trim());
			if (!pack) throw new RecordNotFoundError('Performance pack not found.');
			if (pack.lifecycle_status !== 'draft') throw new EnterprisePerformanceValidationError('Only a draft performance pack can be approved.');
			const approved = await repository.updatePack(actor.organisationId, pack.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'performance.pack.approve', 'strategy_performance_pack', approved.public_id, { packCode: approved.pack_code }, ['F03.02']);
			return approved;
		});
	}

	async createVariance(actor: TenantActorContext, input: VarianceInput): Promise<PerformanceVarianceRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const packKpi = await trx.selectFrom('strategy_performance_pack_kpis').selectAll().where('organisation_id', '=', actor.organisationId).where('id', '=', input.packKpiId.trim()).executeTakeFirst();
			if (!packKpi) throw new RecordNotFoundError('Performance pack KPI not found.');
			if (packKpi.assessment === 'on_track') throw new EnterprisePerformanceValidationError('An on-track KPI does not require a variance case.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Variance owner');
			const repository = new EnterprisePerformanceRepository(trx);
			const row = await repository.insertVariance({ organisation_id: actor.organisationId, performance_pack_kpi_id: packKpi.id, public_id: this.publicIdFactory(), variance_code: coded(input.varianceCode, 'Variance code'), materiality: input.materiality, cause_category: input.causeCategory, root_cause_text: requiredText(input.rootCauseText, 'Root cause', 20_000), impact_text: requiredText(input.impactText, 'Impact', 20_000), owner_member_id: owner, lifecycle_status: 'open', resolution_text: null, closed_by_member_id: null, closed_at: null, created_by_member_id: actor.memberId });
			await this.evidence(trx, actor, 'performance.variance.create', 'strategy_performance_variance', row.public_id, { varianceCode: row.variance_code, assessment: packKpi.assessment }, ['F03.03']);
			return row;
		});
	}

	async createCorrectiveAction(actor: TenantActorContext, input: CorrectiveActionInput): Promise<PerformanceActionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const varianceRow = await repository.findVarianceByPublicId(actor.organisationId, input.variancePublicId.trim());
			if (!varianceRow || varianceRow.lifecycle_status === 'closed') throw new RecordNotFoundError('Open performance variance not found.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Action owner');
			const row = await repository.insertAction({ organisation_id: actor.organisationId, performance_variance_id: varianceRow.id, public_id: this.publicIdFactory(), action_code: coded(input.actionCode, 'Action code'), title: requiredText(input.title, 'Action title', 255), action_text: requiredText(input.actionText, 'Action', 20_000), owner_member_id: owner, due_date: dateOnly(input.dueDate, 'Due date'), lifecycle_status: 'open', source_domain: token(input.sourceDomain, 'Source domain'), source_record_type: token(input.sourceRecordType, 'Source record type'), source_public_id: optionalText(input.sourcePublicId, 128), completion_evidence: null, completed_by_member_id: null, completed_at: null, created_by_member_id: actor.memberId });
			await repository.updateVariance(actor.organisationId, varianceRow.id, { lifecycle_status: 'actioned' });
			await this.evidence(trx, actor, 'performance.action.create', 'strategy_performance_action', row.public_id, { actionCode: row.action_code, variancePublicId: varianceRow.public_id }, ['F03.03']);
			return row;
		});
	}

	async completeCorrectiveAction(actor: TenantActorContext, actionPublicId: string, completionEvidence: string): Promise<PerformanceActionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const action = await repository.findActionByPublicId(actor.organisationId, actionPublicId.trim());
			if (!action) throw new RecordNotFoundError('Performance action not found.');
			if (action.lifecycle_status === 'completed') throw new EnterprisePerformanceValidationError('Performance action is already completed.');
			const completed = await repository.updateAction(actor.organisationId, action.id, { lifecycle_status: 'completed', completion_evidence: requiredText(completionEvidence, 'Completion evidence', 20_000), completed_by_member_id: actor.memberId, completed_at: new Date() });
			await this.evidence(trx, actor, 'performance.action.complete', 'strategy_performance_action', completed.public_id, { actionCode: completed.action_code }, ['F03.03']);
			return completed;
		});
	}

	async closeVariance(actor: TenantActorContext, variancePublicId: string, resolutionText: string): Promise<PerformanceVarianceRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const row = await repository.findVarianceByPublicId(actor.organisationId, variancePublicId.trim());
			if (!row) throw new RecordNotFoundError('Performance variance not found.');
			const openActions = (await repository.listActions(actor.organisationId)).filter((action) => action.performance_variance_id === row.id && !['completed','cancelled'].includes(action.lifecycle_status));
			if (openActions.length) throw new EnterprisePerformanceValidationError('Complete or cancel all corrective actions before closing the variance.');
			const closed = await repository.updateVariance(actor.organisationId, row.id, { lifecycle_status: 'closed', resolution_text: requiredText(resolutionText, 'Resolution', 20_000), closed_by_member_id: actor.memberId, closed_at: new Date() });
			await this.evidence(trx, actor, 'performance.variance.close', 'strategy_performance_variance', closed.public_id, { varianceCode: closed.variance_code }, ['F03.03']);
			return closed;
		});
	}

	async createReview(actor: TenantActorContext, input: PerformanceReviewInput): Promise<PerformanceReviewRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const pack = await repository.findPackByPublicId(actor.organisationId, input.packPublicId.trim());
			if (!pack || pack.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved performance pack not found.');
			const meetingPublicId = optionalText(input.governanceMeetingPublicId, 36);
			const decisionPublicId = optionalText(input.governanceDecisionPublicId, 36);
			if (meetingPublicId) {
				const meeting = await trx.selectFrom('governance_meetings').select(['public_id','lifecycle_status']).where('organisation_id', '=', actor.organisationId).where('public_id', '=', meetingPublicId).executeTakeFirst();
				if (!meeting) throw new RecordNotFoundError('Governance meeting not found.');
			}
			if (decisionPublicId) {
				const decision = await trx.selectFrom('governance_decisions').select('public_id').where('organisation_id', '=', actor.organisationId).where('public_id', '=', decisionPublicId).executeTakeFirst();
				if (!decision) throw new RecordNotFoundError('Governance decision not found.');
			}
			const row = await repository.insertReview({ organisation_id: actor.organisationId, performance_pack_id: pack.id, public_id: this.publicIdFactory(), review_code: coded(input.reviewCode, 'Review code'), review_date: dateOnly(input.reviewDate, 'Review date'), title: requiredText(input.title, 'Review title', 255), summary: requiredText(input.summary, 'Review summary', 20_000), decision_text: optionalText(input.decisionText, 20_000), governance_meeting_public_id: meetingPublicId, governance_decision_public_id: decisionPublicId, lifecycle_status: 'draft', created_by_member_id: actor.memberId, approved_by_member_id: null, approved_at: null });
			await this.evidence(trx, actor, 'performance.review.create', 'strategy_performance_review', row.public_id, { reviewCode: row.review_code, packPublicId: pack.public_id, governanceMeetingPublicId: meetingPublicId, governanceDecisionPublicId: decisionPublicId }, ['F03.04']);
			return row;
		});
	}

	async approveReview(actor: TenantActorContext, reviewPublicId: string): Promise<PerformanceReviewRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const review = await trx.selectFrom('strategy_performance_reviews').selectAll().where('organisation_id', '=', actor.organisationId).where('public_id', '=', reviewPublicId.trim()).executeTakeFirst();
			if (!review) throw new RecordNotFoundError('Performance review not found.');
			if (review.lifecycle_status !== 'draft') throw new EnterprisePerformanceValidationError('Only a draft performance review can be approved.');
			const approved = await repository.updateReview(actor.organisationId, review.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'performance.review.approve', 'strategy_performance_review', approved.public_id, { reviewCode: approved.review_code }, ['F03.04']);
			return approved;
		});
	}

	async createBenchmark(actor: TenantActorContext, input: BenchmarkInput): Promise<PerformanceBenchmarkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved canonical KPI not found.');
			if (requiredText(input.unitLabel, 'Benchmark unit', 64) !== kpi.unit_label) throw new EnterprisePerformanceValidationError('Benchmark unit must match the canonical KPI unit.');
			const start = dateOnly(input.periodStart, 'Benchmark period start');
			const end = dateOnly(input.periodEnd, 'Benchmark period end');
			if (end < start) throw new EnterprisePerformanceValidationError('Benchmark period end must not precede period start.');
			const row = await repository.insertBenchmark({ organisation_id: actor.organisationId, strategy_kpi_id: kpi.id, public_id: this.publicIdFactory(), benchmark_code: coded(input.benchmarkCode, 'Benchmark code'), benchmark_type: input.benchmarkType, title: requiredText(input.title, 'Benchmark title', 255), scope_text: requiredText(input.scopeText, 'Benchmark scope', 20_000), unit_label: kpi.unit_label, period_start: start, period_end: end, benchmark_value: decimal(input.benchmarkValue, 'Benchmark value'), provenance_text: requiredText(input.provenanceText, 'Benchmark provenance', 20_000), source_reference: optionalText(input.sourceReference, 512), created_by_member_id: actor.memberId });
			await this.evidence(trx, actor, 'performance.benchmark.create', 'strategy_performance_benchmark', row.public_id, { benchmarkCode: row.benchmark_code, kpiPublicId: kpi.public_id }, ['F03.05']);
			return row;
		});
	}

	async compareBenchmark(actor: TenantActorContext, benchmarkPublicId: string, observationPublicId: string, interpretation: string): Promise<PerformanceBenchmarkResultRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const benchmark = await repository.findBenchmarkByPublicId(actor.organisationId, benchmarkPublicId.trim());
			const observation = await repository.findObservationByPublicId(actor.organisationId, observationPublicId.trim());
			if (!benchmark || !observation || benchmark.strategy_kpi_id !== observation.strategy_kpi_id) throw new RecordNotFoundError('Comparable benchmark and KPI observation not found.');
			const delta = variance(benchmark.benchmark_value, observation.actual_value);
			const row = await repository.insertBenchmarkResult({ organisation_id: actor.organisationId, performance_benchmark_id: benchmark.id, strategy_kpi_observation_id: observation.id, public_id: this.publicIdFactory(), gap_value: delta.value, gap_percent: delta.percent, interpretation: requiredText(interpretation, 'Benchmark interpretation', 20_000), created_by_member_id: actor.memberId });
			await this.evidence(trx, actor, 'performance.benchmark.compare', 'strategy_performance_benchmark_result', row.public_id, { benchmarkPublicId: benchmark.public_id, observationPublicId: observation.public_id }, ['F03.05']);
			return row;
		});
	}

	async createBenefit(actor: TenantActorContext, input: BenefitInput): Promise<PerformanceBenefitRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const kpi = await repository.findKpiByPublicId(actor.organisationId, input.kpiPublicId.trim());
			if (!kpi || kpi.lifecycle_status !== 'approved') throw new RecordNotFoundError('Approved canonical KPI not found.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId, 'Benefit owner');
			const row = await repository.insertBenefit({ organisation_id: actor.organisationId, strategy_kpi_id: kpi.id, public_id: this.publicIdFactory(), benefit_code: coded(input.benefitCode, 'Benefit code'), title: requiredText(input.title, 'Benefit title', 255), benefit_type: input.benefitType, unit_label: requiredText(input.unitLabel, 'Benefit unit', 64), baseline_value: decimal(input.baselineValue, 'Benefit baseline'), target_value: decimal(input.targetValue, 'Benefit target'), target_date: dateOnly(input.targetDate, 'Benefit target date'), owner_member_id: owner, review_cadence: input.reviewCadence, source_domain: token(input.sourceDomain, 'Source domain', true)!, source_record_type: token(input.sourceRecordType, 'Source record type', true)!, source_public_id: requiredText(input.sourcePublicId, 'Source public ID', 128), lifecycle_status: 'active', created_by_member_id: actor.memberId });
			await this.evidence(trx, actor, 'performance.benefit.create', 'strategy_performance_benefit', row.public_id, { benefitCode: row.benefit_code, kpiPublicId: kpi.public_id, source: `${row.source_domain}:${row.source_record_type}:${row.source_public_id}` }, ['F03.06']);
			return row;
		});
	}

	async recordBenefitMeasurement(actor: TenantActorContext, input: BenefitMeasurementInput): Promise<PerformanceBenefitMeasurementRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new EnterprisePerformanceRepository(trx);
			const benefit = await repository.findBenefitByPublicId(actor.organisationId, input.benefitPublicId.trim());
			if (!benefit || ['closed','cancelled'].includes(benefit.lifecycle_status)) throw new RecordNotFoundError('Active performance benefit not found.');
			const confidence = Number(decimal(input.confidencePercent, 'Confidence percent'));
			if (confidence < 0 || confidence > 100) throw new EnterprisePerformanceValidationError('Confidence percent must be between 0 and 100.');
			const row = await repository.insertBenefitMeasurement({ organisation_id: actor.organisationId, performance_benefit_id: benefit.id, public_id: this.publicIdFactory(), measured_on: dateOnly(input.measuredOn, 'Measured date'), realised_value: decimal(input.realisedValue, 'Realised value'), confidence_percent: confidence.toString(), evidence_text: requiredText(input.evidenceText, 'Benefit evidence', 20_000), source_domain: token(input.sourceDomain, 'Source domain'), source_record_type: token(input.sourceRecordType, 'Source record type'), source_public_id: optionalText(input.sourcePublicId, 128), created_by_member_id: actor.memberId });
			if (Number(row.realised_value) >= Number(benefit.target_value)) await repository.updateBenefit(actor.organisationId, benefit.id, { lifecycle_status: 'achieved' });
			await this.evidence(trx, actor, 'performance.benefit.measure', 'strategy_performance_benefit_measurement', row.public_id, { benefitPublicId: benefit.public_id, realisedValue: row.realised_value, confidencePercent: row.confidence_percent }, ['F03.06']);
			return row;
		});
	}
}
