import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export type PermissionDecision = {
	allowed: boolean;
	reason:
		| 'member-deny'
		| 'member-allow'
		| 'role-grant'
		| 'default-deny'
		| 'project-scope-deny';
};

export class PermissionService {
	constructor(private readonly db: DatabaseExecutor) {}

	async decideMany(
		actor: TenantActorContext,
		permissionKeysInput: readonly string[]
	): Promise<Map<string, PermissionDecision>> {
		const permissionKeys = [...new Set(permissionKeysInput.map((key) => key.trim()).filter(Boolean))];
		const decisions = new Map<string, PermissionDecision>();
		if (permissionKeys.length === 0) return decisions;

		const overrides = await this.db
			.selectFrom('member_permission_overrides as mpo')
			.innerJoin('permissions as p', 'p.id', 'mpo.permission_id')
			.select(['p.permission_key as permissionKey', 'mpo.effect as effect'])
			.where('mpo.organisation_id', '=', actor.organisationId)
			.where('mpo.organisation_member_id', '=', actor.memberId)
			.where('p.permission_key', 'in', permissionKeys)
			.where('p.is_active', '=', 1)
			.execute();
		const overrideByKey = new Map(overrides.map((row) => [row.permissionKey, row.effect]));

		const roleGrants = await this.db
			.selectFrom('member_roles as mr')
			.innerJoin('organisation_roles as role', (join) =>
				join
					.onRef('role.id', '=', 'mr.organisation_role_id')
					.onRef('role.organisation_id', '=', 'mr.organisation_id')
			)
			.innerJoin('role_permissions as rp', (join) =>
				join
					.onRef('rp.organisation_role_id', '=', 'mr.organisation_role_id')
					.onRef('rp.organisation_id', '=', 'mr.organisation_id')
			)
			.innerJoin('permissions as p', 'p.id', 'rp.permission_id')
			.select('p.permission_key as permissionKey')
			.where('mr.organisation_id', '=', actor.organisationId)
			.where('mr.organisation_member_id', '=', actor.memberId)
			.where('role.is_active', '=', 1)
			.where('p.is_active', '=', 1)
			.where('p.permission_key', 'in', permissionKeys)
			.execute();
		const roleGrantKeys = new Set(roleGrants.map((row) => row.permissionKey));

		for (const permissionKey of permissionKeys) {
			const override = overrideByKey.get(permissionKey);
			if (override === 'deny') {
				decisions.set(permissionKey, { allowed: false, reason: 'member-deny' });
			} else if (override === 'allow') {
				decisions.set(permissionKey, { allowed: true, reason: 'member-allow' });
			} else if (roleGrantKeys.has(permissionKey)) {
				decisions.set(permissionKey, { allowed: true, reason: 'role-grant' });
			} else {
				decisions.set(permissionKey, { allowed: false, reason: 'default-deny' });
			}
		}

		return decisions;
	}

	private async resolveOrganisationPermission(
		actor: TenantActorContext,
		permissionKey: string
	): Promise<PermissionDecision> {
		return (
			(await this.decideMany(actor, [permissionKey])).get(permissionKey) ?? {
				allowed: false,
				reason: 'default-deny'
			}
		);
	}

	private async hasActiveProjectScope(actor: TenantActorContext, projectId: string): Promise<boolean> {
		const row = await this.db
			.selectFrom('project_members as pm')
			.innerJoin('project_organisations as po', (join) =>
				join
					.onRef('po.project_id', '=', 'pm.project_id')
					.onRef('po.participant_organisation_id', '=', 'pm.participant_organisation_id')
			)
			.select('pm.project_id')
			.where('pm.project_id', '=', projectId)
			.where('pm.participant_organisation_id', '=', actor.organisationId)
			.where('pm.organisation_member_id', '=', actor.memberId)
			.where('pm.status', '=', 'active')
			.where('po.status', '=', 'active')
			.executeTakeFirst();

		return Boolean(row);
	}

	async decide(
		actor: TenantActorContext,
		permissionKey: string,
		options: { projectId?: string } = {}
	): Promise<PermissionDecision> {
		const organisationDecision = await this.resolveOrganisationPermission(actor, permissionKey);
		if (!organisationDecision.allowed) return organisationDecision;

		if (options.projectId) {
			const projectAllowed = await this.hasActiveProjectScope(actor, options.projectId);
			if (!projectAllowed) return { allowed: false, reason: 'project-scope-deny' };
		}

		return organisationDecision;
	}
}
