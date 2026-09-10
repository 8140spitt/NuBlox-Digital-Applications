import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CorporateDevelopmentRepository } from './corporate-development-repository';
import {
	CorporateDevelopmentLifecycleRepository,
	type DiligenceFindingRecord,
	type DiligenceRequestRecord,
	type DiligenceWorkstreamRecord,
	type DivestiturePlanRecord,
	type IntegrationPlanRecord,
	type IntegrationWorkstreamRecord,
	type PartnershipCommitmentRecord,
	type PartnershipRecord,
	type PartnershipReviewRecord,
	type SeparationObligationRecord,
	type TransactionConditionRecord,
	type TransactionMilestoneRecord,
	type TransactionRecord,
	type TransactionTermRecord
} from './corporate-development-lifecycle-repository';

export class CorporateDevelopmentLifecycleValidationError extends Error {
	readonly code = 'CORPORATE_DEVELOPMENT_LIFECYCLE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CorporateDevelopmentLifecycleValidationError';
	}
}

export type CorporateDevelopmentLifecycleWorkspace = {
	diligenceWorkstreams: DiligenceWorkstreamRecord[];
	diligenceRequests: DiligenceRequestRecord[];
	diligenceFindings: DiligenceFindingRecord[];
	transactions: TransactionRecord[];
	transactionTerms: TransactionTermRecord[];
	transactionMilestones: TransactionMilestoneRecord[];
	transactionConditions: TransactionConditionRecord[];
	integrationPlans: IntegrationPlanRecord[];
	integrationWorkstreams: IntegrationWorkstreamRecord[];
	divestiturePlans: DivestiturePlanRecord[];
	separationObligations: SeparationObligationRecord[];
	partnerships: PartnershipRecord[];
	partnershipCommitments: PartnershipCommitmentRecord[];
	partnershipReviews: PartnershipReviewRecord[];
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,63}$/;
function required(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text || text.length > max)
		throw new CorporateDevelopmentLifecycleValidationError(
			`${label} is required and must not exceed ${max} characters.`
		);
	return text;
}
function coded(value: string, label: string): string {
	const code = value.trim().toUpperCase();
	if (!CODE.test(code))
		throw new CorporateDevelopmentLifecycleValidationError(`${label} has an invalid format.`);
	return code;
}
function date(value: string | Date, label: string): Date {
	const parsed = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()))
		throw new CorporateDevelopmentLifecycleValidationError(`${label} is invalid.`);
	return parsed;
}
function optionalDate(value?: string | Date | null): Date | null {
	if (!value) return null;
	return date(value, 'Date');
}
function optional(value?: string | null, max = 500): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new CorporateDevelopmentLifecycleValidationError(
			`Text must not exceed ${max} characters.`
		);
	return text;
}

export class CorporateDevelopmentLifecycleService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async require(
		actor: TenantActorContext,
		permission: 'strategy.view' | 'strategy.manage' | 'strategy.approve'
	) {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(this.db).decide(actor, permission);
		if (!decision.allowed)
			throw new TenantAccessError('Corporate development lifecycle action is not permitted.');
	}
	private async activeMember(db: DatabaseExecutor, actor: TenantActorContext, memberId: string) {
		const member = await db
			.selectFrom('organisation_members')
			.select('id')
			.where('organisation_id', '=', actor.organisationId)
			.where('id', '=', memberId.trim())
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!member)
			throw new CorporateDevelopmentLifecycleValidationError(
				'Owner must be an active organisation member.'
			);
		return member.id;
	}
	private async opportunity(db: DatabaseExecutor, actor: TenantActorContext, publicId: string) {
		const row = await new CorporateDevelopmentRepository(db).findOpportunityByPublicId(
			actor.organisationId,
			publicId.trim()
		);
		if (!row) throw new RecordNotFoundError('Corporate development opportunity not found.');
		return row;
	}
	private async evidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		publicId: string,
		subfunctions: string[],
		changeSummary: Record<string, unknown>
	) {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			actionKey,
			subjectType,
			subjectPublicId: publicId,
			correlationId: actor.correlationId,
			changeSummary,
			eventMetadata: { function: 'F04', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: publicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F04', subfunctions }
		});
	}

	async getWorkspace(
		actor: TenantActorContext,
		opportunityPublicId?: string | null
	): Promise<CorporateDevelopmentLifecycleWorkspace> {
		await this.require(actor, 'strategy.view');
		const repo = new CorporateDevelopmentLifecycleRepository(this.db);
		const opportunity = opportunityPublicId
			? await this.opportunity(this.db, actor, opportunityPublicId)
			: null;
		const diligenceWorkstreams = opportunity
			? await repo.listDiligenceWorkstreams(actor.organisationId, opportunity.id)
			: [];
		const transactions = opportunity
			? await repo.listTransactions(actor.organisationId, opportunity.id)
			: [];
		const integrationPlans = opportunity
			? await repo.listIntegrationPlans(actor.organisationId, opportunity.id)
			: [];
		const divestiturePlans = opportunity
			? await repo.listDivestiturePlans(actor.organisationId, opportunity.id)
			: [];
		const partnerships = await repo.listPartnerships(actor.organisationId);
		const [
			diligenceRequests,
			diligenceFindings,
			transactionTerms,
			transactionMilestones,
			transactionConditions,
			integrationWorkstreams,
			separationObligations,
			partnershipCommitments,
			partnershipReviews
		] = await Promise.all([
			repo.listDiligenceRequests(
				actor.organisationId,
				diligenceWorkstreams.map((x) => x.id)
			),
			repo.listDiligenceFindings(
				actor.organisationId,
				diligenceWorkstreams.map((x) => x.id)
			),
			repo.listTransactionTerms(
				actor.organisationId,
				transactions.map((x) => x.id)
			),
			repo.listTransactionMilestones(
				actor.organisationId,
				transactions.map((x) => x.id)
			),
			repo.listTransactionConditions(
				actor.organisationId,
				transactions.map((x) => x.id)
			),
			repo.listIntegrationWorkstreams(
				actor.organisationId,
				integrationPlans.map((x) => x.id)
			),
			repo.listSeparationObligations(
				actor.organisationId,
				divestiturePlans.map((x) => x.id)
			),
			repo.listPartnershipCommitments(
				actor.organisationId,
				partnerships.map((x) => x.id)
			),
			repo.listPartnershipReviews(
				actor.organisationId,
				partnerships.map((x) => x.id)
			)
		]);
		return {
			diligenceWorkstreams,
			diligenceRequests,
			diligenceFindings,
			transactions,
			transactionTerms,
			transactionMilestones,
			transactionConditions,
			integrationPlans,
			integrationWorkstreams,
			divestiturePlans,
			separationObligations,
			partnerships,
			partnershipCommitments,
			partnershipReviews
		};
	}

	async createDiligenceWorkstream(
		actor: TenantActorContext,
		input: {
			opportunityPublicId: string;
			workstreamCode: string;
			title: string;
			diligenceDomain: string;
			scopeText: string;
			leadMemberId: string;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const opportunity = await this.opportunity(trx, actor, input.opportunityPublicId);
			const lead = await this.activeMember(trx, actor, input.leadMemberId);
			const created = await new CorporateDevelopmentLifecycleRepository(
				trx
			).insertDiligenceWorkstream({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				workstream_code: coded(input.workstreamCode, 'Workstream code'),
				title: required(input.title, 'Title', 255),
				diligence_domain: required(input.diligenceDomain, 'Diligence domain', 30),
				scope_text: required(input.scopeText, 'Scope', 10000),
				lead_member_id: lead,
				lifecycle_status: 'open',
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.diligence_workstream.created',
				'corporate_development_diligence_workstream',
				created.public_id,
				['F04.03'],
				{ opportunityPublicId: opportunity.public_id, workstreamCode: created.workstream_code }
			);
			return created;
		});
	}
	async createDiligenceRequest(
		actor: TenantActorContext,
		input: {
			workstreamPublicId: string;
			requestCode: string;
			title: string;
			requestText: string;
			ownerMemberId: string;
			materiality: string;
			requestedOn: string;
			dueDate?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const ws = await trx
				.selectFrom('corporate_development_diligence_workstreams')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', input.workstreamPublicId.trim())
				.executeTakeFirst();
			if (!ws) throw new RecordNotFoundError('Diligence workstream not found.');
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertDiligenceRequest(
				{
					public_id: this.publicIdFactory(),
					organisation_id: actor.organisationId,
					diligence_workstream_id: ws.id,
					request_code: coded(input.requestCode, 'Request code'),
					title: required(input.title, 'Title', 255),
					request_text: required(input.requestText, 'Request', 10000),
					owner_member_id: owner,
					materiality: input.materiality,
					lifecycle_status: 'requested',
					requested_on: date(input.requestedOn, 'Requested on'),
					due_date: optionalDate(input.dueDate),
					created_by_member_id: actor.memberId
				}
			);
			await this.evidence(
				trx,
				actor,
				'corporate_development.diligence_request.created',
				'corporate_development_diligence_request',
				created.public_id,
				['F04.03'],
				{ requestCode: created.request_code }
			);
			return created;
		});
	}
	async createDiligenceFinding(
		actor: TenantActorContext,
		input: {
			workstreamPublicId: string;
			findingCode: string;
			title: string;
			findingCategory: string;
			severity: string;
			findingText: string;
			impactText: string;
			recommendationText: string;
			ownerMemberId: string;
			transactionImplication?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const ws = await trx
				.selectFrom('corporate_development_diligence_workstreams')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', input.workstreamPublicId.trim())
				.executeTakeFirst();
			if (!ws) throw new RecordNotFoundError('Diligence workstream not found.');
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertDiligenceFinding(
				{
					public_id: this.publicIdFactory(),
					organisation_id: actor.organisationId,
					diligence_workstream_id: ws.id,
					diligence_request_id: null,
					finding_code: coded(input.findingCode, 'Finding code'),
					title: required(input.title, 'Title', 255),
					finding_category: input.findingCategory,
					severity: input.severity,
					finding_text: required(input.findingText, 'Finding', 10000),
					impact_text: required(input.impactText, 'Impact', 10000),
					recommendation_text: required(input.recommendationText, 'Recommendation', 10000),
					owner_member_id: owner,
					lifecycle_status: 'open',
					transaction_implication: optional(input.transactionImplication, 10000),
					created_by_member_id: actor.memberId
				}
			);
			await this.evidence(
				trx,
				actor,
				'corporate_development.diligence_finding.created',
				'corporate_development_diligence_finding',
				created.public_id,
				['F04.03'],
				{ findingCode: created.finding_code, severity: created.severity }
			);
			return created;
		});
	}

	async createTransaction(
		actor: TenantActorContext,
		input: {
			opportunityPublicId: string;
			transactionCode: string;
			title: string;
			transactionType: string;
			transactionStructure: string;
			currencyCode: string;
			considerationValue?: string | null;
			governanceDecisionPublicId?: string | null;
			delegationAuthorityPublicId?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const opportunity = await this.opportunity(trx, actor, input.opportunityPublicId);
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertTransaction({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				transaction_code: coded(input.transactionCode, 'Transaction code'),
				title: required(input.title, 'Title', 255),
				transaction_type: input.transactionType,
				transaction_structure: required(input.transactionStructure, 'Structure', 50),
				currency_code: input.currencyCode.trim().toUpperCase(),
				consideration_value: optional(input.considerationValue),
				lifecycle_status: 'draft',
				governance_decision_public_id: optional(input.governanceDecisionPublicId, 100),
				delegation_authority_public_id: optional(input.delegationAuthorityPublicId, 100),
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.transaction.created',
				'corporate_development_transaction',
				created.public_id,
				['F04.04'],
				{ opportunityPublicId: opportunity.public_id, transactionCode: created.transaction_code }
			);
			return created;
		});
	}
	async addTransactionCondition(
		actor: TenantActorContext,
		input: {
			transactionPublicId: string;
			conditionCode: string;
			conditionType: string;
			title: string;
			conditionText: string;
			ownerMemberId: string;
			dueDate?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const tx = await new CorporateDevelopmentLifecycleRepository(trx).findTransaction(
				actor.organisationId,
				input.transactionPublicId.trim()
			);
			if (!tx) throw new RecordNotFoundError('Transaction not found.');
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			const created = await new CorporateDevelopmentLifecycleRepository(
				trx
			).insertTransactionCondition({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				transaction_id: tx.id,
				condition_code: coded(input.conditionCode, 'Condition code'),
				condition_type: input.conditionType,
				title: required(input.title, 'Title', 255),
				condition_text: required(input.conditionText, 'Condition', 10000),
				owner_member_id: owner,
				due_date: optionalDate(input.dueDate),
				lifecycle_status: 'open',
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.transaction_condition.created',
				'corporate_development_transaction_condition',
				created.public_id,
				['F04.04'],
				{ transactionPublicId: tx.public_id }
			);
			return created;
		});
	}
	async closeTransaction(actor: TenantActorContext, transactionPublicId: string) {
		await this.require(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repo = new CorporateDevelopmentLifecycleRepository(trx);
			const tx = await repo.findTransaction(actor.organisationId, transactionPublicId.trim());
			if (!tx) throw new RecordNotFoundError('Transaction not found.');
			if (!tx.governance_decision_public_id)
				throw new CorporateDevelopmentLifecycleValidationError(
					'A governed F02 decision is required before transaction close.'
				);
			const conditions = await repo.listTransactionConditions(actor.organisationId, [tx.id]);
			if (
				conditions.some((c) => !['satisfied', 'waived', 'cancelled'].includes(c.lifecycle_status))
			)
				throw new CorporateDevelopmentLifecycleValidationError(
					'All transaction conditions must be satisfied, waived or cancelled before close.'
				);
			const closed = await repo.updateTransaction(actor.organisationId, tx.id, {
				lifecycle_status: 'closed',
				actual_close_date: new Date()
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.transaction.closed',
				'corporate_development_transaction',
				closed.public_id,
				['F04.04'],
				{ governanceDecisionPublicId: closed.governance_decision_public_id }
			);
			return closed;
		});
	}

	async createIntegrationPlan(
		actor: TenantActorContext,
		input: {
			opportunityPublicId: string;
			transactionPublicId?: string | null;
			integrationCode: string;
			title: string;
			integrationThesis: string;
			dayOneOutcomes: string;
			dayOneHundredOutcomes: string;
			targetOperatingModelOutcomes: string;
			ownerMemberId: string;
			performanceBenefitPublicId?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const opportunity = await this.opportunity(trx, actor, input.opportunityPublicId);
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			let transactionId: string | null = null;
			if (input.transactionPublicId) {
				const tx = await new CorporateDevelopmentLifecycleRepository(trx).findTransaction(
					actor.organisationId,
					input.transactionPublicId
				);
				if (!tx || tx.opportunity_id !== opportunity.id)
					throw new CorporateDevelopmentLifecycleValidationError(
						'Transaction must belong to the selected opportunity.'
					);
				transactionId = tx.id;
			}
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertIntegrationPlan({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				transaction_id: transactionId,
				integration_code: coded(input.integrationCode, 'Integration code'),
				title: required(input.title, 'Title', 255),
				integration_thesis: required(input.integrationThesis, 'Integration thesis', 10000),
				day_one_outcomes: required(input.dayOneOutcomes, 'Day 1 outcomes', 10000),
				day_one_hundred_outcomes: required(input.dayOneHundredOutcomes, 'Day 100 outcomes', 10000),
				target_operating_model_outcomes: required(
					input.targetOperatingModelOutcomes,
					'Target operating model outcomes',
					10000
				),
				owner_member_id: owner,
				lifecycle_status: 'planning',
				performance_benefit_public_id: optional(input.performanceBenefitPublicId, 100),
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.integration_plan.created',
				'corporate_development_integration_plan',
				created.public_id,
				['F04.05'],
				{ opportunityPublicId: opportunity.public_id }
			);
			return created;
		});
	}
	async createDivestiturePlan(
		actor: TenantActorContext,
		input: {
			opportunityPublicId: string;
			transactionPublicId?: string | null;
			divestitureCode: string;
			title: string;
			perimeterText: string;
			separationStrategy: string;
			ownerMemberId: string;
			buyerName?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const opportunity = await this.opportunity(trx, actor, input.opportunityPublicId);
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			let transactionId: string | null = null;
			if (input.transactionPublicId) {
				const tx = await new CorporateDevelopmentLifecycleRepository(trx).findTransaction(
					actor.organisationId,
					input.transactionPublicId
				);
				if (!tx || tx.opportunity_id !== opportunity.id)
					throw new CorporateDevelopmentLifecycleValidationError(
						'Transaction must belong to the selected opportunity.'
					);
				transactionId = tx.id;
			}
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertDivestiturePlan({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity.id,
				transaction_id: transactionId,
				divestiture_code: coded(input.divestitureCode, 'Divestiture code'),
				title: required(input.title, 'Title', 255),
				perimeter_text: required(input.perimeterText, 'Perimeter', 10000),
				separation_strategy: required(input.separationStrategy, 'Separation strategy', 10000),
				buyer_name: optional(input.buyerName, 255),
				owner_member_id: owner,
				lifecycle_status: 'planning',
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.divestiture_plan.created',
				'corporate_development_divestiture_plan',
				created.public_id,
				['F04.06'],
				{ opportunityPublicId: opportunity.public_id }
			);
			return created;
		});
	}
	async createPartnership(
		actor: TenantActorContext,
		input: {
			opportunityPublicId?: string | null;
			partnershipCode: string;
			title: string;
			partnerName: string;
			partnershipType: string;
			objectivesText: string;
			commercialStructure: string;
			governanceText: string;
			ownerMemberId: string;
			effectiveFrom: string;
			reviewCadence: string;
			governanceDecisionPublicId?: string | null;
		}
	) {
		await this.require(actor, 'strategy.manage');
		return this.db.transaction().execute(async (trx) => {
			const owner = await this.activeMember(trx, actor, input.ownerMemberId);
			const opportunity = input.opportunityPublicId
				? await this.opportunity(trx, actor, input.opportunityPublicId)
				: null;
			const created = await new CorporateDevelopmentLifecycleRepository(trx).insertPartnership({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				opportunity_id: opportunity?.id ?? null,
				partnership_code: coded(input.partnershipCode, 'Partnership code'),
				title: required(input.title, 'Title', 255),
				partner_name: required(input.partnerName, 'Partner', 255),
				partnership_type: input.partnershipType,
				objectives_text: required(input.objectivesText, 'Objectives', 10000),
				commercial_structure: required(input.commercialStructure, 'Commercial structure', 10000),
				governance_text: required(input.governanceText, 'Governance', 10000),
				owner_member_id: owner,
				effective_from: date(input.effectiveFrom, 'Effective from'),
				review_cadence: input.reviewCadence,
				lifecycle_status: 'draft',
				governance_decision_public_id: optional(input.governanceDecisionPublicId, 100),
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.partnership.created',
				'corporate_development_partnership',
				created.public_id,
				['F04.07'],
				{ partnershipCode: created.partnership_code }
			);
			return created;
		});
	}
	async activatePartnership(actor: TenantActorContext, publicId: string) {
		await this.require(actor, 'strategy.approve');
		return this.db.transaction().execute(async (trx) => {
			const repo = new CorporateDevelopmentLifecycleRepository(trx);
			const partnership = await repo.findPartnership(actor.organisationId, publicId.trim());
			if (!partnership) throw new RecordNotFoundError('Partnership not found.');
			if (!partnership.governance_decision_public_id)
				throw new CorporateDevelopmentLifecycleValidationError(
					'A governed F02 decision is required before partnership activation.'
				);
			const active = await repo.updatePartnership(actor.organisationId, partnership.id, {
				lifecycle_status: 'active'
			});
			await this.evidence(
				trx,
				actor,
				'corporate_development.partnership.activated',
				'corporate_development_partnership',
				active.public_id,
				['F04.07'],
				{ governanceDecisionPublicId: active.governance_decision_public_id }
			);
			return active;
		});
	}
}
