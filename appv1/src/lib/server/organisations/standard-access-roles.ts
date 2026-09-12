import type { DatabaseExecutor } from '$lib/server/db/executor';

export const STANDARD_ACCESS_ROLE_TEMPLATE_KEY = 'nublox.standard-access-role';

export const STANDARD_ACCESS_ROLES = [
	{ roleKey: 'owner', defaultName: 'Owner' },
	{ roleKey: 'administrator', defaultName: 'Administrator' },
	{ roleKey: 'manager', defaultName: 'Manager' },
	{ roleKey: 'finance-commercial', defaultName: 'Finance/Commercial' },
	{ roleKey: 'member-professional', defaultName: 'Member/Professional' },
	{ roleKey: 'field-worker', defaultName: 'Field Worker' },
	{ roleKey: 'read-only', defaultName: 'Read Only' }
] as const;

export type StandardAccessRoleKey = (typeof STANDARD_ACCESS_ROLES)[number]['roleKey'];
export type StandardAccessRoleDefaultName = (typeof STANDARD_ACCESS_ROLES)[number]['defaultName'];

export const OWNER_ACCESS_ROLE_KEY: StandardAccessRoleKey = 'owner';
export const STANDARD_ACCESS_ROLE_KEYS = STANDARD_ACCESS_ROLES.map((role) => role.roleKey);
export const STANDARD_ACCESS_ROLE_DEFAULT_NAMES = STANDARD_ACCESS_ROLES.map(
	(role) => role.defaultName
);

const roleKeyByDefaultName = new Map<StandardAccessRoleDefaultName, StandardAccessRoleKey>(
	STANDARD_ACCESS_ROLES.map((role) => [role.defaultName, role.roleKey])
);
const defaultNameByRoleKey = new Map<StandardAccessRoleKey, StandardAccessRoleDefaultName>(
	STANDARD_ACCESS_ROLES.map((role) => [role.roleKey, role.defaultName])
);

export function standardAccessRoleKeyForDefaultName(
	name: string
): StandardAccessRoleKey | undefined {
	return roleKeyByDefaultName.get(name as StandardAccessRoleDefaultName);
}

export function standardAccessRoleDefaultName(
	roleKey: string
): StandardAccessRoleDefaultName | undefined {
	return defaultNameByRoleKey.get(roleKey as StandardAccessRoleKey);
}

/**
 * Bind legacy/newly provisioned canonical access-role rows to durable NuBlox
 * template keys. Existing bindings are never inferred again from display names,
 * so organisations may rename a bound role without changing its semantics.
 */
export async function ensureStandardAccessRoleBindings(
	db: DatabaseExecutor,
	organisationId: string
): Promise<void> {
	const [roles, bindings] = await Promise.all([
		db
			.selectFrom('organisation_roles')
			.select(['id', 'name'])
			.where('organisation_id', '=', organisationId)
			.where('name', 'in', [...STANDARD_ACCESS_ROLE_DEFAULT_NAMES])
			.execute(),
		db
			.selectFrom('organisation_role_template_bindings')
			.select(['organisation_role_id', 'role_key'])
			.where('organisation_id', '=', organisationId)
			.where('template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
			.execute()
	]);

	const boundRoleIds = new Set(bindings.map((binding) => binding.organisation_role_id));
	const boundRoleKeys = new Set(bindings.map((binding) => binding.role_key));
	const values = roles.flatMap((role) => {
		const roleKey = standardAccessRoleKeyForDefaultName(role.name);
		if (!roleKey || boundRoleIds.has(role.id) || boundRoleKeys.has(roleKey)) return [];
		return [
			{
				organisation_role_id: role.id,
				organisation_id: organisationId,
				role_key: roleKey,
				template_key: STANDARD_ACCESS_ROLE_TEMPLATE_KEY,
				template_version: null
			}
		];
	});

	if (values.length > 0) {
		await db.insertInto('organisation_role_template_bindings').ignore().values(values).execute();
	}
}

export async function listBoundStandardAccessRoles(
	db: DatabaseExecutor,
	organisationId: string
): Promise<Array<{ roleId: string; roleKey: string }>> {
	return db
		.selectFrom('organisation_role_template_bindings as binding')
		.innerJoin('organisation_roles as role', (join) =>
			join
				.onRef('role.id', '=', 'binding.organisation_role_id')
				.onRef('role.organisation_id', '=', 'binding.organisation_id')
		)
		.select(['role.id as roleId', 'binding.role_key as roleKey'])
		.where('binding.organisation_id', '=', organisationId)
		.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
		.where('binding.role_key', 'in', [...STANDARD_ACCESS_ROLE_KEYS])
		.where('role.is_active', '=', 1)
		.execute();
}

export async function markStandardAccessRoleTemplateVersion(
	db: DatabaseExecutor,
	organisationId: string,
	templateVersion: string
): Promise<void> {
	await db
		.updateTable('organisation_role_template_bindings')
		.set({ template_version: templateVersion })
		.where('organisation_id', '=', organisationId)
		.where('template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
		.where('role_key', 'in', [...STANDARD_ACCESS_ROLE_KEYS])
		.execute();
}
