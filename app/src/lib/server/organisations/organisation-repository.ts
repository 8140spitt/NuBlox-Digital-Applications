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
}
