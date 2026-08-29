import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { OrganisationRoleRepository } from './role-repository';
import {
	ensureStandardAccessRoleBindings,
	OWNER_ACCESS_ROLE_KEY,
	STANDARD_ACCESS_ROLE_TEMPLATE_KEY
} from './standard-access-roles';

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
		.innerJoin('organisation_role_template_bindings as binding', (join) =>
			join
				.onRef('binding.organisation_role_id', '=', 'role.id')
				.onRef('binding.organisation_id', '=', 'role.organisation_id')
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
		.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
		.where('binding.role_key', '=', OWNER_ACCESS_ROLE_KEY)
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
		.selectFrom('organisation_roles as role')
		.innerJoin('organisation_role_template_bindings as binding', (join) =>
			join
				.onRef('binding.organisation_role_id', '=', 'role.id')
				.onRef('binding.organisation_id', '=', 'role.organisation_id')
		)
		.select('role.id')
		.where('role.organisation_id', '=', organisationId)
		.where('role.public_id', 'in', [...rolePublicIds])
		.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
		.where('binding.role_key', '=', OWNER_ACCESS_ROLE_KEY)
		.where('role.is_active', '=', 1)
		.executeTakeFirst();
	return Boolean(row);
}

/**
 * Governs which organisation access roles an already-authorised action may
 * delegate. Action authority (for example member administration versus
 * invitation creation) remains the responsibility of the calling service.
 *
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

	await ensureStandardAccessRoleBindings(db, actor.organisationId);

	if (
		(await requestsOwnerRole(db, actor.organisationId, rolePublicIds)) &&
		!(await hasActiveOwnerRole(db, actor))
	) {
		return { allowed: false, deniedPermissionKeys: [OWNER_DELEGATION_GUARD] };
	}

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
