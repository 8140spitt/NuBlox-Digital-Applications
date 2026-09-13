import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import { getStrategyWorkspace, StrategyAccessError, StrategyValidationError } from './f01-service';

type PlanRow = RowDataPacket & {
	id: string | number;
	publicId: string;
	code: string;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
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
		        plan.lifecycle_status AS lifecycleStatus,
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

export async function approveStrategyBusinessPlan(input: {
	actor: EvidenceActor;
	frameworkPublicId: string;
	planPublicId: string;
}): Promise<void> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId
	});
	const framework = workspace.frameworks.find((item) => item.publicId === input.frameworkPublicId);
	if (!framework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}
	if (!workspace.permissions.canApprove) {
		throw new StrategyAccessError(
			'You do not have authority to approve enterprise business plans.'
		);
	}
	if (framework.lifecycleStatus !== 'approved') {
		throw new StrategyValidationError(
			'Business-plan approval requires an approved governing strategy.'
		);
	}

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
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

		await connection.execute(
			`UPDATE strategy_business_plans
			 SET lifecycle_status = 'approved',
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

		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.business-plan.approve',
			subjectType: 'strategy_business_plan',
			subjectPublicId: plan.publicId,
			changeSummary: {
				planCode: plan.code,
				lifecycleStatus: 'approved',
				objectiveCount: Number(plan.objectiveCount),
				initiativeCount: Number(plan.initiativeCount),
				orphanRequirementCount: 0
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.04'] }
		});
		await connection.commit();
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
