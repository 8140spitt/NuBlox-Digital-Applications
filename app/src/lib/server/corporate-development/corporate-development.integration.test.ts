import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getDatabase } from '$lib/server/db/database';
import {
	CorporateDevelopmentLifecycleService,
	CorporateDevelopmentLifecycleValidationError
} from './corporate-development-lifecycle-service';
import { CorporateDevelopmentService } from './corporate-development-service';

let actor: { organisationId: string; userId: string; memberId: string; correlationId: string };

async function seedActor() {
	const db = getDatabase();
	const suffix = Math.random().toString(36).slice(2, 10);
	const organisationPublicId = crypto.randomUUID();
	const userPublicId = crypto.randomUUID();
	await db
		.insertInto('organisations')
		.values({
			public_id: organisationPublicId,
			name: `F04 Test ${suffix}`,
			slug: `f04-${suffix}`,
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const organisation = await db
		.selectFrom('organisations')
		.selectAll()
		.where('public_id', '=', organisationPublicId)
		.executeTakeFirstOrThrow();
	await db
		.insertInto('users')
		.values({
			public_id: userPublicId,
			email: `f04-${suffix}@example.test`,
			display_name: 'F04 Owner',
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const user = await db
		.selectFrom('users')
		.selectAll()
		.where('public_id', '=', userPublicId)
		.executeTakeFirstOrThrow();
	await db
		.insertInto('organisation_members')
		.values({
			public_id: crypto.randomUUID(),
			organisation_id: organisation.id,
			user_id: user.id,
			status: 'active'
		})
		.executeTakeFirstOrThrow();
	const member = await db
		.selectFrom('organisation_members')
		.selectAll()
		.where('organisation_id', '=', organisation.id)
		.where('user_id', '=', user.id)
		.executeTakeFirstOrThrow();
	actor = {
		organisationId: organisation.id,
		userId: user.id,
		memberId: member.id,
		correlationId: crypto.randomUUID()
	};
	const permissionRows = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', ['strategy.view', 'strategy.manage', 'strategy.approve'])
		.execute();
	for (const permission of permissionRows) {
		await db
			.insertInto('member_permission_overrides')
			.values({
				organisation_member_id: actor.memberId,
				permission_id: permission.id,
				effect: 'allow',
				created_by_user_id: actor.userId
			})
			.executeTakeFirst();
	}
}

describe('F04 corporate development', () => {
	beforeAll(async () => {
		await seedActor();
	});
	beforeEach(() => {
		actor.correlationId = crypto.randomUUID();
	});

	it('executes the governed F04.01-F04.07 control thread', async () => {
		const db = getDatabase();
		const core = new CorporateDevelopmentService(db);
		const lifecycle = new CorporateDevelopmentLifecycleService(db);
		const opportunity = await core.createOpportunity(actor, {
			opportunityCode: `F04-${Date.now()}`,
			title: 'Strategic acquisition',
			dealType: 'acquisition',
			targetName: 'Target Ltd',
			strategicThesis: 'Acquire differentiated capability.',
			strategicRationale: 'Accelerate strategic outcomes.',
			ownerMemberId: actor.memberId,
			priority: 'high',
			identifiedOn: '2026-09-10',
			targetSourceDomain: 'crm',
			targetSourceRecordType: 'organisation',
			targetSourcePublicId: crypto.randomUUID()
		});
		expect(opportunity.pipeline_stage).toBe('identified');

		const valuationV1 = await core.createValuation(actor, {
			opportunityPublicId: opportunity.public_id,
			valuationCode: 'VAL-01',
			title: 'Base investment case',
			valuationDate: '2026-09-10',
			currencyCode: 'GBP',
			primaryMethod: 'dcf',
			enterpriseValueLow: '9000000',
			enterpriseValueBase: '10000000',
			enterpriseValueHigh: '11000000',
			recommendation: 'Proceed to diligence.'
		});
		await core.approveValuation(actor, valuationV1.public_id);
		const valuationV2 = await core.createValuation(actor, {
			opportunityPublicId: opportunity.public_id,
			valuationCode: 'VAL-01',
			title: 'Revised investment case',
			valuationDate: '2026-09-11',
			currencyCode: 'GBP',
			primaryMethod: 'dcf',
			enterpriseValueBase: '10500000',
			recommendation: 'Proceed with revised value.'
		});
		expect(valuationV2.version_number).toBe(2);
		expect(valuationV2.supersedes_valuation_id).toBe(valuationV1.id);
		await core.approveValuation(actor, valuationV2.public_id);
		const priorValuation = await db
			.selectFrom('corporate_development_valuations')
			.select('lifecycle_status')
			.where('id', '=', valuationV1.id)
			.executeTakeFirstOrThrow();
		expect(priorValuation.lifecycle_status).toBe('superseded');
		const coreWorkspace = await core.getWorkspace(actor, opportunity.public_id);
		expect(coreWorkspace.stageHistory.at(-1)?.to_stage).toBe('valuation');

		const diligence = await lifecycle.createDiligenceWorkstream(actor, {
			opportunityPublicId: opportunity.public_id,
			workstreamCode: 'DD-FIN',
			title: 'Finance and tax diligence',
			diligenceDomain: 'finance_tax',
			scopeText: 'Validate earnings quality, tax exposures and working capital.',
			leadMemberId: actor.memberId
		});
		await lifecycle.createDiligenceRequest(actor, {
			workstreamPublicId: diligence.public_id,
			requestCode: 'REQ-001',
			title: 'Quality of earnings evidence',
			requestText: 'Provide reconciled quality of earnings evidence.',
			ownerMemberId: actor.memberId,
			materiality: 'high',
			requestedOn: '2026-09-10',
			dueDate: '2026-09-15'
		});
		await lifecycle.createDiligenceFinding(actor, {
			workstreamPublicId: diligence.public_id,
			findingCode: 'FIND-001',
			title: 'Working-capital seasonality',
			findingCategory: 'risk',
			severity: 'high',
			findingText: 'Working capital has material seasonal variation.',
			impactText: 'Completion accounts mechanism requires protection.',
			recommendationText: 'Use a normalised working-capital peg.',
			ownerMemberId: actor.memberId,
			transactionImplication: 'Reflect in SPA completion accounts.'
		});

		const transactionWithoutApproval = await lifecycle.createTransaction(actor, {
			opportunityPublicId: opportunity.public_id,
			transactionCode: 'TX-DRAFT',
			title: 'Unapproved transaction proof',
			transactionType: 'acquisition',
			transactionStructure: 'Share purchase',
			currencyCode: 'GBP',
			considerationValue: '10000000'
		});
		await expect(
			lifecycle.closeTransaction(actor, transactionWithoutApproval.public_id)
		).rejects.toBeInstanceOf(CorporateDevelopmentLifecycleValidationError);
		const transaction = await lifecycle.createTransaction(actor, {
			opportunityPublicId: opportunity.public_id,
			transactionCode: 'TX-001',
			title: 'Target acquisition',
			transactionType: 'acquisition',
			transactionStructure: 'Share purchase',
			currencyCode: 'GBP',
			considerationValue: '10500000',
			governanceDecisionPublicId: 'GOV-DECISION-001',
			delegationAuthorityPublicId: 'DOA-001'
		});
		const closed = await lifecycle.closeTransaction(actor, transaction.public_id);
		expect(closed.lifecycle_status).toBe('closed');

		const integration = await lifecycle.createIntegrationPlan(actor, {
			opportunityPublicId: opportunity.public_id,
			transactionPublicId: transaction.public_id,
			integrationCode: 'INT-001',
			title: 'Target integration',
			integrationThesis: 'Protect revenue while integrating core capabilities.',
			dayOneOutcomes: 'People, customer and operational continuity secured.',
			dayOneHundredOutcomes: 'Operating model transitioned and synergies mobilised.',
			targetOperatingModelOutcomes: 'Target capability embedded in the NuBlox operating model.',
			ownerMemberId: actor.memberId,
			performanceBenefitPublicId: 'F03-BENEFIT-001'
		});
		expect(integration.performance_benefit_public_id).toBe('F03-BENEFIT-001');

		const divestiture = await lifecycle.createDivestiturePlan(actor, {
			opportunityPublicId: opportunity.public_id,
			divestitureCode: 'DIV-001',
			title: 'Carve-out readiness scenario',
			perimeterText: 'Defined legal entity, people, systems and contract perimeter.',
			separationStrategy: 'Controlled separation supported by transition services.',
			ownerMemberId: actor.memberId,
			buyerName: 'Buyer Ltd'
		});
		expect(divestiture.lifecycle_status).toBe('planning');

		const draftPartnership = await lifecycle.createPartnership(actor, {
			opportunityPublicId: opportunity.public_id,
			partnershipCode: 'PART-DRAFT',
			title: 'Unapproved alliance',
			partnerName: 'Partner A',
			partnershipType: 'strategic_alliance',
			objectivesText: 'Joint market development.',
			commercialStructure: 'Shared opportunity economics.',
			governanceText: 'Quarterly steering committee.',
			ownerMemberId: actor.memberId,
			effectiveFrom: '2026-10-01',
			reviewCadence: 'quarterly'
		});
		await expect(
			lifecycle.activatePartnership(actor, draftPartnership.public_id)
		).rejects.toBeInstanceOf(CorporateDevelopmentLifecycleValidationError);
		const partnership = await lifecycle.createPartnership(actor, {
			opportunityPublicId: opportunity.public_id,
			partnershipCode: 'PART-001',
			title: 'Strategic capability alliance',
			partnerName: 'Partner B',
			partnershipType: 'strategic_alliance',
			objectivesText: 'Accelerate strategic capability access.',
			commercialStructure: 'Governed shared-value model.',
			governanceText: 'Executive steering committee with quarterly review.',
			ownerMemberId: actor.memberId,
			effectiveFrom: '2026-10-01',
			reviewCadence: 'quarterly',
			governanceDecisionPublicId: 'GOV-DECISION-002'
		});
		const activePartnership = await lifecycle.activatePartnership(actor, partnership.public_id);
		expect(activePartnership.lifecycle_status).toBe('active');

		const workspace = await lifecycle.getWorkspace(actor, opportunity.public_id);
		expect(workspace.diligenceWorkstreams).toHaveLength(1);
		expect(workspace.diligenceRequests).toHaveLength(1);
		expect(workspace.diligenceFindings).toHaveLength(1);
		expect(workspace.integrationPlans).toHaveLength(1);
		expect(workspace.divestiturePlans).toHaveLength(1);
		expect(workspace.partnerships.length).toBeGreaterThanOrEqual(2);
	});
});
