import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { StrategyService, StrategyValidationError } from './strategy-service';

const PREFIX = 'Strategy Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let externalMemberId = '';
let ownerUserId = '';
let viewerUserId = '';
let externalUserId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;
let external: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length) {
		await db
			.deleteFrom('strategy_environment_factors')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('strategy_options')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('strategy_objectives')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('strategy_frameworks')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('audit_events')
			.where('acting_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('member_permission_overrides')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('role_permissions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_roles')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('organisation_members')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${label}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(label: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}${label}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-09-06T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	label: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${label}`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
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
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	externalUserId = await createUser('External');
	organisationAId = await createOrganisation('Organisation A');
	organisationBId = await createOrganisation('Organisation B');
	ownerMemberId = await createMember(organisationAId, ownerUserId);
	viewerMemberId = await createMember(organisationAId, viewerUserId);
	externalMemberId = await createMember(organisationBId, externalUserId);
	await assignPermissionRole(organisationAId, ownerMemberId, 'Strategy owner', [
		'strategy.view',
		'strategy.manage',
		'strategy.approve'
	]);
	await assignPermissionRole(organisationAId, viewerMemberId, 'Strategy viewer', ['strategy.view']);
	await assignPermissionRole(organisationBId, externalMemberId, 'External strategy viewer', [
		'strategy.view'
	]);
	owner = {
		organisationId: organisationAId,
		userId: ownerUserId,
		memberId: ownerMemberId,
		correlationId: randomUUID()
	};
	viewer = {
		organisationId: organisationAId,
		userId: viewerUserId,
		memberId: viewerMemberId,
		correlationId: randomUUID()
	};
	external = {
		organisationId: organisationBId,
		userId: externalUserId,
		memberId: externalMemberId,
		correlationId: randomUUID()
	};
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F01 strategy intent and analysis', () => {
	it('creates, approves and revises an attributable strategy version without rewriting approved evidence', async () => {
		const service = new StrategyService(db, randomUUID, () => new Date('2026-09-06T12:00:00.000Z'));
		const framework = await service.createFramework(owner, {
			frameworkCode: 'enterprise',
			title: '2027–2031 Enterprise Strategy',
			horizonStart: '2027-01-01',
			horizonEnd: '2031-12-31',
			purposeText: 'Create enduring value through the built environment.',
			visionText: 'Be the most trusted digitally integrated built-environment enterprise.',
			missionText:
				'Connect customer, project, asset and enterprise decisions through governed evidence.',
			ownerMemberId
		});
		expect(framework.framework_code).toBe('ENTERPRISE');
		expect(framework.version_number).toBe(1);
		expect(framework.lifecycle_status).toBe('draft');

		await service.addEnvironmentFactor(owner, {
			frameworkPublicId: framework.public_id,
			contextScope: 'external',
			dimension: 'technology',
			direction: 'opportunity',
			title: 'Connected asset data',
			analysisText: 'Owners increasingly expect governed handover and operational digital threads.',
			evidenceReference: 'Board market scan 2026-Q3',
			observedOn: '2026-09-01',
			likelihoodScore: 5,
			impactScore: 5,
			ownerMemberId
		});
		const option = await service.addOption(owner, {
			frameworkPublicId: framework.public_id,
			title: 'Lead with one governed digital thread',
			description:
				'Differentiate by carrying strategic intent through delivery into operating assets.',
			evaluationSummary: 'High strategic fit and defensible sector differentiation.',
			priorityRank: 1
		});
		await service.decideOption(
			owner,
			framework.public_id,
			option.public_id,
			'selected',
			'Selected because it joins enterprise breadth with built-environment depth.'
		);
		await service.addObjective(owner, {
			frameworkPublicId: framework.public_id,
			objectiveCode: 'OBJ-01',
			title: 'Prove enterprise-to-asset continuity',
			description:
				'Run the enterprise and preserve traceability into delivered and operated assets.',
			priorityRank: 1,
			ownerMemberId,
			targetDate: '2028-12-31'
		});

		const approved = await service.approveFramework(owner, framework.public_id);
		expect(approved.lifecycle_status).toBe('approved');
		expect(approved.approved_by_member_id).toBe(ownerMemberId);
		const approvedWorkspace = await service.getWorkspace(owner, approved.public_id);
		expect(approvedWorkspace.environmentFactors).toHaveLength(1);
		expect(approvedWorkspace.options[0]?.decision_status).toBe('selected');
		expect(approvedWorkspace.objectives[0]?.lifecycle_status).toBe('active');

		await expect(
			service.updateFramework(owner, approved.public_id, {
				title: 'Attempted rewrite',
				horizonStart: '2027-01-01',
				horizonEnd: '2031-12-31',
				purposeText: 'Changed',
				visionText: 'Changed',
				missionText: 'Changed',
				ownerMemberId
			})
		).rejects.toBeInstanceOf(StrategyValidationError);

		const revision = await service.reviseFramework(owner, approved.public_id);
		expect(revision.version_number).toBe(2);
		expect(revision.lifecycle_status).toBe('draft');
		expect(revision.supersedes_strategy_framework_id).toBe(approved.id);
		const revisionWorkspace = await service.getWorkspace(owner, revision.public_id);
		expect(revisionWorkspace.environmentFactors).toHaveLength(1);
		expect(revisionWorkspace.options[0]?.decision_status).toBe('proposed');
		expect(revisionWorkspace.objectives[0]?.lifecycle_status).toBe('draft');

		const sourceAfterRevision = await db
			.selectFrom('strategy_frameworks')
			.select(['title', 'lifecycle_status'])
			.where('id', '=', approved.id)
			.executeTakeFirstOrThrow();
		expect(sourceAfterRevision).toEqual({
			title: '2027–2031 Enterprise Strategy',
			lifecycle_status: 'approved'
		});

		const auditActions = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationAId)
			.where('action_key', 'like', 'strategy.%')
			.execute();
		expect(auditActions.map((row) => row.action_key)).toEqual(
			expect.arrayContaining([
				'strategy.framework.create',
				'strategy.environment_factor.create',
				'strategy.option.create',
				'strategy.option.decide',
				'strategy.objective.create',
				'strategy.framework.approve',
				'strategy.framework.revise'
			])
		);
		const outboxCount = await db
			.selectFrom('outbox_events')
			.select(({ fn }) => fn.countAll<string>().as('count'))
			.where('organisation_id', '=', organisationAId)
			.where('topic', 'like', 'strategy.%')
			.executeTakeFirstOrThrow();
		expect(Number(outboxCount.count)).toBeGreaterThanOrEqual(7);
	});

	it('clears inactive copied owners on revision and rejects inactive owners at approval', async () => {
		const service = new StrategyService(db, randomUUID, () => new Date('2026-09-06T13:00:00.000Z'));
		const accountableUserId = await createUser('Inactive accountable owner');
		const accountableMemberId = await createMember(organisationAId, accountableUserId);
		const framework = await service.createFramework(owner, {
			frameworkCode: 'OWNER-REVALIDATION',
			title: 'Owner revalidation strategy',
			horizonStart: '2027-01-01',
			horizonEnd: '2029-12-31',
			purposeText: 'Keep accountable ownership current.',
			visionText: 'Only active members own approved strategy records.',
			missionText: 'Revalidate ownership at controlled lifecycle boundaries.',
			ownerMemberId: accountableMemberId
		});
		await service.addEnvironmentFactor(owner, {
			frameworkPublicId: framework.public_id,
			contextScope: 'internal',
			dimension: 'operational',
			direction: 'strength',
			title: 'Named accountable owner',
			analysisText: 'Accountability must remain assigned to an active organisation member.',
			ownerMemberId: accountableMemberId
		});
		const option = await service.addOption(owner, {
			frameworkPublicId: framework.public_id,
			title: 'Revalidate lifecycle owners',
			description: 'Clear stale copied assignments and block stale approval ownership.'
		});
		await service.decideOption(
			owner,
			framework.public_id,
			option.public_id,
			'selected',
			'Preserves accountable ownership integrity.'
		);
		await service.addObjective(owner, {
			frameworkPublicId: framework.public_id,
			objectiveCode: 'OWNER-01',
			title: 'Maintain active ownership',
			description: 'Ensure approved strategic accountability resolves to active members.',
			priorityRank: 1,
			ownerMemberId: accountableMemberId
		});
		const approved = await service.approveFramework(owner, framework.public_id);
		await db
			.updateTable('organisation_members')
			.set({ status: 'disabled', disabled_at: new Date('2026-09-06T13:30:00.000Z') })
			.where('id', '=', accountableMemberId)
			.where('organisation_id', '=', organisationAId)
			.executeTakeFirstOrThrow();

		const revision = await service.reviseFramework(owner, approved.public_id);
		expect(revision.owner_member_id).toBeNull();
		const revisionWorkspace = await service.getWorkspace(owner, revision.public_id);
		expect(revisionWorkspace.environmentFactors[0]?.owner_member_id).toBeNull();
		expect(revisionWorkspace.objectives[0]?.owner_member_id).toBeNull();

		await service.updateFramework(owner, revision.public_id, {
			title: revision.title,
			horizonStart: revision.horizon_start,
			horizonEnd: revision.horizon_end,
			purposeText: revision.purpose_text,
			visionText: revision.vision_text,
			missionText: revision.mission_text,
			ownerMemberId: ownerMemberId
		});
		await db
			.updateTable('strategy_objectives')
			.set({ owner_member_id: accountableMemberId })
			.where('strategy_framework_id', '=', revision.id)
			.executeTakeFirstOrThrow();
		await expect(service.approveFramework(owner, revision.public_id)).rejects.toBeInstanceOf(
			StrategyValidationError
		);
	});

	it('keeps view-only and cross-tenant authority fail-closed', async () => {
		const service = new StrategyService(db);
		const workspace = await service.getWorkspace(viewer);
		expect(workspace.canManage).toBe(false);
		expect(workspace.canApprove).toBe(false);
		await expect(
			service.createFramework(viewer, {
				frameworkCode: 'VIEWER',
				title: 'Viewer strategy',
				horizonStart: '2027-01-01',
				horizonEnd: '2028-12-31',
				purposeText: 'Purpose',
				visionText: 'Vision',
				missionText: 'Mission'
			})
		).rejects.toBeInstanceOf(TenantAccessError);

		const source = workspace.frameworks[0];
		expect(source).toBeDefined();
		await expect(service.getWorkspace(external, source?.public_id)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
