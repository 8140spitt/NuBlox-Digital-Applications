import type { Database } from '$lib/server/db/database';
import { getDatabase } from '$lib/server/db/database';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from './membership-repository';
import { OrganisationRepository, type OrganisationSummary } from './organisation-repository';

export class OrganisationService {
	constructor(private readonly db: Database = getDatabase()) {}

	async getCurrentOrganisation(actor: TenantActorContext): Promise<OrganisationSummary> {
		const membershipRepository = new OrganisationMembershipRepository(this.db);
		const organisationRepository = new OrganisationRepository(this.db);

		const membership = await membershipRepository.findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();

		const organisation = await organisationRepository.findActiveById(actor.organisationId);
		if (!organisation) throw new TenantAccessError('The requested organisation is not active.');

		return organisation;
	}
}
