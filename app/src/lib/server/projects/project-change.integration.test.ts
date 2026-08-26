import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { ProjectChangeService, ProjectChangeValidationError } from './project-change-service';

const PREFIX = 'Project Change Integration ';
const PROJECT_PREFIX = 'CHANGE-';

let db: Database;
let organisationId = '';
let ownerUserId = '';
let viewerUserId = '';
let ownerMemberId = '';
let viewerMemberId = '';
let projectId = '';
let projectPublicId = '';
let wbsPublicId = '';
let activityPublicId = '';
let costCodePublicId = '';
let owner: TenantActorContext;
let viewer: TenantActorContext;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const projects = await db
		.selectFrom('projects')
		.select('id')
		.where('project_number', 'like', `${PROJECT_PREFIX}%`)
		.execute();
	const projectIds = projects.map((row) => row.id);
	if (projectIds.length) {
		await db.deleteFrom('project_change_implementations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_change_decisions').where('project_id', 'in', projectIds).execute();
		const assessments = await db
			.selectFrom('project_change_assessments')
			.select('id')
			.where('project_id', 'in', projectIds)
			.execute();
		const assessmentIds = assessments.map((row) => row.id);
		if (assessmentIds.length) {
			await db.deleteFrom('project_change_contract_impacts').where('assessment_id', 'in', assessmentIds).execute();
			await db.deleteFrom('project_change_cost_impacts').where('assessment_id', 'in', assessmentIds).execute();
			await db.deleteFrom('project_change_activity_impacts').where('assessment_id', 'in', assessmentIds).execute();
			await db.deleteFrom('project_change_wbs_impacts').where('assessment_id', 'in', assessmentIds).execute();
		}
		await db.deleteFrom('project_change_assessments').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('commercial_variation_change_events').where('project_change_event_id', 'in', db.selectFrom('project_change_events').select('id').where('project_id', 'in', projectIds)).execute();
		await db.deleteFrom('change_event_information_links').where('project_change_event_id', 'in', db.selectFrom('project_change_events').select('id').where('project_id', 'in', projectIds)).execute();
		await db.deleteFrom('project_change_events').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_cost_codes').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_dependencies').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_plan_activities').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_wbs_nodes').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('outbox_events').where('aggregate_type', '=', 'project_change_event').execute();
		await db.deleteFrom('audit_events').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_member_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_members').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisation_roles').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('project_organisations').where('project_id', 'in', projectIds).execute();
		await db.deleteFrom('projects').where('id', 'in', projectIds).execute();
	}

	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length) {
		await db.deleteFrom('outbox_events').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
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

async function createMember(userId: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-08-26T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(memberId: string, label: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${label}`, is_active: 1 })
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
		.values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id })))
		.execute();
	await db
		.insertInto('member_roles')
		.values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId })
		.execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerUserId = await createUser('Owner');
	viewerUserId = await createUser('Viewer');
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Organisation`, default_timezone: 'Europe/London', default_currency_code: 'GBP', status: 'active' })
			.executeTakeFirstOrThrow()
	);
	ownerMemberId = await createMember(ownerUserId);
	viewerMemberId = await createMember(viewerUserId);
	await assignPermissionRole(ownerMemberId, 'Owner role', [
		'project.view',
		'project.change.view',
		'project.change.manage',
		'project.change.assess',
		'project.change.approve',
		'project.change.implement',
		'project.change.close'
	]);
	await assignPermissionRole(viewerMemberId, 'Viewer role', ['project.view', 'project.change.view']);

	projectPublicId = randomUUID();
	projectId = insertedId(
		await db
			.insertInto('projects')
			.values({ owning_organisation_id: organisationId, public_id: projectPublicId, project_number: `${PROJECT_PREFIX}${randomUUID().slice(0, 8)}`, name: `${PREFIX}Controlled delivery`, status: 'active', created_by_member_id: ownerMemberId })
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('project_organisations')
		.values({ project_id: projectId, participant_organisation_id: organisationId, status: 'active', invited_by_member_id: null, joined_at: new Date('2026-08-26T08:30:00.000Z'), left_at: null })
		.execute();
	await db
		.insertInto('project_members')
		.values([
			{ project_id: projectId, participant_organisation_id: organisationId, organisation_member_id: ownerMemberId, status: 'active', joined_at: new Date('2026-08-26T08:30:00.000Z'), left_at: null },
			{ project_id: projectId, participant_organisation_id: organisationId, organisation_member_id: viewerMemberId, status: 'active', joined_at: new Date('2026-08-26T08:31:00.000Z'), left_at: null }
		])
		.execute();

	wbsPublicId = randomUUID();
	const wbsId = insertedId(
		await db
			.insertInto('project_wbs_nodes')
			.values({ organisation_id: organisationId, project_id: projectId, public_id: wbsPublicId, parent_wbs_node_id: null, wbs_code: '3', name: 'Superstructure', description: null, sort_order: 30, lifecycle_status: 'active', created_by_member_id: ownerMemberId })
			.executeTakeFirstOrThrow()
	);
	activityPublicId = randomUUID();
	await db
		.insertInto('project_plan_activities')
		.values({ organisation_id: organisationId, project_id: projectId, wbs_node_id: wbsId, public_id: activityPublicId, activity_code: 'A-300', name: 'Install structural frame', description: null, activity_kind: 'activity', status: 'planned', planned_start_on: new Date('2026-09-01T00:00:00.000Z'), planned_finish_on: new Date('2026-09-10T00:00:00.000Z'), planned_duration_days: '10.00', created_by_member_id: ownerMemberId })
		.execute();
	const category = await db.selectFrom('commercial_cost_categories').select('id').where('is_active', '=', 1).orderBy('id').executeTakeFirstOrThrow();
	costCodePublicId = randomUUID();
	await db
		.insertInto('project_cost_codes')
		.values({ organisation_id: organisationId, project_id: projectId, public_id: costCodePublicId, commercial_cost_category_id: category.id, parent_cost_code_id: null, code: '03.01', name: 'Structural steel', description: null, sort_order: 10, is_active: 1 })
		.execute();

	owner = { organisationId, userId: ownerUserId, memberId: ownerMemberId, correlationId: randomUUID() };
	viewer = { organisationId, userId: viewerUserId, memberId: viewerMemberId, correlationId: randomUUID() };
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('controlled project change', () => {
	it('governs change from identification through impact assessment, decision, implementation and closure', async () => {
		const service = new ProjectChangeService(db, randomUUID, () => new Date('2026-08-26T10:00:00.000Z'));
		const changePublicId = await service.createChange(owner, {
			projectPublicId,
			typeCode: 'design_change',
			title: 'Increase primary frame member size',
			description: 'Structural redesign affects the frame package and installation sequence.'
		});

		await service.saveAssessment(owner, {
			projectPublicId,
			changePublicId,
			scopeImpactLevel: 'confirmed',
			programmeImpactLevel: 'confirmed',
			costImpactLevel: 'potential',
			contractImpactLevel: 'potential',
			informationImpactLevel: 'confirmed',
			scopeSummary: 'Member sizes and connection details change.',
			programmeSummary: 'Frame installation may move by five days.',
			costSummary: 'Steel tonnage and fabrication effort increase.',
			contractSummary: 'Client change notice may be required.',
			informationSummary: 'Structural drawings and calculations require revision.',
			currencyCode: 'GBP',
			estimatedCostDelta: '12500.00',
			estimatedTimeDeltaDays: '5.00',
			wbsPublicIds: [wbsPublicId],
			activityPublicIds: [activityPublicId],
			costCodePublicIds: [costCodePublicId]
		});

		let workspace = await service.getWorkspace(viewer, projectPublicId);
		const draft = workspace.changes.find((change) => change.publicId === changePublicId);
		expect(workspace.canManage).toBe(false);
		expect(draft?.status).toBe('identified');
		expect(draft?.latestAssessment?.versionStatus).toBe('draft');
		expect(draft?.latestAssessment?.wbsPublicIds).toEqual([wbsPublicId]);
		expect(draft?.latestAssessment?.activityPublicIds).toEqual([activityPublicId]);
		expect(draft?.latestAssessment?.costCodePublicIds).toEqual([costCodePublicId]);

		await service.submitAssessment(owner, projectPublicId, changePublicId);
		await expect(
			service.recordImplementation(owner, {
				projectPublicId,
				changePublicId,
				implementationSummary: 'Premature implementation.'
			})
		).rejects.toBeInstanceOf(ProjectChangeValidationError);

		await service.decideChange(owner, {
			projectPublicId,
			changePublicId,
			decision: 'deferred',
			rationale: 'Obtain fabrication confirmation before approving.'
		});

		await service.saveAssessment(owner, {
			projectPublicId,
			changePublicId,
			scopeImpactLevel: 'confirmed',
			programmeImpactLevel: 'confirmed',
			costImpactLevel: 'confirmed',
			contractImpactLevel: 'confirmed',
			informationImpactLevel: 'confirmed',
			scopeSummary: 'Revised member sizes confirmed.',
			programmeSummary: 'Three working days of resequencing confirmed.',
			costSummary: 'Fabricator quotation confirms the additional cost.',
			contractSummary: 'Formal client variation will implement the commercial position.',
			informationSummary: 'Updated construction issue drawings required.',
			currencyCode: 'GBP',
			estimatedCostDelta: '9000.00',
			estimatedTimeDeltaDays: '3.00',
			wbsPublicIds: [wbsPublicId],
			activityPublicIds: [activityPublicId],
			costCodePublicIds: [costCodePublicId]
		});
		await service.submitAssessment(owner, projectPublicId, changePublicId);
		await service.decideChange(owner, {
			projectPublicId,
			changePublicId,
			decision: 'accepted_with_conditions',
			rationale: 'Proceed to protect the structural sequence.',
			conditions: 'Issue the revised structural information before fabrication release.'
		});

		workspace = await service.getWorkspace(viewer, projectPublicId);
		const accepted = workspace.changes.find((change) => change.publicId === changePublicId);
		expect(accepted?.status).toBe('accepted');
		expect(accepted?.latestAssessment?.versionNumber).toBe(2);
		expect(accepted?.latestAssessment?.estimatedCostDelta).toBe('9000.00');
		expect(accepted?.latestDecision?.decision).toBe('accepted_with_conditions');

		await service.recordImplementation(owner, {
			projectPublicId,
			changePublicId,
			implementationSummary: 'WBS scope, programme activity, control cost position and revised design information were updated.',
			implementedAt: new Date('2026-08-27T12:00:00.000Z')
		});
		await service.closeChange(owner, projectPublicId, changePublicId);

		workspace = await service.getWorkspace(viewer, projectPublicId);
		const closed = workspace.changes.find((change) => change.publicId === changePublicId);
		expect(closed?.status).toBe('closed');
		expect(closed?.implementation?.implementationSummary).toContain('programme activity');

		const versions = await db
			.selectFrom('project_change_assessments')
			.select(['version_number', 'version_status'])
			.where('project_change_event_id', '=', closed!.id)
			.orderBy('version_number')
			.execute();
		expect(versions).toEqual([
			{ version_number: 1, version_status: 'superseded' },
			{ version_number: 2, version_status: 'submitted' }
		]);
		const decisions = await db.selectFrom('project_change_decisions').select('decision').where('project_change_event_id', '=', closed!.id).orderBy('decision_number').execute();
		expect(decisions.map((row) => row.decision)).toEqual(['deferred', 'accepted_with_conditions']);
		const auditActions = await db.selectFrom('audit_events').select('action_key').where('project_id', '=', projectId).where('subject_public_id', '=', changePublicId).execute();
		expect(auditActions.map((row) => row.action_key)).toEqual(expect.arrayContaining(['project.change.raised', 'project.change.assessment_submitted', 'project.change.decided', 'project.change.implemented', 'project.change.closed']));
	});

	it('keeps change-management authority server-side', async () => {
		const service = new ProjectChangeService(db);
		await expect(
			service.createChange(viewer, {
				projectPublicId,
				typeCode: 'client_request',
				title: 'Viewer should not raise this',
				description: 'The view-only role must be rejected by the domain service.'
			})
		).rejects.toBeInstanceOf(TenantAccessError);
	});
});
