import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OrganisationSummary = {
	id: string;
	publicId: string;
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
	status: string;
};

export type OrganisationProfileUpdate = {
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
};

export type OrganisationIdentifierSummary = {
	identifierType: string;
	identifierValue: string;
	issuingCountryCode: string | null;
	createdAt: Date;
};

export type OrganisationIdentifierCreate = {
	identifierType: string;
	identifierValue: string;
	issuingCountryCode: string | null;
};

type OrganisationIdentifierRow = OrganisationIdentifierSummary & {
	id: string;
};

function toSummary(row: {
	id: string;
	public_id: string;
	legal_name: string;
	trading_name: string | null;
	default_timezone: string;
	default_currency_code: string;
	status: string;
}): OrganisationSummary {
	return {
		id: row.id,
		publicId: row.public_id,
		legalName: row.legal_name,
		tradingName: row.trading_name,
		defaultTimezone: row.default_timezone,
		defaultCurrencyCode: row.default_currency_code,
		status: row.status
	};
}

function toIdentifierSummary(row: {
	identifier_type: string;
	identifier_value: string;
	issuing_country_code: string | null;
	created_at: Date;
}): OrganisationIdentifierSummary {
	return {
		identifierType: row.identifier_type,
		identifierValue: row.identifier_value,
		issuingCountryCode: row.issuing_country_code,
		createdAt: row.created_at
	};
}

export class OrganisationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async findActiveById(organisationId: string): Promise<OrganisationSummary | null> {
		const row = await this.db
			.selectFrom('organisations')
			.select([
				'id',
				'public_id',
				'legal_name',
				'trading_name',
				'default_timezone',
				'default_currency_code',
				'status'
			])
			.where('id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();

		return row ? toSummary(row) : null;
	}

	async findActiveForUpdate(organisationId: string): Promise<OrganisationSummary | null> {
		const row = await this.db
			.selectFrom('organisations')
			.select([
				'id',
				'public_id',
				'legal_name',
				'trading_name',
				'default_timezone',
				'default_currency_code',
				'status'
			])
			.where('id', '=', organisationId)
			.where('status', '=', 'active')
			.forUpdate()
			.executeTakeFirst();

		return row ? toSummary(row) : null;
	}

	async updateProfile(organisationId: string, input: OrganisationProfileUpdate): Promise<void> {
		await this.db
			.updateTable('organisations')
			.set({
				legal_name: input.legalName,
				trading_name: input.tradingName,
				default_timezone: input.defaultTimezone,
				default_currency_code: input.defaultCurrencyCode
			})
			.where('id', '=', organisationId)
			.where('status', '=', 'active')
			.executeTakeFirstOrThrow();
	}

	async listIdentifiers(organisationId: string): Promise<OrganisationIdentifierSummary[]> {
		const rows = await this.db
			.selectFrom('organisation_identifiers')
			.select(['identifier_type', 'identifier_value', 'issuing_country_code', 'created_at'])
			.where('organisation_id', '=', organisationId)
			.orderBy('identifier_type', 'asc')
			.orderBy('identifier_value', 'asc')
			.execute();

		return rows.map(toIdentifierSummary);
	}

	async findIdentifierForUpdate(
		organisationId: string,
		identifierType: string,
		identifierValue: string
	): Promise<OrganisationIdentifierRow | null> {
		const row = await this.db
			.selectFrom('organisation_identifiers')
			.select(['id', 'identifier_type', 'identifier_value', 'issuing_country_code', 'created_at'])
			.where('organisation_id', '=', organisationId)
			.where('identifier_type', '=', identifierType)
			.where('identifier_value', '=', identifierValue)
			.forUpdate()
			.executeTakeFirst();

		return row ? { id: row.id, ...toIdentifierSummary(row) } : null;
	}

	async createIdentifier(
		organisationId: string,
		input: OrganisationIdentifierCreate
	): Promise<void> {
		await this.db
			.insertInto('organisation_identifiers')
			.values({
				organisation_id: organisationId,
				identifier_type: input.identifierType,
				identifier_value: input.identifierValue,
				issuing_country_code: input.issuingCountryCode
			})
			.executeTakeFirstOrThrow();
	}

	async deleteIdentifier(organisationId: string, identifierId: string): Promise<void> {
		await this.db
			.deleteFrom('organisation_identifiers')
			.where('organisation_id', '=', organisationId)
			.where('id', '=', identifierId)
			.executeTakeFirstOrThrow();
	}
}
