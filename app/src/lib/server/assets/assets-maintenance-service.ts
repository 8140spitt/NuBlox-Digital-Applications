import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ProcurementRepository } from '$lib/server/procurement/procurement-repository';
import { ProjectRepository } from '$lib/server/projects/project-repository';
import { WorkforceRepository } from '$lib/server/workforce/workforce-repository';
import { AssetsMaintenanceRepository } from './assets-maintenance-repository';

export class AssetsMaintenanceValidationError extends Error {
	readonly code = 'ASSETS_MAINTENANCE_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'AssetsMaintenanceValidationError';
	}
}

export type AssetsMaintenanceWorkspace = {
	canViewAssets: boolean;
	canManageAssets: boolean;
	canManageAssetLifecycle: boolean;
	canManageAssetEvidence: boolean;
	canViewFacilities: boolean;
	canManageFacilities: boolean;
	canViewMaintenance: boolean;
	canManageRequests: boolean;
	canManagePlans: boolean;
	canManageWorkOrders: boolean;
	canCompleteWorkOrders: boolean;
	canManageAssignments: boolean;
	canManageService: boolean;
	canViewCompliance: boolean;
	canManageCompliance: boolean;
	canLinkEvidence: boolean;
	facilities: Awaited<ReturnType<AssetsMaintenanceRepository['listFacilities']>>;
	buildings: Awaited<ReturnType<AssetsMaintenanceRepository['listBuildings']>>;
	levels: Awaited<ReturnType<AssetsMaintenanceRepository['listLevels']>>;
	spaces: Awaited<ReturnType<AssetsMaintenanceRepository['listSpaces']>>;
	assetCategories: Awaited<ReturnType<AssetsMaintenanceRepository['listAssetCategories']>>;
	assetTypes: Awaited<ReturnType<AssetsMaintenanceRepository['listAssetTypes']>>;
	assets: Awaited<ReturnType<AssetsMaintenanceRepository['listAssets']>>;
	priorities: Awaited<ReturnType<AssetsMaintenanceRepository['listPriorities']>>;
	planTypes: Awaited<ReturnType<AssetsMaintenanceRepository['listMaintenancePlanTypes']>>;
	workOrderTypes: Awaited<ReturnType<AssetsMaintenanceRepository['listWorkOrderTypes']>>;
	serviceEventTypes: Awaited<ReturnType<AssetsMaintenanceRepository['listServiceEventTypes']>>;
	complianceCategories: Awaited<
		ReturnType<AssetsMaintenanceRepository['listComplianceCategories']>
	>;
	requests: Awaited<ReturnType<AssetsMaintenanceRepository['listMaintenanceRequests']>>;
	plans: Awaited<ReturnType<AssetsMaintenanceRepository['listMaintenancePlans']>>;
	planTasks: Awaited<ReturnType<AssetsMaintenanceRepository['listMaintenancePlanTasks']>>;
	workOrders: Awaited<ReturnType<AssetsMaintenanceRepository['listWorkOrders']>>;
	contractorAssignments: Awaited<
		ReturnType<AssetsMaintenanceRepository['listContractorAssignments']>
	>;
	serviceEvents: Awaited<ReturnType<AssetsMaintenanceRepository['listServiceEvents']>>;
	complianceRequirements: Awaited<
		ReturnType<AssetsMaintenanceRepository['listComplianceRequirements']>
	>;
	assetComplianceAssignments: Awaited<
		ReturnType<AssetsMaintenanceRepository['listAssetComplianceAssignments']>
	>;
	complianceEvents: Awaited<ReturnType<AssetsMaintenanceRepository['listComplianceEvents']>>;
	contractors: Awaited<ReturnType<ProcurementRepository['listEligibleSuppliers']>>;
	workers: Awaited<ReturnType<WorkforceRepository['listWorkers']>>;
	evidenceVersions: Awaited<ReturnType<AssetsMaintenanceRepository['listEvidenceVersions']>>;
};

export type CreateFacilityInput = {
	facilityCode: string;
	name: string;
	description?: string | null;
	timezone?: string | null;
	commissionedOn?: string | null;
	openedOn?: string | null;
};

export type CreateBuildingInput = { facilityPublicId: string; buildingCode: string; name: string };
export type CreateLevelInput = {
	buildingPublicId: string;
	levelCode: string;
	name: string;
	sortOrder: string;
};
export type CreateSpaceInput = {
	buildingPublicId: string;
	levelPublicId?: string | null;
	spaceCode: string;
	name: string;
	spaceType?: string | null;
};
export type CreateAssetTypeInput = {
	categoryCode: string;
	code: string;
	name: string;
	description?: string | null;
};
export type CreateAssetInput = {
	facilityPublicId: string;
	assetTypePublicId: string;
	buildingPublicId?: string | null;
	levelPublicId?: string | null;
	spacePublicId?: string | null;
	parentAssetPublicId?: string | null;
	assetTag: string;
	serialNumber?: string | null;
	name: string;
	description?: string | null;
	criticality: string;
};
export type CreateMaintenanceRequestInput = {
	facilityPublicId: string;
	assetPublicId?: string | null;
	priorityCode: string;
	requestType: string;
	title: string;
	description: string;
};
export type CreateMaintenancePlanInput = {
	facilityPublicId: string;
	assetPublicId: string;
	planTypeCode: string;
	name: string;
	description?: string | null;
	taskTitle: string;
	instructions?: string | null;
	intervalValue: string;
	intervalUnit: string;
	startsOn?: string | null;
};
export type LinkEvidenceInput = {
	subjectType: 'asset' | 'workOrder' | 'service' | 'compliance';
	subjectPublicId: string;
	informationVersionPublicId: string;
	linkRole: string;
};

function requiredText(value: string, label: string, max = 500): string {
	const text = value.trim();
	if (!text) throw new AssetsMaintenanceValidationError(`${label} is required.`);
	if (text.length > max) throw new AssetsMaintenanceValidationError(`${label} is too long.`);
	return text;
}

function optionalText(value: string | null | undefined, max = 1000): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > max)
		throw new AssetsMaintenanceValidationError('A supplied value is too long.');
	return text;
}

function publicId(value: string, label: string): string {
	const text = requiredText(value, label, 36);
	if (!/^[0-9a-f-]{36}$/i.test(text))
		throw new AssetsMaintenanceValidationError(`${label} is invalid.`);
	return text;
}

function safeId(value: string, label: string): string {
	const text = requiredText(value, label, 24);
	if (!/^\d+$/.test(text) || text === '0')
		throw new AssetsMaintenanceValidationError(`${label} is invalid.`);
	return text;
}

function dateOnly(value: string | null | undefined, label: string): Date | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(text))
		throw new AssetsMaintenanceValidationError(`${label} is invalid.`);
	const parsed = new Date(`${text}T00:00:00.000Z`);
	if (Number.isNaN(parsed.getTime()))
		throw new AssetsMaintenanceValidationError(`${label} is invalid.`);
	return parsed;
}

function dateTime(value: string, label: string): Date {
	const text = requiredText(value, label, 64);
	const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(text) ? text : `${text}:00.000Z`;
	const parsed = new Date(normalized);
	if (Number.isNaN(parsed.getTime()))
		throw new AssetsMaintenanceValidationError(`${label} is invalid.`);
	return parsed;
}

function dayOf(value: Date): Date {
	return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function positiveInteger(value: string, label: string): number {
	const number = Number(value);
	if (!Number.isInteger(number) || number <= 0)
		throw new AssetsMaintenanceValidationError(`${label} must be a positive whole number.`);
	return number;
}

function reference(prefix: string, id: string, now: Date): string {
	const date = now.toISOString().slice(0, 10).replaceAll('-', '');
	return `${prefix}-${date}-${id.replaceAll('-', '').slice(0, 10).toUpperCase()}`;
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('MySQL did not return the inserted ID.');
	return result.insertId.toString();
}

function criticality(value: string): 'low' | 'medium' | 'high' | 'critical' {
	if (value === 'low' || value === 'medium' || value === 'high' || value === 'critical')
		return value;
	throw new AssetsMaintenanceValidationError('Asset criticality is invalid.');
}

function requestType(
	value: string
): 'fault' | 'breakdown' | 'damage' | 'alarm' | 'user_request' | 'defect' | 'other' {
	if (
		value === 'fault' ||
		value === 'breakdown' ||
		value === 'damage' ||
		value === 'alarm' ||
		value === 'user_request' ||
		value === 'defect' ||
		value === 'other'
	)
		return value;
	throw new AssetsMaintenanceValidationError('Maintenance request type is invalid.');
}

export class AssetsMaintenanceService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext, db: DatabaseExecutor = this.db) {
		const membership = await new OrganisationMembershipRepository(db).findActiveActorMembership(
			actor
		);
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
		if (!(await new PermissionService(db).decide(actor, permissionKey)).allowed) {
			throw new TenantAccessError('This assets or maintenance action is not permitted.');
		}
	}

	async getWorkspace(actor: TenantActorContext): Promise<AssetsMaintenanceWorkspace> {
		await this.assertActiveActor(actor);
		const [
			canViewAssets,
			canManageAssets,
			canManageAssetLifecycle,
			canManageAssetEvidence,
			canViewFacilities,
			canManageFacilities,
			canViewMaintenance,
			canManageRequests,
			canManagePlans,
			canManageWorkOrders,
			canCompleteWorkOrders,
			canManageAssignments,
			canManageService,
			canViewCompliance,
			canManageCompliance,
			canViewInformation
		] = await Promise.all([
			this.allowed(actor, 'assets.view'),
			this.allowed(actor, 'assets.manage'),
			this.allowed(actor, 'assets.lifecycle.manage'),
			this.allowed(actor, 'assets.evidence.manage'),
			this.allowed(actor, 'facilities.view'),
			this.allowed(actor, 'facilities.manage'),
			this.allowed(actor, 'maintenance.view'),
			this.allowed(actor, 'maintenance.request.manage'),
			this.allowed(actor, 'maintenance.plan.manage'),
			this.allowed(actor, 'maintenance.work_order.manage'),
			this.allowed(actor, 'maintenance.work_order.complete'),
			this.allowed(actor, 'maintenance.assignment.manage'),
			this.allowed(actor, 'maintenance.service.manage'),
			this.allowed(actor, 'compliance.view'),
			this.allowed(actor, 'compliance.manage'),
			this.allowed(actor, 'information.view')
		]);

		const repository = new AssetsMaintenanceRepository(this.db);
		const canReadAny =
			canViewAssets || canViewFacilities || canViewMaintenance || canViewCompliance;
		if (!canReadAny) {
			return {
				canViewAssets,
				canManageAssets,
				canManageAssetLifecycle,
				canManageAssetEvidence,
				canViewFacilities,
				canManageFacilities,
				canViewMaintenance,
				canManageRequests,
				canManagePlans,
				canManageWorkOrders,
				canCompleteWorkOrders,
				canManageAssignments,
				canManageService,
				canViewCompliance,
				canManageCompliance,
				canLinkEvidence: false,
				facilities: [],
				buildings: [],
				levels: [],
				spaces: [],
				assetCategories: [],
				assetTypes: [],
				assets: [],
				priorities: [],
				planTypes: [],
				workOrderTypes: [],
				serviceEventTypes: [],
				complianceCategories: [],
				requests: [],
				plans: [],
				planTasks: [],
				workOrders: [],
				contractorAssignments: [],
				serviceEvents: [],
				complianceRequirements: [],
				assetComplianceAssignments: [],
				complianceEvents: [],
				contractors: [],
				workers: [],
				evidenceVersions: []
			};
		}

		const projects = canViewInformation
			? await new ProjectRepository(this.db).listForMember(actor.organisationId, actor.memberId)
			: [];
		const projectIds = projects.map((project) => project.id);
		const [
			facilities,
			buildings,
			levels,
			spaces,
			assetCategories,
			assetTypes,
			assets,
			priorities,
			planTypes,
			workOrderTypes,
			serviceEventTypes,
			complianceCategories,
			requests,
			plans,
			planTasks,
			workOrders,
			contractorAssignments,
			serviceEvents,
			complianceRequirements,
			assetComplianceAssignments,
			complianceEvents,
			contractors,
			workers,
			evidenceVersions
		] = await Promise.all([
			repository.listFacilities(actor.organisationId),
			repository.listBuildings(actor.organisationId),
			repository.listLevels(actor.organisationId),
			repository.listSpaces(actor.organisationId),
			repository.listAssetCategories(),
			repository.listAssetTypes(actor.organisationId),
			repository.listAssets(actor.organisationId),
			repository.listPriorities(),
			repository.listMaintenancePlanTypes(),
			repository.listWorkOrderTypes(),
			repository.listServiceEventTypes(),
			repository.listComplianceCategories(),
			canViewMaintenance
				? repository.listMaintenanceRequests(actor.organisationId)
				: Promise.resolve([]),
			canViewMaintenance
				? repository.listMaintenancePlans(actor.organisationId)
				: Promise.resolve([]),
			canViewMaintenance
				? repository.listMaintenancePlanTasks(actor.organisationId)
				: Promise.resolve([]),
			canViewMaintenance ? repository.listWorkOrders(actor.organisationId) : Promise.resolve([]),
			canViewMaintenance
				? repository.listContractorAssignments(actor.organisationId)
				: Promise.resolve([]),
			canViewMaintenance || canViewAssets
				? repository.listServiceEvents(actor.organisationId)
				: Promise.resolve([]),
			canViewCompliance
				? repository.listComplianceRequirements(actor.organisationId)
				: Promise.resolve([]),
			canViewCompliance
				? repository.listAssetComplianceAssignments(actor.organisationId)
				: Promise.resolve([]),
			canViewCompliance
				? repository.listComplianceEvents(actor.organisationId)
				: Promise.resolve([]),
			canManageAssignments
				? new ProcurementRepository(this.db).listEligibleSuppliers(actor.organisationId)
				: Promise.resolve([]),
			canManageAssignments
				? new WorkforceRepository(this.db).listWorkers(actor.organisationId)
				: Promise.resolve([]),
			canViewInformation
				? repository.listEvidenceVersions(actor.organisationId, projectIds)
				: Promise.resolve([])
		]);

		return {
			canViewAssets,
			canManageAssets,
			canManageAssetLifecycle,
			canManageAssetEvidence,
			canViewFacilities,
			canManageFacilities,
			canViewMaintenance,
			canManageRequests,
			canManagePlans,
			canManageWorkOrders,
			canCompleteWorkOrders,
			canManageAssignments,
			canManageService,
			canViewCompliance,
			canManageCompliance,
			canLinkEvidence: canManageAssetEvidence && canViewInformation && evidenceVersions.length > 0,
			facilities,
			buildings,
			levels,
			spaces,
			assetCategories,
			assetTypes,
			assets,
			priorities,
			planTypes,
			workOrderTypes,
			serviceEventTypes,
			complianceCategories,
			requests,
			plans,
			planTasks,
			workOrders,
			contractorAssignments,
			serviceEvents,
			complianceRequirements,
			assetComplianceAssignments,
			complianceEvents,
			contractors,
			workers,
			evidenceVersions
		};
	}

	async createFacility(actor: TenantActorContext, input: CreateFacilityInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'facilities.manage');
		const id = this.publicIdFactory();
		const timezone = optionalText(input.timezone, 64);
		if (timezone) {
			try {
				new Intl.DateTimeFormat('en-GB', { timeZone: timezone }).format(this.now());
			} catch {
				throw new AssetsMaintenanceValidationError('A valid IANA timezone is required.');
			}
		}
		const commissionedOn = dateOnly(input.commissionedOn, 'Commissioned date');
		const openedOn = dateOnly(input.openedOn, 'Opened date');
		if (commissionedOn && openedOn && openedOn < commissionedOn)
			throw new AssetsMaintenanceValidationError('Opened date cannot be before commissioned date.');
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('facilities')
				.values({
					organisation_id: actor.organisationId,
					public_id: id,
					facility_code: requiredText(input.facilityCode, 'Facility code', 80),
					name: requiredText(input.name, 'Facility name', 255),
					description: optionalText(input.description, 4000),
					address_id: null,
					timezone,
					operational_status: 'active',
					commissioned_on: commissionedOn,
					opened_on: openedOn,
					decommissioned_on: null,
					created_by_member_id: actor.memberId
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'facilities.create', 'facility', id, {
				facilityCode: input.facilityCode
			});
		});
		return id;
	}

	async linkFacilityProject(
		actor: TenantActorContext,
		facilityPublicIdInput: string,
		projectPublicIdInput: string,
		linkRoleInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'facilities.manage');
		const facility = await this.requireFacility(actor, facilityPublicIdInput);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			publicId(projectPublicIdInput, 'Project')
		);
		if (!project) throw new TenantAccessError('Project is outside your effective project scope.');
		const roles = [
			'construction',
			'handover',
			'fit_out',
			'refurbishment',
			'maintenance',
			'replacement',
			'decommissioning',
			'other'
		] as const;
		if (!roles.includes(linkRoleInput as (typeof roles)[number])) {
			throw new AssetsMaintenanceValidationError('Facility-project link role is invalid.');
		}
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('facility_project_links')
				.ignore()
				.values({
					organisation_id: actor.organisationId,
					facility_id: facility.id,
					project_id: project.id,
					link_role: linkRoleInput as (typeof roles)[number],
					linked_on: dayOf(this.now()),
					ended_on: null,
					linked_by_member_id: actor.memberId
				})
				.execute();
			await this.audit(
				trx,
				actor,
				'facilities.project.link',
				'facility',
				facility.public_id,
				{ projectPublicId: project.publicId, linkRole: linkRoleInput },
				project.id
			);
		});
	}

	async createBuilding(actor: TenantActorContext, input: CreateBuildingInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'facilities.manage');
		const facility = await this.requireFacility(actor, input.facilityPublicId);
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('facility_buildings')
				.values({
					organisation_id: actor.organisationId,
					facility_id: facility.id,
					public_id: id,
					building_code: requiredText(input.buildingCode, 'Building code', 80),
					name: requiredText(input.name, 'Building name', 255),
					description: null,
					operational_status: 'active'
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'facilities.building.create', 'facility_building', id, {
				facilityPublicId: facility.public_id
			});
		});
		return id;
	}

	async createLevel(actor: TenantActorContext, input: CreateLevelInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'facilities.manage');
		const building = await this.requireBuilding(actor, input.buildingPublicId);
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('building_levels')
				.values({
					organisation_id: actor.organisationId,
					facility_id: building.facility_id,
					facility_building_id: building.id,
					public_id: id,
					level_code: requiredText(input.levelCode, 'Level code', 80),
					name: requiredText(input.name, 'Level name', 255),
					level_number: null,
					sort_order: positiveInteger(input.sortOrder, 'Sort order')
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'facilities.level.create', 'building_level', id, {
				buildingPublicId: building.public_id
			});
		});
		return id;
	}

	async createSpace(actor: TenantActorContext, input: CreateSpaceInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'facilities.manage');
		const building = await this.requireBuilding(actor, input.buildingPublicId);
		const level = input.levelPublicId?.trim()
			? await this.requireLevel(actor, input.levelPublicId)
			: null;
		if (
			level &&
			(level.facility_id !== building.facility_id || level.facility_building_id !== building.id)
		)
			throw new AssetsMaintenanceValidationError('Level does not belong to the selected building.');
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('facility_spaces')
				.values({
					organisation_id: actor.organisationId,
					facility_id: building.facility_id,
					facility_building_id: building.id,
					building_level_id: level?.id ?? null,
					parent_space_id: null,
					public_id: id,
					space_code: requiredText(input.spaceCode, 'Space code', 120),
					name: requiredText(input.name, 'Space name', 255),
					space_type: optionalText(input.spaceType, 80),
					description: null,
					is_active: 1
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'facilities.space.create', 'facility_space', id, {
				buildingPublicId: building.public_id
			});
		});
		return id;
	}

	async createAssetType(actor: TenantActorContext, input: CreateAssetTypeInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'assets.manage');
		const category = await this.db
			.selectFrom('asset_categories')
			.select(['id'])
			.where('code', '=', requiredText(input.categoryCode, 'Asset category', 64))
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!category) throw new AssetsMaintenanceValidationError('Asset category is invalid.');
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('asset_types')
				.values({
					organisation_id: actor.organisationId,
					public_id: id,
					asset_category_id: category.id,
					code: requiredText(input.code, 'Asset type code', 80),
					name: requiredText(input.name, 'Asset type name', 255),
					description: optionalText(input.description, 4000),
					is_maintainable: 1,
					is_active: 1
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'assets.type.create', 'asset_type', id, {
				categoryCode: input.categoryCode
			});
		});
		return id;
	}

	async createAsset(actor: TenantActorContext, input: CreateAssetInput): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'assets.manage');
		const repository = new AssetsMaintenanceRepository(this.db);
		const facility = await this.requireFacility(actor, input.facilityPublicId);
		const assetType = await repository.findAssetTypeByPublicId(
			actor.organisationId,
			publicId(input.assetTypePublicId, 'Asset type')
		);
		if (!assetType) throw new AssetsMaintenanceValidationError('Asset type is unavailable.');
		const building = input.buildingPublicId?.trim()
			? await this.requireBuilding(actor, input.buildingPublicId)
			: null;
		const level = input.levelPublicId?.trim()
			? await this.requireLevel(actor, input.levelPublicId)
			: null;
		const space = input.spacePublicId?.trim()
			? await this.requireSpace(actor, input.spacePublicId)
			: null;
		const parent = input.parentAssetPublicId?.trim()
			? await this.requireAsset(actor, input.parentAssetPublicId)
			: null;
		for (const selected of [building, level, space, parent])
			if (selected && selected.facility_id !== facility.id)
				throw new AssetsMaintenanceValidationError(
					'Selected asset hierarchy must belong to the same facility.'
				);
		if (level && building && level.facility_building_id !== building.id)
			throw new AssetsMaintenanceValidationError('Level does not belong to the selected building.');
		if (space && building && space.facility_building_id !== building.id)
			throw new AssetsMaintenanceValidationError('Space does not belong to the selected building.');
		if (space && level && space.building_level_id && space.building_level_id !== level.id)
			throw new AssetsMaintenanceValidationError('Space does not belong to the selected level.');
		const id = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const assetId = insertedId(
				await trx
					.insertInto('assets')
					.values({
						organisation_id: actor.organisationId,
						facility_id: facility.id,
						public_id: id,
						asset_type_id: assetType.id,
						asset_model_id: null,
						facility_building_id:
							building?.id ?? space?.facility_building_id ?? level?.facility_building_id ?? null,
						building_level_id: level?.id ?? space?.building_level_id ?? null,
						facility_space_id: space?.id ?? null,
						building_system_id: null,
						parent_asset_id: parent?.id ?? null,
						asset_tag: requiredText(input.assetTag, 'Asset tag', 160),
						serial_number: optionalText(input.serialNumber, 255),
						name: requiredText(input.name, 'Asset name', 255),
						description: optionalText(input.description, 4000),
						criticality: criticality(input.criticality),
						lifecycle_status: 'active',
						installed_on: null,
						commissioned_on: null,
						decommissioned_on: null,
						created_by_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('asset_lifecycle_events')
				.values({
					organisation_id: actor.organisationId,
					asset_id: assetId,
					event_type: 'in_service',
					from_status: null,
					to_status: 'active',
					effective_at: now,
					acted_by_member_id: actor.memberId,
					notes: 'Asset registered in NuBlox.'
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'assets.create', 'asset', id, {
				facilityPublicId: facility.public_id,
				assetTag: input.assetTag
			});
		});
		return id;
	}

	async transitionAsset(
		actor: TenantActorContext,
		assetPublicIdInput: string,
		toStatusInput: string,
		notes?: string | null
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'assets.lifecycle.manage');
		const assetPublicId = publicId(assetPublicIdInput, 'Asset');
		const allowed: Record<string, readonly string[]> = {
			planned: ['installed', 'active'],
			installed: ['active', 'decommissioned'],
			active: ['isolated', 'inactive', 'decommissioned'],
			isolated: ['active', 'decommissioned'],
			inactive: ['active', 'decommissioned'],
			decommissioned: ['disposed']
		};
		await this.db.transaction().execute(async (trx) => {
			const asset = await trx
				.selectFrom('assets')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', assetPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!asset) throw new TenantAccessError('Asset not found.');
			if (!(allowed[asset.lifecycle_status] ?? []).includes(toStatusInput))
				throw new AssetsMaintenanceValidationError(
					`Asset cannot move from ${asset.lifecycle_status} to ${toStatusInput}.`
				);
			const toStatus = toStatusInput as
				'installed' | 'active' | 'isolated' | 'inactive' | 'decommissioned' | 'disposed';
			const eventType =
				toStatus === 'isolated'
					? 'isolated'
					: toStatus === 'active' && asset.lifecycle_status === 'isolated'
						? 'returned_to_service'
						: toStatus === 'decommissioned'
							? 'decommissioned'
							: toStatus === 'disposed'
								? 'disposed'
								: toStatus === 'installed'
									? 'installed'
									: 'in_service';
			await trx
				.updateTable('assets')
				.set({
					lifecycle_status: toStatus,
					decommissioned_on:
						toStatus === 'decommissioned' ? dayOf(this.now()) : asset.decommissioned_on
				})
				.where('id', '=', asset.id)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('asset_lifecycle_events')
				.values({
					organisation_id: actor.organisationId,
					asset_id: asset.id,
					event_type: eventType,
					from_status: asset.lifecycle_status,
					to_status: toStatus,
					effective_at: this.now(),
					acted_by_member_id: actor.memberId,
					notes: optionalText(notes, 4000)
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'assets.lifecycle.transition', 'asset', assetPublicId, {
				fromStatus: asset.lifecycle_status,
				toStatus
			});
		});
	}

	async createMaintenanceRequest(
		actor: TenantActorContext,
		input: CreateMaintenanceRequestInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.request.manage');
		const facility = await this.requireFacility(actor, input.facilityPublicId);
		const asset = input.assetPublicId?.trim()
			? await this.requireAsset(actor, input.assetPublicId)
			: null;
		if (asset && asset.facility_id !== facility.id)
			throw new AssetsMaintenanceValidationError(
				'Affected asset must belong to the request facility.'
			);
		const priority = await this.findPriority(input.priorityCode);
		const id = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const requestId = insertedId(
				await trx
					.insertInto('maintenance_requests')
					.values({
						organisation_id: actor.organisationId,
						facility_id: facility.id,
						facility_space_id: asset?.facility_space_id ?? null,
						public_id: id,
						request_number: reference('MR', id, now),
						request_type: requestType(input.requestType),
						maintenance_priority_level_id: priority.id,
						title: requiredText(input.title, 'Request title', 500),
						description: requiredText(input.description, 'Request description', 4000),
						request_status: 'new',
						reported_by_member_id: actor.memberId,
						reported_by_party_id: null,
						reporter_name: null,
						reported_at: now,
						resolved_by_member_id: null,
						resolved_at: null,
						resolution_note: null
					})
					.executeTakeFirstOrThrow()
			);
			if (asset)
				await trx
					.insertInto('maintenance_request_assets')
					.values({
						organisation_id: actor.organisationId,
						maintenance_request_id: requestId,
						asset_id: asset.id,
						relationship_role: 'affected'
					})
					.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'maintenance.request.create', 'maintenance_request', id, {
				facilityPublicId: facility.public_id,
				assetPublicId: asset?.public_id ?? null
			});
		});
		return id;
	}

	async resolveMaintenanceRequest(
		actor: TenantActorContext,
		requestPublicIdInput: string,
		resolutionNote: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.request.manage');
		const requestPublicId = publicId(requestPublicIdInput, 'Maintenance request');
		await this.db.transaction().execute(async (trx) => {
			const request = await trx
				.selectFrom('maintenance_requests')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', requestPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!request) throw new TenantAccessError('Maintenance request not found.');
			if (['resolved', 'cancelled', 'rejected', 'duplicate'].includes(request.request_status))
				throw new AssetsMaintenanceValidationError('Maintenance request is already terminal.');
			await trx
				.updateTable('maintenance_requests')
				.set({
					request_status: 'resolved',
					resolved_by_member_id: actor.memberId,
					resolved_at: this.now(),
					resolution_note: requiredText(resolutionNote, 'Resolution note', 4000)
				})
				.where('id', '=', request.id)
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				'maintenance.request.resolve',
				'maintenance_request',
				requestPublicId,
				{ fromStatus: request.request_status }
			);
		});
	}

	async createMaintenancePlan(
		actor: TenantActorContext,
		input: CreateMaintenancePlanInput
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.plan.manage');
		const facility = await this.requireFacility(actor, input.facilityPublicId);
		const asset = await this.requireAsset(actor, input.assetPublicId);
		if (asset.facility_id !== facility.id)
			throw new AssetsMaintenanceValidationError(
				'Planned asset must belong to the selected facility.'
			);
		const maintainable = await this.db
			.selectFrom('asset_types')
			.select(['is_maintainable'])
			.where('id', '=', asset.asset_type_id)
			.where('organisation_id', '=', actor.organisationId)
			.executeTakeFirst();
		if (!maintainable?.is_maintainable)
			throw new AssetsMaintenanceValidationError('Asset type is not maintainable.');
		const planType = await this.db
			.selectFrom('maintenance_plan_types')
			.select(['id'])
			.where('code', '=', requiredText(input.planTypeCode, 'Plan type', 64))
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!planType) throw new AssetsMaintenanceValidationError('Maintenance plan type is invalid.');
		const interval = positiveInteger(input.intervalValue, 'Maintenance interval');
		if (!['day', 'week', 'month', 'year'].includes(input.intervalUnit))
			throw new AssetsMaintenanceValidationError('Maintenance interval unit is invalid.');
		const id = this.publicIdFactory();
		const now = this.now();
		const startsOn = dateOnly(input.startsOn, 'Plan start') ?? dayOf(now);
		await this.db.transaction().execute(async (trx) => {
			const planId = insertedId(
				await trx
					.insertInto('maintenance_plans')
					.values({
						organisation_id: actor.organisationId,
						facility_id: facility.id,
						public_id: id,
						maintenance_plan_type_id: planType.id,
						plan_number: reference('MP', id, now),
						name: requiredText(input.name, 'Plan name', 255),
						description: optionalText(input.description, 4000),
						lifecycle_status: 'active',
						starts_on: startsOn,
						ends_on: null,
						owner_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('maintenance_plan_assets')
				.values({
					organisation_id: actor.organisationId,
					maintenance_plan_id: planId,
					asset_id: asset.id,
					assigned_on: startsOn,
					ended_on: null
				})
				.executeTakeFirstOrThrow();
			const taskId = insertedId(
				await trx
					.insertInto('maintenance_plan_tasks')
					.values({
						organisation_id: actor.organisationId,
						maintenance_plan_id: planId,
						task_number: 1,
						title: requiredText(input.taskTitle, 'Maintenance task', 500),
						instructions: optionalText(input.instructions, 4000),
						estimated_duration_minutes: null,
						requires_shutdown: 0,
						is_active: 1
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('maintenance_task_schedule_rules')
				.values({
					organisation_id: actor.organisationId,
					maintenance_plan_task_id: taskId,
					schedule_basis: 'calendar',
					interval_value: String(interval),
					interval_unit: input.intervalUnit as 'day' | 'week' | 'month' | 'year',
					asset_meter_id: null,
					starts_on: startsOn,
					tolerance_days: null,
					is_active: 1
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'maintenance.plan.create', 'maintenance_plan', id, {
				assetPublicId: asset.public_id,
				interval,
				intervalUnit: input.intervalUnit
			});
		});
		return id;
	}

	async generatePlannedWorkOrder(
		actor: TenantActorContext,
		planTaskIdInput: string,
		assetPublicIdInput: string
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.work_order.manage');
		const repository = new AssetsMaintenanceRepository(this.db);
		const task = await repository.findMaintenancePlanTask(
			actor.organisationId,
			safeId(planTaskIdInput, 'Plan task')
		);
		if (!task || task.planStatus !== 'active')
			throw new AssetsMaintenanceValidationError('Active maintenance plan task not found.');
		const asset = await this.requireAsset(actor, assetPublicIdInput);
		if (asset.facility_id !== task.facilityId)
			throw new AssetsMaintenanceValidationError('Asset is outside the plan facility.');
		const assigned = await this.db
			.selectFrom('maintenance_plan_assets')
			.select('asset_id')
			.where('organisation_id', '=', actor.organisationId)
			.where('maintenance_plan_id', '=', task.planId)
			.where('asset_id', '=', asset.id)
			.where('ended_on', 'is', null)
			.executeTakeFirst();
		if (!assigned)
			throw new AssetsMaintenanceValidationError('Asset is not assigned to this maintenance plan.');
		const existing = await this.db
			.selectFrom('work_orders as workOrder')
			.innerJoin('work_order_assets as link', (join) =>
				join
					.onRef('link.work_order_id', '=', 'workOrder.id')
					.onRef('link.organisation_id', '=', 'workOrder.organisation_id')
			)
			.select('workOrder.id')
			.where('workOrder.organisation_id', '=', actor.organisationId)
			.where('workOrder.source_maintenance_plan_task_id', '=', task.id)
			.where('link.asset_id', '=', asset.id)
			.where('workOrder.work_order_status', 'in', ['open', 'assigned', 'in_progress', 'on_hold'])
			.executeTakeFirst();
		if (existing)
			throw new AssetsMaintenanceValidationError(
				'An active work order already exists for this plan task and asset.'
			);
		return this.createWorkOrderFromSource(actor, {
			facilityId: task.facilityId,
			assetId: asset.id,
			assetPublicId: asset.public_id,
			typeCode: 'planned',
			priorityCode: 'normal',
			title: task.title,
			description: task.instructions,
			sourceRequestId: null,
			sourcePlanTaskId: task.id,
			scheduledStartAt: task.startsOn ?? this.now()
		});
	}

	async createReactiveWorkOrder(
		actor: TenantActorContext,
		requestPublicIdInput: string,
		assetPublicIdInput: string
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.work_order.manage');
		const request = await new AssetsMaintenanceRepository(this.db).findMaintenanceRequestByPublicId(
			actor.organisationId,
			publicId(requestPublicIdInput, 'Maintenance request')
		);
		if (
			!request ||
			['resolved', 'rejected', 'cancelled', 'duplicate'].includes(request.request_status)
		)
			throw new AssetsMaintenanceValidationError(
				'Maintenance request is unavailable for work generation.'
			);
		const asset = await this.requireAsset(actor, assetPublicIdInput);
		if (asset.facility_id !== request.facility_id)
			throw new AssetsMaintenanceValidationError('Asset is outside the request facility.');
		const priority = await this.db
			.selectFrom('maintenance_priority_levels')
			.select(['code'])
			.where('id', '=', request.maintenance_priority_level_id)
			.executeTakeFirstOrThrow();
		const result = await this.createWorkOrderFromSource(actor, {
			facilityId: request.facility_id,
			assetId: asset.id,
			assetPublicId: asset.public_id,
			typeCode: 'reactive',
			priorityCode: priority.code,
			title: request.title,
			description: request.description,
			sourceRequestId: request.id,
			sourcePlanTaskId: null,
			scheduledStartAt: null
		});
		await this.db
			.updateTable('maintenance_requests')
			.set({ request_status: 'in_progress' })
			.where('id', '=', request.id)
			.where('organisation_id', '=', actor.organisationId)
			.executeTakeFirst();
		return result;
	}

	async assignContractor(
		actor: TenantActorContext,
		workOrderPublicIdInput: string,
		contractorPartyPublicIdInput: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.assignment.manage');
		const workOrderPublicId = publicId(workOrderPublicIdInput, 'Work order');
		const contractor = await new ProcurementRepository(this.db).findEligibleSupplierByPublicId(
			actor.organisationId,
			publicId(contractorPartyPublicIdInput, 'Contractor')
		);
		if (!contractor)
			throw new AssetsMaintenanceValidationError(
				'Selected contractor is not an eligible CRM supplier/service provider.'
			);
		await this.db.transaction().execute(async (trx) => {
			const workOrder = await trx
				.selectFrom('work_orders')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', workOrderPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!workOrder) throw new TenantAccessError('Work order not found.');
			if (['completed', 'cancelled', 'void'].includes(workOrder.work_order_status))
				throw new AssetsMaintenanceValidationError('Work order is terminal.');
			await trx
				.insertInto('work_order_party_assignments')
				.values({
					organisation_id: actor.organisationId,
					work_order_id: workOrder.id,
					party_id: contractor.id,
					assignment_role: 'contractor',
					assigned_at: this.now(),
					unassigned_at: null,
					assigned_by_member_id: actor.memberId
				})
				.executeTakeFirstOrThrow();
			if (workOrder.work_order_status === 'open') {
				await trx
					.updateTable('work_orders')
					.set({ work_order_status: 'assigned' })
					.where('id', '=', workOrder.id)
					.executeTakeFirstOrThrow();
				await trx
					.insertInto('work_order_status_events')
					.values({
						organisation_id: actor.organisationId,
						work_order_id: workOrder.id,
						from_status: 'open',
						to_status: 'assigned',
						acted_by_member_id: actor.memberId,
						acted_at: this.now(),
						comment: `Assigned to ${contractor.displayName}.`
					})
					.executeTakeFirstOrThrow();
			}
			await this.audit(
				trx,
				actor,
				'maintenance.work_order.assign_contractor',
				'work_order',
				workOrderPublicId,
				{ contractorPublicId: contractor.publicId }
			);
		});
	}

	async completeWorkOrder(
		actor: TenantActorContext,
		workOrderPublicIdInput: string,
		completionSummary: string
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.work_order.complete');
		const workOrderPublicId = publicId(workOrderPublicIdInput, 'Work order');
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const workOrder = await trx
				.selectFrom('work_orders')
				.selectAll()
				.where('organisation_id', '=', actor.organisationId)
				.where('public_id', '=', workOrderPublicId)
				.forUpdate()
				.executeTakeFirst();
			if (!workOrder) throw new TenantAccessError('Work order not found.');
			if (['completed', 'cancelled', 'void'].includes(workOrder.work_order_status))
				throw new AssetsMaintenanceValidationError('Work order is already terminal.');
			const summary = requiredText(completionSummary, 'Completion summary', 4000);
			await trx
				.updateTable('work_order_tasks')
				.set({
					task_status: 'completed',
					completed_by_member_id: actor.memberId,
					completed_at: now,
					completion_note: summary
				})
				.where('organisation_id', '=', actor.organisationId)
				.where('work_order_id', '=', workOrder.id)
				.where('task_status', 'in', ['pending', 'in_progress'])
				.execute();
			await trx
				.updateTable('work_orders')
				.set({
					work_order_status: 'completed',
					started_at: workOrder.started_at ?? now,
					completed_at: now,
					completed_by_member_id: actor.memberId,
					completion_summary: summary
				})
				.where('id', '=', workOrder.id)
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('work_order_status_events')
				.values({
					organisation_id: actor.organisationId,
					work_order_id: workOrder.id,
					from_status: workOrder.work_order_status,
					to_status: 'completed',
					acted_by_member_id: actor.memberId,
					acted_at: now,
					comment: summary
				})
				.executeTakeFirstOrThrow();
			await this.audit(
				trx,
				actor,
				'maintenance.work_order.complete',
				'work_order',
				workOrderPublicId,
				{ fromStatus: workOrder.work_order_status }
			);
		});
	}

	async recordServiceEvent(
		actor: TenantActorContext,
		input: {
			assetPublicId: string;
			workOrderPublicId?: string | null;
			serviceTypeCode: string;
			performedAt: string;
			resultCode: string;
			conditionRating?: string | null;
			notes?: string | null;
			recommendedNextServiceOn?: string | null;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'maintenance.service.manage');
		const asset = await this.requireAsset(actor, input.assetPublicId);
		const type = await this.db
			.selectFrom('service_event_types')
			.select(['id'])
			.where('code', '=', requiredText(input.serviceTypeCode, 'Service type', 64))
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!type) throw new AssetsMaintenanceValidationError('Service type is invalid.');
		const validResults = ['completed', 'partial', 'failed', 'no_fault_found', 'cancelled', 'void'];
		if (!validResults.includes(input.resultCode))
			throw new AssetsMaintenanceValidationError('Service result is invalid.');
		const validConditions = ['', 'good', 'fair', 'poor', 'critical', 'unknown'];
		const condition = input.conditionRating?.trim() ?? '';
		if (!validConditions.includes(condition))
			throw new AssetsMaintenanceValidationError('Condition rating is invalid.');
		let workOrderId: string | null = null;
		if (input.workOrderPublicId?.trim()) {
			const workOrder = await new AssetsMaintenanceRepository(this.db).findWorkOrderByPublicId(
				actor.organisationId,
				publicId(input.workOrderPublicId, 'Work order')
			);
			if (!workOrder || workOrder.work_order_status !== 'completed')
				throw new AssetsMaintenanceValidationError('Service-linked work order must be completed.');
			const linked = await this.db
				.selectFrom('work_order_assets')
				.select('asset_id')
				.where('organisation_id', '=', actor.organisationId)
				.where('work_order_id', '=', workOrder.id)
				.where('asset_id', '=', asset.id)
				.executeTakeFirst();
			if (!linked)
				throw new AssetsMaintenanceValidationError(
					'Service asset is not linked to the work order.'
				);
			workOrderId = workOrder.id;
		}
		const id = this.publicIdFactory();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('asset_service_events')
				.values({
					organisation_id: actor.organisationId,
					asset_id: asset.id,
					work_order_id: workOrderId,
					public_id: id,
					service_event_type_id: type.id,
					performed_at: dateTime(input.performedAt, 'Performed at'),
					provider_party_id: null,
					performed_by_member_id: actor.memberId,
					result_code: input.resultCode as
						'completed' | 'partial' | 'failed' | 'no_fault_found' | 'cancelled' | 'void',
					condition_rating: condition
						? (condition as 'good' | 'fair' | 'poor' | 'critical' | 'unknown')
						: null,
					notes: optionalText(input.notes, 4000),
					recommended_next_service_on: dateOnly(
						input.recommendedNextServiceOn,
						'Recommended next service'
					)
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'maintenance.service.record', 'asset_service_event', id, {
				assetPublicId: asset.public_id,
				workOrderLinked: Boolean(workOrderId)
			});
		});
		return id;
	}

	async createComplianceRequirement(
		actor: TenantActorContext,
		input: {
			categoryCode: string;
			requirementCode: string;
			name: string;
			requirementText: string;
			intervalValue?: string | null;
			intervalUnit?: string | null;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'compliance.manage');
		const category = await this.db
			.selectFrom('compliance_requirement_categories')
			.select(['id'])
			.where('code', '=', requiredText(input.categoryCode, 'Compliance category', 64))
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!category) throw new AssetsMaintenanceValidationError('Compliance category is invalid.');
		const rawInterval = input.intervalValue?.trim() ?? '';
		const interval = rawInterval ? positiveInteger(rawInterval, 'Compliance interval') : null;
		const unit = input.intervalUnit?.trim() ?? '';
		if ((interval === null) !== !unit)
			throw new AssetsMaintenanceValidationError(
				'Compliance interval and unit must be supplied together.'
			);
		if (unit && !['day', 'week', 'month', 'year'].includes(unit))
			throw new AssetsMaintenanceValidationError('Compliance interval unit is invalid.');
		const id = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const requirementId = insertedId(
				await trx
					.insertInto('compliance_requirements')
					.values({
						organisation_id: actor.organisationId,
						public_id: id,
						compliance_requirement_category_id: category.id,
						requirement_code: requiredText(input.requirementCode, 'Requirement code', 120),
						name: requiredText(input.name, 'Requirement name', 255),
						description: null,
						lifecycle_status: 'active',
						created_by_member_id: actor.memberId
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('compliance_requirement_versions')
				.values({
					organisation_id: actor.organisationId,
					compliance_requirement_id: requirementId,
					version_number: 1,
					version_status: 'published',
					reference_code: null,
					requirement_text: requiredText(input.requirementText, 'Requirement text', 4000),
					interval_value: interval,
					interval_unit: unit ? (unit as 'day' | 'week' | 'month' | 'year') : null,
					effective_from: dayOf(now),
					effective_to: null,
					created_by_member_id: actor.memberId,
					published_by_member_id: actor.memberId,
					published_at: now
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'compliance.requirement.publish', 'compliance_requirement', id, {
				versionNumber: 1
			});
		});
		return id;
	}

	async assignComplianceToAsset(
		actor: TenantActorContext,
		assetPublicIdInput: string,
		requirementPublicIdInput: string,
		assignedFromInput?: string | null
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'compliance.manage');
		const asset = await this.requireAsset(actor, assetPublicIdInput);
		const requirement = await new AssetsMaintenanceRepository(
			this.db
		).findComplianceRequirementByPublicId(
			actor.organisationId,
			publicId(requirementPublicIdInput, 'Compliance requirement')
		);
		if (!requirement)
			throw new AssetsMaintenanceValidationError('Published compliance requirement not found.');
		const assignedFrom = dateOnly(assignedFromInput, 'Assigned from') ?? dayOf(this.now());
		const result = await this.db
			.insertInto('asset_compliance_assignments')
			.values({
				organisation_id: actor.organisationId,
				asset_id: asset.id,
				compliance_requirement_id: requirement.id,
				assigned_from: assignedFrom,
				assigned_to: null,
				responsible_member_id: actor.memberId,
				responsible_party_id: null,
				is_active: 1
			})
			.executeTakeFirstOrThrow();
		return insertedId(result);
	}

	async recordComplianceEvent(
		actor: TenantActorContext,
		input: {
			assignmentId: string;
			performedAt: string;
			outcome: string;
			findingsSummary?: string | null;
			recommendedNextDueOn?: string | null;
		}
	): Promise<string> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'compliance.manage');
		const assignment = await new AssetsMaintenanceRepository(this.db).findAssetComplianceAssignment(
			actor.organisationId,
			safeId(input.assignmentId, 'Compliance assignment')
		);
		if (!assignment)
			throw new AssetsMaintenanceValidationError('Active asset compliance assignment not found.');
		const outcomes = [
			'pass',
			'pass_with_observations',
			'fail',
			'not_applicable',
			'cancelled',
			'void'
		];
		if (!outcomes.includes(input.outcome))
			throw new AssetsMaintenanceValidationError('Compliance outcome is invalid.');
		const id = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			await trx
				.insertInto('compliance_events')
				.values({
					organisation_id: actor.organisationId,
					public_id: id,
					compliance_requirement_version_id: assignment.requirementVersionId,
					facility_compliance_assignment_id: null,
					asset_compliance_assignment_id: assignment.id,
					quality_inspection_id: null,
					compliance_event_number: reference('CE', id, now),
					performed_at: dateTime(input.performedAt, 'Performed at'),
					performed_by_member_id: actor.memberId,
					provider_party_id: null,
					outcome: input.outcome as
						'pass' | 'pass_with_observations' | 'fail' | 'not_applicable' | 'cancelled' | 'void',
					findings_summary: optionalText(input.findingsSummary, 4000),
					recommended_next_due_on: dateOnly(input.recommendedNextDueOn, 'Recommended next due')
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'compliance.event.record', 'compliance_event', id, {
				assignmentId: assignment.id,
				outcome: input.outcome
			});
		});
		return id;
	}

	async linkEvidence(actor: TenantActorContext, input: LinkEvidenceInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.requirePermission(actor, 'assets.evidence.manage');
		await this.requirePermission(actor, 'information.view');
		const projects = await new ProjectRepository(this.db).listForMember(
			actor.organisationId,
			actor.memberId
		);
		const projectIds = projects.map((project) => project.id);
		const repository = new AssetsMaintenanceRepository(this.db);
		const version = await repository.findEvidenceVersionByPublicId(
			actor.organisationId,
			projectIds,
			publicId(input.informationVersionPublicId, 'Information version')
		);
		if (!version)
			throw new AssetsMaintenanceValidationError(
				'Evidence must be an issued or superseded information revision visible to this member.'
			);
		const subjectId = publicId(input.subjectPublicId, 'Evidence subject');
		await this.db.transaction().execute(async (trx) => {
			if (input.subjectType === 'asset') {
				const subject = await trx
					.selectFrom('assets')
					.select(['id', 'facility_id as facilityId'])
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', subjectId)
					.executeTakeFirst();
				if (!subject) throw new TenantAccessError('Asset not found.');
				await this.requireFacilityProjectEvidenceLink(
					trx,
					actor,
					subject.facilityId,
					version.projectId
				);
				const roles = [
					'om_manual',
					'datasheet',
					'drawing',
					'commissioning',
					'certificate',
					'photo',
					'risk_information',
					'service_record',
					'other'
				];
				if (!roles.includes(input.linkRole))
					throw new AssetsMaintenanceValidationError('Asset evidence role is invalid.');
				await trx
					.insertInto('asset_information_links')
					.ignore()
					.values({
						asset_id: subject.id,
						organisation_id: actor.organisationId,
						information_container_version_id: version.id,
						version_owner_organisation_id: actor.organisationId,
						link_role: input.linkRole as
							| 'om_manual'
							| 'datasheet'
							| 'drawing'
							| 'commissioning'
							| 'certificate'
							| 'photo'
							| 'risk_information'
							| 'service_record'
							| 'other',
						linked_by_member_id: actor.memberId
					})
					.execute();
			} else if (input.subjectType === 'workOrder') {
				const subject = await trx
					.selectFrom('work_orders')
					.select(['id', 'facility_id as facilityId'])
					.where('organisation_id', '=', actor.organisationId)
					.where('public_id', '=', subjectId)
					.executeTakeFirst();
				if (!subject) throw new TenantAccessError('Work order not found.');
				await this.requireFacilityProjectEvidenceLink(
					trx,
					actor,
					subject.facilityId,
					version.projectId
				);
				const roles = [
					'instruction',
					'evidence',
					'photo',
					'certificate',
					'report',
					'drawing',
					'other'
				];
				if (!roles.includes(input.linkRole))
					throw new AssetsMaintenanceValidationError('Work-order evidence role is invalid.');
				await trx
					.insertInto('work_order_information_links')
					.ignore()
					.values({
						work_order_id: subject.id,
						organisation_id: actor.organisationId,
						information_container_version_id: version.id,
						version_owner_organisation_id: actor.organisationId,
						link_role: input.linkRole as
							'instruction' | 'evidence' | 'photo' | 'certificate' | 'report' | 'drawing' | 'other'
					})
					.execute();
			} else if (input.subjectType === 'service') {
				const subject = await trx
					.selectFrom('asset_service_events as event')
					.innerJoin('assets as asset', (join) =>
						join
							.onRef('asset.id', '=', 'event.asset_id')
							.onRef('asset.organisation_id', '=', 'event.organisation_id')
					)
					.select(['event.id as id', 'asset.facility_id as facilityId'])
					.where('event.organisation_id', '=', actor.organisationId)
					.where('event.public_id', '=', subjectId)
					.executeTakeFirst();
				if (!subject) throw new TenantAccessError('Service event not found.');
				await this.requireFacilityProjectEvidenceLink(
					trx,
					actor,
					subject.facilityId,
					version.projectId
				);
				const roles = [
					'service_report',
					'certificate',
					'photo',
					'test_result',
					'invoice_support',
					'other'
				];
				if (!roles.includes(input.linkRole))
					throw new AssetsMaintenanceValidationError('Service evidence role is invalid.');
				await trx
					.insertInto('service_event_information_links')
					.ignore()
					.values({
						asset_service_event_id: subject.id,
						organisation_id: actor.organisationId,
						information_container_version_id: version.id,
						version_owner_organisation_id: actor.organisationId,
						link_role: input.linkRole as
							| 'service_report'
							| 'certificate'
							| 'photo'
							| 'test_result'
							| 'invoice_support'
							| 'other'
					})
					.execute();
			} else {
				const subject = await trx
					.selectFrom('compliance_events as event')
					.innerJoin('asset_compliance_assignments as assignment', (join) =>
						join
							.onRef('assignment.id', '=', 'event.asset_compliance_assignment_id')
							.onRef('assignment.organisation_id', '=', 'event.organisation_id')
					)
					.innerJoin('assets as asset', (join) =>
						join
							.onRef('asset.id', '=', 'assignment.asset_id')
							.onRef('asset.organisation_id', '=', 'event.organisation_id')
					)
					.select(['event.id as id', 'asset.facility_id as facilityId'])
					.where('event.organisation_id', '=', actor.organisationId)
					.where('event.public_id', '=', subjectId)
					.executeTakeFirst();
				if (!subject) throw new TenantAccessError('Compliance event not found.');
				await this.requireFacilityProjectEvidenceLink(
					trx,
					actor,
					subject.facilityId,
					version.projectId
				);
				const roles = ['certificate', 'report', 'test_result', 'photo', 'evidence', 'other'];
				if (!roles.includes(input.linkRole))
					throw new AssetsMaintenanceValidationError('Compliance evidence role is invalid.');
				await trx
					.insertInto('compliance_event_information_links')
					.ignore()
					.values({
						compliance_event_id: subject.id,
						organisation_id: actor.organisationId,
						information_container_version_id: version.id,
						version_owner_organisation_id: actor.organisationId,
						link_role: input.linkRole as
							'certificate' | 'report' | 'test_result' | 'photo' | 'evidence' | 'other'
					})
					.execute();
			}
			await this.audit(trx, actor, 'assets.evidence.link', input.subjectType, subjectId, {
				informationVersionPublicId: version.publicId,
				linkRole: input.linkRole
			});
		});
	}

	private async createWorkOrderFromSource(
		actor: TenantActorContext,
		input: {
			facilityId: string;
			assetId: string;
			assetPublicId: string;
			typeCode: string;
			priorityCode: string;
			title: string;
			description: string | null;
			sourceRequestId: string | null;
			sourcePlanTaskId: string | null;
			scheduledStartAt: Date | null;
		}
	): Promise<string> {
		const [type, priority] = await Promise.all([
			this.db
				.selectFrom('work_order_types')
				.select(['id'])
				.where('code', '=', input.typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst(),
			this.db
				.selectFrom('maintenance_priority_levels')
				.select(['id'])
				.where('code', '=', input.priorityCode)
				.where('is_active', '=', 1)
				.executeTakeFirst()
		]);
		if (!type || !priority)
			throw new AssetsMaintenanceValidationError('Required work-order reference data is missing.');
		const id = this.publicIdFactory();
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const workOrderId = insertedId(
				await trx
					.insertInto('work_orders')
					.values({
						organisation_id: actor.organisationId,
						facility_id: input.facilityId,
						facility_space_id: null,
						public_id: id,
						work_order_number: reference('WO', id, now),
						work_order_type_id: type.id,
						maintenance_priority_level_id: priority.id,
						source_maintenance_request_id: input.sourceRequestId,
						source_maintenance_plan_task_id: input.sourcePlanTaskId,
						title: requiredText(input.title, 'Work-order title', 500),
						description: optionalText(input.description, 4000),
						work_order_status: 'open',
						requested_on: dayOf(now),
						scheduled_start_at: input.scheduledStartAt,
						scheduled_end_at: null,
						started_at: null,
						completed_at: null,
						owner_member_id: actor.memberId,
						completed_by_member_id: null,
						completion_summary: null
					})
					.executeTakeFirstOrThrow()
			);
			await trx
				.insertInto('work_order_assets')
				.values({
					organisation_id: actor.organisationId,
					work_order_id: workOrderId,
					asset_id: input.assetId,
					relationship_role: input.typeCode === 'planned' ? 'maintained' : 'maintained'
				})
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('work_order_tasks')
				.values({
					organisation_id: actor.organisationId,
					work_order_id: workOrderId,
					source_maintenance_plan_task_id: input.sourcePlanTaskId,
					task_number: 1,
					description: input.description ?? input.title,
					task_status: 'pending',
					completed_by_member_id: null,
					completed_at: null,
					completion_note: null
				})
				.executeTakeFirstOrThrow();
			await trx
				.insertInto('work_order_status_events')
				.values({
					organisation_id: actor.organisationId,
					work_order_id: workOrderId,
					from_status: null,
					to_status: 'open',
					acted_by_member_id: actor.memberId,
					acted_at: now,
					comment: input.sourcePlanTaskId
						? 'Generated from planned maintenance.'
						: 'Generated from reactive request.'
				})
				.executeTakeFirstOrThrow();
			await this.audit(trx, actor, 'maintenance.work_order.create', 'work_order', id, {
				assetPublicId: input.assetPublicId,
				sourceRequestId: input.sourceRequestId,
				sourcePlanTaskId: input.sourcePlanTaskId
			});
		});
		return id;
	}

	private async requireFacility(actor: TenantActorContext, value: string) {
		const facility = await new AssetsMaintenanceRepository(this.db).findFacilityByPublicId(
			actor.organisationId,
			publicId(value, 'Facility')
		);
		if (!facility || facility.operational_status === 'archived')
			throw new TenantAccessError('Facility not found.');
		return facility;
	}
	private async requireBuilding(actor: TenantActorContext, value: string) {
		const row = await new AssetsMaintenanceRepository(this.db).findBuildingByPublicId(
			actor.organisationId,
			publicId(value, 'Building')
		);
		if (!row) throw new TenantAccessError('Building not found.');
		return row;
	}
	private async requireLevel(actor: TenantActorContext, value: string) {
		const row = await new AssetsMaintenanceRepository(this.db).findLevelByPublicId(
			actor.organisationId,
			publicId(value, 'Level')
		);
		if (!row) throw new TenantAccessError('Level not found.');
		return row;
	}
	private async requireSpace(actor: TenantActorContext, value: string) {
		const row = await new AssetsMaintenanceRepository(this.db).findSpaceByPublicId(
			actor.organisationId,
			publicId(value, 'Space')
		);
		if (!row) throw new TenantAccessError('Space not found.');
		return row;
	}
	private async requireAsset(actor: TenantActorContext, value: string) {
		const row = await new AssetsMaintenanceRepository(this.db).findAssetByPublicId(
			actor.organisationId,
			publicId(value, 'Asset')
		);
		if (!row || row.lifecycle_status === 'archived')
			throw new TenantAccessError('Asset not found.');
		return row;
	}
	private async findPriority(codeInput: string) {
		const row = await this.db
			.selectFrom('maintenance_priority_levels')
			.select(['id', 'code'])
			.where('code', '=', requiredText(codeInput, 'Priority', 32))
			.where('is_active', '=', 1)
			.executeTakeFirst();
		if (!row) throw new AssetsMaintenanceValidationError('Maintenance priority is invalid.');
		return row;
	}

	private async requireFacilityProjectEvidenceLink(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		facilityId: string,
		projectId: string
	): Promise<void> {
		const link = await db
			.selectFrom('facility_project_links')
			.select('facility_id')
			.where('organisation_id', '=', actor.organisationId)
			.where('facility_id', '=', facilityId)
			.where('project_id', '=', projectId)
			.where('ended_on', 'is', null)
			.executeTakeFirst();
		if (!link)
			throw new AssetsMaintenanceValidationError(
				'Evidence project is not linked to the subject facility.'
			);
	}

	private async audit(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		actionKey: string,
		subjectType: string,
		subjectPublicId: string,
		changeSummary: Record<string, unknown>,
		projectId: string | null = null
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
