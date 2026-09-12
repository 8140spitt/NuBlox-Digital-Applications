import { randomUUID } from 'node:crypto';

import type { DatabaseExecutor } from '$lib/server/db/executor';

export type DefaultTaxCategory = {
	code: string;
	name: string;
	treatment: 'taxable' | 'zero' | 'exempt' | 'outside_scope';
	ratePercent: string | null;
};

export const DEFAULT_UK_TAX_VALID_FROM = new Date('2026-04-01T00:00:00.000Z');

export const DEFAULT_UK_TAX_CATEGORIES: readonly DefaultTaxCategory[] = [
	{ code: 'VAT_STANDARD', name: 'VAT standard rate', treatment: 'taxable', ratePercent: '20.0000' },
	{ code: 'VAT_REDUCED', name: 'VAT reduced rate', treatment: 'taxable', ratePercent: '5.0000' },
	{ code: 'VAT_ZERO', name: 'VAT zero rate', treatment: 'zero', ratePercent: '0.0000' },
	{ code: 'VAT_EXEMPT', name: 'VAT exempt', treatment: 'exempt', ratePercent: null },
	{ code: 'OUTSIDE_SCOPE', name: 'Outside scope', treatment: 'outside_scope', ratePercent: null }
] as const;

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Tax-category insert did not return an ID.');
	return result.insertId.toString();
}

/**
 * Creates the NuBlox UK starter tax catalogue without overwriting tenant-owned
 * categories or rate history. Rate changes remain effective-dated facts.
 */
export async function ensureDefaultUkTaxCategories(
	db: DatabaseExecutor,
	organisationId: string,
	publicIdFactory: () => string = randomUUID
): Promise<void> {
	for (const definition of DEFAULT_UK_TAX_CATEGORIES) {
		let category = await db
			.selectFrom('tax_categories')
			.select(['id', 'treatment'])
			.where('organisation_id', '=', organisationId)
			.where('code', '=', definition.code)
			.executeTakeFirst();

		if (!category) {
			const id = insertedId(
				await db
					.insertInto('tax_categories')
					.values({
						organisation_id: organisationId,
						public_id: publicIdFactory(),
						code: definition.code,
						name: definition.name,
						treatment: definition.treatment,
						is_active: 1
					})
					.executeTakeFirstOrThrow()
			);
			category = { id, treatment: definition.treatment };
		}

		if (definition.ratePercent === null) continue;

		const existingRate = await db
			.selectFrom('tax_category_rates')
			.select('id')
			.where('organisation_id', '=', organisationId)
			.where('tax_category_id', '=', category.id)
			.limit(1)
			.executeTakeFirst();
		if (existingRate) continue;

		await db
			.insertInto('tax_category_rates')
			.values({
				organisation_id: organisationId,
				tax_category_id: category.id,
				rate_percent: definition.ratePercent,
				valid_from: DEFAULT_UK_TAX_VALID_FROM,
				valid_to: null
			})
			.executeTakeFirstOrThrow();
	}
}
