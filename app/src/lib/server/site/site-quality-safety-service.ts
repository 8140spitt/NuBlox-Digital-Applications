import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProjectRepository, type ProjectRecord } from '$lib/server/projects/project-repository';
import {
	SiteQualitySafetyRepository,
	type InspectionFindingSummary,
	type InspectionResponseSummary,
	type InspectionSummary,
	type InspectionTemplateItem,
	type SafetyActionSummary,
	type SafetyEventSummary
} from './site-quality-safety-repository';

export class SiteQualitySafetyValidationError extends Error {
	readonly code = 'SITE_QUALITY_SAFETY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'SiteQualitySafetyValidationError';
	}
}

export type InspectionWorkspaceRecord = InspectionSummary & {
	items: Array<
		InspectionTemplateItem & {
			response: InspectionResponseSummary | null;
		}
	>;
	findings: InspectionFindingSummary[];
};

export type SafetyWorkspaceRecord = SafetyEventSummary & {
	actions: SafetyActionSummary[];
};

export type SiteQualitySafetyWorkspace = {
	canViewSite: boolean;
	canManageSites: boolean;
	canManageDiaries: boolean;
	canSubmitDiaries: boolean;
	canApproveDiaries: boolean;
	canViewQuality: boolean;
	canManageTemplates: boolean;
	canManageInspections: boolean;
	canManageDefects: boolean;
	canManageNcrs: boolean;
	canViewSafety: boolean;
	canManageSafetyEvents: boolean;
	canManageSafetyActions: boolean;
	canLinkEvidence: boolean;
	projects: ProjectRecord[];
	selectedProjectPublicId: string | null;
	sites: Awaited<ReturnType<SiteQualitySafetyRepository['listSites']>>;
	diaries: Awaited<ReturnType<SiteQualitySafetyRepository['listDiaries']>>;
	templates: Awaited<ReturnType<SiteQualitySafetyRepository['listPublishedTemplates']>>;
	inspections: InspectionWorkspaceRecord[];
	findingTypes: Awaited<ReturnType<SiteQualitySafetyRepository['listFindingTypes']>>;
	defects: Awaited<ReturnType<SiteQualitySafetyRepository['listDefects']>>;
	ncrs: Awaited<ReturnType<SiteQualitySafetyRepository['listNcrs']>>;
	safetyEvents: SafetyWorkspaceRecord[];
	evidenceVersions: Awaited<ReturnType<SiteQualitySafetyRepository['listEvidenceVersions']>>;
};

export type CreateSiteInput = {
	projectPublicId: string;
	siteCode: string;
	name: string;
	timezone?: string | null;
};

export type CreateDiaryInput = {
	projectPublicId: string;
	sitePublicId: string;
	diaryDate: string;
	shiftLabel?: string | null;
	summary?: string | null;
	activityDescription: string;
	locationDescription?: string | null;
	progressPercent?: string | null;
};

export type CreateInspectionTemplateInput = {
	code: string;
	name: string;
	description?: string | null;
	checklistPrompts: string;
};

export type CreateInspectionInput = {
	projectPublicId: string;
	sitePublicId: string;
	templateVersionPublicId: string;
	title: string;
	locationDescription?: string | null;
};

export type RecordInspectionResponseInput = {
	inspectionPublicId: string;
	templateItemId: string;
	resultCode: string;
	comments?: string | null;
};

export type RaiseInspectionFindingInput = {
	inspectionPublicId: string;
	templateItemId?: string | null;
	findingTypeCode: string;
	title: string;
	description: string;
	severity: string;
};

export type CreateDefectInput = {
	projectPublicId: string;
	sitePublicId: string;
	title: string;
	description: string;
	locationDescription?: string | null;
	severity: string;
	targetDate?: string | null;
	findingPublicId?: string | null;
};

export type CreateNcrInput = {
	projectPublicId: string;
	sitePublicId: string;
	title: string;
	statement: string;
	severity: string;
	immediateContainment?: string | null;
	targetDate?: string | null;
	findingPublicId?: string | null;
};

export type CreateSafetyObservationInput = {
	projectPublicId: string;
	sitePublicId: string;
	title: string;
	description: string;
	locationDescription?: string | null;
	occurredAt: string;
	observationCategory: string;
	isPositiveObservation: boolean;
	immediateActionTaken?: string | null;
};

export type CreateSafetyActionInput = {
	safetyEventPublicId: string;
	actionType: string;
	actionText: string;
	targetDate?: string | null;
};

export type LinkEvidenceInput = {
	projectPublicId: string;
	subjectType: 'diary' | 'defect' | 'ncr' | 'safety';
	subjectPublicId: string;
	informationVersionPublicId: string;
	linkRole: 'evidence' | 'photo';
};

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new SiteQualitySafetyValidationError(`${label} is required.`);
	if (text.length > max) throw new SiteQualitySafetyValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max = 1000): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max) throw new SiteQualitySafetyValidationError('A supplied value is too long.');
	return text;
}

function publicId(value: string, label: string): string {
	const text = requiredText(value, label, 36);
	if (!/^[0-9a-f-]{36}$/i.test(text)) throw new SiteQualitySafetyValidationError(`${label} is invalid.`);
	return text;
}

function safeId(value: string, label: string): string {
	const text = requiredText(value, label, 24);
	if (!/^\d+$/.test(text) || text === '0') throw new SiteQualitySafetyValidationError(`${label} is invalid.`);
	return text;
}

function dateOnly(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new SiteQualitySafetyValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime())) throw new SiteQualitySafetyValidationError(`${label} is invalid.`);
	return parsed;
}

function dateTime(value: string, label: string): Date {
	const text = requiredText(value, label, 64);
	const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}:00.000Z`;
	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime())) throw new SiteQualitySafetyValidationError(`${label} is invalid.`);
	return parsed;
}

function severity(value: string): 'low' | 'medium' | 'high' | 'critical' {
	if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical') return value;
	throw new SiteQualitySafetyValidationError('Severity is invalid.');
}

function responseResult(value: string): 'pass' | 'fail' | 'not_applicable' | 'observation' {
	if (value === 'pass' || value === 'fail' || value === 'not_applicable' || value === 'observation') return value;
	throw new SiteQualitySafetyValidationError('Inspection result is invalid.');
}

function observationCategory(value: string): 'condition' | 'behaviour' | 'process' | 'housekeeping' | 'environment' | 'other' {
	if (
		value === 'condition' ||
		value === 'behaviour' ||
		value === 'process' ||
		value === 'housekeeping' ||
		value === 'environment' ||
		value === 'other'
	) return value;
	throw new SiteQualitySafetyValidationError('Observation category is invalid.');
}

function safetyActionType(value: string): 'immediate' | 'corrective' | 'preventive' | 'investigation' | 'verification' {
	if (
		value === 'immediate' ||
		value === 'corrective' ||
		value === 'preventive' ||
		value === 'investigation' ||
		value === 'verification'
	) return value;
	throw new SiteQualitySafetyValidationError('Safety action type is invalid.');
}

function progress(value: string | null | undefined): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	const number = Number(text);
	if (!Number.isFinite(number) || number < 0 || number > 100)
		throw new SiteQualitySafetyValidationError('Progress must be between 0 and 100.');
	return number.toFixed(2);
}

function reference(prefix: string, id: string, now: Date): string {
	const date = now.toISOString().slice(0, 10).replaceAll('-', '');
	return `${prefix}-${date}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('MySQL did not return the inserted ID.');
	return result.insertId.toString();
}

export class SiteQualitySafetyService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
		return membership;
	}

	private async allowed(actor: TenantActorContext, permissionKey: string): Promise<boolean> {
		return (await new PermissionService(this.db).decide(actor, permissionKey)).allowed;
	}

	private async requirePermission(
		actor: TenantActorContext,
		permissionKey: string,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decide(actor, permissionKey);
		if (!decision.allowed) throw new TenantAccessError('This site, quality or safety action is not permitted.');
	}

	private async requireProject(
		actor: TenantActorContext,
		projectPublicIdInput: string,
		db: DatabaseExecutor = this.db
	): Promise<ProjectRecord> {
		const project = await new ProjectRepository(db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId(projectPublicIdInput, 'Project')
		);
		if (!project) throw new TenantAccessError('The project is outside your effective project scope.');
		return project;
	}

	private async requireSite(
		actor: TenantActorContext,
		project: ProjectRecord,
		sitePublicIdInput: string,
		db: DatabaseExecutor = this.db
	) {
		const site = await new SiteQualitySafetyRepository(db).findSiteByPublicId(
			project.id,
			publicId(sitePublicIdInput, 'Site')
		);
		if (!site || !site.isActive) throw new SiteQualitySafetyValidationError('Site is not available for this project.');
		return site;
	}

	async getWorkspace(
		actor: TenantActorContext,
		selectedProjectPublicId?: string | null
	): Promise<SiteQualitySafetyWorkspace> {
		await this.assertActiveActor(actor);
		const [
			canViewSite,
			canManageSites,
			canManageDiaries,
			canSubmitDiaries,
			canApproveDiaries,
			canViewQuality,
			canManageTemplates,
			canManageInspections,
			canManageDefects,
			canManageNcrs,
			canViewSafety,
			canManageSafetyEvents,
			canManageSafetyActions,
			canViewInformation
		] = await Promise.all([
			this.allowed(actor, 'site.view'),
			this.allowed(actor, 'site.manage'),
			this.allowed(actor, 'site.diary.manage'),
			this.allowed(actor, 'site.diary.submit'),
			this.allowed(actor, 'site.diary.approve'),
			this.allowed(actor, 'quality.view'),
			this.allowed(actor, 'quality.template.manage'),
			this.allowed(actor, 'quality.inspection.manage'),
			this.allowed(actor, 'quality.defect.manage'),
			this.allowed(actor, 'quality.ncr.manage'),
			this.allowed(actor, 'safety.view'),
			this.allowed(actor, 'safety.event.manage'),
			this.allowed(actor, 'safety.action.manage'),
			this.allowed(actor, 'information.view')
		]);
		const canReadAny = canViewSite || canViewQuality || canViewSafety;
		if (!canReadAny) {
			return {
				canViewSite,
				canManageSites,
				canManageDiaries,
				canSubmitDiaries,
				canApproveDiaries,
				canViewQuality,
				canManageTemplates,
				canManageInspections,
				canManageDefects,
				canManageNcrs,
				canViewSafety,
				canManageSafetyEvents,
				canManageSafetyActions,
				canLinkEvidence: false,
				projects: [],
				selectedProjectPublicId: null,
				sites: [],
				diaries: [],
				templates: [],
				inspections: [],
				findingTypes: [],
				defects: [],
				ncrs: [],
				safetyEvents: [],
				evidenceVersions: []
			};
		}

		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const selectedProject = selectedProjectPublicId
			? projects.find((project) => project.publicId === selectedProjectPublicId) ?? null
			: projects[0] ?? null;
		if (!selectedProject) {
			return {
				canViewSite,
				canManageSites,
				canManageDiaries,
				canSubmitDiaries,
				canApproveDiaries,
				canViewQuality,
				canManageTemplates,
				canManageInspections,
				canManageDefects,
				canManageNcrs,
				canViewSafety,
				canManageSafetyEvents,
				canManageSafetyActions,
				canLinkEvidence: false,
				projects,
				selectedProjectPublicId: null,
				sites: [],
				diaries: [],
				templates: [],
				inspections: [],
				findingTypes: [],
				defects: [],
				ncrs: [],
				safetyEvents: [],
				evidenceVersions: []
			};
		}

		const repository = new SiteQualitySafetyRepository(this.db);
		const [sites, diaries, templates, rawInspections, findingTypes, defects, ncrs, rawSafetyEvents, evidenceVersions] =
			await Promise.all([
				repository.listSites(selectedProject.id),
				canViewSite ? repository.listDiaries(selectedProject.id, actor.organisationId) : Promise.resolve([]),
				canViewQuality ? repository.listPublishedTemplates(actor.organisationId) : Promise.resolve([]),
				canViewQuality ? repository.listInspections(selectedProject.id, actor.organisationId) : Promise.resolve([]),
				canViewQuality ? repository.listFindingTypes() : Promise.resolve([]),
				canViewQuality ? repository.listDefects(selectedProject.id, actor.organisationId) : Promise.resolve([]),
				canViewQuality ? repository.listNcrs(selectedProject.id, actor.organisationId) : Promise.resolve([]),
				canViewSafety ? repository.listSafetyEvents(selectedProject.id, actor.organisationId) : Promise.resolve([]),
				canViewInformation
					? repository.listEvidenceVersions(selectedProject.id, actor.organisationId)
					: Promise.resolve([])
			]);

		const inspectionIds = rawInspections.map((inspection) => inspection.id);
		const [responses, findings] = await Promise.all([
			repository.listInspectionResponses(actor.organisationId, inspectionIds),
			repository.listInspectionFindings(actor.organisationId, inspectionIds)
		]);
		const inspections: InspectionWorkspaceRecord[] = [];
		for (const inspection of rawInspections) {
			const items = await repository.listTemplateItems(actor.organisationId, inspection.templateVersionId);
			inspections.push({
				...inspection,
				items: items.map((item) => ({
					...item,
					response:
						responses.find(
							(response) =>
								response.inspectionId === inspection.id && response.templateItemId === item.id
						) ?? null
				})),
				findings: findings.filter((finding) => finding.inspectionId === inspection.id)
			});
		}
		const actions = await repository.listSafetyActions(
			actor.organisationId,
			rawSafetyEvents.map((event) => event.id)
		);
		const safetyEvents = rawSafetyEvents.map((event) => ({
			...event,
			actions: actions.filter((action) => action.safetyEventId === event.id)
		}));

		return {
			canViewSite,
			canManageSites,
			canManageDiaries,
			canSubmitDiaries,
			canApproveDiaries,
			canViewQuality,
			canManageTemplates,
			canManageInspections,
			canManageDefects,
			canManageNcrs,
			canViewSafety,
			canManageSafetyEvents,
			canManageSafetyActions,
			canLinkEvidence: canViewInformation && evidenceVersions.length > 0,
			projects,
			selectedProjectPublicId: selectedProject.publicId,
			sites,
			diaries,
			templates,
			inspections,
			findingTypes,
			defects,
			ncrs,
			safetyEvents,
			evidenceVersions
		};
	}

	async createSite(actor: TenantActorContext, input: CreateSiteInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'site.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		if (project.owningOrganisationId !== actor.organisationId) {
			throw new TenantAccessError('Project site identities are controlled by the project-owning organisation.');
		}
		const siteCode = requiredText(input.siteCode, 'Site code', 80);
		const name = requiredText(input.name, 'Site name', 255);
		const timezone = optionalText(input.timezone, 64);
		if (timezone) {
			try {
				new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(this.now());
			} catch {
				throw new SiteQualitySafetyValidationError('A valid IANA timezone is required.');
			}
		}
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('project_sites')
				.values({
					project_id: project.id,
					owning_organisation_id: actor.organisationId,
					public_id: id,
					site_code: siteCode,
					name,
					address_id: null,
					timezone,
					is_active: 1
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'site.create', 'project_site', id, { siteCode, name });
		});
		return id;
	}

	async createDiary(actor: TenantActorContext, input: CreateDiaryInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'site.diary.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const site = await this.requireSite(actor, project, input.sitePublicId);
		const diaryDate = dateOnly(input.diaryDate, 'Diary date');
		if (!diaryDate) throw new SiteQualitySafetyValidationError('Diary date is required.');
		const activityDescription = requiredText(input.activityDescription, 'Activity description', 4000);
		const diaryPublicId = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			const diaryId = insertedId(
				await trx
					.insertInto('site_diaries')
					.values({
						project_id: project.id,
						owning_organisation_id: actor.organisationId,
						project_site_id: site.id,
						public_id: diaryPublicId,
						diary_date: diaryDate,
						shift_label: optionalText(input.shiftLabel, 80),
						status: 'draft',
						summary: optionalText(input.summary, 4000),
						created_by_member_id: actor.memberId,
						submitted_by_member_id: null,
						submitted_at: null,
						approved_by_member_id: null,
						approved_at: null,
						locked_at: null
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('site_diary_activities')
				.values({
					site_diary_id: diaryId,
					owning_organisation_id: actor.organisationId,
					activity_reference: null,
					description: activityDescription,
					location_description: optionalText(input.locationDescription, 255),
					progress_percent: progress(input.progressPercent),
					started_at: null,
					ended_at: null
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'site.diary.create', 'site_diary', diaryPublicId, {
				sitePublicId: site.publicId,
				diaryDate: input.diaryDate
			});
		});
		return diaryPublicId;
	}

	async submitDiary(actor: TenantActorContext, diaryPublicIdInput: string): Promise<void> {
		await this.transitionDiary(actor, diaryPublicIdInput, 'submitted');
	}

	async approveDiary(actor: TenantActorContext, diaryPublicIdInput: string): Promise<void> {
		await this.transitionDiary(actor, diaryPublicIdInput, 'approved');
	}

	private async transitionDiary(
		actor: TenantActorContext,
		diaryPublicIdInput: string,
		target: 'submitted' | 'approved'
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, target === 'submitted' ? 'site.diary.submit' : 'site.diary.approve');
		const diaryPublicId = publicId(diaryPublicIdInput, 'Site diary');
		await this.db.transaction().execute(async (trx) => {
			const diary = await trx
				.selectFrom('site_diaries')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', diaryPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!diary) throw new TenantAccessError('Site diary not found.');
			const project = await this.requireProjectById(actor, diary.project_id, trx);
			const now = this.now();
			if (target === 'submitted') {
				if (diary.status !== 'draft') throw new SiteQualitySafetyValidationError('Only a draft diary can be submitted.');
				await trx
					.updateTable('site_diaries')
					.set({ status: 'submitted', submitted_by_member_id: actor.memberId, submitted_at: now })
					.where('id', '=', diary.id)
					.executeTakeFirstOrThrow();
			} else {
				if (diary.status !== 'submitted') throw new SiteQualitySafetyValidationError('Only a submitted diary can be approved.');
				await trx
					.updateTable('site_diaries')
					.set({ status: 'approved', approved_by_member_id: actor.memberId, approved_at: now })
					.where('id', '=', diary.id)
					.executeTakeFirstOrThrow();
			}
			await this.audit(trx, actor, project.id, `site.diary.${target}`, 'site_diary', diaryPublicId, {
				fromStatus: diary.status,
				toStatus: target
			});
		});
	}

	async createInspectionTemplate(
		actor: TenantActorContext,
		input: CreateInspectionTemplateInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.template.manage');
		const code = requiredText(input.code, 'Template code', 80);
		const name = requiredText(input.name, 'Template name', 255);
		const prompts = input.checklistPrompts
			.split(/\r?\n/)
			.map((prompt) => prompt.trim())
			.filter(Boolean);
		if (prompts.length === 0) throw new SiteQualitySafetyValidationError('At least one checklist prompt is required.');
		if (prompts.length > 20) throw new SiteQualitySafetyValidationError('A V1 checklist may contain up to 20 prompts.');
		for (const prompt of prompts) requiredText(prompt, 'Checklist prompt', 1000);
		const templatePublicId = this.publicIdFactory();
		const versionPublicId = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const itemType = await trx
				.selectFrom('quality_inspection_item_types')
				.select('id')
				.where('code', '=', 'acknowledgement')
				.where('is_active', '=', 1)
				.executeTakeFirstOrThrow();
			const templateId = insertedId(
				await trx
					.insertInto('quality_inspection_templates')
					.values({
						organisation_id: actor.organisationId,
						public_id: templatePublicId,
						code,
						name,
						description: optionalText(input.description, 4000),
						is_active: 1,
						created_by_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow()
			);
			const versionId = insertedId(
				await trx
					.insertInto('quality_inspection_template_versions')
					.values({
						organisation_id: actor.organisationId,
						quality_inspection_template_id: templateId,
						public_id: versionPublicId,
						version_number: 1,
						status: 'published',
						published_at: now,
						published_by_member_id: actor.memberId,
						created_by_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow()
			);
			const sectionId = insertedId(
				await trx
					.insertInto('quality_inspection_template_sections')
					.values({
						organisation_id: actor.organisationId,
						quality_inspection_template_version_id: versionId,
						section_number: 1,
						title: 'Checklist',
						description: null
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('quality_inspection_template_items')
				.values(
					prompts.map((prompt, index) => ({
						organisation_id: actor.organisationId,
						quality_inspection_template_version_id: versionId,
						quality_inspection_template_section_id: sectionId,
						item_number: index + 1,
						quality_inspection_item_type_id: itemType.id,
						prompt_text: prompt,
						guidance_text: null,
						is_required: 1,
						allow_finding: 1
					}))
				)
				.execute();
			await this.audit(trx, actor, null, 'quality.template.publish', 'quality_inspection_template', templatePublicId, {
				code,
				versionPublicId,
				itemCount: prompts.length
			});
		});
		return templatePublicId;
	}

	async createInspection(actor: TenantActorContext, input: CreateInspectionInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.inspection.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const site = await this.requireSite(actor, project, input.sitePublicId);
		const template = await new SiteQualitySafetyRepository(this.db).findTemplateVersionByPublicId(
			actor.organisationId,
			publicId(input.templateVersionPublicId, 'Inspection template version')
		);
		if (!template || template.status !== 'published')
			throw new SiteQualitySafetyValidationError('Inspection template must be a published exact version.');
		const inspectionPublicId = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('quality_inspections')
				.values({
					project_id: project.id,
					owning_organisation_id: actor.organisationId,
					project_site_id: site.id,
					public_id: inspectionPublicId,
					inspection_number: reference('INS', inspectionPublicId, now),
					quality_inspection_template_version_id: template.id,
					title: requiredText(input.title, 'Inspection title', 500),
					location_description: optionalText(input.locationDescription, 255),
					status: 'in_progress',
					scheduled_at: null,
					started_at: now,
					completed_at: null,
					inspected_by_member_id: actor.memberId
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'quality.inspection.create', 'quality_inspection', inspectionPublicId, {
				sitePublicId: site.publicId,
				templateVersionPublicId: template.publicId
			});
		});
		return inspectionPublicId;
	}

	async recordInspectionResponse(
		actor: TenantActorContext,
		input: RecordInspectionResponseInput
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.inspection.manage');
		const inspectionPublicId = publicId(input.inspectionPublicId, 'Inspection');
		const itemId = safeId(input.templateItemId, 'Checklist item');
		const resultCode = responseResult(input.resultCode);
		await this.db.transaction().execute(async (trx) => {
			const inspection = await trx
				.selectFrom('quality_inspections')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', inspectionPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!inspection) throw new TenantAccessError('Inspection not found.');
			await this.requireProjectById(actor, inspection.project_id, trx);
			if (inspection.status !== 'in_progress')
				throw new SiteQualitySafetyValidationError('Only an in-progress inspection can be updated.');
			const item = await trx
				.selectFrom('quality_inspection_template_items')
				.select(['id', 'quality_inspection_template_version_id'])
				.where('id', '=', itemId)
				.where('organisation_id', '=', actor.organisationId)
				.where('quality_inspection_template_version_id', '=', inspection.quality_inspection_template_version_id)
				.executeTakeFirst();
			if (!item) throw new SiteQualitySafetyValidationError('Checklist item does not belong to this inspection definition.');
			const existing = await trx
				.selectFrom('quality_inspection_responses')
				.select('id')
				.where('quality_inspection_id', '=', inspection.id)
				.where('quality_inspection_template_item_id', '=', itemId)
				.executeTakeFirst();
			const responseBoolean = resultCode === 'pass' ? 1 : resultCode === 'fail' ? 0 : null;
			if (existing) {
				await trx
					.updateTable('quality_inspection_responses')
					.set({
						result_code: resultCode,
						response_text: null,
						response_decimal: null,
						response_boolean: responseBoolean,
						response_date: null,
						selected_option_id: null,
						comments: optionalText(input.comments, 4000),
						responded_by_member_id: actor.memberId,
						responded_at: this.now()
					})
					.where('id', '=', existing.id)
					.executeTakeFirstOrThrow();
			} else {
				await trx
					.insertInto('quality_inspection_responses')
					.values({
						quality_inspection_id: inspection.id,
						owning_organisation_id: actor.organisationId,
						quality_inspection_template_version_id: inspection.quality_inspection_template_version_id,
						quality_inspection_template_item_id: itemId,
						result_code: resultCode,
						response_text: null,
						response_decimal: null,
						response_boolean: responseBoolean,
						response_date: null,
						selected_option_id: null,
						comments: optionalText(input.comments, 4000),
						responded_by_member_id: actor.memberId,
						responded_at: this.now()
					})
					.executeTakeFirstOrThrow();
			}
			await this.audit(trx, actor, inspection.project_id, 'quality.inspection.respond', 'quality_inspection', inspectionPublicId, {
				itemId,
				resultCode
			});
		});
	}

	async raiseInspectionFinding(
		actor: TenantActorContext,
		input: RaiseInspectionFindingInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.inspection.manage');
		const inspectionPublicId = publicId(input.inspectionPublicId, 'Inspection');
		const findingPublicId = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			const inspection = await trx
				.selectFrom('quality_inspections')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', inspectionPublicId)
				.executeTakeFirst();
			if (!inspection) throw new TenantAccessError('Inspection not found.');
			await this.requireProjectById(actor, inspection.project_id, trx);
			const findingType = await trx
				.selectFrom('quality_finding_types')
				.select('id')
				.where('code', '=', requiredText(input.findingTypeCode, 'Finding type', 48))
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!findingType) throw new SiteQualitySafetyValidationError('Finding type is invalid.');
			let responseId: string | null = null;
			if (input.templateItemId?.trim()) {
				const itemId = safeId(input.templateItemId, 'Checklist item');
				const response = await trx
					.selectFrom('quality_inspection_responses')
					.select('id')
					.where('quality_inspection_id', '=', inspection.id)
					.where('quality_inspection_template_item_id', '=', itemId)
					.executeTakeFirst();
				if (!response) throw new SiteQualitySafetyValidationError('Record the checklist response before raising a linked finding.');
				responseId = response.id;
			}
			await trx
				.insertInto('quality_inspection_findings')
				.values({
					owning_organisation_id: actor.organisationId,
					quality_inspection_id: inspection.id,
					quality_inspection_response_id: responseId,
					quality_finding_type_id: findingType.id,
					public_id: findingPublicId,
					title: requiredText(input.title, 'Finding title', 500),
					description: requiredText(input.description, 'Finding description', 4000),
					severity: severity(input.severity),
					raised_by_member_id: actor.memberId,
					raised_at: this.now()
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, inspection.project_id, 'quality.finding.raise', 'quality_inspection_finding', findingPublicId, {
				inspectionPublicId,
				findingType: input.findingTypeCode
			});
		});
		return findingPublicId;
	}

	async completeInspection(actor: TenantActorContext, inspectionPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.inspection.manage');
		const inspectionPublicId = publicId(inspectionPublicIdInput, 'Inspection');
		await this.db.transaction().execute(async (trx) => {
			const inspection = await trx
				.selectFrom('quality_inspections')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', inspectionPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!inspection) throw new TenantAccessError('Inspection not found.');
			await this.requireProjectById(actor, inspection.project_id, trx);
			if (inspection.status !== 'in_progress') throw new SiteQualitySafetyValidationError('Only an in-progress inspection can be completed.');
			const requiredItems = await trx
				.selectFrom('quality_inspection_template_items')
				.select('id')
				.where('organisation_id', '=', actor.organisationId)
				.where('quality_inspection_template_version_id', '=', inspection.quality_inspection_template_version_id)
				.where('is_required', '=', 1)
				.execute();
			const responses = await trx
				.selectFrom('quality_inspection_responses')
				.select(['quality_inspection_template_item_id', 'result_code'])
				.where('quality_inspection_id', '=', inspection.id)
				.execute();
			const responded = new Set(
				responses.filter((response) => response.result_code !== 'not_checked').map((response) => response.quality_inspection_template_item_id)
			);
			if (requiredItems.some((item) => !responded.has(item.id)))
				throw new SiteQualitySafetyValidationError('Complete every required checklist item before completing the inspection.');
			await trx
				.updateTable('quality_inspections')
				.set({ status: 'completed', completed_at: this.now() })
				.where('id', '=', inspection.id)
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, inspection.project_id, 'quality.inspection.complete', 'quality_inspection', inspectionPublicId, {
				itemCount: requiredItems.length
			});
		});
	}

	async createDefect(actor: TenantActorContext, input: CreateDefectInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.defect.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const site = await this.requireSite(actor, project, input.sitePublicId);
		const defectPublicId = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const findingId = await this.resolveFinding(actor, project.id, input.findingPublicId, trx);
			await trx
				.insertInto('defect_records')
				.values({
					project_id: project.id,
					owning_organisation_id: actor.organisationId,
					project_site_id: site.id,
					public_id: defectPublicId,
					defect_number: reference('DEF', defectPublicId, now),
					source_inspection_finding_id: findingId,
					title: requiredText(input.title, 'Defect title', 500),
					description: requiredText(input.description, 'Defect description', 4000),
					location_description: optionalText(input.locationDescription, 255),
					severity: severity(input.severity),
					status: 'open',
					responsible_organisation_id: null,
					responsible_member_id: null,
					target_date: dateOnly(input.targetDate, 'Target date'),
					raised_by_member_id: actor.memberId,
					raised_at: now,
					closed_by_member_id: null,
					closed_at: null
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'quality.defect.raise', 'defect', defectPublicId, {
				sitePublicId: site.publicId,
				severity: input.severity,
				findingLinked: Boolean(findingId)
			});
		});
		return defectPublicId;
	}

	async closeDefect(actor: TenantActorContext, defectPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.defect.manage');
		const defectPublicId = publicId(defectPublicIdInput, 'Defect');
		await this.db.transaction().execute(async (trx) => {
			const defect = await trx
				.selectFrom('defect_records')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', defectPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!defect) throw new TenantAccessError('Defect not found.');
			await this.requireProjectById(actor, defect.project_id, trx);
			if (defect.status === 'closed' || defect.status === 'cancelled')
				throw new SiteQualitySafetyValidationError('Defect is already closed or cancelled.');
			await trx
				.updateTable('defect_records')
				.set({ status: 'closed', closed_by_member_id: actor.memberId, closed_at: this.now() })
				.where('id', '=', defect.id)
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, defect.project_id, 'quality.defect.close', 'defect', defectPublicId, {
				fromStatus: defect.status
			});
		});
	}

	async createNcr(actor: TenantActorContext, input: CreateNcrInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.ncr.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const site = await this.requireSite(actor, project, input.sitePublicId);
		const ncrPublicId = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const findingId = await this.resolveFinding(actor, project.id, input.findingPublicId, trx);
			await trx
				.insertInto('nonconformance_reports')
				.values({
					project_id: project.id,
					owning_organisation_id: actor.organisationId,
					project_site_id: site.id,
					public_id: ncrPublicId,
					ncr_number: reference('NCR', ncrPublicId, now),
					source_inspection_finding_id: findingId,
					title: requiredText(input.title, 'NCR title', 500),
					nonconformance_statement: requiredText(input.statement, 'Non-conformance statement', 4000),
					severity: severity(input.severity),
					immediate_containment: optionalText(input.immediateContainment, 4000),
					root_cause: null,
					proposed_disposition: null,
					status: input.immediateContainment?.trim() ? 'containment' : 'open',
					responsible_organisation_id: null,
					responsible_member_id: null,
					target_date: dateOnly(input.targetDate, 'Target date'),
					raised_by_member_id: actor.memberId,
					raised_at: now,
					closed_by_member_id: null,
					closed_at: null
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'quality.ncr.raise', 'nonconformance_report', ncrPublicId, {
				sitePublicId: site.publicId,
				severity: input.severity,
				findingLinked: Boolean(findingId)
			});
		});
		return ncrPublicId;
	}

	async closeNcr(actor: TenantActorContext, ncrPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'quality.ncr.manage');
		const ncrPublicId = publicId(ncrPublicIdInput, 'NCR');
		await this.db.transaction().execute(async (trx) => {
			const ncr = await trx
				.selectFrom('nonconformance_reports')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', ncrPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!ncr) throw new TenantAccessError('NCR not found.');
			await this.requireProjectById(actor, ncr.project_id, trx);
			if (ncr.status === 'closed' || ncr.status === 'cancelled')
				throw new SiteQualitySafetyValidationError('NCR is already closed or cancelled.');
			await trx
				.updateTable('nonconformance_reports')
				.set({ status: 'closed', closed_by_member_id: actor.memberId, closed_at: this.now() })
				.where('id', '=', ncr.id)
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, ncr.project_id, 'quality.ncr.close', 'nonconformance_report', ncrPublicId, {
				fromStatus: ncr.status
			});
		});
	}

	async createSafetyObservation(
		actor: TenantActorContext,
		input: CreateSafetyObservationInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'safety.event.manage');
		const project = await this.requireProject(actor, input.projectPublicId);
		const site = await this.requireSite(actor, project, input.sitePublicId);
		const eventPublicId = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const eventId = insertedId(
				await trx
					.insertInto('safety_events')
					.values({
						project_id: project.id,
						owning_organisation_id: actor.organisationId,
						project_site_id: site.id,
						public_id: eventPublicId,
						event_number: reference('SAFE', eventPublicId, now),
						event_kind: 'observation',
						title: requiredText(input.title, 'Safety observation title', 500),
						description: requiredText(input.description, 'Safety observation description', 4000),
						location_description: optionalText(input.locationDescription, 255),
						occurred_at: dateTime(input.occurredAt, 'Occurred at'),
						reported_by_member_id: actor.memberId,
						reported_at: now,
						status: 'reported',
						closed_by_member_id: null,
						closed_at: null
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('safety_observations')
				.values({
					safety_event_id: eventId,
					owning_organisation_id: actor.organisationId,
					observation_category: observationCategory(input.observationCategory),
					is_positive_observation: input.isPositiveObservation ? 1 : 0,
					immediate_action_taken: optionalText(input.immediateActionTaken, 4000)
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, project.id, 'safety.observation.report', 'safety_event', eventPublicId, {
				sitePublicId: site.publicId,
				category: input.observationCategory,
				positive: input.isPositiveObservation
			});
		});
		return eventPublicId;
	}

	async createSafetyAction(actor: TenantActorContext, input: CreateSafetyActionInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'safety.action.manage');
		const eventPublicId = publicId(input.safetyEventPublicId, 'Safety event');
		await this.db.transaction().execute(async (trx) => {
			const event = await trx
				.selectFrom('safety_events')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', eventPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!event) throw new TenantAccessError('Safety event not found.');
			await this.requireProjectById(actor, event.project_id, trx);
			if (event.status === 'closed' || event.status === 'cancelled')
				throw new SiteQualitySafetyValidationError('Closed safety events cannot accept new actions.');
			await trx
				.insertInto('safety_actions')
				.values({
					safety_event_id: event.id,
					event_owner_organisation_id: actor.organisationId,
					action_type: safetyActionType(input.actionType),
					action_text: requiredText(input.actionText, 'Safety action', 4000),
					responsible_organisation_id: actor.organisationId,
					responsible_member_id: actor.memberId,
					target_date: dateOnly(input.targetDate, 'Target date'),
					status: 'open',
					completed_by_member_id: null,
					completed_by_organisation_id: null,
					completed_at: null,
					verification_note: null
				})
				.executeTakeFirstOrThrow();
			if (event.status === 'reported') {
				await trx.updateTable('safety_events').set({ status: 'action' }).where('id', '=', event.id).executeTakeFirstOrThrow();
			}
			await this.audit(trx, actor, event.project_id, 'safety.action.create', 'safety_event', eventPublicId, {
				actionType: input.actionType
			});
		});
	}

	async completeSafetyAction(
		actor: TenantActorContext,
		safetyEventPublicIdInput: string,
		actionIdInput: string,
		verificationNote?: string | null
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'safety.action.manage');
		const eventPublicId = publicId(safetyEventPublicIdInput, 'Safety event');
		const actionId = safeId(actionIdInput, 'Safety action');
		await this.db.transaction().execute(async (trx) => {
			const event = await trx
				.selectFrom('safety_events')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', eventPublicId)
				.executeTakeFirst();
			if (!event) throw new TenantAccessError('Safety event not found.');
			await this.requireProjectById(actor, event.project_id, trx);
			const action = await trx
				.selectFrom('safety_actions')
				.selectAll()
				.where('id', '=', actionId)
				.where('safety_event_id', '=', event.id)
				.where('event_owner_organisation_id', '=', actor.organisationId)
				.forUpdate()
				.executeTakeFirst();
			if (!action) throw new SiteQualitySafetyValidationError('Safety action was not found for this event.');
			if (action.status === 'completed' || action.status === 'verified')
				throw new SiteQualitySafetyValidationError('Safety action is already complete.');
			await trx
				.updateTable('safety_actions')
				.set({
					status: 'completed',
					completed_by_member_id: actor.memberId,
					completed_by_organisation_id: actor.organisationId,
					completed_at: this.now(),
					verification_note: optionalText(verificationNote, 4000)
				})
				.where('id', '=', action.id)
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, event.project_id, 'safety.action.complete', 'safety_event', eventPublicId, {
				actionId
			});
		});
	}

	async closeSafetyEvent(actor: TenantActorContext, safetyEventPublicIdInput: string): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'safety.event.manage');
		const eventPublicId = publicId(safetyEventPublicIdInput, 'Safety event');
		await this.db.transaction().execute(async (trx) => {
			const event = await trx
				.selectFrom('safety_events')
				.selectAll()
				.where('owning_organisation_id', '=', actor.organisationId)
				.where('public_id', '=', eventPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!event) throw new TenantAccessError('Safety event not found.');
			await this.requireProjectById(actor, event.project_id, trx);
			if (event.status === 'closed' || event.status === 'cancelled')
				throw new SiteQualitySafetyValidationError('Safety event is already closed or cancelled.');
			const openAction = await trx
				.selectFrom('safety_actions')
				.select('id')
				.where('safety_event_id', '=', event.id)
				.where('event_owner_organisation_id', '=', actor.organisationId)
				.where('status', 'in', ['open', 'in_progress'])
				.limit(1)
				.executeTakeFirst();
			if (openAction) throw new SiteQualitySafetyValidationError('Complete open safety actions before closing the event.');
			await trx
				.updateTable('safety_events')
				.set({ status: 'closed', closed_by_member_id: actor.memberId, closed_at: this.now() })
				.where('id', '=', event.id)
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, event.project_id, 'safety.event.close', 'safety_event', eventPublicId, {
				fromStatus: event.status
			});
		});
	}

	async linkEvidence(actor: TenantActorContext, input: LinkEvidenceInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'information.view');
		const subjectPermission =
			input.subjectType === 'diary'
				? 'site.diary.manage'
				: input.subjectType === 'defect'
					? 'quality.defect.manage'
					: input.subjectType === 'ncr'
						? 'quality.ncr.manage'
						: 'safety.event.manage';
		await this.requirePermission(actor, subjectPermission);
		const project = await this.requireProject(actor, input.projectPublicId);
		const repository = new SiteQualitySafetyRepository(this.db);
		const version = await repository.findEvidenceVersionByPublicId(
			project.id,
			actor.organisationId,
			publicId(input.informationVersionPublicId, 'Information version')
		);
		if (!version) throw new SiteQualitySafetyValidationError('Evidence must be an issued or superseded project-information revision owned by your organisation.');
		const subjectPublicId = publicId(input.subjectPublicId, 'Evidence subject');
		await this.db.transaction().execute(async (trx) => {
			if (input.subjectType === 'diary') {
				const subject = await trx.selectFrom('site_diaries').select(['id', 'project_id']).where('owning_organisation_id', '=', actor.organisationId).where('public_id', '=', subjectPublicId).executeTakeFirst();
				if (!subject || subject.project_id !== project.id) throw new TenantAccessError('Site diary is outside this project scope.');
				await trx.insertInto('site_diary_information_links').ignore().values({
					site_diary_id: subject.id,
					diary_owner_organisation_id: actor.organisationId,
					information_container_version_id: version.id,
					version_owner_organisation_id: actor.organisationId,
					link_role: input.linkRole
				}).execute();
			} else if (input.subjectType === 'defect') {
				const subject = await trx.selectFrom('defect_records').select(['id', 'project_id']).where('owning_organisation_id', '=', actor.organisationId).where('public_id', '=', subjectPublicId).executeTakeFirst();
				if (!subject || subject.project_id !== project.id) throw new TenantAccessError('Defect is outside this project scope.');
				await trx.insertInto('defect_information_links').ignore().values({
					defect_record_id: subject.id,
					defect_owner_organisation_id: actor.organisationId,
					information_container_version_id: version.id,
					version_owner_organisation_id: actor.organisationId,
					link_role: input.linkRole
				}).execute();
			} else if (input.subjectType === 'ncr') {
				const subject = await trx.selectFrom('nonconformance_reports').select(['id', 'project_id']).where('owning_organisation_id', '=', actor.organisationId).where('public_id', '=', subjectPublicId).executeTakeFirst();
				if (!subject || subject.project_id !== project.id) throw new TenantAccessError('NCR is outside this project scope.');
				await trx.insertInto('ncr_information_links').ignore().values({
					nonconformance_report_id: subject.id,
					ncr_owner_organisation_id: actor.organisationId,
					information_container_version_id: version.id,
					version_owner_organisation_id: actor.organisationId,
					link_role: input.linkRole
				}).execute();
			} else {
				const subject = await trx.selectFrom('safety_events').select(['id', 'project_id']).where('owning_organisation_id', '=', actor.organisationId).where('public_id', '=', subjectPublicId).executeTakeFirst();
				if (!subject || subject.project_id !== project.id) throw new TenantAccessError('Safety event is outside this project scope.');
				await trx.insertInto('safety_event_information_links').ignore().values({
					safety_event_id: subject.id,
					event_owner_organisation_id: actor.organisationId,
					information_container_version_id: version.id,
					version_owner_organisation_id: actor.organisationId,
					link_role: input.linkRole
				}).execute();
			}
			await this.audit(trx, actor, project.id, 'site.evidence.link', input.subjectType, subjectPublicId, {
				informationVersionPublicId: version.public_id,
				linkRole: input.linkRole
			});
		});
	}

	private async resolveFinding(
		actor: TenantActorContext,
		projectId: string,
		findingPublicIdInput: string | null | undefined,
		db: DatabaseExecutor
	): Promise<string | null> {
		const value = findingPublicIdInput?.trim() ?? '';
		if (!value) return null;
		const finding = await db
			.selectFrom('quality_inspection_findings as finding')
			.innerJoin('quality_inspections as inspection', 'inspection.id', 'finding.quality_inspection_id')
			.select(['finding.id as id', 'inspection.project_id as projectId'])
			.where('finding.owning_organisation_id', '=', actor.organisationId)
			.where('finding.public_id', '=', publicId(value, 'Inspection finding'))
			.executeTakeFirst();
		if (!finding || finding.projectId !== projectId)
			throw new SiteQualitySafetyValidationError('Inspection finding is outside this project scope.');
		return finding.id;
	}

	private async requireProjectById(
		actor: TenantActorContext,
		projectId: string,
		db: DatabaseExecutor
	): Promise<ProjectRecord> {
		const project = await db
			.selectFrom('projects as project')
			.innerJoin('project_organisations as participant', 'participant.project_id', 'project.id')
			.innerJoin('project_members as member', (join) =>
				join
					.onRef('member.project_id', '=', 'participant.project_id')
					.onRef('member.participant_organisation_id', '=', 'participant.participant_organisation_id')
			)
			.select([
				'project.id as id',
				'project.owning_organisation_id as owningOrganisationId',
				'project.public_id as publicId',
				'project.project_number as projectNumber',
				'project.name as name',
				'project.description as description',
				'project.status as status',
				'project.created_by_member_id as createdByMemberId',
				'project.started_on as startedOn',
				'project.completed_on as completedOn',
				'project.archived_at as archivedAt'
			])
			.where('project.id', '=', projectId)
			.where('participant.participant_organisation_id', '=', actor.organisationId)
			.where('participant.status', '=', 'active')
			.where('member.organisation_member_id', '=', actor.memberId)
			.where('member.status', '=', 'active')
			.executeTakeFirst();
		if (!project) throw new TenantAccessError('The project is outside your effective project scope.');
		return project as ProjectRecord;
	}

	private async audit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		projectId: string | null,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			projectId,
			actionKey,
			subjectType,
			subjectPublicId,
			correlationId: actor.correlationId,
			changeSummary
		});
	}
}
