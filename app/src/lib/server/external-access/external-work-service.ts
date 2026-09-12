import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';
import { ExternalAccessDeniedError } from './external-access-service';

export type ExternalWorkItemSummary = {
	publicId: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	domainKey: string;
	sourceType: string;
	sourcePublicId: string;
	actionType: string;
	title: string;
	summary: string | null;
	state: string;
	dueAt: Date | null;
	completedAt: Date | null;
	href: string | null;
};

function workHref(row: { domainKey: string; actionType: string; publicId: string }): string | null {
	if (row.domainKey === 'procurement' && row.actionType === 'submit_quote') {
		return `/portal/supplier-quotes/${encodeURIComponent(row.publicId)}`;
	}
	if (
		row.domainKey === 'information' &&
		['respond_rfi', 'review_submittal', 'acknowledge_instruction'].includes(row.actionType)
	) {
		return `/portal/project-actions/${encodeURIComponent(row.publicId)}`;
	}
	return null;
}

export class ExternalWorkService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date()
	) {}

	async listForAuthUser(
		authUserId: string,
		options: { includeCompleted?: boolean } = {}
	): Promise<ExternalWorkItemSummary[]> {
		let query = this.db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.innerJoin('organisations as owner', 'owner.id', 'work.owning_organisation_id')
			.select([
				'work.public_id as publicId',
				'work.owning_organisation_id as owningOrganisationId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'work.domain_key as domainKey',
				'work.source_type as sourceType',
				'work.source_public_id as sourcePublicId',
				'work.action_type as actionType',
				'work.title as title',
				'work.summary as summary',
				'work.state as state',
				'work.due_at as dueAt',
				'work.completed_at as completedAt'
			])
			.where('work.auth_user_id', '=', authUserId)
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', this.now())
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', this.now())])
			);
		if (!options.includeCompleted) query = query.where('work.state', '=', 'open');
		else query = query.where('work.state', 'in', ['open', 'completed']);
		const rows = await query
			.orderBy('work.state', 'asc')
			.orderBy('work.due_at', 'asc')
			.orderBy('work.created_at', 'desc')
			.execute();
		return rows.map((row) => ({
			publicId: row.publicId,
			owningOrganisationId: row.owningOrganisationId,
			owningOrganisationName: row.ownerTradingName?.trim() || row.ownerLegalName,
			domainKey: row.domainKey,
			sourceType: row.sourceType,
			sourcePublicId: row.sourcePublicId,
			actionType: row.actionType,
			title: row.title,
			summary: row.summary,
			state: row.state,
			dueAt: row.dueAt,
			completedAt: row.completedAt,
			href: workHref(row)
		}));
	}

	async findAuthorisedForUpdate(
		db: DatabaseExecutor,
		authUserId: string,
		workItemPublicId: string,
		expected: { domainKey: string; actionType: string }
	) {
		const row = await db
			.selectFrom('external_work_items as work')
			.innerJoin('external_access_grants as grant', 'grant.id', 'work.external_access_grant_id')
			.select([
				'work.id as id',
				'work.public_id as publicId',
				'work.owning_organisation_id as owningOrganisationId',
				'work.external_access_grant_id as grantId',
				'work.domain_key as domainKey',
				'work.source_type as sourceType',
				'work.source_public_id as sourcePublicId',
				'work.action_type as actionType',
				'work.state as state',
				'grant.invitation_id as invitationId',
				'grant.capability_key as capabilityKey',
				'grant.resource_type as resourceType',
				'grant.resource_public_id as resourcePublicId'
			])
			.where('work.public_id', '=', workItemPublicId)
			.where('work.auth_user_id', '=', authUserId)
			.where('work.domain_key', '=', expected.domainKey)
			.where('work.action_type', '=', expected.actionType)
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', this.now())
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', this.now())])
			)
			.forUpdate()
			.executeTakeFirst();
		if (!row) throw new ExternalAccessDeniedError();
		return row;
	}

	async markCompleted(
		db: DatabaseExecutor,
		workItemId: string,
		completedAt: Date = this.now()
	): Promise<void> {
		const result = await db
			.updateTable('external_work_items')
			.set({ state: 'completed', completed_at: completedAt, cancelled_at: null })
			.where('id', '=', workItemId)
			.where('state', '=', 'open')
			.executeTakeFirst();
		if (result.numUpdatedRows !== 1n) {
			throw new ExternalAccessDeniedError('This external action has already been completed.');
		}
	}
}
