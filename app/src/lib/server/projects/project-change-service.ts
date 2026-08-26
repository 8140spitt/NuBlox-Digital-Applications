import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { enqueueOutboxEvent } from '$lib/server/jobs/outbox';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ensureProjectChangeStandardRoleDefaults } from './project-change-bootstrap';
import { ProjectRepository, type ProjectRecord } from './project-repository';

export type ProjectChangeStatus =
	| 'identified'
	| 'under_review'
	| 'accepted'
	| 'rejected'
	| 'implemented'
	| 'closed'
	| 'cancelled';
export type ChangeImpactLevel = 'none' | 'potential' | 'confirmed';
export type ProjectChangeDecision =
	| 'accepted'
	| 'accepted_with_conditions'
	| 'rejected'
	| 'deferred';

export class ProjectChangeValidationError extends Error {
	readonly code = 'PROJECT_CHANGE_VALIDATION';

	constructor(message: string) {
		super(message);
		this.name = 'ProjectChangeValidationError';
	}
}

export type ProjectChangeAssessmentInput = {
	projectPublicId: string;
	changePublicId: string;
	scopeImpactLevel: ChangeImpactLevel;
	programmeImpactLevel: ChangeImpactLevel;
	costImpactLevel: ChangeImpactLevel;
	contractImpactLevel: ChangeImpactLevel;
	informationImpactLevel: ChangeImpactLevel;
	scopeSummary?: string | null;
	programmeSummary?: string | null;
	costSummary?: string | null;
	contractSummary?: string | null;
	informationSummary?: string | null;
	currencyCode?: string | null;
	estimatedCostDelta?: string | null;
	estimatedTimeDeltaDays?: string | null;
	wbsPublicIds?: string[];
	activityPublicIds?: string[];
	costCodePublicIds?: string[];
	contractPublicIds?: string[];
};

export type ProjectChangeAssessmentRecord = {
	id: string;
	publicId: string;
	changeEventId: string;
	versionNumber: number;
	versionStatus: 'draft' | 'submitted' | 'superseded' | 'withdrawn';
	scopeImpactLevel: ChangeImpactLevel;
	programmeImpactLevel: ChangeImpactLevel;
	costImpactLevel: ChangeImpactLevel;
	contractImpactLevel: ChangeImpactLevel;
	informationImpactLevel: ChangeImpactLevel;
	scopeSummary: string | null;
	programmeSummary: string | null;
	costSummary: string | null;
	contractSummary: string | null;
	informationSummary: string | null;
	currencyCode: string | null;
	estimatedCostDelta: string | null;
	estimatedTimeDeltaDays: string | null;
	preparedByMemberId: string;
	preparedAt: Date;
	submittedByMemberId: string | null;
	submittedAt: Date | null;
	wbsPublicIds: string[];
	activityPublicIds: string[];
	costCodePublicIds: string[];
	contractPublicIds: string[];
};

export type ProjectChangeDecisionRecord = {
	publicId: string;
	changeEventId: string;
	assessmentId: string;
	decisionNumber: number;
	decision: ProjectChangeDecision;
	rationale: string;
	conditions: string | null;
	decidedByMemberId: string;
	decidedAt: Date;
};

export type ProjectChangeImplementationRecord = {
	publicId: string;
	changeEventId: string;
	assessmentId: string;
	implementationSummary: string;
	implementedByMemberId: string;
	implementedAt: Date;
};

export type ProjectChangeRecord = {
	id: string;
	publicId: string;
	changeNumber: string;
	typeCode: string;
	typeName: string;
	title: string;
	description: string;
	status: ProjectChangeStatus;
	identifiedByMemberId: string;
	identifiedAt: Date;
	closedAt: Date | null;
	latestAssessment: ProjectChangeAssessmentRecord | null;
	latestDecision: ProjectChangeDecisionRecord | null;
	implementation: ProjectChangeImplementationRecord | null;
	informationLinkCount: number;
	commercialVariationCount: number;
};

export type ProjectChangeWorkspace = {
	project: ProjectRecord;
	changeTypes: Array<{ code: string; name: string }>;
	changes: ProjectChangeRecord[];
	wbsOptions: Array<{ publicId: string; code: string; name: string }>;
	activityOptions: Array<{ publicId: string; code: string; name: string }>;
	costCodeOptions: Array<{ publicId: string; code: string; name: string }>;
	contractOptions: Array<{ publicId: string; contractNumber: string; title: string }>;
	canManage: boolean;
	canAssess: boolean;
	canApprove: boolean;
	canImplement: boolean;
	canClose: boolean;
};

const IMPACT_LEVELS = ['none', 'potential', 'confirmed'] as const;
const DECISIONS = ['accepted', 'accepted_with_conditions', 'rejected', 'deferred'] as const;

function requiredText(value: string, label: string, max: number): string {
	const normalized = value.trim();
	if (!normalized || normalized.length > max) {
		throw new ProjectChangeValidationError(`${label} must be between 1 and ${max} characters.`);
	}
	return normalized;
}

function optionalText(value: string | null | undefined, max: number): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (normalized.length > max) {
		throw new ProjectChangeValidationError(`Text must not exceed ${max} characters.`);
	}
	return normalized;
}

function impactLevel(value: string, label: string): ChangeImpactLevel {
	if (!IMPACT_LEVELS.includes(value as ChangeImpactLevel)) {
		throw new ProjectChangeValidationError(`${label} is invalid.`);
	}
	return value as ChangeImpactLevel;
}

function decimal(value: string | null | undefined, label: string): string | null {
	const normalized = value?.trim() ?? '';
	if (!normalized) return null;
	if (!/^-?\d{1,15}(?:\.\d{1,2})?$/.test(normalized)) {
		throw new ProjectChangeValidationError(`${label} must be a valid decimal with at most 2 decimal places.`);
	}
	return Number(normalized).toFixed(2);
}

function currency(value: string | null | undefined): string | null {
	const normalized = value?.trim().toUpperCase() ?? '';
	if (!normalized) return null;
	if (!/^[A-Z]{3}$/.test(normalized)) {
		throw new ProjectChangeValidationError('Currency must be a three-letter ISO code.');
	}
	return normalized;
}

function uniquePublicIds(values: string[] | undefined): string[] {
	return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

export class ProjectChangeService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly publicIdFactory: () => string = randomUUID,
		private readonly now: () => Date = () => new Date()
	) {}

	private async assertActiveActor(actor: TenantActorContext): Promise<void> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();
	}

	private async findProject(actor: TenantActorContext, projectPublicId: string): Promise<ProjectRecord> {
		await this.assertActiveActor(actor);
		await ensureProjectChangeStandardRoleDefaults(this.db, actor.organisationId);
		const project = await new ProjectRepository(this.db).findForMemberByPublicId(
			actor.organisationId,
			actor.memberId,
			projectPublicId.trim()
		);
		if (!project || project.owningOrganisationId !== actor.organisationId) {
			throw new RecordNotFoundError('Project change control not found in the active member scope.');
		}
		const viewProject = await new PermissionService(this.db).decide(actor, 'project.view', {
			projectId: project.id
		});
		if (!viewProject.allowed) {
			throw new RecordNotFoundError('Project change control not found in the active member scope.');
		}
		return project;
	}

	private async permissionFlags(actor: TenantActorContext, project: ProjectRecord) {
		const permissions = new PermissionService(this.db);
		const [view, manage, assess, approve, implement, close] = await Promise.all([
			permissions.decide(actor, 'project.change.view', { projectId: project.id }),
			permissions.decideWithUmbrella(actor, 'project.change.manage', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.change.assess', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.change.approve', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.change.implement', 'project.manage', {
				projectId: project.id
			}),
			permissions.decideWithUmbrella(actor, 'project.change.close', 'project.manage', {
				projectId: project.id
			})
		]);
		if (!view.allowed && !manage.allowed && !assess.allowed && !approve.allowed && !implement.allowed) {
			throw new RecordNotFoundError('Project change control not found in the active member scope.');
		}
		return {
			canManage: manage.allowed,
			canAssess: assess.allowed,
			canApprove: approve.allowed,
			canImplement: implement.allowed,
			canClose: close.allowed
		};
	}

	private async requirePermission(
		actor: TenantActorContext,
		projectPublicId: string,
		permissionKey:
			| 'project.change.manage'
			| 'project.change.assess'
			| 'project.change.approve'
			| 'project.change.implement'
			| 'project.change.close'
	): Promise<ProjectRecord> {
		const project = await this.findProject(actor, projectPublicId);
		const decision = await new PermissionService(this.db).decideWithUmbrella(
			actor,
			permissionKey,
			'project.manage',
			{ projectId: project.id }
		);
		if (!decision.allowed) throw new TenantAccessError('Project change control action is not permitted.');
		return project;
	}

	private async findChange(
		db: DatabaseExecutor,
		project: ProjectRecord,
		changePublicId: string,
		lock = false
	) {
		let query = db
			.selectFrom('project_change_events')
			.innerJoin(
				'project_change_event_types',
				'project_change_event_types.id',
				'project_change_events.project_change_event_type_id'
			)
			.select([
				'project_change_events.id',
				'project_change_events.public_id',
				'project_change_events.change_number',
				'project_change_events.title',
				'project_change_events.description',
				'project_change_events.status',
				'project_change_events.identified_by_member_id',
				'project_change_events.identified_at',
				'project_change_events.closed_at',
				'project_change_event_types.code as type_code',
				'project_change_event_types.name as type_name'
			])
			.where('project_change_events.project_id', '=', project.id)
			.where('project_change_events.owning_organisation_id', '=', project.owningOrganisationId)
			.where('project_change_events.public_id', '=', changePublicId.trim());
		if (lock) query = query.forUpdate();
		const row = await query.executeTakeFirst();
		if (!row) throw new RecordNotFoundError('Project change not found.');
		return row;
	}

	private assessmentRecord(row: {
		id: string;
		public_id: string;
		project_change_event_id: string;
		version_number: number;
		version_status: string;
		scope_impact_level: string;
		programme_impact_level: string;
		cost_impact_level: string;
		contract_impact_level: string;
		information_impact_level: string;
		scope_summary: string | null;
		programme_summary: string | null;
		cost_summary: string | null;
		contract_summary: string | null;
		information_summary: string | null;
		currency_code: string | null;
		estimated_cost_delta: string | null;
		estimated_time_delta_days: string | null;
		prepared_by_member_id: string;
		prepared_at: Date;
		submitted_by_member_id: string | null;
		submitted_at: Date | null;
	}, impacts?: {
		wbs?: string[];
		activities?: string[];
		costCodes?: string[];
		contracts?: string[];
	}): ProjectChangeAssessmentRecord {
		return {
			id: row.id,
			publicId: row.public_id,
			changeEventId: row.project_change_event_id,
			versionNumber: row.version_number,
			versionStatus: row.version_status as ProjectChangeAssessmentRecord['versionStatus'],
			scopeImpactLevel: row.scope_impact_level as ChangeImpactLevel,
			programmeImpactLevel: row.programme_impact_level as ChangeImpactLevel,
			costImpactLevel: row.cost_impact_level as ChangeImpactLevel,
			contractImpactLevel: row.contract_impact_level as ChangeImpactLevel,
			informationImpactLevel: row.information_impact_level as ChangeImpactLevel,
			scopeSummary: row.scope_summary,
			programmeSummary: row.programme_summary,
			costSummary: row.cost_summary,
			contractSummary: row.contract_summary,
			informationSummary: row.information_summary,
			currencyCode: row.currency_code,
			estimatedCostDelta: row.estimated_cost_delta,
			estimatedTimeDeltaDays: row.estimated_time_delta_days,
			preparedByMemberId: row.prepared_by_member_id,
			preparedAt: row.prepared_at,
			submittedByMemberId: row.submitted_by_member_id,
			submittedAt: row.submitted_at,
			wbsPublicIds: impacts?.wbs ?? [],
			activityPublicIds: impacts?.activities ?? [],
			costCodePublicIds: impacts?.costCodes ?? [],
			contractPublicIds: impacts?.contracts ?? []
		};
	}

	private async appendEvidence(
		db: DatabaseExecutor,
		actor: TenantActorContext,
		project: ProjectRecord,
		changePublicId: string,
		actionKey: string,
		changeSummary: Record<string, unknown>
	): Promise<void> {
		await new AuditRepository(db).append({
			eventPublicId: this.publicIdFactory(),
			actingOrganisationId: actor.organisationId,
			actorUserId: actor.userId,
			actorMemberId: actor.memberId,
			projectId: project.id,
			actionKey,
			subjectType: 'project_change_event',
			subjectPublicId: changePublicId,
			correlationId: actor.correlationId,
			changeSummary,
			eventMetadata: { projectPublicId: project.publicId }
		});
		await enqueueOutboxEvent(db, {
			organisationId: actor.organisationId,
			topic: actionKey,
			aggregateType: 'project_change_event',
			aggregatePublicId: changePublicId,
			correlationId: actor.correlationId,
			payload: { projectId: project.id, ...changeSummary }
		});
	}

	async getWorkspace(actor: TenantActorContext, projectPublicId: string): Promise<ProjectChangeWorkspace> {
		const project = await this.findProject(actor, projectPublicId);
		const flags = await this.permissionFlags(actor, project);
		const [types, changeRows, assessmentRows, decisionRows, implementationRows, wbsRows, activityRows, costRows, contractRows, informationCounts, variationCounts] =
			await Promise.all([
				this.db
					.selectFrom('project_change_event_types')
					.select(['code', 'name'])
					.where('is_active', '=', 1)
					.orderBy('name')
					.execute(),
				this.db
					.selectFrom('project_change_events')
					.innerJoin(
						'project_change_event_types',
						'project_change_event_types.id',
						'project_change_events.project_change_event_type_id'
					)
					.select([
						'project_change_events.id',
						'project_change_events.public_id',
						'project_change_events.change_number',
						'project_change_events.title',
						'project_change_events.description',
						'project_change_events.status',
						'project_change_events.identified_by_member_id',
						'project_change_events.identified_at',
						'project_change_events.closed_at',
						'project_change_event_types.code as type_code',
						'project_change_event_types.name as type_name'
					])
					.where('project_change_events.project_id', '=', project.id)
					.where('project_change_events.owning_organisation_id', '=', actor.organisationId)
					.orderBy('project_change_events.identified_at', 'desc')
					.execute(),
				this.db
					.selectFrom('project_change_assessments')
					.selectAll()
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.orderBy('version_number', 'desc')
					.execute(),
				this.db
					.selectFrom('project_change_decisions')
					.selectAll()
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.orderBy('decision_number', 'desc')
					.execute(),
				this.db
					.selectFrom('project_change_implementations')
					.selectAll()
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.execute(),
				this.db
					.selectFrom('project_wbs_nodes')
					.select(['public_id', 'wbs_code', 'name'])
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.where('lifecycle_status', '=', 'active')
					.orderBy('wbs_code')
					.execute(),
				this.db
					.selectFrom('project_plan_activities')
					.select(['public_id', 'activity_code', 'name'])
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.where('status', '!=', 'cancelled')
					.orderBy('activity_code')
					.execute(),
				this.db
					.selectFrom('project_cost_codes')
					.select(['public_id', 'code', 'name'])
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.where('is_active', '=', 1)
					.orderBy('code')
					.execute(),
				this.db
					.selectFrom('contracts')
					.select(['public_id', 'contract_number', 'title'])
					.where('project_id', '=', project.id)
					.where('organisation_id', '=', actor.organisationId)
					.where('lifecycle_status', '!=', 'cancelled')
					.orderBy('contract_number')
					.execute(),
				this.db
					.selectFrom('change_event_information_links')
					.select('project_change_event_id')
					.where('change_owner_organisation_id', '=', actor.organisationId)
					.execute(),
				this.db
					.selectFrom('commercial_variation_change_events')
					.select('project_change_event_id')
					.where('change_owner_organisation_id', '=', actor.organisationId)
					.execute()
			]);

		const assessmentIds = assessmentRows.map((row) => row.id);
		const [wbsImpacts, activityImpacts, costImpacts, contractImpacts] = assessmentIds.length
			? await Promise.all([
					this.db
						.selectFrom('project_change_wbs_impacts')
						.innerJoin('project_wbs_nodes', 'project_wbs_nodes.id', 'project_change_wbs_impacts.wbs_node_id')
						.select(['project_change_wbs_impacts.assessment_id', 'project_wbs_nodes.public_id'])
						.where('project_change_wbs_impacts.assessment_id', 'in', assessmentIds)
						.execute(),
					this.db
						.selectFrom('project_change_activity_impacts')
						.innerJoin(
							'project_plan_activities',
							'project_plan_activities.id',
							'project_change_activity_impacts.project_plan_activity_id'
						)
						.select(['project_change_activity_impacts.assessment_id', 'project_plan_activities.public_id'])
						.where('project_change_activity_impacts.assessment_id', 'in', assessmentIds)
						.execute(),
					this.db
						.selectFrom('project_change_cost_impacts')
						.innerJoin('project_cost_codes', 'project_cost_codes.id', 'project_change_cost_impacts.project_cost_code_id')
						.select(['project_change_cost_impacts.assessment_id', 'project_cost_codes.public_id'])
						.where('project_change_cost_impacts.assessment_id', 'in', assessmentIds)
						.execute(),
					this.db
						.selectFrom('project_change_contract_impacts')
						.innerJoin('contracts', 'contracts.id', 'project_change_contract_impacts.contract_id')
						.select(['project_change_contract_impacts.assessment_id', 'contracts.public_id'])
						.where('project_change_contract_impacts.assessment_id', 'in', assessmentIds)
						.execute()
				])
			: [[], [], [], []];

		const impactsByAssessment = new Map<string, { wbs: string[]; activities: string[]; costCodes: string[]; contracts: string[] }>();
		for (const assessmentId of assessmentIds) {
			impactsByAssessment.set(assessmentId, { wbs: [], activities: [], costCodes: [], contracts: [] });
		}
		for (const row of wbsImpacts) impactsByAssessment.get(row.assessment_id)?.wbs.push(row.public_id);
		for (const row of activityImpacts) impactsByAssessment.get(row.assessment_id)?.activities.push(row.public_id);
		for (const row of costImpacts) impactsByAssessment.get(row.assessment_id)?.costCodes.push(row.public_id);
		for (const row of contractImpacts) impactsByAssessment.get(row.assessment_id)?.contracts.push(row.public_id);

		const assessmentByEvent = new Map<string, ProjectChangeAssessmentRecord>();
		for (const row of assessmentRows) {
			if (!assessmentByEvent.has(row.project_change_event_id)) {
				assessmentByEvent.set(row.project_change_event_id, this.assessmentRecord(row, impactsByAssessment.get(row.id)));
			}
		}
		const decisionByEvent = new Map<string, ProjectChangeDecisionRecord>();
		for (const row of decisionRows) {
			if (!decisionByEvent.has(row.project_change_event_id)) {
				decisionByEvent.set(row.project_change_event_id, {
					publicId: row.public_id,
					changeEventId: row.project_change_event_id,
					assessmentId: row.assessment_id,
					decisionNumber: row.decision_number,
					decision: row.decision as ProjectChangeDecision,
					rationale: row.rationale,
					conditions: row.conditions,
					decidedByMemberId: row.decided_by_member_id,
					decidedAt: row.decided_at
				});
			}
		}
		const implementationByEvent = new Map<string, ProjectChangeImplementationRecord>(
			implementationRows.map((row) => [
				row.project_change_event_id,
				{
					publicId: row.public_id,
					changeEventId: row.project_change_event_id,
					assessmentId: row.assessment_id,
					implementationSummary: row.implementation_summary,
					implementedByMemberId: row.implemented_by_member_id,
					implementedAt: row.implemented_at
				}
			])
		);
		const informationCountByEvent = new Map<string, number>();
		for (const row of informationCounts) informationCountByEvent.set(row.project_change_event_id, (informationCountByEvent.get(row.project_change_event_id) ?? 0) + 1);
		const variationCountByEvent = new Map<string, number>();
		for (const row of variationCounts) variationCountByEvent.set(row.project_change_event_id, (variationCountByEvent.get(row.project_change_event_id) ?? 0) + 1);

		return {
			project,
			changeTypes: types,
			changes: changeRows.map((row) => ({
				id: row.id,
				publicId: row.public_id,
				changeNumber: row.change_number,
				typeCode: row.type_code,
				typeName: row.type_name,
				title: row.title,
				description: row.description,
				status: row.status as ProjectChangeStatus,
				identifiedByMemberId: row.identified_by_member_id,
				identifiedAt: row.identified_at,
				closedAt: row.closed_at,
				latestAssessment: assessmentByEvent.get(row.id) ?? null,
				latestDecision: decisionByEvent.get(row.id) ?? null,
				implementation: implementationByEvent.get(row.id) ?? null,
				informationLinkCount: informationCountByEvent.get(row.id) ?? 0,
				commercialVariationCount: variationCountByEvent.get(row.id) ?? 0
			})),
			wbsOptions: wbsRows.map((row) => ({ publicId: row.public_id, code: row.wbs_code, name: row.name })),
			activityOptions: activityRows.map((row) => ({ publicId: row.public_id, code: row.activity_code, name: row.name })),
			costCodeOptions: costRows.map((row) => ({ publicId: row.public_id, code: row.code, name: row.name })),
			contractOptions: contractRows.map((row) => ({ publicId: row.public_id, contractNumber: row.contract_number, title: row.title })),
			...flags
		};
	}

	async createChange(
		actor: TenantActorContext,
		input: { projectPublicId: string; typeCode: string; title: string; description: string }
	): Promise<string> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.change.manage');
		const typeCode = requiredText(input.typeCode, 'Change type', 64);
		const title = requiredText(input.title, 'Title', 255);
		const description = requiredText(input.description, 'Description', 20_000);
		const publicId = this.publicIdFactory();
		const now = this.now();

		await this.db.transaction().execute(async (trx) => {
			const type = await trx
				.selectFrom('project_change_event_types')
				.select('id')
				.where('code', '=', typeCode)
				.where('is_active', '=', 1)
				.executeTakeFirst();
			if (!type) throw new ProjectChangeValidationError('Change type is invalid.');
			const inserted = await trx
				.insertInto('project_change_events')
				.values({
					project_id: project.id,
					owning_organisation_id: actor.organisationId,
					public_id: publicId,
					change_number: `PENDING-${publicId}`,
					project_change_event_type_id: type.id,
					title,
					description,
					status: 'identified',
					identified_by_member_id: actor.memberId,
					identified_at: now,
					closed_at: null
				})
				.executeTakeFirstOrThrow();
			const id = inserted.insertId?.toString();
			if (!id) throw new Error('Project change insert did not return an identifier.');
			await trx
				.updateTable('project_change_events')
				.set({ change_number: `CHG-${id.padStart(6, '0')}` })
				.where('id', '=', id)
				.where('owning_organisation_id', '=', actor.organisationId)
				.executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, publicId, 'project.change.raised', {
				typeCode,
				title,
				status: 'identified'
			});
		});
		return publicId;
	}

	private normalizeAssessment(input: ProjectChangeAssessmentInput) {
		const estimatedCostDelta = decimal(input.estimatedCostDelta, 'Estimated cost delta');
		const currencyCode = currency(input.currencyCode);
		if (estimatedCostDelta !== null && currencyCode === null) {
			throw new ProjectChangeValidationError('Currency is required when an estimated cost delta is recorded.');
		}
		return {
			scopeImpactLevel: impactLevel(input.scopeImpactLevel, 'Scope impact'),
			programmeImpactLevel: impactLevel(input.programmeImpactLevel, 'Programme impact'),
			costImpactLevel: impactLevel(input.costImpactLevel, 'Cost impact'),
			contractImpactLevel: impactLevel(input.contractImpactLevel, 'Contract impact'),
			informationImpactLevel: impactLevel(input.informationImpactLevel, 'Information impact'),
			scopeSummary: optionalText(input.scopeSummary, 20_000),
			programmeSummary: optionalText(input.programmeSummary, 20_000),
			costSummary: optionalText(input.costSummary, 20_000),
			contractSummary: optionalText(input.contractSummary, 20_000),
			informationSummary: optionalText(input.informationSummary, 20_000),
			currencyCode,
			estimatedCostDelta,
			estimatedTimeDeltaDays: decimal(input.estimatedTimeDeltaDays, 'Estimated time delta'),
			wbsPublicIds: uniquePublicIds(input.wbsPublicIds),
			activityPublicIds: uniquePublicIds(input.activityPublicIds),
			costCodePublicIds: uniquePublicIds(input.costCodePublicIds),
			contractPublicIds: uniquePublicIds(input.contractPublicIds)
		};
	}

	private async resolveImpactIds(
		db: DatabaseExecutor,
		project: ProjectRecord,
		organisationId: string,
		input: ReturnType<ProjectChangeService['normalizeAssessment']>
	) {
		const [wbsRows, activityRows, costRows, contractRows] = await Promise.all([
			input.wbsPublicIds.length
				? db
						.selectFrom('project_wbs_nodes')
						.select(['id', 'public_id'])
						.where('project_id', '=', project.id)
						.where('organisation_id', '=', organisationId)
						.where('public_id', 'in', input.wbsPublicIds)
						.execute()
				: Promise.resolve([]),
			input.activityPublicIds.length
				? db
						.selectFrom('project_plan_activities')
						.select(['id', 'public_id'])
						.where('project_id', '=', project.id)
						.where('organisation_id', '=', organisationId)
						.where('public_id', 'in', input.activityPublicIds)
						.execute()
				: Promise.resolve([]),
			input.costCodePublicIds.length
				? db
						.selectFrom('project_cost_codes')
						.select(['id', 'public_id'])
						.where('project_id', '=', project.id)
						.where('organisation_id', '=', organisationId)
						.where('public_id', 'in', input.costCodePublicIds)
						.execute()
				: Promise.resolve([]),
			input.contractPublicIds.length
				? db
						.selectFrom('contracts')
						.select(['id', 'public_id'])
						.where('project_id', '=', project.id)
						.where('organisation_id', '=', organisationId)
						.where('public_id', 'in', input.contractPublicIds)
						.execute()
				: Promise.resolve([])
		]);

		if (wbsRows.length !== input.wbsPublicIds.length) throw new ProjectChangeValidationError('One or more scope/WBS selections are outside this project.');
		if (activityRows.length !== input.activityPublicIds.length) throw new ProjectChangeValidationError('One or more programme/activity selections are outside this project.');
		if (costRows.length !== input.costCodePublicIds.length) throw new ProjectChangeValidationError('One or more cost-code selections are outside this project.');
		if (contractRows.length !== input.contractPublicIds.length) throw new ProjectChangeValidationError('One or more contract selections are outside this project.');
		return { wbsRows, activityRows, costRows, contractRows };
	}

	async saveAssessment(actor: TenantActorContext, input: ProjectChangeAssessmentInput): Promise<string> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.change.assess');
		const normalized = this.normalizeAssessment(input);
		const now = this.now();
		let assessmentPublicId = '';

		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, input.changePublicId, true);
			if (!['identified', 'under_review'].includes(change.status)) {
				throw new ProjectChangeValidationError('Only identified or under-review changes can be assessed.');
			}
			const latest = await trx
				.selectFrom('project_change_assessments')
				.select(['id', 'public_id', 'version_number', 'version_status'])
				.where('project_change_event_id', '=', change.id)
				.where('organisation_id', '=', actor.organisationId)
				.orderBy('version_number', 'desc')
				.forUpdate()
				.executeTakeFirst();
			const impactIds = await this.resolveImpactIds(trx, project, actor.organisationId, normalized);
			let assessmentId: string;

			if (latest?.version_status === 'draft') {
				assessmentId = latest.id;
				assessmentPublicId = latest.public_id;
				await trx
					.updateTable('project_change_assessments')
					.set({
						scope_impact_level: normalized.scopeImpactLevel,
						programme_impact_level: normalized.programmeImpactLevel,
						cost_impact_level: normalized.costImpactLevel,
						contract_impact_level: normalized.contractImpactLevel,
						information_impact_level: normalized.informationImpactLevel,
						scope_summary: normalized.scopeSummary,
						programme_summary: normalized.programmeSummary,
						cost_summary: normalized.costSummary,
						contract_summary: normalized.contractSummary,
						information_summary: normalized.informationSummary,
						currency_code: normalized.currencyCode,
						estimated_cost_delta: normalized.estimatedCostDelta,
						estimated_time_delta_days: normalized.estimatedTimeDeltaDays
					})
					.where('id', '=', latest.id)
					.where('version_status', '=', 'draft')
					.executeTakeFirstOrThrow();
			} else {
				assessmentPublicId = this.publicIdFactory();
				const inserted = await trx
					.insertInto('project_change_assessments')
					.values({
						organisation_id: actor.organisationId,
						project_id: project.id,
						project_change_event_id: change.id,
						public_id: assessmentPublicId,
						version_number: (latest?.version_number ?? 0) + 1,
						version_status: 'draft',
						scope_impact_level: normalized.scopeImpactLevel,
						programme_impact_level: normalized.programmeImpactLevel,
						cost_impact_level: normalized.costImpactLevel,
						contract_impact_level: normalized.contractImpactLevel,
						information_impact_level: normalized.informationImpactLevel,
						scope_summary: normalized.scopeSummary,
						programme_summary: normalized.programmeSummary,
						cost_summary: normalized.costSummary,
						contract_summary: normalized.contractSummary,
						information_summary: normalized.informationSummary,
						currency_code: normalized.currencyCode,
						estimated_cost_delta: normalized.estimatedCostDelta,
						estimated_time_delta_days: normalized.estimatedTimeDeltaDays,
						prepared_by_member_id: actor.memberId,
						prepared_at: now,
						submitted_by_member_id: null,
						submitted_at: null
					})
					.executeTakeFirstOrThrow();
				assessmentId = inserted.insertId?.toString() ?? '';
				if (!assessmentId) throw new Error('Project change assessment insert did not return an identifier.');
			}

			await Promise.all([
				trx.deleteFrom('project_change_wbs_impacts').where('assessment_id', '=', assessmentId).execute(),
				trx.deleteFrom('project_change_activity_impacts').where('assessment_id', '=', assessmentId).execute(),
				trx.deleteFrom('project_change_cost_impacts').where('assessment_id', '=', assessmentId).execute(),
				trx.deleteFrom('project_change_contract_impacts').where('assessment_id', '=', assessmentId).execute()
			]);
			if (impactIds.wbsRows.length) await trx.insertInto('project_change_wbs_impacts').values(impactIds.wbsRows.map((row) => ({ assessment_id: assessmentId, organisation_id: actor.organisationId, project_id: project.id, wbs_node_id: row.id, impact_type: 'affected', impact_summary: null }))).execute();
			if (impactIds.activityRows.length) await trx.insertInto('project_change_activity_impacts').values(impactIds.activityRows.map((row) => ({ assessment_id: assessmentId, organisation_id: actor.organisationId, project_id: project.id, project_plan_activity_id: row.id, impact_type: 'affected', time_delta_days: null, impact_summary: null }))).execute();
			if (impactIds.costRows.length) await trx.insertInto('project_change_cost_impacts').values(impactIds.costRows.map((row) => ({ assessment_id: assessmentId, organisation_id: actor.organisationId, project_id: project.id, project_cost_code_id: row.id, impact_type: 'uncertain', amount_delta: null, impact_summary: null }))).execute();
			if (impactIds.contractRows.length) await trx.insertInto('project_change_contract_impacts').values(impactIds.contractRows.map((row) => ({ assessment_id: assessmentId, organisation_id: actor.organisationId, project_id: project.id, contract_id: row.id, impact_type: 'other', impact_summary: null }))).execute();

			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.assessment_saved', {
				assessmentPublicId,
				impactLevels: {
					scope: normalized.scopeImpactLevel,
					programme: normalized.programmeImpactLevel,
					cost: normalized.costImpactLevel,
					contract: normalized.contractImpactLevel,
					information: normalized.informationImpactLevel
				}
			});
		});
		return assessmentPublicId;
	}

	async submitAssessment(actor: TenantActorContext, projectPublicId: string, changePublicId: string): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.change.assess');
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, changePublicId, true);
			if (!['identified', 'under_review'].includes(change.status)) throw new ProjectChangeValidationError('This change can no longer be submitted for assessment.');
			const draft = await trx.selectFrom('project_change_assessments').selectAll().where('project_change_event_id', '=', change.id).where('organisation_id', '=', actor.organisationId).where('version_status', '=', 'draft').orderBy('version_number', 'desc').forUpdate().executeTakeFirst();
			if (!draft) throw new ProjectChangeValidationError('Save a draft impact assessment before submitting the change.');
			const hasImpact = [draft.scope_impact_level, draft.programme_impact_level, draft.cost_impact_level, draft.contract_impact_level, draft.information_impact_level].some((value) => value !== 'none');
			if (!hasImpact) throw new ProjectChangeValidationError('At least one impact domain must be marked potential or confirmed before submission.');
			await trx.updateTable('project_change_assessments').set({ version_status: 'superseded' }).where('project_change_event_id', '=', change.id).where('version_status', '=', 'submitted').execute();
			await trx.updateTable('project_change_assessments').set({ version_status: 'submitted', submitted_by_member_id: actor.memberId, submitted_at: now }).where('id', '=', draft.id).where('version_status', '=', 'draft').executeTakeFirstOrThrow();
			await trx.updateTable('project_change_events').set({ status: 'under_review' }).where('id', '=', change.id).where('owning_organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.assessment_submitted', { assessmentPublicId: draft.public_id, versionNumber: draft.version_number, status: 'under_review' });
		});
	}

	async decideChange(
		actor: TenantActorContext,
		input: { projectPublicId: string; changePublicId: string; decision: ProjectChangeDecision; rationale: string; conditions?: string | null }
	): Promise<void> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.change.approve');
		if (!DECISIONS.includes(input.decision)) throw new ProjectChangeValidationError('Decision is invalid.');
		const rationale = requiredText(input.rationale, 'Decision rationale', 20_000);
		const conditions = optionalText(input.conditions, 20_000);
		if (input.decision === 'accepted_with_conditions' && !conditions) throw new ProjectChangeValidationError('Acceptance conditions are required for an accepted-with-conditions decision.');
		const now = this.now();

		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, input.changePublicId, true);
			if (change.status !== 'under_review') throw new ProjectChangeValidationError('Only an under-review change can be decided.');
			const assessment = await trx.selectFrom('project_change_assessments').select(['id', 'public_id']).where('project_change_event_id', '=', change.id).where('version_status', '=', 'submitted').orderBy('version_number', 'desc').forUpdate().executeTakeFirst();
			if (!assessment) throw new ProjectChangeValidationError('A submitted impact assessment is required before decision.');
			const lastDecision = await trx.selectFrom('project_change_decisions').select('decision_number').where('project_change_event_id', '=', change.id).orderBy('decision_number', 'desc').forUpdate().executeTakeFirst();
			await trx.insertInto('project_change_decisions').values({
				organisation_id: actor.organisationId,
				project_id: project.id,
				project_change_event_id: change.id,
				assessment_id: assessment.id,
				public_id: this.publicIdFactory(),
				decision_number: (lastDecision?.decision_number ?? 0) + 1,
				decision: input.decision,
				rationale,
				conditions,
				decided_by_member_id: actor.memberId,
				decided_at: now
			}).execute();
			const status: ProjectChangeStatus = input.decision === 'rejected' ? 'rejected' : input.decision === 'deferred' ? 'under_review' : 'accepted';
			await trx.updateTable('project_change_events').set({ status }).where('id', '=', change.id).where('owning_organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.decided', { assessmentPublicId: assessment.public_id, decision: input.decision, status });
		});
	}

	async recordImplementation(
		actor: TenantActorContext,
		input: { projectPublicId: string; changePublicId: string; implementationSummary: string; implementedAt?: Date | null }
	): Promise<void> {
		const project = await this.requirePermission(actor, input.projectPublicId, 'project.change.implement');
		const implementationSummary = requiredText(input.implementationSummary, 'Implementation summary', 20_000);
		const implementedAt = input.implementedAt ?? this.now();
		if (!(implementedAt instanceof Date) || Number.isNaN(implementedAt.getTime())) throw new ProjectChangeValidationError('Implementation date is invalid.');

		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, input.changePublicId, true);
			if (change.status !== 'accepted') throw new ProjectChangeValidationError('Only an accepted change can be recorded as implemented.');
			const decision = await trx.selectFrom('project_change_decisions').select(['assessment_id', 'decision']).where('project_change_event_id', '=', change.id).where('decision', 'in', ['accepted', 'accepted_with_conditions']).orderBy('decision_number', 'desc').forUpdate().executeTakeFirst();
			if (!decision) throw new ProjectChangeValidationError('Accepted decision evidence is required before implementation.');
			const existing = await trx.selectFrom('project_change_implementations').select('id').where('project_change_event_id', '=', change.id).executeTakeFirst();
			if (existing) throw new ProjectChangeValidationError('Implementation has already been recorded for this change.');
			await trx.insertInto('project_change_implementations').values({ organisation_id: actor.organisationId, project_id: project.id, project_change_event_id: change.id, assessment_id: decision.assessment_id, public_id: this.publicIdFactory(), implementation_summary: implementationSummary, implemented_by_member_id: actor.memberId, implemented_at: implementedAt }).execute();
			await trx.updateTable('project_change_events').set({ status: 'implemented' }).where('id', '=', change.id).where('owning_organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.implemented', { status: 'implemented', implementedAt: implementedAt.toISOString() });
		});
	}

	async closeChange(actor: TenantActorContext, projectPublicId: string, changePublicId: string): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.change.close');
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, changePublicId, true);
			if (!['implemented', 'rejected'].includes(change.status)) throw new ProjectChangeValidationError('Only implemented or rejected changes can be closed.');
			await trx.updateTable('project_change_events').set({ status: 'closed', closed_at: now }).where('id', '=', change.id).where('owning_organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.closed', { previousStatus: change.status, status: 'closed' });
		});
	}

	async cancelChange(actor: TenantActorContext, projectPublicId: string, changePublicId: string): Promise<void> {
		const project = await this.requirePermission(actor, projectPublicId, 'project.change.manage');
		const now = this.now();
		await this.db.transaction().execute(async (trx) => {
			const change = await this.findChange(trx, project, changePublicId, true);
			if (!['identified', 'under_review'].includes(change.status)) throw new ProjectChangeValidationError('Only identified or under-review changes can be cancelled.');
			await trx.updateTable('project_change_events').set({ status: 'cancelled', closed_at: now }).where('id', '=', change.id).where('owning_organisation_id', '=', actor.organisationId).executeTakeFirstOrThrow();
			await this.appendEvidence(trx, actor, project, change.public_id, 'project.change.cancelled', { previousStatus: change.status, status: 'cancelled' });
		});
	}
}
