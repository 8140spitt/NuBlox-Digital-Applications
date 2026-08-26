import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CommercialRepository } from '$lib/server/commercial/commercial-repository';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CrmOpportunityClientService } from './crm-opportunity-client-service';
import { CrmOpportunityValidationError } from './crm-opportunity-service';
import { CrmPipelineProvisioningService } from './crm-pipeline-provisioning';
import { CrmService } from './crm-service';

const PREFIX = 'CRM Private Customer Integration ';

let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let customerPublicId = '';
let supplierPublicId = '';
let pipelinePublicId = '';
let stageName = '';

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
	if (organisationIds.length === 0) {
		await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
		return;
	}

	await db
		.deleteFrom('crm_activity_members')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('crm_activity_parties')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('crm_activities').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('opportunity_parties')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('opportunities').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('crm_pipeline_stages')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('crm_pipelines').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('party_organisation_contacts')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('party_role_assignments')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('party_phone_numbers')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('party_email_addresses')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('party_persons').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('party_organisations')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('audit_events')
		.where('acting_organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('member_permission_overrides')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('organisation_roles')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('organisation_members')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('organisations').where('id', 'in', organisationIds).execute();
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function assignRole(permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(
		await db
			.insertInto('organisation_roles')
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}CRM Manager`,
				is_active: 1
			})
			.executeTakeFirstOrThrow()
	);
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key as permissionKey'])
		.where('permission_key', 'in', permissionKeys)
		.where('is_active', '=', 1)
		.execute();
	expect(permissions.map((permission) => permission.permissionKey).sort()).toEqual(
		[...permissionKeys].sort()
	);
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
	userId = insertedId(
		await db
			.insertInto('users')
			.values({ public_id: randomUUID(), display_name: `${PREFIX}Owner`, status: 'active' })
			.executeTakeFirstOrThrow()
	);
	organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({ public_id: randomUUID(), legal_name: `${PREFIX}Tenant`, status: 'active' })
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
				joined_at: new Date('2026-08-26T14:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	await assignRole(['crm.view', 'crm.manage']);
	actor = { organisationId, userId, memberId, correlationId: randomUUID() };

	const crm = new CrmService(db, randomUUID);
	const customer = await crm.createParty(actor, {
		kind: 'person',
		givenNames: 'Jamie',
		familyName: 'Homeowner',
		primaryEmail: 'jamie.homeowner@example.test',
		roleCodes: ['client']
	});
	customerPublicId = customer.publicId;
	const supplier = await crm.createParty(actor, {
		kind: 'person',
		givenNames: 'Sam',
		familyName: 'Supplier',
		roleCodes: ['supplier']
	});
	supplierPublicId = supplier.publicId;

	await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
	const pipeline = await db
		.selectFrom('crm_pipelines as pipeline')
		.innerJoin('crm_pipeline_stages as stage', (join) =>
			join
				.onRef('stage.crm_pipeline_id', '=', 'pipeline.id')
				.onRef('stage.organisation_id', '=', 'pipeline.organisation_id')
		)
		.select(['pipeline.public_id as pipelinePublicId', 'stage.name as stageName'])
		.where('pipeline.organisation_id', '=', organisationId)
		.where('pipeline.is_default', '=', 1)
		.where('stage.is_active', '=', 1)
		.orderBy('stage.sort_order', 'asc')
		.executeTakeFirstOrThrow();
	pipelinePublicId = pipeline.pipelinePublicId;
	stageName = pipeline.stageName;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('CRM private person opportunity customers', () => {
	it('lists private clients as customer choices without requiring organisation contacts', async () => {
		const options = await new CrmOpportunityClientService(db).listClientAccounts(actor);
		expect(options).toContainEqual(
			expect.objectContaining({
				publicId: customerPublicId,
				displayName: 'Jamie Homeowner',
				kind: 'person',
				contacts: [],
				primaryContactPublicId: null
			})
		);
		expect(options.map((option) => option.publicId)).not.toContain(supplierPublicId);
	});

	it('uses a private person as both the opportunity customer and commercial contact', async () => {
		const service = new CrmOpportunityClientService(db, randomUUID);
		const opportunity = await service.createOpportunity(actor, {
			title: `${PREFIX}Home extension`,
			pipelinePublicId,
			stageName,
			currencyCode: 'GBP',
			primaryPartyPublicId: customerPublicId,
			clientContactPartyPublicId: ''
		});

		const assignments = await db
			.selectFrom('opportunity_parties as assignment')
			.innerJoin('opportunities as opportunity', 'opportunity.id', 'assignment.opportunity_id')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'assignment.party_id')
					.onRef('party.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin(
				'opportunity_party_role_types as role',
				'role.id',
				'assignment.opportunity_party_role_type_id'
			)
			.select([
				'party.public_id as partyPublicId',
				'role.code as roleCode',
				'assignment.is_primary as isPrimary'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('opportunity.public_id', '=', opportunity.publicId)
			.orderBy('role.code', 'asc')
			.execute();
		expect(assignments).toContainEqual({
			partyPublicId: customerPublicId,
			roleCode: 'customer',
			isPrimary: 1
		});
		expect(assignments).toContainEqual({
			partyPublicId: customerPublicId,
			roleCode: 'client_contact',
			isPrimary: 0
		});

		const commercialCandidate = await new CommercialRepository(
			db
		).findOpportunityCandidateByPublicId(organisationId, opportunity.publicId);
		expect(commercialCandidate?.customerPublicId).toBe(customerPublicId);
		expect(commercialCandidate?.primaryContactPartyId).toBe(commercialCandidate?.customerPartyId);

		const updated = await service.updateOpportunity(actor, {
			opportunityPublicId: opportunity.publicId,
			title: `${PREFIX}Home extension updated`,
			pipelinePublicId,
			stageName,
			currencyCode: 'GBP',
			primaryPartyPublicId: customerPublicId,
			clientContactPartyPublicId: '',
			status: 'open'
		});
		expect(updated.primaryPartyPublicId).toBe(customerPublicId);
		expect(updated.primaryPartyDisplayName).toBe('Jamie Homeowner');
	});

	it('rejects supplier-only people and separate contacts for private customers', async () => {
		const service = new CrmOpportunityClientService(db);
		await expect(
			service.createOpportunity(actor, {
				title: `${PREFIX}Supplier rejected`,
				pipelinePublicId,
				stageName,
				primaryPartyPublicId: supplierPublicId
			})
		).rejects.toBeInstanceOf(CrmOpportunityValidationError);

		await expect(
			service.createOpportunity(actor, {
				title: `${PREFIX}Separate contact rejected`,
				pipelinePublicId,
				stageName,
				primaryPartyPublicId: customerPublicId,
				clientContactPartyPublicId: supplierPublicId
			})
		).rejects.toBeInstanceOf(CrmOpportunityValidationError);
	});
});
