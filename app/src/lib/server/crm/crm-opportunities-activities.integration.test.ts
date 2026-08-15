import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CrmService } from './crm-service';
import { CrmOpportunityService, CrmOpportunityValidationError } from './crm-opportunity-service';

const PREFIX = 'CRM Opportunity Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let managerAMemberId = '';
let viewerAMemberId = '';
let managerBMemberId = '';
let managerAUserId = '';
let viewerAUserId = '';
let managerBUserId = '';
let pipelineAPublicId = '';
let pipelineBPublicId = '';
let actorManagerA: TenantActorContext;
let actorViewerA: TenantActorContext;
let actorManagerB: TenantActorContext;

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
	const ids = organisations.map((row) => row.id);
	if (ids.length > 0) {
		await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_activity_parties').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_activity_members').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_activities').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('opportunity_parties').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('opportunities').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_pipeline_stages').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('crm_pipelines').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_organisation_contacts').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_role_assignments').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_phone_numbers').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_email_addresses').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_persons').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('party_organisations').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('parties').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('member_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('role_permissions').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_roles').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisation_members').where('organisation_id', 'in', ids).execute();
		await db.deleteFrom('organisations').where('id', 'in', ids).execute();
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, status: 'active' })
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
				joined_at: new Date('2026-08-15T22:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
}

async function assignPermissionRole(
	organisationId: string,
	memberId: string,
	name: string,
	permissionKeys: string[]
): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 })
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
		.values(permissions.map((permission) => ({
			organisation_id: organisationId,
			organisation_role_id: roleId,
			permission_id: permission.id
		})))
		.execute();
	await db
		.insertInto('member_roles')
		.values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId })
		.executeTakeFirstOrThrow();
}

async function createPipeline(organisationId: string, name: string): Promise<string> {
	const pipelinePublicId = randomUUID();
	const pipelineId = insertedId(
		await db
			.insertInto('crm_pipelines')
			.values({ organisation_id: organisationId, public_id: pipelinePublicId, name, is_default: 1, is_active: 1 })
			.executeTakeFirstOrThrow()
	);
	await db
		.insertInto('crm_pipeline_stages')
		.values([
			{ organisation_id: organisationId, crm_pipeline_id: pipelineId, name: 'Lead', sort_order: 10, probability_percent: '10.00', is_active: 1 },
			{ organisation_id: organisationId, crm_pipeline_id: pipelineId, name: 'Qualified', sort_order: 20, probability_percent: '30.00', is_active: 1 },
			{ organisation_id: organisationId, crm_pipeline_id: pipelineId, name: 'Proposal', sort_order: 30, probability_percent: '60.00', is_active: 1 }
		])
		.execute();
	return pipelinePublicId;
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	managerAUserId = await createUser('Manager A');
	viewerAUserId = await createUser('Viewer A');
	managerBUserId = await createUser('Manager B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	managerAMemberId = await createMember(organisationAId, managerAUserId);
	viewerAMemberId = await createMember(organisationAId, viewerAUserId);
	managerBMemberId = await createMember(organisationBId, managerBUserId);
	await assignPermissionRole(organisationAId, managerAMemberId, 'Manager A', [
		'crm.view',
		'crm.party.manage',
		'crm.opportunity.manage',
		'crm.activity.manage'
	]);
	await assignPermissionRole(organisationAId, viewerAMemberId, 'Viewer A', ['crm.view']);
	await assignPermissionRole(organisationBId, managerBMemberId, 'Manager B', [
		'crm.view',
		'crm.party.manage',
		'crm.opportunity.manage',
		'crm.activity.manage'
	]);
	pipelineAPublicId = await createPipeline(organisationAId, `${PREFIX}Pipeline A`);
	pipelineBPublicId = await createPipeline(organisationBId, `${PREFIX}Pipeline B`);
	actorManagerA = { organisationId: organisationAId, userId: managerAUserId, memberId: managerAMemberId, correlationId: randomUUID() };
	actorViewerA = { organisationId: organisationAId, userId: viewerAUserId, memberId: viewerAMemberId, correlationId: randomUUID() };
	actorManagerB = { organisationId: organisationBId, userId: managerBUserId, memberId: managerBMemberId, correlationId: randomUUID() };
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('CRM opportunities and activity timeline', () => {
	it('separates view, opportunity management and activity management permissions', async () => {
		const manager = await new CrmOpportunityService(db).listWorkspace(actorManagerA);
		expect(manager.canView).toBe(true);
		expect(manager.canManageOpportunities).toBe(true);
		expect(manager.canManageActivities).toBe(true);
		const viewer = await new CrmOpportunityService(db).listWorkspace(actorViewerA);
		expect(viewer.canView).toBe(true);
		expect(viewer.canManageOpportunities).toBe(false);
		expect(viewer.canManageActivities).toBe(false);
	});

	it('creates a tenant-owned opportunity with a primary prospective customer and pipeline stage', async () => {
		const crm = new CrmService(db);
		const client = await crm.createParty(actorManagerA, {
			kind: 'organisation',
			legalName: `${PREFIX}Client A`,
			roleCodes: ['prospect']
		});
		const opportunity = await new CrmOpportunityService(db).createOpportunity(actorManagerA, {
			title: `${PREFIX}New HQ`,
			description: 'Prospective headquarters refurbishment.',
			pipelinePublicId: pipelineAPublicId,
			stageName: 'Lead',
			estimatedValue: '125000.5000',
			currencyCode: 'GBP',
			expectedCloseDate: '2026-10-31',
			primaryPartyPublicId: client.publicId
		});
		expect(opportunity.status).toBe('open');
		expect(opportunity.stageName).toBe('Lead');
		expect(opportunity.primaryPartyPublicId).toBe(client.publicId);
		expect(opportunity.estimatedValue).toBe('125000.5000');
		const participants = await db
			.selectFrom('opportunity_parties as assignment')
			.innerJoin('opportunity_party_role_types as role', 'role.id', 'assignment.opportunity_party_role_type_id')
			.select(['assignment.is_primary as isPrimary', 'role.code as roleCode'])
			.where('assignment.organisation_id', '=', organisationAId)
			.where('assignment.opportunity_id', '=', opportunity.id)
			.execute();
		expect(participants).toEqual([{ isPrimary: 1, roleCode: 'customer' }]);
		await expect(new CrmOpportunityService(db).createOpportunity(actorViewerA, {
			title: 'Denied', pipelinePublicId: pipelineAPublicId, stageName: 'Lead', primaryPartyPublicId: client.publicId
		})).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('rejects cross-tenant customer and pipeline references and masks direct opportunity IDs', async () => {
		const clientB = await new CrmService(db).createParty(actorManagerB, {
			kind: 'organisation', legalName: `${PREFIX}Client B`, roleCodes: ['prospect']
		});
		await expect(new CrmOpportunityService(db).createOpportunity(actorManagerA, {
			title: 'Cross tenant customer', pipelinePublicId: pipelineAPublicId, stageName: 'Lead', primaryPartyPublicId: clientB.publicId
		})).rejects.toBeInstanceOf(RecordNotFoundError);
		const ownClient = await new CrmService(db).createParty(actorManagerA, {
			kind: 'organisation', legalName: `${PREFIX}Client A2`, roleCodes: ['prospect']
		});
		await expect(new CrmOpportunityService(db).createOpportunity(actorManagerA, {
			title: 'Cross tenant pipeline', pipelinePublicId: pipelineBPublicId, stageName: 'Lead', primaryPartyPublicId: ownClient.publicId
		})).rejects.toBeInstanceOf(CrmOpportunityValidationError);
		const foreignOpportunity = await new CrmOpportunityService(db).createOpportunity(actorManagerB, {
			title: `${PREFIX}Foreign Opportunity`, pipelinePublicId: pipelineBPublicId, stageName: 'Lead', primaryPartyPublicId: clientB.publicId
		});
		await expect(new CrmOpportunityService(db).getWorkspace(actorManagerA, foreignOpportunity.publicId)).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('updates stage, outcome and primary customer while retaining participant identity', async () => {
		const crm = new CrmService(db);
		const client = await crm.createParty(actorManagerA, { kind: 'organisation', legalName: `${PREFIX}Outcome Client`, roleCodes: ['prospect'] });
		const replacement = await crm.createParty(actorManagerA, { kind: 'person', givenNames: 'Morgan', familyName: 'Buyer' });
		const service = new CrmOpportunityService(db, () => randomUUID(), () => new Date('2026-08-15T22:30:00.000Z'));
		const opportunity = await service.createOpportunity(actorManagerA, {
			title: `${PREFIX}Outcome`, pipelinePublicId: pipelineAPublicId, stageName: 'Lead', primaryPartyPublicId: client.publicId
		});
		const updated = await service.updateOpportunity(actorManagerA, {
			opportunityPublicId: opportunity.publicId,
			title: opportunity.title,
			description: 'Qualified and awarded.',
			pipelinePublicId: pipelineAPublicId,
			stageName: 'Qualified',
			estimatedValue: '50000',
			currencyCode: 'GBP',
			expectedCloseDate: '2026-09-30',
			primaryPartyPublicId: replacement.publicId,
			status: 'won'
		});
		expect(updated).toMatchObject({ status: 'won', stageName: 'Qualified', primaryPartyPublicId: replacement.publicId });
		expect(updated.closedAt?.toISOString()).toBe('2026-08-15T22:30:00.000Z');
		const participants = await service.getWorkspace(actorManagerA, opportunity.publicId);
		expect(participants.participants.some((row) => row.partyPublicId === client.publicId && !row.isPrimary)).toBe(true);
		expect(participants.participants.some((row) => row.partyPublicId === replacement.publicId && row.isPrimary)).toBe(true);
	});

	it('adds/removes non-primary opportunity parties and protects the primary customer', async () => {
		const crm = new CrmService(db);
		const client = await crm.createParty(actorManagerA, { kind: 'organisation', legalName: `${PREFIX}Participant Client` });
		const consultant = await crm.createParty(actorManagerA, { kind: 'person', givenNames: 'Casey', familyName: 'Consultant' });
		const service = new CrmOpportunityService(db);
		const opportunity = await service.createOpportunity(actorManagerA, {
			title: `${PREFIX}Participants`, pipelinePublicId: pipelineAPublicId, stageName: 'Proposal', primaryPartyPublicId: client.publicId
		});
		await service.addParticipant(actorManagerA, {
			opportunityPublicId: opportunity.publicId, partyPublicId: consultant.publicId, roleCode: 'consultant'
		});
		let workspace = await service.getWorkspace(actorManagerA, opportunity.publicId);
		expect(workspace.participants.some((row) => row.partyPublicId === consultant.publicId && row.roleCode === 'consultant')).toBe(true);
		await service.removeParticipant(actorManagerA, {
			opportunityPublicId: opportunity.publicId, partyPublicId: consultant.publicId, roleCode: 'consultant'
		});
		workspace = await service.getWorkspace(actorManagerA, opportunity.publicId);
		expect(workspace.participants.some((row) => row.partyPublicId === consultant.publicId)).toBe(false);
		await expect(service.removeParticipant(actorManagerA, {
			opportunityPublicId: opportunity.publicId, partyPublicId: client.publicId, roleCode: 'customer'
		})).rejects.toBeInstanceOf(CrmOpportunityValidationError);
	});

	it('logs chronological activities with tenant-safe party and internal-member junctions', async () => {
		const crm = new CrmService(db);
		const client = await crm.createParty(actorManagerA, { kind: 'organisation', legalName: `${PREFIX}Activity Client` });
		const contact = await crm.createParty(actorManagerA, { kind: 'person', givenNames: 'Jamie', familyName: 'Contact' });
		const service = new CrmOpportunityService(db, () => randomUUID(), () => new Date('2026-08-15T22:35:00.000Z'));
		const opportunity = await service.createOpportunity(actorManagerA, {
			title: `${PREFIX}Activity`, pipelinePublicId: pipelineAPublicId, stageName: 'Lead', primaryPartyPublicId: client.publicId
		});
		await service.addParticipant(actorManagerA, {
			opportunityPublicId: opportunity.publicId, partyPublicId: contact.publicId, roleCode: 'contact'
		});
		await service.createActivity(actorManagerA, {
			opportunityPublicId: opportunity.publicId,
			activityTypeCode: 'meeting',
			subject: 'Client briefing',
			body: 'Discussed scope and decision timetable.',
			direction: 'outbound',
			partyPublicIds: [client.publicId, contact.publicId]
		});
		const workspace = await service.getWorkspace(actorManagerA, opportunity.publicId);
		expect(workspace.activities).toHaveLength(1);
		expect(workspace.activities[0]).toMatchObject({ typeCode: 'meeting', subject: 'Client briefing', direction: 'outbound' });
		expect(workspace.activities[0]!.parties.map((party) => party.partyPublicId).sort()).toEqual([client.publicId, contact.publicId].sort());
		const activityId = workspace.activities[0]!.id;
		const memberLink = await db
			.selectFrom('crm_activity_members')
			.select(['organisation_member_id as memberId', 'participant_role as role'])
			.where('organisation_id', '=', organisationAId)
			.where('crm_activity_id', '=', activityId)
			.executeTakeFirstOrThrow();
		expect(memberLink).toEqual({ memberId: managerAMemberId, role: 'owner' });
		await expect(service.createActivity(actorViewerA, {
			opportunityPublicId: opportunity.publicId, activityTypeCode: 'note', subject: 'Denied'
		})).rejects.toBeInstanceOf(TenantAccessError);
	});
});
