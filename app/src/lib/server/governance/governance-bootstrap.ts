import type { Database } from '$lib/server/db/database';

export const GOVERNANCE_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'governance.view',
		'governance.manage',
		'governance.approve',
		'governance.ethics.view',
		'governance.ethics.manage'
	],
	Administrator: [
		'governance.view',
		'governance.manage',
		'governance.approve',
		'governance.ethics.view',
		'governance.ethics.manage'
	],
	Manager: ['governance.view', 'governance.manage', 'governance.approve', 'governance.ethics.view'],
	'Finance/Commercial': ['governance.view'],
	'Member/Professional': ['governance.view'],
	'Field Worker': ['governance.view'],
	'Read Only': ['governance.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(GOVERNANCE_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureGovernanceStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(GOVERNANCE_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required governance permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				GOVERNANCE_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof GOVERNANCE_STANDARD_ROLE_PERMISSIONS
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
