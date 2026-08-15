import type { DatabaseExecutor } from '$lib/server/db/executor';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';

export type ActiveOrganisationMembership = {
	id: string;
	organisationId: string;
	organisationPublicId?: string;
	userId: string;
	publicId: string;
	status: 'active';
};

export class OrganisationMembershipRepository {
	constructor(private readonly db: DatabaseExecutor) {}

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

	/** Resolve a browser-selected organisation only after proving active membership. */
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

		return {
			id: row.id,
			organisationId: row.organisationId,
			organisationPublicId: row.organisationPublicId,
			userId: row.userId,
			publicId: row.publicId,
			status: 'active'
		};
	}
}
