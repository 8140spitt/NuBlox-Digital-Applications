import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CrmOpportunityValidationError, type OpportunityInput } from './crm-opportunity-service';
import { CrmOpportunityRepository, type CrmOpportunitySummary } from './crm-opportunity-repository';
import { CrmRepository, type CrmOrganisationContact, type CrmPartySummary } from './crm-repository';

const CLIENT_ROLE_CODES = new Set(['prospect', 'client']);

export type OpportunityClientContactOption = {
	publicId: string;
	displayName: string;
	primaryEmail: string | null;
	primaryPhone: string | null;
	jobTitle: string | null;
	department: string | null;
	isPrimaryContact: boolean;
};

export type OpportunityClientAccountOption = {
	publicId: string;
	displayName: string;
	contacts: OpportunityClientContactOption[];
	primaryContactPublicId: string | null;
	primaryContactDisplayName: string | null;
};

export type OpportunityWithClientInput = OpportunityInput & {
	clientContactPartyPublicId?: string | null;
};

function isClientOrganisation(party: CrmPartySummary): boolean {
	return (
		party.kind === 'organisation' &&
		party.status === 'active' &&
		party.roles.some((role) => CLIENT_ROLE_CODES.has(role.code))
	);
}

function requiredText(value: string, maxLength: number, label: string): string {
	const text = value.trim();
	if (!text || text.length > maxLength) {
		throw new CrmOpportunityValidationError(
			`${label} must be between 1 and ${maxLength} characters.`
		);
	}
	return text;
}

function optionalText(
	value: string | null | undefined,
	maxLength: number,
	label: string
): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > maxLength) {
		throw new CrmOpportunityValidationError(`${label} must not exceed ${maxLength} characters.`);
	}
	return text;
}

function moneyValue(value: string | null | undefined): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{1,15}(\.\d{1,4})?$/.test(text)) {
		throw new CrmOpportunityValidationError(
			'Estimated value must be a non-negative amount with at most four decimal places.'
		);
	}
	return text;
}

function currencyCode(value: string | null | undefined): string {
	const text = (value?.trim() || 'GBP').toUpperCase();
	if (!/^[A-Z]{3}$/.test(text)) {
		throw new CrmOpportunityValidationError('Currency code must be a three-letter ISO code.');
	}
	return text;
}

function dateValue(value: string | null | undefined): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
		throw new CrmOpportunityValidationError('Expected close date must be a valid date.');
	}
	const date = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
		throw new CrmOpportunityValidationError('Expected close date must be a valid date.');
	}
	return date;
}

function mapContact(contact: CrmOrganisationContact): OpportunityClientContactOption {
	return {
		publicId: contact.personPublicId,
		displayName: contact.displayName,
		primaryEmail: contact.primaryEmail,
		primaryPhone: contact.primaryPhone,
		jobTitle: contact.jobTitle,
		department: contact.department,
		isPrimaryContact: contact.isPrimaryContact
	};
}

export class CrmOpportunityClientService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async requireActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async requireView(actor: TenantActorContext): Promise<void> {
		await this.requireActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, 'crm.view');
		if (!decision.allowed) throw new TenantAccessError('CRM viewing is not permitted.');
	}

	private async requireManage(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'crm.opportunity.manage',
			'crm.manage'
		);
		if (!decision.allowed) {
			throw new TenantAccessError('CRM opportunity management is not permitted.');
		}
	}

	async listClientAccounts(actor: TenantActorContext): Promise<OpportunityClientAccountOption[]> {
		await this.requireView(actor);
		const repository = new CrmRepository(this.db);
		const organisations = (
			await repository.listParties(actor.organisationId, {
				kind: 'organisation',
				status: 'active'
			})
		).filter(isClientOrganisation);

		return Promise.all(
			organisations.map(async (organisation) => {
				const contacts = (
					await repository.listOrganisationContacts(actor.organisationId, organisation.id)
				).filter((contact) => contact.status === 'active');
				const primary = contacts.find((contact) => contact.isPrimaryContact) ?? null;
				return {
					publicId: organisation.publicId,
					displayName: organisation.displayName,
					contacts: contacts.map(mapContact),
					primaryContactPublicId: primary?.personPublicId ?? null,
					primaryContactDisplayName: primary?.displayName ?? null
				};
			})
		);
	}

	private async resolveClient(
		actor: TenantActorContext,
		organisationPublicId: string,
		contactPublicId: string | null,
		db: DatabaseExecutor
	) {
		const repository = new CrmRepository(db);
		const organisation = await repository.findPartyByPublicId(
			actor.organisationId,
			organisationPublicId
		);
		if (!organisation || !isClientOrganisation(organisation)) {
			throw new CrmOpportunityValidationError(
				'Client organisation must be an active CRM organisation classified as a prospect or client.'
			);
		}

		const contacts = (
			await repository.listOrganisationContacts(actor.organisationId, organisation.id)
		).filter((contact) => contact.status === 'active');
		if (contacts.length === 0) {
			throw new CrmOpportunityValidationError(
				'The selected client organisation has no active CRM contacts. Add a primary contact first.'
			);
		}

		const explicitContactPublicId = contactPublicId?.trim() || null;
		const contact = explicitContactPublicId
			? (contacts.find((candidate) => candidate.personPublicId === explicitContactPublicId) ?? null)
			: (contacts.find((candidate) => candidate.isPrimaryContact) ?? null);

		if (!contact) {
			throw new CrmOpportunityValidationError(
				explicitContactPublicId
					? 'The selected client contact is not an active contact of that client organisation.'
					: 'The selected client organisation does not have an active CRM primary contact.'
			);
		}

		return { organisation, contact };
	}

	async createOpportunity(
		actor: TenantActorContext,
		input: OpportunityWithClientInput
	): Promise<CrmOpportunitySummary> {
		await this.requireActiveActor(actor);
		await this.requireManage(actor);
		const title = requiredText(input.title, 255, 'Opportunity title');
		const description = optionalText(input.description, 10_000, 'Opportunity description');
		const pipelinePublicId = requiredText(input.pipelinePublicId, 64, 'Pipeline');
		const stageName = requiredText(input.stageName, 160, 'Pipeline stage');
		const estimatedValue = moneyValue(input.estimatedValue);
		const currency = currencyCode(input.currencyCode);
		const expectedCloseDate = dateValue(input.expectedCloseDate);
		const clientOrganisationPublicId = requiredText(
			input.primaryPartyPublicId,
			64,
			'Client organisation'
		);

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireActiveActor(actor, trx);
			await this.requireManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const stage = await repository.resolveStage(
				actor.organisationId,
				pipelinePublicId,
				stageName
			);
			if (!stage) {
				throw new CrmOpportunityValidationError('The selected pipeline stage is unavailable.');
			}

			const { organisation, contact } = await this.resolveClient(
				actor,
				clientOrganisationPublicId,
				input.clientContactPartyPublicId ?? null,
				trx
			);
			const [customerRoleTypeId, contactRoleTypeId] = await Promise.all([
				repository.findOpportunityPartyRoleTypeId('customer'),
				repository.findOpportunityPartyRoleTypeId('client_contact')
			]);
			if (customerRoleTypeId === null || contactRoleTypeId === null) {
				throw new Error('Required CRM opportunity party role types are missing.');
			}

			const opportunityPublicId = this.publicIdFactory();
			const opportunityId = await repository.insertOpportunity({
				organisationId: actor.organisationId,
				publicId: opportunityPublicId,
				pipelineId: stage.pipelineId,
				stageId: stage.stageId,
				ownerMemberId: membership.id,
				title,
				description,
				estimatedValue,
				currencyCode: currency,
				expectedCloseDate
			});
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId,
				partyId: organisation.id,
				roleTypeId: customerRoleTypeId,
				isPrimary: true
			});
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId,
				partyId: contact.personPartyId,
				roleTypeId: contactRoleTypeId,
				isPrimary: false
			});

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.created',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					clientOrganisationPublicId: organisation.publicId,
					clientContactPartyPublicId: contact.personPublicId,
					clientContactDefaultedFromPrimary: !input.clientContactPartyPublicId?.trim(),
					pipelinePublicId,
					stageName,
					estimatedValue,
					currencyCode: currency
				}
			});

			const created = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!created) throw new RecordNotFoundError('Created CRM opportunity could not be reloaded.');
			return created;
		});
	}
}
