import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { OrganisationRoleRepository } from './role-repository';

const OWNER_ROLE_NAME = 'Owner';
const OWNER_DELEGATION_GUARD = 'access-role.owner.delegate';

export type RoleDelegationDecision = {
	allowed: boolean;
	deniedPermissionKeys: string[];
};

async function hasActiveOwnerRole(
	db: DatabaseExecutor,
	actor: TenantActorContext
): Promise<boolean> {
	const row = await db
		.selectFrom('member_roles as assignment')
		.innerJoin('organisation_roles as role', (join) =>
			join
				.onRef('role.id', '=', 'assignment.organisation_role_id')
				.onRef('role.organisation_id', '=', 'assignment.organisation_id')
		)
		.innerJoin('organisation_members as member', (join) =>
			join
				.onRef('member.id', '=', 'assignment.organisation_member_id')
				.onRef('member.organisation_id', '=', 'assignment.organisation_id')
		)
		.select('assignment.organisation_member_id')
		.where('assignment.organisation_id', '=', actor.organisationId)
		.where('assignment.organisation_member_id', '=', actor.memberId)
		.where('member.status', '=', 'active')
		.where('role.name', '=', OWNER_ROLE_NAME)
		.where('role.is_active', '=', 1)
		.executeTakeFirst();
	return Boolean(row);
}

async function requestsOwnerRole(
	db: DatabaseExecutor,
	organisationId: string,
	rolePublicIds: readonly string[]
): Promise<boolean> {
	const row = await db
		.selectFrom('organisation_roles')
		.select('id')
		.where('organisation_id', '=', organisationId)
		.where('public_id', 'in', [...rolePublicIds])
		.where('name', '=', OWNER_ROLE_NAME)
		.where('is_active', '=', 1)
		.executeTakeFirst();
	return Boolean(row);
}

/**
 * Governs organisation access-role delegation at the service boundary.
 *
 * - assigning any role requires member-management authority (or the wider
 *   organisation-management authority);
 * - the Owner role is owner-only delegable, so an Administrator cannot promote
 *   themselves or another member into ownership merely because they hold
 *   `organisation.manage`;
 * - ordinary delegated administrators may assign only permissions they
 *   effectively hold themselves;
 * - `organisation.manage` retains the ability to administer the non-owner role
 *   catalogue without bypassing the ownership boundary.
 */
export async function decideOrganisationRoleDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[]
): Promise<RoleDelegationDecision> {
	if (rolePublicIds.length === 0) return { allowed: true, deniedPermissionKeys: [] };

	const permissionService = new PermissionService(db);
	const authority = await permissionService.decideMany(actor, [
		'organisation.manage',
		'member.manage'
	]);
	const canManageOrganisation = authority.get('organisation.manage')?.allowed ?? false;
	const canManageMembers = authority.get('member.manage')?.allowed ?? false;
	if (!canManageOrganisation && !canManageMembers) {
		return { allowed: false, deniedPermissionKeys: ['member.manage'] };
	}

	if (
		(await requestsOwnerRole(db, actor.organisationId, rolePublicIds)) &&
		!(await hasActiveOwnerRole(db, actor))
	) {
		return { allowed: false, deniedPermissionKeys: [OWNER_DELEGATION_GUARD] };
	}

	if (canManageOrganisation) return { allowed: true, deniedPermissionKeys: [] };

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
