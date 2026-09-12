import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CrmOpportunityService } from '$lib/server/crm/crm-opportunity-service';
import { CrmPipelineProvisioningService } from '$lib/server/crm/crm-pipeline-provisioning';
import { CrmService } from '$lib/server/crm/crm-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CommercialService, CommercialValidationError } from './commercial-service';
import { QuotationProjectConversionService } from './quotation-project-conversion-service';

const PREFIX = 'Quotation Conversion Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let ownerAUserId = '';
let commercialOnlyUserId = '';
let ownerBUserId = '';
let ownerAMemberId = '';
let commercialOnlyMemberId = '';
let ownerBMemberId = '';
let actorOwnerA: TenantActorContext;
let actorCommercialOnly: TenantActorContext;
let actorOwnerB: TenantActorContext;
let acceptedQuotationPublicId = '';
let acceptedEstimatePublicId = '';
let unacceptedQuotationPublicId = '';

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
	if (organisationIds.length > 0) {
		await db
			.deleteFrom('quotation_project_conversions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_responses')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_issue_recipients')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_issue_events')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_party_snapshot_addresses')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_party_snapshots')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_text_blocks')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_item_taxes')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_items')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_sections')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_version_estimates')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('quotation_versions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('quotations').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('estimate_item_cost_components')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('estimate_items').where('organisation_id', 'in', organisationIds).execute();
		await db
			.deleteFrom('estimate_sections')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('estimate_versions')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('estimates').where('organisation_id', 'in', organisationIds).execute();
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
			.deleteFrom('party_addresses')
			.where('organisation_id', 'in', organisationIds)
			.execute();
		await db.deleteFrom('addresses').where('organisation_id', 'in', organisationIds).execute();
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
			.deleteFrom('project_member_roles')
			.where('participant_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('project_organisation_roles')
			.where('participant_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('project_members')
			.where('participant_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('project_organisations')
			.where('participant_organisation_id', 'in', organisationIds)
			.execute();
		await db
			.deleteFrom('projects')
			.where('owning_organisation_id', 'in', organisationIds)
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
				joined_at: new Date('2026-08-16T00:00:00.000Z')
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
			.values({
				organisation_id: organisationId,
				public_id: randomUUID(),
				name: `${PREFIX}${name}`,
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

async function createOpportunity(actor: TenantActorContext, clientName: string): Promise<string> {
	const crm = new CrmService(db);
	const client = await crm.createParty(actor, {
		kind: 'organisation',
		legalName: `${PREFIX}${clientName}`,
		primaryEmail: `${clientName.toLowerCase().replaceAll(' ', '-')}@example.test`,
		roleCodes: ['client']
	});
	await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
	const workspace = await new CrmOpportunityService(db).listWorkspace(actor);
	const pipeline = workspace.pipelines[0];
	if (!pipeline || !pipeline.stages[0]) throw new Error('Expected provisioned CRM pipeline.');
	const opportunity = await new CrmOpportunityService(db).createOpportunity(actor, {
		title: `${PREFIX}${clientName} opportunity`,
		pipelinePublicId: pipeline.publicId,
		stageName: pipeline.stages[0].name,
		estimatedValue: '25000.0000',
		currencyCode: 'GBP',
		primaryPartyPublicId: client.publicId
	});
	return opportunity.publicId;
}

async function createQuotation(
	actor: TenantActorContext,
	clientName: string,
	accepted: boolean
): Promise<{ quotationPublicId: string; estimatePublicId: string }> {
	const commercial = new CommercialService(
		db,
		randomUUID,
		() => new Date('2026-08-16T00:20:00.000Z')
	);
	const opportunityPublicId = await createOpportunity(actor, clientName);
	const estimate = await commercial.createEstimate(actor, {
		opportunityPublicId,
		title: `${clientName} project scope`,
		currencyCode: 'GBP'
	});
	const estimateWorkspace = await commercial.getEstimate(actor, estimate.publicId);
	const labour = estimateWorkspace.salesItemTypes.find((item) => item.code === 'labour');
	const hour = estimateWorkspace.units.find((unit) => unit.code === 'hour');
	if (!labour || !hour) throw new Error('Expected labour/hour reference data.');
	await commercial.addEstimateItem(actor, {
		estimatePublicId: estimate.publicId,
		versionNumber: 1,
		salesItemTypeId: labour.id,
		unitOfMeasureId: hour.id,
		description: 'Accepted project scope',
		quantity: '10.000000',
		sellUnitRate: '100.0000'
	});
	await commercial.finaliseEstimate(actor, estimate.publicId, 1);
	const quotation = await commercial.createQuotationFromEstimate(actor, {
		estimatePublicId: estimate.publicId,
		versionNumber: 1,
		title: `${clientName} accepted works`,
		validUntil: '2026-09-30'
	});
	await commercial.issueQuotation(actor, {
		quotationPublicId: quotation.publicId,
		versionNumber: 1,
		deliveryChannel: 'manual',
		recipientName: `${clientName} representative`
	});
	if (accepted) {
		await commercial.recordQuotationResponse(actor, {
			quotationPublicId: quotation.publicId,
			versionNumber: 1,
			responseType: 'accepted',
			respondentName: `${clientName} representative`,
			respondedAt: '2026-08-16T00:25:00.000Z'
		});
	}
	return { quotationPublicId: quotation.publicId, estimatePublicId: estimate.publicId };
}

beforeAll(async () => {
	db = getDatabase();
	await cleanup();
	ownerAUserId = await createUser('Owner A');
	commercialOnlyUserId = await createUser('Commercial Only A');
	ownerBUserId = await createUser('Owner B');
	organisationAId = await createOrganisation('Tenant A');
	organisationBId = await createOrganisation('Tenant B');
	ownerAMemberId = await createMember(organisationAId, ownerAUserId);
	commercialOnlyMemberId = await createMember(organisationAId, commercialOnlyUserId);
	ownerBMemberId = await createMember(organisationBId, ownerBUserId);

	const fullPermissions = [
		'crm.view',
		'crm.manage',
		'commercial.view',
		'commercial.manage',
		'project.create',
		'project.view'
	];
	await assignPermissionRole(organisationAId, ownerAMemberId, 'Owner A', fullPermissions);
	await assignPermissionRole(organisationAId, commercialOnlyMemberId, 'Commercial Convert Only A', [
		'commercial.view',
		'commercial.quotation.convert'
	]);
	await assignPermissionRole(organisationBId, ownerBMemberId, 'Owner B', fullPermissions);

	actorOwnerA = {
		organisationId: organisationAId,
		userId: ownerAUserId,
		memberId: ownerAMemberId,
		correlationId: randomUUID()
	};
	actorCommercialOnly = {
		organisationId: organisationAId,
		userId: commercialOnlyUserId,
		memberId: commercialOnlyMemberId,
		correlationId: randomUUID()
	};
	actorOwnerB = {
		organisationId: organisationBId,
		userId: ownerBUserId,
		memberId: ownerBMemberId,
		correlationId: randomUUID()
	};

	const accepted = await createQuotation(actorOwnerA, 'Accepted Client', true);
	acceptedQuotationPublicId = accepted.quotationPublicId;
	acceptedEstimatePublicId = accepted.estimatePublicId;
	unacceptedQuotationPublicId = (await createQuotation(actorOwnerA, 'Pending Client', false))
		.quotationPublicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('accepted quotation to project conversion', () => {
	it('requires commercial conversion authority and project.create independently', async () => {
		const service = new QuotationProjectConversionService(db);
		const workspace = await service.getWorkspace(actorCommercialOnly, acceptedQuotationPublicId, 1);
		expect(workspace.hasCommercialConvertPermission).toBe(true);
		expect(workspace.hasProjectCreatePermission).toBe(false);
		expect(workspace.canConvert).toBe(false);
		await expect(
			service.convert(actorCommercialOnly, acceptedQuotationPublicId, 1)
		).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('converts one accepted issued version into one proposed project with explicit provenance', async () => {
		const service = new QuotationProjectConversionService(
			db,
			randomUUID,
			() => new Date('2026-08-16T00:30:00.000Z')
		);
		const before = await service.getWorkspace(actorOwnerA, acceptedQuotationPublicId, 1);
		expect(before.acceptedResponse?.publicId).toHaveLength(36);
		expect(before.project).toBeNull();
		expect(before.canConvert).toBe(true);
		expect(before.sourceEstimates).toHaveLength(1);
		expect(before.sourceEstimates[0]?.projectId).toBeNull();

		const project = await service.convert(actorOwnerA, acceptedQuotationPublicId, 1);
		expect(project.status).toBe('proposed');
		expect(project.projectNumber).toMatch(/^PRJ-/);
		expect(project.name).toBe('Accepted Client accepted works');

		const quotation = await db
			.selectFrom('quotations')
			.select('project_id as projectId')
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', acceptedQuotationPublicId)
			.executeTakeFirstOrThrow();
		expect(quotation.projectId).toBe(project.id);

		const estimate = await db
			.selectFrom('estimates')
			.select('project_id as projectId')
			.where('organisation_id', '=', organisationAId)
			.where('public_id', '=', acceptedEstimatePublicId)
			.executeTakeFirstOrThrow();
		expect(estimate.projectId).toBe(project.id);

		const conversion = await db
			.selectFrom('quotation_project_conversions')
			.select(['quotation_response_id as responseId', 'project_id as projectId'])
			.where('organisation_id', '=', organisationAId)
			.where('project_id', '=', project.id)
			.executeTakeFirstOrThrow();
		expect(conversion.projectId).toBe(project.id);

		const participation = await db
			.selectFrom('project_organisations')
			.select(['participant_organisation_id as organisationId', 'status'])
			.where('project_id', '=', project.id)
			.execute();
		expect(participation).toEqual([{ organisationId: organisationAId, status: 'active' }]);

		const members = await db
			.selectFrom('project_members')
			.select([
				'participant_organisation_id as organisationId',
				'organisation_member_id as memberId',
				'status'
			])
			.where('project_id', '=', project.id)
			.execute();
		expect(members).toEqual([
			{ organisationId: organisationAId, memberId: ownerAMemberId, status: 'active' }
		]);

		const audits = await db
			.selectFrom('audit_events')
			.select('action_key as actionKey')
			.where('acting_organisation_id', '=', organisationAId)
			.where('project_id', '=', project.id)
			.where('action_key', 'in', [
				'commercial.quotation.converted_to_project',
				'project.created_from_quotation'
			])
			.orderBy('action_key', 'asc')
			.execute();
		expect(audits.map((row) => row.actionKey)).toEqual([
			'commercial.quotation.converted_to_project',
			'project.created_from_quotation'
		]);
	});

	it('is idempotent and returns the same project on retry', async () => {
		const service = new QuotationProjectConversionService(db);
		const first = await service.getWorkspace(actorOwnerA, acceptedQuotationPublicId, 1);
		expect(first.project).not.toBeNull();
		const retried = await service.convert(actorOwnerA, acceptedQuotationPublicId, 1);
		expect(retried.id).toBe(first.project?.id);
		expect(retried.publicId).toBe(first.project?.publicId);

		const response = first.acceptedResponse;
		if (!response) throw new Error('Expected accepted response.');
		const conversions = await db
			.selectFrom('quotation_project_conversions')
			.select('id')
			.where('organisation_id', '=', organisationAId)
			.where('quotation_response_id', '=', response.id)
			.execute();
		expect(conversions).toHaveLength(1);
	});

	it('rejects unaccepted versions and masks a foreign-tenant quotation', async () => {
		const service = new QuotationProjectConversionService(db);
		await expect(
			service.convert(actorOwnerA, unacceptedQuotationPublicId, 1)
		).rejects.toBeInstanceOf(CommercialValidationError);
		await expect(service.convert(actorOwnerB, acceptedQuotationPublicId, 1)).rejects.toBeInstanceOf(
			RecordNotFoundError
		);
	});
});
