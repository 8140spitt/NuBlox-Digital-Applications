import {
	ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS,
	ensureAssetsMaintenanceStandardRoleDefaults
} from '$lib/server/assets/assets-maintenance-bootstrap';
import type { Database } from '$lib/server/db/database';
import {
	ensureInformationStandardRoleDefaults,
	INFORMATION_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/information/information-bootstrap';
import {
	ensurePortalCollaborationStandardRoleDefaults,
	PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/portal/portal-collaboration-bootstrap';
import {
	ensureProcurementCommercialStandardRoleDefaults,
	SLICE4_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/procurement/procurement-commercial-bootstrap';
import {
	ensureProjectChangeStandardRoleDefaults,
	PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/projects/project-change-bootstrap';
import {
	ensureProjectRidaStandardRoleDefaults,
	PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/projects/project-rida-bootstrap';
import {
	ensureSiteQualitySafetyStandardRoleDefaults,
	SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/site/site-quality-safety-bootstrap';
import {
	ensureWorkKernelStandardRoleDefaults,
	WORK_KERNEL_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/work/work-item-bootstrap';
import {
	ensureWorkforceStandardRoleDefaults,
	WORKFORCE_STANDARD_ROLE_PERMISSIONS
} from '$lib/server/workforce/workforce-bootstrap';
import {
	ensureStandardAccessRoleBindings,
	listBoundStandardAccessRoles,
	markStandardAccessRoleTemplateVersion,
	standardAccessRoleDefaultName
} from './standard-access-roles';

/**
 * Increment this value whenever the composed standard-role permission templates
 * change in a way that must be re-applied to active organisations after deploy.
 */
export const STANDARD_ROLE_PERMISSION_TEMPLATE_VERSION = '2026-08-29.1';

const MAX_RECONCILED_ORGANISATIONS = 1_000;
const reconciledOrganisations = new Set<string>();
const inFlightReconciliations = new Map<string, Promise<void>>();

const STANDARD_ROLE_PERMISSION_MAPS = [
	WORK_KERNEL_STANDARD_ROLE_PERMISSIONS,
	WORKFORCE_STANDARD_ROLE_PERMISSIONS,
	INFORMATION_STANDARD_ROLE_PERMISSIONS,
	SLICE4_STANDARD_ROLE_PERMISSIONS,
	SITE_QUALITY_SAFETY_STANDARD_ROLE_PERMISSIONS,
	ASSETS_MAINTENANCE_STANDARD_ROLE_PERMISSIONS,
	PORTAL_COLLABORATION_STANDARD_ROLE_PERMISSIONS,
	PROJECT_RIDA_STANDARD_ROLE_PERMISSIONS,
	PROJECT_CHANGE_STANDARD_ROLE_PERMISSIONS
] as const;

function reconciliationKey(organisationId: string): string {
	return `${STANDARD_ROLE_PERMISSION_TEMPLATE_VERSION}:${organisationId}`;
}

function markReconciled(key: string): void {
	if (reconciledOrganisations.size >= MAX_RECONCILED_ORGANISATIONS) {
		reconciledOrganisations.clear();
	}
	reconciledOrganisations.add(key);
}

function desiredPermissionKeysForRole(defaultName: string): string[] {
	const permissionKeys = new Set<string>();
	for (const permissionMap of STANDARD_ROLE_PERMISSION_MAPS) {
		const rolePermissions = permissionMap as Record<string, readonly string[] | undefined>;
		const keys = rolePermissions[defaultName];
		for (const permissionKey of keys ?? []) permissionKeys.add(permissionKey);
	}
	return [...permissionKeys];
}

/**
 * Apply the composed permission template through durable role bindings. This is
 * the name-independent pass: once a standard role is bound, changing its
 * display label cannot change which security template it represents.
 */
async function ensureBoundStandardRolePermissionDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	const roles = await listBoundStandardAccessRoles(db, organisationId);
	const desiredByRoleId = new Map<string, string[]>();
	const requiredPermissionKeys = new Set<string>();

	for (const role of roles) {
		const defaultName = standardAccessRoleDefaultName(role.roleKey);
		if (!defaultName) continue;
		const permissionKeys = desiredPermissionKeysForRole(defaultName);
		desiredByRoleId.set(role.roleId, permissionKeys);
		for (const permissionKey of permissionKeys) requiredPermissionKeys.add(permissionKey);
	}

	if (requiredPermissionKeys.size > 0) {
		const permissions = await db
			.selectFrom('permissions')
			.select(['id', 'permission_key'])
			.where('permission_key', 'in', [...requiredPermissionKeys])
			.where('is_active', '=', 1)
			.execute();
		const permissionIdByKey = new Map(permissions.map((row) => [row.permission_key, row.id]));

		for (const permissionKey of requiredPermissionKeys) {
			if (!permissionIdByKey.has(permissionKey)) {
				throw new Error(`Required standard-role permission is missing: ${permissionKey}`);
			}
		}

		const desiredGrants: Array<{
			organisation_id: string;
			organisation_role_id: string;
			permission_id: string;
		}> = [];
		for (const [roleId, permissionKeys] of desiredByRoleId) {
			for (const permissionKey of permissionKeys) {
				desiredGrants.push({
					organisation_id: organisationId,
					organisation_role_id: roleId,
					permission_id: permissionIdByKey.get(permissionKey)!
				});
			}
		}

		if (desiredGrants.length > 0) {
			await db.insertInto('role_permissions').ignore().values(desiredGrants).execute();
		}
	}

	await markStandardAccessRoleTemplateVersion(
		db,
		organisationId,
		STANDARD_ROLE_PERMISSION_TEMPLATE_VERSION
	);
}

/**
 * Idempotently aligns all NuBlox standard organisation access roles with the
 * current permission templates.
 *
 * This deliberately operates on access roles only. Functional roles, job
 * profiles, careers and organisation positions remain separate business/job
 * architecture concepts and never grant permissions implicitly.
 *
 * Reconciliation is cached per organisation and template version for the life
 * of the server process. A failed run is never cached, so the next request can
 * retry after the underlying problem has been corrected.
 */
export async function ensureStandardRolePermissionDefaults(
	db: Database,
	organisationId: string
): Promise<void> {
	const key = reconciliationKey(organisationId);
	if (reconciledOrganisations.has(key)) return;

	const existing = inFlightReconciliations.get(key);
	if (existing) return existing;

	const reconciliation = (async () => {
		await ensureStandardAccessRoleBindings(db, organisationId);
		await Promise.all([
			ensureWorkKernelStandardRoleDefaults(db, organisationId),
			ensureWorkforceStandardRoleDefaults(db, organisationId),
			ensureInformationStandardRoleDefaults(db, organisationId),
			ensureProcurementCommercialStandardRoleDefaults(db, organisationId),
			ensureSiteQualitySafetyStandardRoleDefaults(db, organisationId),
			ensureAssetsMaintenanceStandardRoleDefaults(db, organisationId),
			ensurePortalCollaborationStandardRoleDefaults(db, organisationId),
			ensureProjectRidaStandardRoleDefaults(db, organisationId),
			ensureProjectChangeStandardRoleDefaults(db, organisationId)
		]);
		await ensureBoundStandardRolePermissionDefaults(db, organisationId);
	})();

	inFlightReconciliations.set(key, reconciliation);
	try {
		await reconciliation;
		markReconciled(key);
	} finally {
		inFlightReconciliations.delete(key);
	}
}

/** Test-only escape hatch for deterministic reconciliation assertions. */
export function resetStandardRolePermissionReconciliationCache(): void {
	reconciledOrganisations.clear();
	inFlightReconciliations.clear();
}
