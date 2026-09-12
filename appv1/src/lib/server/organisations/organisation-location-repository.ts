import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OrganisationAddressSummary = {
	id: string;
	line1: string;
	line2: string | null;
	line3: string | null;
	locality: string | null;
	city: string | null;
	region: string | null;
	postalCode: string | null;
	countryCode: string;
};

export type OrganisationLocationSummary = {
	id: string;
	publicId: string;
	name: string;
	locationType: string;
	timezone: string | null;
	isActive: boolean;
	address: OrganisationAddressSummary | null;
};

export type OrganisationAddressInput = {
	line1: string;
	line2: string | null;
	line3: string | null;
	locality: string | null;
	city: string | null;
	region: string | null;
	postalCode: string | null;
	countryCode: string;
};

export type LockedOrganisationLocation = {
	id: string;
	publicId: string;
	addressId: string | null;
	name: string;
	locationType: string;
	timezone: string | null;
	isActive: boolean;
};

export class OrganisationLocationRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listLocations(organisationId: string): Promise<OrganisationLocationSummary[]> {
		const rows = await this.db
			.selectFrom('organisation_locations as location')
			.leftJoin('addresses as address', (join) =>
				join
					.onRef('address.id', '=', 'location.address_id')
					.onRef('address.organisation_id', '=', 'location.organisation_id')
			)
			.select([
				'location.id as id',
				'location.public_id as publicId',
				'location.name as name',
				'location.location_type as locationType',
				'location.timezone as timezone',
				'location.is_active as isActive',
				'address.id as addressId',
				'address.line_1 as line1',
				'address.line_2 as line2',
				'address.line_3 as line3',
				'address.locality as locality',
				'address.city as city',
				'address.region as region',
				'address.postal_code as postalCode',
				'address.country_code as countryCode'
			])
			.where('location.organisation_id', '=', organisationId)
			.orderBy('location.is_active', 'desc')
			.orderBy('location.name', 'asc')
			.execute();

		return rows.map((row) => ({
			id: row.id,
			publicId: row.publicId,
			name: row.name,
			locationType: row.locationType,
			timezone: row.timezone,
			isActive: Boolean(row.isActive),
			address:
				row.addressId && row.line1 && row.countryCode
					? {
							id: row.addressId,
							line1: row.line1,
							line2: row.line2,
							line3: row.line3,
							locality: row.locality,
							city: row.city,
							region: row.region,
							postalCode: row.postalCode,
							countryCode: row.countryCode
						}
					: null
		}));
	}

	async findLocationForUpdate(
		organisationId: string,
		publicId: string
	): Promise<LockedOrganisationLocation | null> {
		const row = await this.db
			.selectFrom('organisation_locations')
			.select(['id', 'public_id', 'address_id', 'name', 'location_type', 'timezone', 'is_active'])
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.forUpdate()
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			publicId: row.public_id,
			addressId: row.address_id,
			name: row.name,
			locationType: row.location_type,
			timezone: row.timezone,
			isActive: Boolean(row.is_active)
		};
	}

	async findAddress(
		addressId: string,
		organisationId: string
	): Promise<OrganisationAddressSummary | null> {
		const row = await this.db
			.selectFrom('addresses')
			.select([
				'id',
				'line_1',
				'line_2',
				'line_3',
				'locality',
				'city',
				'region',
				'postal_code',
				'country_code'
			])
			.where('id', '=', addressId)
			.where('organisation_id', '=', organisationId)
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			line1: row.line_1,
			line2: row.line_2,
			line3: row.line_3,
			locality: row.locality,
			city: row.city,
			region: row.region,
			postalCode: row.postal_code,
			countryCode: row.country_code
		};
	}

	async findNameConflict(
		organisationId: string,
		name: string,
		excludePublicId?: string
	): Promise<boolean> {
		let query = this.db
			.selectFrom('organisation_locations')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('name', '=', name);
		if (excludePublicId) query = query.where('public_id', '!=', excludePublicId);
		return Boolean(await query.executeTakeFirst());
	}

	async createAddress(organisationId: string, input: OrganisationAddressInput): Promise<string> {
		const result = await this.db
			.insertInto('addresses')
			.values({
				organisation_id: organisationId,
				line_1: input.line1,
				line_2: input.line2,
				line_3: input.line3,
				locality: input.locality,
				city: input.city,
				region: input.region,
				postal_code: input.postalCode,
				country_code: input.countryCode
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('Address insert did not return an ID.');
		return result.insertId.toString();
	}

	async createLocation(input: {
		organisationId: string;
		publicId: string;
		addressId: string | null;
		name: string;
		locationType: string;
		timezone: string | null;
	}): Promise<void> {
		await this.db
			.insertInto('organisation_locations')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				address_id: input.addressId,
				name: input.name,
				location_type: input.locationType,
				timezone: input.timezone,
				is_active: 1
			})
			.executeTakeFirstOrThrow();
	}

	async updateLocation(input: {
		organisationId: string;
		locationId: string;
		addressId: string | null;
		name: string;
		locationType: string;
		timezone: string | null;
		isActive: boolean;
	}): Promise<void> {
		await this.db
			.updateTable('organisation_locations')
			.set({
				address_id: input.addressId,
				name: input.name,
				location_type: input.locationType,
				timezone: input.timezone,
				is_active: input.isActive ? 1 : 0
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.locationId)
			.executeTakeFirstOrThrow();
	}
}
