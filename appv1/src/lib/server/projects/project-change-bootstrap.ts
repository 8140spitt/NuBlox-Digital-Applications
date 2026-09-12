import type { Database } from '$lib/server/db/database';

export const PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'project.change.view',
		'project.change.manage',
		'project.change.assess',
		'project.change.approve',
		'project.change.implement',
		'project.change.close'
	],
	Administrator: [
		'project.change.view',
		'project.change.manage',
		'project.change.assess',
		'project.change.approve',
		'project.change.implement',
		'project.change.close'
	],
	Manager: [
		'project.change.view',
		'project.change.manage',
		'project.change.assess',
		'project.change.approve',
		'project.change.implement',
		'project.change.close'
	],
	'Finance/Commercial': ['project.change.view', 'project.change.assess'],
	'Member/Professional': [
		'project.change.view',
		'project.change.manage',
		'project.change.assess',
		'project.change.implement'
	],
	'Field Worker': ['project.change.view', 'project.change.manage'],
	'Read Only': ['project.change.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureProjectChangeStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required project change permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];

		for (const role of roles) {
			const permissionKeys =
				PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS
				];
			if (!permissionKeys) continue;
			for (const permissionKey of permissionKeys) {
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
