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

	async listPermissionKeysForActiveRoles(
		organisationId: string,
		rolePublicIds: readonly string[]
	): Promise<string[]> {
		if (rolePublicIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('organisation_roles as role')
			.innerJoin('role_permissions as grant', (join) =>
				join
					.onRef('grant.organisation_role_id', '=', 'role.id')
					.onRef('grant.organisation_id', '=', 'role.organisation_id')
			)
			.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
			.select('permission.permission_key as permissionKey')
			.where('role.organisation_id', '=', organisationId)
			.where('role.public_id', 'in', [...rolePublicIds])
			.where('role.is_active', '=', 1)
			.where('permission.is_active', '=', 1)
			.execute();

		return [...new Set(rows.map((row) => row.permissionKey))].sort();
	}
}
