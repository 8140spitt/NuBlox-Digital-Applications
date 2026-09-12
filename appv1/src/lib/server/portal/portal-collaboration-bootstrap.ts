import type { Database } from '$lib/server/db/database';

export const PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS = {
	Owner: ['portal.view', 'portal.respond', 'portal.manage'],
	Administrator: ['portal.view', 'portal.respond', 'portal.manage'],
	Manager: ['portal.view', 'portal.respond', 'portal.manage'],
	'Finance/Commercial': ['portal.view'],
	'Member/Professional': ['portal.view', 'portal.respond'],
	'Field Worker': ['portal.view', 'portal.respond'],
	'Read Only': ['portal.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensurePortalCollaborationStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required Slice 7 permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS
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
