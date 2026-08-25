import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { ProjectFinancialControlService } from '$lib/server/commercial/project-financial-control-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	ProjectPlanRepository,
	type ProjectPlanActivityRecord,
	type ProjectPlanBaselineRecord
} from './project-plan-repository';
import {
	ProjectProgressRepository,
	type ActivityProgressMeasurementRecord,
	type EarnedValueAllocationRecord,
	type EarnedValueBaselineRecord,
	type PlanBaselineActivityRecord,
	type ProgressMeasurementMethod,
	type ProgressPeriodRecord
} from './project-progress-repository';
import { ProjectRepository, type ProjectRecord } from './project-repository';

const MONEY_SCALE = 4;
const DAY_MS = 86_400_000;

export class ProjectProgressValidationError extends Error {
	readonly code = 'PROJECT_PROGRESS_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectProgressValidationError';
	}
}

export type CreateProgressPeriodInput = {
	projectPublicId: string;
	label: string;
	dataDate: Date;
};

export type RecordActivityProgressInput = {
	projectPublicId: string;
	periodPublicId: string;
	activityPublicId: string;
	measurementMethod: ProgressMeasurementMethod;
	percentComplete?: string | number | null;
	actualStartOn?: Date | null;
	actualFinishOn?: Date | null;
	remainingDurationDays?: string | number | null;
	quantityComplete?: string | number | null;
	quantityTotal?: string | number | null;
	quantityUnit?: string | null;
	commentary?: string | null;
};

export type CreateEarnedValueBaselineInput = {
	projectPublicId: string;
	planBaselinePublicId: string;
	name: string;
};

export type SetEarnedValueAllocationInput = {
	projectPublicId: string;
	earnedValueBaselinePublicId: string;
	activityPublicId: string;
	budgetAtCompletionAmount: string | number;
};

export type EarnedValueActivityMetric = {
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	wbsCode: string;
	budgetAtCompletion: string;
	plannedPercent: number;
	actualPercent: number;
	plannedValue: string;
	earnedValue: string;
};

export type EarnedValueMetrics = {
	available: boolean;
	reason: string | null;
	dataDate: string;
	currencyCode: string | null;
	baselinePublicId: string | null;
	baselineName: string | null;
	budgetAtCompletion: string | null;
	plannedValue: string | null;
	earnedValue: string | null;
	actualCost: string | null;
	scheduleVariance: string | null;
	costVariance: string | null;
	schedulePerformanceIndex: number | null;
	costPerformanceIndex: number | null;
	plannedPercent: number | null;
	earnedPercent: number | null;
	activities: EarnedValueActivityMetric[];
};

export type ProjectProgressWorkspace = {
	project: ProjectRecord;
	canManageProgress: boolean;
	canApproveProgress: boolean;
	canManageBaseline: boolean;
	canViewFinancialPerformance: boolean;
	activities: ProjectPlanActivityRecord[];
	planBaselines: ProjectPlanBaselineRecord[];
	progressPeriods: ProgressPeriodRecord[];
	selectedPeriod: ProgressPeriodRecord | null;
	selectedMeasurements: ActivityProgressMeasurementRecord[];
	earnedValueBaselines: EarnedValueBaselineRecord[];
	selectedEarnedValueBaseline: EarnedValueBaselineRecord | null;
	selectedEarnedValueAllocations: EarnedValueAllocationRecord[];
	selectedPlanBaselineActivities: PlanBaselineActivityRecord[];
	earnedValue: EarnedValueMetrics;
};

function dateOnly(value: Date, label: string): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectProgressValidationError(`${label} is invalid.`);
	}
	return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function dateText(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function requiredText(value: string, label: string, max: number): string {
	const result = value.trim();
	if (!result || result.length > max) {
		throw new ProjectProgressValidationError(`${label} must be between 1 and ${max} characters.`);
	}
	return result;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const result = value?.trim() ?? '';
	if (!result) return null;
	if (result.length > max)
		throw new ProjectProgressValidationError(`Text must not exceed ${max} characters.`);
	return result;
}

function decimalNumber(value: string | number | null | undefined, label: string): number | null {
	if (value === null || value === undefined || value === '') return null;
	const numeric = Number(value);
	if (!Number.isFinite(numeric))
		throw new ProjectProgressValidationError(`${label} must be a number.`);
	return numeric;
}

function money(value: string | number, label: string): bigint {
	return parseScaledDecimal(String(value), MONEY_SCALE, label);
}

function moneyText(value: bigint): string {
	return formatScaledDecimal(value, MONEY_SCALE);
}

function ratio(numerator: bigint, denominator: bigint): number | null {
	if (denominator === 0n) return null;
	const scale = 1_000_000n;
	const rounded = (numerator * scale + denominator / 2n) / denominator;
	return Number(rounded) / Number(scale);
}

function percent(numerator: bigint, denominator: bigint): number | null {
	const value = ratio(numerator, denominator);
	return value === null ? null : Math.round(value * 10_000) / 100;
}

function percentBps(value: string): number {
	return Math.max(0, Math.min(10_000, Math.round(Number(value) * 100)));
}

function scaledByBps(amount: bigint, bps: number): bigint {
	return (amount * BigInt(bps) + 5_000n) / 10_000n;
}

function plannedBps(allocation: EarnedValueAllocationRecord, dataDate: Date): number {
	const start = allocation.plannedStartOn.getTime();
	const finish = allocation.plannedFinishOn.getTime();
	const at = dataDate.getTime();
	if (at < start) return 0;
	if (allocation.activityKind === 'milestone' || finish <= start) return at >= finish ? 10_000 : 0;
	if (at >= finish) return 10_000;
	const totalDays = Math.max(1, Math.round((finish - start) / DAY_MS) + 1);
	const elapsedDays = Math.max(0, Math.round((at - start) / DAY_MS) + 1);
	return Math.max(0, Math.min(10_000, Math.round((elapsedDays / totalDays) * 10_000)));
}

function measurementPercent(input: RecordActivityProgressInput): {
	percent: number;
	quantityComplete: string | null;
	quantityTotal: string | null;
	quantityUnit: string | null;
} {
	if (
		!['manual_percent', 'milestone_0_100', 'milestone_50_50', 'quantity'].includes(
			input.measurementMethod
		)
	) {
		throw new ProjectProgressValidationError('Progress measurement method is invalid.');
	}
	if (input.measurementMethod === 'quantity') {
		const complete = decimalNumber(input.quantityComplete, 'Quantity complete');
		const total = decimalNumber(input.quantityTotal, 'Quantity total');
		const unit = requiredText(input.quantityUnit ?? '', 'Quantity unit', 32);
		if (complete === null || total === null || total <= 0 || complete < 0 || complete > total) {
			throw new ProjectProgressValidationError(
				'Quantity progress must be between zero and the positive total quantity.'
			);
		}
		return {
			percent: Math.round((complete / total) * 10_000) / 100,
			quantityComplete: complete.toFixed(6),
			quantityTotal: total.toFixed(6),
			quantityUnit: unit
		};
	}
	const supplied = decimalNumber(input.percentComplete, 'Percent complete');
	if (supplied === null || supplied < 0 || supplied > 100) {
		throw new ProjectProgressValidationError('Percent complete must be between 0 and 100.');
	}
	const rounded = Math.round(supplied * 100) / 100;
	if (input.measurementMethod === 'milestone_0_100' && ![0, 100].includes(rounded)) {
		throw new ProjectProgressValidationError('0/100 progress may only be 0% or 100%.');
	}
	if (input.measurementMethod === 'milestone_50_50' && ![0, 50, 100].includes(rounded)) {
		throw new ProjectProgressValidationError('50/50 progress may only be 0%, 50% or 100%.');
	}
	return { percent: rounded, quantityComplete: null, quantityTotal: null, quantityUnit: null };
}

export class ProjectProgressService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async findProject(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project)
			throw new RecordNotFoundError('Project progress not found in the active member scope.');
		const projectView = await new PermissionService(this.db).decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!projectView.allowed)
			throw new RecordNotFoundError('Project progress not found in the active member scope.');
		return project;
	}

	private async requireOwnerPermission(
		actor: TenantActorContext,
		projectPublicId: string,
		permissionKey:
			'project.progress.manage' | 'project.progress.approve' | 'project.progress.baseline.manage'
	): Promise<ProjectRecord> {
		const project = await this.findProject(actor, projectPublicId);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			permissionKey,
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed || project.owningOrganisationId !== actor.organisationId) {
			throw new TenantAccessError('Project progress management is not permitted.');
		}
		return project;
	}

	private async permissionFlags(actor: TenantActorContext, project: ProjectRecord) {
		const permissions = new PermissionService(this.db);
		const [view, manage, approve, baseline, financial] = await Promise.all([
			permissions.decide(actor, 'project.progress.view', { projectId: project.id }),
			permissions.decideWithUmbrella(actor, 'project.progress.manage', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.progress.approve', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.progress.baseline.manage', 'project.manage', {
				projectId: project.id
			}),
			permissions.decide(actor, 'commercial.forecast.view', { projectId: project.id })
		]);
		const owner = project.owningOrganisationId === actor.organisationId;
		if (!view.allowed && !manage.allowed && !approve.allowed && !baseline.allowed) {
			throw new RecordNotFoundError('Project progress not found in the active member scope.');
		}
		return {
			canManageProgress: owner && manage.allowed,
			canApproveProgress: owner && approve.allowed,
			canManageBaseline: owner && baseline.allowed,
			canViewFinancialPerformance: owner && financial.allowed
		};
	}

	private async latestApprovedMeasurements(projectId: string, dataDate: Date) {
		const repository = new ProjectProgressRepository(this.db);
		const periods = await repository.listApprovedPeriodsUpTo(projectId, dataDate);
		const measurements = await repository.listMeasurementsForPeriods(
			periods.map((period) => period.id)
		);
		const latest = new Map<string, ActivityProgressMeasurementRecord>();
		for (const measurement of measurements) latest.set(measurement.activityId, measurement);
		return latest;
	}

	private async calculateEarnedValue(
		actor: TenantActorContext,
		project: ProjectRecord,
		baseline: EarnedValueBaselineRecord | null,
		dataDate: Date,
		canViewFinancialPerformance: boolean
	): Promise<EarnedValueMetrics> {
		if (!canViewFinancialPerformance) {
			return {
				available: false,
				reason:
					'Commercial financial permission is required to view earned-value monetary performance.',
				dataDate: dateText(dataDate),
				currencyCode: null,
				baselinePublicId: null,
				baselineName: null,
				budgetAtCompletion: null,
				plannedValue: null,
				earnedValue: null,
				actualCost: null,
				scheduleVariance: null,
				costVariance: null,
				schedulePerformanceIndex: null,
				costPerformanceIndex: null,
				plannedPercent: null,
				earnedPercent: null,
				activities: []
			};
		}
		const unavailable = (reason: string): EarnedValueMetrics => ({
			available: false,
			reason,
			dataDate: dateText(dataDate),
			currencyCode: baseline?.currencyCode ?? null,
			baselinePublicId: baseline?.publicId ?? null,
			baselineName: baseline?.name ?? null,
			budgetAtCompletion: baseline?.controlBudgetSnapshot ?? null,
			plannedValue: null,
			earnedValue: null,
			actualCost: null,
			scheduleVariance: null,
			costVariance: null,
			schedulePerformanceIndex: null,
			costPerformanceIndex: null,
			plannedPercent: null,
			earnedPercent: null,
			activities: []
		});
		if (!baseline || baseline.status !== 'approved')
			return unavailable('An approved earned-value baseline is required.');
		const repository = new ProjectProgressRepository(this.db);
		const allocations = await repository.listEarnedValueAllocations(project.id, baseline.id);
		if (allocations.length === 0)
			return unavailable('The approved earned-value baseline has no budget allocations.');
		const latest = await this.latestApprovedMeasurements(project.id, dataDate);
		let bac = 0n;
		let pv = 0n;
		let ev = 0n;
		const activityMetrics: EarnedValueActivityMetric[] = [];
		for (const allocation of allocations) {
			const activityBac = money(allocation.budgetAtCompletionAmount, 'Budget at completion');
			const planned = plannedBps(allocation, dataDate);
			const actual = percentBps(latest.get(allocation.sourceActivityId)?.percentComplete ?? '0');
			const activityPv = scaledByBps(activityBac, planned);
			const activityEv = scaledByBps(activityBac, actual);
			bac += activityBac;
			pv += activityPv;
			ev += activityEv;
			activityMetrics.push({
				activityPublicId: allocation.activityPublicId,
				activityCode: allocation.activityCode,
				activityName: allocation.activityName,
				wbsCode: allocation.wbsCode,
				budgetAtCompletion: moneyText(activityBac),
				plannedPercent: Math.round(planned) / 100,
				actualPercent: Math.round(actual) / 100,
				plannedValue: moneyText(activityPv),
				earnedValue: moneyText(activityEv)
			});
		}
		const financial = await new ProjectFinancialControlService(this.db).getWorkspace(
			actor,
			project.publicId,
			dataDate,
			null
		);
		if (
			financial.currencyMismatch ||
			!financial.currencyCode ||
			financial.currencyCode !== baseline.currencyCode
		) {
			return unavailable(
				'Financial actuals do not reconcile to the earned-value baseline currency.'
			);
		}
		const ac = money(financial.totals.actualCost, 'Actual cost');
		return {
			available: true,
			reason: null,
			dataDate: dateText(dataDate),
			currencyCode: baseline.currencyCode,
			baselinePublicId: baseline.publicId,
			baselineName: baseline.name,
			budgetAtCompletion: moneyText(bac),
			plannedValue: moneyText(pv),
			earnedValue: moneyText(ev),
			actualCost: moneyText(ac),
			scheduleVariance: moneyText(ev - pv),
			costVariance: moneyText(ev - ac),
			schedulePerformanceIndex: ratio(ev, pv),
			costPerformanceIndex: ratio(ev, ac),
			plannedPercent: percent(pv, bac),
			earnedPercent: percent(ev, bac),
			activities: activityMetrics
		};
	}

	async getWorkspace(
		actor: TenantActorContext,
		projectPublicId: string,
		options: {
			periodPublicId?: string | null;
			baselinePublicId?: string | null;
			dataDate?: Date | null;
		} = {}
	): Promise<ProjectProgressWorkspace> {
		const project = await this.findProject(actor, projectPublicId);
		const flags = await this.permissionFlags(actor, project);
		const progressRepository = new ProjectProgressRepository(this.db);
		const planRepository = new ProjectPlanRepository(this.db);
		const [activities, planBaselines, progressPeriods, earnedValueBaselines] = await Promise.all([
			planRepository.listActivities(project.id),
			planRepository.listBaselines(project.id),
			progressRepository.listProgressPeriods(project.id),
			flags.canViewFinancialPerformance
				? progressRepository.listEarnedValueBaselines(project.id)
				: Promise.resolve([] as EarnedValueBaselineRecord[])
		]);
		const selectedPeriod = options.periodPublicId
			? (progressPeriods.find((period) => period.publicId === options.periodPublicId) ?? null)
			: (progressPeriods[0] ?? null);
		const selectedMeasurements = selectedPeriod
			? await progressRepository.listMeasurements(selectedPeriod.id)
			: [];
		const selectedEarnedValueBaseline = options.baselinePublicId
			? (earnedValueBaselines.find((baseline) => baseline.publicId === options.baselinePublicId) ??
				null)
			: (earnedValueBaselines.find((baseline) => baseline.status === 'approved') ??
				earnedValueBaselines[0] ??
				null);
		const selectedEarnedValueAllocations = selectedEarnedValueBaseline
			? await progressRepository.listEarnedValueAllocations(
					project.id,
					selectedEarnedValueBaseline.id
				)
			: [];
		const selectedPlanBaselineActivities = selectedEarnedValueBaseline
			? await progressRepository.listPlanBaselineActivities(
					project.id,
					selectedEarnedValueBaseline.sourcePlanBaselineId
				)
			: [];
		const latestApprovedPeriod =
			progressPeriods.find((period) => period.status === 'approved') ?? null;
		const metricDate = options.dataDate
			? dateOnly(options.dataDate, 'Data date')
			: (latestApprovedPeriod?.dataDate ?? dateOnly(this.now(), 'Data date'));
		const approvedBaseline =
			selectedEarnedValueBaseline?.status === 'approved'
				? selectedEarnedValueBaseline
				: (earnedValueBaselines.find((baseline) => baseline.status === 'approved') ?? null);
		const earnedValue = await this.calculateEarnedValue(
			actor,
			project,
			approvedBaseline,
			metricDate,
			flags.canViewFinancialPerformance
		);
		return {
			project,
			...flags,
			activities: activities.filter((activity) => activity.status !== 'cancelled'),
			planBaselines,
			progressPeriods,
			selectedPeriod,
			selectedMeasurements,
			earnedValueBaselines,
			selectedEarnedValueBaseline,
			selectedEarnedValueAllocations,
			selectedPlanBaselineActivities,
			earnedValue
		};
	}

	async createProgressPeriod(
		actor: TenantActorContext,
		input: CreateProgressPeriodInput
	): Promise<string> {
		const project = await this.requireOwnerPermission(
			actor,
			input.projectPublicId,
			'project.progress.manage'
		);
		const label = requiredText(input.label, 'Progress period label', 255);
		const dataDate = dateOnly(input.dataDate, 'Data date');
		const repository = new ProjectProgressRepository(this.db);
		if (
			(await repository.listProgressPeriods(project.id)).some(
				(period) => dateText(period.dataDate) === dateText(dataDate)
			)
		) {
			throw new ProjectProgressValidationError(
				'A progress period already exists for that data date.'
			);
		}
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			const tx = new ProjectProgressRepository(transaction);
			const periodNumber = await tx.nextProgressPeriodNumber(project.id);
			await tx.insertProgressPeriod({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId,
				periodNumber,
				label,
				dataDate,
				createdByMemberId: actor.memberId
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.progress_period.created',
				subjectType: 'project_progress_period',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { label, dataDate: dateText(dataDate) }
			});
		});
		return publicId;
	}

	async recordActivityProgress(
		actor: TenantActorContext,
		input: RecordActivityProgressInput
	): Promise<void> {
		const project = await this.requireOwnerPermission(
			actor,
			input.projectPublicId,
			'project.progress.manage'
		);
		const repository = new ProjectProgressRepository(this.db);
		const period = await repository.findProgressPeriodByPublicId(
			project.id,
			input.periodPublicId.trim()
		);
		if (!period || period.status !== 'open') {
			throw new ProjectProgressValidationError(
				'Progress may only be recorded in an open progress period.'
			);
		}
		const activity = await new ProjectPlanRepository(this.db).findActivityByPublicId(
			project.id,
			input.activityPublicId.trim()
		);
		if (!activity || activity.status === 'cancelled')
			throw new RecordNotFoundError('Project-plan activity not found.');
		const measured = measurementPercent(input);
		const actualStartOn = input.actualStartOn
			? dateOnly(input.actualStartOn, 'Actual start')
			: null;
		const actualFinishOn = input.actualFinishOn
			? dateOnly(input.actualFinishOn, 'Actual finish')
			: null;
		if (measured.percent > 0 && !actualStartOn) {
			throw new ProjectProgressValidationError(
				'Actual start is required when progress is greater than zero.'
			);
		}
		if (measured.percent === 100 && !actualFinishOn) {
			throw new ProjectProgressValidationError('Actual finish is required at 100% progress.');
		}
		if (actualStartOn && actualStartOn > period.dataDate)
			throw new ProjectProgressValidationError(
				'Actual start cannot be after the progress data date.'
			);
		if (actualFinishOn && actualFinishOn > period.dataDate)
			throw new ProjectProgressValidationError(
				'Actual finish cannot be after the progress data date.'
			);
		if (actualStartOn && actualFinishOn && actualFinishOn < actualStartOn)
			throw new ProjectProgressValidationError('Actual finish cannot be before actual start.');
		const remaining = decimalNumber(input.remainingDurationDays, 'Remaining duration');
		if (remaining !== null && remaining < 0)
			throw new ProjectProgressValidationError('Remaining duration cannot be negative.');
		if (measured.percent === 100 && remaining !== null && remaining !== 0)
			throw new ProjectProgressValidationError('Remaining duration must be zero at 100% progress.');
		const commentary = optionalText(input.commentary, 10_000);
		const latest = await this.latestApprovedMeasurements(project.id, period.dataDate);
		const previous = latest.get(activity.id);
		if (previous && measured.percent < Number(previous.percentComplete) && !commentary) {
			throw new ProjectProgressValidationError(
				'A progress reduction is a correction and requires commentary.'
			);
		}
		const existing = (await repository.listMeasurements(period.id)).find(
			(row) => row.activityId === activity.id
		);
		const publicId = existing?.publicId ?? this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			await new ProjectProgressRepository(transaction).upsertMeasurement({
				organisationId: actor.organisationId,
				projectId: project.id,
				progressPeriodId: period.id,
				activityId: activity.id,
				publicId,
				measurementMethod: input.measurementMethod,
				percentComplete: measured.percent.toFixed(2),
				actualStartOn,
				actualFinishOn,
				remainingDurationDays: remaining === null ? null : remaining.toFixed(2),
				quantityComplete: measured.quantityComplete,
				quantityTotal: measured.quantityTotal,
				quantityUnit: measured.quantityUnit,
				commentary,
				memberId: actor.memberId
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: existing
					? 'project.activity_progress.updated'
					: 'project.activity_progress.recorded',
				subjectType: 'project_activity_progress_measurement',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					periodPublicId: period.publicId,
					activityPublicId: activity.publicId,
					percentComplete: measured.percent
				}
			});
		});
	}

	async submitProgressPeriod(
		actor: TenantActorContext,
		projectPublicId: string,
		periodPublicId: string
	): Promise<void> {
		const project = await this.requireOwnerPermission(
			actor,
			projectPublicId,
			'project.progress.manage'
		);
		const repository = new ProjectProgressRepository(this.db);
		const period = await repository.findProgressPeriodByPublicId(project.id, periodPublicId.trim());
		if (!period || period.status !== 'open')
			throw new ProjectProgressValidationError('Only an open progress period can be submitted.');
		if ((await repository.listMeasurements(period.id)).length === 0)
			throw new ProjectProgressValidationError(
				'At least one activity measurement is required before submission.'
			);
		await this.db.transaction().execute(async (transaction) => {
			if (
				!(await new ProjectProgressRepository(transaction).submitPeriod({
					projectId: project.id,
					periodId: period.id,
					memberId: actor.memberId,
					submittedAt: this.now()
				}))
			) {
				throw new ProjectProgressValidationError(
					'Progress period state changed before submission.'
				);
			}
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.progress_period.submitted',
				subjectType: 'project_progress_period',
				subjectPublicId: period.publicId,
				correlationId: actor.correlationId,
				changeSummary: { dataDate: dateText(period.dataDate) }
			});
		});
	}

	async approveProgressPeriod(
		actor: TenantActorContext,
		projectPublicId: string,
		periodPublicId: string
	): Promise<void> {
		const project = await this.requireOwnerPermission(
			actor,
			projectPublicId,
			'project.progress.approve'
		);
		const repository = new ProjectProgressRepository(this.db);
		const period = await repository.findProgressPeriodByPublicId(project.id, periodPublicId.trim());
		if (!period || period.status !== 'submitted')
			throw new ProjectProgressValidationError('Only a submitted progress period can be approved.');
		await this.db.transaction().execute(async (transaction) => {
			if (
				!(await new ProjectProgressRepository(transaction).approvePeriod({
					projectId: project.id,
					periodId: period.id,
					memberId: actor.memberId,
					approvedAt: this.now()
				}))
			) {
				throw new ProjectProgressValidationError('Progress period state changed before approval.');
			}
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.progress_period.approved',
				subjectType: 'project_progress_period',
				subjectPublicId: period.publicId,
				correlationId: actor.correlationId,
				changeSummary: { dataDate: dateText(period.dataDate) }
			});
		});
	}

	async createEarnedValueBaseline(
		actor: TenantActorContext,
		input: CreateEarnedValueBaselineInput
	): Promise<string> {
		const project = await this.requireOwnerPermission(
			actor,
			input.projectPublicId,
			'project.progress.baseline.manage'
		);
		const financialDecision = await new PermissionService(this.db).decide(
			actor,
			'commercial.forecast.view',
			{ projectId: project.id }
		);
		if (!financialDecision.allowed)
			throw new TenantAccessError(
				'Financial permission is required to capture a performance baseline.'
			);
		const name = requiredText(input.name, 'Earned-value baseline name', 255);
		const planRepository = new ProjectPlanRepository(this.db);
		const planBaseline = (await planRepository.listBaselines(project.id)).find(
			(row) => row.publicId === input.planBaselinePublicId.trim()
		);
		if (!planBaseline) throw new RecordNotFoundError('Schedule baseline not found.');
		if (planBaseline.activityCount === 0)
			throw new ProjectProgressValidationError('The schedule baseline has no activities.');
		const financial = await new ProjectFinancialControlService(this.db).getWorkspace(
			actor,
			project.publicId,
			this.now(),
			null
		);
		if (financial.currencyMismatch || !financial.currencyCode)
			throw new ProjectProgressValidationError(
				'A single project control currency is required before creating an earned-value baseline.'
			);
		const controlBudget = money(financial.totals.controlBudget, 'Control budget');
		if (controlBudget <= 0n)
			throw new ProjectProgressValidationError(
				'A positive approved control budget is required before creating an earned-value baseline.'
			);
		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			const tx = new ProjectProgressRepository(transaction);
			const baselineNumber = await tx.nextEarnedValueBaselineNumber(project.id);
			await tx.insertEarnedValueBaseline({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId,
				baselineNumber,
				name,
				sourcePlanBaselineId: planBaseline.id,
				currencyCode: financial.currencyCode!,
				controlBudgetSnapshot: moneyText(controlBudget),
				createdByMemberId: actor.memberId
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.earned_value_baseline.created',
				subjectType: 'project_earned_value_baseline',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					planBaselinePublicId: planBaseline.publicId,
					controlBudgetSnapshot: moneyText(controlBudget),
					currencyCode: financial.currencyCode
				}
			});
		});
		return publicId;
	}

	async setEarnedValueAllocation(
		actor: TenantActorContext,
		input: SetEarnedValueAllocationInput
	): Promise<void> {
		const project = await this.requireOwnerPermission(
			actor,
			input.projectPublicId,
			'project.progress.baseline.manage'
		);
		const repository = new ProjectProgressRepository(this.db);
		const baseline = await repository.findEarnedValueBaselineByPublicId(
			project.id,
			input.earnedValueBaselinePublicId.trim()
		);
		if (!baseline || baseline.status !== 'draft')
			throw new ProjectProgressValidationError(
				'Only a draft earned-value baseline can be allocated.'
			);
		const activity = (
			await repository.listPlanBaselineActivities(project.id, baseline.sourcePlanBaselineId)
		).find((row) => row.activityPublicId === input.activityPublicId.trim());
		if (!activity) throw new RecordNotFoundError('Schedule-baseline activity not found.');
		const amount = money(input.budgetAtCompletionAmount, 'Budget at completion');
		if (amount < 0n)
			throw new ProjectProgressValidationError('Budget at completion cannot be negative.');
		const existing = await repository.listEarnedValueAllocations(project.id, baseline.id);
		const withoutCurrent = existing
			.filter((row) => row.sourceActivityId !== activity.sourceActivityId)
			.reduce((sum, row) => sum + money(row.budgetAtCompletionAmount, 'Budget at completion'), 0n);
		const revisedTotal = withoutCurrent + amount;
		const controlBudget = money(baseline.controlBudgetSnapshot, 'Control budget');
		if (revisedTotal > controlBudget)
			throw new ProjectProgressValidationError(
				'Earned-value allocations cannot exceed the frozen control-budget snapshot.'
			);
		await this.db.transaction().execute(async (transaction) => {
			const tx = new ProjectProgressRepository(transaction);
			if (amount === 0n)
				await tx.deleteEarnedValueAllocation(project.id, baseline.id, activity.sourceActivityId);
			else
				await tx.upsertEarnedValueAllocation({
					organisationId: actor.organisationId,
					projectId: project.id,
					earnedValueBaselineId: baseline.id,
					sourcePlanBaselineId: baseline.sourcePlanBaselineId,
					sourceActivityId: activity.sourceActivityId,
					budgetAtCompletionAmount: moneyText(amount),
					memberId: actor.memberId
				});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey:
					amount === 0n
						? 'project.earned_value_allocation.removed'
						: 'project.earned_value_allocation.set',
				subjectType: 'project_earned_value_baseline',
				subjectPublicId: baseline.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					activityPublicId: activity.activityPublicId,
					budgetAtCompletionAmount: moneyText(amount)
				}
			});
		});
	}

	async approveEarnedValueBaseline(
		actor: TenantActorContext,
		projectPublicId: string,
		baselinePublicId: string
	): Promise<void> {
		const project = await this.requireOwnerPermission(
			actor,
			projectPublicId,
			'project.progress.baseline.manage'
		);
		const repository = new ProjectProgressRepository(this.db);
		const baseline = await repository.findEarnedValueBaselineByPublicId(
			project.id,
			baselinePublicId.trim()
		);
		if (!baseline || baseline.status !== 'draft')
			throw new ProjectProgressValidationError(
				'Only a draft earned-value baseline can be approved.'
			);
		const allocations = await repository.listEarnedValueAllocations(project.id, baseline.id);
		if (allocations.length === 0)
			throw new ProjectProgressValidationError('At least one earned-value allocation is required.');
		const allocated = allocations.reduce(
			(sum, row) => sum + money(row.budgetAtCompletionAmount, 'Budget at completion'),
			0n
		);
		const controlBudget = money(baseline.controlBudgetSnapshot, 'Control budget');
		if (allocated !== controlBudget) {
			throw new ProjectProgressValidationError(
				`Earned-value allocations must equal the frozen control budget (${baseline.controlBudgetSnapshot} ${baseline.currencyCode}).`
			);
		}
		await this.db.transaction().execute(async (transaction) => {
			if (
				!(await new ProjectProgressRepository(transaction).approveEarnedValueBaseline({
					projectId: project.id,
					baselineId: baseline.id,
					memberId: actor.memberId,
					approvedAt: this.now()
				}))
			) {
				throw new ProjectProgressValidationError(
					'Earned-value baseline state changed before approval.'
				);
			}
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.earned_value_baseline.approved',
				subjectType: 'project_earned_value_baseline',
				subjectPublicId: baseline.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					budgetAtCompletion: moneyText(allocated),
					currencyCode: baseline.currencyCode
				}
			});
		});
	}
}
