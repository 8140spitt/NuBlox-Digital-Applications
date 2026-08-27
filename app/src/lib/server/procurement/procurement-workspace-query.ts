import type { DatabaseExecutor } from '$lib/server/db/executor';
import type { RfqVersionSummary } from '$lib/server/procurement/procurement-repository';

export function latestRfqVersionsByRfq(
	rows: readonly RfqVersionSummary[]
): Map<string, RfqVersionSummary> {
	const latestByRfq = new Map<string, RfqVersionSummary>();
	for (const row of rows) {
		const current = latestByRfq.get(row.rfqId);
		if (!current || row.versionNumber > current.versionNumber) {
			latestByRfq.set(row.rfqId, row);
		}
	}
	return latestByRfq;
}

export async function listLatestRfqVersionsForRfqs(
	db: DatabaseExecutor,
	organisationId: string,
	rfqIds: readonly string[]
): Promise<Map<string, RfqVersionSummary>> {
	if (rfqIds.length === 0) return new Map();
	const rows = await db
		.selectFrom('rfq_versions')
		.select([
			'id',
			'rfq_id as rfqId',
			'version_number as versionNumber',
			'title',
			'currency_code as currencyCode',
			'response_deadline_at as responseDeadlineAt',
			'version_status as status',
			'locked_at as lockedAt'
		])
		.where('organisation_id', '=', organisationId)
		.where('rfq_id', 'in', rfqIds)
		.execute();
	return latestRfqVersionsByRfq(rows);
}
