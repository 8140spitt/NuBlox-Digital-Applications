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
import {
	ProjectHierarchyRepository,
	type PortfolioRecord,
	type ProgrammeRecord,
	type ProjectHierarchyContext
} from './project-hierarchy-repository';
import { ProjectRepository } from './project-repository';

export type ProjectHierarchyAccess = {
	canViewPortfolios: boolean;
	canManagePortfolios: boolean;
	canViewProgrammes: boolean;
	canManageProgrammes: boolean;
	portfolios: PortfolioRecord[];
	programmes: ProgrammeRecord[];
};

export type CreatePortfolioInput = {
	portfolioNumber: string;
	name: string;
	description?: string | null;
};

export type CreateProgrammeInput = {
	programmeNumber: string;
	name: string;
	description?: string | null;
	portfolioPublicId?: string | null;
};

export type AssignProjectProgrammeInput = {
	projectPublicId: string;
	programmePublicId?: string | null;
};

export class ProjectHierarchyValidationError extends Error {
	readonly code = 'PROJECT_HIERARCHY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'ProjectHierarchyValidationError';
	}
}

function validateNumber(value: string, label: string): string {
	const normalised = value.trim();
	if (!normalised || normalised.length > 80) {
		throw new ProjectHierarchyValidationError(`${label} must be between 1 and 80 characters.`);
	}
	return normalised;
}

function validateName(value: string, label: string): string {
	const normalised = value.trim();
	if (!normalised || normalised.length > 255) {
		throw new ProjectHierarchyValidationError(`${label} must be between 1 and 255 characters.`);
	}
	return normalised;
}

function validateDescription(value?: string | null): string | null {
	const normalised = value?.trim() || null;
	if (normalised && normalised.length > 10000) {
		throw new ProjectHierarchyValidationError('Description must not exceed 10,000 characters.');
	}
	return normalised;
}

function isDuplicateKeyError(error: unknown): boolean {
	return Boolean(
		error &&
		typeof error === 'object' &&
		'code' in error &&
		(error as { code?: unknown }).code === 'ER_DUP_ENTRY'
	);
}

export class ProjectHierarchyService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	async listHierarchy(actor: TenantActorContext): Promise<ProjectHierarchyAccess> {
		await this.assertActiveActor(actor);
		const permissionService = new PermissionService(this.db);
		const [portfolioView, portfolioManage, programmeView, programmeManage] = await Promise.all([
			permissionService.decide(actor, 'project.portfolio.view'),
			permissionService.decideWithUmbrella(actor, 'project.portfolio.manage', 'project.manage'),
			permissionService.decide(actor, 'project.programme.view'),
			permissionService.decideWithUmbrella(actor, 'project.programme.manage', 'project.manage')
		]);
		const canManagePortfolios = portfolioManage.allowed;
		const canManageProgrammes = programmeManage.allowed;
		const canViewPortfolios = portfolioView.allowed || canManagePortfolios;
		const canViewProgrammes = programmeView.allowed || canManageProgrammes;
		const repository = new ProjectHierarchyRepository(this.db);

		const [portfolios, programmes] = await Promise.all([
			canViewPortfolios ? repository.listPortfolios(actor.organisationId) : Promise.resolve([]),
			canViewProgrammes ? repository.listProgrammes(actor.organisationId) : Promise.resolve([])
		]);

		return {
			canViewPortfolios,
			canManagePortfolios,
			canViewProgrammes,
			canManageProgrammes,
			portfolios,
			programmes
		};
	}

	async listProjectContexts(
		actor: TenantActorContext,
		projectIds: readonly string[]
	): Promise<ProjectHierarchyContext[]> {
		await this.assertActiveActor(actor);
		return new ProjectHierarchyRepository(this.db).listProjectContexts(projectIds);
	}

	async createPortfolio(
		actor: TenantActorContext,
		input: CreatePortfolioInput
	): Promise<PortfolioRecord> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.portfolio.manage',
			'project.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('Portfolio management is not permitted.');

		const portfolioNumber = validateNumber(input.portfolioNumber, 'Portfolio number');
		const name = validateName(input.name, 'Portfolio name');
		const description = validateDescription(input.description);
		const repository = new ProjectHierarchyRepository(this.db);
		if (await repository.findPortfolioByNumber(actor.organisationId, portfolioNumber)) {
			throw new ProjectHierarchyValidationError(
				'That portfolio number is already in use in this organisation.'
			);
		}

		const publicId = this.publicIdFactory();
		try {
			return await this.db.transaction().execute(async (transaction) => {
				const txRepository = new ProjectHierarchyRepository(transaction);
				await txRepository.insertPortfolio({
					organisationId: actor.organisationId,
					publicId,
					portfolioNumber,
					name,
					description,
					createdByMemberId: actor.memberId
				});
				await new AuditRepository(transaction).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actor.memberId,
					projectId: null,
					actionKey: 'portfolio.created',
					subjectType: 'portfolio',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: { portfolioNumber, name }
				});
				const created = await txRepository.findPortfolioByPublicId(actor.organisationId, publicId);
				if (!created) throw new Error('Created portfolio could not be reloaded.');
				return created;
			});
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				throw new ProjectHierarchyValidationError(
					'That portfolio number is already in use in this organisation.'
				);
			}
			throw error;
		}
	}

	async createProgramme(
		actor: TenantActorContext,
		input: CreateProgrammeInput
	): Promise<ProgrammeRecord> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.programme.manage',
			'project.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('Programme management is not permitted.');

		const programmeNumber = validateNumber(input.programmeNumber, 'Programme number');
		const name = validateName(input.name, 'Programme name');
		const description = validateDescription(input.description);
		const portfolioPublicId = input.portfolioPublicId?.trim() || null;
		const repository = new ProjectHierarchyRepository(this.db);
		if (await repository.findProgrammeByNumber(actor.organisationId, programmeNumber)) {
			throw new ProjectHierarchyValidationError(
				'That programme number is already in use in this organisation.'
			);
		}
		const portfolio = portfolioPublicId
			? await repository.findPortfolioByPublicId(actor.organisationId, portfolioPublicId)
			: null;
		if (portfolioPublicId && !portfolio) {
			throw new ProjectHierarchyValidationError(
				'The selected portfolio is not available in this organisation.'
			);
		}

		const publicId = this.publicIdFactory();
		try {
			return await this.db.transaction().execute(async (transaction) => {
				const txRepository = new ProjectHierarchyRepository(transaction);
				await txRepository.insertProgramme({
					organisationId: actor.organisationId,
					portfolioId: portfolio?.id ?? null,
					publicId,
					programmeNumber,
					name,
					description,
					createdByMemberId: actor.memberId
				});
				await new AuditRepository(transaction).append({
					eventPublicId: this.publicIdFactory(),
					actingOrganisationId: actor.organisationId,
					actorUserId: actor.userId,
					actorMemberId: actor.memberId,
					projectId: null,
					actionKey: 'programme.created',
					subjectType: 'programme',
					subjectPublicId: publicId,
					correlationId: actor.correlationId,
					changeSummary: {
						programmeNumber,
						name,
						portfolioPublicId: portfolio?.publicId ?? null
					}
				});
				const created = await txRepository.findProgrammeByPublicId(actor.organisationId, publicId);
				if (!created) throw new Error('Created programme could not be reloaded.');
				return created;
			});
		} catch (error) {
			if (isDuplicateKeyError(error)) {
				throw new ProjectHierarchyValidationError(
					'That programme number is already in use in this organisation.'
				);
			}
			throw error;
		}
	}

	async assignProjectToProgramme(
		actor: TenantActorContext,
		input: AssignProjectProgrammeInput
	): Promise<ProjectHierarchyContext> {
		await this.assertActiveActor(actor);
		const projectPublicId = input.projectPublicId.trim();
		if (!projectPublicId) throw new ProjectHierarchyValidationError('A project is required.');
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Project not found in the owning member scope.');
		}

		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			'project.programme.manage',
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed) throw new TenantAccessError('Programme assignment is not permitted.');

		const programmePublicId = input.programmePublicId?.trim() || null;
		const repository = new ProjectHierarchyRepository(this.db);
		const programme = programmePublicId
			? await repository.findProgrammeByPublicId(actor.organisationId, programmePublicId)
			: null;
		if (programmePublicId && !programme) {
			throw new ProjectHierarchyValidationError(
				'The selected programme is not available in this organisation.'
			);
		}

		return this.db.transaction().execute(async (transaction) => {
			const txRepository = new ProjectHierarchyRepository(transaction);
			const changed = await txRepository.updateProjectProgramme({
				projectId: project.id,
				owningOrganisationId: actor.organisationId,
				programmeId: programme?.id ?? null
			});
			if (!changed) throw new ConcurrentUpdateError();

			await new AuditRepository(transaction).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: actor.memberId,
				projectId: project.id,
				actionKey: 'project.programme_assigned',
				subjectType: 'project',
				subjectPublicId: project.publicId,
				correlationId: actor.correlationId,
				changeSummary: { programmePublicId: programme?.publicId ?? null }
			});

			const [context] = await txRepository.listProjectContexts([project.id]);
			if (!context) throw new Error('Updated project hierarchy context could not be reloaded.');
			return context;
		});
	}
}
