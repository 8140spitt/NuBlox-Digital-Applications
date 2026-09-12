import { getDatabase, type Database } from '$lib/server/db/database';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export class ExternalAccessDeniedError extends Error {
	readonly code = 'EXTERNAL_ACCESS_DENIED';

	constructor(message = 'This external action is not authorised.') {
		super(message);
		this.name = 'ExternalAccessDeniedError';
	}
}

export type ExternalGrantSummary = {
	publicId: string;
	owningOrganisationId: string;
	owningOrganisationName: string;
	contextType: string;
	contextPublicId: string;
	resourceType: string;
	resourcePublicId: string;
	capabilityKey: string;
	validFrom: Date;
	validUntil: Date | null;
};

export class ExternalAccessService {
	constructor(
		private readonly db: Database = getDatabase(),
		private readonly now: () => Date = () => new Date()
	) {}

	private activeGrantQuery(db: DatabaseExecutor, authUserId: string) {
		return db
			.selectFrom('external_access_grants as grant')
			.where('grant.auth_user_id', '=', authUserId)
			.where('grant.revoked_at', 'is', null)
			.where('grant.valid_from', '<=', this.now())
			.where((eb) =>
				eb.or([eb('grant.valid_until', 'is', null), eb('grant.valid_until', '>', this.now())])
			);
	}

	async hasActiveAccess(authUserId: string): Promise<boolean> {
		const row = await this.activeGrantQuery(this.db, authUserId)
			.select('grant.id')
			.executeTakeFirst();
		return Boolean(row);
	}

	async listActiveGrants(authUserId: string): Promise<ExternalGrantSummary[]> {
		const rows = await this.activeGrantQuery(this.db, authUserId)
			.innerJoin('organisations as owner', 'owner.id', 'grant.owning_organisation_id')
			.select([
				'grant.public_id as publicId',
				'grant.owning_organisation_id as owningOrganisationId',
				'owner.legal_name as ownerLegalName',
				'owner.trading_name as ownerTradingName',
				'grant.context_type as contextType',
				'grant.context_public_id as contextPublicId',
				'grant.resource_type as resourceType',
				'grant.resource_public_id as resourcePublicId',
				'grant.capability_key as capabilityKey',
				'grant.valid_from as validFrom',
				'grant.valid_until as validUntil'
			])
			.orderBy('grant.created_at', 'desc')
			.execute();
		return rows.map((row) => ({
			publicId: row.publicId,
			owningOrganisationId: row.owningOrganisationId,
			owningOrganisationName: row.ownerTradingName?.trim() || row.ownerLegalName,
			contextType: row.contextType,
			contextPublicId: row.contextPublicId,
			resourceType: row.resourceType,
			resourcePublicId: row.resourcePublicId,
			capabilityKey: row.capabilityKey,
			validFrom: row.validFrom,
			validUntil: row.validUntil
		}));
	}

	async assertCapability(
		authUserId: string,
		capabilityKey: string,
		options: { resourceType?: string; resourcePublicId?: string } = {},
		db: DatabaseExecutor = this.db
	): Promise<{ id: string; publicId: string; owningOrganisationId: string }> {
		let query = this.activeGrantQuery(db, authUserId)
			.select([
				'grant.id as id',
				'grant.public_id as publicId',
				'grant.owning_organisation_id as owningOrganisationId'
			])
			.where('grant.capability_key', '=', capabilityKey);
		if (options.resourceType) query = query.where('grant.resource_type', '=', options.resourceType);
		if (options.resourcePublicId)
			query = query.where('grant.resource_public_id', '=', options.resourcePublicId);
		const grant = await query.executeTakeFirst();
		if (!grant) throw new ExternalAccessDeniedError();
		return grant;
	}
}
