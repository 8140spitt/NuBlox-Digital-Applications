import { beforeAll, describe, expect, it } from 'vitest';

import { getDatabase } from '$lib/server/db/database';
import { ProductServiceLifecycleService } from './product-service-lifecycle-service';
import { ProductServiceService, ProductServiceValidationError } from './product-service-service';

let actor: { organisationId: string; userId: string; memberId: string; correlationId: string };

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function seedActor() {
	const db = getDatabase();
	const suffix = Math.random().toString(36).slice(2, 10);
	const organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: crypto.randomUUID(),
				legal_name: `F05 Lifecycle ${suffix}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: crypto.randomUUID(),
				display_name: `F05 Lifecycle Owner ${suffix}`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				public_id: crypto.randomUUID(),
				organisation_id: organisationId,
				user_id: userId,
				status: 'active',
				joined_at: new Date('2026-09-11T20:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: crypto.randomUUID(),
				name: `F05 lifecycle owner ${suffix}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [
			'product_service.view',
			'product_service.manage',
			'product_service.approve'
		])
		.where('is_active', '=', 1)
		.execute();
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
	actor = { organisationId, userId, memberId, correlationId: crypto.randomUUID() };
}

describe('F05 design through innovation lifecycle', () => {
	beforeAll(async () => {
		await seedActor();
	});

	it('executes F05.05-F05.10 with governed gates and cross-domain references', async () => {
		const db = getDatabase();
		const core = new ProductServiceService(db);
		const lifecycle = new ProductServiceLifecycleService(db);
		const suffix = Date.now().toString().slice(-8);

		const portfolio = await core.createPortfolio(actor, {
			portfolioCode: `LP${suffix}`,
			title: 'Lifecycle assurance portfolio',
			portfolioType: 'service',
			strategicThesis:
				'Operate a governed product/service lifecycle from approved investment to retirement.',
			ownerMemberId: actor.memberId,
			priority: 'high'
		});
		const offering = await core.createOffering(actor, {
			portfolioPublicId: portfolio.public_id,
			offeringCode: `LO${suffix}`,
			title: 'Lifecycle assurance service',
			offeringType: 'service',
			valueProposition: 'Create evidence-backed readiness and lifecycle decisions.',
			ownerMemberId: actor.memberId
		});
		const idea = await core.createIdea(actor, {
			portfolioPublicId: portfolio.public_id,
			ideaCode: `LI${suffix}`,
			title: 'Lifecycle assurance concept',
			ideaType: 'new_service',
			problemStatement: 'Lifecycle decisions lack a governed evidence thread.',
			proposedValue: 'Connect design, delivery, launch, performance and retirement evidence.',
			provenance: 'strategy_signal',
			ownerMemberId: actor.memberId
		});
		const businessCase = await core.createBusinessCase(actor, {
			ideaPublicId: idea.public_id,
			offeringPublicId: offering.public_id,
			businessCaseCode: `BC${suffix}`,
			title: 'Lifecycle assurance business case',
			currencyCode: 'GBP',
			investmentCost: '100000',
			annualRevenueOrValue: '300000',
			expectedBenefitValue: '200000',
			paybackMonths: 8,
			riskSummary: 'Controlled adoption risk.',
			recommendation: 'Proceed to design.'
		});
		await core.approveBusinessCase(actor, businessCase.public_id);

		const design = await lifecycle.createDesign(actor, {
			offeringPublicId: offering.public_id,
			businessCasePublicId: businessCase.public_id,
			designCode: `DS${suffix}`,
			title: 'Lifecycle assurance service design',
			designBrief: 'Design the service operating model and evidence controls.',
			customerOutcomes: 'Faster, clearer lifecycle decisions with auditable evidence.',
			functionalRequirements: 'Capture controlled lifecycle records and decision references.',
			nonFunctionalRequirements: 'Tenant isolation, auditability and evidence provenance.',
			acceptanceCriteria:
				'All lifecycle gates operate with fail-closed permissions and audit evidence.',
			evidencePublicId: 'DOC-DESIGN-001',
			evidenceReference: 'Controlled design evidence pack',
			ownerMemberId: actor.memberId
		});
		await expect(lifecycle.approveDesign(actor, design.public_id)).rejects.toBeInstanceOf(
			ProductServiceValidationError
		);
		await lifecycle.addDesignReview(actor, {
			designPublicId: design.public_id,
			reviewCode: `RV${suffix}`,
			reviewType: 'gate',
			reviewDate: new Date('2026-09-12T00:00:00.000Z'),
			outcome: 'pass',
			findings: 'Design meets the controlled lifecycle gate.',
			evidencePublicId: 'DOC-REVIEW-001',
			reviewerMemberId: actor.memberId
		});
		const approvedDesign = await lifecycle.approveDesign(actor, design.public_id);
		expect(approvedDesign.lifecycle_status).toBe('approved');

		const development = await lifecycle.createDevelopmentPlan(actor, {
			designPublicId: design.public_id,
			developmentCode: `DV${suffix}`,
			title: 'Lifecycle assurance development',
			deliveryApproach: 'Incremental implementation with controlled verification.',
			scopeText: 'Implement the approved lifecycle capability and integrations.',
			definitionOfDone: 'Acceptance criteria met and evidence attached.',
			plannedStart: new Date('2026-09-14T00:00:00.000Z'),
			plannedFinish: new Date('2026-10-15T00:00:00.000Z'),
			projectPublicId: 'PROJECT-F05-001',
			evidencePublicId: 'DOC-DEV-001',
			ownerMemberId: actor.memberId
		});
		const completedDevelopment = await lifecycle.completeDevelopmentPlan(
			actor,
			development.public_id
		);
		expect(completedDevelopment.lifecycle_status).toBe('completed');

		const launchWithoutGovernance = await lifecycle.createLaunchPlan(actor, {
			offeringPublicId: offering.public_id,
			developmentPlanPublicId: development.public_id,
			launchCode: `LG${suffix}`,
			title: 'Lifecycle assurance launch',
			targetLaunchDate: new Date('2026-10-20T00:00:00.000Z'),
			targetSegments: 'Built-environment operating companies.',
			commercialReadiness: 'Commercial model approved.',
			operationalReadiness: 'Operating team trained.',
			customerReadiness: 'Pilot customers briefed.',
			supportReadiness: 'Support model operational.',
			readinessEvidencePublicId: 'DOC-READINESS-001',
			ownerMemberId: actor.memberId
		});
		await expect(
			lifecycle.approveLaunch(actor, launchWithoutGovernance.public_id)
		).rejects.toBeInstanceOf(ProductServiceValidationError);

		const launch = await lifecycle.createLaunchPlan(actor, {
			offeringPublicId: offering.public_id,
			developmentPlanPublicId: development.public_id,
			launchCode: `LA${suffix}`,
			title: 'Governed lifecycle assurance launch',
			targetLaunchDate: new Date('2026-10-21T00:00:00.000Z'),
			targetSegments: 'Built-environment operating companies.',
			commercialReadiness: 'Commercial model approved.',
			operationalReadiness: 'Operating team trained.',
			customerReadiness: 'Pilot customers briefed.',
			supportReadiness: 'Support model operational.',
			readinessEvidencePublicId: 'DOC-READINESS-002',
			governanceDecisionPublicId: 'F02-DECISION-LAUNCH-001',
			ownerMemberId: actor.memberId
		});
		await lifecycle.approveLaunch(actor, launch.public_id);
		const launched = await lifecycle.markLaunched(actor, launch.public_id);
		expect(launched.lifecycle_status).toBe('launched');

		const lifecycleReview = await lifecycle.recordLifecycleReview(actor, {
			offeringPublicId: offering.public_id,
			reviewCode: `LR${suffix}`,
			reviewDate: new Date('2027-04-21T00:00:00.000Z'),
			lifecyclePhase: 'maturity',
			performanceSummary: 'Performance is stable but growth has plateaued.',
			customerSummary: 'Customer outcomes are positive with declining new demand.',
			financialSummary: 'Contribution remains positive but is reducing.',
			riskSummary: 'Technology obsolescence is increasing.',
			recommendation: 'retire',
			performanceEvidencePublicId: 'F03-PERFORMANCE-001',
			customerEvidencePublicId: 'CRM-CUSTOMER-001',
			ownerMemberId: actor.memberId
		});
		expect(lifecycleReview.recommendation).toBe('retire');

		const retirementWithoutGovernance = await lifecycle.createRetirementPlan(actor, {
			offeringPublicId: offering.public_id,
			lifecycleReviewPublicId: lifecycleReview.public_id,
			retirementCode: `RG${suffix}`,
			title: 'Lifecycle assurance retirement draft',
			retirementRationale: 'Lifecycle review recommends retirement.',
			customerTransitionPlan: 'Transition customers to the successor service.',
			operationalTransitionPlan: 'Close operating workflows and support obligations.',
			financialImpactSummary: 'Run-off cost is provisioned.',
			dataRecordRetentionPlan: 'Retain governed lifecycle evidence under records policy.',
			targetEndDate: new Date('2027-09-30T00:00:00.000Z'),
			ownerMemberId: actor.memberId
		});
		await expect(
			lifecycle.approveRetirement(actor, retirementWithoutGovernance.public_id)
		).rejects.toBeInstanceOf(ProductServiceValidationError);

		const retirement = await lifecycle.createRetirementPlan(actor, {
			offeringPublicId: offering.public_id,
			lifecycleReviewPublicId: lifecycleReview.public_id,
			retirementCode: `RT${suffix}`,
			title: 'Governed lifecycle assurance retirement',
			retirementRationale: 'Lifecycle review recommends retirement.',
			customerTransitionPlan: 'Transition customers to the successor service.',
			operationalTransitionPlan: 'Close operating workflows and support obligations.',
			financialImpactSummary: 'Run-off cost is provisioned.',
			dataRecordRetentionPlan: 'Retain governed lifecycle evidence under records policy.',
			targetEndDate: new Date('2027-09-30T00:00:00.000Z'),
			governanceDecisionPublicId: 'F02-DECISION-RETIRE-001',
			ownerMemberId: actor.memberId
		});
		await lifecycle.approveRetirement(actor, retirement.public_id);
		const retired = await lifecycle.completeRetirement(actor, retirement.public_id);
		expect(retired.lifecycle_status).toBe('completed');

		const experiment = await lifecycle.createInnovationExperiment(actor, {
			portfolioPublicId: portfolio.public_id,
			ideaPublicId: idea.public_id,
			offeringPublicId: offering.public_id,
			experimentCode: `EX${suffix}`,
			title: 'Successor lifecycle automation experiment',
			hypothesis: 'Automated evidence readiness checks will reduce governance cycle time.',
			experimentMethod: 'Run a controlled pilot against three lifecycle gates.',
			successMeasure: 'Reduce evidence preparation elapsed time by at least 30%.',
			plannedStart: new Date('2027-05-01T00:00:00.000Z'),
			plannedFinish: new Date('2027-06-30T00:00:00.000Z'),
			evidencePublicId: 'DOC-EXPERIMENT-001',
			ownerMemberId: actor.memberId
		});
		const closedExperiment = await lifecycle.closeInnovationExperiment(
			actor,
			experiment.public_id,
			{
				outcome: 'validated',
				learningSummary: 'Automated readiness checks reduced preparation time by 38%.',
				evidencePublicId: 'DOC-EXPERIMENT-RESULT-001'
			}
		);
		expect(closedExperiment.outcome).toBe('validated');
		expect(closedExperiment.lifecycle_status).toBe('completed');

		const workspace = await lifecycle.getWorkspace(actor);
		expect(workspace.designs.some((row) => row.public_id === design.public_id)).toBe(true);
		expect(workspace.developmentPlans.some((row) => row.public_id === development.public_id)).toBe(
			true
		);
		expect(workspace.launchPlans.some((row) => row.public_id === launch.public_id)).toBe(true);
		expect(
			workspace.lifecycleReviews.some((row) => row.public_id === lifecycleReview.public_id)
		).toBe(true);
		expect(workspace.retirementPlans.some((row) => row.public_id === retirement.public_id)).toBe(
			true
		);
		expect(
			workspace.innovationExperiments.some((row) => row.public_id === experiment.public_id)
		).toBe(true);

		const offeringAfterRetirement = await db
			.selectFrom('product_service_offerings')
			.select(['lifecycle_stage', 'lifecycle_status'])
			.where('id', '=', offering.id)
			.executeTakeFirstOrThrow();
		expect(offeringAfterRetirement.lifecycle_stage).toBe('retired');
		expect(offeringAfterRetirement.lifecycle_status).toBe('retired');
	});
});
