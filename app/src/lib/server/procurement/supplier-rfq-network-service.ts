import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { formatScaledDecimal, parseScaledDecimal } from '$lib/server/commercial/commercial-decimal';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { ExternalDeliveryService } from '$lib/server/external-access/external-delivery-service';
import { ExternalInvitationService } from '$lib/server/external-access/external-invitation-service';
import { ExternalWorkService } from '$lib/server/external-access/external-work-service';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import type { Actor } from '$lib/types/request-context';
import { ProcurementRepository } from './procurement-repository';
import { ProcurementValidationError } from './procurement-service';

export type SupplierRfqQuoteLine = {
	rfqItemId: string;
	lineNumber: number;
	description: string;
	requestedQuantity: string;
	offeredQuantity: string;
	unitRate: string;
	leadTimeDays: number | null;
	qualificationNote: string;
};

export type SupplierRfqQuote = {
	workItemPublicId: string;
	state: string;
	ownerName: string;
	projectNumber: string;
	projectName: string;
	rfqPublicId: string;
	rfqNumber: string;
	title: string;
	currencyCode: string;
	responseDeadlineAt: Date | null;
	recipientName: string;
	recipientEmail: string;
	supplierReference: string;
	validUntil: Date | null;
	returnPublicId: string | null;
	submittedAt: Date | null;
	lines: SupplierRfqQuoteLine[];
};

export type SubmitSupplierQuoteInput = {
	workItemPublicId: string;
	supplierReference?: string | null;
	validUntil?: string | null;
	lines: Array<{
		rfqItemId: string;
		offeredQuantity: string;
		unitRate: string;
		leadTimeDays?: string | null;
		qualificationNote?: string | null;
	}>;
};

function requiredPublicId(value: string, label: string): string {
	const id = value.trim();
	if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ProcurementValidationError(`${label} is invalid.`);
	return id;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max) throw new ProcurementValidationError('A supplied value is too long.');
	return text;
}

function decimal(value: string, scale: number, label: string, allowZero = false): string {
	let parsed: bigint;
	try {
		parsed = parseScaledDecimal(value, scale, label);
	} catch (cause) {
		throw new ProcurementValidationError(
			cause instanceof Error ? cause.message : `${label} is invalid.`
		);
	}
	if (allowZero ? parsed < 0n : parsed <= 0n) {
		throw new ProcurementValidationError(
			`${label} must be ${allowZero ? 'zero or greater' : 'greater than zero'}.`
		);
	}
	return formatScaledDecimal(parsed, scale);
}

function optionalDate(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new ProcurementValidationError(`${label} is invalid.`);
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) throw new ProcurementValidationError(`${label} is invalid.`);
	return date;
}

function optionalLeadTime(value: string | null | undefined): number | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const parsed = Number(text);
	if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 36500) {
		throw new ProcurementValidationError('Lead time must be a whole number of days.');
	}
	return parsed;
}

function insertedId(result: { insertId?: bigint }, label: string): string {
	if (result.insertId === undefined) throw new Error(`${label} insert did not return an ID.`);
	return result.insertId.toString();
}

export class SupplierRfqNetworkService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertIssuerAccess(
		actor: TenantActorContext,
		db: DatabaseExecutor
	): Promise<{ id: string }> {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(db).decide(actor, 'procurement.rfq.issue');
		if (!decision.allowed) throw new TenantAccessError('This procurement action is not permitted.');
		return membership;
	}

	async issueRfq(
		actor: TenantActorContext,
		rfqPublicIdInput: string,
		supplierPublicIdInput: string
	): Promise<void> {
		// Construct before the transaction so a missing delivery adapter cannot leave
		// an issued RFQ with no usable invitation path.
		const delivery = new ExternalDeliveryService(this.db);
		const rfqPublicId = requiredPublicId(rfqPublicIdInput, 'RFQ');
		const supplierPublicId = requiredPublicId(supplierPublicIdInput, 'Supplier');

		const deliveryPublicId = await this.db.transaction().execute(async (trx) => {
			const membership = await this.assertIssuerAccess(actor, trx);
			const repository = new ProcurementRepository(trx);
			const rfq = await repository.findRfqByPublicId(actor.organisationId, rfqPublicId);
			if (!rfq) throw new ProcurementValidationError('RFQ not found.');

			const packageRow = await trx
				.selectFrom('procurement_packages as procurementPackage')
				.innerJoin('projects as project', 'project.id', 'procurementPackage.project_id')
				.select([
					'procurementPackage.id as packageId',
					'procurementPackage.public_id as packagePublicId',
					'project.id as projectId',
					'project.public_id as projectPublicId',
					'project.project_number as projectNumber',
					'project.name as projectName'
				])
				.where('procurementPackage.organisation_id', '=', actor.organisationId)
				.where('procurementPackage.id', '=', rfq.packageId)
				.executeTakeFirst();
			if (!packageRow) throw new TenantAccessError();
			const project = await new ProjectRepository(trx).findForMemberByPublicId(
				actor.organisationId,
				actor.memberId,
				packageRow.projectPublicId
			);
			if (!project) throw new TenantAccessError('The RFQ project is outside your effective scope.');

			const supplier = await repository.findEligibleSupplierByPublicId(
				actor.organisationId,
				supplierPublicId
			);
			if (!supplier) {
				throw new ProcurementValidationError(
					'The selected CRM party is not an active supplier-side party.'
				);
			}
			if (!supplier.primaryEmail) {
				throw new ProcurementValidationError(
					'The selected supplier needs a primary email address before a Network RFQ can be issued.'
				);
			}

			const version = (await repository.listRfqVersions(actor.organisationId, rfq.id))[0];
			if (!version || !['draft', 'issued'].includes(version.status)) {
				throw new ProcurementValidationError(
					'Only the current draft or issued RFQ version can invite suppliers.'
				);
			}
			if (version.responseDeadlineAt && version.responseDeadlineAt <= this.now()) {
				throw new ProcurementValidationError('The RFQ response deadline has passed.');
			}
			const duplicate = await trx
				.selectFrom('rfq_invitations')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('rfq_version_id', '=', version.id)
				.where('supplier_party_id', '=', supplier.id)
				.executeTakeFirst();
			if (duplicate) {
				throw new ProcurementValidationError('This supplier has already been invited to this RFQ.');
			}

			if (version.status === 'draft') {
				const updated = await repository.issueRfqVersion({
					organisationId: actor.organisationId,
					versionId: version.id,
					memberId: membership.id
				});
				if (updated !== 1) {
					throw new ProcurementValidationError(
						'The RFQ version changed before it could be issued.'
					);
				}
			}
			const issueEventId = await repository.insertRfqIssueEvent({
				organisationId: actor.organisationId,
				versionId: version.id,
				memberId: membership.id,
				channel: 'portal',
				note: 'Issued through NuBlox Network.'
			});
			const rfqInvitationId = await repository.insertRfqInvitation({
				organisationId: actor.organisationId,
				issueEventId,
				versionId: version.id,
				supplierPartyId: supplier.id,
				recipientName: supplier.displayName,
				recipientEmail: supplier.primaryEmail
			});
			const owner = await trx
				.selectFrom('organisations')
				.select(['legal_name as legalName', 'trading_name as tradingName'])
				.where('id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			const ownerName = owner.tradingName?.trim() || owner.legalName;
			const invitationService = new ExternalInvitationService(
				this.db,
				this.now,
				this.publicIdFactory
			);
			const externalInvitation = await invitationService.createPending(trx, {
				owningOrganisationId: actor.organisationId,
				inviteEmail: supplier.primaryEmail,
				invitedByMemberId: membership.id,
				actorUserId: actor.userId,
				correlationId: actor.correlationId,
				contextType: 'procurement_rfq',
				contextPublicId: rfq.publicId,
				resourceType: 'rfq_invitation',
				capabilityKey: 'procurement.rfq.respond',
				domainKey: 'procurement',
				actionType: 'submit_quote',
				workItemTitle: `Quote ${rfq.rfqNumber} · ${version.title}`,
				workItemSummary: `${ownerName} has requested a supplier quotation for ${packageRow.projectNumber} · ${packageRow.projectName}.`,
				dueAt: version.responseDeadlineAt,
				expiresAt: version.responseDeadlineAt
			});
			await trx
				.insertInto('external_supplier_rfq_links')
				.values({
					external_access_invitation_id: externalInvitation.id,
					rfq_invitation_id: rfqInvitationId
				})
				.executeTakeFirstOrThrow();
			const queuedDeliveryPublicId = await invitationService.queueEmail(trx, {
				owningOrganisationId: actor.organisationId,
				invitationId: externalInvitation.id,
				recipient: supplier.primaryEmail,
				subject: `${ownerName} invited you to quote ${rfq.rfqNumber} on NuBlox`,
				bodyText: `${supplier.displayName},\n\n${ownerName} has invited you to submit a quotation for ${rfq.rfqNumber} · ${version.title}.\n\nProject: ${packageRow.projectNumber} · ${packageRow.projectName}${version.responseDeadlineAt ? `\nResponse due: ${version.responseDeadlineAt.toISOString()}` : ''}\n\nOpen the controlled quotation request: ${externalInvitation.invitationUrl}\n\nThis invitation grants access only to the explicitly shared RFQ work. It does not make you a member of ${ownerName}'s NuBlox organisation.`,
				idempotencyKey: `network:rfq:${rfqInvitationId}`
			});

			await trx
				.updateTable('procurement_packages')
				.set({ lifecycle_status: 'enquiring' })
				.where('id', '=', packageRow.packageId)
				.where('organisation_id', '=', actor.organisationId)
				.where('lifecycle_status', 'in', ['draft', 'planned', 'enquiring'])
				.executeTakeFirst();
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: packageRow.projectId,
				actionKey: 'procurement.rfq.issued',
				subjectType: 'rfq',
				subjectPublicId: rfq.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					versionNumber: version.versionNumber,
					supplierPublicId,
					deliveryChannel: 'portal',
					networkInvitationPublicId: externalInvitation.publicId
				}
			});
			return queuedDeliveryPublicId;
		});

		try {
			await delivery.dispatchByPublicId(deliveryPublicId);
		} catch (cause) {
			// Delivery state is durable and can be retried without rolling back the
			// already-issued business transaction or producing duplicate invitations.
			console.error('[NuBlox Network] RFQ invitation delivery failed.', cause);
		}
	}

	private async quoteContext(authUserId: string, workItemPublicIdInput: string) {
		const workItemPublicId = requiredPublicId(workItemPublicIdInput, 'Network work item');
		return this.db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.innerJoin(
				'external_supplier_rfq_links as link',
				'link.external_access_invitation_id',
				'grant.invitation_id'
			)
			.innerJoin('rfq_invitations as invitation', 'invitation.id', 'link.rfq_invitation_id')
			.innerJoin('rfq_versions as version', 'version.id', 'invitation.rfq_version_id')
			.innerJoin('rfqs as rfq', 'rfq.id', 'version.rfq_id')
			.innerJoin(
				'procurement_packages as procurementPackage',
				'procurementPackage.id',
				'rfq.procurement_package_id'
			)
			.innerJoin('projects as project', 'project.id', 'procurementPackage.project_id')
			.innerJoin('organisations as owner', 'owner.id', 'work.owning_organisation_id')
			.select([
				'work.id as workItemId',
				'work.public_id as workItemPublicId',
				'work.state as state',
				'work.owning_organisation_id as owningOrganisationId',
				'grant.capability_key as capabilityKey',
				'invitation.id as rfqInvitationId',
				'invitation.invitation_status as invitationStatus',
				'invitation.recipient_name as recipientName',
				'invitation.recipient_email as recipientEmail',
				'version.id as versionId',
				'version.version_status as versionStatus',
				'version.title as title',
				'version.currency_code as currencyCode',
				'version.response_deadline_at as responseDeadlineAt',
				'rfq.public_id as rfqPublicId',
				'rfq.rfq_number as rfqNumber',
				'project.id as projectId',
				'project.project_number as projectNumber',
				'project.name as projectName',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName'
			])
			.where('work.public_id', '=', workItemPublicId)
			.where('work.auth_user_id', '=', authUserId)
			.where('work.domain_key', '=', 'procurement')
			.where('work.action_type', '=', 'submit_quote')
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.capability_key', '=', 'procurement.rfq.respond')
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', this.now())
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', this.now())])
			)
			.executeTakeFirst();
	}

	async getQuote(authUserId: string, workItemPublicId: string): Promise<SupplierRfqQuote | null> {
		const context = await this.quoteContext(authUserId, workItemPublicId);
		if (!context || !context.recipientEmail) return null;
		const requested = await this.db
			.selectFrom('rfq_items')
			.select(['id', 'line_number as lineNumber', 'description', 'quantity'])
			.where('organisation_id', '=', context.owningOrganisationId)
			.where('rfq_version_id', '=', context.versionId)
			.orderBy('line_number', 'asc')
			.execute();
		const supplierReturn = await this.db
			.selectFrom('supplier_returns')
			.select([
				'id',
				'public_id as publicId',
				'supplier_reference as supplierReference',
				'valid_until as validUntil',
				'submitted_at as submittedAt'
			])
			.where('organisation_id', '=', context.owningOrganisationId)
			.where('rfq_invitation_id', '=', context.rfqInvitationId)
			.where('return_status', '=', 'submitted')
			.orderBy('submission_number', 'desc')
			.executeTakeFirst();
		const returnedItems = supplierReturn
			? await this.db
					.selectFrom('supplier_return_items')
					.select([
						'rfq_item_id as rfqItemId',
						'offered_quantity as offeredQuantity',
						'unit_rate as unitRate',
						'lead_time_days as leadTimeDays',
						'qualification_note as qualificationNote'
					])
					.where('organisation_id', '=', context.owningOrganisationId)
					.where('supplier_return_id', '=', supplierReturn.id)
					.execute()
			: [];
		const returnedByItem = new Map(returnedItems.map((row) => [row.rfqItemId, row]));
		return {
			workItemPublicId: context.workItemPublicId,
			state: context.state,
			ownerName: context.ownerTradingName?.trim() || context.ownerLegalName,
			projectNumber: context.projectNumber,
			projectName: context.projectName,
			rfqPublicId: context.rfqPublicId,
			rfqNumber: context.rfqNumber,
			title: context.title,
			currencyCode: context.currencyCode,
			responseDeadlineAt: context.responseDeadlineAt,
			recipientName: context.recipientName,
			recipientEmail: context.recipientEmail,
			supplierReference: supplierReturn?.supplierReference ?? '',
			validUntil: supplierReturn?.validUntil ?? null,
			returnPublicId: supplierReturn?.publicId ?? null,
			submittedAt: supplierReturn?.submittedAt ?? null,
			lines: requested.map((item) => {
				const returned = returnedByItem.get(item.id);
				return {
					rfqItemId: item.id,
					lineNumber: item.lineNumber,
					description: item.description,
					requestedQuantity: item.quantity,
					offeredQuantity: returned?.offeredQuantity ?? item.quantity,
					unitRate: returned?.unitRate ?? '',
					leadTimeDays: returned?.leadTimeDays ?? null,
					qualificationNote: returned?.qualificationNote ?? ''
				};
			})
		};
	}

	async submitQuote(
		actor: Actor,
		input: SubmitSupplierQuoteInput,
		correlationId: string
	): Promise<string> {
		const workItemPublicId = requiredPublicId(input.workItemPublicId, 'Network work item');
		const supplierReference = optionalText(input.supplierReference, 160);
		const validUntil = optionalDate(input.validUntil, 'Valid until');
		if (validUntil && validUntil < new Date(this.now().toISOString().slice(0, 10))) {
			throw new ProcurementValidationError('Valid until cannot be in the past.');
		}
		return this.db.transaction().execute(async (trx) => {
			const work = await new ExternalWorkService(this.db, this.now).findAuthorisedForUpdate(
				trx,
				actor.authUserId,
				workItemPublicId,
				{ domainKey: 'procurement', actionType: 'submit_quote' }
			);
			if (
				work.state !== 'open' ||
				work.capabilityKey !== 'procurement.rfq.respond' ||
				!work.invitationId
			) {
				throw new ProcurementValidationError(
					'This supplier quotation request is no longer actionable.'
				);
			}
			const context = await trx
				.selectFrom('external_supplier_rfq_links as link')
				.innerJoin('rfq_invitations as invitation', 'invitation.id', 'link.rfq_invitation_id')
				.innerJoin('rfq_versions as version', 'version.id', 'invitation.rfq_version_id')
				.innerJoin('rfqs as rfq', 'rfq.id', 'version.rfq_id')
				.innerJoin(
					'procurement_packages as procurementPackage',
					'procurementPackage.id',
					'rfq.procurement_package_id'
				)
				.select([
					'invitation.id as rfqInvitationId',
					'invitation.invitation_status as invitationStatus',
					'version.id as versionId',
					'version.version_status as versionStatus',
					'version.currency_code as currencyCode',
					'version.response_deadline_at as responseDeadlineAt',
					'rfq.public_id as rfqPublicId',
					'procurementPackage.project_id as projectId'
				])
				.where('link.external_access_invitation_id', '=', work.invitationId)
				.where('invitation.organisation_id', '=', work.owningOrganisationId)
				.forUpdate()
				.executeTakeFirst();
			if (
				!context ||
				context.invitationStatus !== 'invited' ||
				context.versionStatus !== 'issued'
			) {
				throw new ProcurementValidationError('This supplier quotation request is no longer open.');
			}
			if (context.responseDeadlineAt && context.responseDeadlineAt <= this.now()) {
				throw new ProcurementValidationError('The RFQ response deadline has passed.');
			}
			const existing = await trx
				.selectFrom('supplier_returns')
				.select('id')
				.where('organisation_id', '=', work.owningOrganisationId)
				.where('rfq_invitation_id', '=', context.rfqInvitationId)
				.where('return_status', '=', 'submitted')
				.executeTakeFirst();
			if (existing) throw new ProcurementValidationError('A quotation has already been submitted.');

			const requestedItems = await trx
				.selectFrom('rfq_items')
				.select(['id', 'line_number as lineNumber'])
				.where('organisation_id', '=', work.owningOrganisationId)
				.where('rfq_version_id', '=', context.versionId)
				.orderBy('line_number', 'asc')
				.execute();
			if (requestedItems.length === 0)
				throw new ProcurementValidationError('The RFQ contains no quote lines.');
			const suppliedById = new Map(input.lines.map((line) => [line.rfqItemId, line]));
			if (
				suppliedById.size !== input.lines.length ||
				suppliedById.size !== requestedItems.length ||
				requestedItems.some((item) => !suppliedById.has(item.id))
			) {
				throw new ProcurementValidationError(
					'The quotation must price every RFQ line exactly once.'
				);
			}

			const returnPublicId = this.publicIdFactory();
			const returnInsert = await trx
				.insertInto('supplier_returns')
				.values({
					organisation_id: work.owningOrganisationId,
					public_id: returnPublicId,
					rfq_version_id: context.versionId,
					rfq_invitation_id: context.rfqInvitationId,
					submission_number: 1,
					return_status: 'submitted',
					currency_code: context.currencyCode,
					supplier_reference: supplierReference,
					valid_until: validUntil,
					submitted_at: this.now(),
					recorded_by_member_id: null
				})
				.executeTakeFirstOrThrow();
			const supplierReturnId = insertedId(returnInsert, 'Supplier return');
			for (const item of requestedItems) {
				const submitted = suppliedById.get(item.id)!;
				await trx
					.insertInto('supplier_return_items')
					.values({
						organisation_id: work.owningOrganisationId,
						supplier_return_id: supplierReturnId,
						rfq_item_id: item.id,
						line_number: item.lineNumber,
						description: null,
						offered_quantity: decimal(submitted.offeredQuantity, 6, 'Offered quantity'),
						unit_rate: decimal(submitted.unitRate, 4, 'Unit rate', true),
						lead_time_days: optionalLeadTime(submitted.leadTimeDays),
						qualification_note: optionalText(submitted.qualificationNote, 4000)
					})
					.executeTakeFirstOrThrow();
			}
			const updatedInvitation = await trx
				.updateTable('rfq_invitations')
				.set({ invitation_status: 'responded', responded_at: this.now() })
				.where('id', '=', context.rfqInvitationId)
				.where('organisation_id', '=', work.owningOrganisationId)
				.where('invitation_status', '=', 'invited')
				.executeTakeFirst();
			if (updatedInvitation.numUpdatedRows !== 1n) {
				throw new ProcurementValidationError(
					'The RFQ invitation changed before submission completed.'
				);
			}
			await new ExternalWorkService(this.db, this.now).markCompleted(trx, work.id, this.now());
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: work.owningOrganisationId,
				actorUserId: actor.userId,
				actorMemberId: null,
				externalAuthUserId: actor.authUserId,
				projectId: context.projectId,
				actionKey: 'procurement.rfq.return.submitted',
				subjectType: 'supplier_return',
				subjectPublicId: returnPublicId,
				correlationId,
				changeSummary: { rfqPublicId: context.rfqPublicId, lineCount: requestedItems.length }
			});
			return returnPublicId;
		});
	}
}
