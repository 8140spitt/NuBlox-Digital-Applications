import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';

import type { DB } from './generated/database.js';
import { getDatabaseRuntimeConfig } from './config.js';

export type Database = Kysely<DB>;

type DatabaseGlobal = typeof globalThis & {
	__nubloxDatabase?: Database;
};

const databaseGlobal = globalThis as DatabaseGlobal;

function createDatabase(): Database {
	const config = getDatabaseRuntimeConfig();
	const pool = createPool({
		uri: config.databaseUrl,
		waitForConnections: true,
		connectionLimit: config.poolMax,
		maxIdle: config.poolMax,
		idleTimeout: 60_000,
		queueLimit: 0,
		enableKeepAlive: true,
		keepAliveInitialDelay: 0,
		timezone: 'Z',
		supportBigNumbers: true,
		bigNumberStrings: true,
		decimalNumbers: false,
		multipleStatements: false
	});

	// NuBlox stores event timestamps in UTC. Set the server session timezone on every
	// physical connection as well as configuring mysql2's client-side timezone.
	pool.on('connection', (connection) => {
		connection.query("SET time_zone = '+00:00'");
	});

	return new Kysely<DB>({
		dialect: new MysqlDialect({ pool })
	});
}

/**
 * Returns the process-local NuBlox database handle.
 *
 * Repositories and domain services may use this function. Svelte routes/components
 * must not issue SQL directly.
 */
export function getDatabase(): Database {
	if (!databaseGlobal.__nubloxDatabase) {
		databaseGlobal.__nubloxDatabase = createDatabase();
	}

	return databaseGlobal.__nubloxDatabase;
}

/** Close the process-local pool, primarily for tests and controlled shutdowns. */
export async function closeDatabase(): Promise<void> {
	const database = databaseGlobal.__nubloxDatabase;
	if (!database) return;

	delete databaseGlobal.__nubloxDatabase;
	await database.destroy();
}
