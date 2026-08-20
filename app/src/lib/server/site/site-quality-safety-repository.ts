import type { DatabaseExecutor } from '$lib/server/db/executor';

export type SiteSummary = {
	id: string;
	publicId: string;
	projectId: string;
	owningOrganisationId: string;
	siteCode: string;
	name: string;
	timezone: string | null;
	isActive: boolean;
};

export type SiteDiarySummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectSiteId: string;
	diaryDate: Date;
	shiftLabel: string | null;
	status: string;
	summary: string | null;
	submittedAt: Date | null;
	approvedAt: Date | null;
	createdAt: Date;
};

export type InspectionTemplateSummary = {
	id: string;
	publicId: string;
	code: string;
	name: string;
	description: string | null;
	versionId: string;
	versionPublicId: string;
	versionNumber: number;
	status: string;
};

export type InspectionTemplateItem = {
	id: string;
	versionId: string;
	itemNumber: number;
	promptText: string;
	isRequired: boolean;
	allowFinding: boolean;
};

export type InspectionSummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectSiteId: string;
	inspectionNumber: string;
	templateVersionId: string;
	templateName: string;
	title: string;
	locationDescription: string | null;
	status: string;
	scheduledAt: Date | null;
	startedAt: Date | null;
	completedAt: Date | null;
};

export type InspectionResponseSummary = {
	id: string;
	inspectionId: string;
	templateItemId: string;
	resultCode: string;
	comments: string | null;
	respondedAt: Date;
};

export type InspectionFindingSummary = {
	id: string;
	publicId: string;
	inspectionId: string;
	responseId: string | null;
	findingTypeCode: string;
	findingTypeName: string;
	title: string;
	description: string;
	severity: string;
	raisedAt: Date;
};

export type DefectSummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectSiteId: string;
	defectNumber: string;
	title: string;
	description: string;
	locationDescription: string | null;
	severity: string;
	status: string;
	targetDate: Date | null;
	raisedAt: Date;
	closedAt: Date | null;
};

export type NcrSummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectSiteId: string;
	ncrNumber: string;
	title: string;
	statement: string;
	severity: string;
	status: string;
	immediateContainment: string | null;
	rootCause: string | null;
	proposedDisposition: string | null;
	targetDate: Date | null;
	raisedAt: Date;
	closedAt: Date | null;
};

export type SafetyEventSummary = {
	id: string;
	publicId: string;
	projectId: string;
	projectSiteId: string;
	eventNumber: string;
	eventKind: string;
	title: string;
	description: string;
	locationDescription: string | null;
	occurredAt: Date;
	status: string;
	observationCategory: string | null;
	isPositiveObservation: boolean | null;
	immediateActionTaken: string | null;
	closedAt: Date | null;
};

export type SafetyActionSummary = {
	id: string;
	safetyEventId: string;
	actionType: string;
	actionText: string;
	targetDate: Date | null;
	status: string;
	completedAt: Date | null;
	verificationNote: string | null;
};

export type EvidenceVersionSummary = {
	id: string;
	publicId: string;
	containerNumber: string;
	title: string;
	revisionCode: string;
	versionStatus: string;
};

export class SiteQualitySafetyRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listSites(projectId: string): Promise<SiteSummary[]> {
		const rows = await this.db
			.selectFrom('project_sites')
			.select([
				'id',
				'public_id',
				'project_id',
				'owning_organisation_id',
				'site_code',
				'name',
				'timezone',
				'is_active'
			])
			.where('project_id', '=', projectId)
			.orderBy('site_code')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.public_id,
			projectId: row.project_id,
			owningOrganisationId: row.owning_organisation_id,
			siteCode: row.site_code,
			name: row.name,
			timezone: row.timezone,
			isActive: Boolean(row.is_active)
		}));
	}

	async findSiteByPublicId(projectId: string, publicId: string): Promise<SiteSummary | null> {
		const row = await this.db
			.selectFrom('project_sites')
			.select([
				'id',
				'public_id',
				'project_id',
				'owning_organisation_id',
				'site_code',
				'name',
				'timezone',
				'is_active'
			])
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row
			? {
					id: row.id,
					publicId: row.public_id,
					projectId: row.project_id,
					owningOrganisationId: row.owning_organisation_id,
					siteCode: row.site_code,
					name: row.name,
					timezone: row.timezone,
					isActive: Boolean(row.is_active)
				}
			: null;
	}

	async listDiaries(projectId: string, organisationId: string): Promise<SiteDiarySummary[]> {
		const rows = await this.db
			.selectFrom('site_diaries')
			.select([
				'id',
				'public_id',
				'project_id',
				'project_site_id',
				'diary_date',
				'shift_label',
				'status',
				'summary',
				'submitted_at',
				'approved_at',
				'created_at'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.orderBy('diary_date', 'desc')
			.orderBy('id', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.public_id,
			projectId: row.project_id,
			projectSiteId: row.project_site_id,
			diaryDate: row.diary_date,
			shiftLabel: row.shift_label,
			status: row.status,
			summary: row.summary,
			submittedAt: row.submitted_at,
			approvedAt: row.approved_at,
			createdAt: row.created_at
		}));
	}

	async findDiaryByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('site_diaries')
				.selectAll()
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listPublishedTemplates(organisationId: string): Promise<InspectionTemplateSummary[]> {
		const rows = await this.db
			.selectFrom('quality_inspection_templates as template')
			.innerJoin(
				'quality_inspection_template_versions as version',
				'version.quality_inspection_template_id',
				'template.id'
			)
			.select([
				'template.id as id',
				'template.public_id as publicId',
				'template.code as code',
				'template.name as name',
				'template.description as description',
				'version.id as versionId',
				'version.public_id as versionPublicId',
				'version.version_number as versionNumber',
				'version.status as status'
			])
			.where('template.organisation_id', '=', organisationId)
			.where('template.is_active', '=', 1)
			.where('version.status', '=', 'published')
			.orderBy('template.code')
			.orderBy('version.version_number', 'desc')
			.execute();
		return rows.map((row) => ({ ...row, versionNumber: Number(row.versionNumber) }));
	}

	async findTemplateVersionByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('quality_inspection_template_versions as version')
				.innerJoin(
					'quality_inspection_templates as template',
					'template.id',
					'version.quality_inspection_template_id'
				)
				.select([
					'version.id as id',
					'version.public_id as publicId',
					'version.status as status',
					'template.name as templateName'
				])
				.where('version.organisation_id', '=', organisationId)
				.where('version.public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listTemplateItems(
		organisationId: string,
		versionId: string
	): Promise<InspectionTemplateItem[]> {
		const rows = await this.db
			.selectFrom('quality_inspection_template_items')
			.select([
				'id',
				'quality_inspection_template_version_id',
				'item_number',
				'prompt_text',
				'is_required',
				'allow_finding'
			])
			.where('organisation_id', '=', organisationId)
			.where('quality_inspection_template_version_id', '=', versionId)
			.orderBy('item_number')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			versionId: row.quality_inspection_template_version_id,
			itemNumber: Number(row.item_number),
			promptText: row.prompt_text,
			isRequired: Boolean(row.is_required),
			allowFinding: Boolean(row.allow_finding)
		}));
	}

	async listInspections(projectId: string, organisationId: string): Promise<InspectionSummary[]> {
		const rows = await this.db
			.selectFrom('quality_inspections as inspection')
			.innerJoin(
				'quality_inspection_template_versions as version',
				'version.id',
				'inspection.quality_inspection_template_version_id'
			)
			.innerJoin(
				'quality_inspection_templates as template',
				'template.id',
				'version.quality_inspection_template_id'
			)
			.select([
				'inspection.id as id',
				'inspection.public_id as publicId',
				'inspection.project_id as projectId',
				'inspection.project_site_id as projectSiteId',
				'inspection.inspection_number as inspectionNumber',
				'inspection.quality_inspection_template_version_id as templateVersionId',
				'template.name as templateName',
				'inspection.title as title',
				'inspection.location_description as locationDescription',
				'inspection.status as status',
				'inspection.scheduled_at as scheduledAt',
				'inspection.started_at as startedAt',
				'inspection.completed_at as completedAt'
			])
			.where('inspection.project_id', '=', projectId)
			.where('inspection.owning_organisation_id', '=', organisationId)
			.orderBy('inspection.id', 'desc')
			.execute();
		return rows;
	}

	async findInspectionByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('quality_inspections')
				.selectAll()
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listInspectionResponses(
		organisationId: string,
		inspectionIds: readonly string[]
	): Promise<InspectionResponseSummary[]> {
		if (inspectionIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('quality_inspection_responses')
			.select([
				'id',
				'quality_inspection_id',
				'quality_inspection_template_item_id',
				'result_code',
				'comments',
				'responded_at'
			])
			.where('owning_organisation_id', '=', organisationId)
			.where('quality_inspection_id', 'in', [...inspectionIds])
			.execute();
		return rows.map((row) => ({
			id: row.id,
			inspectionId: row.quality_inspection_id,
			templateItemId: row.quality_inspection_template_item_id,
			resultCode: row.result_code,
			comments: row.comments,
			respondedAt: row.responded_at
		}));
	}

	async listInspectionFindings(
		organisationId: string,
		inspectionIds: readonly string[]
	): Promise<InspectionFindingSummary[]> {
		if (inspectionIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('quality_inspection_findings as finding')
			.innerJoin('quality_finding_types as type', 'type.id', 'finding.quality_finding_type_id')
			.select([
				'finding.id as id',
				'finding.public_id as publicId',
				'finding.quality_inspection_id as inspectionId',
				'finding.quality_inspection_response_id as responseId',
				'type.code as findingTypeCode',
				'type.name as findingTypeName',
				'finding.title as title',
				'finding.description as description',
				'finding.severity as severity',
				'finding.raised_at as raisedAt'
			])
			.where('finding.owning_organisation_id', '=', organisationId)
			.where('finding.quality_inspection_id', 'in', [...inspectionIds])
			.orderBy('finding.id', 'desc')
			.execute();
		return rows;
	}

	async listDefects(projectId: string, organisationId: string): Promise<DefectSummary[]> {
		const rows = await this.db
			.selectFrom('defect_records')
			.select([
				'id',
				'public_id',
				'project_id',
				'project_site_id',
				'defect_number',
				'title',
				'description',
				'location_description',
				'severity',
				'status',
				'target_date',
				'raised_at',
				'closed_at'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.orderBy('id', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.public_id,
			projectId: row.project_id,
			projectSiteId: row.project_site_id,
			defectNumber: row.defect_number,
			title: row.title,
			description: row.description,
			locationDescription: row.location_description,
			severity: row.severity,
			status: row.status,
			targetDate: row.target_date,
			raisedAt: row.raised_at,
			closedAt: row.closed_at
		}));
	}

	async findDefectByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('defect_records')
				.selectAll()
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listNcrs(projectId: string, organisationId: string): Promise<NcrSummary[]> {
		const rows = await this.db
			.selectFrom('nonconformance_reports')
			.select([
				'id',
				'public_id',
				'project_id',
				'project_site_id',
				'ncr_number',
				'title',
				'nonconformance_statement',
				'severity',
				'status',
				'immediate_containment',
				'root_cause',
				'proposed_disposition',
				'target_date',
				'raised_at',
				'closed_at'
			])
			.where('project_id', '=', projectId)
			.where('owning_organisation_id', '=', organisationId)
			.orderBy('id', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			publicId: row.public_id,
			projectId: row.project_id,
			projectSiteId: row.project_site_id,
			ncrNumber: row.ncr_number,
			title: row.title,
			statement: row.nonconformance_statement,
			severity: row.severity,
			status: row.status,
			immediateContainment: row.immediate_containment,
			rootCause: row.root_cause,
			proposedDisposition: row.proposed_disposition,
			targetDate: row.target_date,
			raisedAt: row.raised_at,
			closedAt: row.closed_at
		}));
	}

	async findNcrByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('nonconformance_reports')
				.selectAll()
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listSafetyEvents(projectId: string, organisationId: string): Promise<SafetyEventSummary[]> {
		const rows = await this.db
			.selectFrom('safety_events as event')
			.leftJoin('safety_observations as observation', 'observation.safety_event_id', 'event.id')
			.select([
				'event.id as id',
				'event.public_id as publicId',
				'event.project_id as projectId',
				'event.project_site_id as projectSiteId',
				'event.event_number as eventNumber',
				'event.event_kind as eventKind',
				'event.title as title',
				'event.description as description',
				'event.location_description as locationDescription',
				'event.occurred_at as occurredAt',
				'event.status as status',
				'observation.observation_category as observationCategory',
				'observation.is_positive_observation as isPositiveObservation',
				'observation.immediate_action_taken as immediateActionTaken',
				'event.closed_at as closedAt'
			])
			.where('event.project_id', '=', projectId)
			.where('event.owning_organisation_id', '=', organisationId)
			.orderBy('event.occurred_at', 'desc')
			.orderBy('event.id', 'desc')
			.execute();
		return rows.map((row) => ({
			...row,
			isPositiveObservation:
				row.isPositiveObservation === null ? null : Boolean(row.isPositiveObservation)
		}));
	}

	async findSafetyEventByPublicId(organisationId: string, publicId: string) {
		return (
			(await this.db
				.selectFrom('safety_events')
				.selectAll()
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.executeTakeFirst()) ?? null
		);
	}

	async listSafetyActions(
		organisationId: string,
		eventIds: readonly string[]
	): Promise<SafetyActionSummary[]> {
		if (eventIds.length === 0) return [];
		const rows = await this.db
			.selectFrom('safety_actions')
			.select([
				'id',
				'safety_event_id',
				'action_type',
				'action_text',
				'target_date',
				'status',
				'completed_at',
				'verification_note'
			])
			.where('event_owner_organisation_id', '=', organisationId)
			.where('safety_event_id', 'in', [...eventIds])
			.orderBy('id', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			safetyEventId: row.safety_event_id,
			actionType: row.action_type,
			actionText: row.action_text,
			targetDate: row.target_date,
			status: row.status,
			completedAt: row.completed_at,
			verificationNote: row.verification_note
		}));
	}

	async listEvidenceVersions(
		projectId: string,
		organisationId: string
	): Promise<EvidenceVersionSummary[]> {
		const rows = await this.db
			.selectFrom('information_container_versions as version')
			.innerJoin(
				'information_containers as container',
				'container.id',
				'version.information_container_id'
			)
			.select([
				'version.id as id',
				'version.public_id as publicId',
				'container.container_number as containerNumber',
				'container.title as title',
				'version.revision_code as revisionCode',
				'version.version_status as versionStatus'
			])
			.where('version.project_id', '=', projectId)
			.where('version.owning_organisation_id', '=', organisationId)
			.where('version.version_status', 'in', ['issued', 'superseded'])
			.orderBy('container.container_number')
			.orderBy('version.version_sequence', 'desc')
			.execute();
		return rows;
	}

	async findEvidenceVersionByPublicId(
		projectId: string,
		organisationId: string,
		publicId: string
	) {
		return (
			(await this.db
				.selectFrom('information_container_versions')
				.select(['id', 'public_id', 'project_id', 'owning_organisation_id', 'version_status'])
				.where('project_id', '=', projectId)
				.where('owning_organisation_id', '=', organisationId)
				.where('public_id', '=', publicId)
				.where('version_status', 'in', ['issued', 'superseded'])
				.executeTakeFirst()) ?? null
		);
	}

	async listFindingTypes() {
		return this.db
			.selectFrom('quality_finding_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}
}
