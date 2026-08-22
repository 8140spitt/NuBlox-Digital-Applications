import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { TenantAccessError } from '$lib/server/kernel/errors';
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
		}
	): Promise<void> {
		const memberPublicId = input.memberPublicId.trim();
		if (!memberPublicId) {
			throw new MemberPermissionOverrideValidationError('Organisation member is required.');
		}
		const permissionKey = validatePermissionKey(input.permissionKey);
		const effect = validateEffect(input.effect);
		const reason = validateReason(input.reason);

		await this.db.transaction().execute(async (trx) => {
			await this.requireOrganisationManager(trx, actor);
			const organisation = await new OrganisationRepository(trx).findActiveForUpdate(
				actor.organisationId
			);
			if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

			const repository = new MemberPermissionOverrideRepository(trx);
			const member = await repository.findMemberForUpdate(actor.organisationId, memberPublicId);
			if (!member) throw new MemberPermissionOverrideNotFoundError('Organisation member not found.');
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
			if (existing?.effect === effect && existing.reason === reason) return;

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

			if (permissionKey === 'organisation.manage' && member.status === 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
			}

			const change = {
				memberPublicId: member.publicId,
				permissionKey,
				from: existing ? { effect: existing.effect, reason: existing.reason } : null,
				to: { effect, reason }
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
			if (!member) throw new MemberPermissionOverrideNotFoundError('Organisation member not found.');
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
			if (!existing) throw new MemberPermissionOverrideNotFoundError('Permission override not found.');

			await repository.deleteOverride(actor.organisationId, member.id, permission.id);
			if (permissionKey === 'organisation.manage' && member.status === 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
			}

			const change = {
				memberPublicId: member.publicId,
				permissionKey,
				from: { effect: existing.effect, reason: existing.reason },
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
		const membership = await new OrganisationMembershipRepository(executor).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		const decision = await new PermissionService(executor).decide(actor, 'organisation.manage');
		if (!decision.allowed) {
			throw new TenantAccessError('Organisation permission override management is not permitted.');
		}
	}

	private async requireActiveOrganisationManager(
		executor: DatabaseExecutor,
		actor: TenantActorContext
	): Promise<void> {
		const repository = new MemberPermissionOverrideRepository(executor);
		const activeMembers = await repository.listActiveMembersForPermissionCheck(actor.organisationId);
		for (const member of activeMembers) {
			const decision = await new PermissionService(executor).decide(
				{
					organisationId: actor.organisationId,
					userId: member.userId,
					memberId: member.id,
					correlationId: actor.correlationId
				},
				'organisation.manage'
			);
			if (decision.allowed) return;
		}
		throw new MemberPermissionOverrideValidationError(
			'This change would leave the organisation without an active organisation manager.'
		);
	}
}
