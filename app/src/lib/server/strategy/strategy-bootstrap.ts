import type { Database } from '$lib/server/db/database';

export const STRATEGY_STANDARD_ROLE_PERMISSIONS = {
	Owner: ['strategy.view', 'strategy.manage', 'strategy.approve'],
	Administrator: ['strategy.view', 'strategy.manage', 'strategy.approve'],
	Manager: ['strategy.view', 'strategy.manage', 'strategy.approve'],
	'Finance/Commercial': ['strategy.view'],
	'Member/Professional': ['strategy.view'],
	'Field Worker': [],
	'Read Only': ['strategy.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(STRATEGY_STANDARD_ROLE_PERMISSIONS).flat())
);

/**
 * Align standard-role strategy grants for organisations provisioned after the
 * F01 migration. Durable template reconciliation remains authoritative even
 * when standard roles are renamed after their initial binding.
 */
export async function ensureStrategyStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(STRATEGY_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required strategy permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				STRATEGY_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof STRATEGY_STANDARD_ROLE_PERMISSIONS
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
