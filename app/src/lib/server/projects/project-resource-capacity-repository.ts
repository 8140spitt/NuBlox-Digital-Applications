import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProjectResourcePoolRecord = {
	assignmentId: string;
	assignmentPublicId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	startsOn: Date | null;
	endsOn: Date | null;
	plannedAllocationPercent: string | null;
	status: string;
};

export type ProjectActivityResourceAllocationRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	activityId: string;
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	wbsCode: string;
	resourceAssignmentId: string;
	resourceAssignmentPublicId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	plannedEffortMinutes: number;
	loadStartOn: Date;
	loadFinishOn: Date;
	status: 'active' | 'removed';
	notes: string | null;
	createdAt: Date;
	removedAt: Date | null;
};

export type WorkerCalendarPatternRecord = {
	workerId: string;
	calendarAssignmentId: string;
	workCalendarId: string;
	calendarName: string;
	timezone: string;
	validFrom: Date;
	validTo: Date | null;
	isoWeekday: number;
	localStartTime: string;
	localEndTime: string;
	unpaidBreakMinutes: number;
};

export type WorkerUnavailabilityRecord = {
	workerId: string;
	startsAt: Date;
	endsAt: Date;
	status: string;
};

function mapPool(row: {
	assignmentId: string;
	assignmentPublicId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	startsOn: Date | null;
	endsOn: Date | null;
	plannedAllocationPercent: string | null;
	status: string;
}): ProjectResourcePoolRecord {
	return row;
}

function mapAllocation(row: {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	activityId: string;
	activityPublicId: string;
	activityCode: string;
	activityName: string;
	wbsCode: string;
	resourceAssignmentId: string;
	resourceAssignmentPublicId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	plannedEffortMinutes: number;
	loadStartOn: Date;
	loadFinishOn: Date;
	status: string;
	notes: string | null;
	createdAt: Date;
	removedAt: Date | null;
}): ProjectActivityResourceAllocationRecord {
	return {
		...row,
		status: row.status as ProjectActivityResourceAllocationRecord['status']
	};
}

export class ProjectResourceCapacityRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listProjectResourcePool(projectId: string): Promise<ProjectResourcePoolRecord[]> {
		const rows = await this.db
			.selectFrom('project_resource_assignments as assignment')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'assignment.worker_id')
					.onRef('worker.organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.id as assignmentId',
				'assignment.public_id as assignmentPublicId',
				'worker.id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'assignment.starts_on as startsOn',
				'assignment.ends_on as endsOn',
				'assignment.planned_allocation_percent as plannedAllocationPercent',
				'assignment.assignment_status as status'
			])
			.where('assignment.project_id', '=', projectId)
			.where('assignment.assignment_status', '!=', 'cancelled')
			.where('worker.status', '=', 'active')
			.orderBy('worker.display_name', 'asc')
			.orderBy('assignment.id', 'asc')
			.execute();
		return rows.map(mapPool);
	}

	async findProjectResourceAssignment(
		projectId: string,
		assignmentPublicId: string
	): Promise<ProjectResourcePoolRecord | null> {
		const row = await this.db
			.selectFrom('project_resource_assignments as assignment')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'assignment.worker_id')
					.onRef('worker.organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.id as assignmentId',
				'assignment.public_id as assignmentPublicId',
				'worker.id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'assignment.starts_on as startsOn',
				'assignment.ends_on as endsOn',
				'assignment.planned_allocation_percent as plannedAllocationPercent',
				'assignment.assignment_status as status'
			])
			.where('assignment.project_id', '=', projectId)
			.where('assignment.public_id', '=', assignmentPublicId)
			.where('assignment.assignment_status', '!=', 'cancelled')
			.where('worker.status', '=', 'active')
			.executeTakeFirst();
		return row ? mapPool(row) : null;
	}

	async lockProjectResourceAssignment(projectId: string, assignmentId: string): Promise<void> {
		await this.db
			.selectFrom('project_resource_assignments')
			.select('id')
			.where('project_id', '=', projectId)
			.where('id', '=', assignmentId)
			.forUpdate()
			.executeTakeFirst();
	}

	async listActiveAllocations(
		projectId: string
	): Promise<ProjectActivityResourceAllocationRecord[]> {
		const rows = await this.db
			.selectFrom('project_activity_resource_allocations as allocation')
			.innerJoin('project_plan_activities as activity', (join) =>
				join
					.onRef('activity.id', '=', 'allocation.project_plan_activity_id')
					.onRef('activity.project_id', '=', 'allocation.project_id')
					.onRef('activity.organisation_id', '=', 'allocation.organisation_id')
			)
			.innerJoin('project_wbs_nodes as wbs', 'wbs.id', 'activity.wbs_node_id')
			.innerJoin('project_resource_assignments as assignment', (join) =>
				join
					.onRef('assignment.id', '=', 'allocation.project_resource_assignment_id')
					.onRef('assignment.project_id', '=', 'allocation.project_id')
					.onRef('assignment.organisation_id', '=', 'allocation.organisation_id')
					.onRef('assignment.worker_id', '=', 'allocation.worker_id')
			)
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'allocation.worker_id')
					.onRef('worker.organisation_id', '=', 'allocation.organisation_id')
			)
			.select([
				'allocation.id as id',
				'allocation.organisation_id as organisationId',
				'allocation.project_id as projectId',
				'allocation.public_id as publicId',
				'activity.id as activityId',
				'activity.public_id as activityPublicId',
				'activity.activity_code as activityCode',
				'activity.name as activityName',
				'wbs.wbs_code as wbsCode',
				'assignment.id as resourceAssignmentId',
				'assignment.public_id as resourceAssignmentPublicId',
				'worker.id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'allocation.planned_effort_minutes as plannedEffortMinutes',
				'allocation.load_start_on as loadStartOn',
				'allocation.load_finish_on as loadFinishOn',
				'allocation.allocation_status as status',
				'allocation.notes as notes',
				'allocation.created_at as createdAt',
				'allocation.removed_at as removedAt'
			])
			.where('allocation.project_id', '=', projectId)
			.where('allocation.allocation_status', '=', 'active')
			.orderBy('allocation.load_start_on', 'asc')
			.orderBy('activity.activity_code', 'asc')
			.orderBy('worker.display_name', 'asc')
			.execute();
		return rows.map(mapAllocation);
	}

	async findAllocationByPublicId(
		projectId: string,
		publicId: string
	): Promise<ProjectActivityResourceAllocationRecord | null> {
		const allocations = await this.listActiveAllocations(projectId);
		return allocations.find((allocation) => allocation.publicId === publicId) ?? null;
	}

	async findActiveAllocation(
		projectId: string,
		activityId: string,
		resourceAssignmentId: string
	): Promise<{ id: string; publicId: string } | null> {
		return (
			(await this.db
				.selectFrom('project_activity_resource_allocations')
				.select(['id', 'public_id as publicId'])
				.where('project_id', '=', projectId)
				.where('project_plan_activity_id', '=', activityId)
				.where('project_resource_assignment_id', '=', resourceAssignmentId)
				.where('allocation_status', '=', 'active')
				.executeTakeFirst()) ?? null
		);
	}

	async insertAllocation(input: {
		organisationId: string;
		projectId: string;
		activityId: string;
		resourceAssignmentId: string;
		workerId: string;
		publicId: string;
		plannedEffortMinutes: number;
		loadStartOn: Date;
		loadFinishOn: Date;
		notes: string | null;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_activity_resource_allocations')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				project_plan_activity_id: input.activityId,
				project_resource_assignment_id: input.resourceAssignmentId,
				worker_id: input.workerId,
				public_id: input.publicId,
				planned_effort_minutes: input.plannedEffortMinutes,
				load_start_on: input.loadStartOn,
				load_finish_on: input.loadFinishOn,
				allocation_status: 'active',
				notes: input.notes,
				created_by_member_id: input.createdByMemberId,
				removed_by_member_id: null,
				removed_at: null
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) {
			throw new Error('MySQL did not return the project activity resource allocation ID.');
		}
		return result.insertId.toString();
	}

	async removeAllocation(
		projectId: string,
		publicId: string,
		removedByMemberId: string
	): Promise<boolean> {
		const result = await this.db
			.updateTable('project_activity_resource_allocations')
			.set({
				allocation_status: 'removed',
				removed_by_member_id: removedByMemberId,
				removed_at: new Date()
			})
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.where('allocation_status', '=', 'active')
			.executeTakeFirst();
		return Number(result.numUpdatedRows) === 1;
	}

	async listCalendarPatterns(
		organisationId: string,
		workerIds: readonly string[],
		fromOn: Date,
		toOn: Date
	): Promise<WorkerCalendarPatternRecord[]> {
		if (workerIds.length === 0) return [];
		return this.db
			.selectFrom('worker_calendar_assignments as assignment')
			.innerJoin('work_calendars as calendar', (join) =>
				join
					.onRef('calendar.id', '=', 'assignment.work_calendar_id')
					.onRef('calendar.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('work_calendar_weekdays as weekday', (join) =>
				join
					.onRef('weekday.work_calendar_id', '=', 'calendar.id')
					.onRef('weekday.organisation_id', '=', 'calendar.organisation_id')
			)
			.select([
				'assignment.worker_id as workerId',
				'assignment.id as calendarAssignmentId',
				'calendar.id as workCalendarId',
				'calendar.name as calendarName',
				'calendar.timezone as timezone',
				'assignment.valid_from as validFrom',
				'assignment.valid_to as validTo',
				'weekday.iso_weekday as isoWeekday',
				'weekday.local_start_time as localStartTime',
				'weekday.local_end_time as localEndTime',
				'weekday.unpaid_break_minutes as unpaidBreakMinutes'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.worker_id', 'in', [...workerIds])
			.where('assignment.valid_from', '<=', toOn)
			.where((expression) =>
				expression.or([
					expression('assignment.valid_to', 'is', null),
					expression('assignment.valid_to', '>=', fromOn)
				])
			)
			.where('calendar.is_active', '=', 1)
			.orderBy('assignment.valid_from', 'desc')
			.orderBy('assignment.id', 'desc')
			.orderBy('weekday.iso_weekday', 'asc')
			.execute();
	}

	async listUnavailability(
		organisationId: string,
		workerIds: readonly string[],
		startsBefore: Date,
		endsAfter: Date
	): Promise<WorkerUnavailabilityRecord[]> {
		if (workerIds.length === 0) return [];
		return this.db
			.selectFrom('worker_unavailability')
			.select(['worker_id as workerId', 'starts_at as startsAt', 'ends_at as endsAt', 'status'])
			.where('organisation_id', '=', organisationId)
			.where('worker_id', 'in', [...workerIds])
			.where('starts_at', '<', startsBefore)
			.where('ends_at', '>', endsAfter)
			.where('status', '!=', 'cancelled')
			.orderBy('starts_at', 'asc')
			.execute();
	}
}
