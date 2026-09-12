import type { Database } from '$lib/server/db/database';

export const ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'assets.view',
		'assets.manage',
		'assets.lifecycle.manage',
		'assets.evidence.manage',
		'facilities.view',
		'facilities.manage',
		'maintenance.view',
		'maintenance.request.manage',
		'maintenance.plan.manage',
		'maintenance.work_order.manage',
		'maintenance.work_order.complete',
		'maintenance.assignment.manage',
		'maintenance.service.manage',
		'compliance.view',
		'compliance.manage'
	],
	Administrator: [
		'assets.view',
		'assets.manage',
		'assets.lifecycle.manage',
		'assets.evidence.manage',
		'facilities.view',
		'facilities.manage',
		'maintenance.view',
		'maintenance.request.manage',
		'maintenance.plan.manage',
		'maintenance.work_order.manage',
		'maintenance.work_order.complete',
		'maintenance.assignment.manage',
		'maintenance.service.manage',
		'compliance.view',
		'compliance.manage'
	],
	Manager: [
		'assets.view',
		'assets.manage',
		'assets.lifecycle.manage',
		'assets.evidence.manage',
		'facilities.view',
		'facilities.manage',
		'maintenance.view',
		'maintenance.request.manage',
		'maintenance.plan.manage',
		'maintenance.work_order.manage',
		'maintenance.work_order.complete',
		'maintenance.assignment.manage',
		'maintenance.service.manage',
		'compliance.view',
		'compliance.manage'
	],
	'Finance/Commercial': ['assets.view', 'facilities.view', 'maintenance.view', 'compliance.view'],
	'Member/Professional': [
		'assets.view',
		'assets.manage',
		'assets.lifecycle.manage',
		'assets.evidence.manage',
		'facilities.view',
		'maintenance.view',
		'maintenance.request.manage',
		'maintenance.plan.manage',
		'maintenance.work_order.manage',
		'maintenance.work_order.complete',
		'maintenance.assignment.manage',
		'maintenance.service.manage',
		'compliance.view',
		'compliance.manage'
	],
	'Field Worker': [
		'assets.view',
		'facilities.view',
		'maintenance.view',
		'maintenance.request.manage',
		'maintenance.work_order.complete',
		'maintenance.service.manage',
		'compliance.view'
	],
	'Read Only': ['assets.view', 'facilities.view', 'maintenance.view', 'compliance.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureAssetsMaintenanceStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required Slice 6 permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS
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
