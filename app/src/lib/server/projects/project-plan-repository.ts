import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProjectPlanActivityKind = 'activity' | 'milestone';
export type ProjectPlanActivityStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled';
export type ProjectPlanDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export type ProjectWbsNodeRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	parentWbsNodeId: string | null;
	wbsCode: string;
	name: string;
	description: string | null;
	sortOrder: number;
	lifecycleStatus: 'active' | 'archived';
};

export type ProjectPlanActivityRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	wbsNodeId: string;
	wbsCode: string;
	publicId: string;
	activityCode: string;
	name: string;
	description: string | null;
	activityKind: ProjectPlanActivityKind;
	status: ProjectPlanActivityStatus;
	plannedStartOn: Date;
	plannedFinishOn: Date;
	plannedDurationDays: string;
};

export type ProjectPlanDependencyRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	predecessorActivityId: string;
	predecessorActivityPublicId: string;
	predecessorActivityCode: string;
	predecessorActivityName: string;
	successorActivityId: string;
	successorActivityPublicId: string;
	successorActivityCode: string;
	successorActivityName: string;
	dependencyType: ProjectPlanDependencyType;
	lagDays: string;
};

export type ProjectPlanBaselineRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	baselineNumber: number;
	name: string;
	description: string | null;
	capturedAt: Date;
	activityCount: number;
	dependencyCount: number;
};

export type ProjectPlanBaselineActivityRecord = {
	activityPublicId: string;
	wbsCode: string;
	activityCode: string;
	name: string;
	activityKind: ProjectPlanActivityKind;
	status: ProjectPlanActivityStatus;
	plannedStartOn: Date;
	plannedFinishOn: Date;
	plannedDurationDays: string;
};

export type ProjectPlanBaselineDependencyRecord = {
	predecessorActivityCode: string;
	successorActivityCode: string;
	dependencyType: ProjectPlanDependencyType;
	lagDays: string;
};

export type ProjectPlanBaselineSnapshot = ProjectPlanBaselineRecord & {
	activities: ProjectPlanBaselineActivityRecord[];
	dependencies: ProjectPlanBaselineDependencyRecord[];
};

function mapWbs(row: {
	id: string;
	organisation_id: string;
	project_id: string;
	public_id: string;
	parent_wbs_node_id: string | null;
	wbs_code: string;
	name: string;
	description: string | null;
	sort_order: number;
	lifecycle_status: string;
}): ProjectWbsNodeRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		projectId: row.project_id,
		publicId: row.public_id,
		parentWbsNodeId: row.parent_wbs_node_id,
		wbsCode: row.wbs_code,
		name: row.name,
		description: row.description,
		sortOrder: row.sort_order,
		lifecycleStatus: row.lifecycle_status as ProjectWbsNodeRecord['lifecycleStatus']
	};
}

function mapActivity(row: {
	id: string;
	organisation_id: string;
	project_id: string;
	wbs_node_id: string;
	wbs_code: string;
	public_id: string;
	activity_code: string;
	name: string;
	description: string | null;
	activity_kind: string;
	status: string;
	planned_start_on: Date;
	planned_finish_on: Date;
	planned_duration_days: string;
}): ProjectPlanActivityRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		projectId: row.project_id,
		wbsNodeId: row.wbs_node_id,
		wbsCode: row.wbs_code,
		publicId: row.public_id,
		activityCode: row.activity_code,
		name: row.name,
		description: row.description,
		activityKind: row.activity_kind as ProjectPlanActivityKind,
		status: row.status as ProjectPlanActivityStatus,
		plannedStartOn: row.planned_start_on,
		plannedFinishOn: row.planned_finish_on,
		plannedDurationDays: row.planned_duration_days
	};
}

export class ProjectPlanRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listWbs(projectId: string): Promise<ProjectWbsNodeRecord[]> {
		const rows = await this.db
			.selectFrom('project_wbs_nodes')
			.select([
				'id',
				'organisation_id',
				'project_id',
				'public_id',
				'parent_wbs_node_id',
				'wbs_code',
				'name',
				'description',
				'sort_order',
				'lifecycle_status'
			])
			.where('project_id', '=', projectId)
			.where('lifecycle_status', '=', 'active')
			.orderBy('sort_order', 'asc')
			.orderBy('wbs_code', 'asc')
			.execute();
		return rows.map(mapWbs);
	}

	async findWbsByPublicId(
		projectId: string,
		publicId: string
	): Promise<ProjectWbsNodeRecord | null> {
		const row = await this.db
			.selectFrom('project_wbs_nodes')
			.select([
				'id',
				'organisation_id',
				'project_id',
				'public_id',
				'parent_wbs_node_id',
				'wbs_code',
				'name',
				'description',
				'sort_order',
				'lifecycle_status'
			])
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.where('lifecycle_status', '=', 'active')
			.executeTakeFirst();
		return row ? mapWbs(row) : null;
	}

	async findWbsByCode(projectId: string, wbsCode: string): Promise<ProjectWbsNodeRecord | null> {
		const row = await this.db
			.selectFrom('project_wbs_nodes')
			.select([
				'id',
				'organisation_id',
				'project_id',
				'public_id',
				'parent_wbs_node_id',
				'wbs_code',
				'name',
				'description',
				'sort_order',
				'lifecycle_status'
			])
			.where('project_id', '=', projectId)
			.where('wbs_code', '=', wbsCode)
			.executeTakeFirst();
		return row ? mapWbs(row) : null;
	}

	async insertWbs(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		parentWbsNodeId: string | null;
		wbsCode: string;
		name: string;
		description: string | null;
		sortOrder: number;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_wbs_nodes')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				parent_wbs_node_id: input.parentWbsNodeId,
				wbs_code: input.wbsCode,
				name: input.name,
				description: input.description,
				sort_order: input.sortOrder,
				lifecycle_status: 'active',
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the WBS node ID.');
		return result.insertId.toString();
	}

	async listActivities(projectId: string): Promise<ProjectPlanActivityRecord[]> {
		const rows = await this.db
			.selectFrom('project_plan_activities as activity')
			.innerJoin('project_wbs_nodes as wbs', 'wbs.id', 'activity.wbs_node_id')
			.select([
				'activity.id as id',
				'activity.organisation_id as organisation_id',
				'activity.project_id as project_id',
				'activity.wbs_node_id as wbs_node_id',
				'wbs.wbs_code as wbs_code',
				'activity.public_id as public_id',
				'activity.activity_code as activity_code',
				'activity.name as name',
				'activity.description as description',
				'activity.activity_kind as activity_kind',
				'activity.status as status',
				'activity.planned_start_on as planned_start_on',
				'activity.planned_finish_on as planned_finish_on',
				'activity.planned_duration_days as planned_duration_days'
			])
			.where('activity.project_id', '=', projectId)
			.orderBy('activity.planned_start_on', 'asc')
			.orderBy('activity.activity_code', 'asc')
			.execute();
		return rows.map(mapActivity);
	}

	async findActivityByPublicId(
		projectId: string,
		publicId: string
	): Promise<ProjectPlanActivityRecord | null> {
		const row = await this.db
			.selectFrom('project_plan_activities as activity')
			.innerJoin('project_wbs_nodes as wbs', 'wbs.id', 'activity.wbs_node_id')
			.select([
				'activity.id as id',
				'activity.organisation_id as organisation_id',
				'activity.project_id as project_id',
				'activity.wbs_node_id as wbs_node_id',
				'wbs.wbs_code as wbs_code',
				'activity.public_id as public_id',
				'activity.activity_code as activity_code',
				'activity.name as name',
				'activity.description as description',
				'activity.activity_kind as activity_kind',
				'activity.status as status',
				'activity.planned_start_on as planned_start_on',
				'activity.planned_finish_on as planned_finish_on',
				'activity.planned_duration_days as planned_duration_days'
			])
			.where('activity.project_id', '=', projectId)
			.where('activity.public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapActivity(row) : null;
	}

	async findActivityByCode(
		projectId: string,
		activityCode: string
	): Promise<ProjectPlanActivityRecord | null> {
		const row = await this.db
			.selectFrom('project_plan_activities as activity')
			.innerJoin('project_wbs_nodes as wbs', 'wbs.id', 'activity.wbs_node_id')
			.select([
				'activity.id as id',
				'activity.organisation_id as organisation_id',
				'activity.project_id as project_id',
				'activity.wbs_node_id as wbs_node_id',
				'wbs.wbs_code as wbs_code',
				'activity.public_id as public_id',
				'activity.activity_code as activity_code',
				'activity.name as name',
				'activity.description as description',
				'activity.activity_kind as activity_kind',
				'activity.status as status',
				'activity.planned_start_on as planned_start_on',
				'activity.planned_finish_on as planned_finish_on',
				'activity.planned_duration_days as planned_duration_days'
			])
			.where('activity.project_id', '=', projectId)
			.where('activity.activity_code', '=', activityCode)
			.executeTakeFirst();
		return row ? mapActivity(row) : null;
	}

	async insertActivity(input: {
		organisationId: string;
		projectId: string;
		wbsNodeId: string;
		publicId: string;
		activityCode: string;
		name: string;
		description: string | null;
		activityKind: ProjectPlanActivityKind;
		plannedStartOn: Date;
		plannedFinishOn: Date;
		plannedDurationDays: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_plan_activities')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				wbs_node_id: input.wbsNodeId,
				public_id: input.publicId,
				activity_code: input.activityCode,
				name: input.name,
				description: input.description,
				activity_kind: input.activityKind,
				status: 'planned',
				planned_start_on: input.plannedStartOn,
				planned_finish_on: input.plannedFinishOn,
				planned_duration_days: input.plannedDurationDays,
				created_by_member_id: input.createdByMemberId
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the activity ID.');
		return result.insertId.toString();
	}

	async listActiveDependencies(projectId: string): Promise<ProjectPlanDependencyRecord[]> {
		const rows = await this.db
			.selectFrom('project_plan_dependencies as dependency')
			.innerJoin(
				'project_plan_activities as predecessor',
				'predecessor.id',
				'dependency.predecessor_activity_id'
			)
			.innerJoin(
				'project_plan_activities as successor',
				'successor.id',
				'dependency.successor_activity_id'
			)
			.select([
				'dependency.id as id',
				'dependency.organisation_id as organisation_id',
				'dependency.project_id as project_id',
				'dependency.public_id as public_id',
				'dependency.predecessor_activity_id as predecessor_activity_id',
				'predecessor.public_id as predecessor_activity_public_id',
				'predecessor.activity_code as predecessor_activity_code',
				'predecessor.name as predecessor_activity_name',
				'dependency.successor_activity_id as successor_activity_id',
				'successor.public_id as successor_activity_public_id',
				'successor.activity_code as successor_activity_code',
				'successor.name as successor_activity_name',
				'dependency.dependency_type as dependency_type',
				'dependency.lag_days as lag_days'
			])
			.where('dependency.project_id', '=', projectId)
			.where('dependency.is_active', '=', 1)
			.orderBy('predecessor.activity_code', 'asc')
			.orderBy('successor.activity_code', 'asc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			organisationId: row.organisation_id,
			projectId: row.project_id,
			publicId: row.public_id,
			predecessorActivityId: row.predecessor_activity_id,
			predecessorActivityPublicId: row.predecessor_activity_public_id,
			predecessorActivityCode: row.predecessor_activity_code,
			predecessorActivityName: row.predecessor_activity_name,
			successorActivityId: row.successor_activity_id,
			successorActivityPublicId: row.successor_activity_public_id,
			successorActivityCode: row.successor_activity_code,
			successorActivityName: row.successor_activity_name,
			dependencyType: row.dependency_type as ProjectPlanDependencyType,
			lagDays: row.lag_days
		}));
	}

	async findActiveDependencyBetween(
		projectId: string,
		predecessorActivityId: string,
		successorActivityId: string
	): Promise<{ id: string } | null> {
		return (
			(await this.db
				.selectFrom('project_plan_dependencies')
				.select('id')
				.where('project_id', '=', projectId)
				.where('predecessor_activity_id', '=', predecessorActivityId)
				.where('successor_activity_id', '=', successorActivityId)
				.where('is_active', '=', 1)
				.executeTakeFirst()) ?? null
		);
	}

	async insertDependency(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		predecessorActivityId: string;
		successorActivityId: string;
		dependencyType: ProjectPlanDependencyType;
		lagDays: string;
		createdByMemberId: string;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_plan_dependencies')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				predecessor_activity_id: input.predecessorActivityId,
				successor_activity_id: input.successorActivityId,
				dependency_type: input.dependencyType,
				lag_days: input.lagDays,
				is_active: 1,
				created_by_member_id: input.createdByMemberId,
				removed_by_member_id: null,
				removed_at: null
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the dependency ID.');
		return result.insertId.toString();
	}

	async removeDependency(input: {
		projectId: string;
		publicId: string;
		removedByMemberId: string;
		removedAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_plan_dependencies')
			.set({
				is_active: 0,
				removed_by_member_id: input.removedByMemberId,
				removed_at: input.removedAt
			})
			.where('project_id', '=', input.projectId)
			.where('public_id', '=', input.publicId)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async nextBaselineNumber(projectId: string): Promise<number> {
		const row = await this.db
			.selectFrom('project_plan_baselines')
			.select(({ fn }) => fn.max<number>('baseline_number').as('maxBaselineNumber'))
			.where('project_id', '=', projectId)
			.executeTakeFirst();
		return (row?.maxBaselineNumber ?? 0) + 1;
	}

	async insertBaseline(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		baselineNumber: number;
		name: string;
		description: string | null;
		capturedByMemberId: string;
		capturedAt: Date;
	}): Promise<string> {
		const result = await this.db
			.insertInto('project_plan_baselines')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				baseline_number: input.baselineNumber,
				name: input.name,
				description: input.description,
				captured_by_member_id: input.capturedByMemberId,
				captured_at: input.capturedAt
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('MySQL did not return the baseline ID.');
		return result.insertId.toString();
	}

	async insertBaselineActivities(input: {
		organisationId: string;
		projectId: string;
		baselineId: string;
		activities: ProjectPlanActivityRecord[];
	}): Promise<void> {
		if (input.activities.length === 0) return;
		await this.db
			.insertInto('project_plan_baseline_activities')
			.values(
				input.activities.map((activity) => ({
					organisation_id: input.organisationId,
					project_id: input.projectId,
					baseline_id: input.baselineId,
					source_activity_id: activity.id,
					activity_public_id: activity.publicId,
					wbs_code: activity.wbsCode,
					activity_code: activity.activityCode,
					name: activity.name,
					activity_kind: activity.activityKind,
					status: activity.status,
					planned_start_on: activity.plannedStartOn,
					planned_finish_on: activity.plannedFinishOn,
					planned_duration_days: activity.plannedDurationDays
				}))
			)
			.execute();
	}

	async insertBaselineDependencies(input: {
		organisationId: string;
		projectId: string;
		baselineId: string;
		dependencies: ProjectPlanDependencyRecord[];
	}): Promise<void> {
		if (input.dependencies.length === 0) return;
		await this.db
			.insertInto('project_plan_baseline_dependencies')
			.values(
				input.dependencies.map((dependency) => ({
					organisation_id: input.organisationId,
					project_id: input.projectId,
					baseline_id: input.baselineId,
					source_dependency_id: dependency.id,
					predecessor_activity_id: dependency.predecessorActivityId,
					successor_activity_id: dependency.successorActivityId,
					predecessor_activity_code: dependency.predecessorActivityCode,
					successor_activity_code: dependency.successorActivityCode,
					dependency_type: dependency.dependencyType,
					lag_days: dependency.lagDays
				}))
			)
			.execute();
	}

	async listBaselines(projectId: string): Promise<ProjectPlanBaselineRecord[]> {
		const rows = await this.db
			.selectFrom('project_plan_baselines as baseline')
			.select([
				'baseline.id as id',
				'baseline.organisation_id as organisation_id',
				'baseline.project_id as project_id',
				'baseline.public_id as public_id',
				'baseline.baseline_number as baseline_number',
				'baseline.name as name',
				'baseline.description as description',
				'baseline.captured_at as captured_at'
			])
			.select((eb) =>
				eb
					.selectFrom('project_plan_baseline_activities as item')
					.select(({ fn }) => fn.countAll<number>().as('count'))
					.whereRef('item.baseline_id', '=', 'baseline.id')
					.as('activity_count')
			)
			.select((eb) =>
				eb
					.selectFrom('project_plan_baseline_dependencies as item')
					.select(({ fn }) => fn.countAll<number>().as('count'))
					.whereRef('item.baseline_id', '=', 'baseline.id')
					.as('dependency_count')
			)
			.where('baseline.project_id', '=', projectId)
			.orderBy('baseline.baseline_number', 'desc')
			.execute();
		return rows.map((row) => ({
			id: row.id,
			organisationId: row.organisation_id,
			projectId: row.project_id,
			publicId: row.public_id,
			baselineNumber: row.baseline_number,
			name: row.name,
			description: row.description,
			capturedAt: row.captured_at,
			activityCount: Number(row.activity_count ?? 0),
			dependencyCount: Number(row.dependency_count ?? 0)
		}));
	}

	async getBaselineSnapshot(
		projectId: string,
		baselinePublicId: string
	): Promise<ProjectPlanBaselineSnapshot | null> {
		const baseline = (await this.listBaselines(projectId)).find(
			(candidate) => candidate.publicId === baselinePublicId
		);
		if (!baseline) return null;
		const [activities, dependencies] = await Promise.all([
			this.db
				.selectFrom('project_plan_baseline_activities')
				.select([
					'activity_public_id',
					'wbs_code',
					'activity_code',
					'name',
					'activity_kind',
					'status',
					'planned_start_on',
					'planned_finish_on',
					'planned_duration_days'
				])
				.where('baseline_id', '=', baseline.id)
				.orderBy('activity_code', 'asc')
				.execute(),
			this.db
				.selectFrom('project_plan_baseline_dependencies')
				.select([
					'predecessor_activity_code',
					'successor_activity_code',
					'dependency_type',
					'lag_days'
				])
				.where('baseline_id', '=', baseline.id)
				.orderBy('predecessor_activity_code', 'asc')
				.orderBy('successor_activity_code', 'asc')
				.execute()
		]);
		return {
			...baseline,
			activities: activities.map((row) => ({
				activityPublicId: row.activity_public_id,
				wbsCode: row.wbs_code,
				activityCode: row.activity_code,
				name: row.name,
				activityKind: row.activity_kind as ProjectPlanActivityKind,
				status: row.status as ProjectPlanActivityStatus,
				plannedStartOn: row.planned_start_on,
				plannedFinishOn: row.planned_finish_on,
				plannedDurationDays: row.planned_duration_days
			})),
			dependencies: dependencies.map((row) => ({
				predecessorActivityCode: row.predecessor_activity_code,
				successorActivityCode: row.successor_activity_code,
				dependencyType: row.dependency_type as ProjectPlanDependencyType,
				lagDays: row.lag_days
			}))
		};
	}
}
