import type { DatabaseExecutor } from '$lib/server/db/executor';

export type CrmPartyKind = 'person' | 'organisation';
export type CrmPartyStatus = 'active' | 'inactive' | 'archived';

export type CrmRoleType = {
	id: number;
	code: string;
	name: string;
};

export type CrmPartySummary = {
	id: string;
	publicId: string;
	kind: CrmPartyKind;
	displayName: string;
	status: CrmPartyStatus;
	primaryEmail: string | null;
	primaryPhone: string | null;
	roles: CrmRoleType[];
	updatedAt: Date;
};

export type CrmPartyDetail = CrmPartySummary & {
	accountOwnerMemberId: string | null;
	honorific: string | null;
	givenNames: string | null;
	familyName: string | null;
	preferredName: string | null;
	legalName: string | null;
	tradingName: string | null;
	createdAt: Date;
};

export type CrmOrganisationContact = {
	personPartyId: string;
	personPublicId: string;
	displayName: string;
	status: CrmPartyStatus;
	primaryEmail: string | null;
	primaryPhone: string | null;
	jobTitle: string | null;
	department: string | null;
	isPrimaryContact: boolean;
	startedOn: Date | null;
};

export type CrmPersonAffiliation = {
	organisationPartyId: string;
	organisationPublicId: string;
	organisationName: string;
	organisationStatus: CrmPartyStatus;
	jobTitle: string | null;
	department: string | null;
	isPrimaryContact: boolean;
	startedOn: Date | null;
};

function partyKind(value: string): CrmPartyKind {
	if (value === 'person' || value === 'organisation') return value;
	throw new Error(`Unexpected CRM party kind: ${value}`);
}

function partyStatus(value: string): CrmPartyStatus {
	if (value === 'active' || value === 'inactive' || value === 'archived') return value;
	throw new Error(`Unexpected CRM party status: ${value}`);
}

function personDisplayName(input: {
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
}): string {
	const preferred = input.preferredName?.trim();
	const family = input.familyName?.trim();
	if (preferred && family) return `${preferred} ${family}`;
	if (preferred) return preferred;
	const composed = [input.givenNames?.trim(), family].filter(Boolean).join(' ');
	return composed || 'Unnamed person';
}

function organisationDisplayName(input: {
	legalName: string | null;
	tradingName: string | null;
}): string {
	return input.tradingName?.trim() || input.legalName?.trim() || 'Unnamed organisation';
}

function displayName(row: {
	kind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	return row.kind === 'person'
		? personDisplayName(row)
		: organisationDisplayName(row);
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

export class CrmRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listRoleTypes(): Promise<CrmRoleType[]> {
		const rows = await this.db
			.selectFrom('party_role_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
		return rows.map((row) => ({ id: row.id, code: row.code, name: row.name }));
	}

	async findActiveRoleTypeIdsByCodes(codes: readonly string[]): Promise<number[]> {
		if (codes.length === 0) return [];
		const rows = await this.db
			.selectFrom('party_role_types')
			.select('id')
			.where('code', 'in', [...codes])
			.where('is_active', '=', 1)
			.execute();
		return rows.map((row) => row.id);
	}

	private async rolesByPartyIds(
		organisationId: string,
		partyIds: readonly string[]
	): Promise<Map<string, CrmRoleType[]>> {
		const result = new Map<string, CrmRoleType[]>();
		if (partyIds.length === 0) return result;
		const rows = await this.db
			.selectFrom('party_role_assignments as assignment')
			.innerJoin('party_role_types as role', 'role.id', 'assignment.party_role_type_id')
			.select([
				'assignment.party_id as partyId',
				'role.id as roleId',
				'role.code as roleCode',
				'role.name as roleName'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.party_id', 'in', [...partyIds])
			.where('assignment.is_active', '=', 1)
			.where('role.is_active', '=', 1)
			.orderBy('role.name', 'asc')
			.execute();
		for (const row of rows) {
			const roles = result.get(row.partyId) ?? [];
			roles.push({ id: row.roleId, code: row.roleCode, name: row.roleName });
			result.set(row.partyId, roles);
		}
		return result;
	}

	async listParties(
		organisationId: string,
		filters: { search?: string; kind?: CrmPartyKind; status?: CrmPartyStatus } = {}
	): Promise<CrmPartySummary[]> {
		let query = this.db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'party.id')
					.onRef('email.organisation_id', '=', 'party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.leftJoin('party_phone_numbers as phone', (join) =>
				join
					.onRef('phone.party_id', '=', 'party.id')
					.onRef('phone.organisation_id', '=', 'party.organisation_id')
					.on('phone.is_primary', '=', 1)
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'party.party_kind as kind',
				'party.status as status',
				'party.updated_at as updatedAt',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'email.email as primaryEmail',
				'phone.phone_e164 as primaryPhone'
			])
			.where('party.organisation_id', '=', organisationId);

		if (filters.kind) query = query.where('party.party_kind', '=', filters.kind);
		if (filters.status) query = query.where('party.status', '=', filters.status);
		const search = filters.search?.trim();
		if (search) {
			const like = `%${search}%`;
			query = query.where((eb) =>
				eb.or([
					eb('person.preferred_name', 'like', like),
					eb('person.given_names', 'like', like),
					eb('person.family_name', 'like', like),
					eb('company.legal_name', 'like', like),
					eb('company.trading_name', 'like', like),
					eb('email.email', 'like', like),
					eb('phone.phone_e164', 'like', like)
				])
			);
		}

		const rows = await query.orderBy('party.updated_at', 'desc').limit(250).execute();
		const roles = await this.rolesByPartyIds(
			organisationId,
			rows.map((row) => row.id)
		);
		return rows.map((row) => ({
			id: row.id,
			publicId: row.publicId,
			kind: partyKind(row.kind),
			displayName: displayName(row),
			status: partyStatus(row.status),
			primaryEmail: row.primaryEmail,
			primaryPhone: row.primaryPhone,
			roles: roles.get(row.id) ?? [],
			updatedAt: row.updatedAt
		}));
	}

	async findPartyByPublicId(
		organisationId: string,
		publicId: string
	): Promise<CrmPartyDetail | null> {
		const row = await this.db
			.selectFrom('parties as party')
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'party.id')
					.onRef('email.organisation_id', '=', 'party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.leftJoin('party_phone_numbers as phone', (join) =>
				join
					.onRef('phone.party_id', '=', 'party.id')
					.onRef('phone.organisation_id', '=', 'party.organisation_id')
					.on('phone.is_primary', '=', 1)
			)
			.select([
				'party.id as id',
				'party.public_id as publicId',
				'party.party_kind as kind',
				'party.status as status',
				'party.account_owner_member_id as accountOwnerMemberId',
				'party.created_at as createdAt',
				'party.updated_at as updatedAt',
				'person.honorific as honorific',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'email.email as primaryEmail',
				'phone.phone_e164 as primaryPhone'
			])
			.where('party.organisation_id', '=', organisationId)
			.where('party.public_id', '=', publicId)
			.executeTakeFirst();
		if (!row) return null;
		const roles = await this.rolesByPartyIds(organisationId, [row.id]);
		return {
			id: row.id,
			publicId: row.publicId,
			kind: partyKind(row.kind),
			displayName: displayName(row),
			status: partyStatus(row.status),
			primaryEmail: row.primaryEmail,
			primaryPhone: row.primaryPhone,
			roles: roles.get(row.id) ?? [],
			updatedAt: row.updatedAt,
			accountOwnerMemberId: row.accountOwnerMemberId,
			honorific: row.honorific,
			givenNames: row.givenNames,
			familyName: row.familyName,
			preferredName: row.preferredName,
			legalName: row.legalName,
			tradingName: row.tradingName,
			createdAt: row.createdAt
		};
	}

	async insertParty(input: {
		organisationId: string;
		publicId: string;
		kind: CrmPartyKind;
		accountOwnerMemberId: string;
	}): Promise<string> {
		return insertedId(
			await this.db
				.insertInto('parties')
				.values({
					organisation_id: input.organisationId,
					public_id: input.publicId,
					party_kind: input.kind,
					account_owner_member_id: input.accountOwnerMemberId,
					status: 'active'
				})
				.executeTakeFirstOrThrow()
		);
	}

	async insertPersonSubtype(input: {
		organisationId: string;
		partyId: string;
		honorific: string | null;
		givenNames: string | null;
		familyName: string | null;
		preferredName: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('party_persons')
			.values({
				party_id: input.partyId,
				organisation_id: input.organisationId,
				honorific: input.honorific,
				given_names: input.givenNames,
				family_name: input.familyName,
				preferred_name: input.preferredName
			})
			.executeTakeFirstOrThrow();
	}

	async insertOrganisationSubtype(input: {
		organisationId: string;
		partyId: string;
		legalName: string;
		tradingName: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('party_organisations')
			.values({
				party_id: input.partyId,
				organisation_id: input.organisationId,
				legal_name: input.legalName,
				trading_name: input.tradingName
			})
			.executeTakeFirstOrThrow();
	}

	async updatePersonSubtype(input: {
		organisationId: string;
		partyId: string;
		honorific: string | null;
		givenNames: string | null;
		familyName: string | null;
		preferredName: string | null;
	}): Promise<void> {
		await this.db
			.updateTable('party_persons')
			.set({
				honorific: input.honorific,
				given_names: input.givenNames,
				family_name: input.familyName,
				preferred_name: input.preferredName
			})
			.where('organisation_id', '=', input.organisationId)
			.where('party_id', '=', input.partyId)
			.executeTakeFirstOrThrow();
	}

	async updateOrganisationSubtype(input: {
		organisationId: string;
		partyId: string;
		legalName: string;
		tradingName: string | null;
	}): Promise<void> {
		await this.db
			.updateTable('party_organisations')
			.set({ legal_name: input.legalName, trading_name: input.tradingName })
			.where('organisation_id', '=', input.organisationId)
			.where('party_id', '=', input.partyId)
			.executeTakeFirstOrThrow();
	}

	async updatePartyStatus(
		organisationId: string,
		partyId: string,
		status: CrmPartyStatus
	): Promise<void> {
		await this.db
			.updateTable('parties')
			.set({ status })
			.where('organisation_id', '=', organisationId)
			.where('id', '=', partyId)
			.executeTakeFirstOrThrow();
	}

	async setPartyRoles(
		organisationId: string,
		partyId: string,
		roleIds: readonly number[]
	): Promise<void> {
		await this.db
			.updateTable('party_role_assignments')
			.set({ is_active: 0 })
			.where('organisation_id', '=', organisationId)
			.where('party_id', '=', partyId)
			.execute();
		for (const roleId of roleIds) {
			const existing = await this.db
				.selectFrom('party_role_assignments')
				.select('party_role_type_id')
				.where('organisation_id', '=', organisationId)
				.where('party_id', '=', partyId)
				.where('party_role_type_id', '=', roleId)
				.executeTakeFirst();
			if (existing) {
				await this.db
					.updateTable('party_role_assignments')
					.set({ is_active: 1 })
					.where('organisation_id', '=', organisationId)
					.where('party_id', '=', partyId)
					.where('party_role_type_id', '=', roleId)
					.executeTakeFirstOrThrow();
			} else {
				await this.db
					.insertInto('party_role_assignments')
					.values({
						organisation_id: organisationId,
						party_id: partyId,
						party_role_type_id: roleId,
						is_active: 1
					})
					.executeTakeFirstOrThrow();
			}
		}
	}

	async setPrimaryEmail(
		organisationId: string,
		partyId: string,
		email: string | null
	): Promise<void> {
		const existing = await this.db
			.selectFrom('party_email_addresses')
			.select(['id', 'email'])
			.where('organisation_id', '=', organisationId)
			.where('party_id', '=', partyId)
			.where('is_primary', '=', 1)
			.executeTakeFirst();
		if (!email) {
			if (existing) {
				await this.db
					.deleteFrom('party_email_addresses')
					.where('organisation_id', '=', organisationId)
					.where('id', '=', existing.id)
					.execute();
			}
			return;
		}
		if (existing) {
			await this.db
				.updateTable('party_email_addresses')
				.set({
					email,
					label: 'work',
					is_primary: 1,
					is_verified: existing.email === email ? undefined : 0,
					verified_at: existing.email === email ? undefined : null
				})
				.where('organisation_id', '=', organisationId)
				.where('id', '=', existing.id)
				.executeTakeFirstOrThrow();
			return;
		}
		await this.db
			.insertInto('party_email_addresses')
			.values({
				organisation_id: organisationId,
				party_id: partyId,
				email,
				label: 'work',
				is_primary: 1,
				is_verified: 0,
				verified_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async setPrimaryPhone(
		organisationId: string,
		partyId: string,
		phone: string | null
	): Promise<void> {
		const existing = await this.db
			.selectFrom('party_phone_numbers')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('party_id', '=', partyId)
			.where('is_primary', '=', 1)
			.executeTakeFirst();
		if (!phone) {
			if (existing) {
				await this.db
					.deleteFrom('party_phone_numbers')
					.where('organisation_id', '=', organisationId)
					.where('id', '=', existing.id)
					.execute();
			}
			return;
		}
		if (existing) {
			await this.db
				.updateTable('party_phone_numbers')
				.set({ phone_e164: phone, extension: null, label: 'work', is_primary: 1 })
				.where('organisation_id', '=', organisationId)
				.where('id', '=', existing.id)
				.executeTakeFirstOrThrow();
			return;
		}
		await this.db
			.insertInto('party_phone_numbers')
			.values({
				organisation_id: organisationId,
				party_id: partyId,
				phone_e164: phone,
				extension: null,
				label: 'work',
				is_primary: 1
			})
			.executeTakeFirstOrThrow();
	}

	async listOrganisationContacts(
		organisationId: string,
		organisationPartyId: string
	): Promise<CrmOrganisationContact[]> {
		const rows = await this.db
			.selectFrom('party_organisation_contacts as contact')
			.innerJoin('parties as person_party', (join) =>
				join
					.onRef('person_party.id', '=', 'contact.person_party_id')
					.onRef('person_party.organisation_id', '=', 'contact.organisation_id')
			)
			.innerJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'person_party.id')
					.onRef('person.organisation_id', '=', 'person_party.organisation_id')
			)
			.leftJoin('party_email_addresses as email', (join) =>
				join
					.onRef('email.party_id', '=', 'person_party.id')
					.onRef('email.organisation_id', '=', 'person_party.organisation_id')
					.on('email.is_primary', '=', 1)
			)
			.leftJoin('party_phone_numbers as phone', (join) =>
				join
					.onRef('phone.party_id', '=', 'person_party.id')
					.onRef('phone.organisation_id', '=', 'person_party.organisation_id')
					.on('phone.is_primary', '=', 1)
			)
			.select([
				'person_party.id as personPartyId',
				'person_party.public_id as personPublicId',
				'person_party.status as personStatus',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'email.email as primaryEmail',
				'phone.phone_e164 as primaryPhone',
				'contact.job_title as jobTitle',
				'contact.department as department',
				'contact.is_primary_contact as isPrimaryContact',
				'contact.started_on as startedOn'
			])
			.where('contact.organisation_id', '=', organisationId)
			.where('contact.organisation_party_id', '=', organisationPartyId)
			.where('contact.ended_on', 'is', null)
			.orderBy('contact.is_primary_contact', 'desc')
			.orderBy('person.family_name', 'asc')
			.execute();
		return rows.map((row) => ({
			personPartyId: row.personPartyId,
			personPublicId: row.personPublicId,
			displayName: personDisplayName(row),
			status: partyStatus(row.personStatus),
			primaryEmail: row.primaryEmail,
			primaryPhone: row.primaryPhone,
			jobTitle: row.jobTitle,
			department: row.department,
			isPrimaryContact: Boolean(row.isPrimaryContact),
			startedOn: row.startedOn
		}));
	}

	async listPersonAffiliations(
		organisationId: string,
		personPartyId: string
	): Promise<CrmPersonAffiliation[]> {
		const rows = await this.db
			.selectFrom('party_organisation_contacts as contact')
			.innerJoin('parties as company_party', (join) =>
				join
					.onRef('company_party.id', '=', 'contact.organisation_party_id')
					.onRef('company_party.organisation_id', '=', 'contact.organisation_id')
			)
			.innerJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'company_party.id')
					.onRef('company.organisation_id', '=', 'company_party.organisation_id')
			)
			.select([
				'company_party.id as organisationPartyId',
				'company_party.public_id as organisationPublicId',
				'company_party.status as organisationStatus',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'contact.job_title as jobTitle',
				'contact.department as department',
				'contact.is_primary_contact as isPrimaryContact',
				'contact.started_on as startedOn'
			])
			.where('contact.organisation_id', '=', organisationId)
			.where('contact.person_party_id', '=', personPartyId)
			.where('contact.ended_on', 'is', null)
			.orderBy('company.legal_name', 'asc')
			.execute();
		return rows.map((row) => ({
			organisationPartyId: row.organisationPartyId,
			organisationPublicId: row.organisationPublicId,
			organisationName: organisationDisplayName(row),
			organisationStatus: partyStatus(row.organisationStatus),
			jobTitle: row.jobTitle,
			department: row.department,
			isPrimaryContact: Boolean(row.isPrimaryContact),
			startedOn: row.startedOn
		}));
	}

	async findCurrentContact(
		organisationId: string,
		organisationPartyId: string,
		personPartyId: string
	): Promise<{ id: string; isPrimaryContact: boolean } | null> {
		const row = await this.db
			.selectFrom('party_organisation_contacts')
			.select(['id', 'is_primary_contact'])
			.where('organisation_id', '=', organisationId)
			.where('organisation_party_id', '=', organisationPartyId)
			.where('person_party_id', '=', personPartyId)
			.where('ended_on', 'is', null)
			.orderBy('id', 'desc')
			.executeTakeFirst();
		return row ? { id: row.id, isPrimaryContact: Boolean(row.is_primary_contact) } : null;
	}

	async insertOrganisationContact(input: {
		organisationId: string;
		organisationPartyId: string;
		personPartyId: string;
		jobTitle: string | null;
		department: string | null;
		isPrimaryContact: boolean;
		startedOn: Date | null;
	}): Promise<void> {
		if (input.isPrimaryContact) {
			await this.db
				.updateTable('party_organisation_contacts')
				.set({ is_primary_contact: 0 })
				.where('organisation_id', '=', input.organisationId)
				.where('organisation_party_id', '=', input.organisationPartyId)
				.where('ended_on', 'is', null)
				.execute();
		}
		await this.db
			.insertInto('party_organisation_contacts')
			.values({
				organisation_id: input.organisationId,
				organisation_party_id: input.organisationPartyId,
				person_party_id: input.personPartyId,
				job_title: input.jobTitle,
				department: input.department,
				is_primary_contact: input.isPrimaryContact ? 1 : 0,
				started_on: input.startedOn,
				ended_on: null
			})
			.executeTakeFirstOrThrow();
	}

	async endOrganisationContact(input: {
		organisationId: string;
		organisationPartyId: string;
		personPartyId: string;
		endedOn: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('party_organisation_contacts')
			.set({ ended_on: input.endedOn, is_primary_contact: 0 })
			.where('organisation_id', '=', input.organisationId)
			.where('organisation_party_id', '=', input.organisationPartyId)
			.where('person_party_id', '=', input.personPartyId)
			.where('ended_on', 'is', null)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async makePrimaryOrganisationContact(input: {
		organisationId: string;
		organisationPartyId: string;
		personPartyId: string;
	}): Promise<boolean> {
		const contact = await this.findCurrentContact(
			input.organisationId,
			input.organisationPartyId,
			input.personPartyId
		);
		if (!contact) return false;
		await this.db
			.updateTable('party_organisation_contacts')
			.set({ is_primary_contact: 0 })
			.where('organisation_id', '=', input.organisationId)
			.where('organisation_party_id', '=', input.organisationPartyId)
			.where('ended_on', 'is', null)
			.execute();
		await this.db
			.updateTable('party_organisation_contacts')
			.set({ is_primary_contact: 1 })
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', contact.id)
			.executeTakeFirstOrThrow();
		return true;
	}
}
