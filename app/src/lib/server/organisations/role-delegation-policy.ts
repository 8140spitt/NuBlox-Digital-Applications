import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { OrganisationRoleRepository } from './role-repository';

export type RoleDelegationDecision = {
	allowed: boolean;
	deniedPermissionKeys: string[];
};

/**
 * A normal member administrator may delegate only permissions they effectively
 * hold themselves. `organisation.manage` is the explicit authority that may
 * administer the complete organisation role catalogue.
 */
export async function decideOrganisationRoleDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[]
): Promise<RoleDelegationDecision> {
	if (rolePublicIds.length === 0) return { allowed: true, deniedPermissionKeys: [] };

	const permissionService = new PermissionService(db);
	const organisationManage = await permissionService.decide(actor, 'organisation.manage');
	if (organisationManage.allowed) return { allowed: true, deniedPermissionKeys: [] };

	const permissionKeys = await new OrganisationRoleRepository(db).listPermissionKeysForActiveRoles(
		actor.organisationId,
		rolePublicIds
	);
	if (permissionKeys.length === 0) return { allowed: true, deniedPermissionKeys: [] };

	const decisions = await permissionService.decideMany(actor, permissionKeys);
	const deniedPermissionKeys = permissionKeys.filter(
		(permissionKey) => !(decisions.get(permissionKey)?.allowed ?? false)
	);
	return {
		allowed: deniedPermissionKeys.length === 0,
		deniedPermissionKeys
	};
}
