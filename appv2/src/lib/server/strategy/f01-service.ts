import { randomUUID } from 'node:crypto';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { decidePermissions } from '$lib/server/auth/permission-service';
import { getPool } from '$lib/server/db/pool';
import { appendDomainEvidence, type EvidenceActor } from '$lib/server/platform/evidence';
import {
	appendGovernedVersion,
	governedVersionCoordinates
} from '$lib/server/platform/governed-versioning';

const STRATEGY_PERMISSIONS = ['strategy.view', 'strategy.manage', 'strategy.approve'] as const;

export type StrategyLifecycleStatus = 'draft' | 'approved' | 'superseded';

export type StrategyFrameworkSummary = {
	publicId: string;
	code: string;
	versionNumber: number;
	minorVersionNumber: number;
	versionLabel: string;
	versionStage: 'draft' | 'published' | 'historical';
	title: string;
	horizonStart: string;
	horizonEnd: string;
	purpose: string;
	vision: string;
	mission: string | null;
	lifecycleStatus: StrategyLifecycleStatus;
	isOwnedByCurrentMember: boolean;
	objectiveCount: number;
	environmentFactorCount: number;
	businessPlanCount: number;
	initiativeCount: number;
	operatingModelComponentCount: number;
	kpiCount: number;
	reviewCount: number;
	scenarioCount: number;
};

export type StrategyPermissionFlags = {
	canView: boolean;
	canManage: boolean;
	canApprove: boolean;
};

export type StrategyWorkspace = {
	permissions: StrategyPermissionFlags;
	frameworks: StrategyFrameworkSummary[];
	activeFramework: StrategyFrameworkSummary | null;
	draftFrameworks: StrategyFrameworkSummary[];
};

type FrameworkRow = RowDataPacket & {
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
	lifecycleStatus: StrategyLifecycleStatus;
	ownerMemberId: string | number | null;
	objectiveCount: number | string;
	environmentFactorCount: number | string;
	businessPlanCount: number | string;
	initiativeCount: number | string;
	operatingModelComponentCount: number | string;
	kpiCount: number | string;
	reviewCount: number | string;
	scenarioCount: number | string;
};

export class StrategyValidationError extends Error {
	readonly code = 'STRATEGY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'StrategyValidationError';
	}
}

export class StrategyAccessError extends Error {
	readonly code = 'STRATEGY_ACCESS_DENIED';
	constructor(message = 'Strategy & Enterprise Planning is not available in the active scope.') {
		super(message);
		this.name = 'StrategyAccessError';
	}
}

function requiredText(value: string, label: string, maximum: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > maximum) {
		throw new StrategyValidationError(`${label} must be between 1 and ${maximum} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, maximum: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > maximum) {
		throw new StrategyValidationError(`Text must not exceed ${maximum} characters.`);
	}
	return normalized;
}

function dateOnly(value: string, label: string): string {
	const normalized = value.trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	const date = new Date(`${normalized}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
		throw new StrategyValidationError(`${label} is invalid.`);
	}
	return normalized;
}

function dateValue(value: Date | string): string {
	if (value instanceof Date) return value.toISOString().slice(0, 10);
	return String(value).slice(0, 10);
}

function mapFramework(row: FrameworkRow, memberId: string): StrategyFrameworkSummary {
	const version = governedVersionCoordinates({
		versionNumber: Number(row.versionNumber),
		minorVersionNumber: Number(row.minorVersionNumber),
		lifecycleStatus: row.lifecycleStatus
	});
	return {
		publicId: row.publicId,
		code: row.code,
		versionNumber: Number(row.versionNumber),
		minorVersionNumber: Number(row.minorVersionNumber),
		versionLabel: version.label,
		versionStage: version.status,
		title: row.title,
		horizonStart: dateValue(row.horizonStart),
		horizonEnd: dateValue(row.horizonEnd),
		purpose: row.purpose,
		vision: row.vision,
		mission: row.mission.trim() || null,
		lifecycleStatus: row.lifecycleStatus,
		isOwnedByCurrentMember: row.ownerMemberId?.toString() === memberId,
		objectiveCount: Number(row.objectiveCount),
		environmentFactorCount: Number(row.environmentFactorCount),
		businessPlanCount: Number(row.businessPlanCount),
		initiativeCount: Number(row.initiativeCount),
		operatingModelComponentCount: Number(row.operatingModelComponentCount),
		kpiCount: Number(row.kpiCount),
		reviewCount: Number(row.reviewCount),
		scenarioCount: Number(row.scenarioCount)
	};
}

async function permissionFlags(input: {
	organisationId: string;
	memberId: string;
}): Promise<StrategyPermissionFlags> {
	const decisions = await decidePermissions({
		organisationId: input.organisationId,
		memberId: input.memberId,
		permissionKeys: STRATEGY_PERMISSIONS
	});
	const canView = decisions.get('strategy.view')?.allowed === true;
	const canManage = decisions.get('strategy.manage')?.allowed === true;
	const canApprove = decisions.get('strategy.approve')?.allowed === true;
	if (!canView && !canManage && !canApprove) throw new StrategyAccessError();
	return { canView: canView || canManage || canApprove, canManage, canApprove };
}

async function listFrameworks(input: {
	organisationId: string;
	memberId: string;
}): Promise<StrategyFrameworkSummary[]> {
	const [rows] = await getPool().execute<FrameworkRow[]>(
		`SELECT framework.public_id AS publicId,
		        framework.framework_code AS code,
		        framework.version_number AS versionNumber,
		        framework.minor_version_number AS minorVersionNumber,
		        framework.title AS title,
		        framework.horizon_start AS horizonStart,
		        framework.horizon_end AS horizonEnd,
		        framework.purpose_text AS purpose,
		        framework.vision_text AS vision,
		        framework.mission_text AS mission,
		        framework.lifecycle_status AS lifecycleStatus,
		        framework.owner_member_id AS ownerMemberId,
		        (SELECT COUNT(*) FROM strategy_objectives objective
		          WHERE objective.strategy_framework_id = framework.id
		            AND objective.lifecycle_status <> 'retired') AS objectiveCount,
		        (SELECT COUNT(*) FROM strategy_environment_factors factor
		          WHERE factor.strategy_framework_id = framework.id
		            AND factor.lifecycle_status = 'active') AS environmentFactorCount,
		        (SELECT COUNT(*) FROM strategy_business_plans plan
		          WHERE plan.strategy_framework_id = framework.id
		            AND plan.lifecycle_status <> 'superseded') AS businessPlanCount,
		        (SELECT COUNT(*) FROM strategy_initiatives initiative
		          JOIN strategy_business_plans plan ON plan.id = initiative.strategy_business_plan_id
		          WHERE plan.strategy_framework_id = framework.id
		            AND initiative.lifecycle_status NOT IN ('completed', 'cancelled')) AS initiativeCount,
		        (SELECT COUNT(*) FROM strategy_operating_model_components component
		          JOIN strategy_business_plans plan ON plan.id = component.strategy_business_plan_id
		          WHERE plan.strategy_framework_id = framework.id
		            AND component.lifecycle_status <> 'retired') AS operatingModelComponentCount,
		        (SELECT COUNT(*) FROM strategy_kpis kpi
		          WHERE kpi.strategy_framework_id = framework.id
		            AND kpi.lifecycle_status NOT IN ('superseded', 'retired')) AS kpiCount,
		        (SELECT COUNT(*) FROM strategy_reviews review
		          WHERE review.strategy_framework_id = framework.id) AS reviewCount,
		        (SELECT COUNT(*) FROM strategy_scenarios scenario
		          WHERE scenario.strategy_framework_id = framework.id
		            AND scenario.lifecycle_status <> 'superseded') AS scenarioCount
		 FROM strategy_frameworks framework
		 WHERE framework.organisation_id = ?
		 ORDER BY
		   CASE framework.lifecycle_status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END,
		   framework.horizon_start DESC,
		   framework.version_number DESC,
		   framework.id DESC`,
		[input.organisationId]
	);
	return rows.map((row) => mapFramework(row, input.memberId));
}

async function nextFrameworkCode(
	connection: PoolConnection,
	organisationId: string,
	horizonStart: string,
	horizonEnd: string
): Promise<string> {
	await connection.execute('SELECT id FROM organisations WHERE id = ? FOR UPDATE', [
		organisationId
	]);
	const startYear = horizonStart.slice(0, 4);
	const endYear = horizonEnd.slice(0, 4);
	const base = `STR-${startYear}-${endYear}`;
	const [rows] = await connection.execute<(RowDataPacket & { code: string })[]>(
		`SELECT framework_code AS code
		 FROM strategy_frameworks
		 WHERE organisation_id = ?
		   AND (framework_code = ? OR framework_code LIKE ?)
		 ORDER BY framework_code`,
		[organisationId, base, `${base}-%`]
	);
	const used = new Set(rows.map((row) => row.code));
	if (!used.has(base)) return base;
	let suffix = 2;
	while (used.has(`${base}-${suffix}`)) suffix += 1;
	return `${base}-${suffix}`;
}

export async function getStrategyWorkspace(input: {
	organisationId: string;
	memberId: string;
}): Promise<StrategyWorkspace> {
	const permissions = await permissionFlags(input);
	const frameworks = await listFrameworks(input);
	return {
		permissions,
		frameworks,
		activeFramework:
			frameworks.find((framework) => framework.lifecycleStatus === 'approved') ?? null,
		draftFrameworks: frameworks.filter((framework) => framework.lifecycleStatus === 'draft')
	};
}

export async function createStrategyFramework(input: {
	actor: EvidenceActor;
	title: string;
	horizonStart: string;
	horizonEnd: string;
	purpose: string;
	vision: string;
	mission?: string | null;
}): Promise<{ publicId: string; code: string }> {
	const permissions = await permissionFlags({
		organisationId: input.actor.organisationId,
		memberId: input.actor.memberId
	});
	if (!permissions.canManage) {
		throw new StrategyAccessError(
			'You do not have authority to create or amend enterprise strategy.'
		);
	}

	const title = requiredText(input.title, 'Strategy title', 255);
	const horizonStart = dateOnly(input.horizonStart, 'Horizon start');
	const horizonEnd = dateOnly(input.horizonEnd, 'Horizon end');
	if (horizonEnd < horizonStart) {
		throw new StrategyValidationError('Horizon end must not be before horizon start.');
	}
	const purpose = requiredText(input.purpose, 'Purpose', 20_000);
	const vision = requiredText(input.vision, 'Vision', 20_000);
	const mission = optionalText(input.mission, 20_000) ?? '';

	const connection = await getPool().getConnection();
	try {
		await connection.beginTransaction();
		const code = await nextFrameworkCode(
			connection,
			input.actor.organisationId,
			horizonStart,
			horizonEnd
		);
		const publicId = randomUUID();
		await connection.execute(
			`INSERT INTO strategy_frameworks
				(organisation_id, public_id, framework_code, version_number, minor_version_number, title,
				 horizon_start, horizon_end, purpose_text, vision_text, mission_text,
				 lifecycle_status, supersedes_strategy_framework_id, owner_member_id,
				 created_by_member_id, approved_by_member_id, approved_at)
			 VALUES (?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, 'draft', NULL, ?, ?, NULL, NULL)`,
			[
				input.actor.organisationId,
				publicId,
				code,
				title,
				horizonStart,
				horizonEnd,
				purpose,
				vision,
				mission,
				input.actor.memberId,
				input.actor.memberId
			]
		);
		await appendGovernedVersion(connection, {
			actor: input.actor,
			domainCode: 'F01',
			recordType: 'strategy_framework',
			lineageKey: code,
			recordPublicId: publicId,
			versionNumber: 1,
			minorVersionNumber: 1,
			lifecycleStatus: 'draft',
			snapshot: {
				title,
				horizonStart,
				horizonEnd,
				purpose,
				vision,
				mission,
				lifecycleStatus: 'draft'
			},
			changeNote: 'Initial working draft'
		});
		await appendDomainEvidence(connection, {
			actor: input.actor,
			actionKey: 'strategy.framework.create',
			subjectType: 'strategy_framework',
			subjectPublicId: publicId,
			changeSummary: {
				frameworkCode: code,
				versionNumber: 1,
				versionLabel: '0.1',
				lifecycleStatus: 'draft',
				horizonStart,
				horizonEnd
			},
			eventMetadata: { function: 'F01', subfunctions: ['F01.01', 'F01.03'] }
		});
		await connection.commit();
		return { publicId, code };
	} catch (error) {
		await connection.rollback();
		throw error;
	} finally {
		connection.release();
	}
}
