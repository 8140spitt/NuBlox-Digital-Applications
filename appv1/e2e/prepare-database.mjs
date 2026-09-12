import { spawnSync } from 'node:child_process';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required to prepare the browser E2E database.');

const parsedDatabaseUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ''));
if (!databaseName || !/^[A-Za-z0-9_]+$/.test(databaseName)) {
	throw new Error(`Unsafe or missing browser E2E database name: ${databaseName || '<empty>'}`);
}

const adminUrl = new URL(parsedDatabaseUrl);
adminUrl.pathname = '/';

const connection = await mysql.createConnection(adminUrl.toString());
try {
	await connection.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
	await connection.query(
		`CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
	);
} finally {
	await connection.end();
}

const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const migration = spawnSync(
	pnpmCommand,
	['exec', 'dbmate', '--migrations-dir', '../database/migrations', '--no-dump-schema', 'up'],
	{
		cwd: process.cwd(),
		env: process.env,
		stdio: 'inherit'
	}
);

if (migration.error) throw migration.error;
if (migration.status !== 0) {
	throw new Error(`Browser E2E database migration failed with exit code ${migration.status}.`);
}

console.log(`Prepared isolated browser E2E database: ${databaseName}.`);
