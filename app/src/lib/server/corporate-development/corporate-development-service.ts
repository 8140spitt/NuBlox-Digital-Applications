import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	CorporateDevelopmentRepository,
	type CorporateDevelopmentOpportunityRecord,
	type CorporateDevelopmentStageHistoryRecord,
	type CorporateDevelopmentValuationAssumptionRecord,
	type CorporateDevelopmentValuationRecord,
	type CorporateDevelopmentValuationScenarioRecord
} from './corporate-development-repository';

export class CorporateDevelopmentValidationError extends Error {
	readonly code = 'CORPORATE_DEVELOPMENT_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CorporateDevelopmentValidationError';
	}
}

export type CorporateDevelopmentWorkspace = {
	opportunities: CorporateDevelopmentOpportunityRecord[];
	selectedOpportunity: CorporateDevelopmentOpportunityRecord | null;
	stageHistory: CorporateDevelopmentStageHistoryRecord[];
	valuations: CorporateDevelopmentValuationRecord[];
	scenarios: CorporateDevelopmentValuationScenarioRecord[];
	assumptions: CorporateDevelopmentValuationAssumptionRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type CorporateDevelopmentOpportunityInput = {
	opportunityCode: string;
	title: string;
	dealType:
		| 'acquisition'
		| 'divestiture'
		| 'joint_venture'
		| 'strategic_partnership'
		| 'minority_investment'
		| 'other';
	targetName: string;
	strategicThesis: string;
	strategicRationale: string;
	ownerMemberId: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	identifiedOn: string | Date;
	targetDecisionDate?: string | Date | null;
	targetSourceDomain?: string | null;
	targetSourceRecordType?: string | null;
	targetSourcePublicId?: string | null;
	strategyObjectivePublicId?: string | null;
	strategyKpiPublicId?: string | null;
	performanceEvidencePublicId?: string | null;
	sourceReference?: string | null;
};

export type CorporateDevelopmentValuationInput = {
	opportunityPublicId: string;
	valuationCode: string;
	title: string;
	valuationDate: string | Date;
	currencyCode: string;
	primaryMethod:
		| 'dcf'
		| 'precedent_transactions'
		| 'trading_comparables'
		| 'asset_based'
		| 'sum_of_parts'
		| 'venture_method'
		| 'other';
	enterpriseValueLow?: string | number | null;
	enterpriseValueBase?: string | number | null;
	enterpriseValueHigh?: string | number | null;
	equityValueLow?: string | number | null;
	equityValueBase?: string | number | null;
	equityValueHigh?: string | number | null;
	recommendation: string;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,49}$/;
const TOKEN = /^[a-z0-9][a-z0-9_.:-]{1,49}$/;

function requiredText(value: string, label: string, max: number) {
	const normalized = value.trim();
	if (!normalized || normalized.length > max)
		throw new CorporateDevelopmentValidationError(
			`${label} must be between 1 and ${max} characters.`
		);
	return normalized;
}
function optionalText(value: string | null | undefined, max: number) {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max)
		throw new CorporateDevelopmentValidationError(`Text must not exceed ${max} characters.`);
	return normalized;
}
function code(value: string, label: string) {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized))
		throw new CorporateDevelopmentValidationError(`${label} has an invalid format.`);
	return normalized;
}
function token(value: string | null | undefined, label: string) {
	const normalized = value?.trim().toLowerCase() ?? '';
	if (!normalized) return null;
	if (!TOKEN.test(normalized))
		throw new CorporateDevelopmentValidationError(`${label} has an invalid format.`);
	return normalized;
}
function dateOnly(value: string | Date, label: string) {
	const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()))
		throw new CorporateDevelopmentValidationError(`${label} is invalid.`);
	return date;
}
function optionalDate(value: string | Date | null | undefined, label: string) {
	if (!value) return null;
	return dateOnly(value, label);
}
function decimal(value: string | number | null | undefined, label: string) {
	if (value === null || value === undefined || value === '') return null;
	const normalized = String(value).trim();
	if (!/^-?\d{1,16}(?:\.\d{1,8})?$/.test(normalized))
		throw new CorporateDevelopmentValidationError(`${label} has an invalid decimal format.`);
	return normalized;
}

export class CorporateDevelopmentService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext) {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: 'strategy.view' | 'strategy.manage' | 'strategy.approve'
	) {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed)
			throw new TenantAccessError('Corporate development action is not permitted.');
	}

	private async permissionFlags(actor: TenantActorContext) {
		await this.requirePermission(actor, 'strategy.view');
		const permissions = new PermissionService(this.db);
		const [manage, approve] = await Promise.all([
			permissions.decide(actor, 'strategy.manage'),
			permissions.decide(actor, 'strategy.approve')
		]);
		return { canManage: manage.allowed, canApprove: approve.allowed };
	}

	private async activeMember(db: DatabaseExecutor, organisationId: string, memberId: string) {
		const row = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('id', '=', memberId.trim())
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row)
			throw new CorporateDevelopmentValidationError('Owner must be an active organisation member.');
		return row.id;
	}

	private async evidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>,
		subfunctions: string[]
	) {
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
			eventMetadata: { function: 'F04', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F04', subfunctions }
		});
	}

	async getWorkspace(
		actor: TenantActorContext,
		selectedOpportunityPublicId?: string | null
	): Promise<CorporateDevelopmentWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new CorporateDevelopmentRepository(this.db);
		const opportunities = await repository.listOpportunities(actor.organisationId);
		let selectedOpportunity = opportunities[0] ?? null;
		if (selectedOpportunityPublicId?.trim()) {
			selectedOpportunity =
				(await repository.findOpportunityByPublicId(
					actor.organisationId,
					selectedOpportunityPublicId.trim()
				)) ?? null;
			if (!selectedOpportunity)
				throw new RecordNotFoundError('Corporate development opportunity not found.');
		}
		if (!selectedOpportunity)
			return {
				opportunities,
				selectedOpportunity: null,
				stageHistory: [],
				valuations: [],
				scenarios: [],
				assumptions: [],
				...flags
			};
		const [stageHistory, valuations] = await Promise.all([
			repository.listStageHistory(actor.organisationId, selectedOpportunity.id),
			repository.listValuations(actor.organisationId, selectedOpportunity.id)
		]);
		const scenarios = await repository.listScenarios(
			actor.organisationId,
			valuations.map((row) => row.id)
		);
		const assumptions = await repository.listAssumptions(
			actor.organisationId,
			scenarios.map((row) => row.id)
		);
		return {
			opportunities,
			selectedOpportunity,
			stageHistory,
			valuations,
			scenarios,
			assumptions,
			...flags
		};
	}

	async createOpportunity(actor: TenantActorContext, input: CorporateDevelopmentOpportunityInput) {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new CorporateDevelopmentRepository(trx);
			const ownerMemberId = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertOpportunity({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_code: code(input.opportunityCode, 'Opportunity code'),
				title: requiredText(input.title, 'Title', 255),
				deal_type: input.dealType,
				target_name: requiredText(input.targetName, 'Target/partner', 255),
				target_source_domain: token(input.targetSourceDomain, 'Target source domain'),
				target_source_record_type: optionalText(input.targetSourceRecordType, 80),
				target_source_public_id: optionalText(input.targetSourcePublicId, 100),
				strategic_thesis: requiredText(input.strategicThesis, 'Strategic thesis', 5000),
				strategic_rationale: requiredText(input.strategicRationale, 'Strategic rationale', 5000),
				owner_member_id: ownerMemberId,
				priority: input.priority,
				pipeline_stage: 'identified',
				lifecycle_status: 'active',
				identified_on: dateOnly(input.identifiedOn, 'Identified date'),
				target_decision_date: optionalDate(input.targetDecisionDate, 'Target decision date'),
				strategy_objective_public_id: optionalText(input.strategyObjectivePublicId, 100),
				strategy_kpi_public_id: optionalText(input.strategyKpiPublicId, 100),
				performance_evidence_public_id: optionalText(input.performanceEvidencePublicId, 100),
				source_reference: optionalText(input.sourceReference, 500),
				created_by_member_id: actor.memberId
			});
			await repository.insertStageHistory({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: created.id,
				from_stage: null,
				to_stage: 'identified',
				transition_reason: 'Opportunity created.',
				transitioned_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.opportunity.created',
				'corporate_development_opportunity',
				created.public_id,
				{
					opportunityCode: created.opportunity_code,
					dealType: created.deal_type,
					targetName: created.target_name
				},
				['F04.01']
			);
			return created;
		});
	}

	async transitionOpportunity(
		actor: TenantActorContext,
		opportunityPublicId: string,
		toStage: CorporateDevelopmentOpportunityRecord['pipeline_stage'],
		reason: string
	) {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new CorporateDevelopmentRepository(trx);
			const opportunity = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId.trim()
			);
			if (!opportunity)
				throw new RecordNotFoundError('Corporate development opportunity not found.');
			const updated = await repository.updateOpportunity(actor.organisationId, opportunity.id, {
				pipeline_stage: toStage
			});
			await repository.insertStageHistory({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				from_stage: opportunity.pipeline_stage,
				to_stage: toStage,
				transition_reason: requiredText(reason, 'Transition reason', 5000),
				transitioned_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.opportunity.stage_changed',
				'corporate_development_opportunity',
				opportunity.public_id,
				{ fromStage: opportunity.pipeline_stage, toStage },
				['F04.01']
			);
			return updated;
		});
	}

	async createValuation(actor: TenantActorContext, input: CorporateDevelopmentValuationInput) {
		await this.requirePermission(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new CorporateDevelopmentRepository(trx);
			const opportunity = await repository.findOpportunityByPublicId(
				actor.organisationId,
				input.opportunityPublicId.trim()
			);
			if (!opportunity)
				throw new RecordNotFoundError('Corporate development opportunity not found.');
			const existing = await repository.listValuations(actor.organisationId, opportunity.id);
			const valuationCode = code(input.valuationCode, 'Valuation code');
			const priorVersions = existing.filter((row) => row.valuation_code === valuationCode);
			const predecessor =
				priorVersions.sort((left, right) => right.version_number - left.version_number)[0] ?? null;
			const version = (predecessor?.version_number ?? 0) + 1;
			const created = await repository.insertValuation({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				valuation_code: valuationCode,
				version_number: version,
				title: requiredText(input.title, 'Title', 255),
				valuation_date: dateOnly(input.valuationDate, 'Valuation date'),
				currency_code: requiredText(input.currencyCode, 'Currency', 3).toUpperCase(),
				primary_method: input.primaryMethod,
				lifecycle_status: 'draft',
				enterprise_value_low: decimal(input.enterpriseValueLow, 'Enterprise value low'),
				enterprise_value_base: decimal(input.enterpriseValueBase, 'Enterprise value base'),
				enterprise_value_high: decimal(input.enterpriseValueHigh, 'Enterprise value high'),
				equity_value_low: decimal(input.equityValueLow, 'Equity value low'),
				equity_value_base: decimal(input.equityValueBase, 'Equity value base'),
				equity_value_high: decimal(input.equityValueHigh, 'Equity value high'),
				recommendation: requiredText(input.recommendation, 'Recommendation', 5000),
				supersedes_valuation_id: predecessor?.id ?? null,
				approved_by_member_id: null,
				approved_at: null,
				created_by_member_id: actor.memberId
			});
			if (opportunity.pipeline_stage !== 'valuation') {
				await repository.updateOpportunity(actor.organisationId, opportunity.id, {
					pipeline_stage: 'valuation'
				});
				await repository.insertStageHistory({
					public_id: this.publicIdFactory(),
					organisation_id: actor.organisationId,
					opportunity_id: opportunity.id,
					from_stage: opportunity.pipeline_stage,
					to_stage: 'valuation',
					transition_reason: `Valuation ${valuationCode} v${version} created.`,
					transitioned_by_member_id: actor.memberId
				});
				await this.evidence(
					trx,
					actor,
					'corporate_development.opportunity.stage_changed',
					'corporate_development_opportunity',
					opportunity.public_id,
					{
						fromStage: opportunity.pipeline_stage,
						toStage: 'valuation',
						reason: 'valuation_created'
					},
					['F04.01', 'F04.02']
				);
			}
			await this.evidence(
				trx,
				actor,
				'corporate_development.valuation.created',
				'corporate_development_valuation',
				created.public_id,
				{
					opportunityPublicId: opportunity.public_id,
					valuationCode,
					version,
					primaryMethod: input.primaryMethod
				},
				['F04.02']
			);
			return created;
		});
	}

	async approveValuation(actor: TenantActorContext, valuationPublicId: string) {
		await this.requirePermission(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new CorporateDevelopmentRepository(trx);
			const valuation = await repository.findValuationByPublicId(
				actor.organisationId,
				valuationPublicId.trim()
			);
			if (!valuation) throw new RecordNotFoundError('Corporate development valuation not found.');
			if (valuation.lifecycle_status !== 'draft')
				throw new CorporateDevelopmentValidationError('Only draft valuations can be approved.');
			if (valuation.supersedes_valuation_id) {
				const predecessor = await trx
					.selectFrom('corporate_development_valuations')
					.selectAll()
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', valuation.supersedes_valuation_id)
					.where('opportunity_id', '=', valuation.opportunity_id)
					.executeTakeFirst();
				if (!predecessor)
					throw new CorporateDevelopmentValidationError('Valuation predecessor is invalid.');
				if (predecessor.lifecycle_status === 'approved')
					await repository.updateValuation(actor.organisationId, predecessor.id, {
						lifecycle_status: 'superseded'
					});
			}
			const updated = await repository.updateValuation(actor.organisationId, valuation.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: new Date()
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.valuation.approved',
				'corporate_development_valuation',
				valuation.public_id,
				{ opportunityId: valuation.opportunity_id, version: valuation.version_number },
				['F04.02']
			);
			return updated;
		});
	}
}
