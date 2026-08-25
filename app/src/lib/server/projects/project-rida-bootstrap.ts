import type { Database } from '$lib/server/db/database';

export const PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS = {
	Owner: ['project.rida.view', 'project.rida.manage', 'project.rida.decide', 'project.rida.close'],
	Administrator: [
		'project.rida.view',
		'project.rida.manage',
		'project.rida.decide',
		'project.rida.close'
	],
	Manager: ['project.rida.view', 'project.rida.manage', 'project.rida.decide', 'project.rida.close'],
	'Finance/Commercial': ['project.rida.view'],
	'Member/Professional': ['project.rida.view', 'project.rida.manage'],
	'Field Worker': ['project.rida.view', 'project.rida.manage'],
	'Read Only': ['project.rida.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS).flat())
);

/**
 * Align standard-role grants for organisations created after the RIDA migration.
 * Existing organisations are seeded by the migration itself.
 */
export async function ensureProjectRidaStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS))
				.where('is_active', '=', 1)
				.execute(),
			trx
				.selectFrom('permissions')
				.select(['id', 'permission_key'])
				.where('permission_key', 'in', REQUIRED_PERMISSION_KEYS)
				.where('is_active', '=', 1)
				.execute()
		]);

		const permissionIdByKey = new Map(permissions.map((row) => [row.permission_key, row.id]));
		for (const permissionKey of REQUIRED_PERMISSION_KEYS) {
			if (!permissionIdByKey.has(permissionKey)) {
				throw new Error(`Required project RIDA permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS
				];
			if (!keys) continue;
			for (const permissionKey of keys) {
				desiredGrants.push({
					organisation_id: organisationId,
					organisation_role_id: role.id,
					permission_id: permissionIdByKey.get(permissionKey)!
				});
			}
		}

		if (desiredGrants.length > 0) {
			await trx.insertInto('role_permissions').ignore().values(desiredGrants).execute();
		}
	});
}
