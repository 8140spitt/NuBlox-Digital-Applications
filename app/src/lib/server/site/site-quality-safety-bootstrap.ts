import type { Database } from '$lib/server/db/database';

export const SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'site.view',
		'site.manage',
		'site.diary.manage',
		'site.diary.submit',
		'site.diary.approve',
		'quality.view',
		'quality.template.manage',
		'quality.inspection.manage',
		'quality.defect.manage',
		'quality.ncr.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	],
	Administrator: [
		'site.view',
		'site.manage',
		'site.diary.manage',
		'site.diary.submit',
		'site.diary.approve',
		'quality.view',
		'quality.template.manage',
		'quality.inspection.manage',
		'quality.defect.manage',
		'quality.ncr.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	],
	Manager: [
		'site.view',
		'site.manage',
		'site.diary.manage',
		'site.diary.submit',
		'site.diary.approve',
		'quality.view',
		'quality.template.manage',
		'quality.inspection.manage',
		'quality.defect.manage',
		'quality.ncr.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	],
	'Finance/Commercial': ['site.view', 'quality.view', 'safety.view'],
	'Member/Professional': [
		'site.view',
		'site.diary.manage',
		'site.diary.submit',
		'quality.view',
		'quality.inspection.manage',
		'quality.defect.manage',
		'quality.ncr.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	],
	'Field Worker': [
		'site.view',
		'site.diary.manage',
		'site.diary.submit',
		'quality.view',
		'quality.inspection.manage',
		'quality.defect.manage',
		'safety.view',
		'safety.event.manage',
		'safety.action.manage'
	],
	'Read Only': ['site.view', 'quality.view', 'safety.view']
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureSiteQualitySafetyStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required Slice 5 permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS
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
