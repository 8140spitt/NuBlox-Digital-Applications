import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CrmOpportunityValidationError, type OpportunityInput } from './crm-opportunity-service';
import {
	CrmOpportunityRepository,
	type CrmOpportunitySummary,
	type OpportunityStatus
} from './crm-opportunity-repository';
import { CrmRepository, type CrmOrganisationContact, type CrmPartySummary } from './crm-repository';

const CUSTOMER_ROLE_CODES = new Set(['prospect', 'client']);

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
	kind: 'organisation' | 'person';
	contacts: OpportunityClientContactOption[];
	primaryContactPublicId: string | null;
	primaryContactDisplayName: string | null;
};

export type OpportunityWithClientInput = OpportunityInput & {
	clientContactPartyPublicId?: string | null;
};

export type OpportunityWithClientUpdateInput = OpportunityWithClientInput & {
	opportunityPublicId: string;
	status: OpportunityStatus;
};

function isCustomerParty(party: CrmPartySummary): boolean {
	return (
		party.status === 'active' &&
		party.roles.some((role) => CUSTOMER_ROLE_CODES.has(role.code))
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
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
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
		const customers = (
			await repository.listParties(actor.organisationId, { status: 'active' })
		).filter(isCustomerParty);

		return Promise.all(
			customers.map(async (customer) => {
				if (customer.kind === 'person') {
					return {
						publicId: customer.publicId,
						displayName: customer.displayName,
						kind: 'person' as const,
						contacts: [],
						primaryContactPublicId: null,
						primaryContactDisplayName: null
					};
				}

				const contacts = (
					await repository.listOrganisationContacts(actor.organisationId, customer.id)
				).filter((contact) => contact.status === 'active');
				const primary = contacts.find((contact) => contact.isPrimaryContact) ?? null;
				return {
					publicId: customer.publicId,
					displayName: customer.displayName,
					kind: 'organisation' as const,
					contacts: contacts.map(mapContact),
					primaryContactPublicId: primary?.personPublicId ?? null,
					primaryContactDisplayName: primary?.displayName ?? null
				};
			})
		);
	}

	private async resolveCustomer(
		actor: TenantActorContext,
		customerPublicId: string,
		contactPublicId: string | null,
		db: DatabaseExecutor
	): Promise<{
		customer: CrmPartySummary;
		contactPartyId: string;
		contactPublicId: string;
		contactDefaultedFromPrimary: boolean;
	}> {
		const repository = new CrmRepository(db);
		const customer = await repository.findPartyByPublicId(actor.organisationId, customerPublicId);
		if (!customer || !isCustomerParty(customer)) {
			throw new CrmOpportunityValidationError(
				'Customer must be an active CRM prospect or client, either an organisation or a private person.'
			);
		}

		const explicitContactPublicId = contactPublicId?.trim() || null;
		if (customer.kind === 'person') {
			if (explicitContactPublicId && explicitContactPublicId !== customer.publicId) {
				throw new CrmOpportunityValidationError(
					'Private person customers do not use a separate client contact.'
				);
			}
			return {
				customer,
				contactPartyId: customer.id,
				contactPublicId: customer.publicId,
				contactDefaultedFromPrimary: false
			};
		}

		const contacts = (
			await repository.listOrganisationContacts(actor.organisationId, customer.id)
		).filter((contact) => contact.status === 'active');
		if (contacts.length === 0) {
			throw new CrmOpportunityValidationError(
				'The selected customer organisation has no active CRM contacts. Add a primary contact first.'
			);
		}

		const contact = explicitContactPublicId
			? (contacts.find((candidate) => candidate.personPublicId === explicitContactPublicId) ?? null)
			: (contacts.find((candidate) => candidate.isPrimaryContact) ?? null);
		if (!contact) {
			throw new CrmOpportunityValidationError(
				explicitContactPublicId
					? 'The selected client contact is not an active contact of that customer organisation.'
					: 'The selected customer organisation does not have an active CRM primary contact.'
			);
		}

		return {
			customer,
			contactPartyId: contact.personPartyId,
			contactPublicId: contact.personPublicId,
			contactDefaultedFromPrimary: !explicitContactPublicId
		};
	}

	private validateInput(input: OpportunityWithClientInput) {
		return {
			title: requiredText(input.title, 255, 'Opportunity title'),
			description: optionalText(input.description, 10_000, 'Opportunity description'),
			pipelinePublicId: requiredText(input.pipelinePublicId, 64, 'Pipeline'),
			stageName: requiredText(input.stageName, 160, 'Pipeline stage'),
			estimatedValue: moneyValue(input.estimatedValue),
			currencyCode: currencyCode(input.currencyCode),
			expectedCloseDate: dateValue(input.expectedCloseDate),
			customerPublicId: requiredText(input.primaryPartyPublicId, 64, 'Customer'),
			clientContactPartyPublicId: input.clientContactPartyPublicId?.trim() || null
		};
	}

	async createOpportunity(
		actor: TenantActorContext,
		input: OpportunityWithClientInput
	): Promise<CrmOpportunitySummary> {
		await this.requireActiveActor(actor);
		await this.requireManage(actor);
		const validated = this.validateInput(input);

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireActiveActor(actor, trx);
			await this.requireManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const stage = await repository.resolveStage(
				actor.organisationId,
				validated.pipelinePublicId,
				validated.stageName
			);
			if (!stage) {
				throw new CrmOpportunityValidationError('The selected pipeline stage is unavailable.');
			}

			const context = await this.resolveCustomer(
				actor,
				validated.customerPublicId,
				validated.clientContactPartyPublicId,
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
				title: validated.title,
				description: validated.description,
				estimatedValue: validated.estimatedValue,
				currencyCode: validated.currencyCode,
				expectedCloseDate: validated.expectedCloseDate
			});
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId,
				partyId: context.customer.id,
				roleTypeId: customerRoleTypeId,
				isPrimary: true
			});
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId,
				partyId: context.contactPartyId,
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
					customerPublicId: context.customer.publicId,
					customerKind: context.customer.kind,
					clientContactPartyPublicId: context.contactPublicId,
					clientContactDefaultedFromPrimary: context.contactDefaultedFromPrimary,
					pipelinePublicId: validated.pipelinePublicId,
					stageName: validated.stageName,
					estimatedValue: validated.estimatedValue,
					currencyCode: validated.currencyCode
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

	async updateOpportunity(
		actor: TenantActorContext,
		input: OpportunityWithClientUpdateInput
	): Promise<CrmOpportunitySummary> {
		await this.requireActiveActor(actor);
		await this.requireManage(actor);
		const opportunityPublicId = requiredText(input.opportunityPublicId, 64, 'Opportunity ID');
		const validated = this.validateInput(input);

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireActiveActor(actor, trx);
			await this.requireManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const current = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!current) throw new RecordNotFoundError('CRM opportunity not found.');
			const stage = await repository.resolveStage(
				actor.organisationId,
				validated.pipelinePublicId,
				validated.stageName
			);
			if (!stage) {
				throw new CrmOpportunityValidationError('The selected pipeline stage is unavailable.');
			}
			const context = await this.resolveCustomer(
				actor,
				validated.customerPublicId,
				validated.clientContactPartyPublicId,
				trx
			);
			const [customerRoleTypeId, contactRoleTypeId] = await Promise.all([
				repository.findOpportunityPartyRoleTypeId('customer'),
				repository.findOpportunityPartyRoleTypeId('client_contact')
			]);
			if (customerRoleTypeId === null || contactRoleTypeId === null) {
				throw new Error('Required CRM opportunity party role types are missing.');
			}

			if (
				!(await repository.hasParticipant(
					actor.organisationId,
					current.id,
					context.customer.id,
					customerRoleTypeId
				))
			) {
				await repository.insertParticipant({
					organisationId: actor.organisationId,
					opportunityId: current.id,
					partyId: context.customer.id,
					roleTypeId: customerRoleTypeId,
					isPrimary: false
				});
			}
			await repository.clearPrimaryParticipant(actor.organisationId, current.id);
			if (
				!(await repository.markParticipantPrimary({
					organisationId: actor.organisationId,
					opportunityId: current.id,
					partyId: context.customer.id,
					roleTypeId: customerRoleTypeId
				}))
			) {
				throw new Error('Primary opportunity customer assignment could not be updated.');
			}

			const participants = await repository.listParticipants(actor.organisationId, current.id);
			for (const participant of participants) {
				if (participant.roleCode !== 'client_contact') continue;
				await repository.deleteParticipant({
					organisationId: actor.organisationId,
					opportunityId: current.id,
					partyId: participant.partyId,
					roleTypeId: contactRoleTypeId
				});
			}
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId: current.id,
				partyId: context.contactPartyId,
				roleTypeId: contactRoleTypeId,
				isPrimary: false
			});

			const closedAt =
				input.status === 'open'
					? null
					: current.status === input.status && current.closedAt
						? current.closedAt
						: this.now();
			await repository.updateOpportunity({
				organisationId: actor.organisationId,
				opportunityId: current.id,
				pipelineId: stage.pipelineId,
				stageId: stage.stageId,
				title: validated.title,
				description: validated.description,
				estimatedValue: validated.estimatedValue,
				currencyCode: validated.currencyCode,
				expectedCloseDate: validated.expectedCloseDate,
				status: input.status,
				closedAt
			});

			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.updated',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					status: { from: current.status, to: input.status },
					stage: { from: current.stageName, to: validated.stageName },
					customerPublicId: context.customer.publicId,
					customerKind: context.customer.kind,
					clientContactPartyPublicId: context.contactPublicId,
					clientContactDefaultedFromPrimary: context.contactDefaultedFromPrimary
				}
			});

			const updated = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!updated) throw new RecordNotFoundError('Updated CRM opportunity could not be reloaded.');
			return updated;
		});
	}
}