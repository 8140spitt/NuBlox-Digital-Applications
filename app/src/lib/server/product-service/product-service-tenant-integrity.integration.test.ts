import { describe, expect, it } from 'vitest';

import { getDatabase } from '$lib/server/db/database';

function insertedId(result: { insertId?: bigint }): string {
	if (result.insertId === undefined) throw new Error('Expected an AUTO_INCREMENT insert ID.');
	return result.insertId.toString();
}

async function createOrganisation(label: string) {
	const db = getDatabase();
	const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const organisationId = insertedId(
		await db
			.insertInto('organisations')
			.values({
				public_id: crypto.randomUUID(),
				legal_name: `${label} ${suffix}`,
				default_timezone: 'Europe/London',
				default_currency_code: 'GBP',
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const userId = insertedId(
		await db
			.insertInto('users')
			.values({
				public_id: crypto.randomUUID(),
				display_name: `${label} Owner ${suffix}`,
				status: 'active'
			})
			.executeTakeFirstOrThrow()
	);
	const memberId = insertedId(
		await db
			.insertInto('organisation_members')
			.values({
				public_id: crypto.randomUUID(),
				organisation_id: organisationId,
				user_id: userId,
				status: 'active',
				joined_at: new Date('2026-09-12T08:00:00.000Z')
			})
			.executeTakeFirstOrThrow()
	);
	return { organisationId, memberId };
}

describe('F05 database tenant graph integrity', () => {
	it('rejects a cross-tenant portfolio relationship even when each standalone id exists', async () => {
		const db = getDatabase();
		const tenantA = await createOrganisation('F05 Tenant A');
		const tenantB = await createOrganisation('F05 Tenant B');
		const portfolioId = insertedId(
			await db
				.insertInto('product_service_portfolios')
				.values({
					public_id: crypto.randomUUID(),
					organisation_id: tenantA.organisationId,
					portfolio_code: `TENANT-A-${Date.now()}`,
					title: 'Tenant A portfolio',
					portfolio_type: 'service',
					strategic_thesis: 'Tenant-isolated portfolio.',
					owner_member_id: tenantA.memberId,
					created_by_member_id: tenantA.memberId
				})
				.executeTakeFirstOrThrow()
		);

		await expect(
			db
				.insertInto('product_service_offerings')
				.values({
					public_id: crypto.randomUUID(),
					organisation_id: tenantB.organisationId,
					portfolio_id: portfolioId,
					offering_code: `CROSS-${Date.now()}`,
					title: 'Invalid cross-tenant offering',
					offering_type: 'service',
					value_proposition: 'This insert must be rejected by the database.',
					owner_member_id: tenantB.memberId,
					created_by_member_id: tenantB.memberId
				})
				.executeTakeFirstOrThrow()
		).rejects.toThrow();
	});
});
