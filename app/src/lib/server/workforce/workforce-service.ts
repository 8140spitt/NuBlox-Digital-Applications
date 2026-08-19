import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	WorkforceRepository,
	type ScheduleEventRecord,
	type TimesheetEntryRecord,
	type TimesheetRecord,
	type WorkerCompetencySummary,
	type WorkerEngagementSummary,
	type WorkerRecord
} from './workforce-repository';

export type PeopleWorker = WorkerRecord & {
	engagement: WorkerEngagementSummary | null;
	competencies: WorkerCompetencySummary[];
};

export type PeopleWorkspace = {
	canView: boolean;
	canManage: boolean;
	canManageCompetencies: boolean;
	canManageCredentials: boolean;
	canViewCostRates: boolean;
	canManageAssignments: boolean;
	workers: PeopleWorker[];
	memberCandidates: Awaited<ReturnType<WorkforceRepository['listMemberCandidates']>>;
	teams: Awaited<ReturnType<WorkforceRepository['listTeams']>>;
	engagementTypes: Awaited<ReturnType<WorkforceRepository['listEngagementTypes']>>;
	competencyTypes: Awaited<ReturnType<WorkforceRepository['listCompetencyTypes']>>;
	projectAssignments: Awaited<ReturnType<WorkforceRepository['listProjectAssignments']>>;
	projects: ProjectRecord[];
};

export type ScheduleWorkspaceEvent = ScheduleEventRecord & {
	workers: Awaited<ReturnType<WorkforceRepository['listScheduleWorkerAssignments']>>;
};

export type ScheduleWorkspace = {
	canView: boolean;
	canManage: boolean;
	currentWorker: WorkerRecord | null;
	events: ScheduleWorkspaceEvent[];
	workers: WorkerRecord[];
	projects: ProjectRecord[];
	eventTypes: Awaited<ReturnType<WorkforceRepository['listScheduleEventTypes']>>;
	from: Date;
	to: Date;
};

export type TimesheetWithEntries = TimesheetRecord & { entries: TimesheetEntryRecord[] };

export type TimeWorkspace = {
	canView: boolean;
	canManageOwn: boolean;
	canSubmitOwn: boolean;
	canApprove: boolean;
	currentWorker: WorkerRecord | null;
	ownTimesheets: TimesheetWithEntries[];
	approvalQueue: TimesheetWithEntries[];
	projectAssignments: Awaited<ReturnType<WorkforceRepository['listProjectAssignments']>>;
	assignedScheduleEvents: ScheduleEventRecord[];
};

export class WorkforceValidationError extends Error {
	readonly code = 'WORKFORCE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'WorkforceValidationError';
	}
}

const DATE_TEXT = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_TEXT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function parseDateOnly(value: string, label: string): Date {
	const text = value.trim();
	if (!DATE_TEXT.test(text)) throw new WorkforceValidationError(`${label} is required.`);
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
		throw new WorkforceValidationError(`${label} must be a valid calendar date.`);
	}
	return parsed;
}

function dateOnlyText(value: Date): string {
	return value.toISOString().slice(0, 10);
}

function parseOptionalDate(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	return text ? parseDateOnly(text, label) : null;
}

function localDateTimeParts(value: string): {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
} {
	const text = value.trim();
	if (!LOCAL_DATE_TIME_TEXT.test(text)) {
		throw new WorkforceValidationError('Start and end must use a valid local date and time.');
	}
	const [date, time] = text.split('T');
	const [year, month, day] = date!.split('-').map(Number);
	const [hour, minute] = time!.split(':').map(Number);
	return { year: year!, month: month!, day: day!, hour: hour!, minute: minute! };
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
		throw new WorkforceValidationError('A valid IANA timezone is required.');
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
	const roundTrip = formatPartsAt(candidate, timezone);
	if (
		roundTrip.year !== desired.year ||
		roundTrip.month !== desired.month ||
		roundTrip.day !== desired.day ||
		roundTrip.hour !== desired.hour ||
		roundTrip.minute !== desired.minute
	) {
		throw new WorkforceValidationError(
			'That local time does not exist in the selected timezone because of a daylight-saving transition.'
		);
	}
	return candidate;
}

function validateOptionalAllocation(value: string | null | undefined): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const scaled = parseScaledDecimal(text, 2, 'Planned allocation');
	if (scaled > 10000n) {
		throw new WorkforceValidationError('Planned allocation must be between 0 and 100 percent.');
	}
	return formatScaledDecimal(scaled, 2);
}

function calculateHourlyCost(rateAmount: string, minutes: number): string {
	const rate = parseScaledDecimal(rateAmount, 4, 'Worker cost rate');
	const numerator = rate * BigInt(minutes);
	const quotient = numerator / 60n;
	const remainder = numerator % 60n;
	return formatScaledDecimal(remainder * 2n >= 60n ? quotient + 1n : quotient, 4);
}

function periodIncludes(periodStart: Date, periodEnd: Date, workDate: Date): boolean {
	const target = dateOnlyText(workDate);
	return target >= dateOnlyText(periodStart) && target <= dateOnlyText(periodEnd);
}

function rangesOverlap(
	startA: Date | null,
	endA: Date | null,
	startB: Date | null,
	endB: Date | null
): boolean {
	const lowA = startA?.getTime() ?? Number.NEGATIVE_INFINITY;
	const highA = endA?.getTime() ?? Number.POSITIVE_INFINITY;
	const lowB = startB?.getTime() ?? Number.NEGATIVE_INFINITY;
	const highB = endB?.getTime() ?? Number.POSITIVE_INFINITY;
	return lowA <= highB && lowB <= highA;
}

export class WorkforceService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async requirePermission(actor: TenantActorContext, permissionKey: string): Promise<void> {
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('This workforce action is not permitted.');
	}

	async getPeopleWorkspace(actor: TenantActorContext): Promise<PeopleWorkspace> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'workforce.view',
			'workforce.manage',
			'workforce.competency.manage',
			'workforce.credential.manage',
			'workforce.cost_rate.view',
			'workforce.assignment.manage'
		]);
		const canView = decisions.get('workforce.view')?.allowed ?? false;
		const canManage = decisions.get('workforce.manage')?.allowed ?? false;
		const canManageCompetencies = decisions.get('workforce.competency.manage')?.allowed ?? false;
		const canManageCredentials = decisions.get('workforce.credential.manage')?.allowed ?? false;
		const canViewCostRates = decisions.get('workforce.cost_rate.view')?.allowed ?? false;
		const canManageAssignments = decisions.get('workforce.assignment.manage')?.allowed ?? false;
		if (!canView) {
			return {
				canView,
				canManage,
				canManageCompetencies,
				canManageCredentials,
				canViewCostRates,
				canManageAssignments,
				workers: [],
				memberCandidates: [],
				teams: [],
				engagementTypes: [],
				competencyTypes: [],
				projectAssignments: [],
				projects: []
			};
		}

		const repository = new WorkforceRepository(this.db);
		const [workers, engagements, competencies, memberCandidates, teams, engagementTypes, competencyTypes, projectAssignments] =
			await Promise.all([
				repository.listWorkers(actor.organisationId),
				repository.listWorkerEngagements(actor.organisationId),
				repository.listWorkerCompetencies(actor.organisationId),
				canManage ? repository.listMemberCandidates(actor.organisationId) : Promise.resolve([]),
				repository.listTeams(actor.organisationId),
				repository.listEngagementTypes(),
				repository.listCompetencyTypes(actor.organisationId),
				repository.listProjectAssignments(actor.organisationId)
			]);

		const projects = canManageAssignments
			? (await new ProjectRepository(this.db).listForMember(actor.organisationId, actor.memberId)).filter(
					(project) => project.owningOrganisationId === actor.organisationId
				)
			: [];
		const engagementByWorker = new Map<string, WorkerEngagementSummary>();
		for (const engagement of engagements) {
			if (!engagementByWorker.has(engagement.workerId)) engagementByWorker.set(engagement.workerId, engagement);
		}
		const competenciesByWorker = new Map<string, WorkerCompetencySummary[]>();
		for (const competency of competencies) {
			const current = competenciesByWorker.get(competency.workerId) ?? [];
			current.push(competency);
			competenciesByWorker.set(competency.workerId, current);
		}

		return {
			canView,
			canManage,
			canManageCompetencies,
			canManageCredentials,
			canViewCostRates,
			canManageAssignments,
			workers: workers.map((worker) => ({
				...worker,
				engagement: engagementByWorker.get(worker.id) ?? null,
				competencies: competenciesByWorker.get(worker.id) ?? []
			})),
			memberCandidates,
			teams,
			engagementTypes,
			competencyTypes,
			projectAssignments,
			projects
		};
	}

	async createWorkerFromMember(
		actor: TenantActorContext,
		input: {
			memberPublicId: string;
			workerNumber?: string | null;
			engagementTypeCode: string;
			jobTitle?: string | null;
			teamPublicId?: string | null;
			startedOn: string;
		}
	): Promise<WorkerRecord> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'workforce.manage');
		const memberPublicId = input.memberPublicId.trim();
		if (!memberPublicId) throw new WorkforceValidationError('An active organisation member is required.');
		const workerNumber = input.workerNumber?.trim() || null;
		if (workerNumber && workerNumber.length > 80) {
			throw new WorkforceValidationError('Worker number must not exceed 80 characters.');
		}
		const jobTitle = input.jobTitle?.trim() || null;
		if (jobTitle && jobTitle.length > 200) {
			throw new WorkforceValidationError('Job title must not exceed 200 characters.');
		}
		const startedOn = parseDateOnly(input.startedOn, 'Engagement start date');

		return this.db.transaction().execute(async (trx) => {
			const member = await trx
				.selectFrom('organisation_members as member')
				.innerJoin('users as user', 'user.id', 'member.user_id')
				.select(['member.id as memberId', 'user.display_name as displayName'])
				.where('member.organisation_id', '=', actor.organisationId)
				.where('member.public_id', '=', memberPublicId)
				.where('member.status', '=', 'active')
				.forUpdate()
				.executeTakeFirst();
			if (!member) throw new RecordNotFoundError('Active organisation member not found.');

			const existing = await new WorkforceRepository(trx).findWorkerByMemberId(
				actor.organisationId,
				member.memberId
			);
			if (existing) throw new WorkforceValidationError('That organisation member already has a workforce record.');

			const engagementType = await trx
				.selectFrom('workforce_engagement_types')
				.select('id')
				.where('code', '=', input.engagementTypeCode.trim())
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!engagementType) throw new WorkforceValidationError('A valid engagement type is required.');

			let teamId: string | null = null;
			const teamPublicId = input.teamPublicId?.trim() || null;
			if (teamPublicId) {
				const team = await trx
					.selectFrom('teams')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', teamPublicId)
					.where('is_active', '=', 1)
					.executeTakeFirst();
				if (!team) throw new WorkforceValidationError('Selected team is not available in this organisation.');
				teamId = team.id;
			}

			const publicId = randomUUID();
			const inserted = await trx
				.insertInto('workers')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					organisation_member_id: member.memberId,
					person_party_id: null,
					worker_number: workerNumber,
					display_name: member.displayName,
					status: 'active'
				})
				.executeTakeFirstOrThrow();
			if (inserted.insertId === undefined) throw new Error('Worker insert did not return an ID.');
			const workerId = inserted.insertId.toString();

			await trx
				.insertInto('worker_engagements')
				.values({
					organisation_id: actor.organisationId,
					worker_id: workerId,
					workforce_engagement_type_id: engagementType.id,
					primary_team_id: teamId,
					manager_worker_id: null,
					engagement_reference: workerNumber,
					job_title: jobTitle,
					department: null,
					started_on: startedOn,
					ended_on: null,
					engagement_status: 'active'
				})
				.executeTakeFirstOrThrow();

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: null,
				actionKey: 'workforce.worker.create',
				subjectType: 'worker',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { memberPublicId, workerNumber, jobTitle, teamPublicId, startedOn: input.startedOn }
			});

			const created = await new WorkforceRepository(trx).findWorkerByPublicId(actor.organisationId, publicId);
			if (!created) throw new Error('Created worker could not be reloaded.');
			return created;
		});
	}

	async createCompetencyType(
		actor: TenantActorContext,
		input: { code: string; name: string; description?: string | null; requiresExpiry?: boolean }
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'workforce.competency.manage');
		const code = input.code.trim().toLowerCase();
		const name = input.name.trim();
		const description = input.description?.trim() || null;
		if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(code)) {
			throw new WorkforceValidationError('Competency code must use letters, numbers, hyphens or underscores.');
		}
		if (!name || name.length > 200) throw new WorkforceValidationError('Competency name is required and must not exceed 200 characters.');
		if (description && description.length > 10000) throw new WorkforceValidationError('Competency description must not exceed 10,000 characters.');
		const publicId = randomUUID();
		try {
			await this.db.transaction().execute(async (trx) => {
				await trx
					.insertInto('competency_types')
					.values({
						organisation_id: actor.organisationId,
						public_id: publicId,
						code,
						name,
						description,
						requires_expiry: input.requiresExpiry ? 1 : 0,
						is_active: 1
					})
					.executeTakeFirstOrThrow();
				await new AuditRepository(trx).append({
					eventPublicId: randomUUID(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actor.memberId,
					projectId: null,
					actionKey: 'workforce.competency_type.create',
					subjectType: 'competency_type',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: { code, name, requiresExpiry: Boolean(input.requiresExpiry) }
				});
			});
		} catch (error) {
			if (error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'ER_DUP_ENTRY') {
				throw new WorkforceValidationError('That competency code is already in use.');
			}
			throw error;
		}
		return publicId;
	}

	async assignCompetency(
		actor: TenantActorContext,
		input: {
			workerPublicId: string;
			competencyTypePublicId: string;
			proficiencyLevel?: string | null;
			validFrom?: string | null;
			validTo?: string | null;
		}
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'workforce.competency.manage');
		const repository = new WorkforceRepository(this.db);
		const worker = await repository.findWorkerByPublicId(actor.organisationId, input.workerPublicId.trim());
		if (!worker) throw new RecordNotFoundError('Worker not found in the active organisation.');
		const competencyType = await this.db
			.selectFrom('competency_types')
			.select(['id', 'requires_expiry as requiresExpiry'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', input.competencyTypePublicId.trim())
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!competencyType) throw new WorkforceValidationError('Selected competency is not available.');
		const validFrom = parseOptionalDate(input.validFrom, 'Competency valid from');
		const validTo = parseOptionalDate(input.validTo, 'Competency valid to');
		if (validFrom && validTo && validTo < validFrom) throw new WorkforceValidationError('Competency valid-to date must not precede valid-from date.');
		if (Boolean(competencyType.requiresExpiry) && !validTo) throw new WorkforceValidationError('This competency requires an expiry date.');
		const proficiencyLevel = input.proficiencyLevel?.trim() || null;
		if (proficiencyLevel && proficiencyLevel.length > 64) throw new WorkforceValidationError('Proficiency level must not exceed 64 characters.');

		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('worker_competencies')
				.values({
					organisation_id: actor.organisationId,
					worker_id: worker.id,
					competency_type_id: competencyType.id,
					proficiency_level: proficiencyLevel,
					assessment_status: 'verified',
					assessed_on: new Date(),
					assessed_by_member_id: actor.memberId,
					valid_from: validFrom,
					valid_to: validTo,
					notes: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: null,
				actionKey: 'workforce.competency.assign',
				subjectType: 'worker',
				subjectPublicId: worker.publicId,
				correlationId: actor.correlationId,
				changeSummary: { competencyTypePublicId: input.competencyTypePublicId, proficiencyLevel, validFrom: input.validFrom ?? null, validTo: input.validTo ?? null }
			});
		});
	}

	async assignWorkerToProject(
		actor: TenantActorContext,
		input: {
			workerPublicId: string;
			projectPublicId: string;
			startsOn?: string | null;
			endsOn?: string | null;
			plannedAllocationPercent?: string | null;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'workforce.assignment.manage');
		const repository = new WorkforceRepository(this.db);
		const worker = await repository.findWorkerByPublicId(actor.organisationId, input.workerPublicId.trim());
		if (!worker) throw new RecordNotFoundError('Worker not found in the active organisation.');
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			input.projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Owned project not found in the active member scope.');
		}
		const startsOn = parseOptionalDate(input.startsOn, 'Assignment start date');
		const endsOn = parseOptionalDate(input.endsOn, 'Assignment end date');
		if (startsOn && endsOn && endsOn < startsOn) throw new WorkforceValidationError('Assignment end date must not precede start date.');
		const plannedAllocationPercent = validateOptionalAllocation(input.plannedAllocationPercent);

		const existing = await this.db
			.selectFrom('project_resource_assignments')
			.select(['starts_on as startsOn', 'ends_on as endsOn'])
			.where('organisation_id', '=', actor.organisationId)
			.where('project_id', '=', project.id)
			.where('worker_id', '=', worker.id)
			.where('assignment_status', 'in', ['planned', 'active'])
			.execute();
		if (existing.some((row) => rangesOverlap(row.startsOn, row.endsOn, startsOn, endsOn))) {
			throw new WorkforceValidationError('That worker already has an overlapping active assignment to this project.');
		}

		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('project_resource_assignments')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					project_id: project.id,
					worker_id: worker.id,
					project_role_type_id: null,
					assigned_by_member_id: actor.memberId,
					starts_on: startsOn,
					ends_on: endsOn,
					planned_allocation_percent: plannedAllocationPercent,
					assignment_status: 'active',
					notes: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'workforce.project_assignment.create',
				subjectType: 'project_resource_assignment',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { workerPublicId: worker.publicId, projectPublicId: project.publicId, plannedAllocationPercent, startsOn: input.startsOn ?? null, endsOn: input.endsOn ?? null }
			});
		});
		return publicId;
	}

	async getScheduleWorkspace(
		actor: TenantActorContext,
		input?: { from?: Date; to?: Date }
	): Promise<ScheduleWorkspace> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, ['schedule.view', 'schedule.manage']);
		const canView = decisions.get('schedule.view')?.allowed ?? false;
		const canManage = decisions.get('schedule.manage')?.allowed ?? false;
		const repository = new WorkforceRepository(this.db);
		const currentWorker = await repository.findWorkerByMemberId(actor.organisationId, actor.memberId);
		const from = input?.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		const to = input?.to ?? new Date(Date.now() + 35 * 24 * 60 * 60 * 1000);
		if (to <= from) throw new WorkforceValidationError('Schedule end must be after schedule start.');
		if (!canView) return { canView, canManage, currentWorker, events: [], workers: [], projects: [], eventTypes: [], from, to };

		const events = canManage
			? await repository.listScheduleEventsForOrganisation(actor.organisationId, to, from)
			: currentWorker
				? await repository.listScheduleEventsForWorker(actor.organisationId, currentWorker.id, to, from)
				: [];
		const assignments = await repository.listScheduleWorkerAssignments(actor.organisationId, events.map((event) => event.id));
		const workersByEvent = new Map<string, typeof assignments>();
		for (const assignment of assignments) {
			const current = workersByEvent.get(assignment.scheduleEventId) ?? [];
			current.push(assignment);
			workersByEvent.set(assignment.scheduleEventId, current);
		}
		const [workers, projects, eventTypes] = canManage
			? await Promise.all([
				repository.listWorkers(actor.organisationId),
				new ProjectRepository(this.db).listForMember(actor.organisationId, actor.memberId),
				repository.listScheduleEventTypes()
			])
			: [[], [], await repository.listScheduleEventTypes()];
		return {
			canView,
			canManage,
			currentWorker,
			events: events.map((event) => ({ ...event, workers: workersByEvent.get(event.id) ?? [] })),
			workers,
			projects: projects.filter((project) => project.owningOrganisationId === actor.organisationId),
			eventTypes,
			from,
			to
		};
	}

	async createScheduleEvent(
		actor: TenantActorContext,
		input: {
			eventTypeCode: string;
			projectPublicId?: string | null;
			workerPublicIds: string[];
			title: string;
			description?: string | null;
			startsAtLocal: string;
			endsAtLocal: string;
			timezone: string;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'schedule.manage');
		const title = input.title.trim();
		const description = input.description?.trim() || null;
		if (!title || title.length > 255) throw new WorkforceValidationError('Schedule title is required and must not exceed 255 characters.');
		if (description && description.length > 10000) throw new WorkforceValidationError('Schedule description must not exceed 10,000 characters.');
		const timezone = input.timezone.trim() || 'Europe/London';
		if (timezone.length > 64) throw new WorkforceValidationError('Timezone must not exceed 64 characters.');
		const startsAt = zonedLocalToUtc(input.startsAtLocal, timezone);
		const endsAt = zonedLocalToUtc(input.endsAtLocal, timezone);
		if (endsAt <= startsAt) throw new WorkforceValidationError('Schedule end must be after schedule start.');
		const eventType = await this.db
			.selectFrom('schedule_event_types')
			.select('id')
			.where('code', '=', input.eventTypeCode.trim())
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!eventType) throw new WorkforceValidationError('A valid schedule event type is required.');
		const workerPublicIds = [...new Set(input.workerPublicIds.map((value) => value.trim()).filter(Boolean))];
		if (workerPublicIds.length === 0) throw new WorkforceValidationError('Assign at least one worker to scheduled work.');
		const repository = new WorkforceRepository(this.db);
		const workers: WorkerRecord[] = [];
		for (const publicId of workerPublicIds) {
			const worker = await repository.findWorkerByPublicId(actor.organisationId, publicId);
			if (!worker || worker.status !== 'active') throw new WorkforceValidationError('Every scheduled worker must be active in this organisation.');
			workers.push(worker);
		}

		let project: ProjectRecord | null = null;
		const projectPublicId = input.projectPublicId?.trim() || null;
		if (projectPublicId) {
			project = await new ProjectRepository(this.db).findForMemberByPublicId(actor.organisationId, actor.memberId, projectPublicId);
			if (!project || project.owningOrganisationId !== actor.organisationId) throw new RecordNotFoundError('Owned project not found in the active member scope.');
		}

		const resourceAssignmentIdByWorker = new Map<string, string | null>();
		if (project) {
			const eventDate = new Date(Date.UTC(startsAt.getUTCFullYear(), startsAt.getUTCMonth(), startsAt.getUTCDate()));
			for (const worker of workers) {
				const assignment = await this.db
					.selectFrom('project_resource_assignments')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('project_id', '=', project.id)
					.where('worker_id', '=', worker.id)
					.where('assignment_status', 'in', ['planned', 'active'])
					.where((eb) => eb.or([eb('starts_on', 'is', null), eb('starts_on', '<=', eventDate)]))
					.where((eb) => eb.or([eb('ends_on', 'is', null), eb('ends_on', '>=', eventDate)]))
					.orderBy('id', 'desc')
					.executeTakeFirst();
				if (!assignment) throw new WorkforceValidationError(`${worker.displayName} must be staffed to the project before project work can be scheduled.`);
				resourceAssignmentIdByWorker.set(worker.id, assignment.id);
			}
		} else {
			for (const worker of workers) resourceAssignmentIdByWorker.set(worker.id, null);
		}

		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			const insert = await trx
				.insertInto('schedule_events')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					schedule_event_type_id: eventType.id,
					project_id: project?.id ?? null,
					address_id: null,
					created_by_member_id: actor.memberId,
					title,
					description,
					starts_at: startsAt,
					ends_at: endsAt,
					timezone,
					event_status: 'planned'
				})
				.executeTakeFirstOrThrow();
			if (insert.insertId === undefined) throw new Error('Schedule event insert did not return an ID.');
			const eventId = insert.insertId.toString();
			await trx
				.insertInto('schedule_event_workers')
				.values(
					workers.map((worker) => ({
						organisation_id: actor.organisationId,
						schedule_event_id: eventId,
						worker_id: worker.id,
						project_resource_assignment_id: resourceAssignmentIdByWorker.get(worker.id) ?? null,
						assigned_by_member_id: actor.memberId,
						assignment_status: 'assigned'
					}))
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project?.id ?? null,
				actionKey: 'schedule.event.create',
				subjectType: 'schedule_event',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { eventTypeCode: input.eventTypeCode, title, workerPublicIds, projectPublicId, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timezone }
			});
		});
		return publicId;
	}

	async getTimeWorkspace(actor: TenantActorContext): Promise<TimeWorkspace> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'timesheet.view',
			'timesheet.manage',
			'timesheet.submit',
			'timesheet.approve'
		]);
		const canView = decisions.get('timesheet.view')?.allowed ?? false;
		const canManageOwn = decisions.get('timesheet.manage')?.allowed ?? false;
		const canSubmitOwn = decisions.get('timesheet.submit')?.allowed ?? false;
		const canApprove = decisions.get('timesheet.approve')?.allowed ?? false;
		const repository = new WorkforceRepository(this.db);
		const currentWorker = await repository.findWorkerByMemberId(actor.organisationId, actor.memberId);
		if (!canView) return { canView, canManageOwn, canSubmitOwn, canApprove, currentWorker, ownTimesheets: [], approvalQueue: [], projectAssignments: [], assignedScheduleEvents: [] };

		const own = currentWorker ? await repository.listTimesheetsForWorker(actor.organisationId, currentWorker.id) : [];
		const queue = canApprove ? await repository.listSubmittedTimesheets(actor.organisationId) : [];
		const withEntries = async (timesheets: TimesheetRecord[]) =>
			Promise.all(timesheets.map(async (timesheet) => ({ ...timesheet, entries: await repository.listTimesheetEntries(actor.organisationId, timesheet.id) })));
		const assignments = currentWorker
			? (await repository.listProjectAssignments(actor.organisationId)).filter((assignment) => assignment.workerPublicId === currentWorker.publicId)
			: [];
		const assignedScheduleEvents = currentWorker
			? await repository.listScheduleEventsForWorker(
					actor.organisationId,
					currentWorker.id,
					new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
					new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
				)
			: [];
		return {
			canView,
			canManageOwn,
			canSubmitOwn,
			canApprove,
			currentWorker,
			ownTimesheets: await withEntries(own),
			approvalQueue: await withEntries(queue.filter((timesheet) => timesheet.workerId !== currentWorker?.id)),
			projectAssignments: assignments,
			assignedScheduleEvents
		};
	}

	async createTimesheet(
		actor: TenantActorContext,
		input: { periodStart: string; periodEnd: string }
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'timesheet.manage');
		const worker = await new WorkforceRepository(this.db).findWorkerByMemberId(actor.organisationId, actor.memberId);
		if (!worker || worker.status !== 'active') throw new WorkforceValidationError('Your organisation membership is not linked to an active workforce record.');
		const periodStart = parseDateOnly(input.periodStart, 'Timesheet period start');
		const periodEnd = parseDateOnly(input.periodEnd, 'Timesheet period end');
		if (periodEnd < periodStart) throw new WorkforceValidationError('Timesheet period end must not precede the start date.');
		const spanDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
		if (spanDays > 31) throw new WorkforceValidationError('A timesheet period must not exceed 31 days.');
		const overlapping = await this.db
			.selectFrom('timesheets')
			.select('id')
			.where('organisation_id', '=', actor.organisationId)
			.where('worker_id', '=', worker.id)
			.where('timesheet_status', '!=', 'cancelled')
			.where('period_start', '<=', periodEnd)
			.where('period_end', '>=', periodStart)
			.executeTakeFirst();
		if (overlapping) throw new WorkforceValidationError('An active timesheet already covers part of that period.');
		const publicId = randomUUID();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('timesheets')
				.values({
					organisation_id: actor.organisationId,
					public_id: publicId,
					worker_id: worker.id,
					period_start: periodStart,
					period_end: periodEnd,
					timesheet_status: 'draft',
					submitted_at: null,
					submitted_by_member_id: null,
					approved_at: null,
					approved_by_member_id: null
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: null,
				actionKey: 'timesheet.create',
				subjectType: 'timesheet',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { periodStart: input.periodStart, periodEnd: input.periodEnd }
			});
		});
		return publicId;
	}

	async addTimesheetEntry(
		actor: TenantActorContext,
		input: {
			timesheetPublicId: string;
			workDate: string;
			workedMinutes: string | number;
			projectPublicId?: string | null;
			scheduleEventPublicId?: string | null;
			description?: string | null;
			isBillable?: boolean;
		}
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'timesheet.manage');
		const repository = new WorkforceRepository(this.db);
		const worker = await repository.findWorkerByMemberId(actor.organisationId, actor.memberId);
		if (!worker) throw new WorkforceValidationError('Your membership is not linked to a workforce record.');
		const timesheet = await repository.findTimesheetByPublicId(actor.organisationId, input.timesheetPublicId.trim());
		if (!timesheet || timesheet.workerId !== worker.id) throw new RecordNotFoundError('Timesheet not found in your worker scope.');
		if (!['draft', 'rejected', 'reopened'].includes(timesheet.status)) throw new WorkforceValidationError('Submitted or approved timesheets cannot be edited.');
		const workDate = parseDateOnly(input.workDate, 'Work date');
		if (!periodIncludes(timesheet.periodStart, timesheet.periodEnd, workDate)) throw new WorkforceValidationError('Work date must fall within the timesheet period.');
		const workedMinutes = typeof input.workedMinutes === 'number' ? input.workedMinutes : Number(input.workedMinutes);
		if (!Number.isInteger(workedMinutes) || workedMinutes <= 0 || workedMinutes > 1440) throw new WorkforceValidationError('Worked minutes must be a whole number between 1 and 1440.');
		const description = input.description?.trim() || null;
		if (description && description.length > 1000) throw new WorkforceValidationError('Time-entry description must not exceed 1,000 characters.');

		let projectId: string | null = null;
		const projectPublicId = input.projectPublicId?.trim() || null;
		if (projectPublicId) {
			const project = await new ProjectRepository(this.db).findForMemberByPublicId(actor.organisationId, actor.memberId, projectPublicId);
			if (!project || project.owningOrganisationId !== actor.organisationId) throw new RecordNotFoundError('Project not found in the active member scope.');
			const assignment = await this.db
				.selectFrom('project_resource_assignments')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('project_id', '=', project.id)
				.where('worker_id', '=', worker.id)
				.where('assignment_status', 'in', ['planned', 'active'])
				.where((eb) => eb.or([eb('starts_on', 'is', null), eb('starts_on', '<=', workDate)]))
				.where((eb) => eb.or([eb('ends_on', 'is', null), eb('ends_on', '>=', workDate)]))
				.executeTakeFirst();
			if (!assignment) throw new WorkforceValidationError('You must be staffed to the project before recording project time.');
			projectId = project.id;
		}

		let scheduleEventId: string | null = null;
		const scheduleEventPublicId = input.scheduleEventPublicId?.trim() || null;
		if (scheduleEventPublicId) {
			const event = await repository.findScheduleEventByPublicId(actor.organisationId, scheduleEventPublicId);
			if (!event || !(await repository.hasScheduleWorkerAssignment(actor.organisationId, event.id, worker.id))) throw new RecordNotFoundError('Scheduled work not found in your worker scope.');
			if (projectId && event.projectId && projectId !== event.projectId) throw new WorkforceValidationError('The selected project does not match the scheduled work.');
			if (!projectId && event.projectId) projectId = event.projectId;
			scheduleEventId = event.id;
		}

		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('timesheet_entries')
				.values({
					organisation_id: actor.organisationId,
					timesheet_id: timesheet.id,
					project_id: projectId,
					schedule_event_id: scheduleEventId,
					attendance_record_id: null,
					time_activity_type_id: null,
					work_date: workDate,
					started_at: null,
					ended_at: null,
					worked_minutes: workedMinutes,
					is_billable: input.isBillable === false ? 0 : 1,
					description
				})
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId,
				actionKey: 'timesheet.entry.create',
				subjectType: 'timesheet',
				subjectPublicId: timesheet.publicId,
				correlationId: actor.correlationId,
				changeSummary: { workDate: input.workDate, workedMinutes, projectPublicId, scheduleEventPublicId, isBillable: input.isBillable !== false }
			});
		});
	}

	async submitTimesheet(actor: TenantActorContext, timesheetPublicId: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'timesheet.submit');
		const worker = await new WorkforceRepository(this.db).findWorkerByMemberId(actor.organisationId, actor.memberId);
		if (!worker) throw new WorkforceValidationError('Your membership is not linked to a workforce record.');
		await this.db.transaction().execute(async (trx) => {
			const timesheet = await trx
				.selectFrom('timesheets')
				.select(['id', 'public_id as publicId', 'worker_id as workerId', 'timesheet_status as status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', timesheetPublicId.trim())
				.forUpdate()
				.executeTakeFirst();
			if (!timesheet || timesheet.workerId !== worker.id) throw new RecordNotFoundError('Timesheet not found in your worker scope.');
			if (!['draft', 'rejected', 'reopened'].includes(timesheet.status)) throw new ConcurrentUpdateError('Only a draft, rejected or reopened timesheet can be submitted.');
			const entry = await trx
				.selectFrom('timesheet_entries')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('timesheet_id', '=', timesheet.id)
				.executeTakeFirst();
			if (!entry) throw new WorkforceValidationError('Add at least one time entry before submitting a timesheet.');
			const now = new Date();
			await trx
				.updateTable('timesheets')
				.set({ timesheet_status: 'submitted', submitted_at: now, submitted_by_member_id: actor.memberId, approved_at: null, approved_by_member_id: null })
				.where('id', '=', timesheet.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('timesheet_status_events')
				.values({ organisation_id: actor.organisationId, timesheet_id: timesheet.id, from_status: timesheet.status, to_status: 'submitted', acted_by_member_id: actor.memberId, comment: null })
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: actor.memberId, projectId: null, actionKey: 'timesheet.submit', subjectType: 'timesheet', subjectPublicId: timesheet.publicId, correlationId: actor.correlationId, changeSummary: { fromStatus: timesheet.status, toStatus: 'submitted' }
			});
		});
	}

	async decideTimesheet(
		actor: TenantActorContext,
		input: { timesheetPublicId: string; decision: 'approve' | 'reject'; comment?: string | null }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'timesheet.approve');
		const actorWorker = await new WorkforceRepository(this.db).findWorkerByMemberId(actor.organisationId, actor.memberId);
		const comment = input.comment?.trim() || null;
		if (comment && comment.length > 1000) throw new WorkforceValidationError('Approval comment must not exceed 1,000 characters.');
		await this.db.transaction().execute(async (trx) => {
			const timesheet = await trx
				.selectFrom('timesheets')
				.select(['id', 'public_id as publicId', 'worker_id as workerId', 'timesheet_status as status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', input.timesheetPublicId.trim())
				.forUpdate()
				.executeTakeFirst();
			if (!timesheet) throw new RecordNotFoundError('Submitted timesheet not found in this organisation.');
			if (actorWorker?.id === timesheet.workerId) throw new TenantAccessError('A worker cannot approve or reject their own timesheet.');
			if (timesheet.status !== 'submitted') throw new ConcurrentUpdateError('Only a submitted timesheet can be approved or rejected.');
			const now = new Date();
			const toStatus = input.decision === 'approve' ? 'approved' : 'rejected';

			if (input.decision === 'approve') {
				const entries = await trx
					.selectFrom('timesheet_entries')
					.select(['id', 'work_date as workDate', 'worked_minutes as workedMinutes'])
					.where('organisation_id', '=', actor.organisationId)
					.where('timesheet_id', '=', timesheet.id)
					.orderBy('id')
					.execute();
				const repository = new WorkforceRepository(trx);
				for (const entry of entries) {
					const existingSnapshot = await trx
						.selectFrom('timesheet_entry_cost_snapshots')
						.select('id')
						.where('organisation_id', '=', actor.organisationId)
						.where('timesheet_entry_id', '=', entry.id)
						.executeTakeFirst();
					if (existingSnapshot) continue;
					const rate = await repository.findEffectiveStandardCostRate(actor.organisationId, timesheet.workerId, entry.workDate);
					if (!rate) continue;
					if (rate.rateBasis !== 'hour') throw new WorkforceValidationError('Day-based workforce costing requires a configured day-duration policy before approval.');
					await trx
						.insertInto('timesheet_entry_cost_snapshots')
						.values({
							organisation_id: actor.organisationId,
							timesheet_entry_id: entry.id,
							source_worker_cost_rate_id: rate.id,
							worker_cost_rate_type_id: rate.workerCostRateTypeId,
							sort_order: 1,
							currency_code: rate.currencyCode,
							rate_basis: rate.rateBasis,
							rate_amount: rate.amount,
							costed_minutes: entry.workedMinutes,
							cost_amount: calculateHourlyCost(rate.amount, entry.workedMinutes)
						})
						.executeTakeFirstOrThrow();
				}
			}

			await trx
				.updateTable('timesheets')
				.set({
					timesheet_status: toStatus,
					approved_at: input.decision === 'approve' ? now : null,
					approved_by_member_id: input.decision === 'approve' ? actor.memberId : null
				})
				.where('id', '=', timesheet.id)
				.where('organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('timesheet_status_events')
				.values({ organisation_id: actor.organisationId, timesheet_id: timesheet.id, from_status: 'submitted', to_status: toStatus, acted_by_member_id: actor.memberId, comment })
				.executeTakeFirstOrThrow();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(), actingOrganisationId: actor.organisationId, actorUserId: actor.userId, actorMemberId: actor.memberId, projectId: null, actionKey: input.decision === 'approve' ? 'timesheet.approve' : 'timesheet.reject', subjectType: 'timesheet', subjectPublicId: timesheet.publicId, correlationId: actor.correlationId, changeSummary: { fromStatus: 'submitted', toStatus, comment }
			});
		});
	}
}
