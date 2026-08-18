import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import {
	ProjectRepository,
	type ProjectLifecycleStatus,
	type ProjectParticipantOrganisation,
	type ProjectRecord
} from './project-repository';
import {
	allowedProjectLifecycleTransitions,
	ProjectService,
	type CreateProjectInput
} from './project-service';

export type ProjectListAccess = {
	canView: boolean;
	canCreate: boolean;
	projects: ProjectRecord[];
};

export type ProjectWorkspace = {
	project: ProjectRecord;
	participants: ProjectParticipantOrganisation[];
	canManageLifecycle: boolean;
	allowedTransitions: readonly ProjectLifecycleStatus[];
	isOwningOrganisation: boolean;
};

export class ProjectWorkspaceValidationError extends Error {
	readonly code = 'PROJECT_WORKSPACE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectWorkspaceValidationError';
	}
}

function validateCreateProjectInput(input: CreateProjectInput): CreateProjectInput {
	const projectNumber = input.projectNumber.trim();
	const name = input.name.trim();
	const description = input.description?.trim() || null;

	if (!projectNumber || projectNumber.length > 80) {
		throw new ProjectWorkspaceValidationError(
			'Project number must be between 1 and 80 characters.'
		);
	}
	if (!name || name.length > 255) {
		throw new ProjectWorkspaceValidationError('Project name must be between 1 and 255 characters.');
	}
	if (description && description.length > 10000) {
		throw new ProjectWorkspaceValidationError(
			'Project description must not exceed 10,000 characters.'
		);
	}

	return { projectNumber, name, description };
}

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

export class ProjectWorkspaceService {
	constructor(private readonly db: Database = getDatabase()) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	async listProjects(actor: TenantActorContext): Promise<ProjectListAccess> {
		await this.assertActiveActor(actor);
		const decisions = await new PermissionService(this.db).decideMany(actor, [
			'project.view',
			'project.create'
		]);
		const canView = decisions.get('project.view')?.allowed ?? false;
		const canCreate = decisions.get('project.create')?.allowed ?? false;

		return {
			canView,
			canCreate,
			projects: canView
				? await new ProjectRepository(this.db).listForMember(actor.organisationId, actor.memberId)
				: []
		};
	}

	async createProject(
		actor: TenantActorContext,
		input: CreateProjectInput
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, 'project.create');
		if (!decision.allowed) throw new TenantAccessError('Project creation is not permitted.');

		const validated = validateCreateProjectInput(input);
		const existing = await new ProjectRepository(this.db).findOwnedByProjectNumber(
			actor.organisationId,
			validated.projectNumber
		);
		if (existing) {
			throw new ProjectWorkspaceValidationError(
				'That project number is already in use in this organisation.'
			);
		}

		try {
			return await new ProjectService(this.db).createProject(actor, validated);
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				throw new ProjectWorkspaceValidationError(
					'That project number is already in use in this organisation.'
				);
			}
			throw error;
		}
	}

	async getWorkspace(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectWorkspace> {
		await this.assertActiveActor(actor);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId
		);
		if (!project) {
			throw new RecordNotFoundError('Project not found in the active member scope.');
		}

		const permissionService = new PermissionService(this.db);
		const viewDecision = await permissionService.decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!viewDecision.allowed) {
			throw new RecordNotFoundError('Project not found in the active member scope.');
		}

		const lifecycleDecision = await permissionService.decideWithUmbrella(
			actor,
			'project.lifecycle.manage',
			'project.manage',
			{ projectId: project.id }
		);
		const isOwningOrganisation = project.owningOrganisationId === actor.organisationId;

		return {
			project,
			participants: await new ProjectRepository(this.db).listActiveParticipantOrganisations(
				project.id
			),
			canManageLifecycle: lifecycleDecision.allowed && isOwningOrganisation,
			allowedTransitions: isOwningOrganisation
				? allowedProjectLifecycleTransitions(project.status)
				: [],
			isOwningOrganisation
		};
	}

	async transitionProject(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			toStatus: ProjectLifecycleStatus;
			effectiveDate?: Date;
		}
	): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			input.projectPublicId
		);
		if (!project) throw new RecordNotFoundError('Project not found in the active member scope.');

		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.lifecycle.manage',
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed || project.owningOrganisationId !== actor.organisationId) {
			throw new TenantAccessError('Project lifecycle management is not permitted.');
		}

		return new ProjectService(this.db).transitionProject(actor, input);
	}
}
