import type { DatabaseExecutor } from '$lib/server/db/executor';

const MANAGE_PERMISSION_KEYS = [
	'project.portfolio.view',
	'project.portfolio.manage',
	'project.programme.view',
	'project.programme.manage'
] as const;

const VIEW_PERMISSION_KEYS = ['project.portfolio.view', 'project.programme.view'] as const;

/**
 * Keeps hierarchy permissions aligned with NuBlox standard roles for both
 * pre-existing and newly bootstrapped organisations. Explicit member denies
 * still win in PermissionService, so this only establishes standard role grants.
 */
export async function ensureProjectHierarchyStandardRoleDefaults(
	db: DatabaseExecutor,
	organisationId: string
): Promise<void> {
	const permissions = await db
		.selectFrom('permissions')
		.select(['id', 'permission_key'])
		.where('permission_key', 'in', [...MANAGE_PERMISSION_KEYS])
		.where('is_active', '=', 1)
		.execute();
	if (permissions.length !== MANAGE_PERMISSION_KEYS.length) return;

	const roles = await db
		.selectFrom('organisation_roles')
		.select(['id', 'name'])
		.where('organisation_id', '=', organisationId)
		.where('is_active', '=', 1)
		.where('name', 'in', [
			'Owner',
			'Administrator',
			'Manager',
			'Finance/Commercial',
			'Member/Professional',
			'Read Only'
		])
		.execute();
	if (roles.length === 0) return;

	const rows = roles.flatMap((role) => {
		const permittedKeys = new Set(
			role.name === 'Owner' || role.name === 'Administrator' || role.name === 'Manager'
				? MANAGE_PERMISSION_KEYS
				: VIEW_PERMISSION_KEYS
		);
		return permissions
			.filter((permission) => permittedKeys.has(permission.permission_key as never))
			.map((permission) => ({
				organisation_id: organisationId,
				organisation_role_id: role.id,
				permission_id: permission.id
			}));
	});
	if (rows.length === 0) return;

	await db.insertInto('role_permissions').values(rows).ignore().execute();
}
