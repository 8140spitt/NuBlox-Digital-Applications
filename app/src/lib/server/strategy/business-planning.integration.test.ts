import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { StrategyService } from './strategy-service';
import {
	BusinessPlanningService,
	BusinessPlanningValidationError
} from './business-planning-service';

const PREFIX = 'Business Planning Integration ';
let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerUserId = '';
let externalUserId = '';
let ownerMemberId = '';
let externalMemberId = '';
let projectId = '';
let projectPublicId = '';
let budgetId = '';
let budgetPublicId = '';
let budgetVersionOneId = '';
let owner: TenantActorContext;
let external: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
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
				joined_at: new Date('2026-09-06T08:00:00.000Z')
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
	expect(permissions.map((permission) => permission.permission_key).sort()).toEqual(
		[...permissionKeys].sort()
	);
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

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (!organisationIds.length) return;

	await db
		.deleteFrom('strategy_initiative_operating_model_links')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_operating_model_accountabilities')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_initiative_dependencies')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_initiative_milestones')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_operating_model_components')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_initiatives')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.updateTable('strategy_business_plans')
		.set({ supersedes_business_plan_id: null })
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_business_plans')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_environment_factors')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('strategy_options').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('strategy_objectives')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.updateTable('strategy_frameworks')
		.set({ supersedes_strategy_framework_id: null })
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('strategy_frameworks')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('project_budget_versions')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('project_budgets').where('organisation_id', 'in', organisationIds).execute();

	const projectRows = await db
		.selectFrom('projects')
		.select('id')
		.where('owning_organisation_id', 'in', organisationIds)
		.where('name', 'like', `${PREFIX}%`)
		.execute();
	const projectIds = projectRows.map((row) => row.id);
	if (projectIds.length) {
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}
	await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('audit_events')
		.where('acting_organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('organisation_roles')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('organisation_members')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	externalUserId = await createUser('External');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	externalMemberId = await createMember(organisationBId, externalUserId);
	await assignPermissionRole(organisationAId, ownerMemberId, 'Strategy owner', [
		'strategy.view',
		'strategy.manage',
		'strategy.approve'
	]);
	await assignPermissionRole(organisationBId, externalMemberId, 'External viewer', [
		'strategy.view'
	]);
	owner = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: randomUUID()
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: randomUUID()
	};

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({
				owning_organisation_id: organisationAId,
				public_id: projectPublicId,
				project_number: 'BP-PROJ-001',
				name: `${PREFIX}Strategic delivery project`,
				status: 'active',
				created_by_member_id: ownerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values({
			project_id: projectId,
			participant_organisation_id: organisationAId,
			status: 'active',
			invited_by_member_id: null,
			joined_at: new Date('2026-09-06T09:00:00.000Z'),
			left_at: null
		})
		.executeTakeFirstOrThrow();
	budgetPublicId = randomUUID();
	budgetId = insertedId(
		await db
			.insertInto('project_budgets')
			.values({
				organisation_id: organisationAId,
				project_id: projectId,
				public_id: budgetPublicId,
				budget_number: 'BP-BUD-001',
				name: 'Strategic execution budget',
				lifecycle_status: 'active',
				created_by_member_id: ownerMemberId
			})
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_budget_versions')
		.values({
			organisation_id: organisationAId,
			project_budget_id: budgetId,
			version_number: 1,
			currency_code: 'GBP',
			version_status: 'approved',
			effective_on: new Date('2027-01-01T00:00:00.000Z'),
			created_by_member_id: ownerMemberId,
			approved_by_member_id: ownerMemberId,
			approved_at: new Date('2026-09-06T10:00:00.000Z'),
			locked_at: new Date('2026-09-06T10:00:00.000Z')
		})
		.executeTakeFirstOrThrow();
	budgetVersionOneId = (
		await db
			.selectFrom('project_budget_versions')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('project_budget_id', '=', budgetId)
			.where('version_number', '=', 1)
			.executeTakeFirstOrThrow()
	).id;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F01 business planning and operating model', () => {
	it('governs strategy-to-plan-to-operating-model-to-funded-execution as immutable evidence', async () => {
		const strategy = new StrategyService(
			db,
			randomUUID,
			() => new Date('2026-09-06T11:00:00.000Z')
		);
		const framework = await strategy.createFramework(owner, {
			frameworkCode: 'BP-STRATEGY',
			title: '2027–2031 Strategy',
			horizonStart: '2027-01-01',
			horizonEnd: '2031-12-31',
			purposeText: 'Create enduring enterprise value.',
			visionText: 'Operate one governed enterprise-to-asset system.',
			missionText: 'Translate strategic intent into accountable funded execution.',
			ownerMemberId
		});
		await strategy.addEnvironmentFactor(owner, {
			frameworkPublicId: framework.public_id,
			contextScope: 'external',
			dimension: 'market',
			direction: 'opportunity',
			title: 'Integrated delivery demand',
			analysisText: 'Customers reward connected enterprise and asset outcomes.',
			ownerMemberId
		});
		const option = await strategy.addOption(owner, {
			frameworkPublicId: framework.public_id,
			title: 'Scale the governed digital thread',
			description: 'Make continuity from intent to execution a strategic differentiator.',
			priorityRank: 1
		});
		await strategy.decideOption(
			owner,
			framework.public_id,
			option.public_id,
			'selected',
			'Highest enterprise and customer value.'
		);
		const objective = await strategy.addObjective(owner, {
			frameworkPublicId: framework.public_id,
			objectiveCode: 'OBJ-BP-01',
			title: 'Industrialise enterprise-to-asset delivery',
			description: 'Fund and execute the target operating model.',
			priorityRank: 1,
			ownerMemberId,
			targetDate: '2029-12-31'
		});
		await strategy.approveFramework(owner, framework.public_id);

		const planning = new BusinessPlanningService(
			db,
			randomUUID,
			() => new Date('2026-09-06T12:00:00.000Z')
		);
		const plan = await planning.createPlan(owner, {
			frameworkPublicId: framework.public_id,
			planCode: 'BP-2027',
			title: '2027 Enterprise Business Plan',
			periodStart: '2027-01-01',
			periodEnd: '2027-12-31',
			narrative: 'Convert approved strategic objectives into funded accountable enterprise change.',
			currencyCode: 'GBP',
			plannedRevenueAmount: '123456789012345.6789',
			plannedOpexAmount: '90000000',
			plannedCapexAmount: '12000000',
			ownerMemberId
		});
		expect(plan.planned_revenue_amount).toBe('123456789012345.6789');
		const initiative = await planning.addInitiative(owner, {
			planPublicId: plan.public_id,
			objectivePublicId: objective.public_id,
			initiativeCode: 'INIT-01',
			title: 'Deploy integrated operating model',
			outcomeText: 'Strategy, delivery and asset operations use one governed digital thread.',
			benefitStatement: 'Reduce handoff loss and accelerate evidence-based decisions.',
			resourceAssumptions: 'Cross-functional transformation team and product investment.',
			riskSummary: 'Adoption and data migration require executive sponsorship.',
			priorityRank: 1,
			startDate: '2027-01-15',
			endDate: '2027-11-30',
			ownerMemberId,
			sponsorMemberId: ownerMemberId,
			plannedInvestmentAmount: '987654321098765.4321',
			plannedFte: '18.5',
			currencyCode: 'GBP',
			projectPublicId,
			projectBudgetPublicId: budgetPublicId
		});
		expect(initiative.planned_investment_amount).toBe('987654321098765.4321');
		expect(initiative.project_budget_version_id).toBe(budgetVersionOneId);
		await planning.addMilestone(owner, {
			planPublicId: plan.public_id,
			initiativePublicId: initiative.public_id,
			milestoneCode: 'MS-01',
			title: 'Target operating model mobilised',
			targetDate: '2027-06-30',
			ownerMemberId
		});
		const component = await planning.addOperatingModelComponent(owner, {
			planPublicId: plan.public_id,
			componentCode: 'CAP-01',
			componentType: 'business_capability',
			title: 'Integrated enterprise delivery',
			currentStateText: 'Function-led handoffs with duplicated reporting.',
			targetStateText:
				'Cross-functional value streams execute from shared canonical enterprise records.'
		});
		await planning.addAccountability(owner, {
			planPublicId: plan.public_id,
			componentPublicId: component.public_id,
			accountabilityType: 'accountable',
			positionLabel: 'Chief Operating Officer',
			memberId: ownerMemberId,
			notes: 'Business accountability only; it does not grant access permissions.'
		});
		await planning.linkInitiativeToOperatingModel(owner, {
			planPublicId: plan.public_id,
			initiativePublicId: initiative.public_id,
			componentPublicId: component.public_id,
			changeRole: 'transform'
		});

		const approved = await planning.approvePlan(owner, plan.public_id);
		expect(approved.lifecycle_status).toBe('approved');
		expect(approved.approved_by_member_id).toBe(ownerMemberId);
		const approvedWorkspace = await planning.getWorkspace(owner, approved.public_id);
		expect(approvedWorkspace.initiatives).toHaveLength(1);
		expect(approvedWorkspace.initiatives[0]?.lifecycle_status).toBe('approved');
		expect(approvedWorkspace.initiatives[0]?.project_id).toBe(projectId);
		expect(approvedWorkspace.initiatives[0]?.project_budget_id).toBe(budgetId);
		expect(approvedWorkspace.initiatives[0]?.project_budget_version_id).toBe(budgetVersionOneId);
		expect(approvedWorkspace.operatingModelComponents[0]?.lifecycle_status).toBe('approved');
		expect(approvedWorkspace.accountabilities[0]?.position_label).toBe('Chief Operating Officer');
		expect(approvedWorkspace.initiativeComponentLinks).toHaveLength(1);

		await db
			.insertInto('project_budget_versions')
			.values({
				organisation_id: organisationAId,
				project_budget_id: budgetId,
				version_number: 2,
				currency_code: 'GBP',
				version_status: 'approved',
				effective_on: new Date('2027-07-01T00:00:00.000Z'),
				created_by_member_id: ownerMemberId,
				approved_by_member_id: ownerMemberId,
				approved_at: new Date('2026-09-06T12:30:00.000Z'),
				locked_at: new Date('2026-09-06T12:30:00.000Z')
			})
			.executeTakeFirstOrThrow();
		const refreshedApprovedWorkspace = await planning.getWorkspace(owner, approved.public_id);
		expect(refreshedApprovedWorkspace.approvedExecutionBudgets[0]?.approvedVersion).toBe(2);
		expect(
			refreshedApprovedWorkspace.executionBudgets.find(
				(budget) => budget.versionId === budgetVersionOneId
			)?.approvedVersion
		).toBe(1);
		expect(refreshedApprovedWorkspace.initiatives[0]?.project_budget_version_id).toBe(
			budgetVersionOneId
		);

		await expect(
			planning.addOperatingModelComponent(owner, {
				planPublicId: approved.public_id,
				componentCode: 'LATE',
				componentType: 'process',
				title: 'Attempted rewrite',
				targetStateText: 'Should not be accepted.'
			})
		).rejects.toBeInstanceOf(BusinessPlanningValidationError);

		const revision = await planning.revisePlan(owner, approved.public_id);
		const existingRevision = await planning.revisePlan(owner, approved.public_id);
		expect(existingRevision.public_id).toBe(revision.public_id);
		expect(revision.version_number).toBe(2);
		expect(revision.lifecycle_status).toBe('draft');
		expect(revision.supersedes_business_plan_id).toBe(approved.id);
		const revisionWorkspace = await planning.getWorkspace(owner, revision.public_id);
		expect(revisionWorkspace.initiatives).toHaveLength(1);
		expect(revisionWorkspace.initiatives[0]?.lifecycle_status).toBe('proposed');
		expect(revisionWorkspace.initiatives[0]?.project_budget_version_id).toBe(budgetVersionOneId);
		expect(revisionWorkspace.milestones).toHaveLength(1);
		expect(revisionWorkspace.operatingModelComponents).toHaveLength(1);
		expect(revisionWorkspace.operatingModelComponents[0]?.lifecycle_status).toBe('proposed');
		expect(revisionWorkspace.accountabilities).toHaveLength(1);
		expect(revisionWorkspace.initiativeComponentLinks).toHaveLength(1);

		const source = await db
			.selectFrom('strategy_business_plans')
			.select(['lifecycle_status', 'title'])
			.where('id', '=', approved.id)
			.executeTakeFirstOrThrow();
		expect(source).toEqual({
			lifecycle_status: 'approved',
			title: '2027 Enterprise Business Plan'
		});

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationAId)
			.where('action_key', 'like', 'strategy.%')
			.execute();
		expect(auditActions.map((row) => row.action_key)).toEqual(
			expect.arrayContaining([
				'strategy.business_plan.create',
				'strategy.initiative.create',
				'strategy.initiative_milestone.create',
				'strategy.operating_model_component.create',
				'strategy.operating_model_accountability.create',
				'strategy.initiative_operating_model.link',
				'strategy.business_plan.approve',
				'strategy.business_plan.revise'
			])
		);
	});

	it('fails closed across tenant and permission boundaries', async () => {
		const planning = new BusinessPlanningService(db);
		await expect(planning.getWorkspace(external)).resolves.toMatchObject({ plans: [] });
		await expect(
			planning.createPlan(external, {
				frameworkPublicId: randomUUID(),
				planCode: 'FORBIDDEN',
				title: 'Forbidden',
				periodStart: '2027-01-01',
				periodEnd: '2027-12-31',
				narrative: 'No mutation authority.',
				currencyCode: 'GBP'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
		await expect(planning.getWorkspace(external, randomUUID())).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
