import { lineAmount, sumMoney } from '$lib/server/commercial/commercial-decimal';
import type { DatabaseExecutor } from '$lib/server/db/executor';

export async function quotationCommitmentAmount(
	db: DatabaseExecutor,
	organisationId: string,
	quotationVersionId: string
): Promise<string> {
	const items = await db
		.selectFrom('quotation_items')
		.select(['id', 'quantity', 'unit_rate as unitRate'])
		.where('organisation_id', '=', organisationId)
		.where('quotation_version_id', '=', quotationVersionId)
		.where('is_optional', '=', 0)
		.orderBy('line_number', 'asc')
		.execute();
	const values: string[] = [];
	for (const item of items) {
		values.push(lineAmount(item.quantity, item.unitRate));
		const taxes = await db
			.selectFrom('quotation_item_taxes')
			.select('tax_amount as taxAmount')
			.where('organisation_id', '=', organisationId)
			.where('quotation_item_id', '=', item.id)
			.orderBy('sort_order', 'asc')
			.execute();
		values.push(...taxes.map((tax) => tax.taxAmount));
	}
	return sumMoney(values);
}
