import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import { ensureInformationStandardRoleDefaults } from './information-bootstrap';

export type InformationRequirementType = 'OIR' | 'AIR' | 'PIR' | 'EIR';
export type InformationRequirementStatus = 'draft' | 'approved' | 'withdrawn';
export type InformationResponsibilityCode = 'responsible' | 'accountable' | 'consulted' | 'informed';
export type InformationRequirementHealth = 'draft' | 'open' | 'overdue' | 'fulfilled' | 'withdrawn';

export class ProjectInformationRequirementValidationError extends Error {
	readonly code = 'PROJECT_INFORMATION_REQUIREMENT_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'ProjectInformationRequirementValidationError';
	}
}

export type InformationRequirementInput = {
	projectPublicId: string;
	requirementCode: string;
	requirementType: InformationRequirementType;
	title: string;
	description?: string | null;
	containerTypeCode?: string | null;
	requiredPurposeCode?: string | null;
	requiredSuitabilityCode?: string | null;
	requiredByOn?: Date | null;
};

export type InformationResponsibilityInput = {
	organisationPublicId: string;
	roleKey: string;
	responsibilityCode: InformationResponsibilityCode;
};

export type InformationRequirementResponsibility = InformationResponsibilityInput & {
	organisationName: string;
	roleName: string;
};

export type InformationRequirementEvidence = {
	containerPublicId: string;
	containerNumber: string;
	containerTitle: string;
	containerTypeCode: string;
	containerTypeName: string;
	containerOwnerOrganisationName: string;
	qualifyingRevisionPublicId: string | null;
	qualifyingRevisionCode: string | null;
	qualifyingPurposeCode: string | null;
	qualifyingSuitabilityCode: string | null;
};

export type ProjectInformationRequirementRecord = {
	id: string;
	publicId: string;
	requirementCode: string;
	requirementType: InformationRequirementType;
	title: string;
	description: string | null;
	containerTypeCode: string | null;
	containerTypeName: string | null;
	requiredPurposeCode: string | null;
	requiredSuitabilityCode: string | null;
	requiredByOn: Date | null;
	status: InformationRequirementStatus;
	health: InformationRequirementHealth;
	approvedAt: Date | null;
	withdrawnAt: Date | null;
	withdrawalReason: string | null;
	responsibilities: InformationRequirementResponsibility[];
	evidence: InformationRequirementEvidence[];
};

export type ProjectInformationRequirementWorkspace = {
	project: ProjectRecord;
	requirements: ProjectInformationRequirementRecord[];
	requirementTypes: Array<{ code: InformationRequirementType; name: string }>;
	containerTypes: Array<{ code: string; name: string }>;
	purposeCodes: Array<{ code: string; name: string }>;
	responsibilityOptions: Array<{
		organisationPublicId: string;
		organisationName: string;
		roleKey: string;
		roleName: string;
	}>;
	containerOptions: Array<{
		publicId: string;
		containerNumber: string;
		title: string;
		typeCode: string;
		typeName: string;
	}>;
	canManage: boolean;
	canApprove: boolean;
	canManageResponsibilities: boolean;
	canLinkEvidence: boolean;
};

const REQUIREMENT_TYPES = ['OIR', 'AIR', 'PIR', 'EIR'] as const;
const RESPONSIBILITY_CODES = ['responsible', 'accountable', 'consulted', 'informed'] as const;

function requiredText(value: string, label: string, max: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > max) {
		throw new ProjectInformationRequirementValidationError(
			`${label} must be between 1 and ${max} characters.`
		);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new ProjectInformationRequirementValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function requirementCode(value: string): string {
	const normalized = requiredText(value, 'Requirement code', 80).toUpperCase();
	if (!/^[A-Z0-9][A-Z0-9._/-]*$/.test(normalized)) {
		throw new ProjectInformationRequirementValidationError(
			'Requirement code may contain letters, numbers, dots, underscores, slashes and hyphens.'
		);
	}
	return normalized;
}

function dateOnly(value: Date | null | undefined, label: string): Date | null {
	if (!value) return null;
	if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
		throw new ProjectInformationRequirementValidationError(`${label} is invalid.`);
	}
	return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

function assertRequirementType(value: string): InformationRequirementType {
	if (!REQUIREMENT_TYPES.includes(value as InformationRequirementType)) {
		throw new ProjectInformationRequirementValidationError('Information requirement type is invalid.');
	}
	return value as InformationRequirementType;
}

function assertResponsibilityCode(value: string): InformationResponsibilityCode {
	if (!RESPONSIBILITY_CODES.includes(value as InformationResponsibilityCode)) {
		throw new ProjectInformationRequirementValidationError('Responsibility code is invalid.');
	}
	return value as InformationResponsibilityCode;
}

function requirementStatus(value: string): InformationRequirementStatus {
	if (value === 'draft' || value === 'approved' || value === 'withdrawn') return value;
	throw new Error(`Unexpected project information requirement status: ${value}`);
}

function asDateOnly(value: Date): string {
	return value.toISOString().slice(0, 10);
}

export class ProjectInformationRequirementsService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(this.db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async findProject(actor: TenantActorContext, projectPublicId: string): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		await ensureInformationStandardRoleDefaults(this.db, actor.organisationId);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError(
				'Project information requirements not found in the active member scope.'
			);
		}
		const viewProject = await new PermissionService(this.db).decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!viewProject.allowed) {
			throw new RecordNotFoundError(
				'Project information requirements not found in the active member scope.'
			);
		}
		return project;
	}

	private async permissionFlags(actor: TenantActorContext, project: ProjectRecord) {
		const permissions = new PermissionService(this.db);
		const [view, manage, approve, responsibility, link] = await Promise.all([
			permissions.decide(actor, 'information.view', { projectId: project.id }),
			permissions.decide(actor, 'information.requirement.manage', { projectId: project.id }),
			permissions.decide(actor, 'information.requirement.approve', { projectId: project.id }),
			permissions.decide(actor, 'information.responsibility.manage', { projectId: project.id }),
			permissions.decide(actor, 'information.requirement.link', { projectId: project.id })
		]);
		if (!view.allowed && !manage.allowed && !approve.allowed && !responsibility.allowed && !link.allowed) {
			throw new RecordNotFoundError(
				'Project information requirements not found in the active member scope.'
			);
		}
		return {
			canManage: manage.allowed,
			canApprove: approve.allowed,
			canManageResponsibilities: responsibility.allowed,
			canLinkEvidence: link.allowed
		};
	}

	private async requirePermission(
		actor: TenantActorContext,
		projectPublicId: string,
		permissionKey:
			| 'information.requirement.manage'
			| 'information.requirement.approve'
			| 'information.responsibility.manage'
			| 'information.requirement.link'
	): Promise<ProjectRecord> {
		const project = await this.findProject(actor, projectPublicId);
		const decision = await new PermissionService(this.db).decide(actor, permissionKey, {
			projectId: project.id
		});
		if (!decision.allowed) {
			throw new TenantAccessError('Project information requirements action is not permitted.');
		}
		return project;
	}

	private async findRequirement(
		db: DatabaseExecutor,
		project: ProjectRecord,
		requirementPublicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('project_information_requirements')
			.selectAll()
			.where('project_id', '=', project.id)
			.where('owning_organisation_id', '=', project.owningOrganisationId)
			.where('public_id', '=', requirementPublicId.trim());
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		if (!row) throw new RecordNotFoundError('Project information requirement not found.');
		return row;
	}

	private async resolveContainerTypeId(
		db: DatabaseExecutor,
		code: string | null
	): Promise<number | null> {
		if (!code) return null;
		const row = await db
			.selectFrom('information_container_types')
			.select('id')
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!row) throw new ProjectInformationRequirementValidationError('Container type is invalid.');
		return row.id;
	}

	private async resolvePurposeId(db: DatabaseExecutor, code: string | null): Promise<number | null> {
		if (!code) return null;
		const row = await db
			.selectFrom('information_purpose_codes')
			.select('id')
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!row) throw new ProjectInformationRequirementValidationError('Purpose code is invalid.');
		return row.id;
	}

	private normalizedInput(input: InformationRequirementInput) {
		return {
			requirementCode: requirementCode(input.requirementCode),
			requirementType: assertRequirementType(input.requirementType),
			title: requiredText(input.title, 'Title', 255),
			description: optionalText(input.description, 10_000),
			containerTypeCode: optionalText(input.containerTypeCode, 32),
			requiredPurposeCode: optionalText(input.requiredPurposeCode, 32),
			requiredSuitabilityCode: optionalText(input.requiredSuitabilityCode, 64),
			requiredByOn: dateOnly(input.requiredByOn, 'Required by date')
		};
	}

	private async audit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		project: ProjectRecord,
		actionKey: string,
		subjectPublicId: string,
		changeSummary?: unknown
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			projectId: project.id,
			actionKey,
			subjectType: 'project_information_requirement',
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary
		});
	}

	async getWorkspace(
		actor: TenantActorContext,
		projectPublicId: string
	): Promise<ProjectInformationRequirementWorkspace> {
		const project = await this.findProject(actor, projectPublicId);
		const flags = await this.permissionFlags(actor, project);

		const [requirementRows, containerTypes, purposeCodes, responsibilityOptions, containerOptions] =
			await Promise.all([
				this.db
					.selectFrom('project_information_requirements as requirement')
					.leftJoin(
						'information_container_types as container_type',
						'container_type.id',
						'requirement.information_container_type_id'
					)
					.leftJoin(
						'information_purpose_codes as purpose',
						'purpose.id',
						'requirement.required_purpose_code_id'
					)
					.select([
						'requirement.id',
						'requirement.public_id',
						'requirement.requirement_code',
						'requirement.requirement_type',
						'requirement.title',
						'requirement.description',
						'requirement.required_suitability_code',
						'requirement.required_by_on',
						'requirement.status',
						'requirement.approved_at',
						'requirement.withdrawn_at',
						'requirement.withdrawal_reason',
						'container_type.code as container_type_code',
						'container_type.name as container_type_name',
						'purpose.code as purpose_code'
					])
					.where('requirement.project_id', '=', project.id)
					.where('requirement.owning_organisation_id', '=', project.owningOrganisationId)
					.orderBy('requirement.requirement_code', 'asc')
					.execute(),
				this.db
					.selectFrom('information_container_types')
					.select(['code', 'name'])
					.where('is_active', '=', 1)
					.orderBy('name', 'asc')
					.execute(),
				this.db
					.selectFrom('information_purpose_codes')
					.select(['code', 'name'])
					.where('is_active', '=', 1)
					.orderBy('code', 'asc')
					.execute(),
				this.db
					.selectFrom('project_organisation_roles as assignment')
					.innerJoin('project_organisations as participation', (join) =>
						join
							.onRef('participation.project_id', '=', 'assignment.project_id')
							.onRef(
								'participation.participant_organisation_id',
								'=',
								'assignment.participant_organisation_id'
							)
					)
					.innerJoin(
						'organisations as organisation',
						'organisation.id',
						'assignment.participant_organisation_id'
					)
					.innerJoin(
						'project_role_types as role',
						'role.id',
						'assignment.project_role_type_id'
					)
					.select([
						'organisation.public_id as organisation_public_id',
						'organisation.legal_name as legal_name',
						'organisation.trading_name as trading_name',
						'role.role_key as role_key',
						'role.name as role_name'
					])
					.where('assignment.project_id', '=', project.id)
					.where('participation.status', '=', 'active')
					.where('role.is_active', '=', 1)
					.orderBy('organisation.legal_name', 'asc')
					.orderBy('role.name', 'asc')
					.execute(),
				this.db
					.selectFrom('information_containers as container')
					.innerJoin(
						'information_container_types as type',
						'type.id',
						'container.information_container_type_id'
					)
					.select([
						'container.public_id as public_id',
						'container.container_number as container_number',
						'container.title as title',
						'type.code as type_code',
						'type.name as type_name'
					])
					.where('container.project_id', '=', project.id)
					.where('container.owning_organisation_id', '=', project.owningOrganisationId)
					.where('container.lifecycle_status', '=', 'active')
					.orderBy('container.container_number', 'asc')
					.execute()
			]);

		const requirementIds = requirementRows.map((row) => row.id);
		const responsibilities =
			requirementIds.length === 0
				? []
				: await this.db
						.selectFrom('project_information_requirement_responsibilities as responsibility')
						.innerJoin(
							'organisations as organisation',
							'organisation.id',
							'responsibility.participant_organisation_id'
						)
						.innerJoin(
							'project_role_types as role',
							'role.id',
							'responsibility.project_role_type_id'
						)
						.select([
							'responsibility.project_information_requirement_id as requirement_id',
							'responsibility.responsibility_code as responsibility_code',
							'organisation.public_id as organisation_public_id',
							'organisation.legal_name as legal_name',
							'organisation.trading_name as trading_name',
							'role.role_key as role_key',
							'role.name as role_name'
						])
						.where('responsibility.project_information_requirement_id', 'in', requirementIds)
						.orderBy('responsibility.responsibility_code', 'asc')
						.execute();

		const linkRows =
			requirementIds.length === 0
				? []
				: await this.db
						.selectFrom('project_information_requirement_containers as link')
						.innerJoin('information_containers as container', (join) =>
							join
								.onRef('container.id', '=', 'link.information_container_id')
								.onRef('container.project_id', '=', 'link.project_id')
								.onRef(
									'container.owning_organisation_id',
									'=',
									'link.container_owner_organisation_id'
								)
						)
						.innerJoin(
							'information_container_types as type',
							'type.id',
							'container.information_container_type_id'
						)
						.innerJoin(
							'organisations as organisation',
							'organisation.id',
							'container.owning_organisation_id'
						)
						.select([
							'link.project_information_requirement_id as requirement_id',
							'container.id as container_id',
							'container.owning_organisation_id as container_owner_organisation_id',
							'container.public_id as container_public_id',
							'container.container_number as container_number',
							'container.title as container_title',
							'type.code as container_type_code',
							'type.name as container_type_name',
							'organisation.legal_name as owner_legal_name',
							'organisation.trading_name as owner_trading_name'
						])
						.where('link.project_information_requirement_id', 'in', requirementIds)
						.execute();

		const containerIds = Array.from(new Set(linkRows.map((row) => row.container_id)));
		const issuedVersions =
			containerIds.length === 0
				? []
				: await this.db
						.selectFrom('information_container_versions as version')
						.leftJoin(
							'information_purpose_codes as purpose',
							'purpose.id',
							'version.information_purpose_code_id'
						)
						.select([
							'version.information_container_id as container_id',
							'version.owning_organisation_id as owner_organisation_id',
							'version.public_id as public_id',
							'version.revision_code as revision_code',
							'version.version_sequence as version_sequence',
							'version.suitability_code as suitability_code',
							'purpose.code as purpose_code'
						])
						.where('version.information_container_id', 'in', containerIds)
						.where('version.version_status', '=', 'issued')
						.orderBy('version.version_sequence', 'desc')
						.execute();

		const responsibilitiesByRequirement = new Map<string, InformationRequirementResponsibility[]>();
		for (const row of responsibilities) {
			const list = responsibilitiesByRequirement.get(row.requirement_id) ?? [];
			list.push({
				organisationPublicId: row.organisation_public_id,
				organisationName: row.trading_name ?? row.legal_name,
				roleKey: row.role_key,
				roleName: row.role_name,
				responsibilityCode: assertResponsibilityCode(row.responsibility_code)
			});
			responsibilitiesByRequirement.set(row.requirement_id, list);
		}

		const linksByRequirement = new Map<string, typeof linkRows>();
		for (const row of linkRows) {
			const list = linksByRequirement.get(row.requirement_id) ?? [];
			list.push(row);
			linksByRequirement.set(row.requirement_id, list);
		}

		const today = this.now().toISOString().slice(0, 10);
		const requirements = requirementRows.map<ProjectInformationRequirementRecord>((row) => {
			const status = requirementStatus(row.status);
			const requirementLinks = linksByRequirement.get(row.id) ?? [];
			const evidence: InformationRequirementEvidence[] = requirementLinks.map((link) => {
				const qualifying = issuedVersions.find(
					(version) =>
						version.container_id === link.container_id &&
						version.owner_organisation_id === link.container_owner_organisation_id &&
						(!row.purpose_code || version.purpose_code === row.purpose_code) &&
						(!row.required_suitability_code ||
							version.suitability_code === row.required_suitability_code)
				);
				return {
					containerPublicId: link.container_public_id,
					containerNumber: link.container_number,
					containerTitle: link.container_title,
					containerTypeCode: link.container_type_code,
					containerTypeName: link.container_type_name,
					containerOwnerOrganisationName:
						link.owner_trading_name ?? link.owner_legal_name,
					qualifyingRevisionPublicId: qualifying?.public_id ?? null,
					qualifyingRevisionCode: qualifying?.revision_code ?? null,
					qualifyingPurposeCode: qualifying?.purpose_code ?? null,
					qualifyingSuitabilityCode: qualifying?.suitability_code ?? null
				};
			});
			const fulfilled = status === 'approved' && evidence.some((item) => item.qualifyingRevisionPublicId);
			const dueDate = row.required_by_on ? asDateOnly(row.required_by_on) : null;
			const health: InformationRequirementHealth =
				status === 'draft'
					? 'draft'
					: status === 'withdrawn'
						? 'withdrawn'
						: fulfilled
							? 'fulfilled'
							: dueDate && dueDate < today
								? 'overdue'
								: 'open';
			return {
				id: row.id,
				publicId: row.public_id,
				requirementCode: row.requirement_code,
				requirementType: assertRequirementType(row.requirement_type),
				title: row.title,
				description: row.description,
				containerTypeCode: row.container_type_code,
				containerTypeName: row.container_type_name,
				requiredPurposeCode: row.purpose_code,
				requiredSuitabilityCode: row.required_suitability_code,
				requiredByOn: row.required_by_on,
				status,
				health,
				approvedAt: row.approved_at,
				withdrawnAt: row.withdrawn_at,
				withdrawalReason: row.withdrawal_reason,
				responsibilities: responsibilitiesByRequirement.get(row.id) ?? [],
				evidence
			};
		});

		return {
			project,
			requirements,
			requirementTypes: [
				{ code: 'OIR', name: 'Organisational information requirement' },
				{ code: 'AIR', name: 'Asset information requirement' },
				{ code: 'PIR', name: 'Project information requirement' },
				{ code: 'EIR', name: 'Exchange information requirement' }
			],
			containerTypes,
			purposeCodes,
			responsibilityOptions: responsibilityOptions.map((option) => ({
				organisationPublicId: option.organisation_public_id,
				organisationName: option.trading_name ?? option.legal_name,
				roleKey: option.role_key,
				roleName: option.role_name
			})),
			containerOptions: containerOptions.map((container) => ({
				publicId: container.public_id,
				containerNumber: container.container_number,
				title: container.title,
				typeCode: container.type_code,
				typeName: container.type_name
			})),
			...flags
		};
	}

	async createRequirement(
		actor: TenantActorContext,
		input: InformationRequirementInput
	): Promise<string> {
		const project = await this.requirePermission(
			actor,
			input.projectPublicId,
			'information.requirement.manage'
		);
		const normalized = this.normalizedInput(input);
		const publicId = this.publicIdFactory();

		await this.db.transaction().execute(async (trx) => {
			const existing = await trx
				.selectFrom('project_information_requirements')
				.select('id')
				.where('project_id', '=', project.id)
				.where('owning_organisation_id', '=', project.owningOrganisationId)
				.where('requirement_code', '=', normalized.requirementCode)
				.executeTakeFirst();
			if (existing) {
				throw new ProjectInformationRequirementValidationError(
					'Requirement code is already in use on this project.'
				);
			}
			const [containerTypeId, purposeId] = await Promise.all([
				this.resolveContainerTypeId(trx, normalized.containerTypeCode),
				this.resolvePurposeId(trx, normalized.requiredPurposeCode)
			]);
			await trx
				.insertInto('project_information_requirements')
				.values({
					project_id: project.id,
					owning_organisation_id: project.owningOrganisationId,
					public_id: publicId,
					requirement_code: normalized.requirementCode,
					requirement_type: normalized.requirementType,
					title: normalized.title,
					description: normalized.description,
					information_container_type_id: containerTypeId,
					required_purpose_code_id: purposeId,
					required_suitability_code: normalized.requiredSuitabilityCode,
					required_by_on: normalized.requiredByOn,
					status: 'draft',
					created_by_member_id: actor.memberId,
					approved_by_member_id: null,
					approved_at: null,
					withdrawn_by_member_id: null,
					withdrawn_at: null,
					withdrawal_reason: null
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project, 'information.requirement.created', publicId, {
				requirementCode: normalized.requirementCode,
				requirementType: normalized.requirementType
			});
		});
		return publicId;
	}

	async updateRequirement(
		actor: TenantActorContext,
		input: InformationRequirementInput & { requirementPublicId: string }
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			input.projectPublicId,
			'information.requirement.manage'
		);
		const normalized = this.normalizedInput(input);
		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, input.requirementPublicId, true);
			if (requirement.status !== 'draft') {
				throw new ProjectInformationRequirementValidationError(
					'Only draft information requirements can be edited.'
				);
			}
			const duplicate = await trx
				.selectFrom('project_information_requirements')
				.select('id')
				.where('project_id', '=', project.id)
				.where('owning_organisation_id', '=', project.owningOrganisationId)
				.where('requirement_code', '=', normalized.requirementCode)
				.where('id', '!=', requirement.id)
				.executeTakeFirst();
			if (duplicate) {
				throw new ProjectInformationRequirementValidationError(
					'Requirement code is already in use on this project.'
				);
			}
			const [containerTypeId, purposeId] = await Promise.all([
				this.resolveContainerTypeId(trx, normalized.containerTypeCode),
				this.resolvePurposeId(trx, normalized.requiredPurposeCode)
			]);
			await trx
				.updateTable('project_information_requirements')
				.set({
					requirement_code: normalized.requirementCode,
					requirement_type: normalized.requirementType,
					title: normalized.title,
					description: normalized.description,
					information_container_type_id: containerTypeId,
					required_purpose_code_id: purposeId,
					required_suitability_code: normalized.requiredSuitabilityCode,
					required_by_on: normalized.requiredByOn
				})
				.where('id', '=', requirement.id)
				.where('status', '=', 'draft')
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.updated',
				requirement.public_id,
				{ requirementCode: normalized.requirementCode }
			);
		});
	}

	async replaceResponsibilities(
		actor: TenantActorContext,
		input: {
			projectPublicId: string;
			requirementPublicId: string;
			responsibilities: InformationResponsibilityInput[];
		}
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			input.projectPublicId,
			'information.responsibility.manage'
		);
		const normalized = Array.from(
			new Map(
				input.responsibilities.map((entry) => {
					const organisationPublicId = requiredText(
						entry.organisationPublicId,
						'Organisation',
						36
					);
					const roleKey = requiredText(entry.roleKey, 'Project role', 96);
					const responsibilityCode = assertResponsibilityCode(entry.responsibilityCode);
					return [
						`${organisationPublicId}|${roleKey}|${responsibilityCode}`,
						{ organisationPublicId, roleKey, responsibilityCode }
					];
				})
			).values()
		);
		if (normalized.length > 64) {
			throw new ProjectInformationRequirementValidationError(
				'A responsibility matrix may contain at most 64 assignments per requirement.'
			);
		}

		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, input.requirementPublicId, true);
			if (requirement.status !== 'draft') {
				throw new ProjectInformationRequirementValidationError(
					'Responsibilities are locked when an information requirement is approved.'
				);
			}
			const rows: Array<{
				project_information_requirement_id: string;
				project_id: string;
				requirement_owner_organisation_id: string;
				participant_organisation_id: string;
				project_role_type_id: string;
				responsibility_code: InformationResponsibilityCode;
				assigned_by_member_id: string;
			}> = [];
			for (const entry of normalized) {
				const assignment = await trx
					.selectFrom('project_organisation_roles as assignment')
					.innerJoin('project_organisations as participation', (join) =>
						join
							.onRef('participation.project_id', '=', 'assignment.project_id')
							.onRef(
								'participation.participant_organisation_id',
								'=',
								'assignment.participant_organisation_id'
							)
					)
					.innerJoin(
						'organisations as organisation',
						'organisation.id',
						'assignment.participant_organisation_id'
					)
					.innerJoin(
						'project_role_types as role',
						'role.id',
						'assignment.project_role_type_id'
					)
					.select([
						'assignment.participant_organisation_id as organisation_id',
						'assignment.project_role_type_id as role_id'
					])
					.where('assignment.project_id', '=', project.id)
					.where('organisation.public_id', '=', entry.organisationPublicId)
					.where('role.role_key', '=', entry.roleKey)
					.where('participation.status', '=', 'active')
					.where('role.is_active', '=', 1)
					.executeTakeFirst();
				if (!assignment) {
					throw new ProjectInformationRequirementValidationError(
						'Responsibility must reference an active project organisation role.'
					);
				}
				rows.push({
					project_information_requirement_id: requirement.id,
					project_id: project.id,
					requirement_owner_organisation_id: project.owningOrganisationId,
					participant_organisation_id: assignment.organisation_id,
					project_role_type_id: assignment.role_id,
					responsibility_code: entry.responsibilityCode,
					assigned_by_member_id: actor.memberId
				});
			}
			await trx
				.deleteFrom('project_information_requirement_responsibilities')
				.where('project_information_requirement_id', '=', requirement.id)
				.execute();
			if (rows.length > 0) {
				await trx
					.insertInto('project_information_requirement_responsibilities')
					.values(rows)
					.execute();
			}
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.responsibilities_replaced',
				requirement.public_id,
				{ assignments: normalized }
			);
		});
	}

	async approveRequirement(
		actor: TenantActorContext,
		projectPublicId: string,
		requirementPublicId: string
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			projectPublicId,
			'information.requirement.approve'
		);
		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, requirementPublicId, true);
			if (requirement.status !== 'draft') {
				throw new ProjectInformationRequirementValidationError(
					'Only draft information requirements can be approved.'
				);
			}
			const responsibility = await trx
				.selectFrom('project_information_requirement_responsibilities')
				.select('project_information_requirement_id')
				.where('project_information_requirement_id', '=', requirement.id)
				.where('responsibility_code', 'in', ['responsible', 'accountable'])
				.executeTakeFirst();
			if (!responsibility) {
				throw new ProjectInformationRequirementValidationError(
					'An approved information requirement needs at least one Responsible or Accountable assignment.'
				);
			}
			const now = this.now();
			await trx
				.updateTable('project_information_requirements')
				.set({ status: 'approved', approved_by_member_id: actor.memberId, approved_at: now })
				.where('id', '=', requirement.id)
				.where('status', '=', 'draft')
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.approved',
				requirement.public_id
			);
		});
	}

	async withdrawRequirement(
		actor: TenantActorContext,
		projectPublicId: string,
		requirementPublicId: string,
		reason: string
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			projectPublicId,
			'information.requirement.approve'
		);
		const normalizedReason = requiredText(reason, 'Withdrawal reason', 2_000);
		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, requirementPublicId, true);
			if (requirement.status !== 'approved') {
				throw new ProjectInformationRequirementValidationError(
					'Only approved information requirements can be withdrawn.'
				);
			}
			const now = this.now();
			await trx
				.updateTable('project_information_requirements')
				.set({
					status: 'withdrawn',
					withdrawn_by_member_id: actor.memberId,
					withdrawn_at: now,
					withdrawal_reason: normalizedReason
				})
				.where('id', '=', requirement.id)
				.where('status', '=', 'approved')
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.withdrawn',
				requirement.public_id,
				{ reason: normalizedReason }
			);
		});
	}

	async linkContainer(
		actor: TenantActorContext,
		projectPublicId: string,
		requirementPublicId: string,
		containerPublicId: string
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			projectPublicId,
			'information.requirement.link'
		);
		const normalizedContainerPublicId = requiredText(containerPublicId, 'Information container', 36);
		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, requirementPublicId, true);
			if (requirement.status === 'withdrawn') {
				throw new ProjectInformationRequirementValidationError(
					'Withdrawn information requirements cannot receive fulfilment evidence.'
				);
			}
			const container = await trx
				.selectFrom('information_containers')
				.select(['id', 'owning_organisation_id', 'public_id'])
				.where('project_id', '=', project.id)
				.where('owning_organisation_id', '=', project.owningOrganisationId)
				.where('public_id', '=', normalizedContainerPublicId)
				.where('lifecycle_status', '=', 'active')
				.executeTakeFirst();
			if (!container) {
				throw new ProjectInformationRequirementValidationError(
					'Only active containers in the owning organisation CDE can be linked in this slice.'
				);
			}
			await trx
				.insertInto('project_information_requirement_containers')
				.ignore()
				.values({
					project_information_requirement_id: requirement.id,
					project_id: project.id,
					requirement_owner_organisation_id: project.owningOrganisationId,
					information_container_id: container.id,
					container_owner_organisation_id: container.owning_organisation_id,
					link_role: 'fulfilment',
					linked_by_member_id: actor.memberId
				})
				.execute();
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.container_linked',
				requirement.public_id,
				{ containerPublicId: container.public_id }
			);
		});
	}

	async unlinkContainer(
		actor: TenantActorContext,
		projectPublicId: string,
		requirementPublicId: string,
		containerPublicId: string
	): Promise<void> {
		const project = await this.requirePermission(
			actor,
			projectPublicId,
			'information.requirement.link'
		);
		const normalizedContainerPublicId = requiredText(containerPublicId, 'Information container', 36);
		await this.db.transaction().execute(async (trx) => {
			const requirement = await this.findRequirement(trx, project, requirementPublicId, true);
			if (requirement.status === 'withdrawn') {
				throw new ProjectInformationRequirementValidationError(
					'Withdrawn information requirements cannot be changed.'
				);
			}
			const container = await trx
				.selectFrom('information_containers')
				.select(['id', 'owning_organisation_id', 'public_id'])
				.where('project_id', '=', project.id)
				.where('owning_organisation_id', '=', project.owningOrganisationId)
				.where('public_id', '=', normalizedContainerPublicId)
				.executeTakeFirst();
			if (!container) throw new RecordNotFoundError('Information container not found.');
			await trx
				.deleteFrom('project_information_requirement_containers')
				.where('project_information_requirement_id', '=', requirement.id)
				.where('information_container_id', '=', container.id)
				.where('container_owner_organisation_id', '=', container.owning_organisation_id)
				.execute();
			await this.audit(
				trx,
				actor,
				project,
				'information.requirement.container_unlinked',
				requirement.public_id,
				{ containerPublicId: container.public_id }
			);
		});
	}
}