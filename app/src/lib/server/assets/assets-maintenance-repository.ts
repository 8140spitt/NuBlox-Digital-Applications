import type { DatabaseExecutor } from '$lib/server/db/executor';

export type FacilitySummary = {
	id: string;
	publicId: string;
	facilityCode: string;
	name: string;
	description: string | null;
	timezone: string | null;
	operationalStatus: string;
	commissionedOn: Date | null;
	openedOn: Date | null;
};

export type BuildingSummary = {
	id: string;
	facilityId: string;
	publicId: string;
	buildingCode: string;
	name: string;
	operationalStatus: string;
};

export type LevelSummary = {
	id: string;
	facilityId: string;
	buildingId: string;
	publicId: string;
	levelCode: string;
	name: string;
	sortOrder: number;
};

export type SpaceSummary = {
	id: string;
	facilityId: string;
	buildingId: string;
	levelId: string | null;
	publicId: string;
	spaceCode: string;
	name: string;
	spaceType: string | null;
};

export type AssetTypeSummary = {
	id: string;
	publicId: string;
	categoryCode: string;
	categoryName: string;
	code: string;
	name: string;
	isMaintainable: boolean;
};

export type AssetSummary = {
	id: string;
	facilityId: string;
	publicId: string;
	assetTypeId: string;
	assetTypeName: string;
	parentAssetId: string | null;
	assetTag: string;
	serialNumber: string | null;
	name: string;
	criticality: string;
	lifecycleStatus: string;
	buildingName: string | null;
	levelName: string | null;
	spaceName: string | null;
};

export type MaintenanceRequestSummary = {
	id: string;
	publicId: string;
	facilityId: string;
	requestNumber: string;
	requestType: string;
	priorityCode: string;
	priorityName: string;
	title: string;
	description: string;
	requestStatus: string;
	reportedAt: Date;
};

export type MaintenancePlanSummary = {
	id: string;
	publicId: string;
	facilityId: string;
	planNumber: string;
	planTypeName: string;
	name: string;
	description: string | null;
	lifecycleStatus: string;
	startsOn: Date | null;
};

export type MaintenancePlanTaskSummary = {
	id: string;
	maintenancePlanId: string;
	taskNumber: number;
	title: string;
	instructions: string | null;
	estimatedDurationMinutes: number | null;
	requiresShutdown: boolean;
	scheduleBasis: string | null;
	intervalValue: string | null;
	intervalUnit: string | null;
	startsOn: Date | null;
};

export type WorkOrderSummary = {
	id: string;
	publicId: string;
	facilityId: string;
	workOrderNumber: string;
	workOrderTypeCode: string;
	workOrderTypeName: string;
	priorityCode: string;
	priorityName: string;
	title: string;
	description: string | null;
	workOrderStatus: string;
	scheduledStartAt: Date | null;
	startedAt: Date | null;
	completedAt: Date | null;
	completionSummary: string | null;
};

export type ContractorAssignmentSummary = {
	workOrderId: string;
	partyId: string;
	partyPublicId: string;
	displayName: string;
	assignmentRole: string;
};

export type ServiceEventSummary = {
	id: string;
	publicId: string;
	assetId: string;
	assetTag: string;
	serviceTypeName: string;
	performedAt: Date;
	resultCode: string;
	conditionRating: string | null;
	notes: string | null;
	recommendedNextServiceOn: Date | null;
};

export type ComplianceRequirementSummary = {
	id: string;
	publicId: string;
	categoryName: string;
	requirementCode: string;
	name: string;
	lifecycleStatus: string;
	publishedVersionId: string | null;
	publishedVersionNumber: number | null;
	intervalValue: number | null;
	intervalUnit: string | null;
};

export type AssetComplianceAssignmentSummary = {
	id: string;
	assetId: string;
	assetTag: string;
	complianceRequirementId: string;
	requirementName: string;
	assignedFrom: Date | null;
	isActive: boolean;
};

export type ComplianceEventSummary = {
	id: string;
	publicId: string;
	complianceEventNumber: string;
	assetAssignmentId: string | null;
	assetTag: string | null;
	requirementName: string;
	performedAt: Date;
	outcome: string;
	findingsSummary: string | null;
	recommendedNextDueOn: Date | null;
};

export type EvidenceVersionSummary = {
	id: string;
	publicId: string;
	containerPublicId: string;
	containerReference: string;
	title: string;
	revisionCode: string;
	versionStatus: string;
};

export class AssetsMaintenanceRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listFacilities(organisationId: string): Promise<FacilitySummary[]> {
		return this.db
			.selectFrom('facilities')
			.select([
				'id',
				'public_id as publicId',
				'facility_code as facilityCode',
				'name',
				'description',
				'timezone',
				'operational_status as operationalStatus',
				'commissioned_on as commissionedOn',
				'opened_on as openedOn'
			])
			.where('organisation_id', '=', organisationId)
			.where('operational_status', '!=', 'archived')
			.orderBy('name')
			.execute();
	}

	async findFacilityByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('facilities')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listBuildings(organisationId: string): Promise<BuildingSummary[]> {
		return this.db
			.selectFrom('facility_buildings')
			.select([
				'id',
				'facility_id as facilityId',
				'public_id as publicId',
				'building_code as buildingCode',
				'name',
				'operational_status as operationalStatus'
			])
			.where('organisation_id', '=', organisationId)
			.where('operational_status', '!=', 'archived')
			.orderBy('name')
			.execute();
	}

	async findBuildingByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('facility_buildings')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listLevels(organisationId: string): Promise<LevelSummary[]> {
		return this.db
			.selectFrom('building_levels')
			.select([
				'id',
				'facility_id as facilityId',
				'facility_building_id as buildingId',
				'public_id as publicId',
				'level_code as levelCode',
				'name',
				'sort_order as sortOrder'
			])
			.where('organisation_id', '=', organisationId)
			.orderBy('facility_building_id')
			.orderBy('sort_order')
			.execute();
	}

	async findLevelByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('building_levels')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listSpaces(organisationId: string): Promise<SpaceSummary[]> {
		return this.db
			.selectFrom('facility_spaces')
			.select([
				'id',
				'facility_id as facilityId',
				'facility_building_id as buildingId',
				'building_level_id as levelId',
				'public_id as publicId',
				'space_code as spaceCode',
				'name',
				'space_type as spaceType'
			])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async findSpaceByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('facility_spaces')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listAssetCategories() {
		return this.db
			.selectFrom('asset_categories')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listAssetTypes(organisationId: string): Promise<AssetTypeSummary[]> {
		return this.db
			.selectFrom('asset_types as assetType')
			.innerJoin('asset_categories as category', 'category.id', 'assetType.asset_category_id')
			.select([
				'assetType.id as id',
				'assetType.public_id as publicId',
				'category.code as categoryCode',
				'category.name as categoryName',
				'assetType.code as code',
				'assetType.name as name',
				'assetType.is_maintainable as isMaintainable'
			])
			.where('assetType.organisation_id', '=', organisationId)
			.where('assetType.is_active', '=', 1)
			.orderBy('assetType.name')
			.execute()
			.then((rows) => rows.map((row) => ({ ...row, isMaintainable: Boolean(row.isMaintainable) })));
	}

	async findAssetTypeByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('asset_types')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listAssets(organisationId: string): Promise<AssetSummary[]> {
		return this.db
			.selectFrom('assets as asset')
			.innerJoin('asset_types as assetType', (join) =>
				join.onRef('assetType.id', '=', 'asset.asset_type_id').onRef(
					'assetType.organisation_id',
					'=',
					'asset.organisation_id'
				)
			)
			.leftJoin('facility_buildings as building', (join) =>
				join.onRef('building.id', '=', 'asset.facility_building_id').onRef(
					'building.organisation_id',
					'=',
					'asset.organisation_id'
				)
			)
			.leftJoin('building_levels as level', (join) =>
				join.onRef('level.id', '=', 'asset.building_level_id').onRef(
					'level.organisation_id',
					'=',
					'asset.organisation_id'
				)
			)
			.leftJoin('facility_spaces as space', (join) =>
				join.onRef('space.id', '=', 'asset.facility_space_id').onRef(
					'space.organisation_id',
					'=',
					'asset.organisation_id'
				)
			)
			.select([
				'asset.id as id',
				'asset.facility_id as facilityId',
				'asset.public_id as publicId',
				'asset.asset_type_id as assetTypeId',
				'assetType.name as assetTypeName',
				'asset.parent_asset_id as parentAssetId',
				'asset.asset_tag as assetTag',
				'asset.serial_number as serialNumber',
				'asset.name as name',
				'asset.criticality as criticality',
				'asset.lifecycle_status as lifecycleStatus',
				'building.name as buildingName',
				'level.name as levelName',
				'space.name as spaceName'
			])
			.where('asset.organisation_id', '=', organisationId)
			.where('asset.lifecycle_status', '!=', 'archived')
			.orderBy('asset.asset_tag')
			.execute();
	}

	async findAssetByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('assets')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listPriorities() {
		return this.db
			.selectFrom('maintenance_priority_levels')
			.select(['id', 'code', 'name', 'sort_order as sortOrder'])
			.where('is_active', '=', 1)
			.orderBy('sort_order')
			.execute();
	}

	async listMaintenancePlanTypes() {
		return this.db
			.selectFrom('maintenance_plan_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listWorkOrderTypes() {
		return this.db
			.selectFrom('work_order_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listServiceEventTypes() {
		return this.db
			.selectFrom('service_event_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listComplianceCategories() {
		return this.db
			.selectFrom('compliance_requirement_categories')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name')
			.execute();
	}

	async listMaintenanceRequests(organisationId: string): Promise<MaintenanceRequestSummary[]> {
		return this.db
			.selectFrom('maintenance_requests as request')
			.innerJoin('maintenance_priority_levels as priority', 'priority.id', 'request.maintenance_priority_level_id')
			.select([
				'request.id as id',
				'request.public_id as publicId',
				'request.facility_id as facilityId',
				'request.request_number as requestNumber',
				'request.request_type as requestType',
				'priority.code as priorityCode',
				'priority.name as priorityName',
				'request.title as title',
				'request.description as description',
				'request.request_status as requestStatus',
				'request.reported_at as reportedAt'
			])
			.where('request.organisation_id', '=', organisationId)
			.orderBy('request.reported_at', 'desc')
			.execute();
	}

	async findMaintenanceRequestByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('maintenance_requests')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listMaintenancePlans(organisationId: string): Promise<MaintenancePlanSummary[]> {
		return this.db
			.selectFrom('maintenance_plans as plan')
			.innerJoin('maintenance_plan_types as planType', 'planType.id', 'plan.maintenance_plan_type_id')
			.select([
				'plan.id as id',
				'plan.public_id as publicId',
				'plan.facility_id as facilityId',
				'plan.plan_number as planNumber',
				'planType.name as planTypeName',
				'plan.name as name',
				'plan.description as description',
				'plan.lifecycle_status as lifecycleStatus',
				'plan.starts_on as startsOn'
			])
			.where('plan.organisation_id', '=', organisationId)
			.orderBy('plan.name')
			.execute();
	}

	async listMaintenancePlanTasks(organisationId: string): Promise<MaintenancePlanTaskSummary[]> {
		const rows = await this.db
			.selectFrom('maintenance_plan_tasks as task')
			.leftJoin('maintenance_task_schedule_rules as rule', (join) =>
				join.onRef('rule.maintenance_plan_task_id', '=', 'task.id').onRef(
					'rule.organisation_id',
					'=',
					'task.organisation_id'
				).on('rule.is_active', '=', 1)
			)
			.select([
				'task.id as id',
				'task.maintenance_plan_id as maintenancePlanId',
				'task.task_number as taskNumber',
				'task.title as title',
				'task.instructions as instructions',
				'task.estimated_duration_minutes as estimatedDurationMinutes',
				'task.requires_shutdown as requiresShutdown',
				'rule.schedule_basis as scheduleBasis',
				'rule.interval_value as intervalValue',
				'rule.interval_unit as intervalUnit',
				'rule.starts_on as startsOn'
			])
			.where('task.organisation_id', '=', organisationId)
			.where('task.is_active', '=', 1)
			.orderBy('task.maintenance_plan_id')
			.orderBy('task.task_number')
			.execute();
		return rows.map((row) => ({ ...row, requiresShutdown: Boolean(row.requiresShutdown) }));
	}

	async findMaintenancePlanTask(organisationId: string, taskId: string) {
		return this.db
			.selectFrom('maintenance_plan_tasks as task')
			.innerJoin('maintenance_plans as plan', (join) =>
				join.onRef('plan.id', '=', 'task.maintenance_plan_id').onRef('plan.organisation_id', '=', 'task.organisation_id')
			)
			.leftJoin('maintenance_task_schedule_rules as rule', (join) =>
				join.onRef('rule.maintenance_plan_task_id', '=', 'task.id').onRef('rule.organisation_id', '=', 'task.organisation_id').on('rule.is_active', '=', 1)
			)
			.select([
				'task.id as id',
				'task.title as title',
				'task.instructions as instructions',
				'task.estimated_duration_minutes as estimatedDurationMinutes',
				'plan.id as planId',
				'plan.public_id as planPublicId',
				'plan.facility_id as facilityId',
				'plan.lifecycle_status as planStatus',
				'rule.starts_on as startsOn'
			])
			.where('task.organisation_id', '=', organisationId)
			.where('task.id', '=', taskId)
			.executeTakeFirst();
	}

	async listWorkOrders(organisationId: string): Promise<WorkOrderSummary[]> {
		return this.db
			.selectFrom('work_orders as workOrder')
			.innerJoin('work_order_types as type', 'type.id', 'workOrder.work_order_type_id')
			.innerJoin('maintenance_priority_levels as priority', 'priority.id', 'workOrder.maintenance_priority_level_id')
			.select([
				'workOrder.id as id',
				'workOrder.public_id as publicId',
				'workOrder.facility_id as facilityId',
				'workOrder.work_order_number as workOrderNumber',
				'type.code as workOrderTypeCode',
				'type.name as workOrderTypeName',
				'priority.code as priorityCode',
				'priority.name as priorityName',
				'workOrder.title as title',
				'workOrder.description as description',
				'workOrder.work_order_status as workOrderStatus',
				'workOrder.scheduled_start_at as scheduledStartAt',
				'workOrder.started_at as startedAt',
				'workOrder.completed_at as completedAt',
				'workOrder.completion_summary as completionSummary'
			])
			.where('workOrder.organisation_id', '=', organisationId)
			.orderBy('workOrder.created_at', 'desc')
			.execute();
	}

	async findWorkOrderByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('work_orders')
			.selectAll()
			.where('organisation_id', '=', organisationId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listContractorAssignments(organisationId: string): Promise<ContractorAssignmentSummary[]> {
		const rows = await this.db
			.selectFrom('work_order_party_assignments as assignment')
			.innerJoin('parties as party', (join) =>
				join.onRef('party.id', '=', 'assignment.party_id').onRef('party.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('party_organisations as partyOrganisation', (join) =>
				join.onRef('partyOrganisation.party_id', '=', 'party.id').onRef('partyOrganisation.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'assignment.work_order_id as workOrderId',
				'assignment.party_id as partyId',
				'party.public_id as partyPublicId',
				'partyOrganisation.legal_name as legalName',
				'partyOrganisation.trading_name as tradingName',
				'assignment.assignment_role as assignmentRole'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.unassigned_at', 'is', null)
			.orderBy('assignment.assigned_at', 'desc')
			.execute();
		return rows.map((row) => ({
			workOrderId: row.workOrderId,
			partyId: row.partyId,
			partyPublicId: row.partyPublicId,
			displayName: row.tradingName ?? row.legalName,
			assignmentRole: row.assignmentRole
		}));
	}

	async listServiceEvents(organisationId: string): Promise<ServiceEventSummary[]> {
		return this.db
			.selectFrom('asset_service_events as event')
			.innerJoin('assets as asset', (join) =>
				join.onRef('asset.id', '=', 'event.asset_id').onRef('asset.organisation_id', '=', 'event.organisation_id')
			)
			.innerJoin('service_event_types as type', 'type.id', 'event.service_event_type_id')
			.select([
				'event.id as id',
				'event.public_id as publicId',
				'event.asset_id as assetId',
				'asset.asset_tag as assetTag',
				'type.name as serviceTypeName',
				'event.performed_at as performedAt',
				'event.result_code as resultCode',
				'event.condition_rating as conditionRating',
				'event.notes as notes',
				'event.recommended_next_service_on as recommendedNextServiceOn'
			])
			.where('event.organisation_id', '=', organisationId)
			.orderBy('event.performed_at', 'desc')
			.execute();
	}

	async listComplianceRequirements(organisationId: string): Promise<ComplianceRequirementSummary[]> {
		return this.db
			.selectFrom('compliance_requirements as requirement')
			.innerJoin('compliance_requirement_categories as category', 'category.id', 'requirement.compliance_requirement_category_id')
			.leftJoin('compliance_requirement_versions as version', (join) =>
				join.onRef('version.compliance_requirement_id', '=', 'requirement.id').onRef('version.organisation_id', '=', 'requirement.organisation_id').on('version.version_status', '=', 'published')
			)
			.select([
				'requirement.id as id',
				'requirement.public_id as publicId',
				'category.name as categoryName',
				'requirement.requirement_code as requirementCode',
				'requirement.name as name',
				'requirement.lifecycle_status as lifecycleStatus',
				'version.id as publishedVersionId',
				'version.version_number as publishedVersionNumber',
				'version.interval_value as intervalValue',
				'version.interval_unit as intervalUnit'
			])
			.where('requirement.organisation_id', '=', organisationId)
			.orderBy('requirement.name')
			.execute();
	}

	async findComplianceRequirementByPublicId(organisationId: string, publicId: string) {
		return this.db
			.selectFrom('compliance_requirements as requirement')
			.innerJoin('compliance_requirement_versions as version', (join) =>
				join.onRef('version.compliance_requirement_id', '=', 'requirement.id').onRef('version.organisation_id', '=', 'requirement.organisation_id').on('version.version_status', '=', 'published')
			)
			.select([
				'requirement.id as id',
				'requirement.public_id as publicId',
				'requirement.name as name',
				'version.id as versionId',
				'version.version_number as versionNumber'
			])
			.where('requirement.organisation_id', '=', organisationId)
			.where('requirement.public_id', '=', publicId)
			.executeTakeFirst();
	}

	async listAssetComplianceAssignments(organisationId: string): Promise<AssetComplianceAssignmentSummary[]> {
		const rows = await this.db
			.selectFrom('asset_compliance_assignments as assignment')
			.innerJoin('assets as asset', (join) =>
				join.onRef('asset.id', '=', 'assignment.asset_id').onRef('asset.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('compliance_requirements as requirement', (join) =>
				join.onRef('requirement.id', '=', 'assignment.compliance_requirement_id').onRef('requirement.organisation_id', '=', 'assignment.organisation_id')
			)
			.select([
				'assignment.id as id',
				'assignment.asset_id as assetId',
				'asset.asset_tag as assetTag',
				'assignment.compliance_requirement_id as complianceRequirementId',
				'requirement.name as requirementName',
				'assignment.assigned_from as assignedFrom',
				'assignment.is_active as isActive'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.orderBy('asset.asset_tag')
			.execute();
		return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
	}

	async findAssetComplianceAssignment(organisationId: string, assignmentId: string) {
		return this.db
			.selectFrom('asset_compliance_assignments as assignment')
			.innerJoin('assets as asset', (join) =>
				join.onRef('asset.id', '=', 'assignment.asset_id').onRef('asset.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('compliance_requirements as requirement', (join) =>
				join.onRef('requirement.id', '=', 'assignment.compliance_requirement_id').onRef('requirement.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin('compliance_requirement_versions as version', (join) =>
				join.onRef('version.compliance_requirement_id', '=', 'requirement.id').onRef('version.organisation_id', '=', 'requirement.organisation_id').on('version.version_status', '=', 'published')
			)
			.select([
				'assignment.id as id',
				'assignment.asset_id as assetId',
				'asset.facility_id as facilityId',
				'assignment.compliance_requirement_id as complianceRequirementId',
				'requirement.name as requirementName',
				'version.id as requirementVersionId'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.id', '=', assignmentId)
			.where('assignment.is_active', '=', 1)
			.executeTakeFirst();
	}

	async listComplianceEvents(organisationId: string): Promise<ComplianceEventSummary[]> {
		return this.db
			.selectFrom('compliance_events as event')
			.innerJoin('compliance_requirement_versions as version', (join) =>
				join.onRef('version.id', '=', 'event.compliance_requirement_version_id').onRef('version.organisation_id', '=', 'event.organisation_id')
			)
			.innerJoin('compliance_requirements as requirement', (join) =>
				join.onRef('requirement.id', '=', 'version.compliance_requirement_id').onRef('requirement.organisation_id', '=', 'event.organisation_id')
			)
			.leftJoin('asset_compliance_assignments as assignment', (join) =>
				join.onRef('assignment.id', '=', 'event.asset_compliance_assignment_id').onRef('assignment.organisation_id', '=', 'event.organisation_id')
			)
			.leftJoin('assets as asset', (join) =>
				join.onRef('asset.id', '=', 'assignment.asset_id').onRef('asset.organisation_id', '=', 'event.organisation_id')
			)
			.select([
				'event.id as id',
				'event.public_id as publicId',
				'event.compliance_event_number as complianceEventNumber',
				'event.asset_compliance_assignment_id as assetAssignmentId',
				'asset.asset_tag as assetTag',
				'requirement.name as requirementName',
				'event.performed_at as performedAt',
				'event.outcome as outcome',
				'event.findings_summary as findingsSummary',
				'event.recommended_next_due_on as recommendedNextDueOn'
			])
			.where('event.organisation_id', '=', organisationId)
			.orderBy('event.performed_at', 'desc')
			.execute();
	}

	async listEvidenceVersions(
		organisationId: string,
		projectIds: readonly string[]
	): Promise<EvidenceVersionSummary[]> {
		if (projectIds.length === 0) return [];
		return this.db
			.selectFrom('information_container_versions as version')
			.innerJoin('information_containers as container', (join) =>
				join.onRef('container.id', '=', 'version.information_container_id').onRef(
					'container.owning_organisation_id',
					'=',
					'version.owning_organisation_id'
				)
			)
			.select([
				'version.id as id',
				'version.public_id as publicId',
				'container.public_id as containerPublicId',
				'container.container_reference as containerReference',
				'version.title as title',
				'version.revision_code as revisionCode',
				'version.status as versionStatus'
			])
			.where('version.owning_organisation_id', '=', organisationId)
			.where('container.project_id', 'in', projectIds)
			.where('version.status', 'in', ['issued', 'superseded'])
			.orderBy('container.container_reference')
			.orderBy('version.revision_code', 'desc')
			.execute();
	}

	async findEvidenceVersionByPublicId(
		organisationId: string,
		projectIds: readonly string[],
		publicId: string
	) {
		if (projectIds.length === 0) return null;
		return this.db
			.selectFrom('information_container_versions as version')
			.innerJoin('information_containers as container', (join) =>
				join.onRef('container.id', '=', 'version.information_container_id').onRef('container.owning_organisation_id', '=', 'version.owning_organisation_id')
			)
			.select(['version.id as id', 'version.public_id as publicId'])
			.where('version.owning_organisation_id', '=', organisationId)
			.where('version.public_id', '=', publicId)
			.where('container.project_id', 'in', projectIds)
			.where('version.status', 'in', ['issued', 'superseded'])
			.executeTakeFirst();
	}
}
