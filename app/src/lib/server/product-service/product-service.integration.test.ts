import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProductServiceService } from './product-service-service';

let actor: { organisationId: string; userId: string; memberId: string; correlationId: string };
let unprivilegedActor: {
	organisationId: string;
	userId: string;
	memberId: string;
	correlationId: string;
};

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createMember(organisationId: string, displayName: string) {
	const db = getDatabase();
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: crypto.randomUUID(),
				display_name: displayName,
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
	return { userId, memberId };
}

async function seedActors() {
	const db = getDatabase();
	const suffix = Math.random().toString(36).slice(2, 10);
	const organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: crypto.randomUUID(),
				legal_name: `F05 Test ${suffix}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const privileged = await createMember(organisationId, `F05 Owner ${suffix}`);
	const unprivileged = await createMember(organisationId, `F05 Observer ${suffix}`);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: crypto.randomUUID(),
				name: `F05 owner ${suffix}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissionRows = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [
			'product_service.view',
			'product_service.manage',
			'product_service.approve'
		])
		.where('is_active', '=', 1)
		.execute();
	expect(permissionRows.map((row) => row.permission_key).sort()).toEqual([
		'product_service.approve',
		'product_service.manage',
		'product_service.view'
	]);
	await db
		.insertInto('role_permissions')
		.values(
			permissionRows.map((permission) => ({
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
			organisation_member_id: privileged.memberId,
			organisation_role_id: roleId
		})
		.executeTakeFirstOrThrow();

	actor = {
		organisationId,
		userId: privileged.userId,
		memberId: privileged.memberId,
		correlationId: crypto.randomUUID()
	};
	unprivilegedActor = {
		organisationId,
		userId: unprivileged.userId,
		memberId: unprivileged.memberId,
		correlationId: crypto.randomUUID()
	};
}

describe('F05 product, service and innovation management', () => {
	beforeAll(async () => {
		await seedActors();
	});

	beforeEach(() => {
		actor.correlationId = crypto.randomUUID();
		unprivilegedActor.correlationId = crypto.randomUUID();
	});

	it('executes the governed F05.01-F05.04 control thread', async () => {
		const db = getDatabase();
		const service = new ProductServiceService(db);
		const portfolio = await service.createPortfolio(actor, {
			portfolioCode: `PORT-${Date.now()}`,
			title: 'Connected built-environment services',
			portfolioType: 'mixed',
			strategicThesis: 'Create a scalable portfolio of connected construction and asset services.',
			ownerMemberId: actor.memberId,
			priority: 'high',
			strategyObjectivePublicId: 'F01-OBJECTIVE-001',
			strategyKpiPublicId: 'F01-KPI-001',
			performanceEvidencePublicId: 'F03-EVIDENCE-001'
		});
		expect(portfolio.lifecycle_status).toBe('active');

		const offering = await service.createOffering(actor, {
			portfolioPublicId: portfolio.public_id,
			offeringCode: 'OFFER-001',
			title: 'Connected handover service',
			offeringType: 'service',
			valueProposition:
				'Reduce handover friction through a governed digital asset-information service.',
			ownerMemberId: actor.memberId
		});
		expect(offering.lifecycle_stage).toBe('concept');

		const need = await service.createNeed(actor, {
			portfolioPublicId: portfolio.public_id,
			needCode: 'NEED-001',
			title: 'Faster asset-information handover',
			needType: 'customer',
			needStatement: 'Customers need verified asset information available at practical completion.',
			sourceDomain: 'crm',
			sourceRecordType: 'customer_interview',
			sourcePublicId: 'CRM-INTERVIEW-001',
			sourceReference: 'Voice-of-customer evidence pack',
			customerOrMarketSegment: 'Tier-one property owners',
			evidenceStrength: 'validated',
			urgency: 'high',
			ownerMemberId: actor.memberId
		});
		expect(need.source_domain).toBe('crm');
		expect(need.evidence_strength).toBe('validated');

		const idea = await service.createIdea(actor, {
			portfolioPublicId: portfolio.public_id,
			needPublicId: need.public_id,
			ideaCode: 'IDEA-001',
			title: 'Digital handover assurance service',
			ideaType: 'new_service',
			problemStatement: 'Handover data is fragmented, late and difficult to verify.',
			proposedValue: 'Provide governed readiness checks and a verified digital handover package.',
			provenance: 'customer_need',
			sourceReference: 'Voice-of-customer evidence pack',
			ownerMemberId: actor.memberId
		});
		expect(idea.stage).toBe('submitted');

		const scoredIdea = await service.scoreIdea(actor, idea.public_id, {
			strategicFit: 90,
			customerValue: 80,
			feasibility: 70,
			commercialValue: 60,
			risk: 20
		});
		expect(scoredIdea.stage).toBe('triage');
		expect(scoredIdea.overall_score).toBe('76.0000');

		const businessCaseV1 = await service.createBusinessCase(actor, {
			ideaPublicId: idea.public_id,
			offeringPublicId: offering.public_id,
			businessCaseCode: 'CASE-001',
			title: 'Digital handover assurance investment case',
			currencyCode: 'GBP',
			investmentCost: '150000',
			annualOperatingCost: '80000',
			annualRevenueOrValue: '400000',
			expectedBenefitValue: '250000',
			paybackMonths: 9,
			riskSummary: 'Adoption and integration risks require staged validation.',
			recommendation: 'Proceed to controlled design and development.',
			strategyObjectivePublicId: 'F01-OBJECTIVE-001',
			performanceBenefitPublicId: 'F03-BENEFIT-001'
		});
		expect(businessCaseV1.version_number).toBe(1);
		const approvedV1 = await service.approveBusinessCase(actor, businessCaseV1.public_id);
		expect(approvedV1.lifecycle_status).toBe('approved');

		const businessCaseV2 = await service.createBusinessCase(actor, {
			ideaPublicId: idea.public_id,
			offeringPublicId: offering.public_id,
			businessCaseCode: 'CASE-001',
			title: 'Digital handover assurance investment case — revised',
			currencyCode: 'GBP',
			investmentCost: '165000',
			annualOperatingCost: '85000',
			annualRevenueOrValue: '430000',
			expectedBenefitValue: '265000',
			paybackMonths: 10,
			riskSummary: 'Pilot evidence has reduced adoption uncertainty.',
			recommendation: 'Proceed with the revised investment case.',
			strategyObjectivePublicId: 'F01-OBJECTIVE-001',
			performanceBenefitPublicId: 'F03-BENEFIT-001'
		});
		expect(businessCaseV2.version_number).toBe(2);
		expect(businessCaseV2.supersedes_business_case_id).toBe(businessCaseV1.id);
		await service.approveBusinessCase(actor, businessCaseV2.public_id);

		const predecessor = await db
			.selectFrom('product_service_business_cases')
			.select('lifecycle_status')
			.where('id', '=', businessCaseV1.id)
			.executeTakeFirstOrThrow();
		expect(predecessor.lifecycle_status).toBe('superseded');

		const workspace = await service.getWorkspace(actor);
		expect(workspace.canManage).toBe(true);
		expect(workspace.canApprove).toBe(true);
		expect(workspace.portfolios.some((row) => row.public_id === portfolio.public_id)).toBe(true);
		expect(workspace.offerings.some((row) => row.public_id === offering.public_id)).toBe(true);
		expect(workspace.needs.some((row) => row.public_id === need.public_id)).toBe(true);
		expect(workspace.ideas.some((row) => row.public_id === idea.public_id)).toBe(true);
		expect(
			workspace.businessCases.filter((row) => row.business_case_code === 'CASE-001')
		).toHaveLength(2);

		const auditCount = await db
			.selectFrom('audit_events')
			.select(({ fn }) => fn.countAll<number>().as('count'))
			.where('acting_organisation_id', '=', actor.organisationId)
			.where('action_key', 'like', 'product_service.%')
			.executeTakeFirstOrThrow();
		expect(Number(auditCount.count)).toBeGreaterThanOrEqual(8);
	});

	it('fails closed without F05 permissions', async () => {
		await expect(
			new ProductServiceService(getDatabase()).getWorkspace(unprivilegedActor)
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('rejects a tenant context that does not match the active member', async () => {
		await expect(
			new ProductServiceService(getDatabase()).getWorkspace({
				...actor,
				organisationId: '999999999',
				correlationId: crypto.randomUUID()
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
