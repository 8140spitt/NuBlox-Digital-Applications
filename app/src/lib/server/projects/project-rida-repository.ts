import type { DatabaseExecutor } from '$lib/server/db/executor';

export type ProjectRidaItemType = 'risk' | 'issue' | 'decision';
export type ProjectRidaPriority = 'low' | 'normal' | 'high' | 'critical';
export type RiskDirection = 'threat' | 'opportunity';
export type RiskResponseStrategy =
	'avoid' | 'reduce' | 'transfer' | 'accept' | 'exploit' | 'enhance' | 'share';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ProjectRidaLifecycleStatus =
	| 'open'
	| 'monitoring'
	| 'realised'
	| 'closed'
	| 'investigating'
	| 'resolved'
	| 'proposed'
	| 'pending'
	| 'decided'
	| 'superseded';

export type ProjectRidaItemRecord = {
	id: string;
	organisationId: string;
	projectId: string;
	publicId: string;
	itemNumber: number;
	itemType: ProjectRidaItemType;
	title: string;
	description: string | null;
	priority: ProjectRidaPriority;
	status: ProjectRidaLifecycleStatus;
	ownerMemberId: string | null;
	dueOn: Date | null;
	riskDirection: RiskDirection | null;
	probabilityScore: number | null;
	impactScore: number | null;
	responseStrategy: RiskResponseStrategy | null;
	responsePlan: string | null;
	residualProbabilityScore: number | null;
	residualImpactScore: number | null;
	severity: IssueSeverity | null;
	impactSummary: string | null;
	resolutionPlan: string | null;
	decisionRequiredOn: Date | null;
	decisionOutcome: string | null;
	decisionRationale: string | null;
	decidedByMemberId: string | null;
	decidedAt: Date | null;
	raisedByMemberId: string;
	raisedAt: Date;
	updatedByMemberId: string;
	updatedAt: Date;
	closedByMemberId: string | null;
	closedAt: Date | null;
};

export type ProjectRidaActionRecord = {
	publicId: string;
	sourceItemPublicId: string;
	title: string;
	description: string | null;
	priority: string;
	status: string;
	dueAt: Date | null;
	createdAt: Date;
};

function mapItem(row: {
	id: string;
	organisation_id: string;
	project_id: string;
	public_id: string;
	item_number: number;
	item_type: string;
	title: string;
	description: string | null;
	priority: string;
	lifecycle_status: string;
	owner_member_id: string | null;
	due_on: Date | null;
	risk_direction: string | null;
	probability_score: number | null;
	impact_score: number | null;
	response_strategy: string | null;
	response_plan: string | null;
	residual_probability_score: number | null;
	residual_impact_score: number | null;
	severity: string | null;
	impact_summary: string | null;
	resolution_plan: string | null;
	decision_required_on: Date | null;
	decision_outcome: string | null;
	decision_rationale: string | null;
	decided_by_member_id: string | null;
	decided_at: Date | null;
	raised_by_member_id: string;
	raised_at: Date;
	updated_by_member_id: string;
	updated_at: Date;
	closed_by_member_id: string | null;
	closed_at: Date | null;
}): ProjectRidaItemRecord {
	return {
		id: row.id,
		organisationId: row.organisation_id,
		projectId: row.project_id,
		publicId: row.public_id,
		itemNumber: row.item_number,
		itemType: row.item_type as ProjectRidaItemType,
		title: row.title,
		description: row.description,
		priority: row.priority as ProjectRidaPriority,
		status: row.lifecycle_status as ProjectRidaLifecycleStatus,
		ownerMemberId: row.owner_member_id,
		dueOn: row.due_on,
		riskDirection: row.risk_direction as RiskDirection | null,
		probabilityScore: row.probability_score,
		impactScore: row.impact_score,
		responseStrategy: row.response_strategy as RiskResponseStrategy | null,
		responsePlan: row.response_plan,
		residualProbabilityScore: row.residual_probability_score,
		residualImpactScore: row.residual_impact_score,
		severity: row.severity as IssueSeverity | null,
		impactSummary: row.impact_summary,
		resolutionPlan: row.resolution_plan,
		decisionRequiredOn: row.decision_required_on,
		decisionOutcome: row.decision_outcome,
		decisionRationale: row.decision_rationale,
		decidedByMemberId: row.decided_by_member_id,
		decidedAt: row.decided_at,
		raisedByMemberId: row.raised_by_member_id,
		raisedAt: row.raised_at,
		updatedByMemberId: row.updated_by_member_id,
		updatedAt: row.updated_at,
		closedByMemberId: row.closed_by_member_id,
		closedAt: row.closed_at
	};
}

export class ProjectRidaRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listItems(projectId: string): Promise<ProjectRidaItemRecord[]> {
		const rows = await this.db
			.selectFrom('project_control_register_items')
			.selectAll()
			.where('project_id', '=', projectId)
			.orderBy('item_type', 'asc')
			.orderBy('item_number', 'desc')
			.execute();
		return rows.map(mapItem);
	}

	async findItemByPublicId(
		projectId: string,
		publicId: string
	): Promise<ProjectRidaItemRecord | null> {
		const row = await this.db
			.selectFrom('project_control_register_items')
			.selectAll()
			.where('project_id', '=', projectId)
			.where('public_id', '=', publicId)
			.executeTakeFirst();
		return row ? mapItem(row) : null;
	}

	async nextItemNumber(projectId: string, itemType: ProjectRidaItemType): Promise<number> {
		const row = await this.db
			.selectFrom('project_control_register_items')
			.select(({ fn }) => fn.max<number>('item_number').as('maxItemNumber'))
			.where('project_id', '=', projectId)
			.where('item_type', '=', itemType)
			.executeTakeFirst();
		return (row?.maxItemNumber ?? 0) + 1;
	}

	async insertItem(input: {
		organisationId: string;
		projectId: string;
		publicId: string;
		itemNumber: number;
		itemType: ProjectRidaItemType;
		title: string;
		description: string | null;
		priority: ProjectRidaPriority;
		status: ProjectRidaLifecycleStatus;
		ownerMemberId: string | null;
		dueOn: Date | null;
		riskDirection: RiskDirection | null;
		probabilityScore: number | null;
		impactScore: number | null;
		responseStrategy: RiskResponseStrategy | null;
		responsePlan: string | null;
		residualProbabilityScore: number | null;
		residualImpactScore: number | null;
		severity: IssueSeverity | null;
		impactSummary: string | null;
		resolutionPlan: string | null;
		decisionRequiredOn: Date | null;
		memberId: string;
	}): Promise<void> {
		await this.db
			.insertInto('project_control_register_items')
			.values({
				organisation_id: input.organisationId,
				project_id: input.projectId,
				public_id: input.publicId,
				item_number: input.itemNumber,
				item_type: input.itemType,
				title: input.title,
				description: input.description,
				priority: input.priority,
				lifecycle_status: input.status,
				owner_member_id: input.ownerMemberId,
				due_on: input.dueOn,
				risk_direction: input.riskDirection,
				probability_score: input.probabilityScore,
				impact_score: input.impactScore,
				response_strategy: input.responseStrategy,
				response_plan: input.responsePlan,
				residual_probability_score: input.residualProbabilityScore,
				residual_impact_score: input.residualImpactScore,
				severity: input.severity,
				impact_summary: input.impactSummary,
				resolution_plan: input.resolutionPlan,
				decision_required_on: input.decisionRequiredOn,
				decision_outcome: null,
				decision_rationale: null,
				decided_by_member_id: null,
				decided_at: null,
				raised_by_member_id: input.memberId,
				updated_by_member_id: input.memberId,
				closed_by_member_id: null,
				closed_at: null
			})
			.executeTakeFirstOrThrow();
	}

	async updateItem(input: {
		projectId: string;
		itemId: string;
		expectedStatus: ProjectRidaLifecycleStatus;
		title: string;
		description: string | null;
		priority: ProjectRidaPriority;
		ownerMemberId: string | null;
		dueOn: Date | null;
		riskDirection: RiskDirection | null;
		probabilityScore: number | null;
		impactScore: number | null;
		responseStrategy: RiskResponseStrategy | null;
		responsePlan: string | null;
		residualProbabilityScore: number | null;
		residualImpactScore: number | null;
		severity: IssueSeverity | null;
		impactSummary: string | null;
		resolutionPlan: string | null;
		decisionRequiredOn: Date | null;
		memberId: string;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_control_register_items')
			.set({
				title: input.title,
				description: input.description,
				priority: input.priority,
				owner_member_id: input.ownerMemberId,
				due_on: input.dueOn,
				risk_direction: input.riskDirection,
				probability_score: input.probabilityScore,
				impact_score: input.impactScore,
				response_strategy: input.responseStrategy,
				response_plan: input.responsePlan,
				residual_probability_score: input.residualProbabilityScore,
				residual_impact_score: input.residualImpactScore,
				severity: input.severity,
				impact_summary: input.impactSummary,
				resolution_plan: input.resolutionPlan,
				decision_required_on: input.decisionRequiredOn,
				updated_by_member_id: input.memberId
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.itemId)
			.where('lifecycle_status', '=', input.expectedStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async transition(input: {
		projectId: string;
		itemId: string;
		fromStatus: ProjectRidaLifecycleStatus;
		toStatus: ProjectRidaLifecycleStatus;
		memberId: string;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_control_register_items')
			.set({ lifecycle_status: input.toStatus, updated_by_member_id: input.memberId })
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.itemId)
			.where('lifecycle_status', '=', input.fromStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async recordDecision(input: {
		projectId: string;
		itemId: string;
		fromStatus: 'proposed' | 'pending';
		outcome: string;
		rationale: string | null;
		memberId: string;
		decidedAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_control_register_items')
			.set({
				lifecycle_status: 'decided',
				decision_outcome: input.outcome,
				decision_rationale: input.rationale,
				decided_by_member_id: input.memberId,
				decided_at: input.decidedAt,
				updated_by_member_id: input.memberId
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.itemId)
			.where('item_type', '=', 'decision')
			.where('lifecycle_status', '=', input.fromStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async closeItem(input: {
		projectId: string;
		itemId: string;
		fromStatus: ProjectRidaLifecycleStatus;
		memberId: string;
		closedAt: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('project_control_register_items')
			.set({
				lifecycle_status: 'closed',
				closed_by_member_id: input.memberId,
				closed_at: input.closedAt,
				updated_by_member_id: input.memberId
			})
			.where('project_id', '=', input.projectId)
			.where('id', '=', input.itemId)
			.where('item_type', 'in', ['risk', 'issue'])
			.where('lifecycle_status', '=', input.fromStatus)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async listActions(projectId: string): Promise<ProjectRidaActionRecord[]> {
		const rows = await this.db
			.selectFrom('work_items')
			.select([
				'public_id',
				'source_public_id',
				'title',
				'description',
				'priority',
				'status',
				'due_at',
				'created_at'
			])
			.where('project_id', '=', projectId)
			.where('source_domain', '=', 'project_controls')
			.where('source_type', '=', 'project_rida_item')
			.where('source_public_id', 'is not', null)
			.where('work_item_kind', '=', 'action')
			.orderBy('status', 'asc')
			.orderBy('due_at', 'asc')
			.orderBy('created_at', 'desc')
			.execute();
		return rows.map((row) => ({
			publicId: row.public_id,
			sourceItemPublicId: row.source_public_id!,
			title: row.title,
			description: row.description,
			priority: row.priority,
			status: row.status,
			dueAt: row.due_at,
			createdAt: row.created_at
		}));
	}
}
