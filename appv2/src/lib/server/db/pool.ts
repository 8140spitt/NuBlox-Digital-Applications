import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createPool, type Pool } from 'mysql2/promise';

type PoolGlobal = typeof globalThis & {
	__nubloxV2Pool?: Pool;
};

const poolGlobal = globalThis as PoolGlobal;

function databaseUrl(): string {
	const value = env.DATABASE_URL?.trim();
	if (value) return value;
	if (building) return 'mysql://build:build@127.0.0.1:3306/nublox_build';
	throw new Error('DATABASE_URL is required.');
}

export function getPool(): Pool {
	if (!poolGlobal.__nubloxV2Pool) {
		poolGlobal.__nubloxV2Pool = createPool({
			uri: databaseUrl(),
			waitForConnections: true,
			connectionLimit: 10,
			queueLimit: 0,
			timezone: 'Z',
			supportBigNumbers: true,
			bigNumberStrings: true,
			decimalNumbers: false,
			multipleStatements: false
		});
	}

	return poolGlobal.__nubloxV2Pool;
}
