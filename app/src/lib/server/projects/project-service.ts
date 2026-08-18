import { randomUUID } from 'node:crypto';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { AuditRepository } from '$lib/server/audit/audit-repository';
import { getDatabase, type Database } from '$lib/server/db/database';
import {
	ConcurrentUpdateError,
	InvalidLifecycleTransitionError,
	RecordNotFoundError,
	TenantAccessError
} from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	ProjectRepository,
	type ProjectLifecycleStatus,
	type ProjectRecord
} from './project-repository';

export const PROJECT_LIFECYCLE_TRANSITIONS: Readonly<
	Record<ProjectLifecycleStatus, readonly ProjectLifecycleStatus[]>
> = {
	proposed: ['active', 'cancelled'],
	active: ['on_hold', 'completed', 'cancelled'],
	on_hold: ['active', 'completed', 'cancelled'],
	completed: ['archived'],
	cancelled: ['archived'],
	archived: []
};

export function allowedProjectLifecycleTransitions(
	status: ProjectLifecycleStatus
): readonly ProjectLifecycleStatus[] {
	return PROJECT_LIFECYCLE_TRANSITIONS[status];
}

export type CreateProjectInput = {
	projectNumber: string;
	name: string;
	description?: string | null;
};

export type TransitionProjectInput = {
	projectPublicId: string;
	toStatus: ProjectLifecycleStatus;
	effectiveDate?: Date;
};

export class ProjectService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	async getProjectForParticipant(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectRecord> {
		const membershipRepository = new OrganisationMembershipRepository(this.db);
		if (!(await membershipRepository.findActiveActorMembership(actor))) {
			throw new TenantAccessError();
		}

		const project = await new ProjectRepository(this.db).findParticipatingByPublicId(
			actor.organisationId,
			projectPublicId
		);
		if (!project)
			throw new RecordNotFoundError('Project not found in the participating organisation scope.');

		return project;
	}

	async createProject(
		actor: TenantActorContext,
		input: CreateProjectInput
	): Promise<ProjectRecord> {
		const projectPublicId = this.publicIdFactory();
		const createdAt = this.now();

		return this.db.transaction().execute(async (transaction) => {
			const membershipRepository = new OrganisationMembershipRepository(transaction);
			const membership = await membershipRepository.findActiveActorMembership(actor);
			if (!membership) throw new TenantAccessError();

			const projectRepository = new ProjectRepository(transaction);
			const projectId = await projectRepository.insert({
				owningOrganisationId: actor.organisationId,
				publicId: projectPublicId,
				projectNumber: input.projectNumber,
				name: input.name,
				description: input.description ?? null,
				createdByMemberId: membership.id
			});

			// Package 001 invariant: the owner participates in its own project from creation.
			await projectRepository.insertOwningParticipation(projectId, actor.organisationId, createdAt);
			await projectRepository.insertProjectMember(
				projectId,
				actor.organisationId,
				membership.id,
				createdAt
			);

			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId,
				actionKey: 'project.created',
				subjectType: 'project',
				subjectPublicId: projectPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					status: 'proposed',
					projectNumber: input.projectNumber,
					name: input.name
				}
			});

			const project = await projectRepository.findOwnedByPublicId(
				actor.organisationId,
				projectPublicId
			);
			if (!project)
				throw new Error('Created project could not be reloaded inside its transaction.');

			return project;
		});
	}

	async transitionProject(
		actor: TenantActorContext,
		input: TransitionProjectInput
	): Promise<ProjectRecord> {
		return this.db.transaction().execute(async (transaction) => {
			const membershipRepository = new OrganisationMembershipRepository(transaction);
			const membership = await membershipRepository.findActiveActorMembership(actor);
			if (!membership) throw new TenantAccessError();

			const projectRepository = new ProjectRepository(transaction);
			const project = await projectRepository.findOwnedByPublicId(
				actor.organisationId,
				input.projectPublicId
			);
			if (!project) {
				throw new RecordNotFoundError('Project not found in the owning organisation scope.');
			}

			if (!PROJECT_LIFECYCLE_TRANSITIONS[project.status].includes(input.toStatus)) {
				throw new InvalidLifecycleTransitionError(project.status, input.toStatus);
			}

			const changedAt = this.now();
			const effectiveDate = input.effectiveDate ?? changedAt;
			const updated = await projectRepository.updateLifecycle({
				projectId: project.id,
				owningOrganisationId: actor.organisationId,
				fromStatus: project.status,
				toStatus: input.toStatus,
				startedOn:
					input.toStatus === 'active' && project.status === 'proposed' && !project.startedOn
						? effectiveDate
						: undefined,
				completedOn: input.toStatus === 'completed' ? effectiveDate : undefined,
				archivedAt: input.toStatus === 'archived' ? changedAt : undefined
			});
			if (!updated) throw new ConcurrentUpdateError();

			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				projectId: project.id,
				actionKey: 'project.status_changed',
				subjectType: 'project',
				subjectPublicId: project.publicId,
				correlationId: actor.correlationId,
				changeSummary: {
					from: project.status,
					to: input.toStatus,
					effectiveDate: effectiveDate.toISOString()
				}
			});

			const reloaded = await projectRepository.findOwnedByPublicId(
				actor.organisationId,
				project.publicId
			);
			if (!reloaded)
				throw new Error('Updated project could not be reloaded inside its transaction.');

			return reloaded;
		});
	}
}
