import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';
import { getStrategyWorkspace, StrategyAccessError } from './f01-service';

export type StrategyApprovalReadiness = {
	isDraft: boolean;
	canApprove: boolean;
	ready: boolean;
	totalOptionCount: number;
	selectedOptionCount: number;
	activeThemeCount: number;
	activeObjectiveCount: number;
	optionLinkedObjectiveCount: number;
	primaryThemeObjectiveCount: number;
	traceableObjectiveCount: number;
	conflictingApprovedStrategy: { publicId: string; code: string; title: string } | null;
};

type FrameworkRow = RowDataPacket & {
	id: string | number;
	lifecycleStatus: 'draft' | 'approved' | 'superseded';
};

type ReadinessRow = RowDataPacket & {
	totalOptionCount: number | string;
	selectedOptionCount: number | string;
	activeThemeCount: number | string;
	activeObjectiveCount: number | string;
	optionLinkedObjectiveCount: number | string;
	primaryThemeObjectiveCount: number | string;
	traceableObjectiveCount: number | string;
};

type ApprovedFrameworkRow = RowDataPacket & {
	publicId: string;
	code: string;
	title: string;
};

export async function getStrategyApprovalReadiness(input: {
	organisationId: string;
	memberId: string;
	frameworkPublicId: string;
}): Promise<StrategyApprovalReadiness> {
	const workspace = await getStrategyWorkspace({
		organisationId: input.organisationId,
		memberId: input.memberId
	});
	const visibleFramework = workspace.frameworks.find(
		(framework) => framework.publicId === input.frameworkPublicId
	);
	if (!visibleFramework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}

	const [frameworkRows] = await getPool().execute<FrameworkRow[]>(
		`SELECT id, lifecycle_status AS lifecycleStatus
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND public_id = ?
		 LIMIT 1`,
		[input.organisationId, input.frameworkPublicId]
	);
	const framework = frameworkRows[0];
	if (!framework) {
		throw new StrategyAccessError('Strategy cycle was not found in the active organisation.');
	}
	const frameworkId = framework.id.toString();

	const [readinessRows] = await getPool().execute<ReadinessRow[]>(
		`SELECT
		   (SELECT COUNT(*)
		      FROM strategy_options option_record
		     WHERE option_record.organisation_id = ?
		       AND option_record.strategy_framework_id = ?) AS totalOptionCount,
		   (SELECT COUNT(*)
		      FROM strategy_options option_record
		     WHERE option_record.organisation_id = ?
		       AND option_record.strategy_framework_id = ?
		       AND option_record.decision_status = 'selected') AS selectedOptionCount,
		   (SELECT COUNT(*)
		      FROM strategy_themes theme
		     WHERE theme.organisation_id = ?
		       AND theme.strategy_framework_id = ?
		       AND theme.lifecycle_status = 'active') AS activeThemeCount,
		   (SELECT COUNT(*)
		      FROM strategy_objectives objective
		     WHERE objective.organisation_id = ?
		       AND objective.strategy_framework_id = ?
		       AND objective.lifecycle_status = 'active') AS activeObjectiveCount,
		   (SELECT COUNT(DISTINCT objective.id)
		      FROM strategy_objectives objective
		      JOIN strategy_objective_option_links option_link
		        ON option_link.strategy_objective_id = objective.id
		      JOIN strategy_options option_record
		        ON option_record.id = option_link.strategy_option_id
		       AND option_record.decision_status = 'selected'
		     WHERE objective.organisation_id = ?
		       AND objective.strategy_framework_id = ?
		       AND objective.lifecycle_status = 'active') AS optionLinkedObjectiveCount,
		   (SELECT COUNT(DISTINCT objective.id)
		      FROM strategy_objectives objective
		      JOIN strategy_objective_theme_links theme_link
		        ON theme_link.strategy_objective_id = objective.id
		       AND theme_link.relationship_type = 'primary'
		      JOIN strategy_themes theme
		        ON theme.id = theme_link.strategy_theme_id
		       AND theme.lifecycle_status = 'active'
		     WHERE objective.organisation_id = ?
		       AND objective.strategy_framework_id = ?
		       AND objective.lifecycle_status = 'active') AS primaryThemeObjectiveCount,
		   (SELECT COUNT(DISTINCT objective.id)
		      FROM strategy_objectives objective
		      JOIN strategy_objective_option_links option_link
		        ON option_link.strategy_objective_id = objective.id
		      JOIN strategy_options option_record
		        ON option_record.id = option_link.strategy_option_id
		       AND option_record.decision_status = 'selected'
		      JOIN strategy_objective_theme_links theme_link
		        ON theme_link.strategy_objective_id = objective.id
		       AND theme_link.relationship_type = 'primary'
		      JOIN strategy_themes theme
		        ON theme.id = theme_link.strategy_theme_id
		       AND theme.lifecycle_status = 'active'
		     WHERE objective.organisation_id = ?
		       AND objective.strategy_framework_id = ?
		       AND objective.lifecycle_status = 'active') AS traceableObjectiveCount`,
		[
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId,
			input.organisationId,
			frameworkId
		]
	);
	const counts = readinessRows[0];

	const [approvedRows] = await getPool().execute<ApprovedFrameworkRow[]>(
		`SELECT public_id AS publicId,
		        framework_code AS code,
		        title
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND lifecycle_status = 'approved'
		   AND id <> ?
		 ORDER BY approved_at DESC, id DESC
		 LIMIT 1`,
		[input.organisationId, frameworkId]
	);
	const conflictingApprovedStrategy = approvedRows[0] ?? null;

	const totalOptionCount = Number(counts?.totalOptionCount ?? 0);
	const selectedOptionCount = Number(counts?.selectedOptionCount ?? 0);
	const activeThemeCount = Number(counts?.activeThemeCount ?? 0);
	const activeObjectiveCount = Number(counts?.activeObjectiveCount ?? 0);
	const optionLinkedObjectiveCount = Number(counts?.optionLinkedObjectiveCount ?? 0);
	const primaryThemeObjectiveCount = Number(counts?.primaryThemeObjectiveCount ?? 0);
	const traceableObjectiveCount = Number(counts?.traceableObjectiveCount ?? 0);
	const isDraft = framework.lifecycleStatus === 'draft';
	const canApprove = workspace.permissions.canApprove;

	return {
		isDraft,
		canApprove,
		ready:
			isDraft &&
			canApprove &&
			selectedOptionCount > 0 &&
			activeThemeCount > 0 &&
			traceableObjectiveCount > 0 &&
			conflictingApprovedStrategy === null,
		totalOptionCount,
		selectedOptionCount,
		activeThemeCount,
		activeObjectiveCount,
		optionLinkedObjectiveCount,
		primaryThemeObjectiveCount,
		traceableObjectiveCount,
		conflictingApprovedStrategy
	};
}
