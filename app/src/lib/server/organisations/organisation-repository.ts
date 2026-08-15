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

		if (!row) return null;

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
}
