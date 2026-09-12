import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { hasActiveOwnerRole } from './role-delegation-policy';
import {
	ensureStandardAccessRoleBindings,
	OWNER_ACCESS_ROLE_KEY,
	STANDARD_ACCESS_ROLE_KEYS,
	type StandardAccessRoleKey
} from './standard-access-roles';

export type DelegatedAccessAuthorityPolicy = {
	publicId: string;
	memberPublicId: string;
	effectiveFrom: Date | null;
	expiresAt: Date | null;
	reason: string;
	allowedRoleKeys: StandardAccessRoleKey[];
	allowedPermissionKeys: string[];
};

export class DelegatedAccessAuthorityValidationError extends Error {
	readonly code = 'DELEGATED_ACCESS_AUTHORITY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'DelegatedAccessAuthorityValidationError';
	}
}

export class DelegatedAccessAuthorityAuthorisationError extends Error {
	readonly code = 'DELEGATED_ACCESS_AUTHORITY_FORBIDDEN';
	constructor() {
		super('Only an active Owner can administer delegated access authority policies.');
		this.name = 'DelegatedAccessAuthorityAuthorisationError';
	}
}

export class DelegatedAccessAuthorityNotFoundError extends Error {
	readonly code = 'DELEGATED_ACCESS_AUTHORITY_NOT_FOUND';
	constructor(message: string) {
		super(message);
		this.name = 'DelegatedAccessAuthorityNotFoundError';
	}
}

function uniqueStrings(values: readonly string[], maximum: number, label: string): string[] {
	const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
	if (result.length > maximum) {
		throw new DelegatedAccessAuthorityValidationError(`Too many ${label} were supplied.`);
	}
	return result;
}

function roleKeys(values: readonly string[]): StandardAccessRoleKey[] {
	const unique = uniqueStrings(values, STANDARD_ACCESS_ROLE_KEYS.length, 'standard access roles');
	return unique.map((value) => {
		if (
			!STANDARD_ACCESS_ROLE_KEYS.includes(value as StandardAccessRoleKey) ||
			value === OWNER_ACCESS_ROLE_KEY
		) {
			throw new DelegatedAccessAuthorityValidationError(
				`Delegated authority cannot include unsupported or Owner role key: ${value}.`
			);
		}
		return value as StandardAccessRoleKey;
	});
}

function policyReason(value: string): string {
	const reason = value.trim();
	if (!reason || reason.length > 500) {
		throw new DelegatedAccessAuthorityValidationError(
			'Delegated authority reason must be between 1 and 500 characters.'
		);
	}
	return reason;
}

function validateWindow(effectiveFrom: Date | null, expiresAt: Date | null, now: Date): void {
	if (effectiveFrom !== null && Number.isNaN(effectiveFrom.getTime())) {
		throw new DelegatedAccessAuthorityValidationError(
			'Delegated authority effective-from is invalid.'
		);
	}
	if (expiresAt !== null && Number.isNaN(expiresAt.getTime())) {
		throw new DelegatedAccessAuthorityValidationError('Delegated authority expiry is invalid.');
	}
	if (effectiveFrom !== null && expiresAt !== null && effectiveFrom >= expiresAt) {
		throw new DelegatedAccessAuthorityValidationError(
			'Delegated authority expiry must be later than its effective-from instant.'
		);
	}
	if (expiresAt !== null && expiresAt <= now) {
		throw new DelegatedAccessAuthorityValidationError(
			'Delegated authority expiry must be in the future when the policy is set.'
		);
	}
}

export class DelegatedAccessAuthorityService {
	constructor(private readonly db: Database) {}

	async getPolicy(
		actor: TenantActorContext,
		memberPublicId: string
	): Promise<DelegatedAccessAuthorityPolicy | null> {
		const now = new Date();
		await this.requireOwner(this.db, actor, now);
		const member = await this.db
			.selectFrom('organisation_members')
			.select(['id', 'public_id'])
			.where('organisation_id', '=', actor.organisationId)
			.where('public_id', '=', memberPublicId)
			.executeTakeFirst();
		if (!member) throw new DelegatedAccessAuthorityNotFoundError('Organisation member not found.');

		const policy = await this.db
			.selectFrom('organisation_delegation_policies')
			.select(['id', 'public_id', 'effective_from', 'expires_at', 'reason'])
			.where('organisation_id', '=', actor.organisationId)
			.where('organisation_member_id', '=', member.id)
			.executeTakeFirst();
		if (!policy) return null;

		const [roles, permissions] = await Promise.all([
			this.db
				.selectFrom('organisation_delegation_role_grants')
				.select('role_key')
				.where('policy_id', '=', policy.id)
				.orderBy('role_key', 'asc')
				.execute(),
			this.db
				.selectFrom('organisation_delegation_permission_grants as grant')
				.innerJoin('permissions as permission', 'permission.id', 'grant.permission_id')
				.select('permission.permission_key as permissionKey')
				.where('grant.policy_id', '=', policy.id)
				.orderBy('permission.permission_key', 'asc')
				.execute()
		]);

		return {
			publicId: policy.public_id,
			memberPublicId: member.public_id,
			effectiveFrom: policy.effective_from,
			expiresAt: policy.expires_at,
			reason: policy.reason,
			allowedRoleKeys: roles.map((role) => role.role_key as StandardAccessRoleKey),
			allowedPermissionKeys: permissions.map((permission) => permission.permissionKey)
		};
	}

	async setPolicy(
		actor: TenantActorContext,
		memberPublicId: string,
		input: {
			allowedRoleKeys: readonly string[];
			allowedPermissionKeys: readonly string[];
			effectiveFrom?: Date | null;
			expiresAt?: Date | null;
			reason: string;
		}
	): Promise<string> {
		const allowedRoleKeys = roleKeys(input.allowedRoleKeys);
		const allowedPermissionKeys = uniqueStrings(
			input.allowedPermissionKeys,
			250,
			'permission grants'
		);
		const reason = policyReason(input.reason);
		const effectiveFrom = input.effectiveFrom ?? null;
		const expiresAt = input.expiresAt ?? null;
		const now = new Date();
		validateWindow(effectiveFrom, expiresAt, now);

		return this.db.transaction().execute(async (trx) => {
			await this.requireOwner(trx, actor, now);
			await ensureStandardAccessRoleBindings(trx, actor.organisationId);

			const member = await trx
				.selectFrom('organisation_members')
				.select(['id', 'public_id', 'user_id', 'status'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', memberPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!member)
				throw new DelegatedAccessAuthorityNotFoundError('Organisation member not found.');
			if (member.status !== 'active') {
				throw new DelegatedAccessAuthorityValidationError(
					'Delegated authority can only be configured for an active organisation member.'
				);
			}
			if (
				await hasActiveOwnerRole(
					trx,
					{
						organisationId: actor.organisationId,
						userId: member.user_id,
						memberId: member.id,
						correlationId: actor.correlationId
					},
					now
				)
			) {
				throw new DelegatedAccessAuthorityValidationError(
					'Owner authority is sovereign and cannot be restricted by a delegated authority policy.'
				);
			}

			const permissionRows =
				allowedPermissionKeys.length === 0
					? []
					: await trx
							.selectFrom('permissions')
							.select(['id', 'permission_key'])
							.where('permission_key', 'in', allowedPermissionKeys)
							.where('is_active', '=', 1)
							.execute();
			if (permissionRows.length !== allowedPermissionKeys.length) {
				throw new DelegatedAccessAuthorityValidationError(
					'One or more delegated permission grants are not active permissions.'
				);
			}

			const existing = await trx
				.selectFrom('organisation_delegation_policies')
				.select(['id', 'public_id'])
				.where('organisation_id', '=', actor.organisationId)
				.where('organisation_member_id', '=', member.id)
				.forUpdate()
				.executeTakeFirst();

			let policyId: string;
			let policyPublicId: string;
			if (existing) {
				policyId = existing.id;
				policyPublicId = existing.public_id;
				await trx
					.updateTable('organisation_delegation_policies')
					.set({ effective_from: effectiveFrom, expires_at: expiresAt, reason })
					.where('id', '=', existing.id)
					.executeTakeFirstOrThrow();
			} else {
				policyPublicId = randomUUID();
				const result = await trx
					.insertInto('organisation_delegation_policies')
					.values({
						public_id: policyPublicId,
						organisation_id: actor.organisationId,
						organisation_member_id: member.id,
						effective_from: effectiveFrom,
						expires_at: expiresAt,
						reason,
						created_by_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow();
				if (result.insertId === undefined) throw new Error('Expected delegation policy insert ID.');
				policyId = result.insertId.toString();
			}

			await trx
				.deleteFrom('organisation_delegation_role_grants')
				.where('policy_id', '=', policyId)
				.execute();
			await trx
				.deleteFrom('organisation_delegation_permission_grants')
				.where('policy_id', '=', policyId)
				.execute();
			if (allowedRoleKeys.length > 0) {
				await trx
					.insertInto('organisation_delegation_role_grants')
					.values(allowedRoleKeys.map((roleKey) => ({ policy_id: policyId, role_key: roleKey })))
					.execute();
			}
			if (permissionRows.length > 0) {
				await trx
					.insertInto('organisation_delegation_permission_grants')
					.values(
						permissionRows.map((permission) => ({
							policy_id: policyId,
							permission_id: permission.id
						}))
					)
					.execute();
			}

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.delegation-policy.set',
				subjectType: 'organisation_member',
				subjectPublicId: member.public_id,
				correlationId: actor.correlationId,
				changeSummary: {
					policyPublicId,
					allowedRoleKeys,
					allowedPermissionKeys,
					effectiveFrom: effectiveFrom?.toISOString() ?? null,
					expiresAt: expiresAt?.toISOString() ?? null,
					reason
				}
			});
			return policyPublicId;
		});
	}

	async removePolicy(actor: TenantActorContext, memberPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const now = new Date();
			await this.requireOwner(trx, actor, now);
			const member = await trx
				.selectFrom('organisation_members')
				.select(['id', 'public_id'])
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', memberPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!member)
				throw new DelegatedAccessAuthorityNotFoundError('Organisation member not found.');

			const policy = await trx
				.selectFrom('organisation_delegation_policies')
				.select(['id', 'public_id'])
				.where('organisation_id', '=', actor.organisationId)
				.where('organisation_member_id', '=', member.id)
				.forUpdate()
				.executeTakeFirst();
			if (!policy) {
				throw new DelegatedAccessAuthorityNotFoundError(
					'Delegated authority policy is not configured for this member.'
				);
			}

			await trx
				.deleteFrom('organisation_delegation_policies')
				.where('id', '=', policy.id)
				.execute();
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.delegation-policy.remove',
				subjectType: 'organisation_member',
				subjectPublicId: member.public_id,
				correlationId: actor.correlationId,
				changeSummary: { policyPublicId: policy.public_id }
			});
		});
	}

	private async requireOwner(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		at: Date
	): Promise<void> {
		if (!(await hasActiveOwnerRole(db, actor, at))) {
			throw new DelegatedAccessAuthorityAuthorisationError();
		}
	}
}
