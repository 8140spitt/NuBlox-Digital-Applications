import { randomUUID } from 'node:crypto';

import { AuditRepository } from '$lib/server/audit/audit-repository';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { CrmRepository, type CrmPartySummary } from './crm-repository';
import {
	CrmOpportunityRepository,
	type ActivityDirection,
	type CrmActivityTimelineItem,
	type CrmActivityType,
	type CrmOpportunityParticipant,
	type CrmOpportunitySummary,
	type CrmPipelineOption,
	type OpportunityPartyRoleType,
	type OpportunityStatus
} from './crm-opportunity-repository';

const OPPORTUNITY_CUSTOMER_ROLE_CODES = new Set(['prospect', 'client']);

export type OpportunityListFilters = {
	search?: string;
	status?: OpportunityStatus;
};

export type OpportunityInput = {
	title: string;
	description?: string | null;
	pipelinePublicId: string;
	stageName: string;
	estimatedValue?: string | null;
	currencyCode?: string | null;
	expectedCloseDate?: string | null;
	primaryPartyPublicId: string;
};

export type OpportunityUpdateInput = OpportunityInput & {
	opportunityPublicId: string;
	status: OpportunityStatus;
};

export type ActivityInput = {
	opportunityPublicId: string;
	activityTypeCode: string;
	subject: string;
	body?: string | null;
	direction?: ActivityDirection;
	partyPublicIds?: readonly string[];
};

export type OpportunityPortfolioWorkspace = {
	canView: boolean;
	canManageOpportunities: boolean;
	canManageActivities: boolean;
	opportunities: CrmOpportunitySummary[];
	pipelines: CrmPipelineOption[];
	partyCandidates: CrmPartySummary[];
	filters: OpportunityListFilters;
};

export type OpportunityWorkspace = {
	opportunity: CrmOpportunitySummary;
	canManageOpportunities: boolean;
	canManageActivities: boolean;
	pipelines: CrmPipelineOption[];
	participants: CrmOpportunityParticipant[];
	partyRoleTypes: OpportunityPartyRoleType[];
	activityTypes: CrmActivityType[];
	activities: CrmActivityTimelineItem[];
	partyCandidates: CrmPartySummary[];
};

export class CrmOpportunityValidationError extends Error {
	readonly code = 'CRM_OPPORTUNITY_VALIDATION';
	constructor(message: string) {
		super(message);
		this.name = 'CrmOpportunityValidationError';
	}
}

type ValidatedOpportunityInput = {
	title: string;
	description: string | null;
	pipelinePublicId: string;
	stageName: string;
	estimatedValue: string | null;
	currencyCode: string;
	expectedCloseDate: Date | null;
	primaryPartyPublicId: string;
};

function requiredText(value: string, maxLength: number, label: string): string {
	const text = value.trim();
	if (!text || text.length > maxLength) {
		throw new CrmOpportunityValidationError(
			`${label} must be between 1 and ${maxLength} characters.`
		);
	}
	return text;
}

function optionalText(
	value: string | null | undefined,
	maxLength: number,
	label: string
): string | null {
	const text = value?.trim() ?? '';
	if (!text) return null;
	if (text.length > maxLength) {
		throw new CrmOpportunityValidationError(`${label} must not exceed ${maxLength} characters.`);
	}
	return text;
}

function publicId(value: string, label: string): string {
	const result = value.trim();
	if (!result || result.length > 64)
		throw new CrmOpportunityValidationError(`${label} is required.`);
	return result;
}

function roleCode(value: string): string {
	const result = value.trim();
	if (!/^[a-z0-9_]{1,64}$/.test(result)) {
		throw new CrmOpportunityValidationError('Opportunity participant role is invalid.');
	}
	return result;
}

function activityTypeCode(value: string): string {
	const result = value.trim();
	if (!/^[a-z0-9_]{1,64}$/.test(result)) {
		throw new CrmOpportunityValidationError('CRM activity type is invalid.');
	}
	return result;
}

function estimatedValue(value: string | null | undefined): string | null {
	const result = value?.trim() ?? '';
	if (!result) return null;
	if (!/^\d{1,15}(\.\d{1,4})?$/.test(result)) {
		throw new CrmOpportunityValidationError(
			'Estimated value must be a non-negative amount with at most four decimal places.'
		);
	}
	return result;
}

function currencyCode(value: string | null | undefined): string {
	const result = (value?.trim() || 'GBP').toUpperCase();
	if (!/^[A-Z]{3}$/.test(result)) {
		throw new CrmOpportunityValidationError('Currency code must be a three-letter ISO code.');
	}
	return result;
}

function dateValue(value: string | null | undefined, label: string): Date | null {
	const result = value?.trim() ?? '';
	if (!result) return null;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
		throw new CrmOpportunityValidationError(`${label} must be a valid date.`);
	}
	const date = new Date(`${result}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== result) {
		throw new CrmOpportunityValidationError(`${label} must be a valid date.`);
	}
	return date;
}

function statusValue(value: string): OpportunityStatus {
	if (value === 'open' || value === 'won' || value === 'lost' || value === 'cancelled')
		return value;
	throw new CrmOpportunityValidationError('Opportunity status is invalid.');
}

function directionValue(value: ActivityDirection | undefined): ActivityDirection {
	if (
		value === undefined ||
		value === null ||
		value === 'inbound' ||
		value === 'outbound' ||
		value === 'internal'
	) {
		return value ?? null;
	}
	throw new CrmOpportunityValidationError('CRM activity direction is invalid.');
}

function isOpportunityCustomerParty(party: CrmPartySummary): boolean {
	return (
		party.status === 'active' &&
		party.kind === 'organisation' &&
		party.roles.some((role) => OPPORTUNITY_CUSTOMER_ROLE_CODES.has(role.code))
	);
}

function validateOpportunity(input: OpportunityInput): ValidatedOpportunityInput {
	return {
		title: requiredText(input.title, 255, 'Opportunity title'),
		description: optionalText(input.description, 10_000, 'Opportunity description'),
		pipelinePublicId: publicId(input.pipelinePublicId, 'Pipeline'),
		stageName: requiredText(input.stageName, 160, 'Pipeline stage'),
		estimatedValue: estimatedValue(input.estimatedValue),
		currencyCode: currencyCode(input.currencyCode),
		expectedCloseDate: dateValue(input.expectedCloseDate, 'Expected close date'),
		primaryPartyPublicId: publicId(input.primaryPartyPublicId, 'Primary customer')
	};
}

export class CrmOpportunityService {
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

	private async assertOpportunityManage(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'crm.opportunity.manage',
			'crm.manage'
		);
		if (!decision.allowed)
			throw new TenantAccessError('CRM opportunity management is not permitted.');
	}

	private async assertActivityManage(
		actor: TenantActorContext,
		db: DatabaseExecutor = this.db
	): Promise<void> {
		const decision = await new PermissionService(db).decideWithUmbrella(
			actor,
			'crm.activity.manage',
			'crm.manage'
		);
		if (!decision.allowed) throw new TenantAccessError('CRM activity management is not permitted.');
	}

	private async requireView(actor: TenantActorContext): Promise<void> {
		await this.assertActiveActor(actor);
		const decision = await new PermissionService(this.db).decide(actor, 'crm.view');
		if (!decision.allowed) throw new TenantAccessError('CRM viewing is not permitted.');
	}

	private async activeParty(
		actor: TenantActorContext,
		partyPublicId: string,
		db: DatabaseExecutor
	) {
		const party = await new CrmRepository(db).findPartyByPublicId(
			actor.organisationId,
			partyPublicId
		);
		if (!party) throw new RecordNotFoundError('CRM party not found.');
		if (party.status === 'archived') {
			throw new CrmOpportunityValidationError(
				'Archived CRM parties cannot be added to opportunities or activities.'
			);
		}
		return party;
	}

	private async activeCustomerParty(
		actor: TenantActorContext,
		partyPublicId: string,
		db: DatabaseExecutor
	) {
		const party = await this.activeParty(actor, partyPublicId, db);
		if (!isOpportunityCustomerParty(party)) {
			throw new CrmOpportunityValidationError(
				'Primary customer must be an active CRM organisation classified as a prospect or client.'
			);
		}
		return party;
	}

	async listWorkspace(
		actor: TenantActorContext,
		filters: OpportunityListFilters = {}
	): Promise<OpportunityPortfolioWorkspace> {
		await this.assertActiveActor(actor);
		const permissions = new PermissionService(this.db);
		const [viewDecision, opportunityDecision, activityDecision] = await Promise.all([
			permissions.decide(actor, 'crm.view'),
			permissions.decideWithUmbrella(actor, 'crm.opportunity.manage', 'crm.manage'),
			permissions.decideWithUmbrella(actor, 'crm.activity.manage', 'crm.manage')
		]);
		const canView = viewDecision.allowed;
		const repository = new CrmOpportunityRepository(this.db);
		const [opportunities, pipelines, parties] = canView
			? await Promise.all([
					repository.listOpportunities(actor.organisationId, filters),
					repository.listPipelines(actor.organisationId),
					new CrmRepository(this.db).listParties(actor.organisationId, { status: 'active' })
				])
			: [[], [], []];
		return {
			canView,
			canManageOpportunities: opportunityDecision.allowed,
			canManageActivities: activityDecision.allowed,
			opportunities,
			pipelines,
			partyCandidates: parties.filter(isOpportunityCustomerParty),
			filters
		};
	}

	async getWorkspace(
		actor: TenantActorContext,
		opportunityPublicIdInput: string
	): Promise<OpportunityWorkspace> {
		await this.requireView(actor);
		const opportunityPublicId = publicId(opportunityPublicIdInput, 'Opportunity ID');
		const repository = new CrmOpportunityRepository(this.db);
		const opportunity = await repository.findOpportunityByPublicId(
			actor.organisationId,
			opportunityPublicId
		);
		if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
		const permissions = new PermissionService(this.db);
		const [
			opportunityDecision,
			activityDecision,
			pipelines,
			participants,
			partyRoleTypes,
			activityTypes,
			activities,
			partyCandidates
		] = await Promise.all([
			permissions.decideWithUmbrella(actor, 'crm.opportunity.manage', 'crm.manage'),
			permissions.decideWithUmbrella(actor, 'crm.activity.manage', 'crm.manage'),
			repository.listPipelines(actor.organisationId),
			repository.listParticipants(actor.organisationId, opportunity.id),
			repository.listOpportunityPartyRoleTypes(),
			repository.listActivityTypes(),
			repository.listActivities(actor.organisationId, opportunity.id),
			new CrmRepository(this.db).listParties(actor.organisationId, { status: 'active' })
		]);
		return {
			opportunity,
			canManageOpportunities: opportunityDecision.allowed,
			canManageActivities: activityDecision.allowed,
			pipelines,
			participants,
			partyRoleTypes,
			activityTypes,
			activities,
			partyCandidates
		};
	}

	async createOpportunity(
		actor: TenantActorContext,
		input: OpportunityInput
	): Promise<CrmOpportunitySummary> {
		await this.assertActiveActor(actor);
		await this.assertOpportunityManage(actor);
		const validated = validateOpportunity(input);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertOpportunityManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const stage = await repository.resolveStage(
				actor.organisationId,
				validated.pipelinePublicId,
				validated.stageName
			);
			if (!stage)
				throw new CrmOpportunityValidationError('The selected pipeline stage is unavailable.');
			const party = await this.activeCustomerParty(actor, validated.primaryPartyPublicId, trx);
			const customerRoleTypeId = await repository.findOpportunityPartyRoleTypeId('customer');
			if (customerRoleTypeId === null)
				throw new Error('Required opportunity customer role type is missing.');
			const opportunityPublicId = this.publicIdFactory();
			const opportunityId = await repository.insertOpportunity({
				organisationId: actor.organisationId,
				publicId: opportunityPublicId,
				pipelineId: stage.pipelineId,
				stageId: stage.stageId,
				ownerMemberId: membership.id,
				title: validated.title,
				description: validated.description,
				estimatedValue: validated.estimatedValue,
				currencyCode: validated.currencyCode,
				expectedCloseDate: validated.expectedCloseDate
			});
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId,
				partyId: party.id,
				roleTypeId: customerRoleTypeId,
				isPrimary: true
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.created',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					primaryPartyPublicId: party.publicId,
					pipelinePublicId: validated.pipelinePublicId,
					stageName: validated.stageName,
					estimatedValue: validated.estimatedValue,
					currencyCode: validated.currencyCode
				}
			});
			const created = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!created) throw new Error('Created CRM opportunity could not be reloaded.');
			return created;
		});
	}

	async updateOpportunity(
		actor: TenantActorContext,
		input: OpportunityUpdateInput
	): Promise<CrmOpportunitySummary> {
		await this.assertActiveActor(actor);
		await this.assertOpportunityManage(actor);
		const opportunityPublicId = publicId(input.opportunityPublicId, 'Opportunity ID');
		const validated = validateOpportunity(input);
		const status = statusValue(input.status);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertOpportunityManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const current = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!current) throw new RecordNotFoundError('CRM opportunity not found.');
			const stage = await repository.resolveStage(
				actor.organisationId,
				validated.pipelinePublicId,
				validated.stageName
			);
			if (!stage)
				throw new CrmOpportunityValidationError('The selected pipeline stage is unavailable.');
			const primaryParty = await this.activeCustomerParty(
				actor,
				validated.primaryPartyPublicId,
				trx
			);
			const customerRoleTypeId = await repository.findOpportunityPartyRoleTypeId('customer');
			if (customerRoleTypeId === null)
				throw new Error('Required opportunity customer role type is missing.');
			if (
				!(await repository.hasParticipant(
					actor.organisationId,
					current.id,
					primaryParty.id,
					customerRoleTypeId
				))
			) {
				await repository.insertParticipant({
					organisationId: actor.organisationId,
					opportunityId: current.id,
					partyId: primaryParty.id,
					roleTypeId: customerRoleTypeId,
					isPrimary: false
				});
			}
			await repository.clearPrimaryParticipant(actor.organisationId, current.id);
			if (
				!(await repository.markParticipantPrimary({
					organisationId: actor.organisationId,
					opportunityId: current.id,
					partyId: primaryParty.id,
					roleTypeId: customerRoleTypeId
				}))
			) {
				throw new Error('Primary opportunity customer assignment could not be updated.');
			}
			const closedAt =
				status === 'open'
					? null
					: current.status === status && current.closedAt
						? current.closedAt
						: this.now();
			await repository.updateOpportunity({
				organisationId: actor.organisationId,
				opportunityId: current.id,
				pipelineId: stage.pipelineId,
				stageId: stage.stageId,
				title: validated.title,
				description: validated.description,
				estimatedValue: validated.estimatedValue,
				currencyCode: validated.currencyCode,
				expectedCloseDate: validated.expectedCloseDate,
				status,
				closedAt
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.updated',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					status: { from: current.status, to: status },
					stage: { from: current.stageName, to: validated.stageName },
					primaryPartyPublicId: primaryParty.publicId
				}
			});
			const updated = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!updated) throw new Error('Updated CRM opportunity could not be reloaded.');
			return updated;
		});
	}

	async addParticipant(
		actor: TenantActorContext,
		input: { opportunityPublicId: string; partyPublicId: string; roleCode: string }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertOpportunityManage(actor);
		const opportunityPublicId = publicId(input.opportunityPublicId, 'Opportunity ID');
		const partyPublicId = publicId(input.partyPublicId, 'CRM party ID');
		const participantRoleCode = roleCode(input.roleCode);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertOpportunityManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const opportunity = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
			const party = await this.activeParty(actor, partyPublicId, trx);
			const roleTypeId = await repository.findOpportunityPartyRoleTypeId(participantRoleCode);
			if (roleTypeId === null)
				throw new CrmOpportunityValidationError('Opportunity participant role is unavailable.');
			if (
				await repository.hasParticipant(actor.organisationId, opportunity.id, party.id, roleTypeId)
			) {
				throw new CrmOpportunityValidationError('That party already has this opportunity role.');
			}
			await repository.insertParticipant({
				organisationId: actor.organisationId,
				opportunityId: opportunity.id,
				partyId: party.id,
				roleTypeId,
				isPrimary: false
			});
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.participant_added',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: { partyPublicId, roleCode: participantRoleCode }
			});
		});
	}

	async removeParticipant(
		actor: TenantActorContext,
		input: { opportunityPublicId: string; partyPublicId: string; roleCode: string }
	): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertOpportunityManage(actor);
		const opportunityPublicId = publicId(input.opportunityPublicId, 'Opportunity ID');
		const partyPublicId = publicId(input.partyPublicId, 'CRM party ID');
		const participantRoleCode = roleCode(input.roleCode);
		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertOpportunityManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const opportunity = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
			const party = await this.activeParty(actor, partyPublicId, trx);
			const roleTypeId = await repository.findOpportunityPartyRoleTypeId(participantRoleCode);
			if (roleTypeId === null)
				throw new CrmOpportunityValidationError('Opportunity participant role is unavailable.');
			const removed = await repository.deleteParticipant({
				organisationId: actor.organisationId,
				opportunityId: opportunity.id,
				partyId: party.id,
				roleTypeId
			});
			if (!removed) {
				throw new CrmOpportunityValidationError(
					'The primary customer cannot be removed; choose another primary customer first.'
				);
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.opportunity.participant_removed',
				subjectType: 'crm_opportunity',
				subjectPublicId: opportunityPublicId,
				correlationId: actor.correlationId,
				changeSummary: { partyPublicId, roleCode: participantRoleCode }
			});
		});
	}

	async createActivity(actor: TenantActorContext, input: ActivityInput): Promise<void> {
		await this.assertActiveActor(actor);
		await this.assertActivityManage(actor);
		const opportunityPublicId = publicId(input.opportunityPublicId, 'Opportunity ID');
		const typeCode = activityTypeCode(input.activityTypeCode);
		const subject = requiredText(input.subject, 255, 'Activity subject');
		const body = optionalText(input.body, 20_000, 'Activity notes');
		const direction = directionValue(input.direction);
		const requestedPartyIds = [
			...new Set((input.partyPublicIds ?? []).map((value) => publicId(value, 'CRM party ID')))
		];
		if (requestedPartyIds.length > 20)
			throw new CrmOpportunityValidationError('An activity may reference at most 20 CRM parties.');

		return this.db.transaction().execute(async (trx) => {
			const membership = await this.assertActiveActor(actor, trx);
			await this.assertActivityManage(actor, trx);
			const repository = new CrmOpportunityRepository(trx);
			const opportunity = await repository.findOpportunityByPublicId(
				actor.organisationId,
				opportunityPublicId
			);
			if (!opportunity) throw new RecordNotFoundError('CRM opportunity not found.');
			const activityTypeId = await repository.findActivityTypeId(typeCode);
			if (activityTypeId === null)
				throw new CrmOpportunityValidationError('CRM activity type is unavailable.');

			const partyIds =
				requestedPartyIds.length > 0
					? requestedPartyIds
					: opportunity.primaryPartyPublicId
						? [opportunity.primaryPartyPublicId]
						: [];
			const parties = [];
			for (const partyPublicId of partyIds) {
				parties.push(await this.activeParty(actor, partyPublicId, trx));
			}

			const activityPublicId = this.publicIdFactory();
			const activityId = await repository.insertActivity({
				organisationId: actor.organisationId,
				publicId: activityPublicId,
				activityTypeId,
				opportunityId: opportunity.id,
				createdByMemberId: membership.id,
				subject,
				body,
				direction,
				occurredAt: this.now()
			});
			await repository.insertActivityMember({
				organisationId: actor.organisationId,
				activityId,
				organisationMemberId: membership.id,
				participantRole: 'owner'
			});
			for (const party of parties) {
				await repository.insertActivityParty({
					organisationId: actor.organisationId,
					activityId,
					partyId: party.id,
					participantRole:
						party.publicId === opportunity.primaryPartyPublicId ? 'regarding' : 'participant'
				});
			}
			await new AuditRepository(trx).append({
				eventPublicId: this.publicIdFactory(),
				actingOrganisationId: actor.organisationId,
				actorUserId: actor.userId,
				actorMemberId: membership.id,
				actionKey: 'crm.activity.created',
				subjectType: 'crm_activity',
				subjectPublicId: activityPublicId,
				correlationId: actor.correlationId,
				changeSummary: {
					opportunityPublicId,
					activityTypeCode: typeCode,
					direction,
					partyPublicIds: parties.map((party) => party.publicId)
				}
			});
		});
	}
}
