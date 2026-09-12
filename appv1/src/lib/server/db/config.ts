import { env } from '$env/dynamic/private';

const DEFAULT_POOL_MAX = 10;
const MAX_POOL_MAX = 100;

export interface DatabaseRuntimeConfig {
	databaseUrl: string;
	poolMax: number;
}

function parsePoolMax(value: string | undefined): number {
	if (!value) return DEFAULT_POOL_MAX;

	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_POOL_MAX) {
		throw new Error(`DB_POOL_MAX must be an integer between 1 and ${MAX_POOL_MAX}.`);
	}

	return parsed;
}

export function getDatabaseRuntimeConfig(): DatabaseRuntimeConfig {
	const databaseUrl = env.DATABASE_URL?.trim();
	if (!databaseUrl) {
		throw new Error('DATABASE_URL is required before a database connection can be opened.');
	}

	if (!databaseUrl.startsWith('mysql://')) {
		throw new Error('DATABASE_URL must use the mysql:// scheme.');
	}

	return {
		databaseUrl,
		poolMax: parsePoolMax(env.DB_POOL_MAX)
	};
}
