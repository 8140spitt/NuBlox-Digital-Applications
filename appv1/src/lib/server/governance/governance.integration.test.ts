import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { GovernanceService } from './governance-service';

const PREFIX = 'Governance Integration ';
let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let isolatedOrganisationId = '';
let isolatedUserId = '';
let isolatedMemberId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup() {
	if (!db) return;
	const organisations = await db
		.selectFrom('organisations')
		.select('id')
		.where('legal_name', 'like', `${PREFIX}%`)
		.execute();
	const ids = organisations.map((row) => row.id);
	if (!ids.length) return;
	await db
		.deleteFrom('governance_policy_attestations')
		.where('organisation_id', 'in', ids)
		.execute();
	await db
		.deleteFrom('governance_conflict_declarations')
		.where('organisation_id', 'in', ids)
		.execute();
	await db.deleteFrom('governance_ethics_cases').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_actions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_decisions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_agenda_items').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_meeting_attendees').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_meetings').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_policies').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_authority_rules').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_body_memberships').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_bodies').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('governance_frameworks').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('outbox_events').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
	await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: organisationId,
				user_id: userId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-01-01T00:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}Owner`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissionKeys = [
		'governance.view',
		'governance.manage',
		'governance.approve',
		'governance.ethics.view',
		'governance.ethics.manage'
	];
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
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	isolatedUserId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Isolated`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	isolatedOrganisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: randomUUID(),
				legal_name: `${PREFIX}Isolated Organisation`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	isolatedMemberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				organisation_id: isolatedOrganisationId,
				user_id: isolatedUserId,
				public_id: randomUUID(),
				status: 'active',
				joined_at: new Date('2026-01-01T00:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('F02 corporate governance', () => {
	it('executes the governed constitution-to-decision-to-policy-and-ethics thread without granting access authority', async () => {
		const fixedNow = new Date('2026-09-08T12:00:00.000Z');
		const service = new GovernanceService(db, randomUUID, () => fixedNow);
		const framework = await service.createFramework(actor, {
			frameworkCode: 'CORP-GOV',
			title: 'Corporate Governance Framework',
			purposeText: 'Direct and control the enterprise through attributable governance.',
			principlesText: 'Accountability, transparency, authority, evidence and controlled review.',
			effectiveFrom: '2026-01-01',
			ownerMemberId: memberId
		});
		const board = await service.addBody(actor, {
			frameworkPublicId: framework.public_id,
			bodyCode: 'BOARD',
			bodyType: 'board',
			title: 'Board of Directors',
			mandateText: 'Set direction and exercise reserved enterprise authority.',
			quorumCount: 1,
			chairMemberId: memberId
		});
		await service.appointBodyMember(actor, {
			bodyPublicId: board.public_id,
			memberId,
			governanceRole: 'chair',
			votingRights: true,
			appointedOn: '2026-01-01'
		});
		const authority = await service.addAuthorityRule(actor, {
			frameworkPublicId: framework.public_id,
			bodyPublicId: board.public_id,
			authorityCode: 'STRATEGY-250K',
			subjectDomain: 'strategy',
			actionKey: 'strategy.approve',
			description: 'Board authority to approve strategic commitments up to GBP 500,000.',
			minAmount: '0',
			maxAmount: '500000',
			currencyCode: 'GBP',
			effectiveFrom: '2026-01-01'
		});
		const approvedFramework = await service.approveFramework(actor, framework.public_id);
		expect(approvedFramework.lifecycle_status).toBe('approved');

		const meeting = await service.createMeeting(actor, {
			bodyPublicId: board.public_id,
			meetingCode: 'BOARD-2026-09',
			meetingType: 'scheduled',
			title: 'September Board',
			scheduledAt: '2026-09-08T10:00:00.000Z',
			locationText: 'Boardroom'
		});
		await service.setMeetingAttendance(actor, {
			meetingPublicId: meeting.public_id,
			memberId,
			attendanceStatus: 'present'
		});
		const agenda = await service.addAgendaItem(actor, {
			meetingPublicId: meeting.public_id,
			agendaNumber: 1,
			itemType: 'decision',
			title: 'Approve strategic investment',
			description: 'Approve the canonical strategy investment decision.',
			sourceDomain: 'strategy',
			sourceRecordType: 'strategy_business_plan',
			sourcePublicId: 'STRATEGY-BP-2026',
			authorityActionKey: 'strategy.approve',
			decisionAmount: '250000',
			currencyCode: 'GBP'
		});
		await service.conveneMeeting(actor, meeting.public_id);
		const decision = await service.recordDecision(actor, {
			agendaItemPublicId: agenda.public_id,
			decisionCode: 'RES-2026-001',
			decisionOutcome: 'approved',
			resolutionText:
				'Resolved that the strategic investment is approved under the recorded authority.'
		});
		expect(decision.governance_authority_rule_id).toBe(authority.id);
		const action = await service.createAction(actor, {
			decisionPublicId: decision.public_id,
			actionCode: 'ACT-2026-001',
			title: 'Mobilise approved strategy',
			description:
				'Execute the approved strategic investment through the canonical planning record.',
			ownerMemberId: memberId,
			dueDate: '2026-10-01',
			sourceDomain: 'strategy',
			sourceRecordType: 'strategy_business_plan',
			sourcePublicId: 'STRATEGY-BP-2026'
		});
		const completedAction = await service.completeAction(
			actor,
			action.public_id,
			'Canonical strategy plan mobilised and evidence attached.'
		);
		expect(completedAction.lifecycle_status).toBe('completed');
		const closedMeeting = await service.closeMeeting(
			actor,
			meeting.public_id,
			'Quorum was proven. The strategic investment was approved and an accountable action assigned.'
		);
		expect(closedMeeting.lifecycle_status).toBe('closed');

		const policy = await service.createPolicy(actor, {
			frameworkPublicId: approvedFramework.public_id,
			approvalBodyPublicId: board.public_id,
			policyCode: 'ETHICS-001',
			title: 'Ethics and Conflicts Policy',
			policyCategory: 'ethics',
			scopeText: 'All enterprise members and governance bodies.',
			policyText:
				'Conflicts must be declared, reviewed and managed before affected decisions proceed.',
			effectiveFrom: '2026-09-08',
			reviewDueOn: '2027-09-08',
			ownerMemberId: memberId
		});
		const approvedPolicy = await service.approvePolicy(actor, policy.public_id);
		expect(approvedPolicy.lifecycle_status).toBe('approved');
		const attestation = await service.attestPolicy(
			actor,
			approvedPolicy.public_id,
			'acknowledged',
			'Understood and accepted.'
		);
		expect(attestation.attestation_status).toBe('acknowledged');

		const conflict = await service.declareConflict(actor, {
			policyPublicId: approvedPolicy.public_id,
			declarationType: 'potential',
			subjectText: 'Supplier relationship',
			details: 'A potential conflict exists and must be managed before supplier decisions.',
			declaredOn: '2026-09-08'
		});
		const managedConflict = await service.reviewConflict(
			actor,
			conflict.public_id,
			'Potential conflict confirmed.',
			'Member recused from the relevant supplier decision.',
			true
		);
		expect(managedConflict.lifecycle_status).toBe('closed');

		const ethicsCase = await service.createEthicsCase(actor, {
			policyPublicId: approvedPolicy.public_id,
			caseCode: 'ETH-2026-001',
			subjectText: 'Policy concern',
			description: 'Investigate a governance-policy concern and retain resolution evidence.',
			severity: 'medium',
			ownerMemberId: memberId
		});
		const resolvedCase = await service.resolveEthicsCase(
			actor,
			ethicsCase.public_id,
			'Concern investigated, controls confirmed and case resolved.'
		);
		expect(resolvedCase.lifecycle_status).toBe('resolved');

		const workspace = await service.getWorkspace(actor, approvedFramework.public_id);
		expect(workspace.bodies).toHaveLength(1);
		expect(workspace.authorityRules).toHaveLength(1);
		expect(workspace.meetings).toHaveLength(1);
		expect(workspace.decisions).toHaveLength(1);
		expect(workspace.actions).toHaveLength(1);
		expect(workspace.policies).toHaveLength(1);
		expect(workspace.conflicts).toHaveLength(1);
		expect(workspace.ethicsCases).toHaveLength(1);

		const accessDelegationCount = await db
			.selectFrom('organisation_delegation_policies')
			.select(({ fn }) => fn.countAll<string>().as('count'))
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(Number(accessDelegationCount.count)).toBe(0);

		const auditTopics = await db
			.selectFrom('audit_events')
			.select('action_key')
			.where('acting_organisation_id', '=', organisationId)
			.where('action_key', 'like', 'governance.%')
			.execute();
		expect(auditTopics.some((row) => row.action_key === 'governance.decision.record')).toBe(true);
		expect(auditTopics.some((row) => row.action_key === 'governance.policy.approve')).toBe(true);
		expect(auditTopics.some((row) => row.action_key === 'governance.ethics.case.resolve')).toBe(
			true
		);
	});

	it('fails closed for an active organisation member without governance authority', async () => {
		const isolatedActor: TenantActorContext = {
			organisationId: isolatedOrganisationId,
			userId: isolatedUserId,
			memberId: isolatedMemberId,
			correlationId: randomUUID()
		};
		await expect(new GovernanceService(db).getWorkspace(isolatedActor)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
