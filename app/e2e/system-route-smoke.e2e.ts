import { expect, test } from '@playwright/test';

test('public application shell and health endpoint are reachable', async ({ page, request }) => {
	const health = await request.get('/api/health');
	expect(health.ok()).toBe(true);

	await page.goto('/signin');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

	await page.goto('/start');
	await expect(page.getByRole('heading', { name: 'Start with NuBlox' })).toBeVisible();
});

test('protected workspaces consistently preserve return targets for unauthenticated users', async ({
	page
}) => {
	const protectedPaths = [
		'/dashboard',
		'/crm',
		'/crm/opportunities',
		'/commercial/estimates',
		'/commercial/quotations',
		'/projects',
		'/contracts',
		'/people',
		'/schedule',
		'/time',
		'/finance/invoices',
		'/finance/payments',
		'/finance/receivables',
		'/finance/collections',
		'/finance/credit-control',
		'/finance/bad-debt',
		'/finance/tax-relief',
		'/finance/accounting',
		'/finance/accounting/periods',
		'/finance/accounting/reports',
		'/finance/accounting/year-end',
		'/organisation'
	];

	for (const protectedPath of protectedPaths) {
		await page.goto(protectedPath);
		const current = new URL(page.url());
		expect(current.pathname).toBe('/signin');
		expect(current.searchParams.get('returnTo')).toBe(protectedPath);
	}
});
