import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from './project-repository';
import {
	ProjectTeamRepository,
	type OrganisationMemberProjectCandidate,
	type ProjectInvitationSummary,
	type ProjectMemberAdmin,
	type ProjectParticipantAdmin,
	type ProjectRoleTypeSummary
} from './project-team-repository';

const TERMINAL_COLLABORATION_PROJECT_STATUSES = new Set(['cancelled', 'archived']);
type ProjectCollaborationPermission =
	'project.participant.manage' | 'project.team.manage' | 'project.participation.manage';

export type ProjectTeamView = {
	canManageTeam: boolean;
	canManageParticipants: boolean;
	canLeaveParticipation: boolean;
	participants: ProjectParticipantAdmin[];
	teamMembers: ProjectMemberAdmin[];
	availableMembers: OrganisationMemberProjectCandidate[];
	roleTypes: ProjectRoleTypeSummary[];
	ownOrganisationPublicId: string | null;
};

export class ProjectTeamValidationError extends Error {
	readonly code = 'PROJECT_TEAM_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectTeamValidationError';
	}
}

function normalisePublicId(value: string, label: string): string {
	const publicId = value.trim();
	if (!publicId || publicId.length > 64) {
		throw new ProjectTeamValidationError(`${label} is required.`);
	}
	return publicId;
}

function normaliseRoleKeys(input: readonly string[], requireOne = false): string[] {
	const roleKeys = [...new Set(input.map((key) => key.trim()).filter(Boolean))];
	if (requireOne && roleKeys.length === 0) {
		throw new ProjectTeamValidationError('Select at least one project role.');
	}
	if (roleKeys.length > 12 || roleKeys.some((key) => !/^[a-z0-9_]{1,80}$/.test(key))) {
		throw new ProjectTeamValidationError('One or more project roles are invalid.');
	}
	return roleKeys;
}

function assertCollaborationCanGrow(project: ProjectRecord): void {
	if (TERMINAL_COLLABORATION_PROJECT_STATUSES.has(project.status)) {
		throw new ProjectTeamValidationError(
			'New project participation or team membership cannot be added to a cancelled or archived project.'
		);
	}
}

export class ProjectTeamService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async assertOrganisationPermission(
		actor: TenantActorContext,
		permissionKey: ProjectCollaborationPermission,
		db = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			permissionKey,
			'project.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('Project administration is not permitted.');
	}

	private async loadScopedProject(
		actor: TenantActorContext,
		projectPublicId: string,
		db = this.db,
		permissionKey: 'project.view' | ProjectCollaborationPermission = 'project.view'
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId
		);
		if (!project) throw new RecordNotFoundError('Project not found in the active member scope.');
		const permissionService = new PermissionService(db);
		const decision =
			permissionKey === 'project.view'
				? await permissionService.decide(actor, permissionKey, { projectId: project.id })
				: await permissionService.decideWithUmbrella(actor, permissionKey, 'project.manage', {
						projectId: project.id
					});
		if (!decision.allowed) {
			throw permissionKey === 'project.view'
				? new RecordNotFoundError('Project not found in the active member scope.')
				: new TenantAccessError('Project administration is not permitted.');
		}
		return project;
	}

	private async resolveRoleIds(
		repository: ProjectTeamRepository,
		roleKeysInput: readonly string[],
		requireOne = false
	): Promise<{ roleKeys: string[]; roleIds: string[] }> {
		const roleKeys = normaliseRoleKeys(roleKeysInput, requireOne);
		const roleIds = await repository.findActiveRoleTypeIdsByKeys(roleKeys);
		if (roleIds.length !== roleKeys.length) {
			throw new ProjectTeamValidationError('One or more project roles are unavailable.');
		}
		return { roleKeys, roleIds };
	}

	async listPendingInvitations(actor: TenantActorContext): Promise<ProjectInvitationSummary[]> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.participation.manage',
			'project.manage'
		);
		if (!decision.allowed) return [];
		return new ProjectTeamRepository(this.db).listPendingInvitations(actor.organisationId);
	}

	async getTeamView(actor: TenantActorContext, projectPublicId: string): Promise<ProjectTeamView> {
		await this.assertActiveActor(actor);
		const project = await this.loadScopedProject(actor, projectPublicId);
		const permissionService = new PermissionService(this.db);
		const [teamDecision, participantDecision, participationDecision] = await Promise.all([
			permissionService.decideWithUmbrella(actor, 'project.team.manage', 'project.manage', {
				projectId: project.id
			}),
			permissionService.decideWithUmbrella(actor, 'project.participant.manage', 'project.manage', {
				projectId: project.id
			}),
			permissionService.decideWithUmbrella(
				actor,
				'project.participation.manage',
				'project.manage',
				{ projectId: project.id }
			)
		]);
		const canManageTeam = teamDecision.allowed;
		const canManageParticipants =
			participantDecision.allowed && project.owningOrganisationId === actor.organisationId;
		const repository = new ProjectTeamRepository(this.db);
		const [allParticipants, teamMembers, roleTypes, organisationMembers] = await Promise.all([
			repository.listParticipants(project.id),
			repository.listActiveProjectMembers(project.id, actor.organisationId),
			repository.listActiveRoleTypes(),
			canManageTeam
				? repository.listActiveOrganisationMembers(actor.organisationId)
				: Promise.resolve([])
		]);
		const activeProjectMemberIds = new Set(teamMembers.map((member) => member.id));
		const participants = canManageParticipants
			? allParticipants
			: allParticipants.filter((participant) => participant.status === 'active');
		const ownParticipant = allParticipants.find(
			(participant) => participant.organisationId === actor.organisationId
		);

		return {
			canManageTeam,
			canManageParticipants,
			canLeaveParticipation:
				participationDecision.allowed &&
				project.owningOrganisationId !== actor.organisationId &&
				ownParticipant?.status === 'active',
			participants,
			teamMembers,
			availableMembers: organisationMembers.filter(
				(member) => !activeProjectMemberIds.has(member.id)
			),
			roleTypes,
			ownOrganisationPublicId: ownParticipant?.organisationPublicId ?? null
		};
	}

	async inviteParticipant(
		actor: TenantActorContext,
		input: { projectPublicId: string; organisationPublicId: string; roleKeys: readonly string[] }
	): Promise<void> {
		const targetPublicId = normalisePublicId(input.organisationPublicId, 'Organisation ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.participant.manage'
			);
			if (project.owningOrganisationId !== actor.organisationId) {
				throw new TenantAccessError(
					'Only the owning organisation can invite project participants.'
				);
			}
			assertCollaborationCanGrow(project);
			const repository = new ProjectTeamRepository(trx);
			const target = await repository.findActiveOrganisationByPublicId(targetPublicId);
			if (!target)
				throw new ProjectTeamValidationError(
					'No active NuBlox organisation matches that exact organisation ID.'
				);
			if (target.id === project.owningOrganisationId) {
				throw new ProjectTeamValidationError(
					'The owning organisation already participates in its project.'
				);
			}
			const { roleKeys, roleIds } = await this.resolveRoleIds(repository, input.roleKeys, true);
			const current = await repository.findParticipationForUpdate(project.id, target.id);
			let actionKey = 'project.participant.invited';
			if (!current) {
				await repository.insertInvitation(project.id, target.id, actorMembership.id);
			} else if (current.status === 'active') {
				throw new ProjectTeamValidationError(
					'That organisation already participates in this project.'
				);
			} else if (current.status === 'invited') {
				actionKey = 'project.participant.invitation_updated';
			} else {
				const reinvited = await repository.reinviteParticipation(
					project.id,
					target.id,
					current.status,
					actorMembership.id
				);
				if (!reinvited) throw new ConcurrentUpdateError();
				actionKey = 'project.participant.reinvited';
			}
			await repository.replaceOrganisationRoles(project.id, target.id, roleIds);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey,
				subjectType: 'project_participant_organisation',
				subjectPublicId: target.publicId,
				correlationId: actor.correlationId,
				changeSummary: { organisationName: target.name, roleKeys }
			});
		});
	}

	async respondToInvitation(
		actor: TenantActorContext,
		input: { projectPublicId: string; response: 'accept' | 'decline' }
	): Promise<string> {
		const projectPublicId = normalisePublicId(input.projectPublicId, 'Project ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			await this.assertOrganisationPermission(actor, 'project.participation.manage', trx);
			const repository = new ProjectTeamRepository(trx);
			const invitation = await repository.findParticipationForUpdateByProjectPublicId(
				actor.organisationId,
				projectPublicId
			);
			if (!invitation || invitation.status !== 'invited') {
				throw new RecordNotFoundError(
					'No pending project invitation exists for this organisation.'
				);
			}
			if (
				input.response === 'accept' &&
				TERMINAL_COLLABORATION_PROJECT_STATUSES.has(invitation.projectStatus)
			) {
				throw new ProjectTeamValidationError('This project can no longer accept participants.');
			}
			const at = this.now();
			if (input.response === 'decline') {
				const changed = await repository.updateParticipationStatus({
					projectId: invitation.projectId,
					participantOrganisationId: actor.organisationId,
					fromStatus: 'invited',
					toStatus: 'declined',
					joinedAt: null,
					leftAt: at
				});
				if (!changed) throw new ConcurrentUpdateError();
				await new AuditRepository(trx).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actorMembership.id,
					projectId: invitation.projectId,
					actionKey: 'project.participant.declined',
					subjectType: 'project_participant_organisation',
					subjectPublicId: null,
					correlationId: actor.correlationId,
					changeSummary: { projectPublicId }
				});
				return projectPublicId;
			}

			const changed = await repository.updateParticipationStatus({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				fromStatus: 'invited',
				toStatus: 'active',
				joinedAt: at,
				leftAt: null
			});
			if (!changed) throw new ConcurrentUpdateError();
			const currentMember = await repository.findProjectMemberForUpdate(
				invitation.projectId,
				actor.organisationId,
				actorMembership.id
			);
			await repository.activateProjectMember({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: actorMembership.id,
				joinedAt: at,
				currentStatus: currentMember?.status ?? null
			});
			await repository.replaceMemberRoles({
				projectId: invitation.projectId,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: actorMembership.id,
				roleTypeIds: []
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: invitation.projectId,
				actionKey: 'project.participant.accepted',
				subjectType: 'project_participant_organisation',
				subjectPublicId: null,
				correlationId: actor.correlationId,
				changeSummary: { projectPublicId, acceptingMemberId: actorMembership.id }
			});
			return projectPublicId;
		});
	}

	async updateParticipantRoles(
		actor: TenantActorContext,
		input: { projectPublicId: string; organisationPublicId: string; roleKeys: readonly string[] }
	): Promise<void> {
		const targetPublicId = normalisePublicId(input.organisationPublicId, 'Organisation ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.participant.manage'
			);
			if (project.owningOrganisationId !== actor.organisationId) {
				throw new TenantAccessError('Only the owning organisation can manage participant roles.');
			}
			if (project.status === 'archived')
				throw new ProjectTeamValidationError('Archived projects are read-only.');
			const repository = new ProjectTeamRepository(trx);
			const target = await repository.findActiveOrganisationByPublicId(targetPublicId);
			if (!target)
				throw new ProjectTeamValidationError('The participant organisation is unavailable.');
			const participation = await repository.findParticipationForUpdate(project.id, target.id);
			if (!participation || ['removed', 'declined', 'left'].includes(participation.status)) {
				throw new ProjectTeamValidationError(
					'That organisation is not a current project participant.'
				);
			}
			const { roleKeys, roleIds } = await this.resolveRoleIds(repository, input.roleKeys);
			await repository.replaceOrganisationRoles(project.id, target.id, roleIds);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.participant.roles_changed',
				subjectType: 'project_participant_organisation',
				subjectPublicId: target.publicId,
				correlationId: actor.correlationId,
				changeSummary: { roleKeys }
			});
		});
	}

	async removeParticipant(
		actor: TenantActorContext,
		input: { projectPublicId: string; organisationPublicId: string }
	): Promise<void> {
		const targetPublicId = normalisePublicId(input.organisationPublicId, 'Organisation ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.participant.manage'
			);
			if (project.owningOrganisationId !== actor.organisationId) {
				throw new TenantAccessError(
					'Only the owning organisation can remove project participants.'
				);
			}
			const repository = new ProjectTeamRepository(trx);
			const target = await repository.findActiveOrganisationByPublicId(targetPublicId);
			if (!target)
				throw new ProjectTeamValidationError('The participant organisation is unavailable.');
			if (target.id === project.owningOrganisationId) {
				throw new ProjectTeamValidationError(
					'The owning organisation cannot be removed from its own project.'
				);
			}
			const participation = await repository.findParticipationForUpdate(project.id, target.id);
			if (!participation || ['removed', 'declined', 'left'].includes(participation.status)) {
				throw new ProjectTeamValidationError(
					'That organisation is not a current project participant.'
				);
			}
			const at = this.now();
			const changed = await repository.updateParticipationStatus({
				projectId: project.id,
				participantOrganisationId: target.id,
				fromStatus: participation.status,
				toStatus: 'removed',
				joinedAt: participation.joinedAt,
				leftAt: at
			});
			if (!changed) throw new ConcurrentUpdateError();
			await repository.markAllActiveProjectMembers({
				projectId: project.id,
				participantOrganisationId: target.id,
				toStatus: 'removed',
				leftAt: at
			});
			await repository.deleteMemberRolesForOrganisation(project.id, target.id);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.participant.removed',
				subjectType: 'project_participant_organisation',
				subjectPublicId: target.publicId,
				correlationId: actor.correlationId,
				changeSummary: { fromStatus: participation.status, toStatus: 'removed' }
			});
		});
	}

	async leaveProject(actor: TenantActorContext, projectPublicId: string): Promise<void> {
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				projectPublicId,
				trx,
				'project.participation.manage'
			);
			if (project.owningOrganisationId === actor.organisationId) {
				throw new ProjectTeamValidationError(
					'The owning organisation cannot leave its own project.'
				);
			}
			const repository = new ProjectTeamRepository(trx);
			const participation = await repository.findParticipationForUpdate(
				project.id,
				actor.organisationId
			);
			if (!participation || participation.status !== 'active') {
				throw new ProjectTeamValidationError(
					'This organisation is not an active project participant.'
				);
			}
			const at = this.now();
			const changed = await repository.updateParticipationStatus({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				fromStatus: 'active',
				toStatus: 'left',
				joinedAt: participation.joinedAt,
				leftAt: at
			});
			if (!changed) throw new ConcurrentUpdateError();
			await repository.markAllActiveProjectMembers({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				toStatus: 'left',
				leftAt: at
			});
			await repository.deleteMemberRolesForOrganisation(project.id, actor.organisationId);
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.participant.left',
				subjectType: 'project_participant_organisation',
				subjectPublicId: null,
				correlationId: actor.correlationId,
				changeSummary: { projectPublicId }
			});
		});
	}

	async addMember(
		actor: TenantActorContext,
		input: { projectPublicId: string; memberPublicId: string; roleKeys: readonly string[] }
	): Promise<void> {
		const memberPublicId = normalisePublicId(input.memberPublicId, 'Member ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.team.manage'
			);
			assertCollaborationCanGrow(project);
			const repository = new ProjectTeamRepository(trx);
			const participation = await repository.findParticipationForUpdate(
				project.id,
				actor.organisationId
			);
			if (!participation || participation.status !== 'active') {
				throw new TenantAccessError(
					'Only active project participants can manage their project team.'
				);
			}
			const member = await repository.findActiveOrganisationMemberForUpdate(
				actor.organisationId,
				memberPublicId
			);
			if (!member)
				throw new ProjectTeamValidationError('That active organisation member was not found.');
			const existing = await repository.findProjectMemberForUpdate(
				project.id,
				actor.organisationId,
				member.id
			);
			if (existing?.status === 'active') {
				throw new ProjectTeamValidationError('That member already belongs to this project team.');
			}
			const { roleKeys, roleIds } = await this.resolveRoleIds(repository, input.roleKeys);
			const at = this.now();
			await repository.activateProjectMember({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: member.id,
				joinedAt: at,
				currentStatus: existing?.status ?? null
			});
			await repository.replaceMemberRoles({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: member.id,
				roleTypeIds: roleIds
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.member.added',
				subjectType: 'project_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: { displayName: member.displayName, roleKeys }
			});
		});
	}

	async removeMember(
		actor: TenantActorContext,
		input: { projectPublicId: string; memberPublicId: string }
	): Promise<{ removedSelf: boolean }> {
		const memberPublicId = normalisePublicId(input.memberPublicId, 'Member ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.team.manage'
			);
			const repository = new ProjectTeamRepository(trx);
			const member = await repository.findActiveOrganisationMemberForUpdate(
				actor.organisationId,
				memberPublicId
			);
			if (!member)
				throw new ProjectTeamValidationError('That active organisation member was not found.');
			const projectMember = await repository.findProjectMemberForUpdate(
				project.id,
				actor.organisationId,
				member.id
			);
			if (!projectMember || projectMember.status !== 'active') {
				throw new ProjectTeamValidationError('That member is not active on this project team.');
			}

			const permissionService = new PermissionService(trx);
			const targetDecision = await permissionService.decideWithUmbrella(
				{
					organisationId: actor.organisationId,
					userId: member.userId,
					memberId: member.id,
					correlationId: actor.correlationId
				},
				'project.team.manage',
				'project.manage',
				{ projectId: project.id }
			);
			if (targetDecision.allowed) {
				const candidates = await repository.listActiveProjectMemberActors(
					project.id,
					actor.organisationId
				);
				let anotherManagerExists = false;
				for (const candidate of candidates) {
					if (candidate.memberId === member.id) continue;
					const decision = await permissionService.decideWithUmbrella(
						{
							organisationId: actor.organisationId,
							userId: candidate.userId,
							memberId: candidate.memberId,
							correlationId: actor.correlationId
						},
						'project.team.manage',
						'project.manage',
						{ projectId: project.id }
					);
					if (decision.allowed) {
						anotherManagerExists = true;
						break;
					}
				}
				if (!anotherManagerExists) {
					throw new ProjectTeamValidationError(
						'Assign another project manager before removing the final project manager from this organisation.'
					);
				}
			}

			const at = this.now();
			const changed = await repository.updateProjectMemberStatus({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: member.id,
				fromStatus: 'active',
				toStatus: 'removed',
				leftAt: at
			});
			if (!changed) throw new ConcurrentUpdateError();
			await repository.replaceMemberRoles({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: member.id,
				roleTypeIds: []
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.member.removed',
				subjectType: 'project_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: { displayName: member.displayName }
			});
			return { removedSelf: member.id === actor.memberId };
		});
	}

	async updateMemberRoles(
		actor: TenantActorContext,
		input: { projectPublicId: string; memberPublicId: string; roleKeys: readonly string[] }
	): Promise<void> {
		const memberPublicId = normalisePublicId(input.memberPublicId, 'Member ID');
		return this.db.transaction().execute(async (trx) => {
			const actorMembership = await this.assertActiveActor(actor, trx);
			const project = await this.loadScopedProject(
				actor,
				input.projectPublicId,
				trx,
				'project.team.manage'
			);
			if (project.status === 'archived')
				throw new ProjectTeamValidationError('Archived projects are read-only.');
			const repository = new ProjectTeamRepository(trx);
			const member = await repository.findActiveOrganisationMemberForUpdate(
				actor.organisationId,
				memberPublicId
			);
			if (!member)
				throw new ProjectTeamValidationError('That active organisation member was not found.');
			const projectMember = await repository.findProjectMemberForUpdate(
				project.id,
				actor.organisationId,
				member.id
			);
			if (!projectMember || projectMember.status !== 'active') {
				throw new ProjectTeamValidationError('That member is not active on this project team.');
			}
			const { roleKeys, roleIds } = await this.resolveRoleIds(repository, input.roleKeys);
			await repository.replaceMemberRoles({
				projectId: project.id,
				participantOrganisationId: actor.organisationId,
				organisationMemberId: member.id,
				roleTypeIds: roleIds
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actorMembership.id,
				projectId: project.id,
				actionKey: 'project.member.roles_changed',
				subjectType: 'project_member',
				subjectPublicId: member.publicId,
				correlationId: actor.correlationId,
				changeSummary: { roleKeys }
			});
		});
	}
}
