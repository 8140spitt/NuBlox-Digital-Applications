import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProductServiceRepository } from './product-service-repository';
import {
	ProductServiceLifecycleRepository,
	type ProductServiceDesignRecord,
	type ProductServiceDesignReviewRecord,
	type ProductServiceDevelopmentPlanRecord,
	type ProductServiceInnovationExperimentRecord,
	type ProductServiceLaunchPlanRecord,
	type ProductServiceLifecycleReviewRecord,
	type ProductServiceRetirementPlanRecord
} from './product-service-lifecycle-repository';
import { ProductServiceValidationError } from './product-service-service';

export type ProductServiceLifecycleWorkspace = {
	designs: ProductServiceDesignRecord[];
	designReviews: ProductServiceDesignReviewRecord[];
	developmentPlans: ProductServiceDevelopmentPlanRecord[];
	launchPlans: ProductServiceLaunchPlanRecord[];
	lifecycleReviews: ProductServiceLifecycleReviewRecord[];
	retirementPlans: ProductServiceRetirementPlanRecord[];
	innovationExperiments: ProductServiceInnovationExperimentRecord[];
	canManage: boolean;
	canApprove: boolean;
};

export type DesignInput = {
	offeringPublicId: string;
	businessCasePublicId?: string | null;
	designCode: string;
	title: string;
	designBrief: string;
	customerOutcomes: string;
	functionalRequirements: string;
	nonFunctionalRequirements?: string | null;
	acceptanceCriteria: string;
	evidencePublicId?: string | null;
	evidenceReference?: string | null;
	ownerMemberId: string;
};

export type DesignReviewInput = {
	designPublicId: string;
	reviewCode: string;
	reviewType: 'customer' | 'technical' | 'commercial' | 'operational' | 'compliance' | 'sustainability' | 'gate';
	reviewDate: Date;
	outcome: 'pass' | 'conditional' | 'fail';
	findings: string;
	actionsRequired?: string | null;
	evidencePublicId?: string | null;
	reviewerMemberId: string;
};

export type DevelopmentPlanInput = {
	designPublicId: string;
	developmentCode: string;
	title: string;
	deliveryApproach: string;
	scopeText: string;
	definitionOfDone: string;
	plannedStart?: Date | null;
	plannedFinish?: Date | null;
	projectPublicId?: string | null;
	evidencePublicId?: string | null;
	ownerMemberId: string;
};

export type LaunchPlanInput = {
	offeringPublicId: string;
	developmentPlanPublicId?: string | null;
	launchCode: string;
	title: string;
	targetLaunchDate: Date;
	targetSegments: string;
	commercialReadiness: string;
	operationalReadiness: string;
	customerReadiness: string;
	supportReadiness: string;
	readinessEvidencePublicId?: string | null;
	governanceDecisionPublicId?: string | null;
	ownerMemberId: string;
};

export type LifecycleReviewInput = {
	offeringPublicId: string;
	reviewCode: string;
	reviewDate: Date;
	lifecyclePhase: 'launch' | 'growth' | 'maturity' | 'decline' | 'end_of_life';
	performanceSummary: string;
	customerSummary: string;
	financialSummary: string;
	riskSummary: string;
	recommendation: 'continue' | 'improve' | 'reposition' | 'invest' | 'retire';
	performanceEvidencePublicId?: string | null;
	customerEvidencePublicId?: string | null;
	ownerMemberId: string;
};

export type RetirementPlanInput = {
	offeringPublicId: string;
	lifecycleReviewPublicId?: string | null;
	retirementCode: string;
	title: string;
	retirementRationale: string;
	customerTransitionPlan: string;
	operationalTransitionPlan: string;
	financialImpactSummary: string;
	dataRecordRetentionPlan: string;
	targetEndDate: Date;
	governanceDecisionPublicId?: string | null;
	ownerMemberId: string;
};

export type InnovationExperimentInput = {
	portfolioPublicId?: string | null;
	ideaPublicId?: string | null;
	offeringPublicId?: string | null;
	experimentCode: string;
	title: string;
	hypothesis: string;
	experimentMethod: string;
	successMeasure: string;
	plannedStart?: Date | null;
	plannedFinish?: Date | null;
	evidencePublicId?: string | null;
	ownerMemberId: string;
};

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,49}$/;

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

function assertDateOrder(start: Date | null | undefined, finish: Date | null | undefined, label: string) {
	if (start && finish && finish < start) {
		throw new ProductServiceValidationError(`${label} finish date must not precede the start date.`);
	}
}

export class ProductServiceLifecycleService {
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
		if (!row) throw new ProductServiceValidationError('Owner/reviewer must be an active organisation member.');
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

	async getWorkspace(actor: TenantActorContext): Promise<ProductServiceLifecycleWorkspace> {
		const flags = await this.permissionFlags(actor);
		const repository = new ProductServiceLifecycleRepository(this.db);
		const [
			designs,
			designReviews,
			developmentPlans,
			launchPlans,
			lifecycleReviews,
			retirementPlans,
			innovationExperiments
		] = await Promise.all([
			repository.listDesigns(actor.organisationId),
			repository.listDesignReviews(actor.organisationId),
			repository.listDevelopmentPlans(actor.organisationId),
			repository.listLaunchPlans(actor.organisationId),
			repository.listLifecycleReviews(actor.organisationId),
			repository.listRetirementPlans(actor.organisationId),
			repository.listInnovationExperiments(actor.organisationId)
		]);
		return {
			designs,
			designReviews,
			developmentPlans,
			launchPlans,
			lifecycleReviews,
			retirementPlans,
			innovationExperiments,
			...flags
		};
	}

	async createDesign(actor: TenantActorContext, input: DesignInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await productRepository.findOfferingByPublicId(actor.organisationId, input.offeringPublicId.trim());
			if (!offering) throw new RecordNotFoundError('Product/service offering not found.');
			const businessCase = input.businessCasePublicId?.trim()
				? await productRepository.findBusinessCaseByPublicId(actor.organisationId, input.businessCasePublicId.trim())
				: null;
			if (input.businessCasePublicId?.trim() && !businessCase) throw new RecordNotFoundError('Product/service business case not found.');
			if (businessCase && businessCase.lifecycle_status !== 'approved') {
				throw new ProductServiceValidationError('Design may only reference an approved business case.');
			}
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const designCode = code(input.designCode, 'Design code');
			const predecessors = (await repository.listDesigns(actor.organisationId)).filter(
				(row) => row.offering_id === offering.id && row.design_code === designCode
			);
			const predecessor = predecessors.sort((a, b) => b.version_number - a.version_number)[0] ?? null;
			const created = await repository.insertDesign({
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				business_case_id: businessCase?.id ?? null,
				public_id: this.publicIdFactory(),
				design_code: designCode,
				version_number: predecessor ? predecessor.version_number + 1 : 1,
				title: requiredText(input.title, 'Design title', 255),
				design_brief: requiredText(input.designBrief, 'Design brief', 5000),
				customer_outcomes: requiredText(input.customerOutcomes, 'Customer outcomes', 5000),
				functional_requirements: requiredText(input.functionalRequirements, 'Functional requirements', 10000),
				non_functional_requirements: optionalText(input.nonFunctionalRequirements, 10000),
				acceptance_criteria: requiredText(input.acceptanceCriteria, 'Acceptance criteria', 10000),
				evidence_public_id: optionalText(input.evidencePublicId, 100),
				evidence_reference: optionalText(input.evidenceReference, 500),
				lifecycle_status: 'draft',
				supersedes_design_id: predecessor?.id ?? null,
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.design.created', 'product_service_design', created.public_id, { designCode: created.design_code, versionNumber: created.version_number, offeringPublicId: offering.public_id }, ['F05.05']);
			return created;
		});
	}

	async addDesignReview(actor: TenantActorContext, input: DesignReviewInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const design = await repository.findDesignByPublicId(actor.organisationId, input.designPublicId.trim());
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			const reviewer = await this.activeMember(trx, actor.organisationId, input.reviewerMemberId);
			const created = await repository.insertDesignReview({
				organisation_id: actor.organisationId,
				design_id: design.id,
				public_id: this.publicIdFactory(),
				review_code: code(input.reviewCode, 'Review code'),
				review_type: input.reviewType,
				review_date: input.reviewDate,
				outcome: input.outcome,
				findings: requiredText(input.findings, 'Review findings', 10000),
				actions_required: optionalText(input.actionsRequired, 10000),
				evidence_public_id: optionalText(input.evidencePublicId, 100),
				reviewer_member_id: reviewer,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.design_review.recorded', 'product_service_design_review', created.public_id, { designPublicId: design.public_id, outcome: created.outcome, reviewType: created.review_type }, ['F05.05']);
			return created;
		});
	}

	async approveDesign(actor: TenantActorContext, designPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const design = await repository.findDesignByPublicId(actor.organisationId, designPublicId.trim());
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			if (design.lifecycle_status === 'approved') return design;
			const reviews = (await repository.listDesignReviews(actor.organisationId)).filter((row) => row.design_id === design.id);
			if (!reviews.length) throw new ProductServiceValidationError('Design approval requires at least one recorded review.');
			if (reviews.some((row) => row.outcome === 'fail')) throw new ProductServiceValidationError('Design approval is blocked by a failed review.');
			if (design.supersedes_design_id) {
				await repository.updateDesign(actor.organisationId, design.supersedes_design_id, { lifecycle_status: 'superseded' });
			}
			const approved = await repository.updateDesign(actor.organisationId, design.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'product_service.design.approved', 'product_service_design', approved.public_id, { designCode: approved.design_code, versionNumber: approved.version_number }, ['F05.05']);
			return approved;
		});
	}

	async createDevelopmentPlan(actor: TenantActorContext, input: DevelopmentPlanInput) {
		await this.requirePermission(actor, 'product_service.manage');
		assertDateOrder(input.plannedStart, input.plannedFinish, 'Development');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const design = await repository.findDesignByPublicId(actor.organisationId, input.designPublicId.trim());
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			if (design.lifecycle_status !== 'approved') throw new ProductServiceValidationError('Development requires an approved design.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertDevelopmentPlan({
				organisation_id: actor.organisationId,
				offering_id: design.offering_id,
				design_id: design.id,
				public_id: this.publicIdFactory(),
				development_code: code(input.developmentCode, 'Development code'),
				title: requiredText(input.title, 'Development title', 255),
				delivery_approach: requiredText(input.deliveryApproach, 'Delivery approach', 5000),
				scope_text: requiredText(input.scopeText, 'Development scope', 10000),
				definition_of_done: requiredText(input.definitionOfDone, 'Definition of done', 10000),
				planned_start: input.plannedStart ?? null,
				planned_finish: input.plannedFinish ?? null,
				project_public_id: optionalText(input.projectPublicId, 100),
				evidence_public_id: optionalText(input.evidencePublicId, 100),
				lifecycle_status: 'planned',
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.development.created', 'product_service_development_plan', created.public_id, { developmentCode: created.development_code, designPublicId: design.public_id, projectPublicId: created.project_public_id }, ['F05.06']);
			return created;
		});
	}

	async completeDevelopmentPlan(actor: TenantActorContext, developmentPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findDevelopmentPlanByPublicId(actor.organisationId, developmentPublicId.trim());
			if (!plan) throw new RecordNotFoundError('Product/service development plan not found.');
			if (plan.lifecycle_status === 'completed') return plan;
			const completed = await repository.updateDevelopmentPlan(actor.organisationId, plan.id, { lifecycle_status: 'completed', completed_by_member_id: actor.memberId, completed_at: new Date() });
			await this.evidence(trx, actor, 'product_service.development.completed', 'product_service_development_plan', completed.public_id, { developmentCode: completed.development_code }, ['F05.06']);
			return completed;
		});
	}

	async createLaunchPlan(actor: TenantActorContext, input: LaunchPlanInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await productRepository.findOfferingByPublicId(actor.organisationId, input.offeringPublicId.trim());
			if (!offering) throw new RecordNotFoundError('Product/service offering not found.');
			const development = input.developmentPlanPublicId?.trim()
				? await repository.findDevelopmentPlanByPublicId(actor.organisationId, input.developmentPlanPublicId.trim())
				: null;
			if (input.developmentPlanPublicId?.trim() && !development) throw new RecordNotFoundError('Product/service development plan not found.');
			if (development && development.lifecycle_status !== 'completed') throw new ProductServiceValidationError('Launch planning requires completed development when a development plan is linked.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertLaunchPlan({
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				development_plan_id: development?.id ?? null,
				public_id: this.publicIdFactory(),
				launch_code: code(input.launchCode, 'Launch code'),
				title: requiredText(input.title, 'Launch title', 255),
				target_launch_date: input.targetLaunchDate,
				target_segments: requiredText(input.targetSegments, 'Target segments', 5000),
				commercial_readiness: requiredText(input.commercialReadiness, 'Commercial readiness', 5000),
				operational_readiness: requiredText(input.operationalReadiness, 'Operational readiness', 5000),
				customer_readiness: requiredText(input.customerReadiness, 'Customer readiness', 5000),
				support_readiness: requiredText(input.supportReadiness, 'Support readiness', 5000),
				readiness_evidence_public_id: optionalText(input.readinessEvidencePublicId, 100),
				governance_decision_public_id: optionalText(input.governanceDecisionPublicId, 100),
				lifecycle_status: 'planning',
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.launch.created', 'product_service_launch_plan', created.public_id, { launchCode: created.launch_code, offeringPublicId: offering.public_id }, ['F05.07']);
			return created;
		});
	}

	async approveLaunch(actor: TenantActorContext, launchPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findLaunchPlanByPublicId(actor.organisationId, launchPublicId.trim());
			if (!plan) throw new RecordNotFoundError('Product/service launch plan not found.');
			if (plan.lifecycle_status === 'approved' || plan.lifecycle_status === 'launched') return plan;
			if (!plan.readiness_evidence_public_id) throw new ProductServiceValidationError('Launch approval requires readiness evidence.');
			if (!plan.governance_decision_public_id) throw new ProductServiceValidationError('Launch approval requires an F02 governance decision reference.');
			const approved = await repository.updateLaunchPlan(actor.organisationId, plan.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'product_service.launch.approved', 'product_service_launch_plan', approved.public_id, { launchCode: approved.launch_code, governanceDecisionPublicId: approved.governance_decision_public_id }, ['F05.07']);
			return approved;
		});
	}

	async markLaunched(actor: TenantActorContext, launchPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const productRepository = new ProductServiceRepository(trx);
			const plan = await repository.findLaunchPlanByPublicId(actor.organisationId, launchPublicId.trim());
			if (!plan) throw new RecordNotFoundError('Product/service launch plan not found.');
			if (plan.lifecycle_status !== 'approved' && plan.lifecycle_status !== 'launched') throw new ProductServiceValidationError('Only an approved launch plan may be launched.');
			if (plan.lifecycle_status === 'launched') return plan;
			const launchedAt = new Date();
			const launched = await repository.updateLaunchPlan(actor.organisationId, plan.id, { lifecycle_status: 'launched', launched_at: launchedAt });
			await productRepository.updateOffering(actor.organisationId, plan.offering_id, { lifecycle_stage: 'launched', lifecycle_status: 'active', launched_on: launchedAt });
			await this.evidence(trx, actor, 'product_service.launch.completed', 'product_service_launch_plan', launched.public_id, { launchCode: launched.launch_code }, ['F05.07']);
			return launched;
		});
	}

	async recordLifecycleReview(actor: TenantActorContext, input: LifecycleReviewInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await productRepository.findOfferingByPublicId(actor.organisationId, input.offeringPublicId.trim());
			if (!offering) throw new RecordNotFoundError('Product/service offering not found.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertLifecycleReview({
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				public_id: this.publicIdFactory(),
				review_code: code(input.reviewCode, 'Lifecycle review code'),
				review_date: input.reviewDate,
				lifecycle_phase: input.lifecyclePhase,
				performance_summary: requiredText(input.performanceSummary, 'Performance summary', 10000),
				customer_summary: requiredText(input.customerSummary, 'Customer summary', 10000),
				financial_summary: requiredText(input.financialSummary, 'Financial summary', 10000),
				risk_summary: requiredText(input.riskSummary, 'Risk summary', 10000),
				recommendation: input.recommendation,
				performance_evidence_public_id: optionalText(input.performanceEvidencePublicId, 100),
				customer_evidence_public_id: optionalText(input.customerEvidencePublicId, 100),
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.lifecycle.reviewed', 'product_service_lifecycle_review', created.public_id, { offeringPublicId: offering.public_id, lifecyclePhase: created.lifecycle_phase, recommendation: created.recommendation }, ['F05.08']);
			return created;
		});
	}

	async createRetirementPlan(actor: TenantActorContext, input: RetirementPlanInput) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await productRepository.findOfferingByPublicId(actor.organisationId, input.offeringPublicId.trim());
			if (!offering) throw new RecordNotFoundError('Product/service offering not found.');
			const review = input.lifecycleReviewPublicId?.trim()
				? await repository.findLifecycleReviewByPublicId(actor.organisationId, input.lifecycleReviewPublicId.trim())
				: null;
			if (input.lifecycleReviewPublicId?.trim() && !review) throw new RecordNotFoundError('Product/service lifecycle review not found.');
			if (review && review.recommendation !== 'retire') throw new ProductServiceValidationError('Linked lifecycle review must recommend retirement.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertRetirementPlan({
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				lifecycle_review_id: review?.id ?? null,
				public_id: this.publicIdFactory(),
				retirement_code: code(input.retirementCode, 'Retirement code'),
				title: requiredText(input.title, 'Retirement title', 255),
				retirement_rationale: requiredText(input.retirementRationale, 'Retirement rationale', 10000),
				customer_transition_plan: requiredText(input.customerTransitionPlan, 'Customer transition plan', 10000),
				operational_transition_plan: requiredText(input.operationalTransitionPlan, 'Operational transition plan', 10000),
				financial_impact_summary: requiredText(input.financialImpactSummary, 'Financial impact summary', 10000),
				data_record_retention_plan: requiredText(input.dataRecordRetentionPlan, 'Data/record retention plan', 10000),
				target_end_date: input.targetEndDate,
				governance_decision_public_id: optionalText(input.governanceDecisionPublicId, 100),
				lifecycle_status: 'draft',
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.retirement.created', 'product_service_retirement_plan', created.public_id, { retirementCode: created.retirement_code, offeringPublicId: offering.public_id }, ['F05.09']);
			return created;
		});
	}

	async approveRetirement(actor: TenantActorContext, retirementPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findRetirementPlanByPublicId(actor.organisationId, retirementPublicId.trim());
			if (!plan) throw new RecordNotFoundError('Product/service retirement plan not found.');
			if (plan.lifecycle_status === 'approved' || plan.lifecycle_status === 'completed') return plan;
			if (!plan.governance_decision_public_id) throw new ProductServiceValidationError('Retirement approval requires an F02 governance decision reference.');
			const approved = await repository.updateRetirementPlan(actor.organisationId, plan.id, { lifecycle_status: 'approved', approved_by_member_id: actor.memberId, approved_at: new Date() });
			await this.evidence(trx, actor, 'product_service.retirement.approved', 'product_service_retirement_plan', approved.public_id, { retirementCode: approved.retirement_code, governanceDecisionPublicId: approved.governance_decision_public_id }, ['F05.09']);
			return approved;
		});
	}

	async completeRetirement(actor: TenantActorContext, retirementPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const productRepository = new ProductServiceRepository(trx);
			const plan = await repository.findRetirementPlanByPublicId(actor.organisationId, retirementPublicId.trim());
			if (!plan) throw new RecordNotFoundError('Product/service retirement plan not found.');
			if (plan.lifecycle_status !== 'approved' && plan.lifecycle_status !== 'completed') throw new ProductServiceValidationError('Only an approved retirement plan may be completed.');
			if (plan.lifecycle_status === 'completed') return plan;
			const completed = await repository.updateRetirementPlan(actor.organisationId, plan.id, { lifecycle_status: 'completed', completed_at: new Date() });
			await productRepository.updateOffering(actor.organisationId, plan.offering_id, { lifecycle_stage: 'retired', lifecycle_status: 'retired', target_retirement_on: plan.target_end_date });
			await this.evidence(trx, actor, 'product_service.retirement.completed', 'product_service_retirement_plan', completed.public_id, { retirementCode: completed.retirement_code }, ['F05.09']);
			return completed;
		});
	}

	async createInnovationExperiment(actor: TenantActorContext, input: InnovationExperimentInput) {
		await this.requirePermission(actor, 'product_service.manage');
		assertDateOrder(input.plannedStart, input.plannedFinish, 'Experiment');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const portfolio = input.portfolioPublicId?.trim() ? await productRepository.findPortfolioByPublicId(actor.organisationId, input.portfolioPublicId.trim()) : null;
			if (input.portfolioPublicId?.trim() && !portfolio) throw new RecordNotFoundError('Product/service portfolio not found.');
			const idea = input.ideaPublicId?.trim() ? await productRepository.findIdeaByPublicId(actor.organisationId, input.ideaPublicId.trim()) : null;
			if (input.ideaPublicId?.trim() && !idea) throw new RecordNotFoundError('Product/service idea not found.');
			const offering = input.offeringPublicId?.trim() ? await productRepository.findOfferingByPublicId(actor.organisationId, input.offeringPublicId.trim()) : null;
			if (input.offeringPublicId?.trim() && !offering) throw new RecordNotFoundError('Product/service offering not found.');
			if (!portfolio && !idea && !offering) throw new ProductServiceValidationError('Innovation experiment must link to a portfolio, idea or offering.');
			const owner = await this.activeMember(trx, actor.organisationId, input.ownerMemberId);
			const created = await repository.insertInnovationExperiment({
				organisation_id: actor.organisationId,
				portfolio_id: portfolio?.id ?? null,
				idea_id: idea?.id ?? null,
				offering_id: offering?.id ?? null,
				public_id: this.publicIdFactory(),
				experiment_code: code(input.experimentCode, 'Experiment code'),
				title: requiredText(input.title, 'Experiment title', 255),
				hypothesis: requiredText(input.hypothesis, 'Hypothesis', 10000),
				experiment_method: requiredText(input.experimentMethod, 'Experiment method', 10000),
				success_measure: requiredText(input.successMeasure, 'Success measure', 10000),
				planned_start: input.plannedStart ?? null,
				planned_finish: input.plannedFinish ?? null,
				lifecycle_status: 'planned',
				evidence_public_id: optionalText(input.evidencePublicId, 100),
				owner_member_id: owner,
				created_by_member_id: actor.memberId
			});
			await this.evidence(trx, actor, 'product_service.innovation_experiment.created', 'product_service_innovation_experiment', created.public_id, { experimentCode: created.experiment_code, ideaPublicId: idea?.public_id ?? null, offeringPublicId: offering?.public_id ?? null }, ['F05.10']);
			return created;
		});
	}

	async closeInnovationExperiment(
		actor: TenantActorContext,
		experimentPublicId: string,
		input: { outcome: 'validated' | 'invalidated' | 'inconclusive'; learningSummary: string; evidencePublicId?: string | null }
	) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const experiment = await repository.findInnovationExperimentByPublicId(actor.organisationId, experimentPublicId.trim());
			if (!experiment) throw new RecordNotFoundError('Product/service innovation experiment not found.');
			if (experiment.lifecycle_status === 'completed') return experiment;
			const closed = await repository.updateInnovationExperiment(actor.organisationId, experiment.id, {
				lifecycle_status: 'completed',
				outcome: input.outcome,
				learning_summary: requiredText(input.learningSummary, 'Learning summary', 10000),
				evidence_public_id: optionalText(input.evidencePublicId, 100) ?? experiment.evidence_public_id,
				closed_by_member_id: actor.memberId,
				closed_at: new Date()
			});
			await this.evidence(trx, actor, 'product_service.innovation_experiment.closed', 'product_service_innovation_experiment', closed.public_id, { experimentCode: closed.experiment_code, outcome: closed.outcome }, ['F05.10']);
			return closed;
		});
	}
}
