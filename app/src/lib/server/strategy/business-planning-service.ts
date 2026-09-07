import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import type { StrategyFrameworkRecord, StrategyObjectiveRecord } from './strategy-repository';
import {
	BusinessPlanningRepository,
	type BusinessPlanRecord,
	type ExecutionBudget,
	type ExecutionProject,
	type InitiativeOperatingModelLinkRecord,
	type OperatingModelAccountabilityRecord,
	type OperatingModelComponentRecord,
	type StrategyInitiativeDependencyRecord,
	type StrategyInitiativeMilestoneRecord,
	type StrategyInitiativeRecord
} from './business-planning-repository';

export class BusinessPlanningValidationError extends Error {
	readonly code = 'BUSINESS_PLANNING_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'BusinessPlanningValidationError';
	}
}

export type BusinessPlanningWorkspace = {
	approvedFrameworks: StrategyFrameworkRecord[];
	plans: BusinessPlanRecord[];
	selectedPlan: BusinessPlanRecord | null;
	selectedFramework: StrategyFrameworkRecord | null;
	objectives: StrategyObjectiveRecord[];
	initiatives: StrategyInitiativeRecord[];
	milestones: StrategyInitiativeMilestoneRecord[];
	dependencies: StrategyInitiativeDependencyRecord[];
	operatingModelComponents: OperatingModelComponentRecord[];
	accountabilities: OperatingModelAccountabilityRecord[];
	initiativeComponentLinks: InitiativeOperatingModelLinkRecord[];
	executionProjects: ExecutionProject[];
	executionBudgets: ExecutionBudget[];
	approvedExecutionBudgets: ExecutionBudget[];
	canManage: boolean;
	canApprove: boolean;
};

export type BusinessPlanInput = {
	frameworkPublicId: string;
	planCode: string;
	title: string;
	periodStart: string | Date;
	periodEnd: string | Date;
	narrative: string;
	currencyCode: string;
	plannedRevenueAmount?: number | string | null;
	plannedOpexAmount?: number | string | null;
	plannedCapexAmount?: number | string | null;
	ownerMemberId?: string | null;
};

export type InitiativeInput = {
	planPublicId: string;
	objectivePublicId: string;
	initiativeCode: string;
	title: string;
	outcomeText: string;
	benefitStatement?: string | null;
	resourceAssumptions?: string | null;
	riskSummary?: string | null;
	priorityRank: number | string;
	startDate: string | Date;
	endDate: string | Date;
	ownerMemberId?: string | null;
	sponsorMemberId?: string | null;
	plannedInvestmentAmount?: number | string | null;
	plannedFte?: number | string | null;
	currencyCode: string;
	projectPublicId?: string | null;
	projectBudgetPublicId?: string | null;
};

export type InitiativeMilestoneInput = {
	planPublicId: string;
	initiativePublicId: string;
	milestoneCode: string;
	title: string;
	targetDate: string | Date;
	ownerMemberId?: string | null;
};

export type InitiativeDependencyInput = {
	planPublicId: string;
	initiativePublicId: string;
	dependsOnInitiativePublicId: string;
	dependencyType:
		| 'finish_to_start'
		| 'start_to_start'
		| 'finish_to_finish'
		| 'start_to_finish'
		| 'governance'
		| 'resource'
		| 'external';
};

export type OperatingModelComponentInput = {
	planPublicId: string;
	componentCode: string;
	parentComponentPublicId?: string | null;
	componentType:
		| 'business_capability'
		| 'value_stream'
		| 'organisation_design'
		| 'process'
		| 'governance'
		| 'information'
		| 'technology'
		| 'partner_ecosystem'
		| 'location';
	title: string;
	currentStateText?: string | null;
	targetStateText: string;
};

export type OperatingModelAccountabilityInput = {
	planPublicId: string;
	componentPublicId: string;
	accountabilityType: 'accountable' | 'responsible' | 'consulted' | 'informed' | 'assured';
	positionLabel: string;
	memberId?: string | null;
	notes?: string | null;
};

export type InitiativeOperatingModelLinkInput = {
	planPublicId: string;
	initiativePublicId: string;
	componentPublicId: string;
	changeRole: 'create' | 'transform' | 'enable' | 'consume' | 'retire';
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
const CURRENCY = /^[A-Z]{3}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new BusinessPlanningValidationError(
			`${label} must be between 1 and ${maximum} characters.`
		);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) {
		throw new BusinessPlanningValidationError(`Text must not exceed ${maximum} characters.`);
	}
	return normalized;
}

function code(value: string, label: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized))
		throw new BusinessPlanningValidationError(`${label} has an invalid format.`);
	return normalized;
}

function currency(value: string): string {
	const normalized = value.trim().toUpperCase();
	if (!CURRENCY.test(normalized)) {
		throw new BusinessPlanningValidationError(
			'Currency code must be a three-letter ISO-style code.'
		);
	}
	return normalized;
}

function dateOnly(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? value : new Date(`${value.trim()}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()))
		throw new BusinessPlanningValidationError(`${label} is invalid.`);
	return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function positiveInteger(value: number | string, label: string): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new BusinessPlanningValidationError(`${label} must be a positive whole number.`);
	}
	return parsed;
}

function nonNegativeFixedPoint(
	value: number | string | null | undefined,
	label: string,
	scale: number,
	maximumIntegerDigits: number
): string {
	if (value === null || value === undefined || value === '') {
		return `0.${'0'.repeat(scale)}`;
	}
	const raw = typeof value === 'number' ? String(value) : value.trim();
	if (!/^\d+(?:\.\d+)?$/.test(raw)) {
		throw new BusinessPlanningValidationError(
			`${label} must be a non-negative fixed-point number within supported range.`
		);
	}
	const [integerRaw, fractionRaw = ''] = raw.split('.');
	const integer = integerRaw.replace(/^0+(?=\d)/, '');
	if (integer.length > maximumIntegerDigits || fractionRaw.length > scale) {
		throw new BusinessPlanningValidationError(
			`${label} must be a non-negative fixed-point number within supported range.`
		);
	}
	return `${integer}.${fractionRaw.padEnd(scale, '0')}`;
}

function nonNegativeDecimal(value: number | string | null | undefined, label: string): string {
	return nonNegativeFixedPoint(value, label, 4, 15);
}

function nonNegativeFte(value: number | string | null | undefined): string {
	return nonNegativeFixedPoint(value, 'Planned FTE', 2, 10);
}

function assertDateWithin(date: Date, start: Date, end: Date, label: string): void {
	if (date < start || date > end) {
		throw new BusinessPlanningValidationError(
			`${label} must sit within the governing planning period.`
		);
	}
}

function assertAcyclic(
	initiatives: StrategyInitiativeRecord[],
	dependencies: StrategyInitiativeDependencyRecord[]
): void {
	const nodes = new Set(initiatives.map((initiative) => initiative.id));
	const graph = new Map<string, string[]>();
	for (const node of nodes) graph.set(node, []);
	for (const dependency of dependencies) {
		if (!nodes.has(dependency.initiative_id) || !nodes.has(dependency.depends_on_initiative_id))
			continue;
		graph.get(dependency.initiative_id)?.push(dependency.depends_on_initiative_id);
	}
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const visit = (node: string): void => {
		if (visiting.has(node)) {
			throw new BusinessPlanningValidationError(
				'Initiative dependencies must form an acyclic delivery network.'
			);
		}
		if (visited.has(node)) return;
		visiting.add(node);
		for (const dependency of graph.get(node) ?? []) visit(dependency);
		visiting.delete(node);
		visited.add(node);
	};
	for (const node of nodes) visit(node);
}

export class BusinessPlanningService {
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

	private async permissionFlags(actor: TenantActorContext) {
		await this.assertActiveActor(actor);
		const permissions = new PermissionService(this.db);
		const [view, manage, approve] = await Promise.all([
			permissions.decide(actor, 'strategy.view'),
			permissions.decide(actor, 'strategy.manage'),
			permissions.decide(actor, 'strategy.approve')
		]);
		if (!view.allowed && !manage.allowed && !approve.allowed) {
			throw new RecordNotFoundError('Business planning workspace not found in the active scope.');
		}
		return { canManage: manage.allowed, canApprove: approve.allowed };
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: 'strategy.manage' | 'strategy.approve'
	): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed)
			throw new TenantAccessError('Business planning action is not permitted.');
	}

	private async appendEvidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>,
		eventMetadata: Record<string, unknown> = {}
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
			eventMetadata
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, ...eventMetadata }
		});
	}

	private async validateActiveMember(
		db: DatabaseExecutor,
		organisationId: string,
		memberId: string | null | undefined,
		label: string
	): Promise<string | null> {
		const normalized = memberId?.trim() || null;
		if (!normalized) return null;
		const member = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('id', '=', normalized)
			.where('organisation_id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!member)
			throw new BusinessPlanningValidationError(`${label} must be an active organisation member.`);
		return member.id;
	}

	private async requireApprovedFramework(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<StrategyFrameworkRecord> {
		const framework = await db
			.selectFrom('strategy_frameworks')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId.trim())
			.where('lifecycle_status', '=', 'approved')
			.executeTakeFirst();
		if (!framework) {
			throw new BusinessPlanningValidationError(
				'Business plans must be governed by an approved strategy version.'
			);
		}
		return framework;
	}

	private async requireDraftPlan(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<BusinessPlanRecord> {
		const plan = await new BusinessPlanningRepository(db).findPlanByPublicId(
			organisationId,
			publicId.trim()
		);
		if (!plan) throw new RecordNotFoundError('Business plan not found.');
		if (plan.lifecycle_status !== 'draft') {
			throw new BusinessPlanningValidationError(
				'Approved business plans are immutable; create a controlled revision instead.'
			);
		}
		return plan;
	}

	private async requireObjective(
		db: DatabaseExecutor,
		organisationId: string,
		frameworkId: string,
		publicId: string
	): Promise<StrategyObjectiveRecord> {
		const objective = await db
			.selectFrom('strategy_objectives')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('strategy_framework_id', '=', frameworkId)
			.where('public_id', '=', publicId.trim())
			.where('lifecycle_status', '=', 'active')
			.executeTakeFirst();
		if (!objective) {
			throw new BusinessPlanningValidationError(
				'Initiative objective must be active in the governing strategy version.'
			);
		}
		return objective;
	}

	private async resolveExecutionLink(
		repository: BusinessPlanningRepository,
		organisationId: string,
		projectPublicId?: string | null,
		projectBudgetPublicId?: string | null
	): Promise<{
		projectId: string | null;
		projectBudgetId: string | null;
		projectBudgetVersionId: string | null;
	}> {
		const normalizedProject = projectPublicId?.trim() || null;
		const normalizedBudget = projectBudgetPublicId?.trim() || null;
		if (!normalizedProject && normalizedBudget) {
			throw new BusinessPlanningValidationError(
				'A project must be selected before a project budget can be linked.'
			);
		}
		if (!normalizedProject) {
			return { projectId: null, projectBudgetId: null, projectBudgetVersionId: null };
		}
		const project = await repository.findExecutionProject(organisationId, normalizedProject);
		if (!project)
			throw new BusinessPlanningValidationError(
				'Execution project is not active in the organisation scope.'
			);
		if (!normalizedBudget) {
			return { projectId: project.id, projectBudgetId: null, projectBudgetVersionId: null };
		}
		const budget = await repository.findApprovedExecutionBudget(
			organisationId,
			project.id,
			normalizedBudget
		);
		if (!budget) {
			throw new BusinessPlanningValidationError(
				'Execution budget must be an active project budget with an approved version in the organisation scope.'
			);
		}
		return {
			projectId: project.id,
			projectBudgetId: budget.id,
			projectBudgetVersionId: budget.versionId
		};
	}

	async getWorkspace(
		actor: TenantActorContext,
		selectedPlanPublicId?: string | null
	): Promise<BusinessPlanningWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new BusinessPlanningRepository(this.db);
		const [
			approvedFrameworks,
			plans,
			executionProjects,
			executionBudgets,
			approvedExecutionBudgets
		] = await Promise.all([
			this.db
				.selectFrom('strategy_frameworks')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('lifecycle_status', '=', 'approved')
				.orderBy('framework_code', 'asc')
				.orderBy('version_number', 'desc')
				.execute(),
			repository.listPlans(actor.organisationId),
			repository.listExecutionProjects(actor.organisationId),
			repository.listExecutionBudgets(actor.organisationId),
			repository.listApprovedExecutionBudgets(actor.organisationId)
		]);
		let selectedPlan: (typeof plans)[number] | null = plans[0] ?? null;
		if (selectedPlanPublicId?.trim()) {
			selectedPlan =
				(await repository.findPlanByPublicId(actor.organisationId, selectedPlanPublicId.trim())) ??
				null;
			if (!selectedPlan) throw new RecordNotFoundError('Business plan not found.');
		}
		if (!selectedPlan) {
			return {
				approvedFrameworks,
				plans,
				selectedPlan: null,
				selectedFramework: null,
				objectives: [],
				initiatives: [],
				milestones: [],
				dependencies: [],
				operatingModelComponents: [],
				accountabilities: [],
				initiativeComponentLinks: [],
				executionProjects,
				executionBudgets,
				approvedExecutionBudgets,
				...flags
			};
		}
		const [
			selectedFramework,
			objectives,
			initiatives,
			milestones,
			dependencies,
			components,
			accountabilities,
			links
		] = await Promise.all([
			this.db
				.selectFrom('strategy_frameworks')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', selectedPlan.strategy_framework_id)
				.executeTakeFirst(),
			this.db
				.selectFrom('strategy_objectives')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('strategy_framework_id', '=', selectedPlan.strategy_framework_id)
				.orderBy('priority_rank', 'asc')
				.execute(),
			repository.listInitiatives(selectedPlan.id),
			repository.listMilestones(selectedPlan.id),
			repository.listDependencies(selectedPlan.id),
			repository.listComponents(selectedPlan.id),
			repository.listAccountabilities(selectedPlan.id),
			repository.listInitiativeComponentLinks(selectedPlan.id)
		]);
		return {
			approvedFrameworks,
			plans,
			selectedPlan,
			selectedFramework: selectedFramework ?? null,
			objectives,
			initiatives,
			milestones,
			dependencies,
			operatingModelComponents: components,
			accountabilities,
			initiativeComponentLinks: links,
			executionProjects,
			executionBudgets,
			approvedExecutionBudgets,
			...flags
		};
	}

	async createPlan(
		actor: TenantActorContext,
		input: BusinessPlanInput
	): Promise<BusinessPlanRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const framework = await this.requireApprovedFramework(
				trx,
				actor.organisationId,
				input.frameworkPublicId
			);
			const planCode = code(input.planCode, 'Plan code');
			if (await repository.findLatestPlanVersion(actor.organisationId, planCode)) {
				throw new BusinessPlanningValidationError(
					'A business plan with this code already exists; create a controlled revision instead.'
				);
			}
			const periodStart = dateOnly(input.periodStart, 'Plan period start');
			const periodEnd = dateOnly(input.periodEnd, 'Plan period end');
			if (periodEnd < periodStart)
				throw new BusinessPlanningValidationError('Plan period end must not precede its start.');
			assertDateWithin(
				periodStart,
				framework.horizon_start,
				framework.horizon_end,
				'Plan period start'
			);
			assertDateWithin(
				periodEnd,
				framework.horizon_start,
				framework.horizon_end,
				'Plan period end'
			);
			const ownerMemberId = await this.validateActiveMember(
				trx,
				actor.organisationId,
				input.ownerMemberId,
				'Business plan owner'
			);
			const plan = await repository.insertPlan({
				organisation_id: actor.organisationId,
				strategy_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				plan_code: planCode,
				version_number: 1,
				title: requiredText(input.title, 'Plan title', 255),
				period_start: periodStart,
				period_end: periodEnd,
				narrative: requiredText(input.narrative, 'Plan narrative', 20_000),
				currency_code: currency(input.currencyCode),
				planned_revenue_amount: nonNegativeDecimal(input.plannedRevenueAmount, 'Planned revenue'),
				planned_opex_amount: nonNegativeDecimal(
					input.plannedOpexAmount,
					'Planned operating expenditure'
				),
				planned_capex_amount: nonNegativeDecimal(
					input.plannedCapexAmount,
					'Planned capital expenditure'
				),
				lifecycle_status: 'draft',
				supersedes_business_plan_id: null,
				owner_member_id: ownerMemberId,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.business_plan.create',
				'strategy_business_plan',
				plan.public_id,
				{
					planCode,
					versionNumber: 1,
					frameworkPublicId: framework.public_id,
					lifecycleStatus: 'draft'
				},
				{ function: 'F01', subfunction: 'F01.04' }
			);
			return plan;
		});
	}

	async addInitiative(
		actor: TenantActorContext,
		input: InitiativeInput
	): Promise<StrategyInitiativeRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			const objective = await this.requireObjective(
				trx,
				actor.organisationId,
				plan.strategy_framework_id,
				input.objectivePublicId
			);
			const startDate = dateOnly(input.startDate, 'Initiative start date');
			const endDate = dateOnly(input.endDate, 'Initiative end date');
			if (endDate < startDate)
				throw new BusinessPlanningValidationError(
					'Initiative end date must not precede its start.'
				);
			assertDateWithin(startDate, plan.period_start, plan.period_end, 'Initiative start date');
			assertDateWithin(endDate, plan.period_start, plan.period_end, 'Initiative end date');
			const [ownerMemberId, sponsorMemberId, execution] = await Promise.all([
				this.validateActiveMember(
					trx,
					actor.organisationId,
					input.ownerMemberId,
					'Initiative owner'
				),
				this.validateActiveMember(
					trx,
					actor.organisationId,
					input.sponsorMemberId,
					'Initiative sponsor'
				),
				this.resolveExecutionLink(
					repository,
					actor.organisationId,
					input.projectPublicId,
					input.projectBudgetPublicId
				)
			]);
			const initiative = await repository.insertInitiative({
				organisation_id: actor.organisationId,
				strategy_business_plan_id: plan.id,
				strategy_objective_id: objective.id,
				public_id: this.publicIdFactory(),
				initiative_code: code(input.initiativeCode, 'Initiative code'),
				title: requiredText(input.title, 'Initiative title', 255),
				outcome_text: requiredText(input.outcomeText, 'Initiative outcome', 20_000),
				benefit_statement: optionalText(input.benefitStatement, 20_000),
				resource_assumptions: optionalText(input.resourceAssumptions, 20_000),
				risk_summary: optionalText(input.riskSummary, 20_000),
				priority_rank: positiveInteger(input.priorityRank, 'Initiative priority'),
				start_date: startDate,
				end_date: endDate,
				owner_member_id: ownerMemberId,
				sponsor_member_id: sponsorMemberId,
				planned_investment_amount: nonNegativeDecimal(
					input.plannedInvestmentAmount,
					'Planned initiative investment'
				),
				planned_fte: nonNegativeFte(input.plannedFte),
				currency_code: currency(input.currencyCode),
				project_id: execution.projectId,
				project_budget_id: execution.projectBudgetId,
				project_budget_version_id: execution.projectBudgetVersionId,
				lifecycle_status: 'proposed',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.initiative.create',
				'strategy_initiative',
				initiative.public_id,
				{
					planPublicId: plan.public_id,
					objectivePublicId: objective.public_id,
					initiativeCode: initiative.initiative_code,
					projectLinked: Boolean(execution.projectId),
					approvedBudgetLinked: Boolean(execution.projectBudgetId),
					approvedBudgetVersionLinked: Boolean(execution.projectBudgetVersionId)
				},
				{ function: 'F01', subfunction: 'F01.04' }
			);
			return initiative;
		});
	}

	async addMilestone(
		actor: TenantActorContext,
		input: InitiativeMilestoneInput
	): Promise<StrategyInitiativeMilestoneRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			const initiative = await repository.findInitiativeByPublicId(
				actor.organisationId,
				plan.id,
				input.initiativePublicId.trim()
			);
			if (!initiative) throw new RecordNotFoundError('Strategy initiative not found.');
			const targetDate = dateOnly(input.targetDate, 'Milestone target date');
			assertDateWithin(
				targetDate,
				initiative.start_date,
				initiative.end_date,
				'Milestone target date'
			);
			const ownerMemberId = await this.validateActiveMember(
				trx,
				actor.organisationId,
				input.ownerMemberId,
				'Milestone owner'
			);
			const milestone = await repository.insertMilestone({
				organisation_id: actor.organisationId,
				strategy_initiative_id: initiative.id,
				public_id: this.publicIdFactory(),
				milestone_code: code(input.milestoneCode, 'Milestone code'),
				title: requiredText(input.title, 'Milestone title', 255),
				target_date: targetDate,
				actual_date: null,
				lifecycle_status: 'planned',
				owner_member_id: ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.initiative_milestone.create',
				'strategy_initiative_milestone',
				milestone.public_id,
				{
					initiativePublicId: initiative.public_id,
					targetDate: targetDate.toISOString().slice(0, 10)
				},
				{ function: 'F01', subfunction: 'F01.04' }
			);
			return milestone;
		});
	}

	async addDependency(actor: TenantActorContext, input: InitiativeDependencyInput): Promise<void> {
		await this.requirePermission(actor, 'strategy.manage');
		await this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			const [initiative, dependsOn] = await Promise.all([
				repository.findInitiativeByPublicId(
					actor.organisationId,
					plan.id,
					input.initiativePublicId.trim()
				),
				repository.findInitiativeByPublicId(
					actor.organisationId,
					plan.id,
					input.dependsOnInitiativePublicId.trim()
				)
			]);
			if (!initiative || !dependsOn)
				throw new RecordNotFoundError('Strategy initiative not found.');
			if (initiative.id === dependsOn.id) {
				throw new BusinessPlanningValidationError('An initiative cannot depend on itself.');
			}
			const [initiatives, dependencies] = await Promise.all([
				repository.listInitiatives(plan.id),
				repository.listDependencies(plan.id)
			]);
			assertAcyclic(initiatives, [
				...dependencies,
				{
					organisation_id: actor.organisationId,
					initiative_id: initiative.id,
					depends_on_initiative_id: dependsOn.id,
					dependency_type: input.dependencyType,
					created_by_member_id: actor.memberId,
					created_at: this.now()
				}
			]);
			await repository.insertDependency({
				organisation_id: actor.organisationId,
				initiative_id: initiative.id,
				depends_on_initiative_id: dependsOn.id,
				dependency_type: input.dependencyType,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.initiative_dependency.create',
				'strategy_initiative',
				initiative.public_id,
				{ dependsOnInitiativePublicId: dependsOn.public_id, dependencyType: input.dependencyType },
				{ function: 'F01', subfunction: 'F01.04' }
			);
		});
	}

	async addOperatingModelComponent(
		actor: TenantActorContext,
		input: OperatingModelComponentInput
	): Promise<OperatingModelComponentRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			let parentComponentId: string | null = null;
			if (input.parentComponentPublicId?.trim()) {
				const parent = await repository.findComponentByPublicId(
					actor.organisationId,
					plan.id,
					input.parentComponentPublicId.trim()
				);
				if (!parent) throw new RecordNotFoundError('Parent operating-model component not found.');
				parentComponentId = parent.id;
			}
			const component = await repository.insertComponent({
				organisation_id: actor.organisationId,
				strategy_business_plan_id: plan.id,
				public_id: this.publicIdFactory(),
				component_code: code(input.componentCode, 'Operating-model component code'),
				parent_component_id: parentComponentId,
				component_type: input.componentType,
				title: requiredText(input.title, 'Operating-model component title', 255),
				current_state_text: optionalText(input.currentStateText, 20_000),
				target_state_text: requiredText(input.targetStateText, 'Target-state description', 20_000),
				lifecycle_status: 'proposed',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.operating_model_component.create',
				'strategy_operating_model_component',
				component.public_id,
				{
					planPublicId: plan.public_id,
					componentCode: component.component_code,
					componentType: component.component_type
				},
				{ function: 'F01', subfunction: 'F01.05' }
			);
			return component;
		});
	}

	async addAccountability(
		actor: TenantActorContext,
		input: OperatingModelAccountabilityInput
	): Promise<OperatingModelAccountabilityRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			const component = await repository.findComponentByPublicId(
				actor.organisationId,
				plan.id,
				input.componentPublicId.trim()
			);
			if (!component) throw new RecordNotFoundError('Operating-model component not found.');
			const memberId = await this.validateActiveMember(
				trx,
				actor.organisationId,
				input.memberId,
				'Named accountability holder'
			);
			const accountability = await repository.insertAccountability({
				organisation_id: actor.organisationId,
				operating_model_component_id: component.id,
				public_id: this.publicIdFactory(),
				accountability_type: input.accountabilityType,
				position_label: requiredText(input.positionLabel, 'Business position label', 255),
				member_id: memberId,
				notes: optionalText(input.notes, 20_000),
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.operating_model_accountability.create',
				'strategy_operating_model_accountability',
				accountability.public_id,
				{
					componentPublicId: component.public_id,
					accountabilityType: accountability.accountability_type,
					positionLabel: accountability.position_label,
					memberAssigned: Boolean(memberId)
				},
				{
					function: 'F01',
					subfunction: 'F01.05',
					accessRoleSemantics: 'separate-from-operating-model-accountability'
				}
			);
			return accountability;
		});
	}

	async linkInitiativeToOperatingModel(
		actor: TenantActorContext,
		input: InitiativeOperatingModelLinkInput
	): Promise<void> {
		await this.requirePermission(actor, 'strategy.manage');
		await this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, input.planPublicId);
			const [initiative, component] = await Promise.all([
				repository.findInitiativeByPublicId(
					actor.organisationId,
					plan.id,
					input.initiativePublicId.trim()
				),
				repository.findComponentByPublicId(
					actor.organisationId,
					plan.id,
					input.componentPublicId.trim()
				)
			]);
			if (!initiative) throw new RecordNotFoundError('Strategy initiative not found.');
			if (!component) throw new RecordNotFoundError('Operating-model component not found.');
			await repository.insertInitiativeComponentLink({
				organisation_id: actor.organisationId,
				initiative_id: initiative.id,
				operating_model_component_id: component.id,
				change_role: input.changeRole,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.initiative_operating_model.link',
				'strategy_initiative',
				initiative.public_id,
				{ componentPublicId: component.public_id, changeRole: input.changeRole },
				{ function: 'F01', subfunctions: ['F01.04', 'F01.05'] }
			);
		});
	}

	private async validateApprovalReadiness(
		db: DatabaseExecutor,
		organisationId: string,
		plan: BusinessPlanRecord
	): Promise<void> {
		await this.requireApprovedFramework(
			db,
			organisationId,
			(
				await db
					.selectFrom('strategy_frameworks')
					.select('public_id')
					.where('id', '=', plan.strategy_framework_id)
					.where('organisation_id', '=', organisationId)
					.executeTakeFirstOrThrow()
			).public_id
		);
		const repository = new BusinessPlanningRepository(db);
		const [initiatives, dependencies, components, accountabilities, links] = await Promise.all([
			repository.listInitiatives(plan.id),
			repository.listDependencies(plan.id),
			repository.listComponents(plan.id),
			repository.listAccountabilities(plan.id),
			repository.listInitiativeComponentLinks(plan.id)
		]);
		if (!initiatives.length) {
			throw new BusinessPlanningValidationError(
				'At least one strategic initiative is required before business-plan approval.'
			);
		}
		if (!components.length) {
			throw new BusinessPlanningValidationError(
				'At least one target operating-model component is required before business-plan approval.'
			);
		}
		for (const component of components) {
			if (
				!accountabilities.some(
					(accountability) =>
						accountability.operating_model_component_id === component.id &&
						accountability.accountability_type === 'accountable'
				)
			) {
				throw new BusinessPlanningValidationError(
					`Operating-model component ${component.component_code} requires an explicit accountable business position before approval.`
				);
			}
		}
		for (const initiative of initiatives) {
			if (!links.some((link) => link.initiative_id === initiative.id)) {
				throw new BusinessPlanningValidationError(
					`Initiative ${initiative.initiative_code} must identify which target operating-model component it changes or enables.`
				);
			}
			if (initiative.project_id) {
				const project = (await repository.listExecutionProjects(organisationId)).find(
					(candidate) => candidate.id === initiative.project_id
				);
				if (!project) {
					throw new BusinessPlanningValidationError(
						`Initiative ${initiative.initiative_code} references a project that is no longer active in the organisation scope.`
					);
				}
				if (initiative.project_budget_id) {
					if (!initiative.project_budget_version_id) {
						throw new BusinessPlanningValidationError(
							`Initiative ${initiative.initiative_code} is missing its immutable project-budget version reference.`
						);
					}
					const budget = (
						await repository.listExecutionBudgets(organisationId, initiative.project_id)
					).find(
						(candidate) =>
							candidate.id === initiative.project_budget_id &&
							candidate.versionId === initiative.project_budget_version_id
					);
					if (!budget) {
						throw new BusinessPlanningValidationError(
							`Initiative ${initiative.initiative_code} no longer references the canonical project-budget version selected for this plan.`
						);
					}
				}
			}
		}
		assertAcyclic(initiatives, dependencies);
	}

	async approvePlan(actor: TenantActorContext, planPublicId: string): Promise<BusinessPlanRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const plan = await this.requireDraftPlan(trx, actor.organisationId, planPublicId);
			await this.validateApprovalReadiness(trx, actor.organisationId, plan);
			if (plan.supersedes_business_plan_id) {
				const source = await repository.findPlanById(
					actor.organisationId,
					plan.supersedes_business_plan_id
				);
				if (!source || source.lifecycle_status !== 'approved') {
					throw new BusinessPlanningValidationError(
						'The superseded business-plan evidence is no longer in an approvable lineage state.'
					);
				}
				await repository.updatePlan(actor.organisationId, source.id, {
					lifecycle_status: 'superseded'
				});
			}
			const approvedAt = this.now();
			const approved = await repository.updatePlan(actor.organisationId, plan.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: approvedAt
			});
			await Promise.all([
				repository.updateInitiativesForPlan(plan.id, { lifecycle_status: 'approved' }),
				repository.updateComponentsForPlan(plan.id, { lifecycle_status: 'approved' })
			]);
			await this.appendEvidence(
				trx,
				actor,
				'strategy.business_plan.approve',
				'strategy_business_plan',
				approved.public_id,
				{
					planCode: approved.plan_code,
					versionNumber: approved.version_number,
					lifecycleStatus: 'approved'
				},
				{ function: 'F01', subfunctions: ['F01.04', 'F01.05'] }
			);
			return approved;
		});
	}

	async revisePlan(actor: TenantActorContext, planPublicId: string): Promise<BusinessPlanRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new BusinessPlanningRepository(trx);
			const source = await repository.findPlanByPublicId(actor.organisationId, planPublicId.trim());
			if (!source) throw new RecordNotFoundError('Business plan not found.');
			if (source.lifecycle_status !== 'approved') {
				throw new BusinessPlanningValidationError(
					'Only an approved business plan can start a controlled revision.'
				);
			}
			const latest = await repository.findLatestPlanVersion(actor.organisationId, source.plan_code);
			if (latest && latest.id !== source.id) {
				if (
					latest.lifecycle_status === 'draft' &&
					latest.supersedes_business_plan_id === source.id
				) {
					return latest;
				}
				throw new BusinessPlanningValidationError(
					'Only the latest approved business-plan version can start a controlled revision.'
				);
			}
			await this.requireApprovedFramework(
				trx,
				actor.organisationId,
				(
					await trx
						.selectFrom('strategy_frameworks')
						.select('public_id')
						.where('id', '=', source.strategy_framework_id)
						.where('organisation_id', '=', actor.organisationId)
						.executeTakeFirstOrThrow()
				).public_id
			);
			const activeOwner = await this.validateActiveMember(
				trx,
				actor.organisationId,
				source.owner_member_id,
				'Business plan owner'
			).catch(() => null);
			const revision = await repository.insertPlan({
				organisation_id: actor.organisationId,
				strategy_framework_id: source.strategy_framework_id,
				public_id: this.publicIdFactory(),
				plan_code: source.plan_code,
				version_number: source.version_number + 1,
				title: source.title,
				period_start: source.period_start,
				period_end: source.period_end,
				narrative: source.narrative,
				currency_code: source.currency_code,
				planned_revenue_amount: source.planned_revenue_amount,
				planned_opex_amount: source.planned_opex_amount,
				planned_capex_amount: source.planned_capex_amount,
				lifecycle_status: 'draft',
				supersedes_business_plan_id: source.id,
				owner_member_id: activeOwner,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			const [initiatives, milestones, dependencies, components, accountabilities, links] =
				await Promise.all([
					repository.listInitiatives(source.id),
					repository.listMilestones(source.id),
					repository.listDependencies(source.id),
					repository.listComponents(source.id),
					repository.listAccountabilities(source.id),
					repository.listInitiativeComponentLinks(source.id)
				]);
			const initiativeMap = new Map<string, StrategyInitiativeRecord>();
			for (const initiative of initiatives) {
				const [ownerMemberId, sponsorMemberId] = await Promise.all([
					this.validateActiveMember(
						trx,
						actor.organisationId,
						initiative.owner_member_id,
						'Initiative owner'
					).catch(() => null),
					this.validateActiveMember(
						trx,
						actor.organisationId,
						initiative.sponsor_member_id,
						'Initiative sponsor'
					).catch(() => null)
				]);
				const copy = await repository.insertInitiative({
					organisation_id: actor.organisationId,
					strategy_business_plan_id: revision.id,
					strategy_objective_id: initiative.strategy_objective_id,
					public_id: this.publicIdFactory(),
					initiative_code: initiative.initiative_code,
					title: initiative.title,
					outcome_text: initiative.outcome_text,
					benefit_statement: initiative.benefit_statement,
					resource_assumptions: initiative.resource_assumptions,
					risk_summary: initiative.risk_summary,
					priority_rank: initiative.priority_rank,
					start_date: initiative.start_date,
					end_date: initiative.end_date,
					owner_member_id: ownerMemberId,
					sponsor_member_id: sponsorMemberId,
					planned_investment_amount: initiative.planned_investment_amount,
					planned_fte: initiative.planned_fte,
					currency_code: initiative.currency_code,
					project_id: initiative.project_id,
					project_budget_id: initiative.project_budget_id,
					project_budget_version_id: initiative.project_budget_version_id,
					lifecycle_status: 'proposed',
					created_by_member_id: actor.memberId
				});
				initiativeMap.set(initiative.id, copy);
			}
			for (const milestone of milestones) {
				const target = initiativeMap.get(milestone.strategy_initiative_id);
				if (!target) continue;
				const ownerMemberId = await this.validateActiveMember(
					trx,
					actor.organisationId,
					milestone.owner_member_id,
					'Milestone owner'
				).catch(() => null);
				await repository.insertMilestone({
					organisation_id: actor.organisationId,
					strategy_initiative_id: target.id,
					public_id: this.publicIdFactory(),
					milestone_code: milestone.milestone_code,
					title: milestone.title,
					target_date: milestone.target_date,
					actual_date: null,
					lifecycle_status: 'planned',
					owner_member_id: ownerMemberId,
					created_by_member_id: actor.memberId
				});
			}
			for (const dependency of dependencies) {
				const initiative = initiativeMap.get(dependency.initiative_id);
				const dependsOn = initiativeMap.get(dependency.depends_on_initiative_id);
				if (!initiative || !dependsOn) continue;
				await repository.insertDependency({
					organisation_id: actor.organisationId,
					initiative_id: initiative.id,
					depends_on_initiative_id: dependsOn.id,
					dependency_type: dependency.dependency_type,
					created_by_member_id: actor.memberId
				});
			}
			const componentMap = new Map<string, OperatingModelComponentRecord>();
			const pendingComponents = [...components];
			while (pendingComponents.length) {
				const nextIndex = pendingComponents.findIndex(
					(component) =>
						!component.parent_component_id || componentMap.has(component.parent_component_id)
				);
				if (nextIndex < 0)
					throw new BusinessPlanningValidationError(
						'Operating-model component hierarchy is cyclic.'
					);
				const [component] = pendingComponents.splice(nextIndex, 1);
				const copy = await repository.insertComponent({
					organisation_id: actor.organisationId,
					strategy_business_plan_id: revision.id,
					public_id: this.publicIdFactory(),
					component_code: component.component_code,
					parent_component_id: component.parent_component_id
						? (componentMap.get(component.parent_component_id)?.id ?? null)
						: null,
					component_type: component.component_type,
					title: component.title,
					current_state_text: component.current_state_text,
					target_state_text: component.target_state_text,
					lifecycle_status: 'proposed',
					created_by_member_id: actor.memberId
				});
				componentMap.set(component.id, copy);
			}
			for (const accountability of accountabilities) {
				const component = componentMap.get(accountability.operating_model_component_id);
				if (!component) continue;
				const memberId = await this.validateActiveMember(
					trx,
					actor.organisationId,
					accountability.member_id,
					'Named accountability holder'
				).catch(() => null);
				await repository.insertAccountability({
					organisation_id: actor.organisationId,
					operating_model_component_id: component.id,
					public_id: this.publicIdFactory(),
					accountability_type: accountability.accountability_type,
					position_label: accountability.position_label,
					member_id: memberId,
					notes: accountability.notes,
					created_by_member_id: actor.memberId
				});
			}
			for (const link of links) {
				const initiative = initiativeMap.get(link.initiative_id);
				const component = componentMap.get(link.operating_model_component_id);
				if (!initiative || !component) continue;
				await repository.insertInitiativeComponentLink({
					organisation_id: actor.organisationId,
					initiative_id: initiative.id,
					operating_model_component_id: component.id,
					change_role: link.change_role,
					created_by_member_id: actor.memberId
				});
			}
			await this.appendEvidence(
				trx,
				actor,
				'strategy.business_plan.revise',
				'strategy_business_plan',
				revision.public_id,
				{
					sourcePlanPublicId: source.public_id,
					planCode: revision.plan_code,
					versionNumber: revision.version_number,
					initiativesCopied: initiatives.length,
					operatingModelComponentsCopied: components.length
				},
				{ function: 'F01', subfunctions: ['F01.04', 'F01.05'] }
			);
			return revision;
		});
	}
}
