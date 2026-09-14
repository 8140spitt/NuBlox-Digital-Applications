import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
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

type FrameworkRow = RowDataPacket & {
	id: string | number;
	publicId: string;
	code: string;
	versionNumber: number | string;
	minorVersionNumber: number | string;
	title: string;
	horizonStart: Date | string;
	horizonEnd: Date | string;
	purpose: string;
	vision: string;
	mission: string;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
	supersedesFrameworkId: string | number | null;
};

async function lockFramework(
	connection: PoolConnection,
	organisationId: string,
	frameworkPublicId: string
): Promise<FrameworkRow> {
	const [rows] = await connection.execute<FrameworkRow[]>(
		`SELECT id,
		        public_id AS publicId,
		        framework_code AS code,
		        version_number AS versionNumber,
		        minor_version_number AS minorVersionNumber,
		        title,
		        horizon_start AS horizonStart,
		        horizon_end AS horizonEnd,
		        purpose_text AS purpose,
		        vision_text AS vision,
		        mission_text AS mission,
		        lifecycle_status AS lifecycleStatus,
		        supersedes_strategy_framework_id AS supersedesFrameworkId
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND public_id = ?
		 LIMIT 1
		 FOR UPDATE`,
		[organisationId, frameworkPublicId]
	);
	const framework = rows[0];
	if (!framework)
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	return framework;
}

async function countApprovalCandidateObjectives(
	connection: PoolConnection,
	organisationId: string,
	frameworkId: string
): Promise<number> {
	const [rows] = await connection.execute<(RowDataPacket & { objectiveCount: number | string })[]>(
		`SELECT COUNT(DISTINCT objective.id) AS objectiveCount
		 FROM strategy_objectives objective
		 JOIN strategy_objective_option_links option_link
		   ON option_link.strategy_objective_id = objective.id
		 JOIN strategy_options option_record
		   ON option_record.id = option_link.strategy_option_id
		  AND option_record.decision_status = 'selected'
		 JOIN strategy_objective_theme_links theme_link
		   ON theme_link.strategy_objective_id = objective.id
		  AND theme_link.relationship_type = 'primary'
		 WHERE objective.organisation_id = ?
		   AND objective.strategy_framework_id = ?
		   AND objective.lifecycle_status IN ('draft', 'active')`,
		[organisationId, frameworkId]
	);
	return Number(rows[0]?.objectiveCount ?? 0);
}

async function findOtherApprovedFramework(
	connection: PoolConnection,
	organisationId: string,
	frameworkId: string
): Promise<{ id: string; publicId: string; code: string; versionNumber: number } | null> {
	const [rows] = await connection.execute<
		(RowDataPacket & {
			id: string | number;
			publicId: string;
			code: string;
			versionNumber: number | string;
		})[]
	>(
		`SELECT id, public_id AS publicId, framework_code AS code, version_number AS versionNumber
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND lifecycle_status = 'approved'
		   AND id <> ?
		 ORDER BY approved_at DESC, id DESC
		 LIMIT 1
		 FOR UPDATE`,
		[organisationId, frameworkId]
	);
	const row = rows[0];
	return row
		? {
				id: row.id.toString(),
				publicId: row.publicId,
				code: row.code,
				versionNumber: Number(row.versionNumber)
			}
		: null;
}

export async function approveStrategyFramework(
	input: {
		actor: EvidenceActor;
		frameworkPublicId: string;
	},
	transactionConnection?: PoolConnection
): Promise<void> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId
	});
	const visibleFramework = workspace.frameworks.find(
		(framework) => framework.publicId === input.frameworkPublicId
	);
	if (!visibleFramework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}
	if (visibleFramework.lifecycleStatus !== 'draft') {
		throw new StrategyValidationError('Only a draft strategy version can be approved.');
	}
	const transition = await assertF01LifecycleTransition(
		input.actor.organisationId,
		'framework',
		'draft',
		'approved'
	);
	const approvalAuthority = await decideF01LifecyclePermission({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId,
		kind: 'framework',
		state: 'draft',
		permissionKey: transition.requiredPermissionKey ?? 'strategy.approve'
	});
	if (!approvalAuthority.allowed) {
		throw new StrategyAccessError('You do not have authority to approve enterprise strategy.');
	}

	const connection = transactionConnection ?? (await getPool().getConnection());
	const ownsTransaction = transactionConnection === undefined;
	try {
		if (ownsTransaction) await connection.beginTransaction();
		const framework = await lockFramework(
			connection,
			input.actor.organisationId,
			input.frameworkPublicId
		);
		if (framework.lifecycleStatus !== 'draft') {
			throw new StrategyValidationError('Only a draft strategy version can be approved.');
		}

		const approvalCandidateObjectiveCount = await countApprovalCandidateObjectives(
			connection,
			input.actor.organisationId,
			framework.id.toString()
		);
		if (approvalCandidateObjectiveCount < 1) {
			throw new StrategyValidationError(
				'Strategy approval requires at least one objective with selected-option lineage and a primary strategic theme. Draft objectives become active when the strategy is approved.'
			);
		}

		const existingApproved = await findOtherApprovedFramework(
			connection,
			input.actor.organisationId,
			framework.id.toString()
		);
		if (existingApproved) {
			if (framework.supersedesFrameworkId?.toString() !== existingApproved.id) {
				throw new StrategyValidationError(
					`An approved strategy (${existingApproved.code}) already exists. Only its controlled revision can replace the current enterprise direction.`
				);
			}
			await connection.execute(
				`UPDATE strategy_frameworks
				 SET lifecycle_status = 'superseded'
				 WHERE organisation_id = ? AND id = ? AND lifecycle_status = 'approved'`,
				[input.actor.organisationId, existingApproved.id]
			);
			await markPublishedVersionHistorical(connection, {
				organisationId: input.actor.organisationId,
				domainCode: 'F01',
				recordType: 'strategy_framework',
				lineageKey: framework.code,
				majorVersion: existingApproved.versionNumber
			});
		} else if (framework.supersedesFrameworkId) {
			throw new StrategyValidationError(
				'The strategy revision is stale because its predecessor is no longer the current approved strategy.'
			);
		}

		const [activationResult] = await connection.execute<ResultSetHeader>(
			`UPDATE strategy_objectives
			 SET lifecycle_status = 'active'
			 WHERE organisation_id = ?
			   AND strategy_framework_id = ?
			   AND lifecycle_status = 'draft'`,
			[input.actor.organisationId, framework.id]
		);

		await connection.execute(
			`UPDATE strategy_frameworks
			 SET lifecycle_status = 'approved',
			     minor_version_number = 0,
			     approved_by_member_id = ?,
			     approved_at = CURRENT_TIMESTAMP(6)
			 WHERE organisation_id = ?
			   AND id = ?
			   AND lifecycle_status = 'draft'`,
			[input.actor.memberId, input.actor.organisationId, framework.id]
		);

		await appendGovernedVersion(connection, {
			actor: input.actor,
			domainCode: 'F01',
			recordType: 'strategy_framework',
			lineageKey: framework.code,
			recordPublicId: framework.publicId,
			versionNumber: Number(framework.versionNumber),
			minorVersionNumber: 0,
			lifecycleStatus: 'approved',
			snapshot: {
				title: framework.title,
				horizonStart: framework.horizonStart,
				horizonEnd: framework.horizonEnd,
				purpose: framework.purpose,
				vision: framework.vision,
				mission: framework.mission,
				lifecycleStatus: 'approved'
			},
			changeNote: 'Approved strategic direction',
			published: true
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.framework.approve',
			subjectType: 'strategy_framework',
			subjectPublicId: framework.publicId,
			changeSummary: {
				frameworkCode: framework.code,
				lifecycleStatus: 'approved',
				versionLabel: `${Number(framework.versionNumber)}.0`,
				traceableObjectiveCount: approvalCandidateObjectiveCount,
				activatedDraftObjectiveCount: activationResult.affectedRows,
				supersededFrameworkPublicId: existingApproved?.publicId ?? null
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.03', 'F01.04'] }
		});

		if (ownsTransaction) await connection.commit();
	} catch (error) {
		if (ownsTransaction) await connection.rollback();
		throw error;
	} finally {
		if (ownsTransaction) connection.release();
	}
}
