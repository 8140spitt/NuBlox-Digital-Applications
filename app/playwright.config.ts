import { defineConfig } from '@playwright/test';
import { loadEnv } from 'vite';

const appUrl = 'http://127.0.0.1:4173';
const playwrightEnv = loadEnv('test', process.cwd(), '');

for (const [key, value] of Object.entries(playwrightEnv)) {
	if (process.env[key] === undefined) process.env[key] = value;
}

process.env.BETTER_AUTH_URL = appUrl;

export default defineConfig({
	globalSetup: './e2e/global-setup.mjs',
	use: { baseURL: appUrl },
	webServer: {
		command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4173',
		url: appUrl,
		reuseExistingServer: !process.env.CI
	},
	testMatch: '**/*.e2e.{ts,js}'
});
