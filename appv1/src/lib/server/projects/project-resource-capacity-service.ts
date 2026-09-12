import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectPlanRepository, type ProjectPlanActivityRecord } from './project-plan-repository';
import { ProjectRepository, type ProjectRecord } from './project-repository';
import {
	ProjectResourceCapacityRepository,
	type ProjectActivityResourceAllocationRecord,
	type ProjectResourcePoolRecord,
	type WorkerCalendarPatternRecord,
	type WorkerUnavailabilityRecord
} from './project-resource-capacity-repository';

export type ProjectResourceCapacityDay = {
	date: string;
	capacityConfigured: boolean;
	grossCapacityMinutes: number;
	unavailableMinutes: number;
	projectCapacityMinutes: number;
	plannedLoadMinutes: number;
	varianceMinutes: number | null;
	overloaded: boolean | null;
};

export type ProjectResourceCapacityWorker = {
	workerId: string;
	workerPublicId: string;
	workerName: string;
	capacityConfigured: boolean;
	grossCapacityMinutes: number;
	unavailableMinutes: number;
	projectCapacityMinutes: number;
	plannedLoadMinutes: number;
	varianceMinutes: number | null;
	utilisationPercent: number | null;
	overloadedDays: number;
	days: ProjectResourceCapacityDay[];
};

export type ProjectResourceCapacityView = {
	project: ProjectRecord;
	canManage: boolean;
	fromOn: string;
	toOn: string;
	resourcePool: ProjectResourcePoolRecord[];
	activities: ProjectPlanActivityRecord[];
	allocations: ProjectActivityResourceAllocationRecord[];
	workers: ProjectResourceCapacityWorker[];
	totals: {
		resourceCount: number;
		plannedLoadMinutes: number;
		projectCapacityMinutes: number;
		varianceMinutes: number;
		overloadedDays: number;
		unconfiguredResources: number;
	};
};

export type CreateProjectResourceAllocationInput = {
	projectPublicId: string;
	activityPublicId: string;
	resourceAssignmentPublicId: string;
	plannedEffortHours: string;
	loadStartOn: Date;
	loadFinishOn: Date;
	notes?: string | null;
};

export class ProjectResourceCapacityValidationError extends Error {
	readonly code = 'PROJECT_RESOURCE_CAPACITY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectResourceCapacityValidationError';
	}
}

const DAY_MS = 86_400_000;
const MAX_VIEW_DAYS = 366;

function dateOnlyText(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function dateOnly(value: string): Date {
	return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: Date, days: number): Date {
	return new Date(value.getTime() + days * DAY_MS);
}

function inclusiveDays(fromOn: Date, toOn: Date): string[] {
	const result: string[] = [];
	for (let cursor = fromOn; cursor <= toOn; cursor = addDays(cursor, 1)) {
		result.push(dateOnlyText(cursor));
	}
	return result;
}

function isoWeekday(dateText: string): number {
	const day = dateOnly(dateText).getUTCDay();
	return day === 0 ? 7 : day;
}

function dateWithin(dateText: string, from: Date | null, to: Date | null): boolean {
	const value = dateText;
	return (!from || value >= dateOnlyText(from)) && (!to || value <= dateOnlyText(to));
}

function timeParts(value: string): { hour: number; minute: number } {
	const match = /^(\d{1,2}):(\d{2})/.exec(value);
	if (!match) throw new ProjectResourceCapacityValidationError('Work calendar time is invalid.');
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) {
		throw new ProjectResourceCapacityValidationError('Work calendar time is invalid.');
	}
	return { hour, minute };
}

function formatLocalDateTime(dateText: string, timeText: string): string {
	const { hour, minute } = timeParts(timeText);
	return `${dateText}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function localDateTimeParts(value: string): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
} {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
	if (!match) throw new ProjectResourceCapacityValidationError('Local date and time is invalid.');
	return {
		year: Number(match[1]),
		month: Number(match[2]),
		day: Number(match[3]),
		hour: Number(match[4]),
		minute: Number(match[5])
	};
}

function formatPartsAt(date: Date, timezone: string) {
	const formatter = new Intl.DateTimeFormat('en-GB', {
		timeZone: timezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23'
	});
	const parts = new Map(
		formatter
			.formatToParts(date)
			.filter((part) => part.type !== 'literal')
			.map((part) => [part.type, Number(part.value)])
	);
	return {
		year: parts.get('year')!,
		month: parts.get('month')!,
		day: parts.get('day')!,
		hour: parts.get('hour')!,
		minute: parts.get('minute')!
	};
}

function zonedLocalToUtc(value: string, timezone: string): Date {
	const desired = localDateTimeParts(value);
	try {
		new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(new Date());
	} catch {
		throw new ProjectResourceCapacityValidationError('Work calendar timezone is invalid.');
	}
	const desiredUtcNumber = Date.UTC(
		desired.year,
		desired.month - 1,
		desired.day,
		desired.hour,
		desired.minute
	);
	let candidate = new Date(desiredUtcNumber);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		const actual = formatPartsAt(candidate, timezone);
		const actualUtcNumber = Date.UTC(
			actual.year,
			actual.month - 1,
			actual.day,
			actual.hour,
			actual.minute
		);
		candidate = new Date(candidate.getTime() + (desiredUtcNumber - actualUtcNumber));
	}
	return candidate;
}

function calendarAssignmentForDate(
	patterns: readonly WorkerCalendarPatternRecord[],
	dateText: string
): WorkerCalendarPatternRecord[] {
	const active = patterns.filter((pattern) =>
		dateWithin(dateText, pattern.validFrom, pattern.validTo)
	);
	if (active.length === 0) return [];
	const newest = active.reduce((current, candidate) => {
		if (candidate.validFrom > current.validFrom) return candidate;
		if (
			candidate.validFrom.getTime() === current.validFrom.getTime() &&
			BigInt(candidate.calendarAssignmentId) > BigInt(current.calendarAssignmentId)
		) {
			return candidate;
		}
		return current;
	});
	return active.filter((pattern) => pattern.calendarAssignmentId === newest.calendarAssignmentId);
}

function scheduleForDate(
	patterns: readonly WorkerCalendarPatternRecord[],
	dateText: string
): { configured: boolean; pattern: WorkerCalendarPatternRecord | null } {
	const assigned = calendarAssignmentForDate(patterns, dateText);
	if (assigned.length === 0) return { configured: false, pattern: null };
	return {
		configured: true,
		pattern: assigned.find((pattern) => pattern.isoWeekday === isoWeekday(dateText)) ?? null
	};
}

function localWorkInterval(
	dateText: string,
	pattern: WorkerCalendarPatternRecord
): { start: Date; end: Date; grossMinutes: number } {
	const startParts = timeParts(pattern.localStartTime);
	const endParts = timeParts(pattern.localEndTime);
	const startMinute = startParts.hour * 60 + startParts.minute;
	const endMinute = endParts.hour * 60 + endParts.minute;
	const crossesMidnight = endMinute <= startMinute;
	const endDateText = crossesMidnight ? dateOnlyText(addDays(dateOnly(dateText), 1)) : dateText;
	const start = zonedLocalToUtc(
		formatLocalDateTime(dateText, pattern.localStartTime),
		pattern.timezone
	);
	const end = zonedLocalToUtc(
		formatLocalDateTime(endDateText, pattern.localEndTime),
		pattern.timezone
	);
	const elapsedMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
	return {
		start,
		end,
		grossMinutes: Math.max(0, elapsedMinutes - pattern.unpaidBreakMinutes)
	};
}

function overlapMinutes(
	start: Date,
	end: Date,
	periods: readonly WorkerUnavailabilityRecord[]
): number {
	const ranges = periods
		.map(
			(period) =>
				[
					Math.max(start.getTime(), period.startsAt.getTime()),
					Math.min(end.getTime(), period.endsAt.getTime())
				] as const
		)
		.filter(([rangeStart, rangeEnd]) => rangeEnd > rangeStart)
		.sort((a, b) => a[0] - b[0]);
	if (ranges.length === 0) return 0;
	let totalMs = 0;
	let currentStart = ranges[0]![0];
	let currentEnd = ranges[0]![1];
	for (const [rangeStart, rangeEnd] of ranges.slice(1)) {
		if (rangeStart <= currentEnd) {
			currentEnd = Math.max(currentEnd, rangeEnd);
			continue;
		}
		totalMs += currentEnd - currentStart;
		currentStart = rangeStart;
		currentEnd = rangeEnd;
	}
	totalMs += currentEnd - currentStart;
	return Math.round(totalMs / 60_000);
}

function assignmentForDate(
	pool: readonly ProjectResourcePoolRecord[],
	workerId: string,
	dateText: string
): ProjectResourcePoolRecord | null {
	return (
		pool.find(
			(assignment) =>
				assignment.workerId === workerId &&
				dateWithin(dateText, assignment.startsOn, assignment.endsOn)
		) ?? null
	);
}

function allocationPercent(value: string | null): number {
	if (value === null) return 100;
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 0;
	return Math.min(100, Math.max(0, numeric));
}

function effortHoursToMinutes(value: string): number {
	let scaled: bigint;
	try {
		scaled = parseScaledDecimal(value.trim(), 2, 'Planned effort');
	} catch {
		throw new ProjectResourceCapacityValidationError(
			'Planned effort must be a positive number of hours with no more than two decimal places.'
		);
	}
	if (scaled <= 0n) {
		throw new ProjectResourceCapacityValidationError(
			'Planned effort must be greater than zero hours.'
		);
	}
	if (scaled > 10_000_000n) {
		throw new ProjectResourceCapacityValidationError(
			'Planned effort must not exceed 100,000 hours.'
		);
	}
	const numerator = scaled * 60n;
	const quotient = numerator / 100n;
	const remainder = numerator % 100n;
	return Number(remainder >= 50n ? quotient + 1n : quotient);
}

function validateDate(value: Date, label: string): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectResourceCapacityValidationError(`${label} is invalid.`);
	}
	return value;
}

function validateNotes(value?: string | null): string | null {
	const notes = value?.trim() || null;
	if (notes && notes.length > 10_000) {
		throw new ProjectResourceCapacityValidationError('Notes must not exceed 10,000 characters.');
	}
	return notes;
}

function workingDatesForAllocation(
	allocation: ProjectActivityResourceAllocationRecord,
	calendarPatterns: readonly WorkerCalendarPatternRecord[]
): string[] {
	const dates = inclusiveDays(allocation.loadStartOn, allocation.loadFinishOn);
	const scheduled = dates.filter(
		(date) => scheduleForDate(calendarPatterns, date).pattern !== null
	);
	if (scheduled.length > 0) return scheduled;
	return dates;
}

function phaseAllocations(
	allocations: readonly ProjectActivityResourceAllocationRecord[],
	patternsByWorker: ReadonlyMap<string, WorkerCalendarPatternRecord[]>
): Map<string, number> {
	const loads = new Map<string, number>();
	for (const allocation of allocations) {
		const dates = workingDatesForAllocation(
			allocation,
			patternsByWorker.get(allocation.workerId) ?? []
		);
		if (dates.length === 0) continue;
		const quotient = Math.floor(allocation.plannedEffortMinutes / dates.length);
		let remainder = allocation.plannedEffortMinutes % dates.length;
		for (const date of dates) {
			const minutes = quotient + (remainder > 0 ? 1 : 0);
			if (remainder > 0) remainder -= 1;
			const key = `${allocation.workerId}:${date}`;
			loads.set(key, (loads.get(key) ?? 0) + minutes);
		}
	}
	return loads;
}

export class ProjectResourceCapacityService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async findProjectInMemberScope(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId
		);
		if (!project) throw new RecordNotFoundError('Project not found in the active member scope.');
		return project;
	}

	private async resolveProjectAccess(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<{ project: ProjectRecord; canManage: boolean }> {
		await this.assertActiveActor(actor);
		const project = await this.findProjectInMemberScope(actor, projectPublicId);
		if (project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError(
				'Project resource capacity not found in the active member scope.'
			);
		}
		const permissionService = new PermissionService(this.db);
		const [projectViewDecision, viewDecision, manageDecision] = await Promise.all([
			permissionService.decide(actor, 'project.view', { projectId: project.id }),
			permissionService.decide(actor, 'project.resource.view', { projectId: project.id }),
			permissionService.decideWithUmbrella(actor, 'project.resource.manage', 'project.manage', {
				projectId: project.id
			})
		]);
		if (!projectViewDecision.allowed || (!viewDecision.allowed && !manageDecision.allowed)) {
			throw new RecordNotFoundError(
				'Project resource capacity not found in the active member scope.'
			);
		}
		return {
			project,
			canManage: project.owningOrganisationId === actor.organisationId && manageDecision.allowed
		};
	}

	private async resolveMutationProject(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		const access = await this.resolveProjectAccess(actor, projectPublicId);
		if (!access.canManage) {
			throw new TenantAccessError('Project resource loading management is not permitted.');
		}
		return access.project;
	}

	private normaliseRange(
		activities: readonly ProjectPlanActivityRecord[],
		fromOn?: Date | null,
		toOn?: Date | null
	): { from: Date; to: Date } {
		let from = fromOn ? validateDate(fromOn, 'Capacity start') : null;
		let to = toOn ? validateDate(toOn, 'Capacity finish') : null;
		const activeActivities = activities.filter((activity) => activity.status !== 'cancelled');
		if (!from) {
			from = activeActivities.length
				? new Date(
						Math.min(...activeActivities.map((activity) => activity.plannedStartOn.getTime()))
					)
				: new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
		}
		if (!to) {
			const latest = activeActivities.length
				? new Date(
						Math.max(...activeActivities.map((activity) => activity.plannedFinishOn.getTime()))
					)
				: addDays(from, 27);
			to = latest > addDays(from, 83) ? addDays(from, 83) : latest;
		}
		if (to < from) {
			throw new ProjectResourceCapacityValidationError(
				'Capacity finish must be on or after capacity start.'
			);
		}
		const days = Math.floor((to.getTime() - from.getTime()) / DAY_MS) + 1;
		if (days > MAX_VIEW_DAYS) {
			throw new ProjectResourceCapacityValidationError(
				`Capacity views are limited to ${MAX_VIEW_DAYS} days at a time.`
			);
		}
		return { from, to };
	}

	async getCapacity(
		actor: TenantActorContext,
		projectPublicId: string,
		input: { fromOn?: Date | null; toOn?: Date | null } = {}
	): Promise<ProjectResourceCapacityView> {
		const { project, canManage } = await this.resolveProjectAccess(actor, projectPublicId);
		const planRepository = new ProjectPlanRepository(this.db);
		const activities = await planRepository.listActivities(project.id);
		const range = this.normaliseRange(activities, input.fromOn, input.toOn);
		const repository = new ProjectResourceCapacityRepository(this.db);
		const [resourcePool, allocations] = await Promise.all([
			repository.listProjectResourcePool(project.id),
			repository.listActiveAllocations(project.id)
		]);
		const workerIds = [...new Set(resourcePool.map((resource) => resource.workerId))];
		const calendarFrom = allocations.reduce(
			(current, allocation) =>
				allocation.loadStartOn < current ? allocation.loadStartOn : current,
			range.from
		);
		const calendarTo = allocations.reduce(
			(current, allocation) =>
				allocation.loadFinishOn > current ? allocation.loadFinishOn : current,
			range.to
		);
		const [calendarPatterns, unavailability] = await Promise.all([
			repository.listCalendarPatterns(actor.organisationId, workerIds, calendarFrom, calendarTo),
			repository.listUnavailability(
				actor.organisationId,
				workerIds,
				addDays(range.to, 2),
				addDays(range.from, -2)
			)
		]);
		const patternsByWorker = new Map<string, WorkerCalendarPatternRecord[]>();
		for (const pattern of calendarPatterns) {
			const current = patternsByWorker.get(pattern.workerId) ?? [];
			current.push(pattern);
			patternsByWorker.set(pattern.workerId, current);
		}
		const unavailabilityByWorker = new Map<string, WorkerUnavailabilityRecord[]>();
		for (const period of unavailability) {
			const current = unavailabilityByWorker.get(period.workerId) ?? [];
			current.push(period);
			unavailabilityByWorker.set(period.workerId, current);
		}
		const loadByWorkerDate = phaseAllocations(allocations, patternsByWorker);
		const dates = inclusiveDays(range.from, range.to);
		const workers: ProjectResourceCapacityWorker[] = [];

		for (const workerId of workerIds) {
			const resource = resourcePool.find((candidate) => candidate.workerId === workerId)!;
			const patterns = patternsByWorker.get(workerId) ?? [];
			const workerUnavailability = unavailabilityByWorker.get(workerId) ?? [];
			const days: ProjectResourceCapacityDay[] = [];
			let configuredAnyDay = false;
			for (const date of dates) {
				const schedule = scheduleForDate(patterns, date);
				if (schedule.configured) configuredAnyDay = true;
				let grossCapacityMinutes = 0;
				let unavailableMinutes = 0;
				if (schedule.pattern) {
					const interval = localWorkInterval(date, schedule.pattern);
					grossCapacityMinutes = interval.grossMinutes;
					unavailableMinutes = Math.min(
						grossCapacityMinutes,
						overlapMinutes(interval.start, interval.end, workerUnavailability)
					);
				}
				const availableMinutes = Math.max(0, grossCapacityMinutes - unavailableMinutes);
				const projectAssignment = assignmentForDate(resourcePool, workerId, date);
				const projectCapacityMinutes = projectAssignment
					? Math.round(
							(availableMinutes * allocationPercent(projectAssignment.plannedAllocationPercent)) /
								100
						)
					: 0;
				const plannedLoadMinutes = loadByWorkerDate.get(`${workerId}:${date}`) ?? 0;
				const varianceMinutes = schedule.configured
					? projectCapacityMinutes - plannedLoadMinutes
					: null;
				days.push({
					date,
					capacityConfigured: schedule.configured,
					grossCapacityMinutes,
					unavailableMinutes,
					projectCapacityMinutes,
					plannedLoadMinutes,
					varianceMinutes,
					overloaded: schedule.configured ? plannedLoadMinutes > projectCapacityMinutes : null
				});
			}
			const grossCapacityMinutes = days.reduce((sum, day) => sum + day.grossCapacityMinutes, 0);
			const unavailableMinutes = days.reduce((sum, day) => sum + day.unavailableMinutes, 0);
			const projectCapacityMinutes = days.reduce((sum, day) => sum + day.projectCapacityMinutes, 0);
			const plannedLoadMinutes = days.reduce((sum, day) => sum + day.plannedLoadMinutes, 0);
			const varianceMinutes = configuredAnyDay ? projectCapacityMinutes - plannedLoadMinutes : null;
			workers.push({
				workerId,
				workerPublicId: resource.workerPublicId,
				workerName: resource.workerName,
				capacityConfigured: configuredAnyDay,
				grossCapacityMinutes,
				unavailableMinutes,
				projectCapacityMinutes,
				plannedLoadMinutes,
				varianceMinutes,
				utilisationPercent:
					configuredAnyDay && projectCapacityMinutes > 0
						? Math.round((plannedLoadMinutes / projectCapacityMinutes) * 1000) / 10
						: null,
				overloadedDays: days.filter((day) => day.overloaded === true).length,
				days
			});
		}

		const projectCapacityMinutes = workers.reduce(
			(sum, worker) => sum + worker.projectCapacityMinutes,
			0
		);
		const plannedLoadMinutes = workers.reduce((sum, worker) => sum + worker.plannedLoadMinutes, 0);
		return {
			project,
			canManage,
			fromOn: dateOnlyText(range.from),
			toOn: dateOnlyText(range.to),
			resourcePool,
			activities: activities.filter(
				(activity) => activity.activityKind === 'activity' && activity.status !== 'cancelled'
			),
			allocations,
			workers,
			totals: {
				resourceCount: workerIds.length,
				plannedLoadMinutes,
				projectCapacityMinutes,
				varianceMinutes: projectCapacityMinutes - plannedLoadMinutes,
				overloadedDays: workers.reduce((sum, worker) => sum + worker.overloadedDays, 0),
				unconfiguredResources: workers.filter((worker) => !worker.capacityConfigured).length
			}
		};
	}

	async createAllocation(
		actor: TenantActorContext,
		input: CreateProjectResourceAllocationInput
	): Promise<ProjectActivityResourceAllocationRecord> {
		const project = await this.resolveMutationProject(actor, input.projectPublicId);
		const planRepository = new ProjectPlanRepository(this.db);
		const activity = await planRepository.findActivityByPublicId(
			project.id,
			input.activityPublicId.trim()
		);
		if (!activity || activity.activityKind !== 'activity' || activity.status === 'cancelled') {
			throw new ProjectResourceCapacityValidationError(
				'The selected project-plan activity is not available for resource loading.'
			);
		}
		const loadStartOn = validateDate(input.loadStartOn, 'Load start');
		const loadFinishOn = validateDate(input.loadFinishOn, 'Load finish');
		if (loadFinishOn < loadStartOn) {
			throw new ProjectResourceCapacityValidationError(
				'Load finish must be on or after load start.'
			);
		}
		if (loadStartOn < activity.plannedStartOn || loadFinishOn > activity.plannedFinishOn) {
			throw new ProjectResourceCapacityValidationError(
				'Resource load dates must remain within the activity planned start and finish.'
			);
		}
		const plannedEffortMinutes = effortHoursToMinutes(input.plannedEffortHours);
		const notes = validateNotes(input.notes);
		const repository = new ProjectResourceCapacityRepository(this.db);
		const resource = await repository.findProjectResourceAssignment(
			project.id,
			input.resourceAssignmentPublicId.trim()
		);
		if (!resource) {
			throw new ProjectResourceCapacityValidationError(
				'The selected worker is not in this project resource pool.'
			);
		}
		if (
			(resource.startsOn && loadStartOn < resource.startsOn) ||
			(resource.endsOn && loadFinishOn > resource.endsOn)
		) {
			throw new ProjectResourceCapacityValidationError(
				'Resource load dates must remain within the worker project assignment period.'
			);
		}

		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			const transactionRepository = new ProjectResourceCapacityRepository(transaction);
			await transactionRepository.lockProjectResourceAssignment(project.id, resource.assignmentId);
			const existing = await transactionRepository.findActiveAllocation(
				project.id,
				activity.id,
				resource.assignmentId
			);
			if (existing) {
				throw new ProjectResourceCapacityValidationError(
					'That worker already has an active resource load on this activity. Remove it before creating a corrected allocation.'
				);
			}
			await transactionRepository.insertAllocation({
				organisationId: actor.organisationId,
				projectId: project.id,
				activityId: activity.id,
				resourceAssignmentId: resource.assignmentId,
				workerId: resource.workerId,
				publicId,
				plannedEffortMinutes,
				loadStartOn,
				loadFinishOn,
				notes,
				createdByMemberId: actor.memberId
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.resource_allocation.created',
				subjectType: 'project_activity_resource_allocation',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					activityPublicId: activity.publicId,
					activityCode: activity.activityCode,
					resourceAssignmentPublicId: resource.assignmentPublicId,
					workerPublicId: resource.workerPublicId,
					plannedEffortMinutes,
					loadStartOn: dateOnlyText(loadStartOn),
					loadFinishOn: dateOnlyText(loadFinishOn)
				}
			});
		});
		const created = await repository.findAllocationByPublicId(project.id, publicId);
		if (!created) throw new Error('Created resource allocation could not be reloaded.');
		return created;
	}

	async removeAllocation(
		actor: TenantActorContext,
		projectPublicId: string,
		allocationPublicId: string
	): Promise<void> {
		const project = await this.resolveMutationProject(actor, projectPublicId);
		const repository = new ProjectResourceCapacityRepository(this.db);
		const allocation = await repository.findAllocationByPublicId(
			project.id,
			allocationPublicId.trim()
		);
		if (!allocation) throw new RecordNotFoundError('Active project resource allocation not found.');
		await this.db.transaction().execute(async (transaction) => {
			const removed = await new ProjectResourceCapacityRepository(transaction).removeAllocation(
				project.id,
				allocation.publicId,
				actor.memberId
			);
			if (!removed) throw new RecordNotFoundError('Active project resource allocation not found.');
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.resource_allocation.removed',
				subjectType: 'project_activity_resource_allocation',
				subjectPublicId: allocation.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					activityPublicId: allocation.activityPublicId,
					workerPublicId: allocation.workerPublicId,
					plannedEffortMinutes: allocation.plannedEffortMinutes
				}
			});
		});
	}
}
