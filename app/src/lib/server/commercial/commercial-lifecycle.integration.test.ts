import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { ContractService, ContractValidationError } from '$lib/server/contracts/contract-service';
import { CrmOpportunityService } from '$lib/server/crm/crm-opportunity-service';
import { CrmPipelineProvisioningService } from '$lib/server/crm/crm-pipeline-provisioning';
import { CrmService } from '$lib/server/crm/crm-service';
import { closeDatabase, getDatabase, type Database } from '$lib/server/db/database';
import { CommercialLifecycleService } from './commercial-lifecycle-service';
import { CommercialService } from './commercial-service';

const PREFIX = 'Commercial Lifecycle Integration ';

let db: Database;
let organisationId = '';
let userId = '';
let memberId = '';
let actor: TenantActorContext;
let customerPartyPublicId = '';
let opportunityPublicId = '';
let estimatePublicId = '';
let quotationPublicId = '';
let contractPublicId = '';
let projectPublicId = '';

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
		.deleteFrom('contract_execution_signatories')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_execution_events')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_issue_recipients')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_issue_events')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_version_party_addresses')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_version_parties')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_version_key_dates')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_version_value_components')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db
		.deleteFrom('contract_versions')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('contracts').where('organisation_id', 'in', organisationIds).execute();

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
	await db.deleteFrom('quotation_items').where('organisation_id', 'in', organisationIds).execute();
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
	await db.deleteFrom('projects').where('owning_organisation_id', 'in', organisationIds).execute();

	await db
		.deleteFrom('party_organisation_contacts')
		.where('organisation_id', 'in', organisationIds)
		.execute();
	await db.deleteFrom('party_addresses').where('organisation_id', 'in', organisationIds).execute();
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
				name: `${PREFIX}Owner`,
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
				legal_name: `${PREFIX}Tenant`,
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
				joined_at: new Date('2026-08-25T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	await assignRole([
		'crm.view',
		'crm.manage',
		'commercial.view',
		'commercial.manage',
		'contract.view',
		'contract.manage',
		'project.create',
		'project.view'
	]);
	actor = {
		organisationId,
		userId,
		memberId,
		correlationId: randomUUID()
	};

	const customer = await new CrmService(db).createParty(actor, {
		kind: 'organisation',
		legalName: `${PREFIX}Customer Ltd`,
		primaryEmail: 'commercial-lifecycle@example.test',
		roleCodes: ['client']
	});
	customerPartyPublicId = customer.publicId;
	await new CrmPipelineProvisioningService(db).ensureDefaultPipeline(actor);
	const pipelineWorkspace = await new CrmOpportunityService(db).listWorkspace(actor);
	const pipeline = pipelineWorkspace.pipelines[0];
	const stage = pipeline?.stages[0];
	if (!pipeline || !stage) throw new Error('Expected a provisioned CRM pipeline.');
	const opportunity = await new CrmOpportunityService(db).createOpportunity(actor, {
		title: `${PREFIX}Distribution Centre`,
		description: 'Initial customer scope captured once in CRM.',
		pipelinePublicId: pipeline.publicId,
		stageName: stage.name,
		estimatedValue: '150000.0000',
		currencyCode: 'GBP',
		primaryPartyPublicId: customer.publicId
	});
	opportunityPublicId = opportunity.publicId;
});

afterAll(async () => {
	await cleanup();
	await closeDatabase();
});

describe('commercial opportunity to project progression', () => {
	it('develops one estimate from the opportunity without reselecting customer context', async () => {
		const lifecycle = new CommercialLifecycleService(
			db,
			randomUUID,
			() => new Date('2026-08-25T12:00:00.000Z')
		);
		const initialJourney = await lifecycle.getOpportunityJourney(actor, opportunityPublicId);
		expect(initialJourney.customerDisplayName).toBe(`${PREFIX}Customer Ltd`);
		expect(initialJourney.nextAction).toMatchObject({
			label: 'Develop estimate',
			action: 'develop_estimate'
		});

		const estimate = await lifecycle.developEstimate(actor, opportunityPublicId);
		estimatePublicId = estimate.publicId;
		const retried = await lifecycle.developEstimate(actor, opportunityPublicId);
		expect(retried.publicId).toBe(estimate.publicId);

		const estimateRow = await db
			.selectFrom('estimates as estimate')
			.innerJoin('opportunities as opportunity', (join) =>
				join
					.onRef('opportunity.id', '=', 'estimate.opportunity_id')
					.onRef('opportunity.organisation_id', '=', 'estimate.organisation_id')
			)
			.select([
				'estimate.title',
				'estimate.currency_code as currencyCode',
				'opportunity.public_id as opportunityPublicId'
			])
			.where('estimate.organisation_id', '=', organisationId)
			.where('estimate.public_id', '=', estimate.publicId)
			.executeTakeFirstOrThrow();
		expect(estimateRow).toEqual({
			title: `${PREFIX}Distribution Centre`,
			currencyCode: 'GBP',
			opportunityPublicId
		});

		const journey = await lifecycle.getOpportunityJourney(actor, opportunityPublicId);
		expect(journey.stages.find((stageItem) => stageItem.key === 'estimate')?.reference).toBe(
			estimate.estimateNumber
		);
		expect(journey.nextAction.label).toBe('Continue estimate');
	});

	it('forms the contract from the accepted quotation while the project remains absent', async () => {
		const commercial = new CommercialService(
			db,
			randomUUID,
			() => new Date('2026-08-25T12:15:00.000Z')
		);
		const estimate = await commercial.getEstimate(actor, estimatePublicId);
		const labour = estimate.salesItemTypes.find((item) => item.code === 'labour');
		const hour = estimate.units.find((unit) => unit.code === 'hour');
		if (!labour || !hour) throw new Error('Expected labour/hour reference data.');
		await commercial.addEstimateItem(actor, {
			estimatePublicId,
			versionNumber: 1,
			salesItemTypeId: labour.id,
			unitOfMeasureId: hour.id,
			description: 'Accepted construction scope',
			quantity: '100.000000',
			sellUnitRate: '1250.0000'
		});
		await commercial.finaliseEstimate(actor, estimatePublicId, 1);
		const quotation = await commercial.createQuotationFromEstimate(actor, {
			estimatePublicId,
			versionNumber: 1,
			title: `${PREFIX}Distribution Centre offer`,
			validUntil: '2026-09-30'
		});
		quotationPublicId = quotation.publicId;
		await commercial.issueQuotation(actor, {
			quotationPublicId,
			versionNumber: 1,
			deliveryChannel: 'manual',
			recipientName: `${PREFIX}Customer Signatory`,
			recipientEmail: 'commercial-lifecycle@example.test'
		});
		await commercial.recordQuotationResponse(actor, {
			quotationPublicId,
			versionNumber: 1,
			responseType: 'accepted',
			respondedAt: '2026-08-25T12:30:00.000Z',
			respondentName: `${PREFIX}Customer Signatory`,
			respondentEmail: 'commercial-lifecycle@example.test'
		});

		const lifecycle = new CommercialLifecycleService(
			db,
			randomUUID,
			() => new Date('2026-08-25T12:35:00.000Z')
		);
		const formation = await lifecycle.getAcceptedQuotationContractFormationWorkspace(
			actor,
			quotationPublicId,
			1
		);
		expect(formation.quotation.customerDisplayName).toBe(`${PREFIX}Customer Ltd`);
		expect(formation.legacyProject).toBeNull();
		expect(formation.quotation.netAmount).toBe('125000.0000');
		const contractType = formation.contractTypes.find(
			(type) => type.code === 'construction_contract'
		);
		if (!contractType) throw new Error('Expected construction contract type.');

		const contract = await lifecycle.formContractFromAcceptedQuotation(actor, {
			quotationPublicId,
			versionNumber: 1,
			contractTypeCode: contractType.code,
			title: `${PREFIX}Distribution Centre contract`,
			customerReference: 'CUSTOMER-PO-42'
		});
		contractPublicId = contract.publicId;
		expect(contract.projectPublicId).toBeNull();

		const contractRow = await db
			.selectFrom('contracts as contract')
			.innerJoin('opportunities as opportunity', (join) =>
				join
					.onRef('opportunity.id', '=', 'contract.opportunity_id')
					.onRef('opportunity.organisation_id', '=', 'contract.organisation_id')
			)
			.select([
				'contract.project_id as projectId',
				'contract.source_quotation_response_id as sourceResponseId',
				'opportunity.public_id as opportunityPublicId',
				'opportunity.status as opportunityStatus'
			])
			.where('contract.organisation_id', '=', organisationId)
			.where('contract.public_id', '=', contractPublicId)
			.executeTakeFirstOrThrow();
		expect(contractRow.projectId).toBeNull();
		expect(contractRow.sourceResponseId).not.toBeNull();
		expect(contractRow.opportunityPublicId).toBe(opportunityPublicId);
		expect(contractRow.opportunityStatus).toBe('won');

		const partySnapshot = await db
			.selectFrom('contract_version_parties')
			.select('display_name as displayName')
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(partySnapshot.displayName).toBe(`${PREFIX}Customer Ltd`);

		const customerParty = await db
			.selectFrom('parties')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', customerPartyPublicId)
			.executeTakeFirstOrThrow();
		await db
			.updateTable('party_organisations')
			.set({ legal_name: `${PREFIX}Customer Renamed Ltd` })
			.where('organisation_id', '=', organisationId)
			.where('party_id', '=', customerParty.id)
			.executeTakeFirstOrThrow();
		const unchangedSnapshot = await db
			.selectFrom('contract_version_parties')
			.select('display_name as displayName')
			.where('organisation_id', '=', organisationId)
			.executeTakeFirstOrThrow();
		expect(unchangedSnapshot.displayName).toBe(`${PREFIX}Customer Ltd`);

		await expect(
			lifecycle.mobiliseProjectFromContract(actor, contractPublicId)
		).rejects.toBeInstanceOf(ContractValidationError);
	});

	it('mobilises exactly one active project only after contract execution and preserves lineage', async () => {
		const contractService = new ContractService(db);
		await contractService.issue(actor, {
			contractPublicId,
			versionNumber: 1,
			deliveryChannel: 'manual',
			recipientName: `${PREFIX}Customer Signatory`,
			recipientEmail: 'commercial-lifecycle@example.test',
			note: 'Issued from the accepted commercial position.'
		});
		await contractService.execute(actor, {
			contractPublicId,
			versionNumber: 1,
			executionMethod: 'manual',
			executedAt: '2026-08-25T13:00:00.000Z',
			signatoryName: `${PREFIX}Customer Signatory`,
			signatoryEmail: 'commercial-lifecycle@example.test',
			signingRole: 'Director',
			externalTransactionReference: 'LIFECYCLE-SIGNED-001',
			note: 'Executed agreement received.'
		});

		const lifecycle = new CommercialLifecycleService(
			db,
			randomUUID,
			() => new Date('2026-08-25T13:05:00.000Z')
		);
		const before = await lifecycle.getContractMobilisationState(actor, contractPublicId);
		expect(before).toMatchObject({ canMobilise: true, isExecuted: true, project: null });
		const project = await lifecycle.mobiliseProjectFromContract(actor, contractPublicId);
		projectPublicId = project.publicId;
		expect(project.status).toBe('active');
		expect(project.projectNumber).toMatch(/^PRJ-/);
		const retried = await lifecycle.mobiliseProjectFromContract(actor, contractPublicId);
		expect(retried.publicId).toBe(project.publicId);

		const linked = await db
			.selectFrom('contracts as contract')
			.innerJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.project_id', '=', 'contract.project_id')
					.onRef('quotation.organisation_id', '=', 'contract.organisation_id')
			)
			.innerJoin('estimates as estimate', (join) =>
				join
					.onRef('estimate.project_id', '=', 'contract.project_id')
					.onRef('estimate.organisation_id', '=', 'contract.organisation_id')
			)
			.innerJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'contract.project_id')
					.onRef('project.owning_organisation_id', '=', 'contract.organisation_id')
			)
			.select([
				'project.public_id as projectPublicId',
				'project.status as projectStatus',
				'quotation.public_id as quotationPublicId',
				'estimate.public_id as estimatePublicId'
			])
			.where('contract.organisation_id', '=', organisationId)
			.where('contract.public_id', '=', contractPublicId)
			.where('quotation.public_id', '=', quotationPublicId)
			.where('estimate.public_id', '=', estimatePublicId)
			.executeTakeFirstOrThrow();
		expect(linked).toEqual({
			projectPublicId,
			projectStatus: 'active',
			quotationPublicId,
			estimatePublicId
		});

		const conversions = await db
			.selectFrom('quotation_project_conversions')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.execute();
		expect(conversions).toHaveLength(1);

		const journey = await lifecycle.getOpportunityJourney(actor, opportunityPublicId);
		expect(journey.stages.map((stage) => [stage.key, stage.status])).toEqual([
			['opportunity', 'won'],
			['estimate', 'active'],
			['quotation', 'accepted'],
			['contract', 'active'],
			['project', 'active']
		]);
		expect(journey.nextAction.label).toBe('Open project');
	});
});
