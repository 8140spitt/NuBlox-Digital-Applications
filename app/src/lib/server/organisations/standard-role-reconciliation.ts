import { ensureAssetsMaintenanceStandardRoleDefaults } from '$lib/server/assets/assets-maintenance-bootstrap';
import type { Database } from '$lib/server/db/database';
import { ensureInformationStandardRoleDefaults } from '$lib/server/information/information-bootstrap';
import { ensurePortalCollaborationStandardRoleDefaults } from '$lib/server/portal/portal-collaboration-bootstrap';
import { ensureProcurementCommercialStandardRoleDefaults } from '$lib/server/procurement/procurement-commercial-bootstrap';
import { ensureProjectChangeStandardRoleDefaults } from '$lib/server/projects/project-change-bootstrap';
import { ensureProjectRidaStandardRoleDefaults } from '$lib/server/projects/project-rida-bootstrap';
import { ensureSiteQualitySafetyStandardRoleDefaults } from '$lib/server/site/site-quality-safety-bootstrap';
import { ensureWorkKernelStandardRoleDefaults } from '$lib/server/work/work-item-bootstrap';
import { ensureWorkforceStandardRoleDefaults } from '$lib/server/workforce/workforce-bootstrap';

/**
 * Increment this value whenever the composed standard-role permission templates
 * change in a way that must be re-applied to active organisations after deploy.
 */
export const STANDARD_ROLE_PERMISSION_TEMPLATE_VERSION = '2026-08-28.1';

const MAX_RECONCILED_ORGANISATIONS = 1_000;
const reconciledOrganisations = new Set<string>();
const inFlightReconciliations = new Map<string, Promise<void>>();

function reconciliationKey(organisationId: string): string {
	return `${STANDARD_ROLE_PERMISSION_TEMPLATE_VERSION}:${organisationId}`;
}

function markReconciled(key: string): void {
	if (reconciledOrganisations.size >= MAX_RECONCILED_ORGANISATIONS) {
		reconciledOrganisations.clear();
	}
	reconciledOrganisations.add(key);
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

	const reconciliation = Promise.all([
		ensureWorkKernelStandardRoleDefaults(db, organisationId),
		ensureWorkforceStandardRoleDefaults(db, organisationId),
		ensureInformationStandardRoleDefaults(db, organisationId),
		ensureProcurementCommercialStandardRoleDefaults(db, organisationId),
		ensureSiteQualitySafetyStandardRoleDefaults(db, organisationId),
		ensureAssetsMaintenanceStandardRoleDefaults(db, organisationId),
		ensurePortalCollaborationStandardRoleDefaults(db, organisationId),
		ensureProjectRidaStandardRoleDefaults(db, organisationId),
		ensureProjectChangeStandardRoleDefaults(db, organisationId)
	]).then(() => undefined);

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
