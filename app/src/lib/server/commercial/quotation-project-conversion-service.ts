import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { CommercialService, CommercialValidationError, type QuotationWorkspace } from './commercial-service';

export type ConvertedProject = {
	id: string;
	publicId: string;
	projectNumber: string;
	name: string;
	status: string;
};

export type QuotationConversionSourceEstimate = {
	id: string;
	publicId: string;
	estimateNumber: string;
	title: string;
	projectId: string | null;
	projectPublicId: string | null;
	projectNumber: string | null;
};

export type QuotationProjectConversionWorkspace = {
	commercial: QuotationWorkspace;
	acceptedResponse: {
		id: string;
		publicId: string;
		respondedAt: Date;
		respondentName: string | null;
		respondentEmail: string | null;
	} | null;
	project: ConvertedProject | null;
	sourceEstimates: QuotationConversionSourceEstimate[];
	hasCommercialConvertPermission: boolean;
	hasProjectCreatePermission: boolean;
	canConvert: boolean;
};

type LockedQuotation = {
	id: string;
	publicId: string;
	quotationNumber: string;
	projectId: string | null;
	lifecycleStatus: string;
};

type LockedQuotationVersion = {
	id: string;
	versionNumber: number;
	title: string;
	versionStatus: string;
	lockedAt: Date | null;
};

type AcceptedResponse = {
	id: string;
	publicId: string;
	respondedAt: Date;
	respondentName: string | null;
	respondentEmail: string | null;
};

function validatePublicId(value: string): string {
	const result = value.trim();
	if (!result || result.length > 64) throw new CommercialValidationError('Quotation ID is required.');
	return result;
}

function validateVersionNumber(value: number): number {
	if (!Number.isSafeInteger(value) || value <= 0) throw new CommercialValidationError('Quotation version number is invalid.');
	return value;
}

function convertedProjectNumber(quotationNumber: string, quotationPublicId: string): string {
	if (quotationNumber.startsWith('QUO-')) return `PRJ-${quotationNumber.slice(4)}`.slice(0, 80);
	return `PRJ-${quotationPublicId.replaceAll('-', '').slice(0, 24).toUpperCase()}`;
}

export class QuotationProjectConversionService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async permissionState(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const permissions = new PermissionService(db);
		const [commercialConvert, projectCreate] = await Promise.all([
			permissions.decideWithUmbrella(actor, 'commercial.quotation.convert', 'commercial.manage'),
			permissions.decide(actor, 'project.create')
		]);
		return {
			hasCommercialConvertPermission: commercialConvert.allowed,
			hasProjectCreatePermission: projectCreate.allowed,
			canConvert: commercialConvert.allowed && projectCreate.allowed
		};
	}

	private async findAcceptedResponse(
		db: DatabaseExecutor,
		organisationId: string,
		quotationId: string,
		quotationVersionId: string,
		lock = false
	): Promise<AcceptedResponse | null> {
		let query = db
			.selectFrom('quotation_responses')
			.select([
				'id',
				'public_id as publicId',
				'responded_at as respondedAt',
				'respondent_name as respondentName',
				'respondent_email as respondentEmail'
			])
			.where('organisation_id', '=', organisationId)
			.where('quotation_id', '=', quotationId)
			.where('quotation_version_id', '=', quotationVersionId)
			.where('response_type', '=', 'accepted');
		if (lock) query = query.forUpdate();
		return (await query.executeTakeFirst()) ?? null;
	}

	private async findAcceptedVersionNumber(
		actor: TenantActorContext,
		quotationPublicId: string
	): Promise<number | null> {
		const row = await this.db
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
			.select('version.version_number as versionNumber')
			.where('quotation.organisation_id', '=', actor.organisationId)
			.where('quotation.public_id', '=', quotationPublicId)
			.executeTakeFirst();
		return row?.versionNumber ?? null;
	}

	private async findConvertedProject(
		db: DatabaseExecutor,
		organisationId: string,
		responseId: string
	): Promise<ConvertedProject | null> {
		const row = await db
			.selectFrom('quotation_project_conversions as conversion')
			.innerJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'conversion.project_id')
					.onRef('project.owning_organisation_id', '=', 'conversion.organisation_id')
			)
			.select([
				'project.id as id',
				'project.public_id as publicId',
				'project.project_number as projectNumber',
				'project.name as name',
				'project.status as status'
			])
			.where('conversion.organisation_id', '=', organisationId)
			.where('conversion.quotation_response_id', '=', responseId)
			.executeTakeFirst();
		return row ?? null;
	}

	private async listSourceEstimates(
		db: DatabaseExecutor,
		organisationId: string,
		quotationVersionId: string,
		lock = false
	): Promise<QuotationConversionSourceEstimate[]> {
		const links = await db
			.selectFrom('quotation_version_estimates as link')
			.innerJoin('estimate_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'link.estimate_version_id')
					.onRef('version.organisation_id', '=', 'link.organisation_id')
			)
			.select('version.estimate_id as estimateId')
			.where('link.organisation_id', '=', organisationId)
			.where('link.quotation_version_id', '=', quotationVersionId)
			.execute();
		const estimateIds = [...new Set(links.map((row) => row.estimateId))];
		if (estimateIds.length === 0) return [];

		let query = db
			.selectFrom('estimates as estimate')
			.leftJoin('projects as project', (join) =>
				join
					.onRef('project.id', '=', 'estimate.project_id')
					.onRef('project.owning_organisation_id', '=', 'estimate.organisation_id')
			)
			.select([
				'estimate.id as id',
				'estimate.public_id as publicId',
				'estimate.estimate_number as estimateNumber',
				'estimate.title as title',
				'estimate.project_id as projectId',
				'project.public_id as projectPublicId',
				'project.project_number as projectNumber'
			])
			.where('estimate.organisation_id', '=', organisationId)
			.where('estimate.id', 'in', estimateIds)
			.orderBy('estimate.id', 'asc');
		if (lock) query = query.forUpdate();
		return query.execute();
	}

	async getWorkspace(
		actor: TenantActorContext,
		quotationPublicIdInput: string,
		requestedVersionNumber?: number
	): Promise<QuotationProjectConversionWorkspace> {
		await this.assertActiveActor(actor);
		const quotationPublicId = validatePublicId(quotationPublicIdInput);
		const acceptedVersionNumber = await this.findAcceptedVersionNumber(actor, quotationPublicId);
		const selectedVersionNumber = requestedVersionNumber ?? acceptedVersionNumber ?? undefined;
		const commercial = await new CommercialService(this.db).getQuotation(actor, quotationPublicId, selectedVersionNumber);
		const [acceptedResponse, permissions, sourceEstimates] = await Promise.all([
			this.findAcceptedResponse(this.db, actor.organisationId, commercial.quotation.id, commercial.version.id),
			this.permissionState(actor),
			this.listSourceEstimates(this.db, actor.organisationId, commercial.version.id)
		]);
		const project = acceptedResponse
			? await this.findConvertedProject(this.db, actor.organisationId, acceptedResponse.id)
			: null;
		return {
			commercial,
			acceptedResponse,
			project,
			sourceEstimates,
			...permissions,
			canConvert:
				permissions.canConvert &&
				Boolean(acceptedResponse) &&
				!project &&
				commercial.version.versionStatus === 'issued' &&
				Boolean(commercial.version.lockedAt) &&
				commercial.quotation.lifecycleStatus === 'active' &&
				sourceEstimates.every((estimate) => estimate.projectId === null)
		};
	}

	async convert(
		actor: TenantActorContext,
		quotationPublicIdInput: string,
		versionNumberInput: number
	): Promise<ConvertedProject> {
		const quotationPublicId = validatePublicId(quotationPublicIdInput);
		const versionNumber = validateVersionNumber(versionNumberInput);

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			const permissions = await this.permissionState(actor, trx);
			if (!permissions.hasCommercialConvertPermission) {
				throw new TenantAccessError('Quotation conversion authority is required.');
			}
			if (!permissions.hasProjectCreatePermission) {
				throw new TenantAccessError('Project creation authority is required.');
			}

			const quotation = await trx
				.selectFrom('quotations')
				.select([
					'id',
					'public_id as publicId',
					'quotation_number as quotationNumber',
					'project_id as projectId',
					'lifecycle_status as lifecycleStatus'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', quotationPublicId)
				.forUpdate()
				.executeTakeFirst() as LockedQuotation | undefined;
			if (!quotation) throw new RecordNotFoundError('Quotation not found.');
			if (quotation.lifecycleStatus !== 'active') {
				throw new CommercialValidationError('Only an active quotation can be converted to a project.');
			}

			const version = await trx
				.selectFrom('quotation_versions')
				.select([
					'id',
					'version_number as versionNumber',
					'title',
					'version_status as versionStatus',
					'locked_at as lockedAt'
				])
				.where('organisation_id', '=', actor.organisationId)
				.where('quotation_id', '=', quotation.id)
				.where('version_number', '=', versionNumber)
				.forUpdate()
				.executeTakeFirst() as LockedQuotationVersion | undefined;
			if (!version) throw new RecordNotFoundError('Quotation version not found.');
			if (version.versionStatus !== 'issued' || !version.lockedAt) {
				throw new CommercialValidationError('Only an issued and locked quotation version can be converted.');
			}

			const acceptedResponse = await this.findAcceptedResponse(
				trx,
				actor.organisationId,
				quotation.id,
				version.id,
				true
			);
			if (!acceptedResponse) {
				throw new CommercialValidationError('The selected quotation version does not have an accepted customer response.');
			}

			const existingProject = await this.findConvertedProject(trx, actor.organisationId, acceptedResponse.id);
			if (existingProject) {
				if (quotation.projectId !== existingProject.id) {
					throw new Error('Quotation conversion evidence is inconsistent with quotations.project_id.');
				}
				return existingProject;
			}
			if (quotation.projectId !== null) {
				throw new CommercialValidationError('This quotation is already linked to a project without matching conversion evidence.');
			}

			const sourceEstimates = await this.listSourceEstimates(trx, actor.organisationId, version.id, true);
			const conflictingEstimate = sourceEstimates.find((estimate) => estimate.projectId !== null);
			if (conflictingEstimate) {
				throw new CommercialValidationError(
					`Source estimate ${conflictingEstimate.estimateNumber} is already linked to another project.`
				);
			}

			const projectRepository = new ProjectRepository(trx);
			const projectNumber = convertedProjectNumber(quotation.quotationNumber, quotation.publicId);
			if (await projectRepository.findOwnedByProjectNumber(actor.organisationId, projectNumber)) {
				throw new CommercialValidationError(`Project number ${projectNumber} already exists without quotation conversion evidence.`);
			}

			const createdAt = this.now();
			const projectPublicId = this.publicIdFactory();
			const projectId = await projectRepository.insert({
				owningOrganisationId: actor.organisationId,
				publicId: projectPublicId,
				projectNumber,
				name: version.title,
				description: `Created from accepted quotation ${quotation.quotationNumber}.`,
				createdByMemberId: membership.id
			});
			await projectRepository.insertOwningParticipation(projectId, actor.organisationId, createdAt);
			await projectRepository.insertProjectMember(projectId, actor.organisationId, membership.id, createdAt);

			await trx
				.insertInto('quotation_project_conversions')
				.values({
					organisation_id: actor.organisationId,
					quotation_response_id: acceptedResponse.id,
					project_id: projectId,
					created_by_member_id: membership.id
				})
				.executeTakeFirstOrThrow();

			await trx
				.updateTable('quotations')
				.set({ project_id: projectId })
				.where('organisation_id', '=', actor.organisationId)
				.where('id', '=', quotation.id)
				.where('project_id', 'is', null)
				.executeTakeFirstOrThrow();

			if (sourceEstimates.length > 0) {
				await trx
					.updateTable('estimates')
					.set({ project_id: projectId })
					.where('organisation_id', '=', actor.organisationId)
					.where('id', 'in', sourceEstimates.map((estimate) => estimate.id))
					.where('project_id', 'is', null)
					.execute();
			}

			const audit = new AuditRepository(trx);
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId,
				actionKey: 'commercial.quotation.converted_to_project',
				subjectType: 'quotation',
				subjectPublicId: quotation.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					quotationNumber: quotation.quotationNumber,
					versionNumber,
					acceptedResponsePublicId: acceptedResponse.publicId,
					projectPublicId,
					projectNumber,
					sourceEstimateCount: sourceEstimates.length
				}
			});
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId,
				actionKey: 'project.created_from_quotation',
				subjectType: 'project',
				subjectPublicId: projectPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					quotationPublicId: quotation.publicId,
					quotationNumber: quotation.quotationNumber,
					quotationVersionNumber: versionNumber,
					acceptedResponsePublicId: acceptedResponse.publicId
				}
			});

			return {
				id: projectId,
				publicId: projectPublicId,
				projectNumber,
				name: version.title,
				status: 'proposed'
			};
		});
	}
}
