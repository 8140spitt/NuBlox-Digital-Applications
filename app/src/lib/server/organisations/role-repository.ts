import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OrganisationRoleChoice = {
	publicId: string;
	name: string;
	description: string | null;
};

export class OrganisationRoleRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listActiveForOrganisation(organisationId: string): Promise<OrganisationRoleChoice[]> {
		const rows = await this.db
			.selectFrom('organisation_roles')
			.select(['public_id', 'name', 'description'])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();

		return rows.map((row) => ({
			publicId: row.public_id,
			name: row.name,
			description: row.description
		}));
	}
}
