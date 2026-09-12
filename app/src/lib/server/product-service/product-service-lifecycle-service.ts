import type { DatabaseExecutor } from '$lib/server/db/database';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { AuditOutboxEvidenceWriter } from '$lib/server/kernel/audit-outbox-evidence';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { ProductServiceRepository } from './product-service-repository';
import { ProductServiceValidationError } from './product-service-service';
import { ProductServiceLifecycleRepository } from './product-service-lifecycle-repository';

const CODE = /^[A-Z0-9][A-Z0-9_.-]{1,49}$/;

export { ProductServiceValidationError };

type PermissionKey = 'product_service.view' | 'product_service.manage' | 'product_service.approve';

function required(value: string, label: string, max = 5000): string {
	const trimmed = value.trim();
	if (!trimmed) throw new ProductServiceValidationError(`${label} is required.`);
	if (trimmed.length > max) throw new ProductServiceValidationError(`${label} is too long.`);
	return trimmed;
}
function optional(value?: string | null, max = 500): string | null {
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return null;
	if (trimmed.length > max) throw new ProductServiceValidationError('Reference value is too long.');
	return trimmed;
}
function code(value: string, label: string): string {
	const normalised = value.trim().toUpperCase();
	if (!CODE.test(normalised))
		throw new ProductServiceValidationError(
			`${label} must be 2-50 characters using letters, numbers, dot, underscore or hyphen.`
		);
	return normalised;
}
function date(value?: string | Date | null): string | null {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	const trimmed = value?.trim() ?? '';
	if (!trimmed) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed))
		throw new ProductServiceValidationError('Date must use YYYY-MM-DD.');
	return trimmed;
}

export class ProductServiceLifecycleService {
	constructor(private readonly db: DatabaseExecutor) {}

	private async requireActor(actor: TenantActorContext) {
		const member = await this.db
			.selectFrom('organisation_members')
			.select('id')
			.where('id', '=', actor.memberId)
			.where('organisation_id', '=', actor.organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!member) throw new TenantAccessError('Active organisation membership is required.');
	}
	private async requirePermission(actor: TenantActorContext, permission: PermissionKey) {
		await this.requireActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, permission);
		if (!decision.allowed) {
			throw new TenantAccessError(`Permission ${permission} is required.`);
		}
	}
	private evidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		metadata: Record<string, unknown>,
		subfunctions: string[]
	) {
		return new AuditOutboxEvidenceWriter(db).record({
			actor,
			actionKey,
			subjectType,
			subjectPublicId,
			metadata: { ...metadata, function: 'F05', subfunctions },
			eventType: actionKey,
			eventPayload: { subjectType, subjectPublicId, function: 'F05', subfunctions, ...metadata }
		});
	}
	private async offeringId(
		repository: ProductServiceRepository,
		actor: TenantActorContext,
		publicId: string
	) {
		const row = await repository.findOfferingByPublicId(actor.organisationId, publicId.trim());
		if (!row) throw new RecordNotFoundError('Product/service offering not found.');
		return row;
	}
	private async member(actor: TenantActorContext, memberId: string) {
		const row = await this.db
			.selectFrom('organisation_members')
			.select('id')
			.where('id', '=', memberId)
			.where('organisation_id', '=', actor.organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) throw new ProductServiceValidationError('Owner/reviewer must be an active member.');
	}

	async getWorkspace(actor: TenantActorContext) {
		await this.requirePermission(actor, 'product_service.view');
		const core = await new ProductServiceRepository(this.db).getWorkspace(actor.organisationId);
		const lifecycle = await new ProductServiceLifecycleRepository(this.db).getWorkspace(
			actor.organisationId
		);
		const permissions = new PermissionService(this.db);
		const [manage, approve] = await Promise.all([
			permissions.decide(actor, 'product_service.manage'),
			permissions.decide(actor, 'product_service.approve')
		]);
		return {
			...core,
			...lifecycle,
			canManage: manage.allowed,
			canApprove: approve.allowed
		};
	}

	async createDesign(
		actor: TenantActorContext,
		input: {
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
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await this.offeringId(productRepository, actor, input.offeringPublicId);
			let businessCaseId: string | null = null;
			if (input.businessCasePublicId?.trim()) {
				const businessCase = await productRepository.findBusinessCaseByPublicId(
					actor.organisationId,
					input.businessCasePublicId.trim()
				);
				if (!businessCase)
					throw new RecordNotFoundError('Product/service business case not found.');
				if (businessCase.lifecycle_status !== 'approved')
					throw new ProductServiceValidationError(
						'Design may only be based on an approved business case.'
					);
				businessCaseId = businessCase.id;
			}
			const designCode = code(input.designCode, 'Design code');
			const latest = await repository.findLatestDesignByCode(
				actor.organisationId,
				offering.id,
				designCode
			);
			const created = await repository.createDesign({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				business_case_id: businessCaseId,
				design_code: designCode,
				version_number: (latest?.version_number ?? 0) + 1,
				title: required(input.title, 'Title', 255),
				design_brief: required(input.designBrief, 'Design brief'),
				customer_outcomes: required(input.customerOutcomes, 'Customer outcomes'),
				functional_requirements: required(input.functionalRequirements, 'Functional requirements'),
				non_functional_requirements: optional(input.nonFunctionalRequirements, 5000),
				acceptance_criteria: required(input.acceptanceCriteria, 'Acceptance criteria'),
				evidence_public_id: optional(input.evidencePublicId, 100),
				evidence_reference: optional(input.evidenceReference),
				lifecycle_status: 'draft',
				supersedes_design_id: latest?.id ?? null,
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await productRepository.updateOffering(actor.organisationId, offering.id, {
				lifecycle_stage: 'design'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.design.created',
				'product_service_design',
				created.public_id,
				{ designCode: created.design_code, versionNumber: created.version_number },
				['F05.05']
			);
			return created;
		});
	}

	async addDesignReview(
		actor: TenantActorContext,
		input: {
			designPublicId: string;
			reviewCode: string;
			reviewType: string;
			reviewDate: string | Date;
			outcome: string;
			findings: string;
			actionsRequired?: string | null;
			evidencePublicId?: string | null;
			reviewerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.reviewerMemberId);
		const reviewTypes = [
			'customer',
			'technical',
			'commercial',
			'operational',
			'compliance',
			'sustainability',
			'gate'
		];
		if (!reviewTypes.includes(input.reviewType))
			throw new ProductServiceValidationError('Unsupported design review type.');
		if (!['pass', 'conditional', 'fail'].includes(input.outcome))
			throw new ProductServiceValidationError('Unsupported design review outcome.');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const design = await repository.findDesignByPublicId(
				actor.organisationId,
				input.designPublicId.trim()
			);
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			const created = await repository.createDesignReview({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				design_id: design.id,
				review_code: code(input.reviewCode, 'Review code'),
				review_type: input.reviewType,
				review_date: new Date(date(input.reviewDate)!),
				outcome: input.outcome,
				findings: required(input.findings, 'Findings'),
				actions_required: optional(input.actionsRequired, 5000),
				evidence_public_id: optional(input.evidencePublicId, 100),
				reviewer_member_id: input.reviewerMemberId,
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.design.reviewed',
				'product_service_design',
				design.public_id,
				{ reviewCode: created.review_code, outcome: created.outcome },
				['F05.05']
			);
			return created;
		});
	}

	async approveDesign(actor: TenantActorContext, designPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const design = await repository.findDesignByPublicId(
				actor.organisationId,
				designPublicId.trim()
			);
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			if (design.lifecycle_status === 'approved') return design;
			if (design.lifecycle_status !== 'draft')
				throw new ProductServiceValidationError('Only a draft design may be approved.');
			const reviews = await repository.listDesignReviews(actor.organisationId, design.id);
			if (!reviews.length || reviews.some((review) => review.outcome === 'fail'))
				throw new ProductServiceValidationError(
					'Design approval requires review evidence with no failed review.'
				);
			const approved = await repository.updateDesign(actor.organisationId, design.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: new Date()
			});
			if (design.supersedes_design_id) {
				const predecessor = await repository.findDesignById(
					actor.organisationId,
					design.supersedes_design_id
				);
				if (predecessor?.lifecycle_status === 'approved') {
					await repository.updateDesign(actor.organisationId, predecessor.id, {
						lifecycle_status: 'superseded'
					});
				}
			}
			await this.evidence(
				trx,
				actor,
				'product_service.design.approved',
				'product_service_design',
				approved.public_id,
				{ designCode: approved.design_code, versionNumber: approved.version_number },
				['F05.05']
			);
			return approved;
		});
	}

	async createDevelopmentPlan(
		actor: TenantActorContext,
		input: {
			designPublicId: string;
			developmentCode: string;
			title: string;
			deliveryApproach: string;
			scopeText: string;
			definitionOfDone: string;
			plannedStart?: string | Date | null;
			plannedFinish?: string | Date | null;
			projectPublicId?: string | null;
			evidencePublicId?: string | null;
			ownerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const productRepository = new ProductServiceRepository(trx);
			const design = await repository.findDesignByPublicId(
				actor.organisationId,
				input.designPublicId.trim()
			);
			if (!design) throw new RecordNotFoundError('Product/service design not found.');
			if (design.lifecycle_status !== 'approved')
				throw new ProductServiceValidationError(
					'Development requires an approved design baseline.'
				);
			const created = await repository.createDevelopmentPlan({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				offering_id: design.offering_id,
				design_id: design.id,
				development_code: code(input.developmentCode, 'Development code'),
				title: required(input.title, 'Title', 255),
				delivery_approach: required(input.deliveryApproach, 'Delivery approach'),
				scope_text: required(input.scopeText, 'Scope'),
				definition_of_done: required(input.definitionOfDone, 'Definition of done'),
				planned_start: date(input.plannedStart) ? new Date(date(input.plannedStart)!) : null,
				planned_finish: date(input.plannedFinish) ? new Date(date(input.plannedFinish)!) : null,
				project_public_id: optional(input.projectPublicId, 100),
				evidence_public_id: optional(input.evidencePublicId, 100),
				lifecycle_status: 'planned',
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await productRepository.updateOffering(actor.organisationId, design.offering_id, {
				lifecycle_stage: 'development'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.development.created',
				'product_service_development_plan',
				created.public_id,
				{ developmentCode: created.development_code, projectPublicId: created.project_public_id },
				['F05.06']
			);
			return created;
		});
	}

	async completeDevelopmentPlan(actor: TenantActorContext, developmentPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findDevelopmentPlanByPublicId(
				actor.organisationId,
				developmentPublicId.trim()
			);
			if (!plan) throw new RecordNotFoundError('Product/service development plan not found.');
			if (plan.lifecycle_status === 'completed') return plan;
			const completed = await repository.updateDevelopmentPlan(actor.organisationId, plan.id, {
				lifecycle_status: 'completed',
				completed_by_member_id: actor.memberId,
				completed_at: new Date()
			});
			await this.evidence(
				trx,
				actor,
				'product_service.development.completed',
				'product_service_development_plan',
				completed.public_id,
				{ developmentCode: completed.development_code },
				['F05.06']
			);
			return completed;
		});
	}

	async createLaunchPlan(
		actor: TenantActorContext,
		input: {
			offeringPublicId: string;
			developmentPlanPublicId?: string | null;
			launchCode: string;
			title: string;
			targetLaunchDate: string | Date;
			targetSegments: string;
			commercialReadiness: string;
			operationalReadiness: string;
			customerReadiness: string;
			supportReadiness: string;
			readinessEvidencePublicId?: string | null;
			governanceDecisionPublicId?: string | null;
			ownerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await this.offeringId(productRepository, actor, input.offeringPublicId);
			let developmentPlanId: string | null = null;
			if (input.developmentPlanPublicId?.trim()) {
				const development = await repository.findDevelopmentPlanByPublicId(
					actor.organisationId,
					input.developmentPlanPublicId.trim()
				);
				if (!development)
					throw new RecordNotFoundError('Product/service development plan not found.');
				if (development.offering_id !== offering.id)
					throw new ProductServiceValidationError(
						'Development plan must belong to the selected offering.'
					);
				if (development.lifecycle_status !== 'completed')
					throw new ProductServiceValidationError(
						'Launch readiness requires completed development evidence.'
					);
				developmentPlanId = development.id;
			}
			const created = await repository.createLaunchPlan({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				development_plan_id: developmentPlanId,
				launch_code: code(input.launchCode, 'Launch code'),
				title: required(input.title, 'Title', 255),
				target_launch_date: new Date(date(input.targetLaunchDate)!),
				target_segments: required(input.targetSegments, 'Target segments'),
				commercial_readiness: required(input.commercialReadiness, 'Commercial readiness'),
				operational_readiness: required(input.operationalReadiness, 'Operational readiness'),
				customer_readiness: required(input.customerReadiness, 'Customer readiness'),
				support_readiness: required(input.supportReadiness, 'Support readiness'),
				readiness_evidence_public_id: optional(input.readinessEvidencePublicId, 100),
				governance_decision_public_id: optional(input.governanceDecisionPublicId, 100),
				lifecycle_status: 'planning',
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await productRepository.updateOffering(actor.organisationId, offering.id, {
				lifecycle_stage: 'launch'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.launch.created',
				'product_service_launch_plan',
				created.public_id,
				{ launchCode: created.launch_code },
				['F05.07']
			);
			return created;
		});
	}

	async approveLaunch(actor: TenantActorContext, launchPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findLaunchPlanByPublicId(
				actor.organisationId,
				launchPublicId.trim()
			);
			if (!plan) throw new RecordNotFoundError('Product/service launch plan not found.');
			if (plan.lifecycle_status === 'approved' || plan.lifecycle_status === 'launched') return plan;
			if (!plan.governance_decision_public_id)
				throw new ProductServiceValidationError(
					'Launch approval requires an F02 governance decision reference.'
				);
			if (!plan.readiness_evidence_public_id)
				throw new ProductServiceValidationError('Launch approval requires readiness evidence.');
			const approved = await repository.updateLaunchPlan(actor.organisationId, plan.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: new Date()
			});
			await this.evidence(
				trx,
				actor,
				'product_service.launch.approved',
				'product_service_launch_plan',
				approved.public_id,
				{ governanceDecisionPublicId: approved.governance_decision_public_id },
				['F05.07']
			);
			return approved;
		});
	}

	async markLaunched(actor: TenantActorContext, launchPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const productRepository = new ProductServiceRepository(trx);
			const plan = await repository.findLaunchPlanByPublicId(
				actor.organisationId,
				launchPublicId.trim()
			);
			if (!plan) throw new RecordNotFoundError('Product/service launch plan not found.');
			if (plan.lifecycle_status !== 'approved' && plan.lifecycle_status !== 'launched')
				throw new ProductServiceValidationError('Only an approved launch plan may be launched.');
			if (plan.lifecycle_status === 'launched') return plan;
			const launchedAt = new Date();
			const launched = await repository.updateLaunchPlan(actor.organisationId, plan.id, {
				lifecycle_status: 'launched',
				launched_at: launchedAt
			});
			await productRepository.updateOffering(actor.organisationId, plan.offering_id, {
				lifecycle_stage: 'live',
				lifecycle_status: 'active',
				launched_on: launchedAt
			});
			await this.evidence(
				trx,
				actor,
				'product_service.launch.completed',
				'product_service_launch_plan',
				launched.public_id,
				{ launchCode: launched.launch_code },
				['F05.07']
			);
			return launched;
		});
	}

	async recordLifecycleReview(
		actor: TenantActorContext,
		input: {
			offeringPublicId: string;
			reviewCode: string;
			reviewDate: string | Date;
			lifecyclePhase: string;
			performanceSummary: string;
			customerSummary: string;
			financialSummary: string;
			riskSummary: string;
			recommendation: string;
			performanceEvidencePublicId?: string | null;
			customerEvidencePublicId?: string | null;
			ownerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		if (!['launch', 'growth', 'maturity', 'decline', 'end_of_life'].includes(input.lifecyclePhase))
			throw new ProductServiceValidationError('Unsupported lifecycle phase.');
		if (!['continue', 'improve', 'reposition', 'invest', 'retire'].includes(input.recommendation))
			throw new ProductServiceValidationError('Unsupported lifecycle recommendation.');
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await this.offeringId(productRepository, actor, input.offeringPublicId);
			const created = await repository.createLifecycleReview({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				review_code: code(input.reviewCode, 'Review code'),
				review_date: new Date(date(input.reviewDate)!),
				lifecycle_phase: input.lifecyclePhase,
				performance_summary: required(input.performanceSummary, 'Performance summary'),
				customer_summary: required(input.customerSummary, 'Customer summary'),
				financial_summary: required(input.financialSummary, 'Financial summary'),
				risk_summary: required(input.riskSummary, 'Risk summary'),
				recommendation: input.recommendation,
				performance_evidence_public_id: optional(input.performanceEvidencePublicId, 100),
				customer_evidence_public_id: optional(input.customerEvidencePublicId, 100),
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.lifecycle.reviewed',
				'product_service_lifecycle_review',
				created.public_id,
				{
					performanceEvidencePublicId: created.performance_evidence_public_id,
					customerEvidencePublicId: created.customer_evidence_public_id,
					recommendation: created.recommendation
				},
				['F05.08']
			);
			return created;
		});
	}

	async createRetirementPlan(
		actor: TenantActorContext,
		input: {
			offeringPublicId: string;
			lifecycleReviewPublicId?: string | null;
			retirementCode: string;
			title: string;
			retirementRationale: string;
			customerTransitionPlan: string;
			operationalTransitionPlan: string;
			financialImpactSummary: string;
			dataRecordRetentionPlan: string;
			targetEndDate: string | Date;
			governanceDecisionPublicId?: string | null;
			ownerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const offering = await this.offeringId(productRepository, actor, input.offeringPublicId);
			let lifecycleReviewId: string | null = null;
			if (input.lifecycleReviewPublicId?.trim()) {
				const review = await repository.findLifecycleReviewByPublicId(
					actor.organisationId,
					input.lifecycleReviewPublicId.trim()
				);
				if (!review) throw new RecordNotFoundError('Product/service lifecycle review not found.');
				if (review.offering_id !== offering.id || review.recommendation !== 'retire')
					throw new ProductServiceValidationError(
						'Retirement requires a retire recommendation for the selected offering.'
					);
				lifecycleReviewId = review.id;
			}
			const created = await repository.createRetirementPlan({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				offering_id: offering.id,
				lifecycle_review_id: lifecycleReviewId,
				retirement_code: code(input.retirementCode, 'Retirement code'),
				title: required(input.title, 'Title', 255),
				retirement_rationale: required(input.retirementRationale, 'Retirement rationale'),
				customer_transition_plan: required(
					input.customerTransitionPlan,
					'Customer transition plan'
				),
				operational_transition_plan: required(
					input.operationalTransitionPlan,
					'Operational transition plan'
				),
				financial_impact_summary: required(
					input.financialImpactSummary,
					'Financial impact summary'
				),
				data_record_retention_plan: required(
					input.dataRecordRetentionPlan,
					'Data/record retention plan'
				),
				target_end_date: new Date(date(input.targetEndDate)!),
				governance_decision_public_id: optional(input.governanceDecisionPublicId, 100),
				lifecycle_status: 'draft',
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await productRepository.updateOffering(actor.organisationId, offering.id, {
				lifecycle_stage: 'retirement'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.retirement.created',
				'product_service_retirement_plan',
				created.public_id,
				{ retirementCode: created.retirement_code },
				['F05.09']
			);
			return created;
		});
	}

	async approveRetirement(actor: TenantActorContext, retirementPublicId: string) {
		await this.requirePermission(actor, 'product_service.approve');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const plan = await repository.findRetirementPlanByPublicId(
				actor.organisationId,
				retirementPublicId.trim()
			);
			if (!plan) throw new RecordNotFoundError('Product/service retirement plan not found.');
			if (plan.lifecycle_status === 'approved' || plan.lifecycle_status === 'completed')
				return plan;
			if (!plan.governance_decision_public_id)
				throw new ProductServiceValidationError(
					'Retirement approval requires an F02 governance decision reference.'
				);
			const approved = await repository.updateRetirementPlan(actor.organisationId, plan.id, {
				lifecycle_status: 'approved',
				approved_by_member_id: actor.memberId,
				approved_at: new Date()
			});
			await this.evidence(
				trx,
				actor,
				'product_service.retirement.approved',
				'product_service_retirement_plan',
				approved.public_id,
				{ governanceDecisionPublicId: approved.governance_decision_public_id },
				['F05.09']
			);
			return approved;
		});
	}

	async completeRetirement(actor: TenantActorContext, retirementPublicId: string) {
		await this.requirePermission(actor, 'product_service.manage');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const productRepository = new ProductServiceRepository(trx);
			const plan = await repository.findRetirementPlanByPublicId(
				actor.organisationId,
				retirementPublicId.trim()
			);
			if (!plan) throw new RecordNotFoundError('Product/service retirement plan not found.');
			if (plan.lifecycle_status === 'completed') return plan;
			if (plan.lifecycle_status !== 'approved' && plan.lifecycle_status !== 'in_progress')
				throw new ProductServiceValidationError(
					'Only an approved retirement plan may be completed.'
				);
			const completed = await repository.updateRetirementPlan(actor.organisationId, plan.id, {
				lifecycle_status: 'completed',
				completed_at: new Date()
			});
			await productRepository.updateOffering(actor.organisationId, plan.offering_id, {
				lifecycle_stage: 'retired',
				lifecycle_status: 'retired'
			});
			await this.evidence(
				trx,
				actor,
				'product_service.retirement.completed',
				'product_service_retirement_plan',
				completed.public_id,
				{ retirementCode: completed.retirement_code },
				['F05.09']
			);
			return completed;
		});
	}

	async createInnovationExperiment(
		actor: TenantActorContext,
		input: {
			portfolioPublicId?: string | null;
			ideaPublicId?: string | null;
			offeringPublicId?: string | null;
			experimentCode: string;
			title: string;
			hypothesis: string;
			experimentMethod: string;
			successMeasure: string;
			plannedStart?: string | Date | null;
			plannedFinish?: string | Date | null;
			evidencePublicId?: string | null;
			ownerMemberId: string;
		}
	) {
		await this.requirePermission(actor, 'product_service.manage');
		await this.member(actor, input.ownerMemberId);
		return this.db.transaction().execute(async (trx) => {
			const productRepository = new ProductServiceRepository(trx);
			const repository = new ProductServiceLifecycleRepository(trx);
			const portfolio = input.portfolioPublicId?.trim()
				? await productRepository.findPortfolioByPublicId(
						actor.organisationId,
						input.portfolioPublicId.trim()
					)
				: null;
			const idea = input.ideaPublicId?.trim()
				? await productRepository.findIdeaByPublicId(
						actor.organisationId,
						input.ideaPublicId.trim()
					)
				: null;
			const offering = input.offeringPublicId?.trim()
				? await productRepository.findOfferingByPublicId(
						actor.organisationId,
						input.offeringPublicId.trim()
					)
				: null;
			if (input.portfolioPublicId?.trim() && !portfolio)
				throw new RecordNotFoundError('Product/service portfolio not found.');
			if (input.ideaPublicId?.trim() && !idea)
				throw new RecordNotFoundError('Product/service idea not found.');
			if (input.offeringPublicId?.trim() && !offering)
				throw new RecordNotFoundError('Product/service offering not found.');
			const created = await repository.createInnovationExperiment({
				public_id: crypto.randomUUID(),
				organisation_id: actor.organisationId,
				portfolio_id: portfolio?.id ?? null,
				idea_id: idea?.id ?? null,
				offering_id: offering?.id ?? null,
				experiment_code: code(input.experimentCode, 'Experiment code'),
				title: required(input.title, 'Title', 255),
				hypothesis: required(input.hypothesis, 'Hypothesis'),
				experiment_method: required(input.experimentMethod, 'Experiment method'),
				success_measure: required(input.successMeasure, 'Success measure'),
				planned_start: date(input.plannedStart) ? new Date(date(input.plannedStart)!) : null,
				planned_finish: date(input.plannedFinish) ? new Date(date(input.plannedFinish)!) : null,
				lifecycle_status: 'planned',
				outcome: null,
				learning_summary: null,
				evidence_public_id: optional(input.evidencePublicId, 100),
				owner_member_id: input.ownerMemberId,
				created_by_member_id: actor.memberId
			});
			await this.evidence(
				trx,
				actor,
				'product_service.innovation.experiment.created',
				'product_service_innovation_experiment',
				created.public_id,
				{ experimentCode: created.experiment_code },
				['F05.10']
			);
			return created;
		});
	}

	async closeInnovationExperiment(
		actor: TenantActorContext,
		experimentPublicId: string,
		input: { outcome: string; learningSummary: string; evidencePublicId?: string | null }
	) {
		await this.requirePermission(actor, 'product_service.manage');
		if (!['validated', 'invalidated', 'inconclusive'].includes(input.outcome))
			throw new ProductServiceValidationError('Unsupported experiment outcome.');
		return this.db.transaction().execute(async (trx) => {
			const repository = new ProductServiceLifecycleRepository(trx);
			const experiment = await repository.findInnovationExperimentByPublicId(
				actor.organisationId,
				experimentPublicId.trim()
			);
			if (!experiment) throw new RecordNotFoundError('Innovation experiment not found.');
			if (experiment.lifecycle_status === 'completed') return experiment;
			const completed = await repository.updateInnovationExperiment(
				actor.organisationId,
				experiment.id,
				{
					lifecycle_status: 'completed',
					outcome: input.outcome,
					learning_summary: required(input.learningSummary, 'Learning summary'),
					evidence_public_id:
						optional(input.evidencePublicId, 100) ?? experiment.evidence_public_id,
					closed_by_member_id: actor.memberId,
					closed_at: new Date()
				}
			);
			await this.evidence(
				trx,
				actor,
				'product_service.innovation.experiment.closed',
				'product_service_innovation_experiment',
				completed.public_id,
				{ outcome: completed.outcome },
				['F05.10']
			);
			return completed;
		});
	}
}
