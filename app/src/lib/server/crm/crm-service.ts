import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	CrmRepository,
	type CrmOrganisationContact,
	type CrmPartyDetail,
	type CrmPartyKind,
	type CrmPartyStatus,
	type CrmPartySummary,
	type CrmPersonAffiliation,
	type CrmRoleType
} from './crm-repository';

export type CrmPartyInput = {
	kind: CrmPartyKind;
	honorific?: string | null;
	givenNames?: string | null;
	familyName?: string | null;
	preferredName?: string | null;
	legalName?: string | null;
	tradingName?: string | null;
	primaryEmail?: string | null;
	primaryPhone?: string | null;
	roleCodes?: readonly string[];
};

export type UpdateCrmPartyInput = Omit<CrmPartyInput, 'kind'> & {
	partyPublicId: string;
	status: CrmPartyStatus;
};

export type CrmListFilters = {
	search?: string;
	kind?: CrmPartyKind;
	status?: CrmPartyStatus;
};

export type CrmWorkspace = {
	canView: boolean;
	canManage: boolean;
	parties: CrmPartySummary[];
	roleTypes: CrmRoleType[];
	filters: CrmListFilters;
};

export type CrmPartyWorkspace = {
	party: CrmPartyDetail;
	canManage: boolean;
	canManageContacts: boolean;
	roleTypes: CrmRoleType[];
	contacts: CrmOrganisationContact[];
	affiliations: CrmPersonAffiliation[];
	contactCandidates: CrmPartySummary[];
};

export type CrmContactInput = {
	honorific?: string | null;
	givenNames?: string | null;
	familyName?: string | null;
	preferredName?: string | null;
	primaryEmail?: string | null;
	primaryPhone?: string | null;
	jobTitle?: string | null;
	department?: string | null;
	isPrimaryContact?: boolean;
};

export class CrmValidationError extends Error {
	readonly code = 'CRM_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CrmValidationError';
	}
}

type ValidatedPartyInput = {
	kind: CrmPartyKind;
	honorific: string | null;
	givenNames: string | null;
	familyName: string | null;
	preferredName: string | null;
	legalName: string | null;
	tradingName: string | null;
	primaryEmail: string | null;
	primaryPhone: string | null;
	roleCodes: string[];
};

type CrmManagePermission = 'crm.party.manage' | 'crm.contact.manage';

function optionalText(value: string | null | undefined, maxLength: number, label: string): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > maxLength) throw new CrmValidationError(`${label} must not exceed ${maxLength} characters.`);
	return text;
}

function normalisePublicId(value: string, label: string): string {
	const publicId = value.trim();
	if (!publicId || publicId.length > 64) throw new CrmValidationError(`${label} is required.`);
	return publicId;
}

function normaliseEmail(value: string | null | undefined): string | null {
	const email = value?.trim().toLowerCase() ?? '';
	if (!email) return null;
	if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		throw new CrmValidationError('Enter a valid email address.');
	}
	return email;
}

function normalisePhone(value: string | null | undefined): string | null {
	const phone = value?.trim() ?? '';
	if (!phone) return null;
	if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
		throw new CrmValidationError('Phone numbers must use E.164 format, for example +442071234567.');
	}
	return phone;
}

function normaliseRoleCodes(input: readonly string[] | undefined): string[] {
	const codes = [...new Set((input ?? []).map((value) => value.trim()).filter(Boolean))];
	if (codes.length > 20 || codes.some((code) => !/^[a-z0-9_]{1,64}$/.test(code))) {
		throw new CrmValidationError('One or more CRM business roles are invalid.');
	}
	return codes;
}

function validatePartyInput(input: CrmPartyInput): ValidatedPartyInput {
	if (input.kind !== 'person' && input.kind !== 'organisation') {
		throw new CrmValidationError('Party type must be person or organisation.');
	}
	const honorific = optionalText(input.honorific, 64, 'Honorific');
	const givenNames = optionalText(input.givenNames, 200, 'Given names');
	const familyName = optionalText(input.familyName, 160, 'Family name');
	const preferredName = optionalText(input.preferredName, 160, 'Preferred name');
	const legalName = optionalText(input.legalName, 255, 'Legal name');
	const tradingName = optionalText(input.tradingName, 255, 'Trading name');

	if (input.kind === 'person' && !givenNames && !familyName && !preferredName) {
		throw new CrmValidationError('A person requires a given, family or preferred name.');
	}
	if (input.kind === 'organisation' && !legalName) {
		throw new CrmValidationError('An organisation requires a legal name.');
	}

	return {
		kind: input.kind,
		honorific,
		givenNames,
		familyName,
		preferredName,
		legalName,
		tradingName,
		primaryEmail: normaliseEmail(input.primaryEmail),
		primaryPhone: normalisePhone(input.primaryPhone),
		roleCodes: normaliseRoleCodes(input.roleCodes)
	};
}

function validateStatus(status: CrmPartyStatus): CrmPartyStatus {
	if (status !== 'active' && status !== 'inactive' && status !== 'archived') {
		throw new CrmValidationError('CRM party status is invalid.');
	}
	return status;
}

export class CrmService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async assertManage(
		actor: TenantActorContext,
		permissionKey: CrmManagePermission,
		db = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(actor, permissionKey, 'crm.manage');
		if (!decision.allowed) throw new TenantAccessError('CRM management is not permitted.');
	}

	private async resolveRoleIds(
		repository: CrmRepository,
		roleCodes: readonly string[]
	): Promise<number[]> {
		const roleIds = await repository.findActiveRoleTypeIdsByCodes(roleCodes);
		if (roleIds.length !== roleCodes.length) {
			throw new CrmValidationError('One or more CRM business roles are unavailable.');
		}
		return roleIds;
	}

	async listWorkspace(actor: TenantActorContext, filters: CrmListFilters = {}): Promise<CrmWorkspace> {
		await this.assertActiveActor(actor);
		const permissionService = new PermissionService(this.db);
		const [viewDecision, partyManageDecision] = await Promise.all([
			permissionService.decide(actor, 'crm.view'),
			permissionService.decideWithUmbrella(actor, 'crm.party.manage', 'crm.manage')
		]);
		const canView = viewDecision.allowed;
		const canManage = partyManageDecision.allowed;
		const repository = new CrmRepository(this.db);
		return {
			canView,
			canManage,
			parties: canView ? await repository.listParties(actor.organisationId, filters) : [],
			roleTypes: canManage ? await repository.listRoleTypes() : [],
			filters
		};
	}

	async getPartyWorkspace(actor: TenantActorContext, partyPublicIdInput: string): Promise<CrmPartyWorkspace> {
		await this.assertActiveActor(actor);
		const publicId = normalisePublicId(partyPublicIdInput, 'CRM party ID');
		const permissionService = new PermissionService(this.db);
		const viewDecision = await permissionService.decide(actor, 'crm.view');
		if (!viewDecision.allowed) throw new RecordNotFoundError('CRM party not found.');
		const repository = new CrmRepository(this.db);
		const party = await repository.findPartyByPublicId(actor.organisationId, publicId);
		if (!party) throw new RecordNotFoundError('CRM party not found.');
		const [partyManageDecision, contactManageDecision] = await Promise.all([
			permissionService.decideWithUmbrella(actor, 'crm.party.manage', 'crm.manage'),
			permissionService.decideWithUmbrella(actor, 'crm.contact.manage', 'crm.manage')
		]);
		const canManage = partyManageDecision.allowed;
		const canManageContacts = contactManageDecision.allowed;
		const roleTypesPromise = canManage ? repository.listRoleTypes() : Promise.resolve([]);
		const contactsPromise =
			party.kind === 'organisation' ? repository.listOrganisationContacts(actor.organisationId, party.id) : Promise.resolve([]);
		const affiliationsPromise =
			party.kind === 'person' ? repository.listPersonAffiliations(actor.organisationId, party.id) : Promise.resolve([]);
		const candidatesPromise =
			party.kind === 'organisation' && canManageContacts
				? repository.listParties(actor.organisationId, { kind: 'person', status: 'active' })
				: Promise.resolve([]);
		const [roleTypes, contacts, affiliations, candidateRows] = await Promise.all([
			roleTypesPromise,
			contactsPromise,
			affiliationsPromise,
			candidatesPromise
		]);
		const currentPersonIds = new Set(contacts.map((contact) => contact.personPartyId));
		return {
			party,
			canManage,
			canManageContacts,
			roleTypes,
			contacts,
			affiliations,
			contactCandidates: candidateRows.filter((candidate) => !currentPersonIds.has(candidate.id))
		};
	}

	private async createPartyRecords(
		actor: TenantActorContext,
		db: DatabaseExecutor,
		input: ValidatedPartyInput
	): Promise<CrmPartyDetail> {
		const repository = new CrmRepository(db);
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		const roleIds = await this.resolveRoleIds(repository, input.roleCodes);
		const publicId = this.publicIdFactory();
		const partyId = await repository.insertParty({
			organisationId: actor.organisationId,
			publicId,
			kind: input.kind,
			accountOwnerMemberId: membership.id
		});

		if (input.kind === 'person') {
			await repository.insertPersonSubtype({
				organisationId: actor.organisationId,
				partyId,
				honorific: input.honorific,
				givenNames: input.givenNames,
				familyName: input.familyName,
				preferredName: input.preferredName
			});
		} else {
			await repository.insertOrganisationSubtype({
				organisationId: actor.organisationId,
				partyId,
				legalName: input.legalName!,
				tradingName: input.tradingName
			});
		}

		await repository.setPrimaryEmail(actor.organisationId, partyId, input.primaryEmail);
		await repository.setPrimaryPhone(actor.organisationId, partyId, input.primaryPhone);
		await repository.setPartyRoles(actor.organisationId, partyId, roleIds);
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: membership.id,
			actionKey: 'crm.party.created',
			subjectType: 'crm_party',
			subjectPublicId: publicId,
			correlationId: actor.correlationId,
			changeSummary: { kind: input.kind, roleCodes: input.roleCodes }
		});
		const created = await repository.findPartyByPublicId(actor.organisationId, publicId);
		if (!created) throw new Error('Created CRM party could not be reloaded inside its transaction.');
		return created;
	}

	async createParty(actor: TenantActorContext, input: CrmPartyInput): Promise<CrmPartyDetail> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.party.manage');
		const validated = validatePartyInput(input);
		return this.db.transaction().execute(async (trx) => this.createPartyRecords(actor, trx, validated));
	}

	async updateParty(actor: TenantActorContext, input: UpdateCrmPartyInput): Promise<CrmPartyDetail> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.party.manage');
		const publicId = normalisePublicId(input.partyPublicId, 'CRM party ID');
		const status = validateStatus(input.status);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'crm.party.manage', trx);
			const repository = new CrmRepository(trx);
			const current = await repository.findPartyByPublicId(actor.organisationId, publicId);
			if (!current) throw new RecordNotFoundError('CRM party not found.');
			const validated = validatePartyInput({ ...input, kind: current.kind });
			const roleIds = await this.resolveRoleIds(repository, validated.roleCodes);

			if (current.kind === 'person') {
				await repository.updatePersonSubtype({
					organisationId: actor.organisationId,
					partyId: current.id,
					honorific: validated.honorific,
					givenNames: validated.givenNames,
					familyName: validated.familyName,
					preferredName: validated.preferredName
				});
			} else {
				await repository.updateOrganisationSubtype({
					organisationId: actor.organisationId,
					partyId: current.id,
					legalName: validated.legalName!,
					tradingName: validated.tradingName
				});
			}
			await repository.setPrimaryEmail(actor.organisationId, current.id, validated.primaryEmail);
			await repository.setPrimaryPhone(actor.organisationId, current.id, validated.primaryPhone);
			await repository.setPartyRoles(actor.organisationId, current.id, roleIds);
			await repository.updatePartyStatus(actor.organisationId, current.id, status);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.party.updated',
				subjectType: 'crm_party',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					status: { from: current.status, to: status },
					roleCodes: validated.roleCodes
				}
			});
			const updated = await repository.findPartyByPublicId(actor.organisationId, publicId);
			if (!updated) throw new Error('Updated CRM party could not be reloaded inside its transaction.');
			return updated;
		});
	}

	async createOrganisationContact(
		actor: TenantActorContext,
		organisationPartyPublicIdInput: string,
		input: CrmContactInput
	): Promise<CrmPartyDetail> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.contact.manage');
		const organisationPartyPublicId = normalisePublicId(organisationPartyPublicIdInput, 'Organisation party ID');
		const jobTitle = optionalText(input.jobTitle, 200, 'Job title');
		const department = optionalText(input.department, 200, 'Department');
		const validatedPerson = validatePartyInput({
			kind: 'person',
			honorific: input.honorific,
			givenNames: input.givenNames,
			familyName: input.familyName,
			preferredName: input.preferredName,
			primaryEmail: input.primaryEmail,
			primaryPhone: input.primaryPhone,
			roleCodes: []
		});
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'crm.contact.manage', trx);
			const repository = new CrmRepository(trx);
			const organisationParty = await repository.findPartyByPublicId(
				actor.organisationId,
				organisationPartyPublicId
			);
			if (!organisationParty || organisationParty.kind !== 'organisation') {
				throw new RecordNotFoundError('CRM organisation not found.');
			}
			if (organisationParty.status === 'archived') {
				throw new CrmValidationError('Contacts cannot be added to an archived CRM organisation.');
			}
			const person = await this.createPartyRecords(actor, trx, validatedPerson);
			await repository.insertOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId: organisationParty.id,
				personPartyId: person.id,
				jobTitle,
				department,
				isPrimaryContact: Boolean(input.isPrimaryContact),
				startedOn: this.now()
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: null,
				actionKey: 'crm.contact.created',
				subjectType: 'crm_party',
				subjectPublicId: person.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					organisationPartyPublicId,
					jobTitle,
					department,
					isPrimaryContact: Boolean(input.isPrimaryContact)
				}
			});
			return person;
		});
	}

	async linkExistingOrganisationContact(
		actor: TenantActorContext,
		input: {
			organisationPartyPublicId: string;
			personPartyPublicId: string;
			jobTitle?: string | null;
			department?: string | null;
			isPrimaryContact?: boolean;
		}
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.contact.manage');
		const organisationPublicId = normalisePublicId(input.organisationPartyPublicId, 'Organisation party ID');
		const personPublicId = normalisePublicId(input.personPartyPublicId, 'Person party ID');
		const jobTitle = optionalText(input.jobTitle, 200, 'Job title');
		const department = optionalText(input.department, 200, 'Department');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'crm.contact.manage', trx);
			const repository = new CrmRepository(trx);
			const [organisationParty, personParty] = await Promise.all([
				repository.findPartyByPublicId(actor.organisationId, organisationPublicId),
				repository.findPartyByPublicId(actor.organisationId, personPublicId)
			]);
			if (!organisationParty || organisationParty.kind !== 'organisation') {
				throw new RecordNotFoundError('CRM organisation not found.');
			}
			if (!personParty || personParty.kind !== 'person') {
				throw new RecordNotFoundError('CRM person not found.');
			}
			if (organisationParty.status === 'archived' || personParty.status === 'archived') {
				throw new CrmValidationError('Archived CRM parties cannot receive new contact relationships.');
			}
			if (await repository.findCurrentContact(actor.organisationId, organisationParty.id, personParty.id)) {
				throw new CrmValidationError('That person is already a current contact for this organisation.');
			}
			await repository.insertOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId: organisationParty.id,
				personPartyId: personParty.id,
				jobTitle,
				department,
				isPrimaryContact: Boolean(input.isPrimaryContact),
				startedOn: this.now()
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.contact.linked',
				subjectType: 'crm_party',
				subjectPublicId: personPublicId,
				correlationId: actor.correlationId,
				changeSummary: { organisationPartyPublicId: organisationPublicId, jobTitle, department }
			});
		});
	}

	async endOrganisationContact(
		actor: TenantActorContext,
		organisationPartyPublicIdInput: string,
		personPartyPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.contact.manage');
		const organisationPublicId = normalisePublicId(organisationPartyPublicIdInput, 'Organisation party ID');
		const personPublicId = normalisePublicId(personPartyPublicIdInput, 'Person party ID');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'crm.contact.manage', trx);
			const repository = new CrmRepository(trx);
			const [organisationParty, personParty] = await Promise.all([
				repository.findPartyByPublicId(actor.organisationId, organisationPublicId),
				repository.findPartyByPublicId(actor.organisationId, personPublicId)
			]);
			if (!organisationParty || organisationParty.kind !== 'organisation') {
				throw new RecordNotFoundError('CRM organisation not found.');
			}
			if (!personParty || personParty.kind !== 'person') {
				throw new RecordNotFoundError('CRM person not found.');
			}
			const changed = await repository.endOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId: organisationParty.id,
				personPartyId: personParty.id,
				endedOn: this.now()
			});
			if (!changed) throw new CrmValidationError('That current contact relationship no longer exists.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.contact.ended',
				subjectType: 'crm_party',
				subjectPublicId: personPublicId,
				correlationId: actor.correlationId,
				changeSummary: { organisationPartyPublicId: organisationPublicId }
			});
		});
	}

	async makePrimaryOrganisationContact(
		actor: TenantActorContext,
		organisationPartyPublicIdInput: string,
		personPartyPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertManage(actor, 'crm.contact.manage');
		const organisationPublicId = normalisePublicId(organisationPartyPublicIdInput, 'Organisation party ID');
		const personPublicId = normalisePublicId(personPartyPublicIdInput, 'Person party ID');
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertManage(actor, 'crm.contact.manage', trx);
			const repository = new CrmRepository(trx);
			const [organisationParty, personParty] = await Promise.all([
				repository.findPartyByPublicId(actor.organisationId, organisationPublicId),
				repository.findPartyByPublicId(actor.organisationId, personPublicId)
			]);
			if (!organisationParty || organisationParty.kind !== 'organisation') {
				throw new RecordNotFoundError('CRM organisation not found.');
			}
			if (!personParty || personParty.kind !== 'person') {
				throw new RecordNotFoundError('CRM person not found.');
			}
			const changed = await repository.makePrimaryOrganisationContact({
				organisationId: actor.organisationId,
				organisationPartyId: organisationParty.id,
				personPartyId: personParty.id
			});
			if (!changed) throw new CrmValidationError('That current contact relationship no longer exists.');
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.contact.primary_changed',
				subjectType: 'crm_party',
				subjectPublicId: personPublicId,
				correlationId: actor.correlationId,
				changeSummary: { organisationPartyPublicId: organisationPublicId }
			});
		});
	}
}
