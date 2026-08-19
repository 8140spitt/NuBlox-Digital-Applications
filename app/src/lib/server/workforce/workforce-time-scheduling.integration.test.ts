import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';
import { ensureWorkforceStandardRoleDefaults } from './workforce-bootstrap';
import { WorkforceRepository } from './workforce-repository';
import { WorkforceService, WorkforceValidationError } from './workforce-service';

const PREFIX = 'Workforce Slice 2 Integration ';
const PROJECT_PREFIX = 'WS2-';

let db: Database;
let organisationId = '';
let managerUserId = '';
let workerUserId = '';
let observerUserId = '';
let managerMemberId = '';
let workerMemberId = '';
let observerMemberId = '';
let actorManager: TenantActorContext;
let actorWorker: TenantActorContext;
let actorObserver: TenantActorContext;
let workerPublicId = '';
let observerWorkerPublicId = '';
let workerId = '';
let projectId = '';
let projectPublicId = '';
let scheduleEventPublicId = '';
let timesheetPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
		const projects = await db
			.selectFrom('projects')
			.select('id')
			.where('owning_organisation_id', 'in', organisationIds)
			.where('project_number', 'like', `${PROJECT_PREFIX}%`)
			.execute();
		const projectIds = projects.map((row) => row.id);

		await db
			.deleteFrom('timesheet_entry_cost_snapshots')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('timesheet_status_events')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('timesheet_entries')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('timesheets').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('schedule_event_workers')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('schedule_events')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('project_resource_assignments')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('worker_competencies')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('competency_types')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('worker_cost_rates')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('worker_engagements')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('workers').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();

		if (projectIds.length > 0) {
			await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
			await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
			await db
				.deleteFrom('project_organisation_roles')
				.where('project_id', 'in', projectIds)
				.execute();
			await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
			await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
		}

		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisation: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisation,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-19T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisation: string,
	memberId: string,
	name: string,
	permissionKeys: readonly string[]
): Promise<string> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisation,
				public_id: randomUUID(),
				name,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [...permissionKeys])
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	if (permissions.length > 0) {
		await db
			.insertInto('role_permissions')
			.values(
				permissions.map((permission) => ({
					organisation_id: organisation,
					organisation_role_id: roleId,
					permission_id: permission.id
				}))
			)
			.execute();
	}
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisation,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
	return roleId;
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	managerUserId = await createUser('Manager');
	workerUserId = await createUser('Worker');
	observerUserId = await createUser('Observer');
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	managerMemberId = await createMember(organisationId, managerUserId);
	workerMemberId = await createMember(organisationId, workerUserId);
	observerMemberId = await createMember(organisationId, observerUserId);

	await assignPermissionRole(organisationId, managerMemberId, `${PREFIX}Manager Role`, [
		'project.create',
		'project.view',
		'project.manage',
		'workforce.view',
		'workforce.manage',
		'workforce.competency.manage',
		'workforce.assignment.manage',
		'schedule.view',
		'schedule.manage',
		'timesheet.view',
		'timesheet.approve'
	]);
	await assignPermissionRole(organisationId, workerMemberId, `${PREFIX}Worker Role`, [
		'project.view',
		'workforce.view',
		'schedule.view',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit',
		'timesheet.approve'
	]);
	await assignPermissionRole(organisationId, observerMemberId, `${PREFIX}Observer Role`, [
		'project.view',
		'workforce.view',
		'schedule.view',
		'timesheet.view'
	]);

	actorManager = {
		organisationId,
		userId: managerUserId,
		memberId: managerMemberId,
		correlationId: `workforce-manager-${randomUUID()}`
	};
	actorWorker = {
		organisationId,
		userId: workerUserId,
		memberId: workerMemberId,
		correlationId: `workforce-worker-${randomUUID()}`
	};
	actorObserver = {
		organisationId,
		userId: observerUserId,
		memberId: observerMemberId,
		correlationId: `workforce-observer-${randomUUID()}`
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('V1 workforce, schedule and time activation', () => {
	it('seeds standard workforce role defaults for newly created organisation roles', async () => {
		const standardRoleId = insertedId(
			await db
				.insertInto('organisation_roles')
				.values({
					organisation_id: organisationId,
					public_id: randomUUID(),
					name: 'Field Worker',
					is_active: 1
				})
				.executeTakeFirstOrThrow()
		);
		await ensureWorkforceStandardRoleDefaults(db, organisationId);
		const keys = await db
			.selectFrom('role_permissions as grant')
			.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
			.select('permission.permission_key as permissionKey')
			.where('grant.organisation_id', '=', organisationId)
			.where('grant.organisation_role_id', '=', standardRoleId)
			.orderBy('permission.permission_key')
			.execute();
		expect(keys.map((row) => row.permissionKey)).toEqual([
			'schedule.view',
			'timesheet.manage',
			'timesheet.submit',
			'timesheet.view',
			'workforce.view'
		]);
	});

	it('creates workforce identities and competency evidence without duplicating organisation members', async () => {
		const service = new WorkforceService(db);
		const workerMember = await db
			.selectFrom('organisation_members')
			.select('public_id as publicId')
			.where('id', '=', workerMemberId)
			.executeTakeFirstOrThrow();
		const observerMember = await db
			.selectFrom('organisation_members')
			.select('public_id as publicId')
			.where('id', '=', observerMemberId)
			.executeTakeFirstOrThrow();

		const worker = await service.createWorkerFromMember(actorManager, {
			memberPublicId: workerMember.publicId,
			workerNumber: 'WS2-001',
			engagementTypeCode: 'employee',
			jobTitle: 'Site Engineer',
			startedOn: '2026-08-01'
		});
		workerPublicId = worker.publicId;
		workerId = worker.id;
		const observer = await service.createWorkerFromMember(actorManager, {
			memberPublicId: observerMember.publicId,
			workerNumber: 'WS2-002',
			engagementTypeCode: 'employee',
			jobTitle: 'Observer',
			startedOn: '2026-08-01'
		});
		observerWorkerPublicId = observer.publicId;

		await expect(
			service.createWorkerFromMember(actorManager, {
				memberPublicId: workerMember.publicId,
				workerNumber: 'WS2-DUP',
				engagementTypeCode: 'employee',
				startedOn: '2026-08-01'
			})
		).rejects.toBeInstanceOf(WorkforceValidationError);

		const competencyTypePublicId = await service.createCompetencyType(actorManager, {
			code: 'ecs-card',
			name: 'ECS Card',
			requiresExpiry: true
		});
		await service.assignCompetency(actorManager, {
			workerPublicId,
			competencyTypePublicId,
			proficiencyLevel: 'Skilled worker',
			validFrom: '2026-01-01',
			validTo: '2028-01-01'
		});
		const people = await service.getPeopleWorkspace(actorManager);
		const reloaded = people.workers.find((candidate) => candidate.publicId === workerPublicId);
		expect(reloaded?.competencies.map((competency) => competency.competencyName)).toEqual([
			'ECS Card'
		]);
	});

	it('requires project staffing before project work can be scheduled and scopes schedule visibility to assigned workers', async () => {
		const project = await new ProjectWorkspaceService(db).createProject(actorManager, {
			projectNumber: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
			name: 'Slice 2 staffed project'
		});
		projectId = project.id;
		projectPublicId = project.publicId;
		await new ProjectRepository(db).insertProjectMember(
			project.id,
			organisationId,
			workerMemberId,
			new Date('2026-08-19T09:00:00.000Z')
		);
		await new ProjectRepository(db).insertProjectMember(
			project.id,
			organisationId,
			observerMemberId,
			new Date('2026-08-19T09:00:00.000Z')
		);

		const service = new WorkforceService(db);
		await expect(
			service.createScheduleEvent(actorManager, {
				eventTypeCode: 'work_session',
				projectPublicId,
				workerPublicIds: [workerPublicId],
				title: 'Unstaffed work session',
				startsAtLocal: '2026-08-20T08:00',
				endsAtLocal: '2026-08-20T16:00',
				timezone: 'Europe/London'
			})
		).rejects.toBeInstanceOf(WorkforceValidationError);

		await service.assignWorkerToProject(actorManager, {
			workerPublicId,
			projectPublicId,
			startsOn: '2026-08-01',
			plannedAllocationPercent: '100'
		});
		scheduleEventPublicId = await service.createScheduleEvent(actorManager, {
			eventTypeCode: 'work_session',
			projectPublicId,
			workerPublicIds: [workerPublicId],
			title: 'Install containment',
			description: 'Assigned project work for the workforce browser and service workflow.',
			startsAtLocal: '2026-08-20T08:00',
			endsAtLocal: '2026-08-20T16:00',
			timezone: 'Europe/London'
		});

		const workerSchedule = await service.getScheduleWorkspace(actorWorker, {
			from: new Date('2026-08-20T00:00:00.000Z'),
			to: new Date('2026-08-21T00:00:00.000Z')
		});
		expect(workerSchedule.canManage).toBe(false);
		expect(workerSchedule.events.map((event) => event.publicId)).toEqual([scheduleEventPublicId]);
		const observerSchedule = await service.getScheduleWorkspace(actorObserver, {
			from: new Date('2026-08-20T00:00:00.000Z'),
			to: new Date('2026-08-21T00:00:00.000Z')
		});
		expect(observerSchedule.currentWorker?.publicId).toBe(observerWorkerPublicId);
		expect(observerSchedule.events).toHaveLength(0);
	});

	it('allows only the worker to create, edit and submit their own staffed time', async () => {
		const standardRateType = await db
			.selectFrom('worker_cost_rate_types')
			.select('id')
			.where('code', '=', 'standard')
			.executeTakeFirstOrThrow();
		await db
			.insertInto('worker_cost_rates')
			.values({
				organisation_id: organisationId,
				worker_id: workerId,
				worker_cost_rate_type_id: standardRateType.id,
				currency_code: 'GBP',
				rate_basis: 'hour',
				amount: '30.0000',
				valid_from: new Date('2026-08-01T00:00:00.000Z'),
				valid_to: null,
				created_by_member_id: managerMemberId
			})
			.executeTakeFirstOrThrow();

		const service = new WorkforceService(db);
		timesheetPublicId = await service.createTimesheet(actorWorker, {
			periodStart: '2026-08-17',
			periodEnd: '2026-08-23'
		});
		await expect(
			service.addTimesheetEntry(actorObserver, {
				timesheetPublicId,
				workDate: '2026-08-20',
				workedMinutes: 60
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		await service.addTimesheetEntry(actorWorker, {
			timesheetPublicId,
			workDate: '2026-08-20',
			workedMinutes: 480,
			projectPublicId,
			scheduleEventPublicId,
			description: 'Installed containment',
			isBillable: true
		});
		await service.submitTimesheet(actorWorker, timesheetPublicId);
		await expect(
			service.addTimesheetEntry(actorWorker, {
				timesheetPublicId,
				workDate: '2026-08-21',
				workedMinutes: 60
			})
		).rejects.toBeInstanceOf(WorkforceValidationError);

		const submitted = await new WorkforceRepository(db).findTimesheetByPublicId(
			organisationId,
			timesheetPublicId
		);
		expect(submitted?.status).toBe('submitted');
	});

	it('prevents self-approval and creates immutable cost evidence on independent approval', async () => {
		const service = new WorkforceService(db);
		await expect(
			service.decideTimesheet(actorWorker, {
				timesheetPublicId,
				decision: 'approve'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		await service.decideTimesheet(actorManager, {
			timesheetPublicId,
			decision: 'approve',
			comment: 'Checked against staffed work.'
		});
		const approved = await new WorkforceRepository(db).findTimesheetByPublicId(
			organisationId,
			timesheetPublicId
		);
		expect(approved?.status).toBe('approved');

		const snapshot = await db
			.selectFrom('timesheet_entry_cost_snapshots')
			.select([
				'rate_amount as rateAmount',
				'costed_minutes as costedMinutes',
				'cost_amount as costAmount'
			])
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(snapshot).toMatchObject({
			rateAmount: '30.0000',
			costedMinutes: 480,
			costAmount: '240.0000'
		});

		await db
			.updateTable('worker_cost_rates')
			.set({ amount: '45.0000' })
			.where('organisation_id', '=', organisationId)
			.where('worker_id', '=', workerId)
			.execute();
		const unchanged = await db
			.selectFrom('timesheet_entry_cost_snapshots')
			.select(['rate_amount as rateAmount', 'cost_amount as costAmount'])
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(unchanged).toEqual({ rateAmount: '30.0000', costAmount: '240.0000' });
	});

	it('does not expose another organisation worker identifier through active-tenant services', async () => {
		const otherOrganisationId = insertedId(
			await db
				.insertInto('organisations')
				.values({
					public_id: randomUUID(),
					legal_name: `${PREFIX}Other Organisation`,
					status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
		const otherUserId = await createUser('Other Manager');
		const otherMemberId = await createMember(otherOrganisationId, otherUserId);
		await assignPermissionRole(otherOrganisationId, otherMemberId, `${PREFIX}Other Role`, [
			'workforce.view',
			'workforce.assignment.manage',
			'schedule.view',
			'schedule.manage'
		]);
		const otherActor: TenantActorContext = {
			organisationId: otherOrganisationId,
			userId: otherUserId,
			memberId: otherMemberId,
			correlationId: `workforce-other-${randomUUID()}`
		};
		await expect(
			new WorkforceService(db).assignWorkerToProject(otherActor, {
				workerPublicId,
				projectPublicId
			})
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
