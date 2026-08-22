import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const appUrl = 'http://127.0.0.1:4173';
const playwrightEnv = loadEnv('test', process.cwd(), '');

for (const [key, value] of Object.entries(playwrightEnv)) {
	if (process.env[key] === undefined) process.env[key] = value;
}

const sourceDatabaseUrl = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
	throw new Error('DATABASE_URL or E2E_DATABASE_URL is required for browser E2E validation.');
}

if (!process.env.E2E_DATABASE_URL) {
	const parsedDatabaseUrl = new URL(sourceDatabaseUrl);
	const sourceDatabaseName = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ''));
	if (!sourceDatabaseName || !/^[A-Za-z0-9_]+$/.test(sourceDatabaseName)) {
		throw new Error(`Unsafe or missing source database name: ${sourceDatabaseName || '<empty>'}`);
	}
	parsedDatabaseUrl.pathname = `/${sourceDatabaseName}_e2e`;
	process.env.DATABASE_URL = parsedDatabaseUrl.toString();
} else {
	process.env.DATABASE_URL = process.env.E2E_DATABASE_URL;
}

process.env.BETTER_AUTH_URL = appUrl;

export default defineConfig({
	globalSetup: './e2e/global-setup.mjs',
	use: { baseURL: appUrl },
	webServer: {
		command:
			'node e2e/prepare-database.mjs && pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
		url: appUrl,
		reuseExistingServer: false
	},
	testMatch: '**/*.e2e.{ts,js}'
});
