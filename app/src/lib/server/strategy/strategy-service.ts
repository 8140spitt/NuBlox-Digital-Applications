import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	StrategyRepository,
	type StrategyEnvironmentFactorRecord,
	type StrategyFrameworkRecord,
	type StrategyObjectiveRecord,
	type StrategyOptionRecord
} from './strategy-repository';

export class StrategyValidationError extends Error {
	readonly code = 'STRATEGY_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'StrategyValidationError';
	}
}

export type StrategyWorkspace = {
	frameworks: StrategyFrameworkRecord[];
	selectedFramework: StrategyFrameworkRecord | null;
	environmentFactors: StrategyEnvironmentFactorRecord[];
	options: StrategyOptionRecord[];
	objectives: StrategyObjectiveRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type StrategyFrameworkInput = {
	frameworkCode: string;
	title: string;
	horizonStart: string | Date;
	horizonEnd: string | Date;
	purposeText: string;
	visionText: string;
	missionText: string;
	ownerMemberId?: string | null;
};

export type EnvironmentFactorInput = {
	frameworkPublicId: string;
	contextScope: 'internal' | 'external';
	dimension:
		| 'economic'
		| 'competitive'
		| 'market'
		| 'technology'
		| 'regulatory'
		| 'operational'
		| 'other';
	direction: 'strength' | 'weakness' | 'opportunity' | 'threat' | 'neutral';
	title: string;
	analysisText: string;
	evidenceReference?: string | null;
	observedOn?: string | Date | null;
	likelihoodScore?: number | string | null;
	impactScore?: number | string | null;
	ownerMemberId?: string | null;
};

export type StrategyOptionInput = {
	frameworkPublicId: string;
	title: string;
	description: string;
	evaluationSummary?: string | null;
	priorityRank?: number | string | null;
};

export type StrategyObjectiveInput = {
	frameworkPublicId: string;
	objectiveCode: string;
	title: string;
	description: string;
	priorityRank: number | string;
	ownerMemberId?: string | null;
	targetDate?: string | Date | null;
};

const FRAMEWORK_CODE = /^[A-Z0-9][A-Z0-9_-]{1,63}$/;
const OBJECTIVE_CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new StrategyValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) {
		throw new StrategyValidationError(`Text must not exceed ${maximum} characters.`);
	}
	return normalized;
}

function code(value: string, label: string, pattern: RegExp): string {
	const normalized = value.trim().toUpperCase();
	if (!pattern.test(normalized)) {
		throw new StrategyValidationError(`${label} has an invalid format.`);
	}
	return normalized;
}

function dateOnly(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? value : new Date(`${value.trim()}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) throw new StrategyValidationError(`${label} is invalid.`);
	return new Date(`${parsed.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function optionalDateOnly(value: string | Date | null | undefined, label: string): Date | null {
	if (value === null || value === undefined || value === '') return null;
	return dateOnly(value, label);
}

function score(value: number | string | null | undefined, label: string): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
		throw new StrategyValidationError(`${label} must be a whole number from 1 to 5.`);
	}
	return parsed;
}

function positiveInteger(value: number | string | null | undefined, label: string): number | null {
	if (value === null || value === undefined || value === '') return null;
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(parsed) || parsed < 1) {
		throw new StrategyValidationError(`${label} must be a positive whole number.`);
	}
	return parsed;
}

export class StrategyService {
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
			throw new RecordNotFoundError('Enterprise strategy workspace not found in the active scope.');
		}
		return { canManage: manage.allowed, canApprove: approve.allowed };
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: 'strategy.manage' | 'strategy.approve'
	): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) {
			throw new TenantAccessError('Enterprise strategy action is not permitted.');
		}
	}

	private async validateOwnerMember(
		db: DatabaseExecutor,
		organisationId: string,
		memberId: string | null | undefined
	): Promise<string | null> {
		const normalized = memberId?.trim() || null;
		if (!normalized) return null;
		const row = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('id', '=', normalized)
			.where('organisation_id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) throw new StrategyValidationError('Owner must be an active organisation member.');
		return normalized;
	}

	private async requireDraftFramework(
		db: DatabaseExecutor,
		organisationId: string,
		publicId: string
	): Promise<StrategyFrameworkRecord> {
		const framework = await new StrategyRepository(db).findFrameworkByPublicId(
			organisationId,
			publicId.trim()
		);
		if (!framework) throw new RecordNotFoundError('Strategy framework not found.');
		if (framework.lifecycle_status !== 'draft') {
			throw new StrategyValidationError(
				'Approved strategy versions are immutable; create a controlled revision instead.'
			);
		}
		return framework;
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

	async getWorkspace(
		actor: TenantActorContext,
		selectedFrameworkPublicId?: string | null
	): Promise<StrategyWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new StrategyRepository(this.db);
		const frameworks = await repository.listFrameworks(actor.organisationId);
		let selectedFramework: StrategyFrameworkRecord | null = frameworks[0] ?? null;
		if (selectedFrameworkPublicId?.trim()) {
			selectedFramework =
				(await repository.findFrameworkByPublicId(
					actor.organisationId,
					selectedFrameworkPublicId.trim()
				)) ?? null;
			if (!selectedFramework) throw new RecordNotFoundError('Strategy framework not found.');
		}
		if (!selectedFramework) {
			return {
				frameworks,
				selectedFramework: null,
				environmentFactors: [],
				options: [],
				objectives: [],
				...flags
			};
		}
		const [environmentFactors, options, objectives] = await Promise.all([
			repository.listEnvironmentFactors(selectedFramework.id),
			repository.listOptions(selectedFramework.id),
			repository.listObjectives(selectedFramework.id)
		]);
		return { frameworks, selectedFramework, environmentFactors, options, objectives, ...flags };
	}

	async createFramework(
		actor: TenantActorContext,
		input: StrategyFrameworkInput
	): Promise<StrategyFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		const frameworkCode = code(input.frameworkCode, 'Framework code', FRAMEWORK_CODE);
		const horizonStart = dateOnly(input.horizonStart, 'Horizon start');
		const horizonEnd = dateOnly(input.horizonEnd, 'Horizon end');
		if (horizonEnd < horizonStart) {
			throw new StrategyValidationError('Horizon end must not be before horizon start.');
		}
		return this.db.transaction().execute(async (trx) => {
			const repository = new StrategyRepository(trx);
			if (await repository.findLatestVersion(actor.organisationId, frameworkCode)) {
				throw new StrategyValidationError(
					'A strategy framework with this code already exists; create a controlled revision instead.'
				);
			}
			const ownerMemberId = await this.validateOwnerMember(
				trx,
				actor.organisationId,
				input.ownerMemberId
			);
			const framework = await repository.insertFramework({
				organisation_id: actor.organisationId,
				public_id: this.publicIdFactory(),
				framework_code: frameworkCode,
				version_number: 1,
				title: requiredText(input.title, 'Title', 255),
				horizon_start: horizonStart,
				horizon_end: horizonEnd,
				purpose_text: requiredText(input.purposeText, 'Purpose', 20_000),
				vision_text: requiredText(input.visionText, 'Vision', 20_000),
				mission_text: requiredText(input.missionText, 'Mission', 20_000),
				lifecycle_status: 'draft',
				supersedes_strategy_framework_id: null,
				owner_member_id: ownerMemberId,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.framework.create',
				'strategy_framework',
				framework.public_id,
				{ frameworkCode, versionNumber: 1, lifecycleStatus: 'draft' },
				{ function: 'F01', subfunctions: ['F01.01', 'F01.03'] }
			);
			return framework;
		});
	}

	async updateFramework(
		actor: TenantActorContext,
		frameworkPublicId: string,
		input: Omit<StrategyFrameworkInput, 'frameworkCode'>
	): Promise<StrategyFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		const horizonStart = dateOnly(input.horizonStart, 'Horizon start');
		const horizonEnd = dateOnly(input.horizonEnd, 'Horizon end');
		if (horizonEnd < horizonStart) {
			throw new StrategyValidationError('Horizon end must not be before horizon start.');
		}
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				frameworkPublicId
			);
			const ownerMemberId = await this.validateOwnerMember(
				trx,
				actor.organisationId,
				input.ownerMemberId
			);
			const updated = await new StrategyRepository(trx).updateFramework(
				actor.organisationId,
				framework.id,
				{
					title: requiredText(input.title, 'Title', 255),
					horizon_start: horizonStart,
					horizon_end: horizonEnd,
					purpose_text: requiredText(input.purposeText, 'Purpose', 20_000),
					vision_text: requiredText(input.visionText, 'Vision', 20_000),
					mission_text: requiredText(input.missionText, 'Mission', 20_000),
					owner_member_id: ownerMemberId
				}
			);
			await this.appendEvidence(
				trx,
				actor,
				'strategy.framework.update',
				'strategy_framework',
				updated.public_id,
				{ versionNumber: updated.version_number, lifecycleStatus: updated.lifecycle_status },
				{ function: 'F01', subfunction: 'F01.01' }
			);
			return updated;
		});
	}

	async addEnvironmentFactor(
		actor: TenantActorContext,
		input: EnvironmentFactorInput
	): Promise<StrategyEnvironmentFactorRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		if (
			(input.contextScope === 'internal' && ['opportunity', 'threat'].includes(input.direction)) ||
			(input.contextScope === 'external' && ['strength', 'weakness'].includes(input.direction))
		) {
			throw new StrategyValidationError(
				'Strengths/weaknesses are internal; opportunities/threats are external.'
			);
		}
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				input.frameworkPublicId
			);
			const ownerMemberId = await this.validateOwnerMember(
				trx,
				actor.organisationId,
				input.ownerMemberId
			);
			const factor = await new StrategyRepository(trx).insertEnvironmentFactor({
				organisation_id: actor.organisationId,
				strategy_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				context_scope: input.contextScope,
				dimension: input.dimension,
				direction: input.direction,
				title: requiredText(input.title, 'Factor title', 255),
				analysis_text: requiredText(input.analysisText, 'Analysis', 20_000),
				evidence_reference: optionalText(input.evidenceReference, 20_000),
				observed_on: optionalDateOnly(input.observedOn, 'Observed date'),
				likelihood_score: score(input.likelihoodScore, 'Likelihood score'),
				impact_score: score(input.impactScore, 'Impact score'),
				lifecycle_status: 'active',
				owner_member_id: ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.environment_factor.create',
				'strategy_environment_factor',
				factor.public_id,
				{
					frameworkPublicId: framework.public_id,
					contextScope: factor.context_scope,
					dimension: factor.dimension,
					direction: factor.direction
				},
				{ function: 'F01', subfunction: 'F01.02' }
			);
			return factor;
		});
	}

	async addOption(
		actor: TenantActorContext,
		input: StrategyOptionInput
	): Promise<StrategyOptionRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				input.frameworkPublicId
			);
			const option = await new StrategyRepository(trx).insertOption({
				organisation_id: actor.organisationId,
				strategy_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				title: requiredText(input.title, 'Option title', 255),
				description: requiredText(input.description, 'Option description', 20_000),
				evaluation_summary: optionalText(input.evaluationSummary, 20_000),
				decision_status: 'proposed',
				decision_rationale: null,
				priority_rank: positiveInteger(input.priorityRank, 'Priority rank'),
				created_by_member_id: actor.memberId,
				decided_by_member_id: null,
				decided_at: null
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.option.create',
				'strategy_option',
				option.public_id,
				{ frameworkPublicId: framework.public_id, decisionStatus: 'proposed' },
				{ function: 'F01', subfunction: 'F01.03' }
			);
			return option;
		});
	}

	async decideOption(
		actor: TenantActorContext,
		frameworkPublicId: string,
		optionPublicId: string,
		decisionStatus: 'selected' | 'rejected',
		decisionRationale: string
	): Promise<StrategyOptionRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				frameworkPublicId
			);
			const option = await new StrategyRepository(trx).decideOption(
				actor.organisationId,
				framework.id,
				optionPublicId.trim(),
				{
					decision_status: decisionStatus,
					decision_rationale: requiredText(decisionRationale, 'Decision rationale', 20_000),
					decided_by_member_id: actor.memberId,
					decided_at: this.now()
				}
			);
			if (!option) throw new RecordNotFoundError('Strategy option not found.');
			await this.appendEvidence(
				trx,
				actor,
				'strategy.option.decide',
				'strategy_option',
				option.public_id,
				{ frameworkPublicId: framework.public_id, decisionStatus },
				{ function: 'F01', subfunction: 'F01.03' }
			);
			return option;
		});
	}

	async addObjective(
		actor: TenantActorContext,
		input: StrategyObjectiveInput
	): Promise<StrategyObjectiveRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				input.frameworkPublicId
			);
			const ownerMemberId = await this.validateOwnerMember(
				trx,
				actor.organisationId,
				input.ownerMemberId
			);
			const targetDate = optionalDateOnly(input.targetDate, 'Target date');
			if (
				targetDate &&
				(targetDate < framework.horizon_start || targetDate > framework.horizon_end)
			) {
				throw new StrategyValidationError('Objective target date must sit within the strategy horizon.');
			}
			const priorityRank = positiveInteger(input.priorityRank, 'Priority rank');
			if (!priorityRank) throw new StrategyValidationError('Priority rank is required.');
			const objective = await new StrategyRepository(trx).insertObjective({
				organisation_id: actor.organisationId,
				strategy_framework_id: framework.id,
				public_id: this.publicIdFactory(),
				objective_code: code(input.objectiveCode, 'Objective code', OBJECTIVE_CODE),
				title: requiredText(input.title, 'Objective title', 255),
				description: requiredText(input.description, 'Objective description', 20_000),
				priority_rank: priorityRank,
				owner_member_id: ownerMemberId,
				target_date: targetDate,
				lifecycle_status: 'draft',
				created_by_member_id: actor.memberId
			});
			await this.appendEvidence(
				trx,
				actor,
				'strategy.objective.create',
				'strategy_objective',
				objective.public_id,
				{
					frameworkPublicId: framework.public_id,
					objectiveCode: objective.objective_code,
					priorityRank: objective.priority_rank
				},
				{ function: 'F01', subfunction: 'F01.03' }
			);
			return objective;
		});
	}

	async approveFramework(
		actor: TenantActorContext,
		frameworkPublicId: string
	): Promise<StrategyFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const framework = await this.requireDraftFramework(
				trx,
				actor.organisationId,
				frameworkPublicId
			);
			const repository = new StrategyRepository(trx);
			const [factors, options, objectives] = await Promise.all([
				repository.listEnvironmentFactors(framework.id),
				repository.listOptions(framework.id),
				repository.listObjectives(framework.id)
			]);
			if (!factors.length) {
				throw new StrategyValidationError(
					'At least one environmental-analysis factor is required before approval.'
				);
			}
			if (!objectives.length) {
				throw new StrategyValidationError('At least one strategic objective is required before approval.');
			}
			if (options.some((option) => option.decision_status === 'proposed')) {
				throw new StrategyValidationError('Every strategic option must be selected or rejected before approval.');
			}
			if (!options.some((option) => option.decision_status === 'selected')) {
				throw new StrategyValidationError('At least one strategic option must be selected before approval.');
			}

			const previouslyApproved = await repository.findApprovedVersion(
				actor.organisationId,
				framework.framework_code
			);
			if (previouslyApproved && previouslyApproved.id !== framework.id) {
				await repository.updateFramework(actor.organisationId, previouslyApproved.id, {
					lifecycle_status: 'superseded'
				});
			}
			const approvedAt = this.now();
			const approved = await repository.updateFramework(actor.organisationId, framework.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: approvedAt
			});
			await repository.activateDraftObjectives(framework.id);
			await this.appendEvidence(
				trx,
				actor,
				'strategy.framework.approve',
				'strategy_framework',
				approved.public_id,
				{
					frameworkCode: approved.framework_code,
					versionNumber: approved.version_number,
					factorCount: factors.length,
					optionCount: options.length,
					objectiveCount: objectives.length,
					supersededFrameworkPublicId: previouslyApproved?.public_id ?? null
				},
				{ function: 'F01', subfunctions: ['F01.01', 'F01.02', 'F01.03'] }
			);
			return approved;
		});
	}

	async reviseFramework(
		actor: TenantActorContext,
		frameworkPublicId: string
	): Promise<StrategyFrameworkRecord> {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new StrategyRepository(trx);
			const source = await repository.findFrameworkByPublicId(
				actor.organisationId,
				frameworkPublicId.trim()
			);
			if (!source) throw new RecordNotFoundError('Strategy framework not found.');
			if (source.lifecycle_status !== 'approved') {
				throw new StrategyValidationError('Only an approved strategy version can be revised.');
			}
			const latest = await repository.findLatestVersion(
				actor.organisationId,
				source.framework_code
			);
			if (!latest || latest.id !== source.id) {
				throw new StrategyValidationError(
					'A newer strategy version already exists; revise the latest version instead.'
				);
			}
			const revision = await repository.insertFramework({
				organisation_id: actor.organisationId,
				public_id: this.publicIdFactory(),
				framework_code: source.framework_code,
				version_number: source.version_number + 1,
				title: source.title,
				horizon_start: source.horizon_start,
				horizon_end: source.horizon_end,
				purpose_text: source.purpose_text,
				vision_text: source.vision_text,
				mission_text: source.mission_text,
				lifecycle_status: 'draft',
				supersedes_strategy_framework_id: source.id,
				owner_member_id: source.owner_member_id,
				created_by_member_id: actor.memberId,
				approved_by_member_id: null,
				approved_at: null
			});
			await repository.copyEnvironmentFactors(
				actor.organisationId,
				source.id,
				revision.id,
				actor.memberId,
				this.publicIdFactory
			);
			await repository.copyOptions(
				actor.organisationId,
				source.id,
				revision.id,
				actor.memberId,
				this.publicIdFactory
			);
			await repository.copyObjectives(
				actor.organisationId,
				source.id,
				revision.id,
				actor.memberId,
				this.publicIdFactory
			);
			await this.appendEvidence(
				trx,
				actor,
				'strategy.framework.revise',
				'strategy_framework',
				revision.public_id,
				{
					frameworkCode: revision.framework_code,
					versionNumber: revision.version_number,
					supersedesFrameworkPublicId: source.public_id
				},
				{ function: 'F01', subfunctions: ['F01.01', 'F01.02', 'F01.03'] }
			);
			return revision;
		});
	}
}
