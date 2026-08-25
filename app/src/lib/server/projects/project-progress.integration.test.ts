import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectPlanService } from './project-plan-service';
import { ProjectProgressService, ProjectProgressValidationError } from './project-progress-service';

const PREFIX = 'Project Progress Integration ';
const PROJECT_PREFIX = 'PGR-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let externalMemberId = '';
let ownerUserId = '';
let viewerUserId = '';
let externalUserId = '';
let projectId = '';
let projectPublicId = '';
let activityAPublicId = '';
let activityBPublicId = '';
let planBaselinePublicId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;
let external: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const projects = await db.selectFrom('projects').select('id').where('project_number', 'like', `${PROJECT_PREFIX}%`).execute();
	const projectIds = projects.map((row) => row.id);
	if (projectIds.length) {
		await db.deleteFrom('project_activity_progress_measurements').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_progress_periods').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_earned_value_baseline_allocations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_earned_value_baselines').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_direct_costs').where('project_id', 'in', projectIds).execute();
		const budgets = await db.selectFrom('project_budgets').select('id').where('project_id', 'in', projectIds).execute();
		const budgetIds = budgets.map((row) => row.id);
		if (budgetIds.length) {
			const versions = await db.selectFrom('project_budget_versions').select('id').where('project_budget_id', 'in', budgetIds).execute();
			const versionIds = versions.map((row) => row.id);
			if (versionIds.length) await db.deleteFrom('project_budget_lines').where('project_budget_version_id', 'in', versionIds).execute();
			await db.deleteFrom('project_budget_versions').where('project_budget_id', 'in', budgetIds).execute();
			await db.deleteFrom('project_budgets').where('id', 'in', budgetIds).execute();
		}
		await db.deleteFrom('project_cost_codes').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_baseline_dependencies').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_baseline_activities').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_baselines').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_dependencies').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_activities').where('project_id', 'in', projectIds).execute();
		await db.updateTable('project_wbs_nodes').set({ parent_wbs_node_id: null }).where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_wbs_nodes').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('audit_events').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisation_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}
	const organisations = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length) {
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(label: string): Promise<string> {
	return insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}${label}`, default_timezone: 'Europe/London', default_currency_code: 'GBP', status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: new Date('2026-08-25T08:00:00.000Z') }).executeTakeFirstOrThrow());
}

async function assignPermissionRole(organisationId: string, memberId: string, label: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${label}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	externalUserId = await createUser('External');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	externalMemberId = await createMember(organisationBId, externalUserId);
	await assignPermissionRole(organisationAId, ownerMemberId, 'Owner controls', [
		'project.view','project.plan.view','project.plan.manage','project.plan.baseline.manage',
		'project.progress.view','project.progress.manage','project.progress.approve','project.progress.baseline.manage',
		'commercial.forecast.view'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'Progress viewer', ['project.view','project.progress.view','commercial.forecast.view']);
	await assignPermissionRole(organisationBId, externalMemberId, 'External progress viewer', ['project.view','project.progress.view','commercial.forecast.view']);

	projectPublicId = randomUUID();
	projectId = insertedId(await db.insertInto('projects').values({ owning_organisation_id: organisationAId, public_id: projectPublicId, project_number: `${PROJECT_PREFIX}${randomUUID().slice(0,8)}`, name: `${PREFIX}Controlled delivery`, status: 'active', created_by_member_id: ownerMemberId }).executeTakeFirstOrThrow());
	await db.insertInto('project_organisations').values([
		{ project_id: projectId, participant_organisation_id: organisationAId, status: 'active', invited_by_member_id: null, joined_at: new Date('2026-08-25T08:30:00.000Z'), left_at: null },
		{ project_id: projectId, participant_organisation_id: organisationBId, status: 'active', invited_by_member_id: ownerMemberId, joined_at: new Date('2026-08-25T08:35:00.000Z'), left_at: null }
	]).execute();
	await db.insertInto('project_members').values([
		{ project_id: projectId, participant_organisation_id: organisationAId, organisation_member_id: ownerMemberId, status: 'active', joined_at: new Date('2026-08-25T08:30:00.000Z'), left_at: null },
		{ project_id: projectId, participant_organisation_id: organisationAId, organisation_member_id: viewerMemberId, status: 'active', joined_at: new Date('2026-08-25T08:31:00.000Z'), left_at: null },
		{ project_id: projectId, participant_organisation_id: organisationBId, organisation_member_id: externalMemberId, status: 'active', joined_at: new Date('2026-08-25T08:35:00.000Z'), left_at: null }
	]).execute();
	owner = { organisationId: organisationAId, userId: ownerUserId, memberId: ownerMemberId, correlationId: `progress-owner-${randomUUID()}` };
	viewer = { organisationId: organisationAId, userId: viewerUserId, memberId: viewerMemberId, correlationId: `progress-viewer-${randomUUID()}` };
	external = { organisationId: organisationBId, userId: externalUserId, memberId: externalMemberId, correlationId: `progress-external-${randomUUID()}` };

	const category = await db.selectFrom('commercial_cost_categories').select('id').where('code', '=', 'material').executeTakeFirstOrThrow();
	const costCodeId = insertedId(await db.insertInto('project_cost_codes').values({ organisation_id: organisationAId, project_id: projectId, public_id: randomUUID(), commercial_cost_category_id: category.id, parent_cost_code_id: null, code: 'PGR-001', name: 'Project control budget', description: null, sort_order: 1, is_active: 1 }).executeTakeFirstOrThrow());
	const budgetId = insertedId(await db.insertInto('project_budgets').values({ organisation_id: organisationAId, project_id: projectId, public_id: randomUUID(), budget_number: 'PGR-BUD-001', name: 'Performance budget', lifecycle_status: 'active', created_by_member_id: ownerMemberId }).executeTakeFirstOrThrow());
	const approvedAt = new Date('2026-08-01T08:00:00.000Z');
	const versionId = insertedId(await db.insertInto('project_budget_versions').values({ organisation_id: organisationAId, project_budget_id: budgetId, version_number: 1, currency_code: 'GBP', version_status: 'approved', effective_on: new Date('2026-08-01T00:00:00.000Z'), created_by_member_id: ownerMemberId, approved_by_member_id: ownerMemberId, approved_at: approvedAt, locked_at: approvedAt }).executeTakeFirstOrThrow());
	await db.insertInto('project_budget_lines').values({ organisation_id: organisationAId, project_budget_version_id: versionId, project_cost_code_id: costCodeId, line_number: 1, description: 'Performance budget', budget_amount: '1000.0000' }).executeTakeFirstOrThrow();
	await db.insertInto('project_direct_costs').values({ organisation_id: organisationAId, project_id: projectId, project_cost_code_id: costCodeId, public_id: randomUUID(), direct_cost_number: 'PGR-DC-001', entry_type: 'actual', transaction_date: new Date('2026-08-15T00:00:00.000Z'), party_id: null, description: 'Actual cost through data date', amount: '200.0000', currency_code: 'GBP', source_system: null, source_reference: null, lifecycle_status: 'posted', created_by_member_id: ownerMemberId, posted_by_member_id: ownerMemberId, posted_at: new Date('2026-08-15T12:00:00.000Z') }).executeTakeFirstOrThrow();

	const plan = new ProjectPlanService(db);
	const wbs = await plan.createWbsNode(owner, { projectPublicId, wbsCode: '1', name: 'Delivery', sortOrder: 1 });
	const activityA = await plan.createActivity(owner, { projectPublicId, wbsNodePublicId: wbs.publicId, activityCode: 'A100', name: 'Foundations', activityKind: 'activity', plannedStartOn: new Date('2026-08-01T00:00:00.000Z'), plannedFinishOn: new Date('2026-08-20T00:00:00.000Z'), plannedDurationDays: 20 });
	const activityB = await plan.createActivity(owner, { projectPublicId, wbsNodePublicId: wbs.publicId, activityCode: 'A200', name: 'Structure', activityKind: 'activity', plannedStartOn: new Date('2026-08-21T00:00:00.000Z'), plannedFinishOn: new Date('2026-08-31T00:00:00.000Z'), plannedDurationDays: 11 });
	activityAPublicId = activityA.publicId;
	activityBPublicId = activityB.publicId;
	const baseline = await plan.captureBaseline(owner, { projectPublicId, name: 'Contract programme' });
	planBaselinePublicId = baseline.publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project progress and earned value', () => {
	it('creates and approves a performance baseline that reconciles to control budget', async () => {
		const service = new ProjectProgressService(db, randomUUID, () => new Date('2026-08-25T10:00:00.000Z'));
		const evBaselinePublicId = await service.createEarnedValueBaseline(owner, { projectPublicId, planBaselinePublicId, name: 'Performance baseline 1' });
		await service.setEarnedValueAllocation(owner, { projectPublicId, earnedValueBaselinePublicId: evBaselinePublicId, activityPublicId: activityAPublicId, budgetAtCompletionAmount: '600.00' });
		await expect(service.approveEarnedValueBaseline(owner, projectPublicId, evBaselinePublicId)).rejects.toThrow(ProjectProgressValidationError);
		await service.setEarnedValueAllocation(owner, { projectPublicId, earnedValueBaselinePublicId: evBaselinePublicId, activityPublicId: activityBPublicId, budgetAtCompletionAmount: '400.00' });
		await service.approveEarnedValueBaseline(owner, projectPublicId, evBaselinePublicId);
		const workspace = await service.getWorkspace(viewer, projectPublicId, { baselinePublicId: evBaselinePublicId, dataDate: new Date('2026-08-15T00:00:00.000Z') });
		expect(workspace.selectedEarnedValueBaseline?.status).toBe('approved');
		expect(workspace.selectedEarnedValueBaseline?.allocatedBudget).toBe('1000.0000');
	});

	it('records, submits and approves immutable official progress and derives PV EV AC CPI and SPI', async () => {
		const service = new ProjectProgressService(db, randomUUID, () => new Date('2026-08-25T11:00:00.000Z'));
		const periodPublicId = await service.createProgressPeriod(owner, { projectPublicId, label: 'Mid-August progress', dataDate: new Date('2026-08-15T00:00:00.000Z') });
		await service.recordActivityProgress(owner, { projectPublicId, periodPublicId, activityPublicId: activityAPublicId, measurementMethod: 'manual_percent', percentComplete: 50, actualStartOn: new Date('2026-08-01T00:00:00.000Z'), remainingDurationDays: 10, commentary: 'Measured foundations installed.' });
		await service.recordActivityProgress(owner, { projectPublicId, periodPublicId, activityPublicId: activityBPublicId, measurementMethod: 'manual_percent', percentComplete: 0, remainingDurationDays: 11 });
		await service.submitProgressPeriod(owner, projectPublicId, periodPublicId);
		await service.approveProgressPeriod(owner, projectPublicId, periodPublicId);
		await expect(service.recordActivityProgress(owner, { projectPublicId, periodPublicId, activityPublicId: activityAPublicId, measurementMethod: 'manual_percent', percentComplete: 60, actualStartOn: new Date('2026-08-01T00:00:00.000Z') })).rejects.toThrow(ProjectProgressValidationError);

		const workspace = await service.getWorkspace(viewer, projectPublicId, { periodPublicId, dataDate: new Date('2026-08-15T00:00:00.000Z') });
		expect(workspace.earnedValue.available).toBe(true);
		expect(workspace.earnedValue.budgetAtCompletion).toBe('1000.0000');
		expect(workspace.earnedValue.plannedValue).toBe('450.0000');
		expect(workspace.earnedValue.earnedValue).toBe('300.0000');
		expect(workspace.earnedValue.actualCost).toBe('200.0000');
		expect(workspace.earnedValue.scheduleVariance).toBe('-150.0000');
		expect(workspace.earnedValue.costVariance).toBe('100.0000');
		expect(workspace.earnedValue.schedulePerformanceIndex).toBeCloseTo(2 / 3, 4);
		expect(workspace.earnedValue.costPerformanceIndex).toBeCloseTo(1.5, 4);
	});

	it('allows external progress visibility but contains owner financial performance and mutations', async () => {
		const service = new ProjectProgressService(db);
		const workspace = await service.getWorkspace(external, projectPublicId);
		expect(workspace.canManageProgress).toBe(false);
		expect(workspace.canViewFinancialPerformance).toBe(false);
		expect(workspace.earnedValue.available).toBe(false);
		await expect(service.createProgressPeriod(external, { projectPublicId, label: 'External attempt', dataDate: new Date('2026-08-31T00:00:00.000Z') })).rejects.toBeInstanceOf(TenantAccessError);
	});
});
