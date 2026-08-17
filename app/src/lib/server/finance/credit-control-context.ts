import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase, type Database } from '$lib/server/db/database';
import { RecordNotFoundError } from '$lib/server/kernel/errors';
import { CreditControlService, type CreditCommitmentPreview } from './credit-control-service';

export async function contractCreditControlPreview(
	actor: TenantActorContext,
	contractPublicIdInput: string,
	db: Database = getDatabase()
): Promise<CreditCommitmentPreview | null> {
	const contractPublicId = contractPublicIdInput.trim();
	if (!contractPublicId || contractPublicId.length > 64) throw new RecordNotFoundError('Contract not found.');
	const contract = await db
		.selectFrom('contracts')
		.select(['id', 'currency_code as currencyCode'])
		.where('organisation_id', '=', actor.organisationId)
		.where('public_id', '=', contractPublicId)
		.executeTakeFirst();
	if (!contract) throw new RecordNotFoundError('Contract not found.');
	const version = await db
		.selectFrom('contract_versions')
		.select('id')
		.where('organisation_id', '=', actor.organisationId)
		.where('contract_id', '=', contract.id)
		.orderBy('version_number', 'desc')
		.executeTakeFirst();
	if (!version) return null;
	const clientParty = await db
		.selectFrom('contract_version_parties as party')
		.innerJoin('contract_party_role_types as role', 'role.id', 'party.contract_party_role_type_id')
		.select('party.source_party_id as sourcePartyId')
		.where('party.organisation_id', '=', actor.organisationId)
		.where('party.contract_version_id', '=', version.id)
		.where('role.code', '=', 'client')
		.orderBy('party.sort_order')
		.executeTakeFirst();
	if (!clientParty?.sourcePartyId) return null;
	return new CreditControlService(db).commitmentPreview(actor, clientParty.sourcePartyId, contract.currencyCode);
}
