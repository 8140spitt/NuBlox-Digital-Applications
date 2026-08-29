import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	accessConflictViolationMessage,
	evaluateMemberAccessConflicts
} from './access-conflict-policy';
import { OrganisationMembershipRepository } from './membership-repository';
import {
	MemberPermissionOverrideRepository,
	type MemberPermissionOverrideEffect
} from './member-permission-override-repository';
import { OrganisationRepository } from './organisation-repository';

export class MemberPermissionOverrideValidationError extends Error {
	readonly code = 'MEMBER_PERMISSION_OVERRIDE_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'MemberPermissionOverrideValidationError';
	}
}

export class MemberPermissionOverrideNotFoundError extends Error {
	readonly code = 'MEMBER_PERMISSION_OVERRIDE_NOT_FOUND';

	constructor(message: string) {
		super(message);
		this.name = 'MemberPermissionOverrideNotFoundError';
	}
}

function validateEffect(value: string): MemberPermissionOverrideEffect {
	if (value === 'allow' || value === 'deny') return value;
	throw new MemberPermissionOverrideValidationError('Override effect must be allow or deny.');
}

function validatePermissionKey(value: string): string {
	const permissionKey = value.trim();
	if (!permissionKey || permissionKey.length > 160) {
		throw new MemberPermissionOverrideValidationError('A valid permission key is required.');
	}
	return permissionKey;
}

function validateReason(value: string): string {
	const reason = value.trim();
	if (!reason || reason.length > 500) {
		throw new MemberPermissionOverrideValidationError(
			'An override reason between 1 and 500 characters is required.'
		);
	}
	return reason;
}

function optionalUtcInstant(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const normalised = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? `${text}:00.000Z` : text;
	const instant = new Date(normalised);
	if (Number.isNaN(instant.getTime())) {
		throw new MemberPermissionOverrideValidationError(
			`${label} must be a valid UTC date and time.`
		);
	}
	return instant;
}

function accessWindow(input: { effectiveFrom?: string | null; expiresAt?: string | null }): {
	effectiveFrom: Date | null;
	expiresAt: Date | null;
} {
	const effectiveFrom = optionalUtcInstant(input.effectiveFrom, 'Effective from');
	const expiresAt = optionalUtcInstant(input.expiresAt, 'Expiry');
	if (effectiveFrom && expiresAt && effectiveFrom >= expiresAt) {
		throw new MemberPermissionOverrideValidationError('Expiry must be later than effective from.');
	}
	if (expiresAt && expiresAt <= new Date()) {
		throw new MemberPermissionOverrideValidationError('Expiry must be in the future.');
	}
	return { effectiveFrom, expiresAt };
}

function sameInstant(left: Date | null, right: Date | null): boolean {
	return left?.getTime() === right?.getTime();
}

function serialiseWindow(effectiveFrom: Date | null, expiresAt: Date | null) {
	return {
		effectiveFrom: effectiveFrom?.toISOString() ?? null,
		expiresAt: expiresAt?.toISOString() ?? null
	};
}

function conflictEvaluationInstants(
	effectiveFrom: Date | null,
	expiresAt: Date | null,
	now = new Date()
): Date[] {
	const byTime = new Map<number, Date>([[now.getTime(), now]]);
	if (effectiveFrom) byTime.set(effectiveFrom.getTime(), effectiveFrom);
	if (expiresAt) byTime.set(expiresAt.getTime(), expiresAt);
	return [...byTime.values()].sort((left, right) => left.getTime() - right.getTime());
}

export class MemberPermissionOverrideService {
	constructor(private readonly db: Database = getDatabase()) {}

	async load(actor: TenantActorContext) {
		await this.requireOrganisationManager(this.db, actor);
		const organisation = await new OrganisationRepository(this.db).findActiveById(
			actor.organisationId
		);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

		const repository = new MemberPermissionOverrideRepository(this.db);
		const [members, permissions, overrides] = await Promise.all([
			repository.listMembers(actor.organisationId),
			repository.listActivePermissions(),
			repository.listOverrides(actor.organisationId)
		]);
		return { organisation, members, permissions, overrides };
	}

	async setOverride(
		actor: TenantActorContext,
		input: {
			memberPublicId: string;
			permissionKey: string;
			effect: string;
			reason: string;
			effectiveFrom?: string | null;
			expiresAt?: string | null;
		}
	): Promise<void> {
		const memberPublicId = input.memberPublicId.trim();
		if (!memberPublicId) {
			throw new MemberPermissionOverrideValidationError('Organisation member is required.');
		}
		const permissionKey = validatePermissionKey(input.permissionKey);
		const effect = validateEffect(input.effect);
		const reason = validateReason(input.reason);
		const window = accessWindow(input);

		await this.db.transaction().execute(async (trx) => {
			await this.requireOrganisationManager(trx, actor);
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new MemberPermissionOverrideRepository(trx);
			const member = await repository.findMemberForUpdate(actor.organisationId, memberPublicId);
			if (!member)
				throw new MemberPermissionOverrideNotFoundError('Organisation member not found.');
			if (member.id === actor.memberId) {
				throw new MemberPermissionOverrideValidationError(
					'You cannot change your own explicit permission overrides from this administration screen.'
				);
			}
			if (member.status !== 'active' && member.status !== 'suspended') {
				throw new MemberPermissionOverrideValidationError(
					'Explicit permission overrides can only be maintained for active or suspended members.'
				);
			}

			const permission = await repository.findActivePermission(permissionKey);
			if (!permission) {
				throw new MemberPermissionOverrideNotFoundError('Active permission not found.');
			}
			const existing = await repository.findOverrideForUpdate(
				actor.organisationId,
				member.id,
				permission.id
			);
			if (
				existing?.effect === effect &&
				existing.reason === reason &&
				sameInstant(existing.effectiveFrom, window.effectiveFrom) &&
				sameInstant(existing.expiresAt, window.expiresAt)
			) {
				return;
			}

			if (existing) {
				await repository.updateOverride({
					organisationId: actor.organisationId,
					memberId: member.id,
					permissionId: permission.id,
					effect,
					reason
				});
			} else {
				await repository.createOverride({
					organisationId: actor.organisationId,
					memberId: member.id,
					permissionId: permission.id,
					effect,
					reason
				});
			}
			await repository.replaceAccessWindow({
				organisationId: actor.organisationId,
				memberId: member.id,
				permissionId: permission.id,
				...window
			});
			await this.requireNoAccessConflicts(
				trx,
				actor,
				member,
				conflictEvaluationInstants(window.effectiveFrom, window.expiresAt)
			);

			if (permissionKey === 'organisation.manage' && member.status === 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
				if (window.effectiveFrom) {
					await this.requireActiveOrganisationManager(trx, actor, window.effectiveFrom);
				}
				if (window.expiresAt) {
					await this.requireActiveOrganisationManager(trx, actor, window.expiresAt);
				}
			}

			const change = {
				memberPublicId: member.publicId,
				permissionKey,
				from: existing
					? {
							effect: existing.effect,
							reason: existing.reason,
							...serialiseWindow(existing.effectiveFrom, existing.expiresAt)
						}
					: null,
				to: { effect, reason, ...serialiseWindow(window.effectiveFrom, window.expiresAt) }
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.member.permission_override.set',
				subjectType: 'organisation_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.member.permission-override.changed',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: change,
				correlationId: actor.correlationId
			});
		});
	}

	async removeOverride(
		actor: TenantActorContext,
		input: { memberPublicId: string; permissionKey: string }
	): Promise<void> {
		const memberPublicId = input.memberPublicId.trim();
		if (!memberPublicId) {
			throw new MemberPermissionOverrideValidationError('Organisation member is required.');
		}
		const permissionKey = validatePermissionKey(input.permissionKey);

		await this.db.transaction().execute(async (trx) => {
			await this.requireOrganisationManager(trx, actor);
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new MemberPermissionOverrideRepository(trx);
			const member = await repository.findMemberForUpdate(actor.organisationId, memberPublicId);
			if (!member)
				throw new MemberPermissionOverrideNotFoundError('Organisation member not found.');
			if (member.id === actor.memberId) {
				throw new MemberPermissionOverrideValidationError(
					'You cannot change your own explicit permission overrides from this administration screen.'
				);
			}

			const permission = await repository.findActivePermission(permissionKey);
			if (!permission) {
				throw new MemberPermissionOverrideNotFoundError('Active permission not found.');
			}
			const existing = await repository.findOverrideForUpdate(
				actor.organisationId,
				member.id,
				permission.id
			);
			if (!existing)
				throw new MemberPermissionOverrideNotFoundError('Permission override not found.');

			await repository.deleteOverride(actor.organisationId, member.id, permission.id);
			await this.requireNoAccessConflicts(trx, actor, member, [new Date()]);
			if (permissionKey === 'organisation.manage' && member.status === 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
			}

			const change = {
				memberPublicId: member.publicId,
				permissionKey,
				from: {
					effect: existing.effect,
					reason: existing.reason,
					...serialiseWindow(existing.effectiveFrom, existing.expiresAt)
				},
				to: null
			};
			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.member.permission_override.remove',
				subjectType: 'organisation_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: change
			});
			await enqueueOutboxEvent(trx, {
				organisationId: actor.organisationId,
				topic: 'organisation.member.permission-override.changed',
				aggregateType: 'organisation',
				aggregatePublicId: organisation.publicId,
				payload: change,
				correlationId: actor.correlationId
			});
		});
	}

	private async requireOrganisationManager(
		executor: DatabaseExecutor,
		actor: TenantActorContext
	): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			executor
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(executor).decide(actor, 'organisation.manage');
		if (!decision.allowed) {
			throw new TenantAccessError('Organisation permission override management is not permitted.');
		}
	}

	private async requireNoAccessConflicts(
		executor: DatabaseExecutor,
		actor: TenantActorContext,
		member: { id: string; userId: string },
		instants: readonly Date[]
	): Promise<void> {
		for (const at of instants) {
			const violations = await evaluateMemberAccessConflicts(
				executor,
				{
					organisationId: actor.organisationId,
					userId: member.userId,
					memberId: member.id,
					correlationId: actor.correlationId
				},
				{ at }
			);
			if (violations.length > 0) {
				throw new MemberPermissionOverrideValidationError(
					accessConflictViolationMessage(violations)
				);
			}
		}
	}

	private async requireActiveOrganisationManager(
		executor: DatabaseExecutor,
		actor: TenantActorContext,
		at = new Date()
	): Promise<void> {
		const repository = new MemberPermissionOverrideRepository(executor);
		const activeMembers = await repository.listActiveMembersForPermissionCheck(
			actor.organisationId
		);
		for (const member of activeMembers) {
			const decision = await new PermissionService(executor).decide(
				{
					organisationId: actor.organisationId,
					userId: member.userId,
					memberId: member.id,
					correlationId: actor.correlationId
				},
				'organisation.manage',
				{ at }
			);
			if (decision.allowed) return;
		}
		throw new MemberPermissionOverrideValidationError(
			'This change would leave the organisation without an active organisation manager.'
		);
	}
}
