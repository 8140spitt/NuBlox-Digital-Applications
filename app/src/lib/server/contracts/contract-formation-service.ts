import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { lineAmount, sumMoney } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	ContractAccessPolicy,
	ContractValidationError,
	cleanText,
	generatedContractNumber,
	isDuplicateKeyError,
	validateCode,
	type ContractFormationWorkspace,
	type ContractPortfolio,
	type ContractSource,
	type ContractSummary,
	type CreateContractInput,
	type EligibleContractProject
} from './contract-common';

export class ContractFormationService {
	private readonly policy: ContractAccessPolicy;

	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {
		this.policy = new ContractAccessPolicy(db);
	}

	private async findSourceByProjectId(
		db: DatabaseExecutor,
		organisationId: string,
		projectId: string,
		lock = false
	): Promise<ContractSource | null> {
		let query = db
			.selectFrom('projects as project')
			.innerJoin('quotation_project_conversions as conversion', (join) =>
				join
					.onRef('conversion.project_id', '=', 'project.id')
					.onRef('conversion.organisation_id', '=', 'project.owning_organisation_id')
			)
			.innerJoin('quotation_responses as response', (join) =>
				join
					.onRef('response.id', '=', 'conversion.quotation_response_id')
					.onRef('response.organisation_id', '=', 'conversion.organisation_id')
			)
			.innerJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.id', '=', 'response.quotation_id')
					.onRef('quotation.organisation_id', '=', 'response.organisation_id')
			)
			.innerJoin('quotation_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'response.quotation_version_id')
					.onRef('version.organisation_id', '=', 'response.organisation_id')
			)
			.leftJoin('quotation_party_snapshots as customer_snapshot', (join) =>
				join
					.onRef('customer_snapshot.quotation_version_id', '=', 'version.id')
					.onRef('customer_snapshot.organisation_id', '=', 'version.organisation_id')
					.on('customer_snapshot.snapshot_role', '=', 'customer')
					.on('customer_snapshot.sort_order', '=', 1)
			)
			.select([
				'project.id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'project.status as projectStatus',
				'quotation.id as quotationId',
				'quotation.public_id as quotationPublicId',
				'quotation.quotation_number as quotationNumber',
				'quotation.customer_party_id as customerPartyId',
				'quotation.opportunity_id as opportunityId',
				'version.id as quotationVersionId',
				'version.version_number as quotationVersionNumber',
				'version.title as quotationTitle',
				'version.version_status as quotationVersionStatus',
				'version.locked_at as quotationLockedAt',
				'version.currency_code as currencyCode',
				'customer_snapshot.id as customerSnapshotId',
				'customer_snapshot.display_name as customerDisplayName',
				'response.id as acceptedResponseId',
				'response.public_id as acceptedResponsePublicId',
				'response.responded_at as acceptedAt',
				'response.response_type as responseType'
			])
			.where('project.owning_organisation_id', '=', organisationId)
			.where('project.id', '=', projectId);
		if (lock) query = query.forUpdate();
		return (await query.executeTakeFirst()) ?? null;
	}

	private async livePartyDisplayName(
		db: DatabaseExecutor,
		organisationId: string,
		partyId: string
	): Promise<string> {
		const row = await db
			.selectFrom('parties as party')
			.leftJoin('party_organisations as organisation', (join) =>
				join
					.onRef('organisation.party_id', '=', 'party.id')
					.onRef('organisation.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'party.party_kind as partyKind',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.id', '=', partyId)
			.executeTakeFirst();
		if (!row)
			throw new ContractValidationError('The quotation customer is no longer available in CRM.');
		if (row.partyKind === 'organisation') return row.tradingName ?? row.legalName ?? 'Customer';
		return (
			row.preferredName ??
			([row.givenNames, row.familyName].filter(Boolean).join(' ') || 'Customer')
		);
	}

	private async quotationNetAmount(
		db: DatabaseExecutor,
		organisationId: string,
		quotationVersionId: string
	): Promise<string> {
		const rows = await db
			.selectFrom('quotation_items')
			.select(['quantity', 'unit_rate as unitRate'])
			.where('organisation_id', '=', organisationId)
			.where('quotation_version_id', '=', quotationVersionId)
			.where('is_optional', '=', 0)
			.orderBy('line_number', 'asc')
			.execute();
		if (rows.length === 0)
			throw new ContractValidationError('The accepted quotation has no included lines.');
		return sumMoney(rows.map((row) => lineAmount(row.quantity, row.unitRate)));
	}

	private async findSummaryByPublicId(
		db: DatabaseExecutor,
		organisationId: string,
		contractPublicId: string
	): Promise<ContractSummary | null> {
		const row = await db
			.selectFrom('contracts as contract')
			.innerJoin('contract_types as type', 'type.id', 'contract.contract_type_id')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'contract.project_id')
					.onRef('project.owning_organisation_id', '=', 'contract.organisation_id')
			)
			.select([
				'contract.id as id',
				'contract.public_id as publicId',
				'contract.contract_number as contractNumber',
				'contract.title as title',
				'type.code as contractTypeCode',
				'type.name as contractTypeName',
				'contract.lifecycle_status as lifecycleStatus',
				'contract.currency_code as currencyCode',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'contract.created_at as createdAt'
			])
			.where('contract.organisation_id', '=', organisationId)
			.where('contract.public_id', '=', contractPublicId)
			.executeTakeFirst();
		return row ?? null;
	}

	private async findExistingSourceContract(
		db: DatabaseExecutor,
		organisationId: string,
		projectId: string,
		responseId: string
	): Promise<ContractSummary | null> {
		const row = await db
			.selectFrom('contracts')
			.select('public_id as publicId')
			.where('organisation_id', '=', organisationId)
			.where('project_id', '=', projectId)
			.where('source_quotation_response_id', '=', responseId)
			.orderBy('id', 'asc')
			.executeTakeFirst();
		return row ? this.findSummaryByPublicId(db, organisationId, row.publicId) : null;
	}

	async listPortfolio(actor: TenantActorContext): Promise<ContractPortfolio> {
		await this.policy.assertActiveActor(actor);
		const [viewDecision, createDecision, projectViewDecision] = await Promise.all([
			this.policy.viewDecision(actor),
			this.policy.mutationDecision(actor, 'contract.create'),
			new PermissionService(this.db).decide(actor, 'project.view')
		]);
		const canView = viewDecision.allowed;
		const canCreate = createDecision.allowed && projectViewDecision.allowed;

		const contracts: ContractSummary[] = canView
			? await this.db
					.selectFrom('contracts as contract')
					.innerJoin('contract_types as type', 'type.id', 'contract.contract_type_id')
					.leftJoin('projects as project', (join) =>
						join
							.onRef('project.id', '=', 'contract.project_id')
							.onRef('project.owning_organisation_id', '=', 'contract.organisation_id')
					)
					.select([
						'contract.id as id',
						'contract.public_id as publicId',
						'contract.contract_number as contractNumber',
						'contract.title as title',
						'type.code as contractTypeCode',
						'type.name as contractTypeName',
						'contract.lifecycle_status as lifecycleStatus',
						'contract.currency_code as currencyCode',
						'project.public_id as projectPublicId',
						'project.project_number as projectNumber',
						'project.name as projectName',
						'contract.created_at as createdAt'
					])
					.where('contract.organisation_id', '=', actor.organisationId)
					.orderBy('contract.id', 'desc')
					.execute()
			: [];

		const eligibleProjects: EligibleContractProject[] = canCreate
			? await this.db
					.selectFrom('projects as project')
					.innerJoin('project_organisations as participation', (join) =>
						join
							.onRef('participation.project_id', '=', 'project.id')
							.on('participation.participant_organisation_id', '=', actor.organisationId)
							.on('participation.status', '=', 'active')
					)
					.innerJoin('project_members as member', (join) =>
						join
							.onRef('member.project_id', '=', 'project.id')
							.onRef(
								'member.participant_organisation_id',
								'=',
								'participation.participant_organisation_id'
							)
							.on('member.organisation_member_id', '=', actor.memberId)
							.on('member.status', '=', 'active')
					)
					.innerJoin('quotation_project_conversions as conversion', (join) =>
						join
							.onRef('conversion.project_id', '=', 'project.id')
							.onRef('conversion.organisation_id', '=', 'project.owning_organisation_id')
					)
					.innerJoin('quotation_responses as response', (join) =>
						join
							.onRef('response.id', '=', 'conversion.quotation_response_id')
							.onRef('response.organisation_id', '=', 'conversion.organisation_id')
					)
					.innerJoin('quotations as quotation', (join) =>
						join
							.onRef('quotation.id', '=', 'response.quotation_id')
							.onRef('quotation.organisation_id', '=', 'response.organisation_id')
					)
					.innerJoin('quotation_versions as version', (join) =>
						join
							.onRef('version.id', '=', 'response.quotation_version_id')
							.onRef('version.organisation_id', '=', 'response.organisation_id')
					)
					.leftJoin('quotation_party_snapshots as customer_snapshot', (join) =>
						join
							.onRef('customer_snapshot.quotation_version_id', '=', 'version.id')
							.onRef('customer_snapshot.organisation_id', '=', 'version.organisation_id')
							.on('customer_snapshot.snapshot_role', '=', 'customer')
							.on('customer_snapshot.sort_order', '=', 1)
					)
					.leftJoin('contracts as contract', (join) =>
						join
							.onRef('contract.project_id', '=', 'project.id')
							.onRef('contract.organisation_id', '=', 'project.owning_organisation_id')
							.onRef('contract.source_quotation_response_id', '=', 'response.id')
					)
					.select([
						'project.id as projectId',
						'project.public_id as projectPublicId',
						'project.project_number as projectNumber',
						'project.name as projectName',
						'project.status as projectStatus',
						'quotation.quotation_number as quotationNumber',
						'version.title as quotationTitle',
						'response.public_id as acceptedResponsePublicId',
						'response.responded_at as acceptedAt',
						'customer_snapshot.display_name as customerDisplayName'
					])
					.where('project.owning_organisation_id', '=', actor.organisationId)
					.where('project.status', '=', 'proposed')
					.where('response.response_type', '=', 'accepted')
					.where('version.version_status', '=', 'issued')
					.where('version.locked_at', 'is not', null)
					.where('contract.id', 'is', null)
					.orderBy('project.id', 'desc')
					.execute()
					.then((rows) =>
						rows.map((row) => ({
							...row,
							customerDisplayName: row.customerDisplayName ?? 'Customer'
						}))
					)
			: [];

		return { canView, canCreate, contracts, eligibleProjects };
	}

	async getFormationWorkspace(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ContractFormationWorkspace> {
		await this.policy.assertActiveActor(actor);
		const project = await this.policy.assertProjectScope(actor, projectPublicId);
		const source = await this.findSourceByProjectId(this.db, actor.organisationId, project.id);
		if (!source || source.responseType !== 'accepted') {
			throw new ContractValidationError(
				'This project is not linked to an accepted quotation conversion.'
			);
		}
		if (source.quotationVersionStatus !== 'issued' || !source.quotationLockedAt) {
			throw new ContractValidationError('The source quotation version is not issued and locked.');
		}
		const customerDisplayName =
			source.customerDisplayName ??
			(await this.livePartyDisplayName(this.db, actor.organisationId, source.customerPartyId));
		const [contractTypes, existingContract, createDecision, netAmount] = await Promise.all([
			this.db
				.selectFrom('contract_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name', 'asc')
				.execute(),
			this.findExistingSourceContract(
				this.db,
				actor.organisationId,
				project.id,
				source.acceptedResponseId
			),
			this.policy.mutationDecision(actor, 'contract.create'),
			this.quotationNetAmount(this.db, actor.organisationId, source.quotationVersionId)
		]);
		return {
			project,
			quotation: {
				id: source.quotationId,
				publicId: source.quotationPublicId,
				quotationNumber: source.quotationNumber,
				title: source.quotationTitle,
				currencyCode: source.currencyCode,
				customerPartyId: source.customerPartyId,
				customerDisplayName,
				acceptedResponseId: source.acceptedResponseId,
				acceptedResponsePublicId: source.acceptedResponsePublicId,
				acceptedAt: source.acceptedAt,
				versionId: source.quotationVersionId,
				versionNumber: source.quotationVersionNumber,
				opportunityId: source.opportunityId,
				netAmount
			},
			contractTypes,
			existingContract,
			canCreate: createDecision.allowed && project.status === 'proposed' && !existingContract
		};
	}

	async createFromProject(
		actor: TenantActorContext,
		input: CreateContractInput
	): Promise<ContractSummary> {
		const projectPublicId = cleanText(input.projectPublicId, 64, 'Project ID', true)!;
		const contractTypeCode = validateCode(input.contractTypeCode, 'Contract type');
		const title = cleanText(input.title, 255, 'Contract title', true)!;
		const customerReference = cleanText(input.customerReference, 160, 'Customer reference');

		return this.db
			.transaction()
			.execute(async (trx) => {
				const membership = await this.policy.assertActiveActor(actor, trx);
				const project = await this.policy.assertProjectScope(actor, projectPublicId, trx);
				const createDecision = await this.policy.mutationDecision(actor, 'contract.create', trx);
				if (!createDecision.allowed)
					throw new TenantAccessError('Contract creation is not permitted.');

				const lockedProject = await trx
					.selectFrom('projects')
					.select(['id', 'status', 'project_number as projectNumber'])
					.where('owning_organisation_id', '=', actor.organisationId)
					.where('id', '=', project.id)
					.forUpdate()
					.executeTakeFirstOrThrow();
				const source = await this.findSourceByProjectId(
					trx,
					actor.organisationId,
					project.id,
					true
				);
				if (!source || source.responseType !== 'accepted') {
					throw new ContractValidationError(
						'This project is not linked to an accepted quotation conversion.'
					);
				}
				if (source.quotationVersionStatus !== 'issued' || !source.quotationLockedAt) {
					throw new ContractValidationError(
						'The source quotation version is not issued and locked.'
					);
				}

				const existing = await this.findExistingSourceContract(
					trx,
					actor.organisationId,
					project.id,
					source.acceptedResponseId
				);
				if (existing) return existing;
				if (lockedProject.status !== 'proposed') {
					throw new ContractValidationError(
						'Controlled quotation-derived contract formation currently requires a proposed project.'
					);
				}

				const type = await trx
					.selectFrom('contract_types')
					.select(['id', 'code', 'name'])
					.where('code', '=', contractTypeCode)
					.where('is_active', '=', 1)
					.executeTakeFirst();
				if (!type)
					throw new ContractValidationError('The selected contract type is not available.');

				const contractNumber = generatedContractNumber(project.projectNumber, project.publicId);
				const conflictingNumber = await trx
					.selectFrom('contracts')
					.select('id')
					.where('organisation_id', '=', actor.organisationId)
					.where('contract_number', '=', contractNumber)
					.executeTakeFirst();
				if (conflictingNumber) {
					throw new ContractValidationError(
						`Contract number ${contractNumber} is already in use without matching source evidence.`
					);
				}

				const customerDisplayName =
					source.customerDisplayName ??
					(await this.livePartyDisplayName(trx, actor.organisationId, source.customerPartyId));
				const netAmount = await this.quotationNetAmount(
					trx,
					actor.organisationId,
					source.quotationVersionId
				);
				const clientRole = await trx
					.selectFrom('contract_party_role_types')
					.select(['id', 'code'])
					.where('code', '=', 'client')
					.where('is_active', '=', 1)
					.executeTakeFirstOrThrow();
				const baseScopeType = await trx
					.selectFrom('contract_value_component_types')
					.select(['id', 'code'])
					.where('code', '=', 'base_scope')
					.where('is_active', '=', 1)
					.executeTakeFirstOrThrow();

				const contractPublicId = this.publicIdFactory();
				const contractInsert = await trx
					.insertInto('contracts')
					.values({
						organisation_id: actor.organisationId,
						public_id: contractPublicId,
						contract_number: contractNumber,
						contract_type_id: type.id,
						project_id: project.id,
						opportunity_id: source.opportunityId,
						source_quotation_response_id: source.acceptedResponseId,
						owner_member_id: membership.id,
						title,
						currency_code: source.currencyCode,
						lifecycle_status: 'draft',
						started_on: null,
						ended_on: null,
						archived_at: null
					})
					.executeTakeFirstOrThrow();
				if (contractInsert.insertId === undefined)
					throw new Error('Contract insert did not return an ID.');
				const contractId = contractInsert.insertId.toString();

				const versionInsert = await trx
					.insertInto('contract_versions')
					.values({
						organisation_id: actor.organisationId,
						contract_id: contractId,
						version_number: 1,
						title,
						customer_reference: customerReference,
						version_status: 'draft',
						created_by_member_id: membership.id,
						locked_by_member_id: null,
						locked_at: null
					})
					.executeTakeFirstOrThrow();
				if (versionInsert.insertId === undefined)
					throw new Error('Contract version insert did not return an ID.');
				const versionId = versionInsert.insertId.toString();

				const partyInsert = await trx
					.insertInto('contract_version_parties')
					.values({
						organisation_id: actor.organisationId,
						contract_version_id: versionId,
						source_party_id: source.customerPartyId,
						contract_party_role_type_id: clientRole.id,
						display_name: customerDisplayName,
						reference_identifier: null,
						sort_order: 1
					})
					.executeTakeFirstOrThrow();
				if (partyInsert.insertId === undefined)
					throw new Error('Contract party insert did not return an ID.');
				const contractPartyId = partyInsert.insertId.toString();

				if (source.customerSnapshotId) {
					const addresses = await trx
						.selectFrom('quotation_party_snapshot_addresses')
						.select([
							'address_role as addressRole',
							'line_1 as line1',
							'line_2 as line2',
							'line_3 as line3',
							'locality',
							'city',
							'region',
							'postal_code as postalCode',
							'country_code as countryCode'
						])
						.where('organisation_id', '=', actor.organisationId)
						.where('quotation_party_snapshot_id', '=', source.customerSnapshotId)
						.where('quotation_version_id', '=', source.quotationVersionId)
						.execute();
					if (addresses.length > 0) {
						await trx
							.insertInto('contract_version_party_addresses')
							.values(
								addresses.map((address) => ({
									organisation_id: actor.organisationId,
									contract_version_party_id: contractPartyId,
									contract_version_id: versionId,
									address_role: address.addressRole,
									line_1: address.line1,
									line_2: address.line2,
									line_3: address.line3,
									locality: address.locality,
									city: address.city,
									region: address.region,
									postal_code: address.postalCode,
									country_code: address.countryCode
								}))
							)
							.execute();
					}
				}

				await trx
					.insertInto('contract_version_value_components')
					.values({
						organisation_id: actor.organisationId,
						contract_version_id: versionId,
						contract_value_component_type_id: baseScopeType.id,
						description: `Accepted quotation ${source.quotationNumber}`,
						amount: netAmount,
						sort_order: 1
					})
					.executeTakeFirstOrThrow();

				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: membership.id,
					projectId: project.id,
					actionKey: 'contract.created_from_accepted_quotation',
					subjectType: 'contract',
					subjectPublicId: contractPublicId,
					correlationId: actor.correlationId,
					changeSummary: {
						contractNumber,
						contractType: type.code,
						projectPublicId: project.publicId,
						quotationPublicId: source.quotationPublicId,
						quotationNumber: source.quotationNumber,
						acceptedResponsePublicId: source.acceptedResponsePublicId,
						currencyCode: source.currencyCode,
						baseScopeValue: netAmount
					}
				});

				const created = await this.findSummaryByPublicId(
					trx,
					actor.organisationId,
					contractPublicId
				);
				if (!created)
					throw new Error('Created contract could not be reloaded inside its transaction.');
				return created;
			})
			.catch((error) => {
				if (isDuplicateKeyError(error)) {
					throw new ContractValidationError(
						'Contract creation conflicted with an existing record. Reload and try again.'
					);
				}
				throw error;
			});
	}
}
