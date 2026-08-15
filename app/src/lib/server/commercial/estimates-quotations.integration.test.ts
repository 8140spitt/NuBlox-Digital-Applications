import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CrmOpportunityService } from '$lib/server/crm/crm-opportunity-service';
import { CrmPipelineProvisioningService } from '$lib/server/crm/crm-pipeline-provisioning';
import { CrmService } from '$lib/server/crm/crm-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { CommercialService, CommercialValidationError } from './commercial-service';

const PREFIX = 'Commercial Sales Integration ';

let db: Database;
let organisationAId = '';
let organisationBId = '';
let managerAMemberId = '';
let viewerAMemberId = '';
let managerBMemberId = '';
let managerAUserId = '';
let viewerAUserId = '';
let managerBUserId = '';
let actorManagerA: TenantActorContext;
let actorViewerA: TenantActorContext;
let actorManagerB: TenantActorContext;
let opportunityAPublicId = '';
let opportunityBPublicId = '';
let clientAPublicId = '';
let taxCategoryPublicId = '';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function cleanup(): Promise<void> {
	if (!db) return;
	const organisations = await db.selectFrom('organisations').select('id').where('legal_name', 'like', `${PREFIX}%`).execute();
	const organisationIds = organisations.map((row) => row.id);
	if (organisationIds.length > 0) {
		await db.deleteFrom('quotation_project_conversions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_responses').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_issue_recipients').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_issue_events').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_party_snapshot_addresses').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_party_snapshots').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_text_blocks').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_item_taxes').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_items').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_sections').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_version_estimates').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotation_versions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('quotations').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('estimate_item_cost_components').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('estimate_items').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('estimate_sections').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('estimate_versions').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('estimates').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('sales_catalog_item_prices').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('sales_catalog_items').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('tax_category_rates').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('tax_categories').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('crm_activity_members').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('crm_activity_parties').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('crm_activities').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('opportunity_parties').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('opportunities').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('crm_pipeline_stages').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('crm_pipelines').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_organisation_contacts').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('party_addresses').where('organisation_id', 'in', organisationIds).execute();
		await db.deleteFrom('addresses').where('organisation_id', 'in', organisationIds).execute();
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
	}
	await db.deleteFrom('users').where('display_name', 'like', `${PREFIX}%`).execute();
}

async function createUser(name: string): Promise<string> {
	return insertedId(await db.insertInto('users').values({ public_id: randomUUID(), display_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createOrganisation(name: string): Promise<string> {
	return insertedId(await db.insertInto('organisations').values({ public_id: randomUUID(), legal_name: `${PREFIX}${name}`, status: 'active' }).executeTakeFirstOrThrow());
}

async function createMember(organisationId: string, userId: string): Promise<string> {
	return insertedId(await db.insertInto('organisation_members').values({ organisation_id: organisationId, user_id: userId, public_id: randomUUID(), status: 'active', joined_at: new Date('2026-08-15T22:00:00.000Z') }).executeTakeFirstOrThrow());
}

async function assignPermissionRole(organisationId: string, memberId: string, name: string, permissionKeys: string[]): Promise<void> {
	const roleId = insertedId(await db.insertInto('organisation_roles').values({ organisation_id: organisationId, public_id: randomUUID(), name: `${PREFIX}${name}`, is_active: 1 }).executeTakeFirstOrThrow());
	const permissions = await db.selectFrom('permissions').select(['id', 'permission_key']).where('permission_key', 'in', permissionKeys).where('is_active', '=', 1).execute();
	expect(permissions.map((row) => row.permission_key).sort()).toEqual([...permissionKeys].sort());
	await db.insertInto('role_permissions').values(permissions.map((permission) => ({ organisation_id: organisationId, organisation_role_id: roleId, permission_id: permission.id }))).execute();
	await db.insertInto('member_roles').values({ organisation_id: organisationId, organisation_member_id: memberId, organisation_role_id: roleId }).executeTakeFirstOrThrow();
}

async function createOpportunity(actor: TenantActorContext, clientName: string): Promise<{ opportunityPublicId: string; clientPublicId: string }> {
	const crm = new CrmService(db);
	const client = await crm.createParty(actor, { kind: 'organisation', legalName: `${PREFIX}${clientName}`, primaryEmail: `${clientName.toLowerCase().replaceAll(' ', '-')}@example.test`, roleCodes: ['client'] });
	await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
	const workspace = await new CrmOpportunityService(db).listWorkspace(actor);
	const pipeline = workspace.pipelines[0];
	if (!pipeline || !pipeline.stages[0]) throw new Error('Expected provisioned CRM pipeline.');
	const opportunity = await new CrmOpportunityService(db).createOpportunity(actor, {
		title: `${PREFIX}${clientName} opportunity`,
		pipelinePublicId: pipeline.publicId,
		stageName: pipeline.stages[0].name,
		estimatedValue: '15000.0000',
		currencyCode: 'GBP',
		primaryPartyPublicId: client.publicId
	});
	return { opportunityPublicId: opportunity.publicId, clientPublicId: client.publicId };
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

	const commercialManagerPermissions = [
		'crm.view', 'crm.manage', 'commercial.view', 'commercial.estimate.manage', 'commercial.quotation.manage',
		'commercial.quotation.issue', 'commercial.quotation.response.record'
	];
	await assignPermissionRole(organisationAId, managerAMemberId, 'Manager A', commercialManagerPermissions);
	await assignPermissionRole(organisationAId, viewerAMemberId, 'Viewer A', ['commercial.view']);
	await assignPermissionRole(organisationBId, managerBMemberId, 'Manager B', commercialManagerPermissions);

	actorManagerA = { organisationId: organisationAId, userId: managerAUserId, memberId: managerAMemberId, correlationId: randomUUID() };
	actorViewerA = { organisationId: organisationAId, userId: viewerAUserId, memberId: viewerAMemberId, correlationId: randomUUID() };
	actorManagerB = { organisationId: organisationBId, userId: managerBUserId, memberId: managerBMemberId, correlationId: randomUUID() };

	const a = await createOpportunity(actorManagerA, 'Client A');
	opportunityAPublicId = a.opportunityPublicId;
	clientAPublicId = a.clientPublicId;
	const b = await createOpportunity(actorManagerB, 'Client B');
	opportunityBPublicId = b.opportunityPublicId;

	const client = await db.selectFrom('parties').select('id').where('organisation_id', '=', organisationAId).where('public_id', '=', clientAPublicId).executeTakeFirstOrThrow();
	const addressId = insertedId(await db.insertInto('addresses').values({ organisation_id: organisationAId, line_1: '1 Commercial Street', city: 'London', postal_code: 'EC1A 1AA', country_code: 'GB' }).executeTakeFirstOrThrow());
	await db.insertInto('party_addresses').values({ organisation_id: organisationAId, party_id: client.id, address_id: addressId, address_role: 'business', is_primary: 1 }).executeTakeFirstOrThrow();

	taxCategoryPublicId = randomUUID();
	const taxCategoryId = insertedId(await db.insertInto('tax_categories').values({ organisation_id: organisationAId, public_id: taxCategoryPublicId, code: 'VAT20', name: 'Test VAT 20%', treatment: 'taxable', is_active: 1 }).executeTakeFirstOrThrow());
	await db.insertInto('tax_category_rates').values({ organisation_id: organisationAId, tax_category_id: taxCategoryId, rate_percent: '20.0000', valid_from: new Date('2020-01-01T00:00:00.000Z'), valid_to: null }).executeTakeFirstOrThrow();
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('estimates and quotations', () => {
	it('separates commercial read and mutation permissions', async () => {
		const manager = await new CommercialService(db).listEstimates(actorManagerA);
		expect(manager.canView).toBe(true);
		expect(manager.canManageEstimates).toBe(true);
		expect(manager.canManageQuotations).toBe(true);
		const viewer = await new CommercialService(db).listEstimates(actorViewerA);
		expect(viewer.canView).toBe(true);
		expect(viewer.canManageEstimates).toBe(false);
		expect(viewer.canManageQuotations).toBe(false);
		await expect(new CommercialService(db).createEstimate(actorViewerA, { opportunityPublicId: opportunityAPublicId, title: 'Denied' })).rejects.toBeInstanceOf(TenantAccessError);
	});

	it('creates an estimate only from a same-tenant CRM opportunity', async () => {
		const service = new CommercialService(db, randomUUID, () => new Date('2026-08-16T00:00:00.000Z'));
		const estimate = await service.createEstimate(actorManagerA, { opportunityPublicId: opportunityAPublicId, title: 'Electrical works', currencyCode: 'GBP', notes: 'Initial build-up' });
		expect(estimate.estimateNumber).toMatch(/^EST-20260816-/);
		expect(estimate.opportunityPublicId).toBe(opportunityAPublicId);
		await expect(service.createEstimate(actorManagerA, { opportunityPublicId: opportunityBPublicId, title: 'Cross tenant' })).rejects.toBeInstanceOf(RecordNotFoundError);
	});

	it('builds estimate lines and internal cost components with fixed-point totals then freezes the final version', async () => {
		const service = new CommercialService(db, randomUUID, () => new Date('2026-08-16T00:05:00.000Z'));
		const estimate = await service.createEstimate(actorManagerA, { opportunityPublicId: opportunityAPublicId, title: 'Distribution board', currencyCode: 'GBP' });
		const workspace = await service.getEstimate(actorManagerA, estimate.publicId);
		const labour = workspace.salesItemTypes.find((item) => item.code === 'labour')!;
		const hour = workspace.units.find((unit) => unit.code === 'hour')!;
		await service.addEstimateItem(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, salesItemTypeId: labour.id, unitOfMeasureId: hour.id, description: 'Install distribution board', quantity: '2.000000', sellUnitRate: '125.5000' });
		await service.addEstimateCostComponent(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, lineNumber: 10, salesItemTypeId: labour.id, unitOfMeasureId: hour.id, description: 'Electrician labour', quantity: '3.000000', unitCost: '40.0000', wastePercent: '10.0000', markupPercent: '25.0000' });
		const built = await service.getEstimate(actorManagerA, estimate.publicId);
		expect(built.sellTotal).toBe('251.0000');
		expect(built.costTotal).toBe('132.0000');
		expect(built.marginAmount).toBe('119.0000');
		await service.finaliseEstimate(actorManagerA, estimate.publicId, 1);
		const finalised = await service.getEstimate(actorManagerA, estimate.publicId);
		expect(finalised.version.versionStatus).toBe('final');
		await expect(service.addEstimateItem(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, salesItemTypeId: labour.id, unitOfMeasureId: hour.id, description: 'Late edit', quantity: '1', sellUnitRate: '1' })).rejects.toBeInstanceOf(CommercialValidationError);
	});

	it('creates a quotation from a final estimate without duplicating the CRM customer and snapshots tax with decimal arithmetic', async () => {
		const service = new CommercialService(db, randomUUID, () => new Date('2026-08-16T00:10:00.000Z'));
		const estimate = await service.createEstimate(actorManagerA, { opportunityPublicId: opportunityAPublicId, title: 'Quoted works', currencyCode: 'GBP' });
		const estimateWorkspace = await service.getEstimate(actorManagerA, estimate.publicId);
		const serviceType = estimateWorkspace.salesItemTypes.find((item) => item.code === 'service')!;
		const lump = estimateWorkspace.units.find((unit) => unit.code === 'lump_sum')!;
		await service.addEstimateItem(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, salesItemTypeId: serviceType.id, unitOfMeasureId: lump.id, description: 'Design and installation', quantity: '1.000000', sellUnitRate: '999.9900' });
		await service.finaliseEstimate(actorManagerA, estimate.publicId, 1);
		const quotation = await service.createQuotationFromEstimate(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, title: 'Proposal', validUntil: '2026-09-16' });
		let quoteWorkspace = await service.getQuotation(actorManagerA, quotation.publicId);
		expect(quoteWorkspace.quotation.customerPublicId).toBe(clientAPublicId);
		expect(quoteWorkspace.items).toHaveLength(1);
		expect(quoteWorkspace.netTotal).toBe('999.9900');
		await service.setQuotationLineTax(actorManagerA, quotation.publicId, 1, 10, taxCategoryPublicId);
		quoteWorkspace = await service.getQuotation(actorManagerA, quotation.publicId);
		expect(quoteWorkspace.items[0].taxAmount).toBe('199.9980');
		expect(quoteWorkspace.taxTotal).toBe('199.9980');
		expect(quoteWorkspace.grossTotal).toBe('1199.9880');
	});

	it('locks an issued quotation, creates party/address snapshots and rejects post-issue draft mutation', async () => {
		const service = new CommercialService(db, randomUUID, () => new Date('2026-08-16T00:15:00.000Z'));
		const estimate = await service.createEstimate(actorManagerA, { opportunityPublicId: opportunityAPublicId, title: 'Issue test', currencyCode: 'GBP' });
		const ew = await service.getEstimate(actorManagerA, estimate.publicId);
		const type = ew.salesItemTypes.find((item) => item.code === 'professional_fee')!;
		const lump = ew.units.find((unit) => unit.code === 'lump_sum')!;
		await service.addEstimateItem(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, salesItemTypeId: type.id, unitOfMeasureId: lump.id, description: 'Professional service', quantity: '1', sellUnitRate: '500.0000' });
		await service.finaliseEstimate(actorManagerA, estimate.publicId, 1);
		const quotation = await service.createQuotationFromEstimate(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, title: 'Issue test quotation' });
		await service.issueQuotation(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, deliveryChannel: 'manual', recipientName: 'Client A contact', recipientEmail: 'client-a@example.test' });
		const issued = await service.getQuotation(actorManagerA, quotation.publicId);
		expect(issued.version.versionStatus).toBe('issued');
		expect(issued.effectiveStatus).toBe('issued');
		expect(issued.issues).toHaveLength(1);
		const snapshots = await db.selectFrom('quotation_party_snapshots').select('id').where('organisation_id', '=', organisationAId).where('quotation_version_id', '=', issued.version.id).execute();
		expect(snapshots.length).toBeGreaterThanOrEqual(1);
		const addresses = await db.selectFrom('quotation_party_snapshot_addresses').select('id').where('organisation_id', '=', organisationAId).where('quotation_version_id', '=', issued.version.id).execute();
		expect(addresses).toHaveLength(1);
		await expect(service.updateQuotationDraft(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, title: 'Illegal post-issue edit' })).rejects.toBeInstanceOf(CommercialValidationError);
	});

	it('records one accepted customer response only for an issued version and resolves accepted effective status', async () => {
		const service = new CommercialService(db, randomUUID, () => new Date('2026-08-16T00:20:00.000Z'));
		const estimate = await service.createEstimate(actorManagerA, { opportunityPublicId: opportunityAPublicId, title: 'Acceptance test', currencyCode: 'GBP' });
		const ew = await service.getEstimate(actorManagerA, estimate.publicId);
		const type = ew.salesItemTypes.find((item) => item.code === 'other')!;
		const itemUnit = ew.units.find((unit) => unit.code === 'item')!;
		await service.addEstimateItem(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1, salesItemTypeId: type.id, unitOfMeasureId: itemUnit.id, description: 'Accepted item', quantity: '1', sellUnitRate: '50' });
		await service.finaliseEstimate(actorManagerA, estimate.publicId, 1);
		const quotation = await service.createQuotationFromEstimate(actorManagerA, { estimatePublicId: estimate.publicId, versionNumber: 1 });
		await expect(service.recordQuotationResponse(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, responseType: 'accepted' })).rejects.toBeInstanceOf(CommercialValidationError);
		await service.issueQuotation(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, deliveryChannel: 'manual', recipientName: 'Client A' });
		await service.recordQuotationResponse(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, responseType: 'accepted', notes: 'Accepted by customer' });
		const accepted = await service.getQuotation(actorManagerA, quotation.publicId);
		expect(accepted.effectiveStatus).toBe('accepted');
		expect(accepted.responses[0].responseType).toBe('accepted');
		await expect(service.recordQuotationResponse(actorManagerA, { quotationPublicId: quotation.publicId, versionNumber: 1, responseType: 'accepted' })).rejects.toBeInstanceOf(CommercialValidationError);
	});

	it('masks foreign-tenant estimate and quotation public IDs', async () => {
		const serviceA = new CommercialService(db);
		const serviceB = new CommercialService(db);
		const estimateB = await serviceB.createEstimate(actorManagerB, { opportunityPublicId: opportunityBPublicId, title: 'Tenant B estimate' });
		await expect(serviceA.getEstimate(actorManagerA, estimateB.publicId)).rejects.toBeInstanceOf(RecordNotFoundError);
		const wb = await serviceB.getEstimate(actorManagerB, estimateB.publicId);
		const type = wb.salesItemTypes[0];
		const unit = wb.units[0];
		await serviceB.addEstimateItem(actorManagerB, { estimatePublicId: estimateB.publicId, versionNumber: 1, salesItemTypeId: type.id, unitOfMeasureId: unit.id, description: 'Tenant B line', quantity: '1', sellUnitRate: '10' });
		await serviceB.finaliseEstimate(actorManagerB, estimateB.publicId, 1);
		const quoteB = await serviceB.createQuotationFromEstimate(actorManagerB, { estimatePublicId: estimateB.publicId, versionNumber: 1 });
		await expect(serviceA.getQuotation(actorManagerA, quoteB.publicId)).rejects.toBeInstanceOf(RecordNotFoundError);
	});
});
