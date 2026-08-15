import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import type { Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { getEmailDelivery, type EmailDelivery } from '$lib/server/email/email-delivery';
import { OrganisationInvitationService, type InvitationSummary } from './invitation-service';
import {
	OrganisationAdminRepository,
	type OrganisationMemberStatus
} from './organisation-admin-repository';

export class OrganisationAdminValidationError extends Error {
	readonly code = 'ORGANISATION_ADMIN_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'OrganisationAdminValidationError';
	}
}

export class OrganisationAdminNotFoundError extends Error {
	readonly code = 'ORGANISATION_ADMIN_NOT_FOUND';
	constructor(message: string) {
		super(message);
		this.name = 'OrganisationAdminNotFoundError';
	}
}

export class LastOrganisationManagerError extends Error {
	readonly code = 'LAST_ORGANISATION_MANAGER';
	constructor() {
		super('This change would leave the organisation without an active organisation manager.');
		this.name = 'LastOrganisationManagerError';
	}
}

const STATUS_TRANSITIONS: Record<OrganisationMemberStatus, ReadonlySet<OrganisationMemberStatus>> = {
	invited: new Set(['active', 'disabled']),
	active: new Set(['suspended', 'disabled', 'left']),
	suspended: new Set(['active', 'disabled', 'left']),
	disabled: new Set(['active', 'suspended', 'left']),
	left: new Set(['active'])
};

function uniqueStrings(values: readonly string[], maximum: number, label: string): string[] {
	const result = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
	if (result.length > maximum) {
		throw new OrganisationAdminValidationError(`Too many ${label} were supplied.`);
	}
	return result;
}

function roleName(value: string): string {
	const name = value.trim();
	if (!name || name.length > 160) {
		throw new OrganisationAdminValidationError('Role name must be between 1 and 160 characters.');
	}
	return name;
}

function roleDescription(value: string | null | undefined): string | null {
	const description = value?.trim() ?? '';
	if (description.length > 4000) {
		throw new OrganisationAdminValidationError('Role description must not exceed 4000 characters.');
	}
	return description || null;
}

export class OrganisationAdminService {
	constructor(private readonly db: Database) {}

	async load(actor: TenantActorContext) {
		const repository = new OrganisationAdminRepository(this.db);
		const [members, invitations, roles, permissions] = await Promise.all([
			repository.listMembers(actor.organisationId),
			repository.listInvitations(actor.organisationId),
			repository.listRoles(actor.organisationId),
			repository.listActivePermissions()
		]);
		return { members, invitations, roles, permissions };
	}

	async setMemberStatus(
		actor: TenantActorContext,
		memberPublicId: string,
		nextStatus: OrganisationMemberStatus
	): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationAdminRepository(trx);
			const member = await repository.findMemberForUpdate(actor.organisationId, memberPublicId);
			if (!member) throw new OrganisationAdminNotFoundError('Organisation member not found.');
			if (member.id === actor.memberId && member.status !== nextStatus) {
				throw new OrganisationAdminValidationError(
					'You cannot change your own organisation membership status from this administration screen.'
				);
			}
			if (member.status === nextStatus) return;
			if (!STATUS_TRANSITIONS[member.status].has(nextStatus)) {
				throw new OrganisationAdminValidationError(
					`Membership cannot move from ${member.status} to ${nextStatus}.`
				);
			}

			const targetWasManager =
				member.status === 'active' &&
				(await this.memberHasOrganisationManage(
					trx,
					actor.organisationId,
					member.userId,
					member.id,
					actor.correlationId
				));

			const updated = await repository.updateMemberStatus(
				actor.organisationId,
				member.id,
				member.status,
				nextStatus,
				member.joinedAt
			);
			if (!updated) {
				throw new OrganisationAdminValidationError('Membership changed concurrently; reload and try again.');
			}

			if (targetWasManager && nextStatus !== 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
			}

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.member.status.change',
				subjectType: 'organisation_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: { from: member.status, to: nextStatus }
			});
		});
	}

	async replaceMemberRoles(
		actor: TenantActorContext,
		memberPublicId: string,
		rolePublicIdsInput: readonly string[]
	): Promise<void> {
		const rolePublicIds = uniqueStrings(rolePublicIdsInput, 50, 'roles');
		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationAdminRepository(trx);
			const member = await repository.findMemberForUpdate(actor.organisationId, memberPublicId);
			if (!member) throw new OrganisationAdminNotFoundError('Organisation member not found.');
			if (member.id === actor.memberId) {
				throw new OrganisationAdminValidationError(
					'You cannot change your own organisation roles from this administration screen.'
				);
			}

			const targetWasManager =
				member.status === 'active' &&
				(await this.memberHasOrganisationManage(
					trx,
					actor.organisationId,
					member.userId,
					member.id,
					actor.correlationId
				));
			const roleIds = await repository.findActiveRoleIdsByPublicIds(
				actor.organisationId,
				rolePublicIds
			);
			if (roleIds.length !== rolePublicIds.length) {
				throw new OrganisationAdminValidationError(
					'One or more selected roles are not active roles in this organisation.'
				);
			}

			await repository.replaceMemberRoles(actor.organisationId, member.id, roleIds);
			if (targetWasManager && member.status === 'active') {
				await this.requireActiveOrganisationManager(trx, actor);
			}

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.member.roles.replace',
				subjectType: 'organisation_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: { rolePublicIds }
			});
		});
	}

	async createRole(
		actor: TenantActorContext,
		input: { name: string; description?: string | null; permissionKeys: readonly string[] }
	): Promise<string> {
		const name = roleName(input.name);
		const description = roleDescription(input.description);
		const permissionKeys = uniqueStrings(input.permissionKeys, 250, 'permissions');
		const publicId = randomUUID();

		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationAdminRepository(trx);
			const existingRoles = await repository.listRoles(actor.organisationId);
			if (existingRoles.some((role) => role.name.trim().toLowerCase() === name.toLowerCase())) {
				throw new OrganisationAdminValidationError('A role with this name already exists.');
			}
			const permissionIds = await repository.findActivePermissionIdsByKeys(permissionKeys);
			if (permissionIds.length !== permissionKeys.length) {
				throw new OrganisationAdminValidationError('One or more permissions are not active.');
			}

			const roleId = await repository.createRole({
				organisationId: actor.organisationId,
				publicId,
				name,
				description
			});
			await repository.replaceRolePermissions(actor.organisationId, roleId, permissionIds);

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.role.create',
				subjectType: 'organisation_role',
				subjectPublicId: publicId,
				correlationId: actor.correlationId,
				changeSummary: { name, permissionKeys }
			});
		});

		return publicId;
	}

	async updateRole(
		actor: TenantActorContext,
		input: {
			rolePublicId: string;
			name: string;
			description?: string | null;
			isActive: boolean;
			permissionKeys: readonly string[];
		}
	): Promise<void> {
		const name = roleName(input.name);
		const description = roleDescription(input.description);
		const permissionKeys = uniqueStrings(input.permissionKeys, 250, 'permissions');

		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationAdminRepository(trx);
			const role = await repository.findRoleForUpdate(actor.organisationId, input.rolePublicId);
			if (!role) throw new OrganisationAdminNotFoundError('Organisation role not found.');

			const currentRoles = await repository.listRoles(actor.organisationId);
			if (
				currentRoles.some(
					(candidate) =>
						candidate.publicId !== role.publicId &&
						candidate.name.trim().toLowerCase() === name.toLowerCase()
				)
			) {
				throw new OrganisationAdminValidationError('A role with this name already exists.');
			}
			const currentRole = currentRoles.find((candidate) => candidate.publicId === role.publicId);
			const couldRemoveManagerGrant =
				role.isActive &&
				Boolean(currentRole?.permissionKeys.includes('organisation.manage')) &&
				(!input.isActive || !permissionKeys.includes('organisation.manage'));

			const permissionIds = await repository.findActivePermissionIdsByKeys(permissionKeys);
			if (permissionIds.length !== permissionKeys.length) {
				throw new OrganisationAdminValidationError('One or more permissions are not active.');
			}

			await repository.updateRole({
				organisationId: actor.organisationId,
				roleId: role.id,
				name,
				description,
				isActive: input.isActive
			});
			await repository.replaceRolePermissions(actor.organisationId, role.id, permissionIds);

			if (couldRemoveManagerGrant) await this.requireActiveOrganisationManager(trx, actor);

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.role.update',
				subjectType: 'organisation_role',
				subjectPublicId: role.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					name,
					isActive: input.isActive,
					permissionKeys
				}
			});
		});
	}

	async revokeInvitation(actor: TenantActorContext, invitationPublicId: string): Promise<void> {
		await this.db.transaction().execute(async (trx) => {
			const repository = new OrganisationAdminRepository(trx);
			const invitation = await repository.findInvitationForUpdate(
				actor.organisationId,
				invitationPublicId
			);
			if (!invitation) throw new OrganisationAdminNotFoundError('Invitation not found.');
			if (invitation.status !== 'pending' && invitation.status !== 'expired') {
				throw new OrganisationAdminValidationError('Only pending or expired invitations can be revoked.');
			}
			if (!(await repository.revokeInvitation(actor.organisationId, invitation.id))) {
				throw new OrganisationAdminValidationError('Invitation changed concurrently; reload and try again.');
			}

			await new AuditRepository(trx).append({
				eventPublicId: randomUUID(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				actionKey: 'organisation.invitation.revoke',
				subjectType: 'organisation_invitation',
				subjectPublicId: invitation.publicId,
				correlationId: actor.correlationId,
				changeSummary: { email: invitation.email }
			});
		});
	}

	async resendInvitation(
		actor: TenantActorContext,
		invitationPublicId: string,
		emailDelivery?: EmailDelivery
	): Promise<InvitationSummary> {
		const source = await this.db.transaction().execute(async (trx) => {
			const invitation = await new OrganisationAdminRepository(trx).findInvitationForUpdate(
				actor.organisationId,
				invitationPublicId
			);
			if (!invitation) throw new OrganisationAdminNotFoundError('Invitation not found.');
			if (invitation.status !== 'pending' && invitation.status !== 'expired') {
				throw new OrganisationAdminValidationError('Only pending or expired invitations can be resent.');
			}
			return invitation;
		});

		const invitation = await new OrganisationInvitationService(
			this.db,
			emailDelivery ?? getEmailDelivery()
		).createInvitation({
			actor,
			email: source.email,
			rolePublicIds: source.rolePublicIds
		});

		await new AuditRepository(this.db).append({
			eventPublicId: randomUUID(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			actionKey: 'organisation.invitation.resend',
			subjectType: 'organisation_invitation',
			subjectPublicId: source.publicId,
			correlationId: actor.correlationId,
			changeSummary: { replacementInvitationPublicId: invitation.publicId, email: source.email }
		});

		return invitation;
	}

	private async memberHasOrganisationManage(
		executor: DatabaseExecutor,
		organisationId: string,
		userId: string,
		memberId: string,
		correlationId: string
	): Promise<boolean> {
		const decision = await new PermissionService(executor).decide(
			{ organisationId, userId, memberId, correlationId },
			'organisation.manage'
		);
		return decision.allowed;
	}

	private async requireActiveOrganisationManager(
		executor: DatabaseExecutor,
		actor: TenantActorContext
	): Promise<void> {
		const activeMembers = await new OrganisationAdminRepository(
			executor
		).listActiveMembersForPermissionCheck(actor.organisationId);
		for (const member of activeMembers) {
			if (
				await this.memberHasOrganisationManage(
					executor,
					actor.organisationId,
					member.userId,
					member.id,
					actor.correlationId
				)
			) {
				return;
			}
		}
		throw new LastOrganisationManagerError();
	}
}
