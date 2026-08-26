import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CrmValidationError } from './crm-service';
import { CrmRepository, type CrmPartyDetail } from './crm-repository';

export type CrmOrganisationOnboardingInput = {
	legalName: string;
	tradingName?: string | null;
	organisationEmail?: string | null;
	organisationPhone?: string | null;
	roleCodes?: readonly string[];
	contactHonorific?: string | null;
	contactGivenNames?: string | null;
	contactFamilyName?: string | null;
	contactPreferredName?: string | null;
	contactEmail?: string | null;
	contactPhone?: string | null;
	contactJobTitle?: string | null;
	contactDepartment?: string | null;
};

function requiredText(value: string | null | undefined, maxLength: number, label: string): string {
	const text = value?.trim() ?? '';
	if (!text || text.length > maxLength) {
		throw new CrmValidationError(`${label} must be between 1 and ${maxLength} characters.`);
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
		throw new CrmValidationError(`${label} must not exceed ${maxLength} characters.`);
	}
	return text;
}

function emailValue(value: string | null | undefined, label: string): string | null {
	const email = value?.trim().toLowerCase() ?? '';
	if (!email) return null;
	if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new CrmValidationError(`${label} must be a valid email address.`);
	}
	return email;
}

function phoneValue(value: string | null | undefined, label: string): string | null {
	const phone = value?.trim() ?? '';
	if (!phone) return null;
	if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
		throw new CrmValidationError(`${label} must use E.164 format, for example +442071234567.`);
	}
	return phone;
}

function roleCodes(input: readonly string[] | undefined): string[] {
	const values = [...new Set((input ?? []).map((value) => value.trim()).filter(Boolean))];
	if (values.length > 20 || values.some((value) => !/^[a-z0-9_]{1,64}$/.test(value))) {
		throw new CrmValidationError('One or more CRM business roles are invalid.');
	}
	return values;
}

export class CrmOrganisationOnboardingService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async requireActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async requireAuthority(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const permissions = new PermissionService(db);
		const [partyDecision, contactDecision] = await Promise.all([
			permissions.decideWithUmbrella(actor, 'crm.party.manage', 'crm.manage'),
			permissions.decideWithUmbrella(actor, 'crm.contact.manage', 'crm.manage')
		]);
		if (!partyDecision.allowed || !contactDecision.allowed) {
			throw new TenantAccessError(
				'Creating a CRM organisation requires both party and contact management authority.'
			);
		}
	}

	async createOrganisation(
		actor: TenantActorContext,
		input: CrmOrganisationOnboardingInput
	): Promise<CrmPartyDetail> {
		await this.requireActor(actor);
		await this.requireAuthority(actor);

		const legalName = requiredText(input.legalName, 255, 'Organisation legal name');
		const tradingName = optionalText(input.tradingName, 255, 'Organisation trading name');
		const organisationEmail = emailValue(input.organisationEmail, 'Organisation email');
		const organisationPhone = phoneValue(input.organisationPhone, 'Organisation phone');
		const assignedRoleCodes = roleCodes(input.roleCodes);
		const contactHonorific = optionalText(input.contactHonorific, 64, 'Contact honorific');
		const contactGivenNames = optionalText(input.contactGivenNames, 200, 'Contact given names');
		const contactFamilyName = optionalText(input.contactFamilyName, 160, 'Contact family name');
		const contactPreferredName = optionalText(
			input.contactPreferredName,
			160,
			'Contact preferred name'
		);
		if (!contactGivenNames && !contactFamilyName && !contactPreferredName) {
			throw new CrmValidationError(
				'A CRM organisation requires at least one named contact. Enter the primary contact name.'
			);
		}
		const contactEmail = emailValue(input.contactEmail, 'Contact email');
		const contactPhone = phoneValue(input.contactPhone, 'Contact phone');
		const contactJobTitle = optionalText(input.contactJobTitle, 160, 'Contact job title');
		const contactDepartment = optionalText(input.contactDepartment, 160, 'Contact department');

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.requireActor(actor, trx);
			await this.requireAuthority(actor, trx);
			const repository = new CrmRepository(trx);
			const resolvedRoleIds = await repository.findActiveRoleTypeIdsByCodes(assignedRoleCodes);
			if (resolvedRoleIds.length !== assignedRoleCodes.length) {
				throw new CrmValidationError('One or more CRM business roles are unavailable.');
			}

			const organisationPublicId = this.publicIdFactory();
			const organisationPartyId = await repository.insertParty({
				organisationId: actor.organisationId,
				publicId: organisationPublicId,
				kind: 'organisation',
				accountOwnerMemberId: membership.id
			});
			await repository.insertOrganisationSubtype({
				organisationId: actor.organisationId,
				partyId: organisationPartyId,
				legalName,
				tradingName
			});
			await repository.setPrimaryEmail(
				actor.organisationId,
				organisationPartyId,
				organisationEmail
			);
			await repository.setPrimaryPhone(
				actor.organisationId,
				organisationPartyId,
				organisationPhone
			);
			await repository.setPartyRoles(actor.organisationId, organisationPartyId, resolvedRoleIds);

			const contactPublicId = this.publicIdFactory();
			const contactPartyId = await repository.insertParty({
				organisationId: actor.organisationId,
				publicId: contactPublicId,
				kind: 'person',
				accountOwnerMemberId: membership.id
			});
			await repository.insertPersonSubtype({
				organisationId: actor.organisationId,
				partyId: contactPartyId,
				honorific: contactHonorific,
				givenNames: contactGivenNames,
				familyName: contactFamilyName,
				preferredName: contactPreferredName
			});
			await repository.setPrimaryEmail(actor.organisationId, contactPartyId, contactEmail);
			await repository.setPrimaryPhone(actor.organisationId, contactPartyId, contactPhone);
			await repository.setPartyRoles(actor.organisationId, contactPartyId, []);
			await repository.insertOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId,
				personPartyId: contactPartyId,
				jobTitle: contactJobTitle,
				department: contactDepartment,
				isPrimaryContact: true,
				startedOn: this.now()
			});

			const audit = new AuditRepository(trx);
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.party.created',
				subjectType: 'crm_party',
				subjectPublicId: organisationPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					kind: 'organisation',
					roleCodes: assignedRoleCodes,
					primaryContactPartyPublicId: contactPublicId
				}
			});
			await audit.append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.contact.created',
				subjectType: 'crm_party',
				subjectPublicId: contactPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					organisationPartyPublicId: organisationPublicId,
					jobTitle: contactJobTitle,
					department: contactDepartment,
					isPrimaryContact: true
				}
			});

			const created = await repository.findPartyByPublicId(
				actor.organisationId,
				organisationPublicId
			);
			if (!created) throw new Error('Created CRM organisation could not be reloaded.');
			return created;
		});
	}
}
