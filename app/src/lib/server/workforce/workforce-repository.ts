import type { DatabaseExecutor } from '$lib/server/db/executor';

export type WorkerStatus = 'active' | 'inactive' | 'suspended' | 'archived';
export type TimesheetStatus =
	| 'draft'
	| 'submitted'
	| 'approved'
	| 'rejected'
	| 'reopened'
	| 'cancelled';

export type WorkerRecord = {
	id: string;
	organisationId: string;
	publicId: string;
	organisationMemberId: string | null;
	personPartyId: string | null;
	workerNumber: string | null;
	displayName: string;
	status: WorkerStatus;
};

export type WorkforceMemberCandidate = {
	memberId: string;
	memberPublicId: string;
	userId: string;
	displayName: string;
};

export type WorkerEngagementSummary = {
	workerId: string;
	engagementTypeCode: string;
	engagementTypeName: string;
	jobTitle: string | null;
	teamId: string | null;
	teamName: string | null;
	startedOn: Date;
	endedOn: Date | null;
	status: string;
};

export type WorkerCompetencySummary = {
	workerId: string;
	competencyTypePublicId: string;
	competencyName: string;
	proficiencyLevel: string | null;
	assessmentStatus: string;
	validFrom: Date | null;
	validTo: Date | null;
};

export type ProjectAssignmentSummary = {
	publicId: string;
	projectPublicId: string;
	projectNumber: string;
	projectName: string;
	workerPublicId: string;
	workerName: string;
	startsOn: Date | null;
	endsOn: Date | null;
	plannedAllocationPercent: string | null;
	status: string;
};

export type ScheduleEventRecord = {
	id: string;
	organisationId: string;
	publicId: string;
	eventTypeCode: string;
	eventTypeName: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectName: string | null;
	title: string;
	description: string | null;
	startsAt: Date;
	endsAt: Date;
	timezone: string;
	status: string;
};

export type ScheduleWorkerAssignment = {
	scheduleEventId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	assignmentStatus: string;
};

export type TimesheetRecord = {
	id: string;
	organisationId: string;
	publicId: string;
	workerId: string;
	workerPublicId: string;
	workerName: string;
	periodStart: Date;
	periodEnd: Date;
	status: TimesheetStatus;
	submittedAt: Date | null;
	approvedAt: Date | null;
};

export type TimesheetEntryRecord = {
	id: string;
	timesheetId: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectName: string | null;
	scheduleEventId: string | null;
	workDate: Date;
	startedAt: Date | null;
	endedAt: Date | null;
	workedMinutes: number;
	isBillable: boolean;
	description: string | null;
};

export type EffectiveCostRate = {
	id: string;
	workerCostRateTypeId: number;
	currencyCode: string;
	rateBasis: string;
	amount: string;
};

function mapWorker(row: {
	id: string;
	organisation_id: string;
	public_id: string;
	organisation_member_id: string | null;
	person_party_id: string | null;
	worker_number: string | null;
	display_name: string;
	status: string;
}): WorkerRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		publicId: row.public_id,
		organisationMemberId: row.organisation_member_id,
		personPartyId: row.person_party_id,
		workerNumber: row.worker_number,
		displayName: row.display_name,
		status: row.status as WorkerStatus
	};
}

const WORKER_COLUMNS = [
	'id',
	'organisation_id',
	'public_id',
	'organisation_member_id',
	'person_party_id',
	'worker_number',
	'display_name',
	'status'
] as const;

export class WorkforceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listWorkers(organisationId: string): Promise<WorkerRecord[]> {
		const rows = await this.db
			.selectFrom('workers')
			.select(WORKER_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('status', '!=', 'archived')
			.orderBy('display_name')
			.orderBy('id')
			.execute();
		return rows.map(mapWorker);
	}

	async findWorkerByPublicId(
		organisationId: string,
		publicId: string
	): Promise<WorkerRecord | null> {
		const row = await this.db
			.selectFrom('workers')
			.select(WORKER_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapWorker(row) : null;
	}

	async findWorkerByMemberId(
		organisationId: string,
		memberId: string
	): Promise<WorkerRecord | null> {
		const row = await this.db
			.selectFrom('workers')
			.select(WORKER_COLUMNS)
			.where('organisation_id', '=', organisationId)
			.where('organisation_member_id', '=', memberId)
			.executeTakeFirst();
		return row ? mapWorker(row) : null;
	}

	async listMemberCandidates(organisationId: string): Promise<WorkforceMemberCandidate[]> {
		const rows = await this.db
			.selectFrom('organisation_members as member')
			.innerJoin('users as user', 'user.id', 'member.user_id')
			.leftJoin('workers as worker', (join) =>
				join
					.onRef('worker.organisation_member_id', '=', 'member.id')
					.onRef('worker.organisation_id', '=', 'member.organisation_id')
			)
			.select([
				'member.id as memberId',
				'member.public_id as memberPublicId',
				'user.id as userId',
				'user.display_name as displayName'
			])
			.where('member.organisation_id', '=', organisationId)
			.where('member.status', '=', 'active')
			.where('worker.id', 'is', null)
			.orderBy('user.display_name')
			.execute();
		return rows;
	}

	async listTeams(organisationId: string) {
		return this.db
			.selectFrom('teams')
			.select(['id', 'public_id as publicId', 'name'])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listEngagementTypes() {
		return this.db
			.selectFrom('workforce_engagement_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listWorkerEngagements(organisationId: string): Promise<WorkerEngagementSummary[]> {
		const rows = await this.db
			.selectFrom('worker_engagements as engagement')
			.innerJoin(
				'workforce_engagement_types as type',
				'type.id',
				'engagement.workforce_engagement_type_id'
			)
			.leftJoin('teams as team', (join) =>
				join
					.onRef('team.id', '=', 'engagement.primary_team_id')
					.onRef('team.organisation_id', '=', 'engagement.organisation_id')
			)
			.select([
				'engagement.worker_id as workerId',
				'type.code as engagementTypeCode',
				'type.name as engagementTypeName',
				'engagement.job_title as jobTitle',
				'engagement.primary_team_id as teamId',
				'team.name as teamName',
				'engagement.started_on as startedOn',
				'engagement.ended_on as endedOn',
				'engagement.engagement_status as status'
			])
			.where('engagement.organisation_id', '=', organisationId)
			.where('engagement.engagement_status', 'in', ['planned', 'active', 'suspended'])
			.orderBy('engagement.started_on', 'desc')
			.orderBy('engagement.id', 'desc')
			.execute();
		return rows;
	}

	async listCompetencyTypes(organisationId: string) {
		return this.db
			.selectFrom('competency_types')
			.select(['id', 'public_id as publicId', 'code', 'name', 'description', 'requires_expiry as requiresExpiry'])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listWorkerCompetencies(organisationId: string): Promise<WorkerCompetencySummary[]> {
		return this.db
			.selectFrom('worker_competencies as competency')
			.innerJoin('competency_types as type', (join) =>
				join
					.onRef('type.id', '=', 'competency.competency_type_id')
					.onRef('type.organisation_id', '=', 'competency.organisation_id')
			)
			.select([
				'competency.worker_id as workerId',
				'type.public_id as competencyTypePublicId',
				'type.name as competencyName',
				'competency.proficiency_level as proficiencyLevel',
				'competency.assessment_status as assessmentStatus',
				'competency.valid_from as validFrom',
				'competency.valid_to as validTo'
			])
			.where('competency.organisation_id', '=', organisationId)
			.orderBy('type.name')
			.execute();
	}

	async listProjectAssignments(organisationId: string): Promise<ProjectAssignmentSummary[]> {
		return this.db
			.selectFrom('project_resource_assignments as assignment')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'assignment.worker_id')
					.onRef('worker.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'assignment.project_id')
					.onRef('project.owning_organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.public_id as publicId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'assignment.starts_on as startsOn',
				'assignment.ends_on as endsOn',
				'assignment.planned_allocation_percent as plannedAllocationPercent',
				'assignment.assignment_status as status'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.assignment_status', '!=', 'cancelled')
			.orderBy('project.project_number')
			.orderBy('worker.display_name')
			.execute();
	}

	async listScheduleEventTypes() {
		return this.db
			.selectFrom('schedule_event_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listScheduleEventsForOrganisation(
		organisationId: string,
		startsBefore: Date,
		endsAfter: Date
	): Promise<ScheduleEventRecord[]> {
		const rows = await this.db
			.selectFrom('schedule_events as event')
			.innerJoin('schedule_event_types as type', 'type.id', 'event.schedule_event_type_id')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'event.project_id')
					.onRef('project.owning_organisation_id', '=', 'event.organisation_id')
			)
			.select([
				'event.id as id',
				'event.organisation_id as organisationId',
				'event.public_id as publicId',
				'type.code as eventTypeCode',
				'type.name as eventTypeName',
				'event.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.name as projectName',
				'event.title as title',
				'event.description as description',
				'event.starts_at as startsAt',
				'event.ends_at as endsAt',
				'event.timezone as timezone',
				'event.event_status as status'
			])
			.where('event.organisation_id', '=', organisationId)
			.where('event.starts_at', '<', startsBefore)
			.where('event.ends_at', '>', endsAfter)
			.where('event.event_status', '!=', 'cancelled')
			.orderBy('event.starts_at')
			.execute();
		return rows;
	}

	async listScheduleEventsForWorker(
		organisationId: string,
		workerId: string,
		startsBefore: Date,
		endsAfter: Date
	): Promise<ScheduleEventRecord[]> {
		const rows = await this.db
			.selectFrom('schedule_events as event')
			.innerJoin('schedule_event_types as type', 'type.id', 'event.schedule_event_type_id')
			.innerJoin('schedule_event_workers as assignment', (join) =>
				join
					.onRef('assignment.schedule_event_id', '=', 'event.id')
					.onRef('assignment.organisation_id', '=', 'event.organisation_id')
			)
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'event.project_id')
					.onRef('project.owning_organisation_id', '=', 'event.organisation_id')
			)
			.select([
				'event.id as id',
				'event.organisation_id as organisationId',
				'event.public_id as publicId',
				'type.code as eventTypeCode',
				'type.name as eventTypeName',
				'event.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.name as projectName',
				'event.title as title',
				'event.description as description',
				'event.starts_at as startsAt',
				'event.ends_at as endsAt',
				'event.timezone as timezone',
				'event.event_status as status'
			])
			.where('event.organisation_id', '=', organisationId)
			.where('assignment.worker_id', '=', workerId)
			.where('assignment.assignment_status', 'not in', ['declined', 'cancelled'])
			.where('event.starts_at', '<', startsBefore)
			.where('event.ends_at', '>', endsAfter)
			.where('event.event_status', '!=', 'cancelled')
			.orderBy('event.starts_at')
			.execute();
		return rows;
	}

	async listScheduleWorkerAssignments(
		organisationId: string,
		eventIds: readonly string[]
	): Promise<ScheduleWorkerAssignment[]> {
		if (eventIds.length === 0) return [];
		return this.db
			.selectFrom('schedule_event_workers as assignment')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'assignment.worker_id')
					.onRef('worker.organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.schedule_event_id as scheduleEventId',
				'assignment.worker_id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'assignment.assignment_status as assignmentStatus'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.schedule_event_id', 'in', [...eventIds])
			.orderBy('worker.display_name')
			.execute();
	}

	async findScheduleEventByPublicId(
		organisationId: string,
		publicId: string
	): Promise<{ id: string; projectId: string | null; startsAt: Date; endsAt: Date } | null> {
		return (
			(await this.db
				.selectFrom('schedule_events')
				.select(['id', 'project_id as projectId', 'starts_at as startsAt', 'ends_at as endsAt'])
				.where('organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async hasScheduleWorkerAssignment(
		organisationId: string,
		eventId: string,
		workerId: string
	): Promise<boolean> {
		const row = await this.db
			.selectFrom('schedule_event_workers')
			.select('schedule_event_id')
			.where('organisation_id', '=', organisationId)
			.where('schedule_event_id', '=', eventId)
			.where('worker_id', '=', workerId)
			.where('assignment_status', 'not in', ['declined', 'cancelled'])
			.executeTakeFirst();
		return Boolean(row);
	}

	async listTimesheetsForWorker(
		organisationId: string,
		workerId: string
	): Promise<TimesheetRecord[]> {
		return this.db
			.selectFrom('timesheets as timesheet')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'timesheet.worker_id')
					.onRef('worker.organisation_id', '=', 'timesheet.organisation_id')
			)
			.select([
				'timesheet.id as id',
				'timesheet.organisation_id as organisationId',
				'timesheet.public_id as publicId',
				'timesheet.worker_id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'timesheet.period_start as periodStart',
				'timesheet.period_end as periodEnd',
				'timesheet.timesheet_status as status',
				'timesheet.submitted_at as submittedAt',
				'timesheet.approved_at as approvedAt'
			])
			.where('timesheet.organisation_id', '=', organisationId)
			.where('timesheet.worker_id', '=', workerId)
			.orderBy('timesheet.period_start', 'desc')
			.orderBy('timesheet.id', 'desc')
			.execute() as Promise<TimesheetRecord[]>;
	}

	async listSubmittedTimesheets(organisationId: string): Promise<TimesheetRecord[]> {
		return this.db
			.selectFrom('timesheets as timesheet')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'timesheet.worker_id')
					.onRef('worker.organisation_id', '=', 'timesheet.organisation_id')
			)
			.select([
				'timesheet.id as id',
				'timesheet.organisation_id as organisationId',
				'timesheet.public_id as publicId',
				'timesheet.worker_id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'timesheet.period_start as periodStart',
				'timesheet.period_end as periodEnd',
				'timesheet.timesheet_status as status',
				'timesheet.submitted_at as submittedAt',
				'timesheet.approved_at as approvedAt'
			])
			.where('timesheet.organisation_id', '=', organisationId)
			.where('timesheet.timesheet_status', '=', 'submitted')
			.orderBy('timesheet.period_end')
			.orderBy('worker.display_name')
			.execute() as Promise<TimesheetRecord[]>;
	}

	async findTimesheetByPublicId(
		organisationId: string,
		publicId: string
	): Promise<TimesheetRecord | null> {
		const row = await this.db
			.selectFrom('timesheets as timesheet')
			.innerJoin('workers as worker', (join) =>
				join
					.onRef('worker.id', '=', 'timesheet.worker_id')
					.onRef('worker.organisation_id', '=', 'timesheet.organisation_id')
			)
			.select([
				'timesheet.id as id',
				'timesheet.organisation_id as organisationId',
				'timesheet.public_id as publicId',
				'timesheet.worker_id as workerId',
				'worker.public_id as workerPublicId',
				'worker.display_name as workerName',
				'timesheet.period_start as periodStart',
				'timesheet.period_end as periodEnd',
				'timesheet.timesheet_status as status',
				'timesheet.submitted_at as submittedAt',
				'timesheet.approved_at as approvedAt'
			])
			.where('timesheet.organisation_id', '=', organisationId)
			.where('timesheet.public_id', '=', publicId)
			.executeTakeFirst();
		return (row as TimesheetRecord | undefined) ?? null;
	}

	async listTimesheetEntries(
		organisationId: string,
		timesheetId: string
	): Promise<TimesheetEntryRecord[]> {
		const rows = await this.db
			.selectFrom('timesheet_entries as entry')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'entry.project_id')
					.onRef('project.owning_organisation_id', '=', 'entry.organisation_id')
			)
			.select([
				'entry.id as id',
				'entry.timesheet_id as timesheetId',
				'entry.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.name as projectName',
				'entry.schedule_event_id as scheduleEventId',
				'entry.work_date as workDate',
				'entry.started_at as startedAt',
				'entry.ended_at as endedAt',
				'entry.worked_minutes as workedMinutes',
				'entry.is_billable as isBillable',
				'entry.description as description'
			])
			.where('entry.organisation_id', '=', organisationId)
			.where('entry.timesheet_id', '=', timesheetId)
			.orderBy('entry.work_date')
			.orderBy('entry.id')
			.execute();
		return rows.map((row) => ({ ...row, isBillable: Boolean(row.isBillable) }));
	}

	async findEffectiveStandardCostRate(
		organisationId: string,
		workerId: string,
		workDate: Date
	): Promise<EffectiveCostRate | null> {
		const row = await this.db
			.selectFrom('worker_cost_rates as rate')
			.innerJoin('worker_cost_rate_types as type', 'type.id', 'rate.worker_cost_rate_type_id')
			.select([
				'rate.id as id',
				'rate.worker_cost_rate_type_id as workerCostRateTypeId',
				'rate.currency_code as currencyCode',
				'rate.rate_basis as rateBasis',
				'rate.amount as amount'
			])
			.where('rate.organisation_id', '=', organisationId)
			.where('rate.worker_id', '=', workerId)
			.where('type.code', '=', 'standard')
			.where('rate.valid_from', '<=', workDate)
			.where((eb) => eb.or([eb('rate.valid_to', 'is', null), eb('rate.valid_to', '>=', workDate)]))
			.orderBy('rate.valid_from', 'desc')
			.executeTakeFirst();
		return row ?? null;
	}
}
