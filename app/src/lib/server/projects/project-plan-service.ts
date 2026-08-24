import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { ConcurrentUpdateError, RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	ProjectPlanRepository,
	type ProjectPlanActivityKind,
	type ProjectPlanActivityRecord,
	type ProjectPlanBaselineRecord,
	type ProjectPlanBaselineSnapshot,
	type ProjectPlanDependencyRecord,
	type ProjectPlanDependencyType,
	type ProjectWbsNodeRecord
} from './project-plan-repository';
import { ProjectRepository, type ProjectRecord } from './project-repository';

export type ProjectPlanView = {
	project: ProjectRecord;
	canManage: boolean;
	canCaptureBaseline: boolean;
	wbsNodes: ProjectWbsNodeRecord[];
	activities: ProjectPlanActivityRecord[];
	dependencies: ProjectPlanDependencyRecord[];
	baselines: ProjectPlanBaselineRecord[];
};

export type CreateProjectWbsNodeInput = {
	projectPublicId: string;
	parentWbsNodePublicId?: string | null;
	wbsCode: string;
	name: string;
	description?: string | null;
	sortOrder?: number;
};

export type CreateProjectPlanActivityInput = {
	projectPublicId: string;
	wbsNodePublicId: string;
	activityCode: string;
	name: string;
	description?: string | null;
	activityKind: ProjectPlanActivityKind;
	plannedStartOn: Date;
	plannedFinishOn: Date;
	plannedDurationDays: number | string;
};

export type CreateProjectPlanDependencyInput = {
	projectPublicId: string;
	predecessorActivityPublicId: string;
	successorActivityPublicId: string;
	dependencyType: ProjectPlanDependencyType;
	lagDays?: number | string;
};

export type CaptureProjectPlanBaselineInput = {
	projectPublicId: string;
	name: string;
	description?: string | null;
};

export class ProjectPlanValidationError extends Error {
	readonly code = 'PROJECT_PLAN_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectPlanValidationError';
	}
}

function validateShortCode(value: string, label: string): string {
	const normalised = value.trim();
	if (!normalised || normalised.length > 80) {
		throw new ProjectPlanValidationError(`${label} must be between 1 and 80 characters.`);
	}
	return normalised;
}

function validateName(value: string, label: string): string {
	const normalised = value.trim();
	if (!normalised || normalised.length > 255) {
		throw new ProjectPlanValidationError(`${label} must be between 1 and 255 characters.`);
	}
	return normalised;
}

function validateDescription(value?: string | null): string | null {
	const normalised = value?.trim() || null;
	if (normalised && normalised.length > 10000) {
		throw new ProjectPlanValidationError('Description must not exceed 10,000 characters.');
	}
	return normalised;
}

function validateDate(value: Date, label: string): Date {
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectPlanValidationError(`${label} is invalid.`);
	}
	return value;
}

function validateDecimal(value: number | string, label: string, input: { min?: number; max?: number }): string {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) throw new ProjectPlanValidationError(`${label} must be a number.`);
	if (input.min !== undefined && numeric < input.min) {
		throw new ProjectPlanValidationError(`${label} must be at least ${input.min}.`);
	}
	if (input.max !== undefined && numeric > input.max) {
		throw new ProjectPlanValidationError(`${label} must not exceed ${input.max}.`);
	}
	return numeric.toFixed(2);
}

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
			typeof error === 'object' &&
			'code' in error &&
			(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

function createsDependencyCycle(
	dependencies: readonly ProjectPlanDependencyRecord[],
	predecessorActivityId: string,
	successorActivityId: string
): boolean {
	const successors = new Map<string, string[]>();
	for (const dependency of dependencies) {
		const next = successors.get(dependency.predecessorActivityId) ?? [];
		next.push(dependency.successorActivityId);
		successors.set(dependency.predecessorActivityId, next);
	}

	const stack = [successorActivityId];
	const visited = new Set<string>();
	while (stack.length > 0) {
		const current = stack.pop()!;
		if (current === predecessorActivityId) return true;
		if (visited.has(current)) continue;
		visited.add(current);
		for (const successor of successors.get(current) ?? []) stack.push(successor);
	}
	return false;
}

export class ProjectPlanService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
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

	private async resolveMutationProject(
		actor: TenantActorContext,
		projectPublicId: string,
		permissionKey: 'project.plan.manage' | 'project.plan.baseline.manage'
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		const project = await this.findProjectInMemberScope(actor, projectPublicId);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			permissionKey,
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed || project.owningOrganisationId !== actor.organisationId) {
			throw new TenantAccessError('Project plan management is not permitted.');
		}
		return project;
	}

	async getPlan(actor: TenantActorContext, projectPublicId: string): Promise<ProjectPlanView> {
		await this.assertActiveActor(actor);
		const project = await this.findProjectInMemberScope(actor, projectPublicId);
		const permissionService = new PermissionService(this.db);
		const [viewDecision, manageDecision, baselineDecision] = await Promise.all([
			permissionService.decide(actor, 'project.plan.view', { projectId: project.id }),
			permissionService.decideWithUmbrella(actor, 'project.plan.manage', 'project.manage', {
				projectId: project.id
			}),
			permissionService.decideWithUmbrella(
				actor,
				'project.plan.baseline.manage',
				'project.manage',
				{ projectId: project.id }
			)
		]);
		if (!viewDecision.allowed && !manageDecision.allowed && !baselineDecision.allowed) {
			throw new RecordNotFoundError('Project plan not found in the active member scope.');
		}

		const repository = new ProjectPlanRepository(this.db);
		const [wbsNodes, activities, dependencies, baselines] = await Promise.all([
			repository.listWbs(project.id),
			repository.listActivities(project.id),
			repository.listActiveDependencies(project.id),
			repository.listBaselines(project.id)
		]);
		const isOwner = project.owningOrganisationId === actor.organisationId;
		return {
			project,
			canManage: isOwner && manageDecision.allowed,
			canCaptureBaseline: isOwner && baselineDecision.allowed,
			wbsNodes,
			activities,
			dependencies,
			baselines
		};
	}

	async createWbsNode(
		actor: TenantActorContext,
		input: CreateProjectWbsNodeInput
	): Promise<ProjectWbsNodeRecord> {
		const project = await this.resolveMutationProject(actor, input.projectPublicId, 'project.plan.manage');
		const wbsCode = validateShortCode(input.wbsCode, 'WBS code');
		const name = validateName(input.name, 'WBS name');
		const description = validateDescription(input.description);
		const sortOrder = input.sortOrder ?? 0;
		if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 1_000_000) {
			throw new ProjectPlanValidationError('WBS sort order must be a whole number from 0 to 1,000,000.');
		}

		const repository = new ProjectPlanRepository(this.db);
		if (await repository.findWbsByCode(project.id, wbsCode)) {
			throw new ProjectPlanValidationError('That WBS code is already in use on this project.');
		}
		const parentPublicId = input.parentWbsNodePublicId?.trim() || null;
		const parent = parentPublicId
			? await repository.findWbsByPublicId(project.id, parentPublicId)
			: null;
		if (parentPublicId && !parent) {
			throw new ProjectPlanValidationError('The selected parent WBS node is not available on this project.');
		}

		const publicId = this.publicIdFactory();
		try {
			await this.db.transaction().execute(async (transaction) => {
				await new ProjectPlanRepository(transaction).insertWbs({
					organisationId: actor.organisationId,
					projectId: project.id,
					publicId,
					parentWbsNodeId: parent?.id ?? null,
					wbsCode,
					name,
					description,
					sortOrder,
					createdByMemberId: actor.memberId
				});
				await new AuditRepository(transaction).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actor.memberId,
					projectId: project.id,
					actionKey: 'project.wbs_node.created',
					subjectType: 'project_wbs_node',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: {
						wbsCode,
						name,
						parentWbsNodePublicId: parent?.publicId ?? null
					}
				});
			});
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				throw new ProjectPlanValidationError('That WBS code is already in use on this project.');
			}
			throw error;
		}

		const created = await repository.findWbsByPublicId(project.id, publicId);
		if (!created) throw new Error('Created WBS node could not be reloaded.');
		return created;
	}

	async createActivity(
		actor: TenantActorContext,
		input: CreateProjectPlanActivityInput
	): Promise<ProjectPlanActivityRecord> {
		const project = await this.resolveMutationProject(actor, input.projectPublicId, 'project.plan.manage');
		const repository = new ProjectPlanRepository(this.db);
		const wbs = await repository.findWbsByPublicId(project.id, input.wbsNodePublicId.trim());
		if (!wbs) throw new ProjectPlanValidationError('The selected WBS node is not available on this project.');
		const activityCode = validateShortCode(input.activityCode, 'Activity code');
		const name = validateName(input.name, input.activityKind === 'milestone' ? 'Milestone name' : 'Activity name');
		const description = validateDescription(input.description);
		if (input.activityKind !== 'activity' && input.activityKind !== 'milestone') {
			throw new ProjectPlanValidationError('Activity kind must be activity or milestone.');
		}
		const plannedStartOn = validateDate(input.plannedStartOn, 'Planned start');
		const plannedFinishOn = validateDate(input.plannedFinishOn, 'Planned finish');
		if (plannedFinishOn.getTime() < plannedStartOn.getTime()) {
			throw new ProjectPlanValidationError('Planned finish must be on or after planned start.');
		}
		const plannedDurationDays = validateDecimal(input.plannedDurationDays, 'Planned duration', {
			min: 0,
			max: 100000
		});
		if (input.activityKind === 'milestone') {
			if (Number(plannedDurationDays) !== 0 || plannedStartOn.getTime() !== plannedFinishOn.getTime()) {
				throw new ProjectPlanValidationError(
					'Milestones must have zero duration and the same planned start and finish date.'
				);
			}
		} else if (Number(plannedDurationDays) <= 0) {
			throw new ProjectPlanValidationError('Activities must have a planned duration greater than zero.');
		}
		if (await repository.findActivityByCode(project.id, activityCode)) {
			throw new ProjectPlanValidationError('That activity code is already in use on this project.');
		}

		const publicId = this.publicIdFactory();
		try {
			await this.db.transaction().execute(async (transaction) => {
				await new ProjectPlanRepository(transaction).insertActivity({
					organisationId: actor.organisationId,
					projectId: project.id,
					wbsNodeId: wbs.id,
					publicId,
					activityCode,
					name,
					description,
					activityKind: input.activityKind,
					plannedStartOn,
					plannedFinishOn,
					plannedDurationDays,
					createdByMemberId: actor.memberId
				});
				await new AuditRepository(transaction).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actor.memberId,
					projectId: project.id,
					actionKey: 'project.plan.activity_created',
					subjectType: 'project_plan_activity',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: {
						activityCode,
						name,
						activityKind: input.activityKind,
						wbsNodePublicId: wbs.publicId,
						plannedStartOn: plannedStartOn.toISOString().slice(0, 10),
						plannedFinishOn: plannedFinishOn.toISOString().slice(0, 10),
						plannedDurationDays
					}
				});
			});
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				throw new ProjectPlanValidationError('That activity code is already in use on this project.');
			}
			throw error;
		}

		const created = await repository.findActivityByPublicId(project.id, publicId);
		if (!created) throw new Error('Created project-plan activity could not be reloaded.');
		return created;
	}

	async addDependency(
		actor: TenantActorContext,
		input: CreateProjectPlanDependencyInput
	): Promise<ProjectPlanDependencyRecord> {
		const project = await this.resolveMutationProject(actor, input.projectPublicId, 'project.plan.manage');
		const repository = new ProjectPlanRepository(this.db);
		const [predecessor, successor] = await Promise.all([
			repository.findActivityByPublicId(project.id, input.predecessorActivityPublicId.trim()),
			repository.findActivityByPublicId(project.id, input.successorActivityPublicId.trim())
		]);
		if (!predecessor || !successor) {
			throw new ProjectPlanValidationError('Both dependency activities must belong to this project plan.');
		}
		if (predecessor.id === successor.id) {
			throw new ProjectPlanValidationError('An activity cannot depend on itself.');
		}
		if (!['FS', 'SS', 'FF', 'SF'].includes(input.dependencyType)) {
			throw new ProjectPlanValidationError('Dependency type must be FS, SS, FF or SF.');
		}
		const lagDays = validateDecimal(input.lagDays ?? 0, 'Dependency lag', {
			min: -100000,
			max: 100000
		});
		if (await repository.findActiveDependencyBetween(project.id, predecessor.id, successor.id)) {
			throw new ProjectPlanValidationError('That dependency already exists on the current project plan.');
		}
		const existingDependencies = await repository.listActiveDependencies(project.id);
		if (createsDependencyCycle(existingDependencies, predecessor.id, successor.id)) {
			throw new ProjectPlanValidationError('That dependency would create a cycle in the project plan.');
		}

		const publicId = this.publicIdFactory();
		await this.db.transaction().execute(async (transaction) => {
			await new ProjectPlanRepository(transaction).insertDependency({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId,
				predecessorActivityId: predecessor.id,
				successorActivityId: successor.id,
				dependencyType: input.dependencyType,
				lagDays,
				createdByMemberId: actor.memberId
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.plan.dependency_created',
				subjectType: 'project_plan_dependency',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					predecessorActivityPublicId: predecessor.publicId,
					successorActivityPublicId: successor.publicId,
					dependencyType: input.dependencyType,
					lagDays
				}
			});
		});

		const created = (await repository.listActiveDependencies(project.id)).find(
			(dependency) => dependency.publicId === publicId
		);
		if (!created) throw new Error('Created dependency could not be reloaded.');
		return created;
	}

	async removeDependency(
		actor: TenantActorContext,
		projectPublicId: string,
		dependencyPublicId: string
	): Promise<void> {
		const project = await this.resolveMutationProject(actor, projectPublicId, 'project.plan.manage');
		const dependency = (await new ProjectPlanRepository(this.db).listActiveDependencies(project.id)).find(
			(candidate) => candidate.publicId === dependencyPublicId
		);
		if (!dependency) throw new RecordNotFoundError('Project-plan dependency not found.');
		const removedAt = new Date();
		await this.db.transaction().execute(async (transaction) => {
			const changed = await new ProjectPlanRepository(transaction).removeDependency({
				projectId: project.id,
				publicId: dependency.publicId,
				removedByMemberId: actor.memberId,
				removedAt
			});
			if (!changed) throw new ConcurrentUpdateError();
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.plan.dependency_removed',
				subjectType: 'project_plan_dependency',
				subjectPublicId: dependency.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					predecessorActivityPublicId: dependency.predecessorActivityPublicId,
					successorActivityPublicId: dependency.successorActivityPublicId
				}
			});
		});
	}

	async captureBaseline(
		actor: TenantActorContext,
		input: CaptureProjectPlanBaselineInput
	): Promise<ProjectPlanBaselineSnapshot> {
		const project = await this.resolveMutationProject(
			actor,
			input.projectPublicId,
			'project.plan.baseline.manage'
		);
		const name = validateName(input.name, 'Baseline name');
		const description = validateDescription(input.description);
		const baselinePublicId = this.publicIdFactory();
		const capturedAt = new Date();

		await this.db.transaction().execute(async (transaction) => {
			await transaction
				.selectFrom('projects')
				.select('id')
				.where('id', '=', project.id)
				.forUpdate()
				.executeTakeFirstOrThrow();
			const repository = new ProjectPlanRepository(transaction);
			const [activities, dependencies] = await Promise.all([
				repository.listActivities(project.id),
				repository.listActiveDependencies(project.id)
			]);
			if (activities.length === 0) {
				throw new ProjectPlanValidationError('A schedule baseline requires at least one activity or milestone.');
			}
			const baselineNumber = await repository.nextBaselineNumber(project.id);
			const baselineId = await repository.insertBaseline({
				organisationId: actor.organisationId,
				projectId: project.id,
				publicId: baselinePublicId,
				baselineNumber,
				name,
				description,
				capturedByMemberId: actor.memberId,
				capturedAt
			});
			await repository.insertBaselineActivities({
				organisationId: actor.organisationId,
				projectId: project.id,
				baselineId,
				activities
			});
			await repository.insertBaselineDependencies({
				organisationId: actor.organisationId,
				projectId: project.id,
				baselineId,
				dependencies
			});
			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.plan.baseline_captured',
				subjectType: 'project_plan_baseline',
				subjectPublicId: baselinePublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					baselineNumber,
					name,
					activityCount: activities.length,
					dependencyCount: dependencies.length
				}
			});
		});

		const snapshot = await new ProjectPlanRepository(this.db).getBaselineSnapshot(
			project.id,
			baselinePublicId
		);
		if (!snapshot) throw new Error('Captured project-plan baseline could not be reloaded.');
		return snapshot;
	}

	async getBaselineSnapshot(
		actor: TenantActorContext,
		projectPublicId: string,
		baselinePublicId: string
	): Promise<ProjectPlanBaselineSnapshot> {
		const view = await this.getPlan(actor, projectPublicId);
		const snapshot = await new ProjectPlanRepository(this.db).getBaselineSnapshot(
			view.project.id,
			baselinePublicId
		);
		if (!snapshot) throw new RecordNotFoundError('Project-plan baseline not found.');
		return snapshot;
	}
}
