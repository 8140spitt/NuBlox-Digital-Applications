import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import {
	ProjectFinancialControlService,
	ProjectFinancialControlValidationError
} from './project-financial-control-service';

const PREFIX = 'Project Financial Integration ';
const PROJECT_PREFIX = 'PFI-';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let preparerUserId = '';
let approverUserId = '';
let viewerUserId = '';
let externalUserId = '';
let preparerMemberId = '';
let approverMemberId = '';
let viewerMemberId = '';
let externalMemberId = '';
let projectId = '';
let projectPublicId = '';
let costCodePublicId = '';
let preparer: TenantActorContext;
let approver: TenantActorContext;
let viewer: TenantActorContext;
let external: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);
	if (projectIds.length > 0) {
		const forecasts = await db
			.selectFrom('commercial_forecasts')
			.select('id')
			.where('project_id', 'in', projectIds)
			.execute();
		const forecastIds = forecasts.map((row) => row.id);
		if (forecastIds.length > 0) {
			await db
				.deleteFrom('commercial_forecast_cash_flow_lines')
				.where('commercial_forecast_id', 'in', forecastIds)
				.execute();
			await db
				.deleteFrom('commercial_forecast_lines')
				.where('commercial_forecast_id', 'in', forecastIds)
				.execute();
		}
		await db.deleteFrom('commercial_forecasts').where('project_id', 'in', projectIds).execute();
		await db
			.deleteFrom('commercial_reporting_periods')
			.where('project_id', 'in', projectIds)
			.execute();
		await db.deleteFrom('project_direct_cost_reversals').where('organisation_id', '=', organisationAId || '0').execute();
		await db.deleteFrom('project_direct_costs').where('project_id', 'in', projectIds).execute();
		const budgets = await db
			.selectFrom('project_budgets')
			.select('id')
			.where('project_id', 'in', projectIds)
			.execute();
		const budgetIds = budgets.map((row) => row.id);
		if (budgetIds.length > 0) {
			const versions = await db
				.selectFrom('project_budget_versions')
				.select('id')
				.where('project_budget_id', 'in', budgetIds)
				.execute();
			const versionIds = versions.map((row) => row.id);
			if (versionIds.length > 0) {
				await db.deleteFrom('project_budget_lines').where('project_budget_version_id', 'in', versionIds).execute();
			}
			await db.deleteFrom('project_budget_versions').where('project_budget_id', 'in', budgetIds).execute();
			await db.deleteFrom('project_budgets').where('id', 'in', budgetIds).execute();
		}
		await db.deleteFrom('project_cost_codes').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('audit_events').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisation_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
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
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${label}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-24T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db
		.insertInto('role_permissions')
		.values(
			permissions.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: roleId,
				permission_id: permission.id
			}))
		)
		.execute();
	await db
		.insertInto('member_roles')
		.values({
			organisation_id: organisationId,
			organisation_member_id: memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	preparerUserId = await createUser('Preparer');
	approverUserId = await createUser('Approver');
	viewerUserId = await createUser('Viewer');
	externalUserId = await createUser('External');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	preparerMemberId = await createMember(organisationAId, preparerUserId);
	approverMemberId = await createMember(organisationAId, approverUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	externalMemberId = await createMember(organisationBId, externalUserId);

	await assignPermissionRole(organisationAId, preparerMemberId, 'Forecast preparer', [
		'project.view',
		'commercial.forecast.view',
		'commercial.forecast.manage',
		'commercial.cash_flow.manage'
	]);
	await assignPermissionRole(organisationAId, approverMemberId, 'Forecast approver', [
		'project.view',
		'commercial.forecast.view',
		'commercial.forecast.approve'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'Forecast viewer', [
		'project.view',
		'commercial.forecast.view'
	]);
	await assignPermissionRole(organisationBId, externalMemberId, 'External forecast viewer', [
		'project.view',
		'commercial.forecast.view'
	]);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`,
				name: `${PREFIX}Controlled project`,
				status: 'active',
				created_by_member_id: preparerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values([
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				status: 'active',
				invited_by_member_id: null,
				joined_at: new Date('2026-08-24T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				status: 'active',
				invited_by_member_id: preparerMemberId,
				joined_at: new Date('2026-08-24T08:35:00.000Z'),
				left_at: null
			}
		])
		.execute();
	await db
		.insertInto('project_members')
		.values([
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: preparerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:30:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: approverMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:31:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationAId,
				organisation_member_id: viewerMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:32:00.000Z'),
				left_at: null
			},
			{
				project_id: projectId,
				participant_organisation_id: organisationBId,
				organisation_member_id: externalMemberId,
				status: 'active',
				joined_at: new Date('2026-08-24T08:35:00.000Z'),
				left_at: null
			}
		])
		.execute();

	preparer = {
		organisationId: organisationAId,
		userId: preparerUserId,
		memberId: preparerMemberId,
		correlationId: `financial-preparer-${randomUUID()}`
	};
	approver = {
		organisationId: organisationAId,
		userId: approverUserId,
		memberId: approverMemberId,
		correlationId: `financial-approver-${randomUUID()}`
	};
	viewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: `financial-viewer-${randomUUID()}`
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: `financial-external-${randomUUID()}`
	};

	const materialCategory = await db
		.selectFrom('commercial_cost_categories')
		.select('id')
		.where('code', '=', 'material')
		.executeTakeFirstOrThrow();
	costCodePublicId = randomUUID();
	const costCodeId = insertedId(
		await db
			.insertInto('project_cost_codes')
			.values({
				organisation_id: organisationAId,
				project_id: projectId,
				public_id: costCodePublicId,
				commercial_cost_category_id: materialCategory.id,
				parent_cost_code_id: null,
				code: 'MAT-001',
				name: 'Materials',
				description: 'Governed financial-control integration cost code.',
				sort_order: 1,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const budgetId = insertedId(
		await db
			.insertInto('project_budgets')
			.values({
				organisation_id: organisationAId,
				project_id: projectId,
				public_id: randomUUID(),
				budget_number: 'PFI-BUD-001',
				name: 'Approved integration baseline',
				lifecycle_status: 'active',
				created_by_member_id: preparerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	const approvedAt = new Date('2026-08-01T10:00:00.000Z');
	const budgetVersionId = insertedId(
		await db
			.insertInto('project_budget_versions')
			.values({
				organisation_id: organisationAId,
				project_budget_id: budgetId,
				version_number: 1,
				currency_code: 'GBP',
				version_status: 'approved',
				effective_on: new Date('2026-08-01T00:00:00.000Z'),
				created_by_member_id: preparerMemberId,
				approved_by_member_id: approverMemberId,
				approved_at: approvedAt,
				locked_at: approvedAt
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_budget_lines')
		.values({
			organisation_id: organisationAId,
			project_budget_version_id: budgetVersionId,
			project_cost_code_id: costCodeId,
			line_number: 1,
			description: 'Material budget',
			budget_amount: '1000.0000'
		})
		.executeTakeFirstOrThrow();
	await db
		.insertInto('project_direct_costs')
		.values({
			organisation_id: organisationAId,
			project_id: projectId,
			project_cost_code_id: costCodeId,
			public_id: randomUUID(),
			direct_cost_number: 'PFI-DC-001',
			entry_type: 'actual',
			transaction_date: new Date('2026-08-15T00:00:00.000Z'),
			party_id: null,
			description: 'Integration actual cost',
			amount: '100.0000',
			currency_code: 'GBP',
			source_system: null,
			source_reference: null,
			lifecycle_status: 'posted',
			created_by_member_id: preparerMemberId,
			posted_by_member_id: preparerMemberId,
			posted_at: new Date('2026-08-15T12:00:00.000Z')
		})
		.executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('project financial control', () => {
	it('derives the live position from canonical budget and actual facts', async () => {
		const workspace = await new ProjectFinancialControlService(db).getWorkspace(
			viewer,
			projectPublicId,
			new Date('2026-08-31T00:00:00.000Z')
		);
		expect(workspace.currencyCode).toBe('GBP');
		expect(workspace.totals.controlBudget).toBe('1000.0000');
		expect(workspace.totals.actualCost).toBe('100.0000');
		expect(workspace.costCodes).toHaveLength(1);
		expect(workspace.costCodes[0].directActual).toBe('100.0000');
		expect(workspace.costCodes[0].forecastAtCompletion).toBeNull();
	});

	it('contains owner financial facts from external project participants', async () => {
		await expect(
			new ProjectFinancialControlService(db).getWorkspace(external, projectPublicId)
		).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('creates a cut-off snapshot and enforces preparer/approver segregation and cash reconciliation', async () => {
		const service = new ProjectFinancialControlService(
			db,
			randomUUID,
			() => new Date('2026-09-03T10:00:00.000Z')
		);
		const periodPublicId = await service.createReportingPeriod(preparer, {
			projectPublicId,
			periodLabel: 'August 2026',
			periodStart: new Date('2026-08-01T00:00:00.000Z'),
			periodEnd: new Date('2026-08-31T00:00:00.000Z')
		});
		const forecastPublicId = await service.createForecast(preparer, {
			projectPublicId,
			periodPublicId,
			forecastRevenueAmount: '1500.00'
		});

		let workspace = await service.getWorkspace(preparer, projectPublicId, null, forecastPublicId);
		expect(workspace.activeForecast?.forecast.status).toBe('draft');
		expect(workspace.activeForecast?.forecastToComplete).toBe('900.0000');
		expect(workspace.activeForecast?.forecastAtCompletion).toBe('1000.0000');
		expect(workspace.activeForecast?.forecastMargin).toBe('500.0000');

		await expect(service.approveForecast(preparer, projectPublicId, forecastPublicId)).rejects.toBeInstanceOf(
			TenantAccessError
		);

		await service.addCashFlowLine(preparer, {
			projectPublicId,
			forecastPublicId,
			costCodePublicId,
			flowDate: new Date('2026-09-30T00:00:00.000Z'),
			direction: 'outflow',
			category: 'material',
			amount: '800.00',
			commentary: 'Initial under-phased forecast.'
		});
		await expect(service.approveForecast(approver, projectPublicId, forecastPublicId)).rejects.toThrow(
			ProjectFinancialControlValidationError
		);

		workspace = await service.getWorkspace(preparer, projectPublicId, null, forecastPublicId);
		const firstCashLine = workspace.activeForecast?.cashFlowLines[0];
		expect(firstCashLine).toBeDefined();
		await service.removeCashFlowLine(
			preparer,
			projectPublicId,
			forecastPublicId,
			firstCashLine!.lineNumber
		);
		await service.addCashFlowLine(preparer, {
			projectPublicId,
			forecastPublicId,
			costCodePublicId,
			flowDate: new Date('2026-09-30T00:00:00.000Z'),
			direction: 'outflow',
			category: 'material',
			amount: '900.00',
			commentary: 'Reconciled material completion forecast.'
		});
		await service.addCashFlowLine(preparer, {
			projectPublicId,
			forecastPublicId,
			flowDate: new Date('2026-10-31T00:00:00.000Z'),
			direction: 'inflow',
			category: 'revenue',
			amount: '1200.00',
			commentary: 'Forecast client cash receipt.'
		});
		await service.approveForecast(approver, projectPublicId, forecastPublicId);

		workspace = await service.getWorkspace(viewer, projectPublicId, null, forecastPublicId);
		expect(workspace.activeForecast?.forecast.status).toBe('approved');
		expect(workspace.activeForecast?.cashOutflow).toBe('900.0000');
		expect(workspace.activeForecast?.cashInflow).toBe('1200.0000');
		expect(workspace.activeForecast?.cashOutflowVarianceToFtc).toBe('0.0000');

		await expect(
			service.updateForecastLine(preparer, {
				projectPublicId,
				forecastPublicId,
				costCodePublicId,
				forecastToCompleteAmount: '850.00'
			})
		).rejects.toThrow(ProjectFinancialControlValidationError);

		await service.closeReportingPeriod(approver, projectPublicId, periodPublicId);
		workspace = await service.getWorkspace(viewer, projectPublicId, null, forecastPublicId);
		expect(workspace.periods.find((period) => period.publicId === periodPublicId)?.status).toBe('closed');
		await service.reopenReportingPeriod(approver, projectPublicId, periodPublicId);
		workspace = await service.getWorkspace(viewer, projectPublicId, null, forecastPublicId);
		expect(workspace.periods.find((period) => period.publicId === periodPublicId)?.status).toBe('reopened');

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('project_id', '=', projectId)
			.where('action_key', 'in', [
				'commercial.reporting_period.created',
				'commercial.forecast.created',
				'commercial.forecast.approved',
				'commercial.reporting_period.closed',
				'commercial.reporting_period.reopened'
			])
			.execute();
		expect(new Set(auditActions.map((row) => row.action_key))).toEqual(
			new Set([
				'commercial.reporting_period.created',
				'commercial.forecast.created',
				'commercial.forecast.approved',
				'commercial.reporting_period.closed',
				'commercial.reporting_period.reopened'
			])
		);
	});
});
