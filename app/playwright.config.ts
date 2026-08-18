import { defineConfig } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173';

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
