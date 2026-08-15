import type { DatabaseExecutor } from '$lib/server/db/executor';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';

export type ActiveOrganisationMembership = {
	id: string;
	organisationId: string;
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
}
