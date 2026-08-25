import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CrmOpportunityClientService } from './crm-opportunity-client-service';
import { CrmOpportunityValidationError } from './crm-opportunity-service';
import { CrmOrganisationContactPolicyService } from './crm-organisation-contact-policy-service';
import { CrmOrganisationOnboardingService } from './crm-organisation-onboarding-service';
import { CrmPipelineProvisioningService } from './crm-pipeline-provisioning';
import { CrmService, CrmValidationError } from './crm-service';

const PREFIX = 'CRM Account Context Integration ';

let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let clientPublicId = '';
let primaryContactPublicId = '';
let secondaryContactPublicId = '';
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

	await db.deleteFrom('crm_activity_members').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('crm_activity_parties').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('crm_activities').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('opportunity_parties').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('opportunities').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('crm_pipeline_stages').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('crm_pipelines').where('organisation_id', 'in', organisationIds).execute();
	await db
		.deleteFrom('party_organisation_contacts')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('party_role_assignments').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('party_phone_numbers').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('party_email_addresses').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('party_persons').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('party_organisations').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('parties').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('audit_events').where('acting_organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('member_permission_overrides').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('member_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('role_permissions').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_roles').where('organisation_id', 'in', organisationIds).execute();
	await db.deleteFrom('organisation_members').where('organisation_id', 'in', organisationIds).execute();
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
				joined_at: new Date('2026-08-25T19:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	await assignRole(['crm.view', 'crm.manage']);
	actor = {
		organisationId,
		userId,
		memberId,
		correlationId: randomUUID()
	};

	const onboarding = new CrmOrganisationOnboardingService(
		db,
		randomUUID,
		() => new Date('2026-08-25T19:10:00.000Z')
	);
	const client = await onboarding.createOrganisation(actor, {
		legalName: `${PREFIX}Client Ltd`,
		organisationEmail: 'accounts@client.example.test',
		roleCodes: ['client'],
		contactGivenNames: 'Alex',
		contactFamilyName: 'Client',
		contactEmail: 'alex@client.example.test',
		contactJobTitle: 'Commercial Director'
	});
	clientPublicId = client.publicId;
	const clientWorkspace = await new CrmService(db).getPartyWorkspace(actor, client.publicId);
	primaryContactPublicId = clientWorkspace.contacts[0]?.personPublicId ?? '';

	const secondary = await new CrmService(db).createOrganisationContact(actor, client.publicId, {
		givenNames: 'Sam',
		familyName: 'Estimator',
		primaryEmail: 'sam@client.example.test',
		jobTitle: 'Estimator',
		isPrimaryContact: false
	});
	secondaryContactPublicId = secondary.publicId;

	const supplier = await onboarding.createOrganisation(actor, {
		legalName: `${PREFIX}Supplier Ltd`,
		roleCodes: ['supplier'],
		contactGivenNames: 'Pat',
		contactFamilyName: 'Supplier'
	});
	supplierPublicId = supplier.publicId;

	await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
	const opportunityWorkspace = await new CrmOpportunityClientService(db).listClientAccounts(actor);
	expect(opportunityWorkspace.map((account) => account.publicId)).toContain(clientPublicId);
	expect(opportunityWorkspace.map((account) => account.publicId)).not.toContain(supplierPublicId);
	const pipelines = await db
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
	pipelinePublicId = pipelines.pipelinePublicId;
	stageName = pipelines.stageName;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('CRM organisation and opportunity client context', () => {
	it('creates an organisation and its first primary contact atomically', async () => {
		const workspace = await new CrmService(db).getPartyWorkspace(actor, clientPublicId);
		expect(workspace.party.kind).toBe('organisation');
		expect(workspace.contacts).toHaveLength(2);
		expect(workspace.contacts.filter((contact) => contact.isPrimaryContact)).toHaveLength(1);
		expect(workspace.contacts.find((contact) => contact.isPrimaryContact)?.personPublicId).toBe(
			primaryContactPublicId
		);

		const before = await db
			.selectFrom('parties')
			.select(({ fn }) => fn.countAll<string>().as('count'))
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		await expect(
			new CrmOrganisationOnboardingService(db).createOrganisation(actor, {
				legalName: `${PREFIX}Invalid Client Ltd`,
				roleCodes: ['client']
			})
		).rejects.toBeInstanceOf(CrmValidationError);
		const after = await db
			.selectFrom('parties')
			.select(({ fn }) => fn.countAll<string>().as('count'))
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(after.count).toBe(before.count);
	});

	it('defaults a blank opportunity contact to the client organisation primary contact', async () => {
		const service = new CrmOpportunityClientService(db, randomUUID);
		const opportunity = await service.createOpportunity(actor, {
			title: `${PREFIX}Primary default opportunity`,
			pipelinePublicId,
			stageName,
			currencyCode: 'GBP',
			primaryPartyPublicId: clientPublicId,
			clientContactPartyPublicId: ''
		});
		const participants = await new CrmService(db)
			.getPartyWorkspace(actor, clientPublicId)
			.then(() =>
				db
					.selectFrom('opportunity_parties as assignment')
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
					.innerJoin('opportunities as opportunity', 'opportunity.id', 'assignment.opportunity_id')
					.select(['party.public_id as partyPublicId', 'role.code as roleCode', 'assignment.is_primary as isPrimary'])
					.where('assignment.organisation_id', '=', organisationId)
					.where('opportunity.public_id', '=', opportunity.publicId)
					.orderBy('role.code', 'asc')
					.execute()
			);
		expect(participants).toContainEqual({
			partyPublicId: clientPublicId,
			roleCode: 'customer',
			isPrimary: 1
		});
		expect(participants).toContainEqual({
			partyPublicId: primaryContactPublicId,
			roleCode: 'contact',
			isPrimary: 0
		});
	});

	it('accepts an explicit contact only when it belongs to the selected client organisation', async () => {
		const service = new CrmOpportunityClientService(db);
		const opportunity = await service.createOpportunity(actor, {
			title: `${PREFIX}Explicit contact opportunity`,
			pipelinePublicId,
			stageName,
			currencyCode: 'GBP',
			primaryPartyPublicId: clientPublicId,
			clientContactPartyPublicId: secondaryContactPublicId
		});
		const selectedContact = await db
			.selectFrom('opportunity_parties as assignment')
			.innerJoin('opportunity_party_role_types as role', 'role.id', 'assignment.opportunity_party_role_type_id')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'assignment.party_id')
					.onRef('party.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('opportunities as opportunity', 'opportunity.id', 'assignment.opportunity_id')
			.select('party.public_id as partyPublicId')
			.where('assignment.organisation_id', '=', organisationId)
			.where('opportunity.public_id', '=', opportunity.publicId)
			.where('role.code', '=', 'contact')
			.executeTakeFirstOrThrow();
		expect(selectedContact.partyPublicId).toBe(secondaryContactPublicId);

		await expect(
			service.createOpportunity(actor, {
				title: `${PREFIX}Supplier rejected opportunity`,
				pipelinePublicId,
				stageName,
				currencyCode: 'GBP',
				primaryPartyPublicId: supplierPublicId,
				clientContactPartyPublicId: ''
			})
		).rejects.toBeInstanceOf(CrmOpportunityValidationError);
	});

	it('prevents an organisation from losing its last contact or current primary contact', async () => {
		const policy = new CrmOrganisationContactPolicyService(db);
		await expect(
			policy.endOrganisationContact(actor, clientPublicId, primaryContactPublicId)
		).rejects.toBeInstanceOf(CrmValidationError);

		const supplierWorkspace = await new CrmService(db).getPartyWorkspace(actor, supplierPublicId);
		const supplierContactPublicId = supplierWorkspace.contacts[0]?.personPublicId;
		if (!supplierContactPublicId) throw new Error('Expected supplier primary contact.');
		await expect(
			policy.endOrganisationContact(actor, supplierPublicId, supplierContactPublicId)
		).rejects.toBeInstanceOf(CrmValidationError);
	});
});
