import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import {
	ContractValidationError,
	cleanText,
	isDuplicateKeyError,
	validateCode,
	type ContractSummary
} from '$lib/server/contracts/contract-common';
import { CrmOpportunityRepository } from '$lib/server/crm/crm-opportunity-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { lineAmount, sumMoney } from './commercial-decimal';
import { CommercialService } from './commercial-service';

export type CommercialJourneyStageKey =
	'opportunity' | 'estimate' | 'quotation' | 'contract' | 'project';

export type CommercialJourneyStage = {
	key: CommercialJourneyStageKey;
	label: string;
	reference: string | null;
	title: string | null;
	status: string;
	href: string | null;
	complete: boolean;
};

export type CommercialJourneyAction = {
	label: string;
	href: string | null;
	action: 'develop_estimate' | null;
};

export type OpportunityCommercialJourney = {
	opportunityPublicId: string;
	customerDisplayName: string | null;
	currencyCode: string;
	stages: CommercialJourneyStage[];
	nextAction: CommercialJourneyAction;
	canDevelopEstimate: boolean;
};

export type AcceptedQuotationContractEntry = {
	quotationPublicId: string;
	quotationNumber: string;
	quotationTitle: string;
	versionNumber: number;
	customerDisplayName: string;
	acceptedAt: Date;
};

export type AcceptedQuotationContractQueue = {
	canFormContract: boolean;
	acceptedQuotationsAwaitingContract: AcceptedQuotationContractEntry[];
};

export type AcceptedQuotationContractFormationWorkspace = {
	quotation: {
		id: string;
		publicId: string;
		quotationNumber: string;
		title: string;
		currencyCode: string;
		customerPartyId: string;
		customerDisplayName: string;
		acceptedResponseId: string;
		acceptedResponsePublicId: string;
		acceptedAt: Date;
		versionId: string;
		versionNumber: number;
		opportunityId: string | null;
		netAmount: string;
	};
	legacyProject: {
		publicId: string;
		projectNumber: string;
		name: string;
	} | null;
	contractTypes: Array<{ id: number; code: string; name: string }>;
	existingContract: ContractSummary | null;
	canCreate: boolean;
};

export type CreateContractFromAcceptedQuotationInput = {
	quotationPublicId: string;
	versionNumber: number;
	contractTypeCode: string;
	title: string;
	customerReference?: string | null;
};

export type MobilisedProject = {
	id: string;
	publicId: string;
	projectNumber: string;
	name: string;
	status: string;
};

export type ContractMobilisationState = {
	canMobilise: boolean;
	isExecuted: boolean;
	project: MobilisedProject | null;
};

type AcceptedQuotationSource = {
	quotationId: string;
	quotationPublicId: string;
	quotationNumber: string;
	quotationLifecycleStatus: string;
	quotationProjectId: string | null;
	customerPartyId: string;
	opportunityId: string | null;
	quotationVersionId: string;
	quotationVersionNumber: number;
	quotationTitle: string;
	quotationVersionStatus: string;
	quotationLockedAt: Date | null;
	currencyCode: string;
	acceptedResponseId: string;
	acceptedResponsePublicId: string;
	acceptedAt: Date;
	customerSnapshotId: string | null;
	customerDisplayName: string | null;
	legacyProjectPublicId: string | null;
	legacyProjectNumber: string | null;
	legacyProjectName: string | null;
};

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

function positiveInt(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value <= 0) {
		throw new ContractValidationError(`${label} is invalid.`);
	}
	return value;
}

function generatedContractNumber(quotationNumber: string, quotationPublicId: string): string {
	if (quotationNumber.startsWith('QUO-')) return `CON-${quotationNumber.slice(4)}`.slice(0, 80);
	return `CON-${quotationPublicId.replaceAll('-', '').slice(0, 24).toUpperCase()}`;
}

function generatedProjectNumber(contractNumber: string, contractPublicId: string): string {
	if (contractNumber.startsWith('CON-')) return `PRJ-${contractNumber.slice(4)}`.slice(0, 80);
	return `PRJ-${contractPublicId.replaceAll('-', '').slice(0, 24).toUpperCase()}`;
}

export class CommercialLifecycleService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async contractCreateAllowed(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<boolean> {
		return (
			await new PermissionService(db).decideWithUmbrella(
				actor,
				'contract.create',
				'contract.manage'
			)
		).allowed;
	}

	private async projectCreateAllowed(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<boolean> {
		return (await new PermissionService(db).decide(actor, 'project.create')).allowed;
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
		if (!row) throw new RecordNotFoundError('CRM customer party not found.');
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
		if (rows.length === 0) {
			throw new ContractValidationError('The accepted quotation has no included lines.');
		}
		return sumMoney(rows.map((row) => lineAmount(row.quantity, row.unitRate)));
	}

	private async findContractSummaryByPublicId(
		db: DatabaseExecutor,
		organisationId: string,
		contractPublicId: string
	): Promise<ContractSummary | null> {
		return (
			(await db
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
				.executeTakeFirst()) ?? null
		);
	}

	private async findExistingSourceContract(
		db: DatabaseExecutor,
		organisationId: string,
		responseId: string
	): Promise<ContractSummary | null> {
		const row = await db
			.selectFrom('contracts')
			.select('public_id as publicId')
			.where('organisation_id', '=', organisationId)
			.where('source_quotation_response_id', '=', responseId)
			.orderBy('id', 'asc')
			.executeTakeFirst();
		return row ? this.findContractSummaryByPublicId(db, organisationId, row.publicId) : null;
	}

	private async findAcceptedQuotationSource(
		db: DatabaseExecutor,
		organisationId: string,
		quotationPublicId: string,
		versionNumber?: number,
		lock = false
	): Promise<AcceptedQuotationSource | null> {
		let query = db
			.selectFrom('quotation_responses as response')
			.innerJoin('quotation_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'response.quotation_version_id')
					.onRef('version.organisation_id', '=', 'response.organisation_id')
			)
			.innerJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.id', '=', 'response.quotation_id')
					.onRef('quotation.organisation_id', '=', 'response.organisation_id')
			)
			.leftJoin('quotation_party_snapshots as customer_snapshot', (join) =>
				join
					.onRef('customer_snapshot.quotation_version_id', '=', 'version.id')
					.onRef('customer_snapshot.organisation_id', '=', 'version.organisation_id')
					.on('customer_snapshot.snapshot_role', '=', 'customer')
					.on('customer_snapshot.sort_order', '=', 1)
			)
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'quotation.project_id')
					.onRef('project.owning_organisation_id', '=', 'quotation.organisation_id')
			)
			.select([
				'quotation.id as quotationId',
				'quotation.public_id as quotationPublicId',
				'quotation.quotation_number as quotationNumber',
				'quotation.lifecycle_status as quotationLifecycleStatus',
				'quotation.project_id as quotationProjectId',
				'quotation.customer_party_id as customerPartyId',
				'quotation.opportunity_id as opportunityId',
				'version.id as quotationVersionId',
				'version.version_number as quotationVersionNumber',
				'version.title as quotationTitle',
				'version.version_status as quotationVersionStatus',
				'version.locked_at as quotationLockedAt',
				'version.currency_code as currencyCode',
				'response.id as acceptedResponseId',
				'response.public_id as acceptedResponsePublicId',
				'response.responded_at as acceptedAt',
				'customer_snapshot.id as customerSnapshotId',
				'customer_snapshot.display_name as customerDisplayName',
				'project.public_id as legacyProjectPublicId',
				'project.project_number as legacyProjectNumber',
				'project.name as legacyProjectName'
			])
			.where('response.organisation_id', '=', organisationId)
			.where('response.response_type', '=', 'accepted')
			.where('quotation.public_id', '=', quotationPublicId)
			.orderBy('response.responded_at', 'desc');
		if (versionNumber !== undefined)
			query = query.where('version.version_number', '=', versionNumber);
		if (lock) query = query.forUpdate();
		return (await query.executeTakeFirst()) ?? null;
	}

	async getOpportunityJourney(
		actor: TenantActorContext,
		opportunityPublicId: string
	): Promise<OpportunityCommercialJourney> {
		await this.assertActiveActor(actor);
		const opportunity = await new CrmOpportunityRepository(this.db).findOpportunityByPublicId(
			actor.organisationId,
			opportunityPublicId
		);
		if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');

		const estimate = await this.db
			.selectFrom('estimates')
			.select([
				'id',
				'public_id as publicId',
				'estimate_number as estimateNumber',
				'title',
				'lifecycle_status as lifecycleStatus'
			])
			.where('organisation_id', '=', actor.organisationId)
			.where('opportunity_id', '=', opportunity.id)
			.orderBy('id', 'desc')
			.executeTakeFirst();

		const acceptedQuotation = await this.db
			.selectFrom('quotations as quotation')
			.innerJoin('quotation_responses as response', (join) =>
				join
					.onRef('response.quotation_id', '=', 'quotation.id')
					.onRef('response.organisation_id', '=', 'quotation.organisation_id')
					.on('response.response_type', '=', 'accepted')
			)
			.innerJoin('quotation_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'response.quotation_version_id')
					.onRef('version.organisation_id', '=', 'quotation.organisation_id')
			)
			.select([
				'quotation.id as id',
				'quotation.public_id as publicId',
				'quotation.quotation_number as quotationNumber',
				'quotation.lifecycle_status as lifecycleStatus',
				'version.title as title',
				'version.version_number as versionNumber'
			])
			.where('quotation.organisation_id', '=', actor.organisationId)
			.where('quotation.opportunity_id', '=', opportunity.id)
			.orderBy('response.responded_at', 'desc')
			.executeTakeFirst();

		const quotation =
			acceptedQuotation ??
			(await this.db
				.selectFrom('quotations as quotation')
				.leftJoin('quotation_versions as version', (join) =>
					join
						.onRef('version.quotation_id', '=', 'quotation.id')
						.onRef('version.organisation_id', '=', 'quotation.organisation_id')
				)
				.select([
					'quotation.id as id',
					'quotation.public_id as publicId',
					'quotation.quotation_number as quotationNumber',
					'quotation.lifecycle_status as lifecycleStatus',
					'version.title as title',
					'version.version_number as versionNumber'
				])
				.where('quotation.organisation_id', '=', actor.organisationId)
				.where('quotation.opportunity_id', '=', opportunity.id)
				.orderBy('quotation.id', 'desc')
				.orderBy('version.version_number', 'desc')
				.executeTakeFirst());

		const contract = await this.db
			.selectFrom('contracts')
			.select([
				'id',
				'public_id as publicId',
				'contract_number as contractNumber',
				'title',
				'lifecycle_status as lifecycleStatus',
				'project_id as projectId'
			])
			.where('organisation_id', '=', actor.organisationId)
			.where('opportunity_id', '=', opportunity.id)
			.orderBy('id', 'desc')
			.executeTakeFirst();

		const projectId =
			contract?.projectId ??
			(
				await this.db
					.selectFrom('quotations')
					.select('project_id as projectId')
					.where('organisation_id', '=', actor.organisationId)
					.where('opportunity_id', '=', opportunity.id)
					.where('project_id', 'is not', null)
					.orderBy('id', 'desc')
					.executeTakeFirst()
			)?.projectId ??
			null;
		const project = projectId
			? await this.db
					.selectFrom('projects')
					.select(['public_id as publicId', 'project_number as projectNumber', 'name', 'status'])
					.where('owning_organisation_id', '=', actor.organisationId)
					.where('id', '=', projectId)
					.executeTakeFirst()
			: null;

		const canDevelopEstimate = (
			await new PermissionService(this.db).decideWithUmbrella(
				actor,
				'commercial.estimate.manage',
				'commercial.manage'
			)
		).allowed;

		const stages: CommercialJourneyStage[] = [
			{
				key: 'opportunity',
				label: 'Opportunity',
				reference: null,
				title: opportunity.title,
				status: opportunity.status,
				href: `/crm/opportunities/${opportunity.publicId}`,
				complete: true
			},
			{
				key: 'estimate',
				label: 'Estimate',
				reference: estimate?.estimateNumber ?? null,
				title: estimate?.title ?? null,
				status: estimate?.lifecycleStatus ?? 'not_started',
				href: estimate ? `/commercial/estimates/${estimate.publicId}` : null,
				complete: Boolean(estimate)
			},
			{
				key: 'quotation',
				label: 'Quotation',
				reference: quotation?.quotationNumber ?? null,
				title: quotation?.title ?? null,
				status: acceptedQuotation ? 'accepted' : (quotation?.lifecycleStatus ?? 'not_started'),
				href: quotation ? `/commercial/quotations/${quotation.publicId}` : null,
				complete: Boolean(acceptedQuotation)
			},
			{
				key: 'contract',
				label: 'Contract',
				reference: contract?.contractNumber ?? null,
				title: contract?.title ?? null,
				status: contract?.lifecycleStatus ?? 'not_started',
				href: contract ? `/contracts/${contract.publicId}` : null,
				complete: contract?.lifecycleStatus === 'active'
			},
			{
				key: 'project',
				label: 'Project',
				reference: project?.projectNumber ?? null,
				title: project?.name ?? null,
				status: project?.status ?? 'not_started',
				href: project ? `/projects/${project.publicId}` : null,
				complete: Boolean(project)
			}
		];

		let nextAction: CommercialJourneyAction;
		if (project) {
			nextAction = { label: 'Open project', href: `/projects/${project.publicId}`, action: null };
		} else if (contract) {
			nextAction = {
				label: contract.lifecycleStatus === 'active' ? 'Mobilise project' : 'Continue contract',
				href: `/contracts/${contract.publicId}`,
				action: null
			};
		} else if (acceptedQuotation) {
			nextAction = {
				label: 'Form contract',
				href: `/contracts/new?quotation=${encodeURIComponent(acceptedQuotation.publicId)}&version=${acceptedQuotation.versionNumber}`,
				action: null
			};
		} else if (quotation) {
			nextAction = {
				label: 'Continue quotation',
				href: `/commercial/quotations/${quotation.publicId}`,
				action: null
			};
		} else if (estimate) {
			nextAction = {
				label: 'Continue estimate',
				href: `/commercial/estimates/${estimate.publicId}`,
				action: null
			};
		} else {
			nextAction = { label: 'Develop estimate', href: null, action: 'develop_estimate' };
		}

		return {
			opportunityPublicId: opportunity.publicId,
			customerDisplayName: opportunity.primaryPartyDisplayName,
			currencyCode: opportunity.currencyCode,
			stages,
			nextAction,
			canDevelopEstimate
		};
	}

	async developEstimate(actor: TenantActorContext, opportunityPublicId: string) {
		await this.assertActiveActor(actor);
		const opportunity = await new CrmOpportunityRepository(this.db).findOpportunityByPublicId(
			actor.organisationId,
			opportunityPublicId
		);
		if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
		if (!opportunity.primaryPartyPublicId) {
			throw new ContractValidationError(
				'The opportunity requires a primary customer before estimating.'
			);
		}

		const existing = await this.db
			.selectFrom('estimates')
			.select(['public_id as publicId', 'estimate_number as estimateNumber', 'title'])
			.where('organisation_id', '=', actor.organisationId)
			.where('opportunity_id', '=', opportunity.id)
			.where('lifecycle_status', '!=', 'cancelled')
			.orderBy('id', 'desc')
			.executeTakeFirst();
		if (existing) return existing;

		return new CommercialService(this.db, this.publicIdFactory, this.now).createEstimate(actor, {
			opportunityPublicId: opportunity.publicId,
			title: opportunity.title,
			currencyCode: opportunity.currencyCode,
			notes: opportunity.description
		});
	}

	async listAcceptedQuotationsAwaitingContract(
		actor: TenantActorContext
	): Promise<AcceptedQuotationContractQueue> {
		await this.assertActiveActor(actor);
		const canFormContract = await this.contractCreateAllowed(actor);
		const rows = await this.db
			.selectFrom('quotation_responses as response')
			.innerJoin('quotation_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'response.quotation_version_id')
					.onRef('version.organisation_id', '=', 'response.organisation_id')
			)
			.innerJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.id', '=', 'response.quotation_id')
					.onRef('quotation.organisation_id', '=', 'response.organisation_id')
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
					.onRef('contract.source_quotation_response_id', '=', 'response.id')
					.onRef('contract.organisation_id', '=', 'response.organisation_id')
			)
			.select([
				'quotation.public_id as quotationPublicId',
				'quotation.quotation_number as quotationNumber',
				'version.title as quotationTitle',
				'version.version_number as versionNumber',
				'customer_snapshot.display_name as customerDisplayName',
				'response.responded_at as acceptedAt'
			])
			.where('response.organisation_id', '=', actor.organisationId)
			.where('response.response_type', '=', 'accepted')
			.where('version.version_status', '=', 'issued')
			.where('version.locked_at', 'is not', null)
			.where('quotation.lifecycle_status', '=', 'active')
			.where('contract.id', 'is', null)
			.orderBy('response.responded_at', 'desc')
			.execute();
		return {
			canFormContract,
			acceptedQuotationsAwaitingContract: rows.map((row) => ({
				...row,
				customerDisplayName: row.customerDisplayName ?? 'Customer'
			}))
		};
	}

	async getAcceptedQuotationContractFormationWorkspace(
		actor: TenantActorContext,
		quotationPublicId: string,
		versionNumber?: number
	): Promise<AcceptedQuotationContractFormationWorkspace> {
		await this.assertActiveActor(actor);
		const source = await this.findAcceptedQuotationSource(
			this.db,
			actor.organisationId,
			quotationPublicId,
			versionNumber
		);
		if (!source) {
			throw new ContractValidationError('The quotation does not have an accepted response.');
		}
		if (source.quotationVersionStatus !== 'issued' || !source.quotationLockedAt) {
			throw new ContractValidationError('The accepted quotation version is not issued and locked.');
		}
		const [contractTypes, existingContract, canCreate, netAmount] = await Promise.all([
			this.db
				.selectFrom('contract_types')
				.select(['id', 'code', 'name'])
				.where('is_active', '=', 1)
				.orderBy('name', 'asc')
				.execute(),
			this.findExistingSourceContract(this.db, actor.organisationId, source.acceptedResponseId),
			this.contractCreateAllowed(actor),
			this.quotationNetAmount(this.db, actor.organisationId, source.quotationVersionId)
		]);
		const customerDisplayName =
			source.customerDisplayName ??
			(await this.livePartyDisplayName(this.db, actor.organisationId, source.customerPartyId));
		return {
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
			legacyProject: source.legacyProjectPublicId
				? {
						publicId: source.legacyProjectPublicId,
						projectNumber: source.legacyProjectNumber ?? 'Project',
						name: source.legacyProjectName ?? source.quotationTitle
					}
				: null,
			contractTypes,
			existingContract,
			canCreate: canCreate && !existingContract
		};
	}

	async formContractFromAcceptedQuotation(
		actor: TenantActorContext,
		input: CreateContractFromAcceptedQuotationInput
	): Promise<ContractSummary> {
		const quotationPublicId = cleanText(input.quotationPublicId, 64, 'Quotation ID', true)!;
		const versionNumber = positiveInt(input.versionNumber, 'Quotation version');
		const contractTypeCode = validateCode(input.contractTypeCode, 'Contract type');
		const title = cleanText(input.title, 255, 'Contract title', true)!;
		const customerReference = cleanText(input.customerReference, 160, 'Customer reference');

		return this.db
			.transaction()
			.execute(async (trx) => {
				const membership = await this.assertActiveActor(actor, trx);
				if (!(await this.contractCreateAllowed(actor, trx))) {
					throw new TenantAccessError('Contract creation is not permitted.');
				}
				const source = await this.findAcceptedQuotationSource(
					trx,
					actor.organisationId,
					quotationPublicId,
					versionNumber,
					true
				);
				if (!source) {
					throw new ContractValidationError('The quotation does not have an accepted response.');
				}
				if (source.quotationVersionStatus !== 'issued' || !source.quotationLockedAt) {
					throw new ContractValidationError(
						'The accepted quotation version is not issued and locked.'
					);
				}
				const existing = await this.findExistingSourceContract(
					trx,
					actor.organisationId,
					source.acceptedResponseId
				);
				if (existing) return existing;

				const type = await trx
					.selectFrom('contract_types')
					.select(['id', 'code', 'name'])
					.where('code', '=', contractTypeCode)
					.where('is_active', '=', 1)
					.executeTakeFirst();
				if (!type)
					throw new ContractValidationError('The selected contract type is not available.');

				const contractNumber = generatedContractNumber(
					source.quotationNumber,
					source.quotationPublicId
				);
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
				const contractId = insertedId(
					await trx
						.insertInto('contracts')
						.values({
							organisation_id: actor.organisationId,
							public_id: contractPublicId,
							contract_number: contractNumber,
							contract_type_id: type.id,
							project_id: source.quotationProjectId,
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
						.executeTakeFirstOrThrow()
				);
				const versionId = insertedId(
					await trx
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
						.executeTakeFirstOrThrow()
				);
				const contractPartyId = insertedId(
					await trx
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
						.executeTakeFirstOrThrow()
				);

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

				if (source.opportunityId) {
					await trx
						.updateTable('opportunities')
						.set({ status: 'won', closed_at: source.acceptedAt })
						.where('organisation_id', '=', actor.organisationId)
						.where('id', '=', source.opportunityId)
						.where('status', '=', 'open')
						.execute();
				}

				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: membership.id,
					projectId: source.quotationProjectId,
					actionKey: 'contract.created_from_accepted_quotation',
					subjectType: 'contract',
					subjectPublicId: contractPublicId,
					correlationId: actor.correlationId,
					changeSummary: {
						contractNumber,
						contractType: type.code,
						quotationPublicId: source.quotationPublicId,
						quotationNumber: source.quotationNumber,
						acceptedResponsePublicId: source.acceptedResponsePublicId,
						currencyCode: source.currencyCode,
						baseScopeValue: netAmount,
						projectCreatedBeforeContract: Boolean(source.quotationProjectId)
					}
				});

				const created = await this.findContractSummaryByPublicId(
					trx,
					actor.organisationId,
					contractPublicId
				);
				if (!created) throw new Error('Created contract could not be reloaded.');
				return created;
			})
			.catch((error) => {
				if (isDuplicateKeyError(error)) {
					throw new ContractValidationError(
						'Contract formation conflicted with an existing source record. Reload and try again.'
					);
				}
				throw error;
			});
	}

	private async findProjectById(
		db: DatabaseExecutor,
		organisationId: string,
		projectId: string
	): Promise<MobilisedProject | null> {
		return (
			(await db
				.selectFrom('projects')
				.select([
					'id',
					'public_id as publicId',
					'project_number as projectNumber',
					'name',
					'status'
				])
				.where('owning_organisation_id', '=', organisationId)
				.where('id', '=', projectId)
				.executeTakeFirst()) ?? null
		);
	}

	async getContractMobilisationState(
		actor: TenantActorContext,
		contractPublicId: string
	): Promise<ContractMobilisationState> {
		await this.assertActiveActor(actor);
		const contract = await this.db
			.selectFrom('contracts')
			.select(['id', 'lifecycle_status as lifecycleStatus', 'project_id as projectId'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', contractPublicId)
			.executeTakeFirst();
		if (!contract) throw new RecordNotFoundError('Contract not found.');
		const version = await this.db
			.selectFrom('contract_versions')
			.select('version_status as versionStatus')
			.where('organisation_id', '=', actor.organisationId)
			.where('contract_id', '=', contract.id)
			.orderBy('version_number', 'desc')
			.executeTakeFirst();
		const project = contract.projectId
			? await this.findProjectById(this.db, actor.organisationId, contract.projectId)
			: null;
		const isExecuted =
			contract.lifecycleStatus === 'active' && version?.versionStatus === 'executed';
		return {
			canMobilise: isExecuted && !project && (await this.projectCreateAllowed(actor)),
			isExecuted,
			project
		};
	}

	async mobiliseProjectFromContract(
		actor: TenantActorContext,
		contractPublicIdInput: string
	): Promise<MobilisedProject> {
		const contractPublicId = cleanText(contractPublicIdInput, 64, 'Contract ID', true)!;
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			if (!(await this.projectCreateAllowed(actor, trx))) {
				throw new TenantAccessError('Project creation is not permitted.');
			}
			const contract = await trx
				.selectFrom('contracts')
				.select([
					'id',
					'public_id as publicId',
					'contract_number as contractNumber',
					'title',
					'lifecycle_status as lifecycleStatus',
					'project_id as projectId',
					'source_quotation_response_id as sourceResponseId'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', contractPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!contract) throw new RecordNotFoundError('Contract not found.');
			if (!contract.sourceResponseId) {
				throw new ContractValidationError(
					'This contract does not have accepted quotation provenance for controlled mobilisation.'
				);
			}
			if (contract.projectId) {
				const existing = await this.findProjectById(trx, actor.organisationId, contract.projectId);
				if (!existing) throw new Error('Contract project linkage is inconsistent.');
				return existing;
			}
			const contractVersion = await trx
				.selectFrom('contract_versions')
				.select(['id', 'version_number as versionNumber', 'version_status as versionStatus'])
				.where('organisation_id', '=', actor.organisationId)
				.where('contract_id', '=', contract.id)
				.orderBy('version_number', 'desc')
				.forUpdate()
				.executeTakeFirst();
			if (
				contract.lifecycleStatus !== 'active' ||
				!contractVersion ||
				contractVersion.versionStatus !== 'executed'
			) {
				throw new ContractValidationError(
					'Only an executed contract can be mobilised to a project.'
				);
			}

			const source = await trx
				.selectFrom('quotation_responses as response')
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
				.select([
					'response.id as responseId',
					'response.public_id as responsePublicId',
					'response.response_type as responseType',
					'quotation.id as quotationId',
					'quotation.public_id as quotationPublicId',
					'quotation.quotation_number as quotationNumber',
					'quotation.project_id as quotationProjectId',
					'version.id as quotationVersionId',
					'version.version_number as quotationVersionNumber',
					'version.version_status as quotationVersionStatus',
					'version.locked_at as quotationLockedAt'
				])
				.where('response.organisation_id', '=', actor.organisationId)
				.where('response.id', '=', contract.sourceResponseId)
				.forUpdate()
				.executeTakeFirst();
			if (!source || source.responseType !== 'accepted') {
				throw new ContractValidationError('The source quotation is not accepted.');
			}
			if (source.quotationVersionStatus !== 'issued' || !source.quotationLockedAt) {
				throw new ContractValidationError('The source quotation version is not issued and locked.');
			}

			const existingConversion = await trx
				.selectFrom('quotation_project_conversions')
				.select('project_id as projectId')
				.where('organisation_id', '=', actor.organisationId)
				.where('quotation_response_id', '=', source.responseId)
				.executeTakeFirst();
			if (existingConversion) {
				const existing = await this.findProjectById(
					trx,
					actor.organisationId,
					existingConversion.projectId
				);
				if (!existing) throw new Error('Quotation conversion project linkage is inconsistent.');
				await trx
					.updateTable('contracts')
					.set({ project_id: existing.id })
					.where('organisation_id', '=', actor.organisationId)
					.where('id', '=', contract.id)
					.where('project_id', 'is', null)
					.executeTakeFirstOrThrow();
				return existing;
			}
			if (source.quotationProjectId) {
				throw new ContractValidationError(
					'The source quotation already points to a project without conversion evidence.'
				);
			}

			const estimateLinks = await trx
				.selectFrom('quotation_version_estimates as link')
				.innerJoin('estimate_versions as version', (join) =>
					join
						.onRef('version.id', '=', 'link.estimate_version_id')
						.onRef('version.organisation_id', '=', 'link.organisation_id')
				)
				.select('version.estimate_id as estimateId')
				.where('link.organisation_id', '=', actor.organisationId)
				.where('link.quotation_version_id', '=', source.quotationVersionId)
				.execute();
			const estimateIds = [...new Set(estimateLinks.map((row) => row.estimateId))];
			if (estimateIds.length > 0) {
				const conflicting = await trx
					.selectFrom('estimates')
					.select(['estimate_number as estimateNumber', 'project_id as projectId'])
					.where('organisation_id', '=', actor.organisationId)
					.where('id', 'in', estimateIds)
					.where('project_id', 'is not', null)
					.executeTakeFirst();
				if (conflicting) {
					throw new ContractValidationError(
						`Source estimate ${conflicting.estimateNumber} is already linked to another project.`
					);
				}
			}

			const projectRepository = new ProjectRepository(trx);
			const projectNumber = generatedProjectNumber(contract.contractNumber, contract.publicId);
			if (await projectRepository.findOwnedByProjectNumber(actor.organisationId, projectNumber)) {
				throw new ContractValidationError(
					`Project number ${projectNumber} already exists without contract mobilisation evidence.`
				);
			}
			const projectPublicId = this.publicIdFactory();
			const createdAt = this.now();
			const projectId = await projectRepository.insert({
				owningOrganisationId: actor.organisationId,
				publicId: projectPublicId,
				projectNumber,
				name: contract.title,
				description: `Mobilised from executed contract ${contract.contractNumber}, originating from accepted quotation ${source.quotationNumber}.`,
				createdByMemberId: membership.id
			});
			await projectRepository.insertOwningParticipation(projectId, actor.organisationId, createdAt);
			await projectRepository.insertProjectMember(
				projectId,
				actor.organisationId,
				membership.id,
				createdAt
			);
			await trx
				.updateTable('projects')
				.set({ status: 'active' })
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('id', '=', projectId)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('quotation_project_conversions')
				.values({
					organisation_id: actor.organisationId,
					quotation_response_id: source.responseId,
					project_id: projectId,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();
			await trx
				.updateTable('quotations')
				.set({ project_id: projectId })
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', source.quotationId)
				.where('project_id', 'is', null)
				.executeTakeFirstOrThrow();
			if (estimateIds.length > 0) {
				await trx
					.updateTable('estimates')
					.set({ project_id: projectId })
					.where('organisation_id', '=', actor.organisationId)
					.where('id', 'in', estimateIds)
					.where('project_id', 'is', null)
					.execute();
			}
			await trx
				.updateTable('contracts')
				.set({ project_id: projectId })
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', contract.id)
				.where('project_id', 'is', null)
				.executeTakeFirstOrThrow();

			const audit = new AuditRepository(trx);
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId,
				actionKey: 'contract.mobilised_to_project',
				subjectType: 'contract',
				subjectPublicId: contract.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					contractNumber: contract.contractNumber,
					projectPublicId,
					projectNumber,
					quotationPublicId: source.quotationPublicId,
					quotationVersionNumber: source.quotationVersionNumber
				}
			});
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId,
				actionKey: 'project.created_from_contract',
				subjectType: 'project',
				subjectPublicId: projectPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					contractPublicId: contract.publicId,
					contractNumber: contract.contractNumber,
					quotationPublicId: source.quotationPublicId,
					acceptedResponsePublicId: source.responsePublicId
				}
			});

			return {
				id: projectId,
				publicId: projectPublicId,
				projectNumber,
				name: contract.title,
				status: 'active'
			};
		});
	}
}
