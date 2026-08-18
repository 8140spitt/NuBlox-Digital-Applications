import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase, type Database } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ContractAccessPolicy } from './contract-common';

export type AcceptedQuotationContractEntry = {
	quotationPublicId: string;
	quotationNumber: string;
	quotationTitle: string;
	versionNumber: number;
	customerDisplayName: string;
	acceptedAt: Date;
};

export type AcceptedQuotationContractQueue = {
	canConvertAcceptedQuotation: boolean;
	acceptedQuotationsAwaitingProject: AcceptedQuotationContractEntry[];
};

export class ContractEntryService {
	private readonly policy: ContractAccessPolicy;

	constructor(private readonly db: Database = getDatabase()) {
		this.policy = new ContractAccessPolicy(db);
	}

	async listAcceptedQuotationQueue(
		actor: TenantActorContext
	): Promise<AcceptedQuotationContractQueue> {
		const membership = await new OrganisationMembershipRepository(
			this.db
		).findActiveActorMembership(actor);
		if (!membership) throw new TenantAccessError();

		const permissions = new PermissionService(this.db);
		const [commercialConvert, projectCreate, projectView, contractCreate] = await Promise.all([
			permissions.decideWithUmbrella(actor, 'commercial.quotation.convert', 'commercial.manage'),
			permissions.decide(actor, 'project.create'),
			permissions.decide(actor, 'project.view'),
			this.policy.mutationDecision(actor, 'contract.create')
		]);
		const canConvertAcceptedQuotation =
			commercialConvert.allowed &&
			projectCreate.allowed &&
			projectView.allowed &&
			contractCreate.allowed;

		const acceptedQuotationsAwaitingProject = await this.db
			.selectFrom('quotation_responses as response')
			.innerJoin('quotation_versions as version', (join) =>
				join
					.onRef('version.id', '=', 'response.quotation_version_id')
					.onRef('version.organisation_id', '=', 'response.organisation_id')
			)
			.innerJoin('quotations as quotation', (join) =>
				join
					.onRef('quotation.id', '=', 'response.quotation_id')
					.onRef('quotation.organisation_id', '=', 'response.organisation_id')
			)
			.leftJoin('quotation_party_snapshots as customer_snapshot', (join) =>
				join
					.onRef('customer_snapshot.quotation_version_id', '=', 'version.id')
					.onRef('customer_snapshot.organisation_id', '=', 'version.organisation_id')
					.on('customer_snapshot.snapshot_role', '=', 'customer')
					.on('customer_snapshot.sort_order', '=', 1)
			)
			.leftJoin('quotation_project_conversions as conversion', (join) =>
				join
					.onRef('conversion.quotation_response_id', '=', 'response.id')
					.onRef('conversion.organisation_id', '=', 'response.organisation_id')
			)
			.select([
				'quotation.public_id as quotationPublicId',
				'quotation.quotation_number as quotationNumber',
				'version.title as quotationTitle',
				'version.version_number as versionNumber',
				'customer_snapshot.display_name as customerDisplayName',
				'response.responded_at as acceptedAt'
			])
			.where('response.organisation_id', '=', actor.organisationId)
			.where('response.response_type', '=', 'accepted')
			.where('version.version_status', '=', 'issued')
			.where('version.locked_at', 'is not', null)
			.where('quotation.lifecycle_status', '=', 'active')
			.where('quotation.project_id', 'is', null)
			.where('conversion.id', 'is', null)
			.orderBy('response.responded_at', 'desc')
			.execute();

		return {
			canConvertAcceptedQuotation,
			acceptedQuotationsAwaitingProject: acceptedQuotationsAwaitingProject.map((row) => ({
				...row,
				customerDisplayName: row.customerDisplayName ?? 'Customer'
			}))
		};
	}
}
