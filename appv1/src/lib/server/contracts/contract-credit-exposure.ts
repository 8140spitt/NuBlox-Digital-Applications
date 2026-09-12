import { sumMoney } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export async function contractVersionCommitmentAmount(
	db: DatabaseExecutor,
	organisationId: string,
	contractVersionId: string
): Promise<string> {
	const rows = await db
		.selectFrom('contract_version_value_components')
		.select('amount')
		.where('organisation_id', '=', organisationId)
		.where('contract_version_id', '=', contractVersionId)
		.orderBy('sort_order', 'asc')
		.execute();
	return sumMoney(rows.map((row) => row.amount));
}
