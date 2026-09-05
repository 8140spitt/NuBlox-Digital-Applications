import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import {
	STANDARD_ACCESS_ROLE_TEMPLATE_KEY,
	type StandardAccessRoleKey
} from './standard-access-roles';

export type AccessConflictSubject =
	{ kind: 'standard_role'; key: StandardAccessRoleKey } | { kind: 'permission'; key: string };

export type AccessConflictPolicy = {
	policyKey: string;
	name: string;
	description: string;
	action: 'deny';
	left: AccessConflictSubject;
	right: AccessConflictSubject;
};

export type AccessConflictViolation = AccessConflictPolicy;

const readOnlyRole: AccessConflictSubject = { kind: 'standard_role', key: 'read-only' };

function roleConflict(roleKey: StandardAccessRoleKey, name: string): AccessConflictPolicy {
	return {
		policyKey: `read-only.exclusive.${roleKey}`,
		name: `Read Only cannot be combined with ${name}`,
		description:
			'The Read Only standard access role is an exclusive least-privilege posture and cannot be combined with a more privileged standard access role.',
		action: 'deny',
		left: readOnlyRole,
		right: { kind: 'standard_role', key: roleKey }
	};
}

export const SYSTEM_ACCESS_CONFLICT_POLICIES: readonly AccessConflictPolicy[] = [
	roleConflict('owner', 'Owner'),
	roleConflict('administrator', 'Administrator'),
	roleConflict('manager', 'Manager'),
	roleConflict('finance-commercial', 'Finance/Commercial'),
	roleConflict('member-professional', 'Member/Professional'),
	roleConflict('field-worker', 'Field Worker'),
	{
		policyKey: 'read-only.permission.organisation-manage',
		name: 'Read Only cannot administer the organisation',
		description:
			'A member holding the Read Only standard access role cannot simultaneously hold organisation.manage.',
		action: 'deny',
		left: readOnlyRole,
		right: { kind: 'permission', key: 'organisation.manage' }
	},
	{
		policyKey: 'read-only.permission.finance-manage',
		name: 'Read Only cannot administer finance',
		description:
			'A member holding the Read Only standard access role cannot simultaneously hold finance.manage.',
		action: 'deny',
		left: readOnlyRole,
		right: { kind: 'permission', key: 'finance.manage' }
	}
];

function subjectPresent(
	subject: AccessConflictSubject,
	roleKeys: ReadonlySet<string>,
	permissionKeys: ReadonlySet<string>
): boolean {
	return subject.kind === 'standard_role'
		? roleKeys.has(subject.key)
		: permissionKeys.has(subject.key);
}

export async function evaluateMemberAccessConflicts(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	options: { at?: Date } = {}
): Promise<AccessConflictViolation[]> {
	const at = options.at ?? new Date();
	const roleRows = await db
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
				.onRef('binding.organisation_role_id', '=', 'assignment.organisation_role_id')
				.onRef('binding.organisation_id', '=', 'assignment.organisation_id')
		)
		.select('binding.role_key as roleKey')
		.where('assignment.organisation_id', '=', actor.organisationId)
		.where('assignment.organisation_member_id', '=', actor.memberId)
		.where('binding.template_key', '=', STANDARD_ACCESS_ROLE_TEMPLATE_KEY)
		.where('role.is_active', '=', 1)
		.where((eb) =>
			eb.or([eb('window.effective_from', 'is', null), eb('window.effective_from', '<=', at)])
		)
		.where((eb) => eb.or([eb('window.expires_at', 'is', null), eb('window.expires_at', '>', at)]))
		.execute();
	const roleKeys = new Set(roleRows.map((row) => row.roleKey));

	const referencedPermissionKeys = [
		...new Set(
			SYSTEM_ACCESS_CONFLICT_POLICIES.flatMap((policy) =>
				[policy.left, policy.right]
					.filter(
						(subject): subject is Extract<AccessConflictSubject, { kind: 'permission' }> =>
							subject.kind === 'permission'
					)
					.map((subject) => subject.key)
			)
		)
	];
	const decisions = await new PermissionService(db).decideMany(actor, referencedPermissionKeys, {
		at
	});
	const allowedPermissionKeys = new Set(
		referencedPermissionKeys.filter(
			(permissionKey) => decisions.get(permissionKey)?.allowed === true
		)
	);

	return SYSTEM_ACCESS_CONFLICT_POLICIES.filter(
		(policy) =>
			subjectPresent(policy.left, roleKeys, allowedPermissionKeys) &&
			subjectPresent(policy.right, roleKeys, allowedPermissionKeys)
	);
}

export async function listMemberAccessConflictEvaluationInstants(
	db: DatabaseExecutor,
	actor: TenantActorContext,
	now = new Date()
): Promise<Date[]> {
	const [roleWindows, overrideWindows] = await Promise.all([
		db
			.selectFrom('member_role_access_windows')
			.select(['effective_from', 'expires_at'])
			.where('organisation_id', '=', actor.organisationId)
			.where('organisation_member_id', '=', actor.memberId)
			.execute(),
		db
			.selectFrom('member_permission_override_access_windows')
			.select(['effective_from', 'expires_at'])
			.where('organisation_id', '=', actor.organisationId)
			.where('organisation_member_id', '=', actor.memberId)
			.execute()
	]);

	const instants = new Map<number, Date>([[now.getTime(), now]]);
	const addInstant = (value: Date | null) => {
		if (value !== null && value.getTime() >= now.getTime()) {
			instants.set(value.getTime(), value);
		}
	};
	for (const window of [...roleWindows, ...overrideWindows]) {
		addInstant(window.effective_from);
		addInstant(window.expires_at);
	}

	return [...instants.values()].sort((left, right) => left.getTime() - right.getTime());
}

export function accessConflictViolationMessage(
	violations: readonly AccessConflictViolation[]
): string {
	if (violations.length === 0) return '';
	return `Access conflict policy prohibits this change: ${violations.map((violation) => violation.name).join('; ')}.`;
}
