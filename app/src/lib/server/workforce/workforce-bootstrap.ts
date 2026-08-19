import type { Database } from '$lib/server/db/database';

const WORKFORCE_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'workforce.view',
		'workforce.manage',
		'workforce.competency.manage',
		'workforce.credential.manage',
		'workforce.cost_rate.view',
		'workforce.cost_rate.manage',
		'workforce.assignment.manage',
		'schedule.view',
		'schedule.manage',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit',
		'timesheet.approve'
	],
	Administrator: [
		'workforce.view',
		'workforce.manage',
		'workforce.competency.manage',
		'workforce.credential.manage',
		'workforce.cost_rate.view',
		'workforce.cost_rate.manage',
		'workforce.assignment.manage',
		'schedule.view',
		'schedule.manage',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit',
		'timesheet.approve'
	],
	Manager: [
		'workforce.view',
		'workforce.manage',
		'workforce.competency.manage',
		'workforce.credential.manage',
		'workforce.assignment.manage',
		'schedule.view',
		'schedule.manage',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit',
		'timesheet.approve'
	],
	'Finance/Commercial': [
		'workforce.view',
		'workforce.cost_rate.view',
		'schedule.view',
		'timesheet.view'
	],
	'Member/Professional': [
		'workforce.view',
		'schedule.view',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit'
	],
	'Field Worker': [
		'workforce.view',
		'schedule.view',
		'timesheet.view',
		'timesheet.manage',
		'timesheet.submit'
	],
	'Read Only': ['workforce.view', 'schedule.view', 'timesheet.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(WORKFORCE_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureWorkforceStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(WORKFORCE_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required workforce permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys = WORKFORCE_STANDARD_ROLE_PERMISSIONS[
				role.name as keyof typeof WORKFORCE_STANDARD_ROLE_PERMISSIONS
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
