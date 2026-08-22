import type { Database } from '$lib/server/db/database';

export const WORK_KERNEL_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'work.view',
		'work.create',
		'work.assign',
		'work.progress',
		'work.complete',
		'work.approve',
		'work.manage'
	],
	Administrator: [
		'work.view',
		'work.create',
		'work.assign',
		'work.progress',
		'work.complete',
		'work.approve',
		'work.manage'
	],
	Manager: [
		'work.view',
		'work.create',
		'work.assign',
		'work.progress',
		'work.complete',
		'work.approve',
		'work.manage'
	],
	'Finance/Commercial': ['work.view', 'work.create', 'work.progress', 'work.complete'],
	'Member/Professional': ['work.view', 'work.create', 'work.progress', 'work.complete'],
	'Field Worker': ['work.view', 'work.progress', 'work.complete'],
	'Read Only': ['work.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(WORK_KERNEL_STANDARD_ROLE_PERMISSIONS).flat())
);

/**
 * Align standard-role grants for organisations created after the Work Kernel
 * migration. Existing organisations are seeded by the migration itself.
 */
export async function ensureWorkKernelStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(WORK_KERNEL_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required Work Kernel permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				WORK_KERNEL_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof WORK_KERNEL_STANDARD_ROLE_PERMISSIONS
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
