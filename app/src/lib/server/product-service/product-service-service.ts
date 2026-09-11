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
	ProductServiceRepository,
	type ProductServiceBusinessCaseAssumptionRecord,
	type ProductServiceBusinessCaseRecord,
	type ProductServiceBusinessCaseScenarioRecord,
	type ProductServiceIdeaRecord,
	type ProductServiceNeedRecord,
	type ProductServiceOfferingRecord,
	type ProductServicePortfolioRecord
} from './product-service-repository';

export class ProductServiceValidationError extends Error {
	readonly code = 'PRODUCT_SERVICE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProductServiceValidationError';
	}
}

export type ProductServiceWorkspace = {
	portfolios: ProductServicePortfolioRecord[];
	offerings: ProductServiceOfferingRecord[];
	needs: ProductServiceNeedRecord[];
	ideas: ProductServiceIdeaRecord[];
	businessCases: ProductServiceBusinessCaseRecord[];
	assumptions: ProductServiceBusinessCaseAssumptionRecord[];
	scenarios: ProductServiceBusinessCaseScenarioRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type PortfolioInput = {
	portfolioCode: string;
	title: string;
	portfolioType: 'product' | 'service' | 'mixed' | 'platform' | 'innovation';
	strategicThesis: string;
	ownerMemberId: string;
	priority: 'low' | 'medium' | 'high' | 'critical';
	strategyObjectivePublicId?: string | null;
	strategyKpiPublicId?: string | null;
	performanceEvidencePublicId?: string | null;
};

export type OfferingInput = {
	portfolioPublicId: string;
	offeringCode: string;
	title: string;
	offeringType:
		| 'product'
		| 'service'
		| 'platform'
		| 'solution'
		| 'internal_capability'
		| 'other';
	valueProposition: string;
	ownerMemberId: string;
};

export type NeedInput = {
	portfolioPublicId?: string | null;
	needCode: string;
	title: string;
	needType:
		| 'customer'
		| 'market'
		| 'operational'
		| 'regulatory'
		| 'technology'
		| 'sustainability'
		| 'commercial'
		| 'other';
	needStatement: string;
	sourceDomain: string;
	sourceRecordType?: string | null;
	sourcePublicId?: string | null;
	sourceReference?: string | null;
	customerOrMarketSegment?: string | null;
	evidenceStrength: 'low' | 'medium' | 'high' | 'validated';
	urgency: 'low' | 'medium' | 'high' | 'critical';
	ownerMemberId: string;
};

export type IdeaInput = {
	portfolioPublicId?: string | null;
	needPublicId?: string | null;
	ideaCode: string;
	title: string;
	ideaType:
		| 'new_product'
		| 'new_service'
		| 'enhancement'
		| 'process_innovation'
		| 'technology_innovation'
		| 'business_model'
		| 'other';
	problemStatement: string;
	proposedValue: string;
	provenance: string;
	sourceReference?: string | null;
	ownerMemberId: string;
};

export type IdeaScoreInput = {
	strategicFit: number;
	customerValue: number;
	feasibility: number;
	commercialValue: number;
	risk: number;
};

export type BusinessCaseInput = {
	ideaPublicId: string;
	offeringPublicId?: string | null;
	businessCaseCode: string;
	title: string;
	currencyCode: string;
	investmentCost?: string | number | null;
	annualOperatingCost?: string | number | null;
	annualRevenueOrValue?: string | number | null;
	expectedBenefitValue?: string | number | null;
	paybackMonths?: number | null;
	riskSummary: string;
	recommendation: string;
	strategyObjectivePublicId?: string | null;
	performanceBenefitPublicId?: string | null;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,49}$/;
const TOKEN = /^[a-z0-9][a-z0-9_.:-]{1,49}$/;
const CURRENCY = /^[A-Z]{3}$/;

type ProductServicePermission =
	| 'product_service.view'
	| 'product_service.manage'
	| 'product_service.approve';

function requiredText(value: string, label: string, max: number) {
	const normalized = value.trim();
	if (!normalized || normalized.length > max) {
		throw new ProductServiceValidationError(`${label} must be between 1 and ${max} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, max: number) {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new ProductServiceValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function code(value: string, label: string) {
	const normalized = value.trim().toUpperCase();
	if (!CODE.test(normalized)) {
		throw new ProductServiceValidationError(`${label} has an invalid format.`);
	}
	return normalized;
}

function token(value: string, label: string) {
	const normalized = value.trim().toLowerCase();
	if (!TOKEN.test(normalized)) {
		throw new ProductServiceValidationError(`${label} has an invalid format.`);
	}
	return normalized;
}

function money(value: string | number | null | undefined, label: string) {
	if (value === null || value === undefined || value === '') return null;
	const normalized = String(value).trim();
	if (!/^-?\d{1,16}(?:\.\d{1,4})?$/.test(normalized)) {
		throw new ProductServiceValidationError(`${label} has an invalid monetary value.`);
	}
	return normalized;
}

function score(value: number, label: string) {
	if (!Number.isFinite(value) || value < 0 || value > 100) {
		throw new ProductServiceValidationError(`${label} must be between 0 and 100.`);
	}
	return value.toFixed(4);
}

function currencyCode(value: string) {
	const normalized = value.trim().toUpperCase();
	if (!CURRENCY.test(normalized)) {
		throw new ProductServiceValidationError('Currency code must be a three-letter ISO-style code.');
	}
	return normalized;
}

export class ProductServiceService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext) {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async requirePermission(actor: TenantActorContext, permissionKey: ProductServicePermission) {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey);
		if (!decision.allowed) {
			throw new TenantAccessError('Product/service lifecycle action is not permitted.');
		}
	}

	private async permissionFlags(actor: TenantActorContext) {
		await this.requirePermission(actor, 'product_service.view');
		const permissions = new PermissionService(this.db);
		const [manage, approve] = await Promise.all([
			permissions.decide(actor, 'product_service.manage'),
			permissions.decide(actor, 'product_service.approve')
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
		if (!row) {
			throw new ProductServiceValidationError('Owner must be an active organisation member.');
		}
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
			eventMetadata: { function: 'F05', subfunctions }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: subjectType,
			aggregatePublicId: subjectPublicId,
			correlationId: actor.correlationId,
			payload: { ...changeSummary, function: 'F05', subfunctions }
		});
	}

	async getWorkspace(actor: TenantActorContext): Promise<ProductServiceWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new ProductServiceRepository(this.db);
		const [portfolios, offerings, needs, ideas, businessCases] = await Promise.all([
			repository.listPortfolios(actor.organisationId),
			repository.listOfferings(actor.organisationId),
			repository.listNeeds(actor.organisationId),
			repository.listIdeas(actor.organisationId),
			repository.listBusinessCases(actor.organisationId)
		]);
		const ids = businessCases.map((row) => row.id);
		const [assumptions, scenarios] = await Promise.all([
			repository.listBusinessCaseAssumptions(actor.organisationId, ids),
			repository.listBusinessCaseScenarios(actor.organisationId, ids)
		]);
		return {
			portfolios,
			offerings,
			needs,
			ideas,
			businessCases,
			assumptions,
			scenarios,
			...flags
		};
	}

	async createPortfolio(actor: TenantActorContext, input: PortfolioInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await new ProductServiceRepository(trx).insertPortfolio({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				portfolio_code: code(input.portfolioCode, 'Portfolio code'),
				title: requiredText(input.title, 'Portfolio title', 255),
				portfolio_type: input.portfolioType,
				strategic_thesis: requiredText(input.strategicThesis, 'Strategic thesis', 5000),
				owner_member_id: owner,
				priority: input.priority,
				lifecycle_status: 'active',
				strategy_objective_public_id: optionalText(input.strategyObjectivePublicId, 100),
				strategy_kpi_public_id: optionalText(input.strategyKpiPublicId, 100),
				performance_evidence_public_id: optionalText(input.performanceEvidencePublicId, 100),
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.portfolio.created',
				'product_service_portfolio',
				created.public_id,
				{ portfolioCode: created.portfolio_code, portfolioType: created.portfolio_type },
				['F05.01']
			);
			return created;
		});
	}

	async createOffering(actor: TenantActorContext, input: OfferingInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const portfolio = await repository.findPortfolioByPublicId(
				actor.organisationId,
				input.portfolioPublicId.trim()
			);
			if (!portfolio) throw new RecordNotFoundError('Product/service portfolio not found.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertOffering({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				portfolio_id: portfolio.id,
				offering_code: code(input.offeringCode, 'Offering code'),
				title: requiredText(input.title, 'Offering title', 255),
				offering_type: input.offeringType,
				value_proposition: requiredText(input.valueProposition, 'Value proposition', 5000),
				owner_member_id: owner,
				lifecycle_stage: 'concept',
				lifecycle_status: 'active',
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.offering.created',
				'product_service_offering',
				created.public_id,
				{ offeringCode: created.offering_code, portfolioPublicId: portfolio.public_id },
				['F05.01']
			);
			return created;
		});
	}

	async createNeed(actor: TenantActorContext, input: NeedInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const portfolio = input.portfolioPublicId?.trim()
				? await repository.findPortfolioByPublicId(
						actor.organisationId,
						input.portfolioPublicId.trim()
					)
				: null;
			if (input.portfolioPublicId?.trim() && !portfolio) {
				throw new RecordNotFoundError('Product/service portfolio not found.');
			}
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertNeed({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				portfolio_id: portfolio?.id ?? null,
				need_code: code(input.needCode, 'Need code'),
				title: requiredText(input.title, 'Need title', 255),
				need_type: input.needType,
				need_statement: requiredText(input.needStatement, 'Need statement', 5000),
				source_domain: token(input.sourceDomain, 'Source domain'),
				source_record_type: optionalText(input.sourceRecordType, 80),
				source_public_id: optionalText(input.sourcePublicId, 100),
				source_reference: optionalText(input.sourceReference, 500),
				customer_or_market_segment: optionalText(input.customerOrMarketSegment, 255),
				evidence_strength: input.evidenceStrength,
				urgency: input.urgency,
				status: 'open',
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.need.created',
				'product_service_need',
				created.public_id,
				{ needCode: created.need_code, sourceDomain: created.source_domain },
				['F05.02']
			);
			return created;
		});
	}

	async createIdea(actor: TenantActorContext, input: IdeaInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const portfolio = input.portfolioPublicId?.trim()
				? await repository.findPortfolioByPublicId(
						actor.organisationId,
						input.portfolioPublicId.trim()
					)
				: null;
			if (input.portfolioPublicId?.trim() && !portfolio) {
				throw new RecordNotFoundError('Product/service portfolio not found.');
			}
			const need = input.needPublicId?.trim()
				? await repository.findNeedByPublicId(actor.organisationId, input.needPublicId.trim())
				: null;
			if (input.needPublicId?.trim() && !need) {
				throw new RecordNotFoundError('Product/service need not found.');
			}
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertIdea({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				portfolio_id: portfolio?.id ?? null,
				need_id: need?.id ?? null,
				idea_code: code(input.ideaCode, 'Idea code'),
				title: requiredText(input.title, 'Idea title', 255),
				idea_type: input.ideaType,
				problem_statement: requiredText(input.problemStatement, 'Problem statement', 5000),
				proposed_value: requiredText(input.proposedValue, 'Proposed value', 5000),
				provenance: requiredText(input.provenance, 'Provenance', 50),
				source_reference: optionalText(input.sourceReference, 500),
				owner_member_id: owner,
				stage: 'submitted',
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.idea.created',
				'product_service_idea',
				created.public_id,
				{ ideaCode: created.idea_code, needPublicId: need?.public_id ?? null },
				['F05.03']
			);
			return created;
		});
	}

	async scoreIdea(actor: TenantActorContext, ideaPublicId: string, input: IdeaScoreInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const idea = await repository.findIdeaByPublicId(actor.organisationId, ideaPublicId.trim());
			if (!idea) throw new RecordNotFoundError('Product/service idea not found.');

			const strategicFit = Number(score(input.strategicFit, 'Strategic fit score'));
			const customerValue = Number(score(input.customerValue, 'Customer value score'));
			const feasibility = Number(score(input.feasibility, 'Feasibility score'));
			const commercialValue = Number(score(input.commercialValue, 'Commercial value score'));
			const risk = Number(score(input.risk, 'Risk score'));
			const overall = (strategicFit + customerValue + feasibility + commercialValue + (100 - risk)) / 5;
			const updated = await repository.updateIdea(actor.organisationId, idea.id, {
				strategic_fit_score: strategicFit.toFixed(4),
				customer_value_score: customerValue.toFixed(4),
				feasibility_score: feasibility.toFixed(4),
				commercial_value_score: commercialValue.toFixed(4),
				risk_score: risk.toFixed(4),
				overall_score: overall.toFixed(4),
				stage: 'triage'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.idea.scored',
				'product_service_idea',
				updated.public_id,
				{ overallScore: updated.overall_score },
				['F05.03']
			);
			return updated;
		});
	}

	async createBusinessCase(actor: TenantActorContext, input: BusinessCaseInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const idea = await repository.findIdeaByPublicId(
				actor.organisationId,
				input.ideaPublicId.trim()
			);
			if (!idea) throw new RecordNotFoundError('Product/service idea not found.');
			const offering = input.offeringPublicId?.trim()
				? await repository.findOfferingByPublicId(
						actor.organisationId,
						input.offeringPublicId.trim()
					)
				: null;
			if (input.offeringPublicId?.trim() && !offering) {
				throw new RecordNotFoundError('Product/service offering not found.');
			}
			if (input.paybackMonths !== null && input.paybackMonths !== undefined && input.paybackMonths < 0) {
				throw new ProductServiceValidationError('Payback months must not be negative.');
			}
			const businessCaseCode = code(input.businessCaseCode, 'Business case code');
			const predecessors = await repository.listBusinessCases(actor.organisationId, idea.id);
			const predecessor =
				predecessors.find((row) => row.business_case_code === businessCaseCode) ?? null;
			const created = await repository.insertBusinessCase({
				public_id: this.publicIdFactory(),
				organisation_id: actor.organisationId,
				idea_id: idea.id,
				offering_id: offering?.id ?? null,
				business_case_code: businessCaseCode,
				version_number: predecessor ? predecessor.version_number + 1 : 1,
				title: requiredText(input.title, 'Business case title', 255),
				lifecycle_status: 'draft',
				currency_code: currencyCode(input.currencyCode),
				investment_cost: money(input.investmentCost, 'Investment cost'),
				annual_operating_cost: money(input.annualOperatingCost, 'Annual operating cost'),
				annual_revenue_or_value: money(input.annualRevenueOrValue, 'Annual revenue/value'),
				expected_benefit_value: money(input.expectedBenefitValue, 'Expected benefit value'),
				payback_months: input.paybackMonths ?? null,
				risk_summary: requiredText(input.riskSummary, 'Risk summary', 5000),
				recommendation: requiredText(input.recommendation, 'Recommendation', 5000),
				strategy_objective_public_id: optionalText(input.strategyObjectivePublicId, 100),
				performance_benefit_public_id: optionalText(input.performanceBenefitPublicId, 100),
				supersedes_business_case_id: predecessor?.id ?? null,
				created_by_member_id: actor.memberId
			});
			await repository.updateIdea(actor.organisationId, idea.id, { stage: 'business_case' });
			await this.evidence(
				trx,
				actor,
				'product_service.business_case.created',
				'product_service_business_case',
				created.public_id,
				{
					businessCaseCode: created.business_case_code,
					versionNumber: created.version_number,
					ideaPublicId: idea.public_id
				},
				['F05.04']
			);
			return created;
		});
	}

	async approveBusinessCase(actor: TenantActorContext, businessCasePublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceRepository(trx);
			const businessCase = await repository.findBusinessCaseByPublicId(
				actor.organisationId,
				businessCasePublicId.trim()
			);
			if (!businessCase) {
				throw new RecordNotFoundError('Product/service business case not found.');
			}
			if (businessCase.lifecycle_status === 'approved') return businessCase;
			if (businessCase.supersedes_business_case_id) {
				await repository.updateBusinessCase(
					actor.organisationId,
					businessCase.supersedes_business_case_id,
					{ lifecycle_status: 'superseded' }
				);
			}
			const approved = await repository.updateBusinessCase(
				actor.organisationId,
				businessCase.id,
				{
					lifecycle_status: 'approved',
					approved_by_member_id: actor.memberId,
					approved_at: new Date()
				}
			);
			await repository.updateIdea(actor.organisationId, businessCase.idea_id, {
				stage: 'approved',
				decided_by_member_id: actor.memberId,
				decided_at: new Date(),
				decision_reason: 'Business case approved.'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.business_case.approved',
				'product_service_business_case',
				approved.public_id,
				{
					businessCaseCode: approved.business_case_code,
					versionNumber: approved.version_number
				},
				['F05.04']
			);
			return approved;
		});
	}
}
