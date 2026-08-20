import type { Database } from '$lib/server/db/database';

const INFORMATION_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'information.view',
		'information.manage',
		'information.file.manage',
		'information.issue',
		'information.rfi.manage',
		'information.rfi.respond',
		'information.submittal.manage',
		'information.submittal.review',
		'information.instruction.manage',
		'information.instruction.issue'
	],
	Administrator: [
		'information.view',
		'information.manage',
		'information.file.manage',
		'information.issue',
		'information.rfi.manage',
		'information.rfi.respond',
		'information.submittal.manage',
		'information.submittal.review',
		'information.instruction.manage',
		'information.instruction.issue'
	],
	Manager: [
		'information.view',
		'information.manage',
		'information.file.manage',
		'information.issue',
		'information.rfi.manage',
		'information.rfi.respond',
		'information.submittal.manage',
		'information.submittal.review',
		'information.instruction.manage',
		'information.instruction.issue'
	],
	'Member/Professional': [
		'information.view',
		'information.manage',
		'information.file.manage',
		'information.rfi.manage',
		'information.rfi.respond',
		'information.submittal.manage',
		'information.instruction.manage'
	],
	'Field Worker': ['information.view', 'information.rfi.respond'],
	'Finance/Commercial': ['information.view'],
	'Read Only': ['information.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(INFORMATION_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureInformationStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(INFORMATION_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required project information permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				INFORMATION_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof INFORMATION_STANDARD_ROLE_PERMISSIONS
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
