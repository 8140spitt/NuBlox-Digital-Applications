import type { DatabaseExecutor } from '$lib/server/db/executor';

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'cancelled';
export type ActivityDirection = 'inbound' | 'outbound' | 'internal' | null;

export type CrmPipelineStageOption = {
	id: string;
	name: string;
	sortOrder: number;
	probabilityPercent: string | null;
};

export type CrmPipelineOption = {
	id: string;
	publicId: string;
	name: string;
	isDefault: boolean;
	stages: CrmPipelineStageOption[];
};

export type OpportunityPartyRoleType = {
	id: number;
	code: string;
	name: string;
};

export type CrmActivityType = {
	id: number;
	code: string;
	name: string;
};

export type CrmOpportunitySummary = {
	id: string;
	publicId: string;
	title: string;
	description: string | null;
	status: OpportunityStatus;
	pipelinePublicId: string;
	pipelineName: string;
	stageName: string;
	stageProbabilityPercent: string | null;
	estimatedValue: string | null;
	currencyCode: string;
	expectedCloseDate: Date | null;
	ownerMemberId: string | null;
	ownerDisplayName: string | null;
	primaryPartyPublicId: string | null;
	primaryPartyDisplayName: string | null;
	closedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type CrmOpportunityParticipant = {
	partyId: string;
	partyPublicId: string;
	displayName: string;
	roleCode: string;
	roleName: string;
	isPrimary: boolean;
	assignedAt: Date;
};

export type CrmActivityPartyParticipant = {
	partyPublicId: string;
	displayName: string;
	participantRole: string;
};

export type CrmActivityTimelineItem = {
	id: string;
	publicId: string;
	typeCode: string;
	typeName: string;
	subject: string;
	body: string | null;
	direction: ActivityDirection;
	occurredAt: Date;
	createdByDisplayName: string;
	parties: CrmActivityPartyParticipant[];
};

function opportunityStatus(value: string): OpportunityStatus {
	if (value === 'open' || value === 'won' || value === 'lost' || value === 'cancelled')
		return value;
	throw new Error(`Unexpected opportunity status: ${value}`);
}

function activityDirection(value: string | null): ActivityDirection {
	if (value === null || value === 'inbound' || value === 'outbound' || value === 'internal')
		return value;
	throw new Error(`Unexpected CRM activity direction: ${value}`);
}

function personDisplayName(input: {
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
}): string {
	const preferred = input.preferredName?.trim();
	const family = input.familyName?.trim();
	if (preferred && family) return `${preferred} ${family}`;
	if (preferred) return preferred;
	return [input.givenNames?.trim(), family].filter(Boolean).join(' ') || 'Unnamed person';
}

function partyDisplayName(input: {
	kind: string;
	preferredName: string | null;
	givenNames: string | null;
	familyName: string | null;
	legalName: string | null;
	tradingName: string | null;
}): string {
	return input.kind === 'person'
		? personDisplayName(input)
		: input.tradingName?.trim() || input.legalName?.trim() || 'Unnamed organisation';
}

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

export class CrmOpportunityRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async listPipelines(organisationId: string): Promise<CrmPipelineOption[]> {
		const pipelines = await this.db
			.selectFrom('crm_pipelines')
			.select(['id', 'public_id as publicId', 'name', 'is_default as isDefault'])
			.where('organisation_id', '=', organisationId)
			.where('is_active', '=', 1)
			.orderBy('is_default', 'desc')
			.orderBy('name', 'asc')
			.execute();
		if (pipelines.length === 0) return [];
		const stages = await this.db
			.selectFrom('crm_pipeline_stages')
			.select([
				'id',
				'crm_pipeline_id as pipelineId',
				'name',
				'sort_order as sortOrder',
				'probability_percent as probabilityPercent'
			])
			.where('organisation_id', '=', organisationId)
			.where(
				'crm_pipeline_id',
				'in',
				pipelines.map((pipeline) => pipeline.id)
			)
			.where('is_active', '=', 1)
			.orderBy('sort_order', 'asc')
			.execute();
		const byPipeline = new Map<string, CrmPipelineStageOption[]>();
		for (const stage of stages) {
			const list = byPipeline.get(stage.pipelineId) ?? [];
			list.push({
				id: stage.id,
				name: stage.name,
				sortOrder: stage.sortOrder,
				probabilityPercent: stage.probabilityPercent
			});
			byPipeline.set(stage.pipelineId, list);
		}
		return pipelines.map((pipeline) => ({
			id: pipeline.id,
			publicId: pipeline.publicId,
			name: pipeline.name,
			isDefault: pipeline.isDefault === 1,
			stages: byPipeline.get(pipeline.id) ?? []
		}));
	}

	async resolveStage(
		organisationId: string,
		pipelinePublicId: string,
		stageName: string
	): Promise<{ pipelineId: string; stageId: string } | null> {
		const row = await this.db
			.selectFrom('crm_pipelines as pipeline')
			.innerJoin('crm_pipeline_stages as stage', (join) =>
				join
					.onRef('stage.crm_pipeline_id', '=', 'pipeline.id')
					.onRef('stage.organisation_id', '=', 'pipeline.organisation_id')
			)
			.select(['pipeline.id as pipelineId', 'stage.id as stageId'])
			.where('pipeline.organisation_id', '=', organisationId)
			.where('pipeline.public_id', '=', pipelinePublicId)
			.where('pipeline.is_active', '=', 1)
			.where('stage.name', '=', stageName)
			.where('stage.is_active', '=', 1)
			.executeTakeFirst();
		return row ?? null;
	}

	async listOpportunityPartyRoleTypes(): Promise<OpportunityPartyRoleType[]> {
		const rows = await this.db
			.selectFrom('opportunity_party_role_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
		return rows;
	}

	async findOpportunityPartyRoleTypeId(code: string): Promise<number | null> {
		const row = await this.db
			.selectFrom('opportunity_party_role_types')
			.select('id')
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		return row?.id ?? null;
	}

	async listActivityTypes(): Promise<CrmActivityType[]> {
		return this.db
			.selectFrom('crm_activity_types')
			.select(['id', 'code', 'name'])
			.where('is_active', '=', 1)
			.orderBy('name', 'asc')
			.execute();
	}

	async findActivityTypeId(code: string): Promise<number | null> {
		const row = await this.db
			.selectFrom('crm_activity_types')
			.select('id')
			.where('code', '=', code)
			.where('is_active', '=', 1)
			.executeTakeFirst();
		return row?.id ?? null;
	}

	private opportunityQuery(organisationId: string) {
		return this.db
			.selectFrom('opportunities as opportunity')
			.innerJoin('crm_pipelines as pipeline', (join) =>
				join
					.onRef('pipeline.id', '=', 'opportunity.crm_pipeline_id')
					.onRef('pipeline.organisation_id', '=', 'opportunity.organisation_id')
			)
			.innerJoin('crm_pipeline_stages as stage', (join) =>
				join
					.onRef('stage.id', '=', 'opportunity.crm_pipeline_stage_id')
					.onRef('stage.crm_pipeline_id', '=', 'opportunity.crm_pipeline_id')
					.onRef('stage.organisation_id', '=', 'opportunity.organisation_id')
			)
			.leftJoin('organisation_members as ownerMember', (join) =>
				join
					.onRef('ownerMember.id', '=', 'opportunity.owner_member_id')
					.onRef('ownerMember.organisation_id', '=', 'opportunity.organisation_id')
			)
			.leftJoin('users as ownerUser', 'ownerUser.id', 'ownerMember.user_id')
			.leftJoin('opportunity_parties as primaryAssignment', (join) =>
				join
					.onRef('primaryAssignment.opportunity_id', '=', 'opportunity.id')
					.onRef('primaryAssignment.organisation_id', '=', 'opportunity.organisation_id')
					.on('primaryAssignment.is_primary', '=', 1)
			)
			.leftJoin('parties as primaryParty', (join) =>
				join
					.onRef('primaryParty.id', '=', 'primaryAssignment.party_id')
					.onRef('primaryParty.organisation_id', '=', 'primaryAssignment.organisation_id')
			)
			.leftJoin('party_persons as primaryPerson', (join) =>
				join
					.onRef('primaryPerson.party_id', '=', 'primaryParty.id')
					.onRef('primaryPerson.organisation_id', '=', 'primaryParty.organisation_id')
			)
			.leftJoin('party_organisations as primaryCompany', (join) =>
				join
					.onRef('primaryCompany.party_id', '=', 'primaryParty.id')
					.onRef('primaryCompany.organisation_id', '=', 'primaryParty.organisation_id')
			)
			.select([
				'opportunity.id as id',
				'opportunity.public_id as publicId',
				'opportunity.title as title',
				'opportunity.description as description',
				'opportunity.status as status',
				'opportunity.estimated_value as estimatedValue',
				'opportunity.currency_code as currencyCode',
				'opportunity.expected_close_date as expectedCloseDate',
				'opportunity.owner_member_id as ownerMemberId',
				'opportunity.closed_at as closedAt',
				'opportunity.created_at as createdAt',
				'opportunity.updated_at as updatedAt',
				'pipeline.public_id as pipelinePublicId',
				'pipeline.name as pipelineName',
				'stage.name as stageName',
				'stage.probability_percent as stageProbabilityPercent',
				'ownerUser.display_name as ownerDisplayName',
				'primaryParty.public_id as primaryPartyPublicId',
				'primaryParty.party_kind as primaryPartyKind',
				'primaryPerson.preferred_name as primaryPreferredName',
				'primaryPerson.given_names as primaryGivenNames',
				'primaryPerson.family_name as primaryFamilyName',
				'primaryCompany.legal_name as primaryLegalName',
				'primaryCompany.trading_name as primaryTradingName'
			])
			.where('opportunity.organisation_id', '=', organisationId);
	}

	private mapOpportunity(
		row: Awaited<
			ReturnType<ReturnType<CrmOpportunityRepository['opportunityQuery']>['executeTakeFirst']>
		> &
			object
	): CrmOpportunitySummary {
		const value = row as any;
		return {
			id: value.id,
			publicId: value.publicId,
			title: value.title,
			description: value.description,
			status: opportunityStatus(value.status),
			pipelinePublicId: value.pipelinePublicId,
			pipelineName: value.pipelineName,
			stageName: value.stageName,
			stageProbabilityPercent: value.stageProbabilityPercent,
			estimatedValue: value.estimatedValue,
			currencyCode: value.currencyCode,
			expectedCloseDate: value.expectedCloseDate,
			ownerMemberId: value.ownerMemberId,
			ownerDisplayName: value.ownerDisplayName,
			primaryPartyPublicId: value.primaryPartyPublicId,
			primaryPartyDisplayName: value.primaryPartyPublicId
				? partyDisplayName({
						kind: value.primaryPartyKind,
						preferredName: value.primaryPreferredName,
						givenNames: value.primaryGivenNames,
						familyName: value.primaryFamilyName,
						legalName: value.primaryLegalName,
						tradingName: value.primaryTradingName
					})
				: null,
			closedAt: value.closedAt,
			createdAt: value.createdAt,
			updatedAt: value.updatedAt
		};
	}

	async listOpportunities(
		organisationId: string,
		filters: { search?: string; status?: OpportunityStatus } = {}
	): Promise<CrmOpportunitySummary[]> {
		let query = this.opportunityQuery(organisationId);
		if (filters.status) query = query.where('opportunity.status', '=', filters.status);
		const search = filters.search?.trim();
		if (search) {
			const like = `%${search}%`;
			query = query.where((eb) =>
				eb.or([
					eb('opportunity.title', 'like', like),
					eb('opportunity.description', 'like', like),
					eb('primaryPerson.preferred_name', 'like', like),
					eb('primaryPerson.given_names', 'like', like),
					eb('primaryPerson.family_name', 'like', like),
					eb('primaryCompany.legal_name', 'like', like),
					eb('primaryCompany.trading_name', 'like', like)
				])
			);
		}
		const rows = await query.orderBy('opportunity.updated_at', 'desc').limit(250).execute();
		return rows.map((row) => this.mapOpportunity(row));
	}

	async findOpportunityByPublicId(
		organisationId: string,
		publicId: string
	): Promise<CrmOpportunitySummary | null> {
		const row = await this.opportunityQuery(organisationId)
			.where('opportunity.public_id', '=', publicId)
			.executeTakeFirst();
		return row ? this.mapOpportunity(row) : null;
	}

	async insertOpportunity(input: {
		organisationId: string;
		publicId: string;
		pipelineId: string;
		stageId: string;
		ownerMemberId: string;
		title: string;
		description: string | null;
		estimatedValue: string | null;
		currencyCode: string;
		expectedCloseDate: Date | null;
	}): Promise<string> {
		const result = await this.db
			.insertInto('opportunities')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				crm_pipeline_id: input.pipelineId,
				crm_pipeline_stage_id: input.stageId,
				owner_member_id: input.ownerMemberId,
				title: input.title,
				description: input.description,
				estimated_value: input.estimatedValue,
				currency_code: input.currencyCode,
				expected_close_date: input.expectedCloseDate,
				status: 'open',
				closed_at: null
			})
			.executeTakeFirstOrThrow();
		return insertedId(result);
	}

	async updateOpportunity(input: {
		organisationId: string;
		opportunityId: string;
		pipelineId: string;
		stageId: string;
		title: string;
		description: string | null;
		estimatedValue: string | null;
		currencyCode: string;
		expectedCloseDate: Date | null;
		status: OpportunityStatus;
		closedAt: Date | null;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('opportunities')
			.set({
				crm_pipeline_id: input.pipelineId,
				crm_pipeline_stage_id: input.stageId,
				title: input.title,
				description: input.description,
				estimated_value: input.estimatedValue,
				currency_code: input.currencyCode,
				expected_close_date: input.expectedCloseDate,
				status: input.status,
				closed_at: input.closedAt
			})
			.where('organisation_id', '=', input.organisationId)
			.where('id', '=', input.opportunityId)
			.executeTakeFirst();
		return result.numUpdatedRows > 0n;
	}

	async listParticipants(
		organisationId: string,
		opportunityId: string
	): Promise<CrmOpportunityParticipant[]> {
		const rows = await this.db
			.selectFrom('opportunity_parties as assignment')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'assignment.party_id')
					.onRef('party.organisation_id', '=', 'assignment.organisation_id')
			)
			.innerJoin(
				'opportunity_party_role_types as role',
				'role.id',
				'assignment.opportunity_party_role_type_id'
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'party.id as partyId',
				'party.public_id as partyPublicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName',
				'role.code as roleCode',
				'role.name as roleName',
				'assignment.is_primary as isPrimary',
				'assignment.assigned_at as assignedAt'
			])
			.where('assignment.organisation_id', '=', organisationId)
			.where('assignment.opportunity_id', '=', opportunityId)
			.orderBy('assignment.is_primary', 'desc')
			.orderBy('role.name', 'asc')
			.execute();
		return rows.map((row) => ({
			partyId: row.partyId,
			partyPublicId: row.partyPublicId,
			displayName: partyDisplayName({
				kind: row.partyKind,
				preferredName: row.preferredName,
				givenNames: row.givenNames,
				familyName: row.familyName,
				legalName: row.legalName,
				tradingName: row.tradingName
			}),
			roleCode: row.roleCode,
			roleName: row.roleName,
			isPrimary: row.isPrimary === 1,
			assignedAt: row.assignedAt
		}));
	}

	async hasParticipant(
		organisationId: string,
		opportunityId: string,
		partyId: string,
		roleTypeId: number
	): Promise<boolean> {
		const row = await this.db
			.selectFrom('opportunity_parties')
			.select('party_id')
			.where('organisation_id', '=', organisationId)
			.where('opportunity_id', '=', opportunityId)
			.where('party_id', '=', partyId)
			.where('opportunity_party_role_type_id', '=', roleTypeId)
			.executeTakeFirst();
		return Boolean(row);
	}

	async insertParticipant(input: {
		organisationId: string;
		opportunityId: string;
		partyId: string;
		roleTypeId: number;
		isPrimary: boolean;
	}): Promise<void> {
		await this.db
			.insertInto('opportunity_parties')
			.values({
				organisation_id: input.organisationId,
				opportunity_id: input.opportunityId,
				party_id: input.partyId,
				opportunity_party_role_type_id: input.roleTypeId,
				is_primary: input.isPrimary ? 1 : 0
			})
			.executeTakeFirstOrThrow();
	}

	async clearPrimaryParticipant(organisationId: string, opportunityId: string): Promise<void> {
		await this.db
			.updateTable('opportunity_parties')
			.set({ is_primary: 0 })
			.where('organisation_id', '=', organisationId)
			.where('opportunity_id', '=', opportunityId)
			.where('is_primary', '=', 1)
			.execute();
	}

	async markParticipantPrimary(input: {
		organisationId: string;
		opportunityId: string;
		partyId: string;
		roleTypeId: number;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('opportunity_parties')
			.set({ is_primary: 1 })
			.where('organisation_id', '=', input.organisationId)
			.where('opportunity_id', '=', input.opportunityId)
			.where('party_id', '=', input.partyId)
			.where('opportunity_party_role_type_id', '=', input.roleTypeId)
			.executeTakeFirst();
		return result.numUpdatedRows > 0n;
	}

	async deleteParticipant(input: {
		organisationId: string;
		opportunityId: string;
		partyId: string;
		roleTypeId: number;
	}): Promise<boolean> {
		const result = await this.db
			.deleteFrom('opportunity_parties')
			.where('organisation_id', '=', input.organisationId)
			.where('opportunity_id', '=', input.opportunityId)
			.where('party_id', '=', input.partyId)
			.where('opportunity_party_role_type_id', '=', input.roleTypeId)
			.where('is_primary', '=', 0)
			.executeTakeFirst();
		return result.numDeletedRows > 0n;
	}

	async insertActivity(input: {
		organisationId: string;
		publicId: string;
		activityTypeId: number;
		opportunityId: string;
		createdByMemberId: string;
		subject: string;
		body: string | null;
		direction: ActivityDirection;
		occurredAt: Date;
	}): Promise<string> {
		const result = await this.db
			.insertInto('crm_activities')
			.values({
				organisation_id: input.organisationId,
				public_id: input.publicId,
				crm_activity_type_id: input.activityTypeId,
				opportunity_id: input.opportunityId,
				created_by_member_id: input.createdByMemberId,
				subject: input.subject,
				body: input.body,
				direction: input.direction,
				occurred_at: input.occurredAt
			})
			.executeTakeFirstOrThrow();
		return insertedId(result);
	}

	async insertActivityParty(input: {
		organisationId: string;
		activityId: string;
		partyId: string;
		participantRole: 'regarding' | 'participant' | 'sender' | 'recipient';
	}): Promise<void> {
		await this.db
			.insertInto('crm_activity_parties')
			.values({
				organisation_id: input.organisationId,
				crm_activity_id: input.activityId,
				party_id: input.partyId,
				participant_role: input.participantRole
			})
			.executeTakeFirstOrThrow();
	}

	async insertActivityMember(input: {
		organisationId: string;
		activityId: string;
		organisationMemberId: string;
		participantRole: 'owner' | 'participant' | 'organiser';
	}): Promise<void> {
		await this.db
			.insertInto('crm_activity_members')
			.values({
				organisation_id: input.organisationId,
				crm_activity_id: input.activityId,
				organisation_member_id: input.organisationMemberId,
				participant_role: input.participantRole
			})
			.executeTakeFirstOrThrow();
	}

	async listActivities(
		organisationId: string,
		opportunityId: string
	): Promise<CrmActivityTimelineItem[]> {
		const rows = await this.db
			.selectFrom('crm_activities as activity')
			.innerJoin('crm_activity_types as type', 'type.id', 'activity.crm_activity_type_id')
			.innerJoin('organisation_members as creatorMember', (join) =>
				join
					.onRef('creatorMember.id', '=', 'activity.created_by_member_id')
					.onRef('creatorMember.organisation_id', '=', 'activity.organisation_id')
			)
			.innerJoin('users as creatorUser', 'creatorUser.id', 'creatorMember.user_id')
			.select([
				'activity.id as id',
				'activity.public_id as publicId',
				'type.code as typeCode',
				'type.name as typeName',
				'activity.subject as subject',
				'activity.body as body',
				'activity.direction as direction',
				'activity.occurred_at as occurredAt',
				'creatorUser.display_name as createdByDisplayName'
			])
			.where('activity.organisation_id', '=', organisationId)
			.where('activity.opportunity_id', '=', opportunityId)
			.orderBy('activity.occurred_at', 'desc')
			.orderBy('activity.id', 'desc')
			.limit(250)
			.execute();
		if (rows.length === 0) return [];

		const partyRows = await this.db
			.selectFrom('crm_activity_parties as participant')
			.innerJoin('parties as party', (join) =>
				join
					.onRef('party.id', '=', 'participant.party_id')
					.onRef('party.organisation_id', '=', 'participant.organisation_id')
			)
			.leftJoin('party_persons as person', (join) =>
				join
					.onRef('person.party_id', '=', 'party.id')
					.onRef('person.organisation_id', '=', 'party.organisation_id')
			)
			.leftJoin('party_organisations as company', (join) =>
				join
					.onRef('company.party_id', '=', 'party.id')
					.onRef('company.organisation_id', '=', 'party.organisation_id')
			)
			.select([
				'participant.crm_activity_id as activityId',
				'participant.participant_role as participantRole',
				'party.public_id as partyPublicId',
				'party.party_kind as partyKind',
				'person.preferred_name as preferredName',
				'person.given_names as givenNames',
				'person.family_name as familyName',
				'company.legal_name as legalName',
				'company.trading_name as tradingName'
			])
			.where('participant.organisation_id', '=', organisationId)
			.where(
				'participant.crm_activity_id',
				'in',
				rows.map((row) => row.id)
			)
			.orderBy('participant.participant_role', 'asc')
			.execute();
		const partiesByActivity = new Map<string, CrmActivityPartyParticipant[]>();
		for (const row of partyRows) {
			const list = partiesByActivity.get(row.activityId) ?? [];
			list.push({
				partyPublicId: row.partyPublicId,
				displayName: partyDisplayName({
					kind: row.partyKind,
					preferredName: row.preferredName,
					givenNames: row.givenNames,
					familyName: row.familyName,
					legalName: row.legalName,
					tradingName: row.tradingName
				}),
				participantRole: row.participantRole
			});
			partiesByActivity.set(row.activityId, list);
		}

		return rows.map((row) => ({
			id: row.id,
			publicId: row.publicId,
			typeCode: row.typeCode,
			typeName: row.typeName,
			subject: row.subject,
			body: row.body,
			direction: activityDirection(row.direction),
			occurredAt: row.occurredAt,
			createdByDisplayName: row.createdByDisplayName,
			parties: partiesByActivity.get(row.id) ?? []
		}));
	}
}
