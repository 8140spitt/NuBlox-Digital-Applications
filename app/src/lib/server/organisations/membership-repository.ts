import type { DatabaseExecutor } from '$lib/server/db/executor';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { allocateOrganisationRouteSlug } from '$lib/server/routing/route-context-service';

export type ActiveOrganisationMembership = {
	id: string;
	organisationId: string;
	organisationPublicId?: string;
	organisationRouteSlug?: string;
	userId: string;
	publicId: string;
	status: 'active';
};

export type OrganisationMembershipChoice = {
	memberId: string;
	memberPublicId: string;
	organisationId: string;
	organisationPublicId: string;
	organisationRouteSlug: string;
	organisationName: string;
};

export class OrganisationMembershipRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	private async ensureRouteSlug(input: {
		organisationId: string;
		current: string | null;
		legalName: string;
		tradingName: string | null;
	}): Promise<string> {
		if (input.current) return input.current;
		const routeSlug = await allocateOrganisationRouteSlug(
			this.db,
			input.tradingName?.trim() || input.legalName
		);
		await this.db
			.updateTable('organisations')
			.set({ route_slug: routeSlug })
			.where('id', '=', input.organisationId)
			.where('route_slug', 'is', null)
			.executeTakeFirst();
		const current = await this.db
			.selectFrom('organisations')
			.select('route_slug as routeSlug')
			.where('id', '=', input.organisationId)
			.executeTakeFirstOrThrow();
		if (!current.routeSlug) throw new Error('Organisation route slug could not be allocated.');
		return current.routeSlug;
	}

	/**
	 * Verify the full tenant/user/member tuple. Never resolve a membership by its
	 * surrogate ID alone when it is being used as an authorisation boundary.
	 */
	async findActiveActorMembership(
		actor: Pick<TenantActorContext, 'organisationId' | 'userId' | 'memberId'>
	): Promise<ActiveOrganisationMembership | null> {
		const row = await this.db
			.selectFrom('organisation_members')
			.select(['id', 'organisation_id', 'user_id', 'public_id', 'status'])
			.where('id', '=', actor.memberId)
			.where('organisation_id', '=', actor.organisationId)
			.where('user_id', '=', actor.userId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (!row) return null;
		return {
			id: row.id,
			organisationId: row.organisation_id,
			userId: row.user_id,
			publicId: row.public_id,
			status: 'active'
		};
	}

	async findActiveMembershipByOrganisationPublicId(
		userId: string,
		organisationPublicId: string
	): Promise<ActiveOrganisationMembership | null> {
		const row = await this.db
			.selectFrom('organisation_members as member')
			.innerJoin('organisations as organisation', 'organisation.id', 'member.organisation_id')
			.select([
				'member.id as id',
				'member.organisation_id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.route_slug as organisationRouteSlug',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName',
				'member.user_id as userId',
				'member.public_id as publicId',
				'member.status as status'
			])
			.where('member.user_id', '=', userId)
			.where('member.status', '=', 'active')
			.where('organisation.public_id', '=', organisationPublicId)
			.where('organisation.status', '=', 'active')
			.executeTakeFirst();
		if (!row || row.status !== 'active') return null;
		const routeSlug = await this.ensureRouteSlug({
			organisationId: row.organisationId,
			current: row.organisationRouteSlug,
			legalName: row.legalName,
			tradingName: row.tradingName
		});
		return {
			id: row.id,
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			organisationRouteSlug: routeSlug,
			userId: row.userId,
			publicId: row.publicId,
			status: 'active'
		};
	}

	async findActiveMembershipByOrganisationRouteSlug(
		userId: string,
		organisationRouteSlug: string
	): Promise<ActiveOrganisationMembership | null> {
		const row = await this.db
			.selectFrom('organisation_members as member')
			.innerJoin('organisations as organisation', 'organisation.id', 'member.organisation_id')
			.select([
				'member.id as id',
				'member.organisation_id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.route_slug as organisationRouteSlug',
				'member.user_id as userId',
				'member.public_id as publicId',
				'member.status as status'
			])
			.where('member.user_id', '=', userId)
			.where('member.status', '=', 'active')
			.where('organisation.route_slug', '=', organisationRouteSlug)
			.where('organisation.status', '=', 'active')
			.executeTakeFirst();
		if (!row || row.status !== 'active' || !row.organisationRouteSlug) return null;
		return {
			id: row.id,
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			organisationRouteSlug: row.organisationRouteSlug,
			userId: row.userId,
			publicId: row.publicId,
			status: 'active'
		};
	}

	async listActiveMembershipsForUser(userId: string): Promise<OrganisationMembershipChoice[]> {
		const rows = await this.db
			.selectFrom('organisation_members as member')
			.innerJoin('organisations as organisation', 'organisation.id', 'member.organisation_id')
			.select([
				'member.id as memberId',
				'member.public_id as memberPublicId',
				'member.organisation_id as organisationId',
				'organisation.public_id as organisationPublicId',
				'organisation.route_slug as organisationRouteSlug',
				'organisation.legal_name as legalName',
				'organisation.trading_name as tradingName'
			])
			.where('member.user_id', '=', userId)
			.where('member.status', '=', 'active')
			.where('organisation.status', '=', 'active')
			.orderBy('organisation.legal_name', 'asc')
			.execute();
		const choices: OrganisationMembershipChoice[] = [];
		for (const row of rows) {
			const routeSlug = await this.ensureRouteSlug({
				organisationId: row.organisationId,
				current: row.organisationRouteSlug,
				legalName: row.legalName,
				tradingName: row.tradingName
			});
			choices.push({
				memberId: row.memberId,
				memberPublicId: row.memberPublicId,
				organisationId: row.organisationId,
				organisationPublicId: row.organisationPublicId,
				organisationRouteSlug: routeSlug,
				organisationName: row.tradingName?.trim() || row.legalName
			});
		}
		return choices;
	}
}
