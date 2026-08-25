import { Kysely, MysqlDialect } from 'kysely';
import { createPool } from 'mysql2';

import type { DB as CoreDB } from './generated/database.js';
import type { DB as CollectionsDB } from './generated/collections.js';
import type { DB as AccountingDB } from './generated/accounting.js';
import type { DB as AccountsPayableDB } from './generated/accounts-payable.js';
import type { DB as ProjectControlsDB } from './generated/project-controls.js';
import { getDatabaseRuntimeConfig } from './config.js';

export type DatabaseSchema =
	CoreDB & CollectionsDB & AccountingDB & AccountsPayableDB & ProjectControlsDB;
export type Database = Kysely<DatabaseSchema>;

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

	pool.on('connection', (connection) => {
		connection.query("SET time_zone = '+00:00'");
	});

	return new Kysely<DatabaseSchema>({
		dialect: new MysqlDialect({ pool })
	});
}

export function getDatabase(): Database {
	if (!databaseGlobal.__nubloxDatabase) {
		databaseGlobal.__nubloxDatabase = createDatabase();
	}

	return databaseGlobal.__nubloxDatabase;
}

export async function closeDatabase(): Promise<void> {
	const database = databaseGlobal.__nubloxDatabase;
	if (!database) return;

	delete databaseGlobal.__nubloxDatabase;
	await database.destroy();
}
