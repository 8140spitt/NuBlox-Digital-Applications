import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import {
	appendGovernedVersion,
	markPublishedVersionHistorical
} from '$lib/server/platform/governed-versioning';
import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';
import {
	assertF01LifecycleTransition,
	decideF01LifecyclePermission
} from './f01-lifecycle-resolver';

type PlanRow = RowDataPacket & {
	id: string | number;
	publicId: string;
	code: string;
	versionNumber: number | string;
	minorVersionNumber: number | string;
	title: string;
	periodStart: Date | string;
	periodEnd: Date | string;
	narrative: string;
	currencyCode: string;
	plannedRevenueAmount: string | number;
	plannedOpexAmount: string | number;
	plannedCapexAmount: string | number;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
	supersedesBusinessPlanId: string | number | null;
	objectiveCount: number | string;
	initiativeCount: number | string;
	orphanRequirementCount: number | string;
};

async function lockPlan(
	connection: PoolConnection,
	organisationId: string,
	frameworkPublicId: string,
	planPublicId: string
): Promise<PlanRow> {
	const [rows] = await connection.execute<PlanRow[]>(
		`SELECT plan.id,
		        plan.public_id AS publicId,
		        plan.plan_code AS code,
		        plan.version_number AS versionNumber,
		        plan.minor_version_number AS minorVersionNumber,
		        plan.title,
		        plan.period_start AS periodStart,
		        plan.period_end AS periodEnd,
		        plan.narrative,
		        plan.currency_code AS currencyCode,
		        plan.planned_revenue_amount AS plannedRevenueAmount,
		        plan.planned_opex_amount AS plannedOpexAmount,
		        plan.planned_capex_amount AS plannedCapexAmount,
		        plan.lifecycle_status AS lifecycleStatus,
		        plan.supersedes_business_plan_id AS supersedesBusinessPlanId,
		        (SELECT COUNT(*)
		           FROM strategy_business_plan_objective_links objective_link
		          WHERE objective_link.strategy_business_plan_id = plan.id) AS objectiveCount,
		        (SELECT COUNT(*)
		           FROM strategy_initiatives initiative
		          WHERE initiative.strategy_business_plan_id = plan.id
		            AND initiative.lifecycle_status <> 'cancelled') AS initiativeCount,
		        (SELECT COUNT(*)
		           FROM strategy_initiative_resource_requirements requirement
		           JOIN strategy_initiatives initiative
		             ON initiative.id = requirement.strategy_initiative_id
		          WHERE initiative.strategy_business_plan_id = plan.id
		            AND requirement.lifecycle_status = 'identified'
		            AND NOT EXISTS (
		                SELECT 1
		                  FROM strategy_initiative_handoffs handoff
		                 WHERE handoff.strategy_resource_requirement_id = requirement.id
		                   AND handoff.lifecycle_status <> 'cancelled'
		            )) AS orphanRequirementCount
		 FROM strategy_business_plans plan
		 JOIN strategy_frameworks framework ON framework.id = plan.strategy_framework_id
		 WHERE plan.organisation_id = ?
		   AND plan.public_id = ?
		   AND framework.organisation_id = ?
		   AND framework.public_id = ?
		   AND framework.lifecycle_status = 'approved'
		 LIMIT 1
		 FOR UPDATE`,
		[organisationId, planPublicId, organisationId, frameworkPublicId]
	);
	const plan = rows[0];
	if (!plan) {
		throw new StrategyValidationError(
			'Business plan is not available under the approved strategy version.'
		);
	}
	return plan;
}

export async function approveStrategyBusinessPlan(
	input: {
		actor: EvidenceActor;
		frameworkPublicId: string;
		planPublicId: string;
	},
	transactionConnection?: PoolConnection
): Promise<void> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId
	});
	const framework = workspace.frameworks.find((item) => item.publicId === input.frameworkPublicId);
	if (!framework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}
	const transition = await assertF01LifecycleTransition(
		input.actor.organisationId,
		'plan',
		'draft',
		'approved'
	);
	const approvalAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: 'plan',
		state: 'draft',
		permissionKey: transition.requiredPermissionKey ?? 'strategy.approve'
	});
	if (!approvalAuthority.allowed) {
		throw new StrategyAccessError(
			'You do not have authority to approve enterprise business plans.'
		);
	}
	if (framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Business-plan approval requires an approved governing strategy.'
		);
	}

	const connection = transactionConnection ?? (await getPool().getConnection());
	const ownsTransaction = transactionConnection === undefined;
	try {
		if (ownsTransaction) await connection.beginTransaction();
		const plan = await lockPlan(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId,
			input.planPublicId
		);
		if (plan.lifecycleStatus !== 'draft') {
			throw new StrategyValidationError('Only a draft business plan can be approved.');
		}
		if (Number(plan.objectiveCount) < 1) {
			throw new StrategyValidationError(
				'Business-plan approval requires at least one linked strategic objective.'
			);
		}
		if (Number(plan.initiativeCount) < 1) {
			throw new StrategyValidationError(
				'Business-plan approval requires at least one active strategic initiative.'
			);
		}
		if (Number(plan.orphanRequirementCount) > 0) {
			throw new StrategyValidationError(
				'Every identified resource requirement must be handed to its authoritative business function before the business plan can be approved.'
			);
		}

		const [approvedRows] = await connection.execute<
			(RowDataPacket & { id: string | number; publicId: string; versionNumber: number | string })[]
		>(
			`SELECT id, public_id AS publicId, version_number AS versionNumber
			 FROM strategy_business_plans
			 WHERE organisation_id = ?
			   AND strategy_framework_id = (SELECT strategy_framework_id FROM strategy_business_plans WHERE id = ?)
			   AND plan_code = ?
			   AND lifecycle_status = 'approved'
			   AND id <> ?
			 LIMIT 1 FOR UPDATE`,
			[input.actor.organisationId, plan.id, plan.code, plan.id]
		);
		const previousApproved = approvedRows[0] ?? null;
		if (previousApproved) {
			if (plan.supersedesBusinessPlanId?.toString() !== previousApproved.id.toString()) {
				throw new StrategyValidationError(
					'An approved version of this business plan already exists. Approve only a controlled revision of the current version.'
				);
			}
			await connection.execute(
				`UPDATE strategy_business_plans SET lifecycle_status = 'superseded' WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,
				[input.actor.organisationId, previousApproved.id]
			);
			await markPublishedVersionHistorical(connection, {
				organisationId: input.actor.organisationId,
				domainCode: 'F01',
				recordType: 'strategy_business_plan',
				lineageKey: plan.code,
				majorVersion: Number(previousApproved.versionNumber)
			});
		} else if (plan.supersedesBusinessPlanId) {
			throw new StrategyValidationError(
				'The business-plan revision is stale because its predecessor is no longer the current approved version.'
			);
		}

		await connection.execute(
			`UPDATE strategy_business_plans
			 SET lifecycle_status = 'approved',
			     minor_version_number = 0,
			     approved_by_member_id = ?,
			     approved_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ?
			   AND id = ?
			   AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, plan.id]
		);
		await connection.execute(
			`UPDATE strategy_initiatives
			 SET lifecycle_status = 'approved'
			 WHERE organisation_id = ?
			   AND strategy_business_plan_id = ?
			   AND lifecycle_status = 'proposed'`,
			[input.actor.organisationId, plan.id]
		);

		await appendGovernedVersion(connection, {
			actor: input.actor,
			domainCode: 'F01',
			recordType: 'strategy_business_plan',
			lineageKey: plan.code,
			recordPublicId: plan.publicId,
			versionNumber: Number(plan.versionNumber),
			minorVersionNumber: 0,
			lifecycleStatus: 'approved',
			snapshot: {
				title: plan.title,
				periodStart: plan.periodStart,
				periodEnd: plan.periodEnd,
				narrative: plan.narrative,
				currencyCode: plan.currencyCode,
				plannedRevenueAmount: plan.plannedRevenueAmount,
				plannedOpexAmount: plan.plannedOpexAmount,
				plannedCapexAmount: plan.plannedCapexAmount,
				lifecycleStatus: 'approved'
			},
			changeNote: 'Approved business plan',
			published: true
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.business-plan.approve',
			subjectType: 'strategy_business_plan',
			subjectPublicId: plan.publicId,
			changeSummary: {
				planCode: plan.code,
				lifecycleStatus: 'approved',
				versionLabel: `${Number(plan.versionNumber)}.0`,
				objectiveCount: Number(plan.objectiveCount),
				initiativeCount: Number(plan.initiativeCount),
				orphanRequirementCount: 0,
				supersededBusinessPlanPublicId: previousApproved?.publicId ?? null
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.04'] }
		});
		if (ownsTransaction) await connection.commit();
	} catch (error) {
		if (ownsTransaction) await connection.rollback();
		throw error;
	} finally {
		if (ownsTransaction) connection.release();
	}
}
