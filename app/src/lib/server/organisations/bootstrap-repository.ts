import type { DatabaseExecutor } from '$lib/server/db/executor';

export type PendingOrganisationBootstrap = {
	id: string;
	publicId: string;
	email: string;
	authUserId: string | null;
	legalName: string;
	tradingName: string | null;
	defaultTimezone: string;
	defaultCurrencyCode: string;
	expiresAt: Date;
};

export class OrganisationBootstrapRepository {
	constructor(private readonly db: DatabaseExecutor) {}

	async findPendingByTokenHash(
		tokenHash: string,
		now = new Date(),
		lock = false
	): Promise<PendingOrganisationBootstrap | null> {
		const query = this.db
			.selectFrom('organisation_bootstrap_intents')
			.select([
				'id',
				'public_id',
				'email',
				'auth_user_id',
				'legal_name',
				'trading_name',
				'default_timezone',
				'default_currency_code',
				'expires_at'
			])
			.where('token_hash', '=', tokenHash)
			.where('status', '=', 'pending')
			.where('expires_at', '>', now);

		const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
		return row
			? {
					id: row.id,
					publicId: row.public_id,
					email: row.email,
					authUserId: row.auth_user_id,
					legalName: row.legal_name,
					tradingName: row.trading_name,
					defaultTimezone: row.default_timezone,
					defaultCurrencyCode: row.default_currency_code,
					expiresAt: row.expires_at
				}
			: null;
	}

	async findPendingByAuthUser(
		authUserId: string,
		email: string,
		now = new Date(),
		lock = false
	): Promise<PendingOrganisationBootstrap | null> {
		const query = this.db
			.selectFrom('organisation_bootstrap_intents')
			.select([
				'id',
				'public_id',
				'email',
				'auth_user_id',
				'legal_name',
				'trading_name',
				'default_timezone',
				'default_currency_code',
				'expires_at'
			])
			.where('auth_user_id', '=', authUserId)
			.where('email', '=', email)
			.where('status', '=', 'pending')
			.where('expires_at', '>', now);

		const row = await (lock ? query.forUpdate() : query).executeTakeFirst();
		return row
			? {
					id: row.id,
					publicId: row.public_id,
					email: row.email,
					authUserId: row.auth_user_id,
					legalName: row.legal_name,
					tradingName: row.trading_name,
					defaultTimezone: row.default_timezone,
					defaultCurrencyCode: row.default_currency_code,
					expiresAt: row.expires_at
				}
			: null;
	}

	async revokePendingForEmail(email: string, revokedAt = new Date()): Promise<void> {
		await this.db
			.updateTable('organisation_bootstrap_intents')
			.set({ status: 'revoked', revoked_at: revokedAt })
			.where('email', '=', email)
			.where('status', '=', 'pending')
			.where('auth_user_id', 'is', null)
			.execute();
	}

	async insertIntent(input: {
		publicId: string;
		email: string;
		tokenHash: string;
		legalName: string;
		tradingName: string | null;
		defaultTimezone: string;
		defaultCurrencyCode: string;
		expiresAt: Date;
	}): Promise<string> {
		const result = await this.db
			.insertInto('organisation_bootstrap_intents')
			.values({
				public_id: input.publicId,
				email: input.email,
				token_hash: input.tokenHash,
				status: 'pending',
				auth_user_id: null,
				created_user_id: null,
				organisation_id: null,
				legal_name: input.legalName,
				trading_name: input.tradingName,
				default_timezone: input.defaultTimezone,
				default_currency_code: input.defaultCurrencyCode,
				expires_at: input.expiresAt,
				activated_at: null,
				revoked_at: null
			})
			.executeTakeFirstOrThrow();
		if (result.insertId === undefined) throw new Error('Bootstrap intent insert did not return an ID.');
		return result.insertId.toString();
	}

	async bindAuthUser(intentId: string, authUserId: string): Promise<boolean> {
		const result = await this.db
			.updateTable('organisation_bootstrap_intents')
			.set({ auth_user_id: authUserId })
			.where('id', '=', intentId)
			.where('status', '=', 'pending')
			.where('auth_user_id', 'is', null)
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}

	async markActivated(input: {
		intentId: string;
		userId: string;
		organisationId: string;
		activatedAt?: Date;
	}): Promise<boolean> {
		const result = await this.db
			.updateTable('organisation_bootstrap_intents')
			.set({
				status: 'activated',
				created_user_id: input.userId,
				organisation_id: input.organisationId,
				activated_at: input.activatedAt ?? new Date()
			})
			.where('id', '=', input.intentId)
			.where('status', '=', 'pending')
			.executeTakeFirst();
		return result.numUpdatedRows === 1n;
	}
}
