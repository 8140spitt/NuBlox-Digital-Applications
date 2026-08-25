import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { WorkItemService } from '$lib/server/work/work-item-service';
import { ensureProjectRidaStandardRoleDefaults } from './project-rida-bootstrap';
import {
	ProjectRidaRepository,
	type IssueSeverity,
	type ProjectRidaActionRecord,
	type ProjectRidaItemRecord,
	type ProjectRidaItemType,
	type ProjectRidaLifecycleStatus,
	type ProjectRidaPriority,
	type RiskDirection,
	type RiskResponseStrategy
} from './project-rida-repository';
import { ProjectRepository, type ProjectRecord } from './project-repository';

export class ProjectRidaValidationError extends Error {
	readonly code = 'PROJECT_RIDA_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'ProjectRidaValidationError';
	}
}

export type CreateProjectRidaItemInput = {
	projectPublicId: string;
	itemType: ProjectRidaItemType;
	title: string;
	description?: string | null;
	priority?: ProjectRidaPriority;
	ownerMemberId?: string | null;
	dueOn?: Date | null;
	riskDirection?: RiskDirection | null;
	probabilityScore?: number | null;
	impactScore?: number | null;
	responseStrategy?: RiskResponseStrategy | null;
	responsePlan?: string | null;
	residualProbabilityScore?: number | null;
	residualImpactScore?: number | null;
	severity?: IssueSeverity | null;
	impactSummary?: string | null;
	resolutionPlan?: string | null;
	decisionRequiredOn?: Date | null;
};

export type UpdateProjectRidaItemInput = Omit<CreateProjectRidaItemInput, 'itemType'> & {
	itemPublicId: string;
};

export type CreateProjectRidaActionInput = {
	projectPublicId: string;
	itemPublicId: string;
	title: string;
	description?: string | null;
	priority?: 'low' | 'normal' | 'high' | 'critical';
	dueAt?: Date | null;
};

export type ProjectRidaWorkspace = {
	project: ProjectRecord;
	items: ProjectRidaItemRecord[];
	actions: ProjectRidaActionRecord[];
	canManage: boolean;
	canDecide: boolean;
	canClose: boolean;
	canCreateAction: boolean;
	openRiskCount: number;
	openIssueCount: number;
	pendingDecisionCount: number;
	openActionCount: number;
};

const TRANSITIONS: Readonly<
	Record<ProjectRidaItemType, Partial<Record<ProjectRidaLifecycleStatus, readonly ProjectRidaLifecycleStatus[]>>>
> = {
	risk: {
		open: ['monitoring', 'realised'],
		monitoring: ['open', 'realised'],
		realised: ['monitoring']
	},
	issue: {
		open: ['investigating', 'resolved'],
		investigating: ['open', 'resolved'],
		resolved: ['investigating']
	},
	decision: {
		proposed: ['pending'],
		pending: ['proposed'],
		decided: ['superseded']
	}
};

function requiredText(value: string, label: string, max: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > max) {
		throw new ProjectRidaValidationError(`${label} must be between 1 and ${max} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new ProjectRidaValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function score(value: number | null | undefined, label: string): number | null {
	if (value === null || value === undefined) return null;
	if (!Number.isInteger(value) || value < 1 || value > 5) {
		throw new ProjectRidaValidationError(`${label} must be a whole number from 1 to 5.`);
	}
	return value;
}

function dateOnly(value: Date | null | undefined, label: string): Date | null {
	if (!value) return null;
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectRidaValidationError(`${label} is invalid.`);
	}
	return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function assertChoice<T extends string>(value: T, allowed: readonly T[], label: string): T {
	if (!allowed.includes(value)) throw new ProjectRidaValidationError(`${label} is invalid.`);
	return value;
}

export class ProjectRidaService {
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

	private async findProject(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		await ensureProjectRidaStandardRoleDefaults(this.db, actor.organisationId);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Project controls register not found in the active member scope.');
		}
		const viewProject = await new PermissionService(this.db).decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!viewProject.allowed) {
			throw new RecordNotFoundError('Project controls register not found in the active member scope.');
		}
		return project;
	}

	private async permissionFlags(actor: TenantActorContext, project: ProjectRecord) {
		const permissions = new PermissionService(this.db);
		const [view, manage, decide, close, workView, workCreate] = await Promise.all([
			permissions.decide(actor, 'project.rida.view', { projectId: project.id }),
			permissions.decideWithUmbrella(actor, 'project.rida.manage', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.rida.decide', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.rida.close', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'work.view', 'work.manage', { projectId: project.id }),
			permissions.decideWithUmbrella(actor, 'work.create', 'work.manage', { projectId: project.id })
		]);
		if (!view.allowed && !manage.allowed && !decide.allowed && !close.allowed) {
			throw new RecordNotFoundError('Project controls register not found in the active member scope.');
		}
		return {
			canManage: manage.allowed,
			canDecide: decide.allowed,
			canClose: close.allowed,
			canViewActions: workView.allowed,
			canCreateAction: manage.allowed && workCreate.allowed
		};
	}

	private async requirePermission(
		actor: TenantActorContext,
		projectPublicId: string,
		permissionKey: 'project.rida.manage' | 'project.rida.decide' | 'project.rida.close'
	): Promise<ProjectRecord> {
		const project = await this.findProject(actor, projectPublicId);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			permissionKey,
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed) throw new TenantAccessError('Project controls register management is not permitted.');
		return project;
	}

	private async validateOwnerMember(organisationId: string, memberId: string | null): Promise<void> {
		if (!memberId) return;
		const row = await this.db
			.selectFrom('organisation_members')
			.select('id')
			.where('id', '=', memberId)
			.where('organisation_id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) throw new ProjectRidaValidationError('Owner must be an active member of the project owner organisation.');
	}

	private normalizeItemInput(itemType: ProjectRidaItemType, input: CreateProjectRidaItemInput) {
		assertChoice(itemType, ['risk', 'issue', 'decision'] as const, 'Register item type');
		const priority = assertChoice(
			input.priority ?? 'normal',
			['low', 'normal', 'high', 'critical'] as const,
			'Priority'
		);
		const base = {
			title: requiredText(input.title, 'Title', 255),
			description: optionalText(input.description, 20_000),
			priority,
			ownerMemberId: input.ownerMemberId?.trim() || null,
			dueOn: dateOnly(input.dueOn, 'Due date'),
			riskDirection: null as RiskDirection | null,
			probabilityScore: null as number | null,
			impactScore: null as number | null,
			responseStrategy: null as RiskResponseStrategy | null,
			responsePlan: null as string | null,
			residualProbabilityScore: null as number | null,
			residualImpactScore: null as number | null,
			severity: null as IssueSeverity | null,
			impactSummary: null as string | null,
			resolutionPlan: null as string | null,
			decisionRequiredOn: null as Date | null
		};

		if (itemType === 'risk') {
			if (!input.riskDirection) throw new ProjectRidaValidationError('Risk direction is required.');
			base.riskDirection = assertChoice(
				input.riskDirection,
				['threat', 'opportunity'] as const,
				'Risk direction'
			);
			base.probabilityScore = score(input.probabilityScore, 'Probability score');
			base.impactScore = score(input.impactScore, 'Impact score');
			if (base.probabilityScore === null || base.impactScore === null) {
				throw new ProjectRidaValidationError('Risk probability and impact scores are required.');
			}
			base.responseStrategy = input.responseStrategy
				? assertChoice(
						input.responseStrategy,
						['avoid', 'reduce', 'transfer', 'accept', 'exploit', 'enhance', 'share'] as const,
						'Risk response strategy'
					)
				: null;
			base.responsePlan = optionalText(input.responsePlan, 20_000);
			base.residualProbabilityScore = score(input.residualProbabilityScore, 'Residual probability score');
			base.residualImpactScore = score(input.residualImpactScore, 'Residual impact score');
		}

		if (itemType === 'issue') {
			if (!input.severity) throw new ProjectRidaValidationError('Issue severity is required.');
			base.severity = assertChoice(
				input.severity,
				['low', 'medium', 'high', 'critical'] as const,
				'Issue severity'
			);
			base.impactSummary = optionalText(input.impactSummary, 20_000);
			base.resolutionPlan = optionalText(input.resolutionPlan, 20_000);
		}

		if (itemType === 'decision') {
			base.decisionRequiredOn = dateOnly(input.decisionRequiredOn, 'Decision required date');
		}

		return base;
	}

	private async appendEvidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		item: ProjectRidaItemRecord,
		actionKey: string,
		changeSummary: Record<string, unknown>
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			projectId: item.projectId,
			actionKey,
			subjectType: 'project_rida_item',
			subjectPublicId: item.publicId,
			correlationId: actor.correlationId,
			changeSummary,
			eventMetadata: { itemType: item.itemType, itemNumber: item.itemNumber }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: 'project_rida_item',
			aggregatePublicId: item.publicId,
			correlationId: actor.correlationId,
			payload: {
				projectId: item.projectId,
				itemType: item.itemType,
				itemNumber: item.itemNumber,
				status: item.status,
				...changeSummary
			}
		});
	}

	async getWorkspace(actor: TenantActorContext, projectPublicId: string): Promise<ProjectRidaWorkspace> {
		const project = await this.findProject(actor, projectPublicId);
		const flags = await this.permissionFlags(actor, project);
		const repository = new ProjectRidaRepository(this.db);
		const [items, actions] = await Promise.all([
			repository.listItems(project.id),
			flags.canViewActions ? repository.listActions(project.id) : Promise.resolve([])
		]);
		return {
			project,
			items,
			actions,
			canManage: flags.canManage,
			canDecide: flags.canDecide,
			canClose: flags.canClose,
			canCreateAction: flags.canCreateAction,
			openRiskCount: items.filter((item) => item.itemType === 'risk' && item.status !== 'closed').length,
			openIssueCount: items.filter((item) => item.itemType === 'issue' && item.status !== 'closed').length,
			pendingDecisionCount: items.filter(
				(item) => item.itemType === 'decision' && ['proposed', 'pending'].includes(item.status)
			).length,
			openActionCount: actions.filter((action) => !['completed', 'cancelled'].includes(action.status)).length
		};
	}

	async createItem(actor: TenantActorContext, input: CreateProjectRidaItemInput): Promise<string> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.rida.manage');
		const normalized = this.normalizeItemInput(input.itemType, input);
		await this.validateOwnerMember(project.owningOrganisationId, normalized.ownerMemberId);
		const publicId = this.publicIdFactory();

		await this.db.transaction().execute(async (trx) => {
			const repository = new ProjectRidaRepository(trx);
			const itemNumber = await repository.nextItemNumber(project.id, input.itemType);
			const status: ProjectRidaLifecycleStatus = input.itemType === 'decision' ? 'proposed' : 'open';
			await repository.insertItem({
				organisationId: project.owningOrganisationId,
				projectId: project.id,
				publicId,
				itemNumber,
				itemType: input.itemType,
				status,
				...normalized,
				memberId: actor.memberId
			});
			const created = await repository.findItemByPublicId(project.id, publicId);
			if (!created) throw new Error('Created project RIDA item could not be reloaded.');
			await this.appendEvidence(trx, actor, created, 'project.rida.created', {
				status: created.status,
				title: created.title,
				priority: created.priority
			});
		});
		return publicId;
	}

	async updateItem(actor: TenantActorContext, input: UpdateProjectRidaItemInput): Promise<void> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.rida.manage');
		await this.db.transaction().execute(async (trx) => {
			const repository = new ProjectRidaRepository(trx);
			const current = await repository.findItemByPublicId(project.id, input.itemPublicId.trim());
			if (!current) throw new RecordNotFoundError('Register item not found.');
			if (['closed', 'decided', 'superseded'].includes(current.status)) {
				throw new ProjectRidaValidationError('Terminal register items cannot be edited.');
			}
			const normalized = this.normalizeItemInput(current.itemType, {
				...input,
				itemType: current.itemType
			});
			await this.validateOwnerMember(project.owningOrganisationId, normalized.ownerMemberId);
			const changed = await repository.updateItem({
				projectId: project.id,
				itemId: current.id,
				expectedStatus: current.status,
				...normalized,
				memberId: actor.memberId
			});
			if (!changed) throw new ConcurrentUpdateError();
			const updated = await repository.findItemByPublicId(project.id, current.publicId);
			if (!updated) throw new RecordNotFoundError('Updated register item could not be reloaded.');
			await this.appendEvidence(trx, actor, updated, 'project.rida.updated', {
				title: updated.title,
				priority: updated.priority,
				ownerMemberId: updated.ownerMemberId
			});
		});
	}

	async transitionItem(
		actor: TenantActorContext,
		projectPublicId: string,
		itemPublicId: string,
		toStatus: ProjectRidaLifecycleStatus
	): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.rida.manage');
		await this.db.transaction().execute(async (trx) => {
			const repository = new ProjectRidaRepository(trx);
			const current = await repository.findItemByPublicId(project.id, itemPublicId.trim());
			if (!current) throw new RecordNotFoundError('Register item not found.');
			if (toStatus === 'closed' || toStatus === 'decided') {
				throw new ProjectRidaValidationError('Use the controlled close or decision action for this transition.');
			}
			if (current.itemType === 'decision' && toStatus === 'superseded') {
				const decision = await new PermissionService(trx).decideWithUmbrella(
					actor,
					'project.rida.decide',
					'project.manage',
					{ projectId: project.id }
				);
				if (!decision.allowed) throw new TenantAccessError('Decision authority is required.');
			}
			const allowed = TRANSITIONS[current.itemType][current.status] ?? [];
			if (!allowed.includes(toStatus)) throw new InvalidLifecycleTransitionError(current.status, toStatus);
			const changed = await repository.transition({
				projectId: project.id,
				itemId: current.id,
				fromStatus: current.status,
				toStatus,
				memberId: actor.memberId
			});
			if (!changed) throw new ConcurrentUpdateError();
			const updated = await repository.findItemByPublicId(project.id, current.publicId);
			if (!updated) throw new RecordNotFoundError('Updated register item could not be reloaded.');
			await this.appendEvidence(trx, actor, updated, 'project.rida.status_changed', {
				fromStatus: current.status,
				toStatus
			});
		});
	}

	async decideItem(
		actor: TenantActorContext,
		projectPublicId: string,
		itemPublicId: string,
		outcome: string,
		rationale?: string | null
	): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.rida.decide');
		const normalizedOutcome = requiredText(outcome, 'Decision outcome', 20_000);
		const normalizedRationale = optionalText(rationale, 20_000);
		await this.db.transaction().execute(async (trx) => {
			const repository = new ProjectRidaRepository(trx);
			const current = await repository.findItemByPublicId(project.id, itemPublicId.trim());
			if (!current || current.itemType !== 'decision') throw new RecordNotFoundError('Decision not found.');
			if (!['proposed', 'pending'].includes(current.status)) {
				throw new InvalidLifecycleTransitionError(current.status, 'decided');
			}
			const changed = await repository.recordDecision({
				projectId: project.id,
				itemId: current.id,
				fromStatus: current.status as 'proposed' | 'pending',
				outcome: normalizedOutcome,
				rationale: normalizedRationale,
				memberId: actor.memberId,
				decidedAt: this.now()
			});
			if (!changed) throw new ConcurrentUpdateError();
			const updated = await repository.findItemByPublicId(project.id, current.publicId);
			if (!updated) throw new RecordNotFoundError('Decided register item could not be reloaded.');
			await this.appendEvidence(trx, actor, updated, 'project.rida.decided', {
				fromStatus: current.status,
				toStatus: 'decided',
				outcome: normalizedOutcome
			});
		});
	}

	async closeItem(
		actor: TenantActorContext,
		projectPublicId: string,
		itemPublicId: string
	): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.rida.close');
		await this.db.transaction().execute(async (trx) => {
			const repository = new ProjectRidaRepository(trx);
			const current = await repository.findItemByPublicId(project.id, itemPublicId.trim());
			if (!current || !['risk', 'issue'].includes(current.itemType)) {
				throw new RecordNotFoundError('Closable register item not found.');
			}
			if (current.status === 'closed') throw new InvalidLifecycleTransitionError('closed', 'closed');
			const changed = await repository.closeItem({
				projectId: project.id,
				itemId: current.id,
				fromStatus: current.status,
				memberId: actor.memberId,
				closedAt: this.now()
			});
			if (!changed) throw new ConcurrentUpdateError();
			const updated = await repository.findItemByPublicId(project.id, current.publicId);
			if (!updated) throw new RecordNotFoundError('Closed register item could not be reloaded.');
			await this.appendEvidence(trx, actor, updated, 'project.rida.closed', {
				fromStatus: current.status,
				toStatus: 'closed'
			});
		});
	}

	async createAction(actor: TenantActorContext, input: CreateProjectRidaActionInput): Promise<string> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.rida.manage');
		const item = await new ProjectRidaRepository(this.db).findItemByPublicId(
			project.id,
			input.itemPublicId.trim()
		);
		if (!item) throw new RecordNotFoundError('Register item not found.');
		const workItem = await new WorkItemService(this.db).create(actor, {
			projectId: project.id,
			kind: 'action',
			sourceDomain: 'project_controls',
			sourceType: 'project_rida_item',
			sourcePublicId: item.publicId,
			title: requiredText(input.title, 'Action title', 255),
			description: optionalText(input.description, 20_000),
			priority: input.priority ?? 'normal',
			dueAt: input.dueAt ?? null
		});
		return workItem.publicId;
	}
}
