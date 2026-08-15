import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		environment: 'node',
		expect: { requireAssertions: true },
		include: ['src/**/*.integration.test.ts'],
		fileParallelism: false
	}
});
