import type { Database } from '$lib/server/db/database';

export const SLICE4_STANDARD_ROLE_PERMISSIONS = {
	Owner: [
		'procurement.view',
		'procurement.package.manage',
		'procurement.rfq.manage',
		'procurement.rfq.issue',
		'procurement.po.manage',
		'procurement.po.approve',
		'procurement.po.issue',
		'procurement.receipt.manage',
		'commercial.cost_control.view',
		'commercial.cost_code.manage',
		'commercial.budget.manage',
		'commercial.budget.approve',
		'commercial.variation.manage',
		'commercial.variation.issue',
		'commercial.variation.decide',
		'commercial.valuation.manage',
		'commercial.valuation.assess'
	],
	Administrator: [
		'procurement.view',
		'procurement.package.manage',
		'procurement.rfq.manage',
		'procurement.rfq.issue',
		'procurement.po.manage',
		'procurement.po.approve',
		'procurement.po.issue',
		'procurement.receipt.manage',
		'commercial.cost_control.view',
		'commercial.cost_code.manage',
		'commercial.budget.manage',
		'commercial.budget.approve',
		'commercial.variation.manage',
		'commercial.variation.issue',
		'commercial.variation.decide',
		'commercial.valuation.manage',
		'commercial.valuation.assess'
	],
	Manager: [
		'procurement.view',
		'procurement.package.manage',
		'procurement.rfq.manage',
		'procurement.rfq.issue',
		'procurement.po.manage',
		'procurement.po.issue',
		'procurement.receipt.manage',
		'commercial.cost_control.view',
		'commercial.cost_code.manage',
		'commercial.budget.manage',
		'commercial.variation.manage',
		'commercial.variation.issue',
		'commercial.valuation.manage',
		'commercial.valuation.assess'
	],
	'Finance/Commercial': [
		'procurement.view',
		'procurement.package.manage',
		'procurement.rfq.manage',
		'procurement.rfq.issue',
		'procurement.po.manage',
		'procurement.po.approve',
		'procurement.po.issue',
		'procurement.receipt.manage',
		'commercial.cost_control.view',
		'commercial.cost_code.manage',
		'commercial.budget.manage',
		'commercial.budget.approve',
		'commercial.variation.manage',
		'commercial.variation.issue',
		'commercial.variation.decide',
		'commercial.valuation.manage',
		'commercial.valuation.assess'
	],
	'Member/Professional': [
		'procurement.view',
		'procurement.package.manage',
		'procurement.rfq.manage',
		'procurement.po.manage',
		'procurement.receipt.manage'
	],
	'Read Only': ['procurement.view'],
	'Field Worker': []
} as const;

const REQUIRED_PERMISSION_KEYS = Array.from(
	new Set(Object.values(SLICE4_STANDARD_ROLE_PERMISSIONS).flat())
);

export async function ensureProcurementCommercialStandardRoleDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	await db.transaction().execute(async (trx) => {
		const [roles, permissions] = await Promise.all([
			trx
				.selectFrom('organisation_roles')
				.select(['id', 'name'])
				.where('organisation_id', '=', organisationId)
				.where('name', 'in', Object.keys(SLICE4_STANDARD_ROLE_PERMISSIONS))
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
				throw new Error(`Required Slice 4 permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const role of roles) {
			const keys =
				SLICE4_STANDARD_ROLE_PERMISSIONS[
					role.name as keyof typeof SLICE4_STANDARD_ROLE_PERMISSIONS
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
