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
const POLICY_NOT_EFFECTIVE_GUARD = 'access-delegation.policy.not-effective';
const POLICY_EXPIRED_GUARD = 'access-delegation.policy.expired';

export type RoleDelegationDecision = {
	allowed: boolean;
	deniedPermissionKeys: string[];
};

export type RoleDelegationDecisionBasis =
	| 'no-access-change'
	| 'owner-required'
	| 'active-owner'
	| 'configured-policy'
	| 'organisation-manage'
	| 'effective-permission-ceiling';

export type RoleDelegationPolicyState = 'active' | 'not-effective' | 'expired';

export type RoleDelegationDecisionEvidence = {
	evaluatedAt: string;
	basis: RoleDelegationDecisionBasis;
	policyPublicId: string | null;
	policyState: RoleDelegationPolicyState | null;
};

export type RoleDelegationEvaluation = {
	decision: RoleDelegationDecision;
	evidence: RoleDelegationDecisionEvidence;
};

export type RoleDelegationOptions = {
	at?: Date;
};

function evaluation(
	decision: RoleDelegationDecision,
	basis: RoleDelegationDecisionBasis,
	at: Date,
	policyPublicId: string | null = null,
	policyState: RoleDelegationPolicyState | null = null
): RoleDelegationEvaluation {
	return {
		decision,
		evidence: {
			evaluatedAt: at.toISOString(),
			basis,
			policyPublicId,
			policyState
		}
	};
}

export async function hasActiveOwnerRole(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	at = new Date()
): Promise<boolean> {
	const row = await db
		.selectFrom('member_roles as assignment')
		.leftJoin('member_role_access_windows as window', (join) =>
			join
				.onRef('window.organisation_id', '=', 'assignment.organisation_id')
				.onRef('window.organisation_member_id', '=', 'assignment.organisation_member_id')
				.onRef('window.organisation_role_id', '=', 'assignment.organisation_role_id')
		)
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
		.where((eb) =>
			eb.or([eb('window.effective_from', 'is', null), eb('window.effective_from', '<=', at)])
		)
		.where((eb) => eb.or([eb('window.expires_at', 'is', null), eb('window.expires_at', '>', at)]))
		.executeTakeFirst();
	return Boolean(row);
}

async function requestsOwnerRole(
	db: DatabaseExecutor,
	organisationId: string,
	rolePublicIds: readonly string[]
): Promise<boolean> {
	if (rolePublicIds.length === 0) return false;
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
		.executeTakeFirst();
	return Boolean(row);
}

async function configuredPolicyEvaluation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[],
	permissionKeys: readonly string[],
	at: Date
): Promise<RoleDelegationEvaluation | null> {
	const policy = await db
		.selectFrom('organisation_delegation_policies')
		.select(['id', 'public_id', 'effective_from', 'expires_at'])
		.where('organisation_id', '=', actor.organisationId)
		.where('organisation_member_id', '=', actor.memberId)
		.executeTakeFirst();
	if (!policy) return null;
	if (policy.effective_from !== null && policy.effective_from > at) {
		return evaluation(
			{ allowed: false, deniedPermissionKeys: [POLICY_NOT_EFFECTIVE_GUARD] },
			'configured-policy',
			at,
			policy.public_id,
			'not-effective'
		);
	}
	if (policy.expires_at !== null && policy.expires_at <= at) {
		return evaluation(
			{ allowed: false, deniedPermissionKeys: [POLICY_EXPIRED_GUARD] },
			'configured-policy',
			at,
			policy.public_id,
			'expired'
		);
	}

	const denied = new Set<string>();
	if (rolePublicIds.length > 0) {
		const requestedStandardRoles = await db
			.selectFrom('organisation_roles as role')
			.innerJoin('organisation_role_template_bindings as binding', (join) =>
				join
					.onRef('binding.organisation_role_id', '=', 'role.id')
					.onRef('binding.organisation_id', '=', 'role.organisation_id')
			)
			.select('binding.role_key as roleKey')
			.where('role.organisation_id', '=', actor.organisationId)
			.where('role.public_id', 'in', [...rolePublicIds])
			.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
			.execute();
		const allowedRoleKeys = new Set(
			(
				await db
					.selectFrom('organisation_delegation_role_grants')
					.select('role_key')
					.where('policy_id', '=', policy.id)
					.execute()
			).map((row) => row.role_key)
		);
		for (const role of requestedStandardRoles) {
			if (role.roleKey !== OWNER_ACCESS_ROLE_KEY && !allowedRoleKeys.has(role.roleKey)) {
				denied.add(`access-role.${role.roleKey}.delegate`);
			}
		}
	}

	if (permissionKeys.length > 0) {
		const allowedPermissionKeys = new Set(
			(
				await db
					.selectFrom('organisation_delegation_permission_grants as grant')
					.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
					.select('permission.permission_key as permissionKey')
					.where('grant.policy_id', '=', policy.id)
					.execute()
			).map((row) => row.permissionKey)
		);
		for (const permissionKey of permissionKeys) {
			if (!allowedPermissionKeys.has(permissionKey)) denied.add(permissionKey);
		}
	}

	return evaluation(
		{ allowed: denied.size === 0, deniedPermissionKeys: [...denied].sort() },
		'configured-policy',
		at,
		policy.public_id,
		'active'
	);
}

async function evaluatePermissionCeiling(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	permissionKeys: readonly string[],
	at: Date
): Promise<RoleDelegationEvaluation> {
	const uniquePermissionKeys = [...new Set(permissionKeys)];
	if (uniquePermissionKeys.length === 0) {
		return evaluation({ allowed: true, deniedPermissionKeys: [] }, 'no-access-change', at);
	}

	const permissionService = new PermissionService(db);
	const organisationManage = await permissionService.decide(actor, 'organisation.manage', { at });
	if (organisationManage.allowed) {
		return evaluation({ allowed: true, deniedPermissionKeys: [] }, 'organisation-manage', at);
	}

	const decisions = await permissionService.decideMany(actor, uniquePermissionKeys, { at });
	const deniedPermissionKeys = uniquePermissionKeys.filter(
		(permissionKey) => !(decisions.get(permissionKey)?.allowed ?? false)
	);
	return evaluation(
		{
			allowed: deniedPermissionKeys.length === 0,
			deniedPermissionKeys
		},
		'effective-permission-ceiling',
		at
	);
}

async function evaluateRoleAndPermissionDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[],
	permissionKeys: readonly string[],
	at: Date
): Promise<RoleDelegationEvaluation> {
	await ensureStandardAccessRoleBindings(db, actor.organisationId);
	const activeOwner = await hasActiveOwnerRole(db, actor, at);

	if ((await requestsOwnerRole(db, actor.organisationId, rolePublicIds)) && !activeOwner) {
		return evaluation(
			{ allowed: false, deniedPermissionKeys: [OWNER_DELEGATION_GUARD] },
			'owner-required',
			at
		);
	}
	if (activeOwner) {
		return evaluation({ allowed: true, deniedPermissionKeys: [] }, 'active-owner', at);
	}

	const configured = await configuredPolicyEvaluation(db, actor, rolePublicIds, permissionKeys, at);
	if (configured !== null) return configured;
	return evaluatePermissionCeiling(db, actor, permissionKeys, at);
}

/**
 * Explains which organisation access roles an already-authorised action may
 * delegate. The decision remains identical to decideOrganisationRoleDelegation,
 * while the evidence identifies which access-control path produced that result.
 */
export async function explainOrganisationRoleDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationEvaluation> {
	const at = options.at ?? new Date();
	if (rolePublicIds.length === 0) {
		return evaluation({ allowed: true, deniedPermissionKeys: [] }, 'no-access-change', at);
	}
	const permissionKeys = await new OrganisationRoleRepository(db).listPermissionKeysForActiveRoles(
		actor.organisationId,
		rolePublicIds
	);
	return evaluateRoleAndPermissionDelegation(db, actor, rolePublicIds, permissionKeys, at);
}

/**
 * Governs which organisation access roles an already-authorised action may
 * delegate. Action authority remains the responsibility of the calling service.
 *
 * A configured delegated-authority policy is fail-closed: before activation and
 * after expiry, delegation is denied until an Owner changes or removes the policy.
 * The policy constrains both stable standard role keys and every permission
 * carried by the requested roles. It does not grant runtime permissions itself.
 */
export async function decideOrganisationRoleDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicIds: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationDecision> {
	return (await explainOrganisationRoleDelegation(db, actor, rolePublicIds, options)).decision;
}

/**
 * Explains the delegation ceiling applied to a proposed access-role definition.
 */
export async function explainOrganisationRoleDefinitionDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicId: string,
	permissionKeys: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationEvaluation> {
	return evaluateRoleAndPermissionDelegation(
		db,
		actor,
		[rolePublicId],
		permissionKeys,
		options.at ?? new Date()
	);
}

/**
 * Applies the same delegation ceiling to a proposed role definition. This
 * prevents a restricted administrator from bypassing the assignment ceiling by
 * first widening a role's permission grants and then assigning that role.
 */
export async function decideOrganisationRoleDefinitionDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	rolePublicId: string,
	permissionKeys: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationDecision> {
	return (
		await explainOrganisationRoleDefinitionDelegation(
			db,
			actor,
			rolePublicId,
			permissionKeys,
			options
		)
	).decision;
}

/**
 * Explains the delegation ceiling applied while defining a new custom role.
 */
export async function explainOrganisationPermissionDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	permissionKeys: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationEvaluation> {
	const at = options.at ?? new Date();
	if (await hasActiveOwnerRole(db, actor, at)) {
		return evaluation({ allowed: true, deniedPermissionKeys: [] }, 'active-owner', at);
	}
	const configured = await configuredPolicyEvaluation(db, actor, [], permissionKeys, at);
	if (configured !== null) return configured;
	return evaluatePermissionCeiling(db, actor, permissionKeys, at);
}

/**
 * Applies a configured permission ceiling to creation of a new custom access
 * role, where no stable role identity exists yet.
 */
export async function decideOrganisationPermissionDelegation(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	permissionKeys: readonly string[],
	options: RoleDelegationOptions = {}
): Promise<RoleDelegationDecision> {
	return (await explainOrganisationPermissionDelegation(db, actor, permissionKeys, options))
		.decision;
}
