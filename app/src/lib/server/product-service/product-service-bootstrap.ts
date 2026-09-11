import type { Database } from '$lib/server/db/database';

export const PRODUCT_SERVICE_STANDARD_ROLE_PERMISSIONS = {
	Owner: ['product_service.view', 'product_service.manage', 'product_service.approve'],
	Administrator: ['product_service.view', 'product_service.manage', 'product_service.approve'],
	Manager: ['product_service.view', 'product_service.manage', 'product_service.approve'],
	'Finance/Commercial': ['product_service.view'],
	'Member/Professional': ['product_service.view', 'product_service.manage'],
	'Field Worker': [],
	'Read Only': ['product_service.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(PRODUCT_SERVICE_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureProductServiceStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(PRODUCT_SERVICE_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required product/service permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				PRODUCT_SERVICE_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof PRODUCT_SERVICE_STANDARD_ROLE_PERMISSIONS
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
