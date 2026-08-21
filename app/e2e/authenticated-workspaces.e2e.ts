import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

test('verified owner signs in and uses the context-first workspace surface', async ({ page }) => {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });

	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });

	await expect(page.getByRole('link', { name: 'NuBlox dashboard' })).toBeVisible();
	const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
	for (const label of [
		'Home',
		'My work',
		'Projects',
		'Customers',
		'Suppliers',
		'Assets',
		'Finance',
		'Portal',
		'More'
	]) {
		await expect(primaryNavigation.getByRole('link', { name: label, exact: true })).toBeVisible();
	}

	for (const specialistLabel of ['Documents', 'Project cost control', 'Valuations', 'Site, quality & safety', 'People']) {
		await expect(
			primaryNavigation.getByRole('link', { name: specialistLabel, exact: true })
		).toHaveCount(0);
	}

	await page.getByText('Search', { exact: true }).click();
	await page.getByLabel('Find a workspace').fill('procurement');
	await expect(page.locator('.search-results').getByRole('link', { name: /Procurement/ })).toBeVisible();
	await page.getByLabel('Find a workspace').fill('valuations');
	await expect(page.locator('.search-results').getByRole('link', { name: /Valuations/ })).toBeVisible();
	await page.getByLabel('Find a workspace').fill('documents');
	await expect(page.locator('.search-results').getByRole('link', { name: /Documents/ })).toBeVisible();
	await page.getByLabel('Find a workspace').fill('people');
	await expect(page.locator('.search-results').getByRole('link', { name: /People/ })).toBeVisible();
	await page.getByLabel('Find a workspace').fill('site');
	await expect(
		page.locator('.search-results').getByRole('link', { name: /Site, quality & safety/ })
	).toBeVisible();
	await page.getByLabel('Find a workspace').fill('year-end');
	await expect(page.locator('.search-results').getByRole('link', { name: /Year-end close/ })).toBeVisible();
	await page.getByText('Search', { exact: true }).click();

	await page.goto('/more');
	await expect(page.getByRole('heading', { name: 'More workspaces', level: 1 })).toBeVisible();
	for (const label of ['Documents', 'Project cost control', 'Valuations', 'Site, quality & safety', 'Schedule', 'Time', 'People', 'Year-end close']) {
		await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toBeVisible();
	}

	await page.getByText('Create', { exact: true }).click();
	const createPopover = page.locator('.create-popover');
	await expect(createPopover.getByRole('link', { name: /CRM record/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Estimate/ })).toBeVisible();
	await expect(createPopover.locator('a[href="/projects"]')).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Controlled document/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /RFI/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Project instruction/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Procurement package/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Purchase order/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Project cost code/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Commercial variation/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Site diary/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Quality inspection/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Safety observation/ })).toBeVisible();
	await expect(createPopover.locator('a[href="/assets#create-asset"]')).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Maintenance request/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Maintenance plan/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Workforce member/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Scheduled work/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Timesheet/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Contract/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Invoice/ })).toBeVisible();

	const workspacePaths = [
		'/dashboard',
		'/my-work',
		'/more',
		'/crm',
		'/crm/opportunities',
		'/commercial/estimates',
		'/commercial/quotations',
		'/commercial/cost-control',
		'/commercial/valuations',
		'/projects',
		'/documents',
		'/purchasing',
		'/contracts',
		'/people',
		'/site',
		'/assets',
		'/schedule',
		'/time',
		'/finance/invoices',
		'/finance/payments',
		'/finance/receivables',
		'/finance/collections',
		'/finance/collections/automation',
		'/finance/credit-control',
		'/finance/bad-debt',
		'/finance/tax',
		'/finance/tax-relief',
		'/finance/billing',
		'/finance/accounting',
		'/finance/accounting/periods',
		'/finance/accounting/reports',
		'/finance/accounting/year-end',
		'/organisation'
	];

	for (const workspacePath of workspacePaths) {
		await page.goto(workspacePath);
		expect(new URL(page.url()).pathname).toBe(workspacePath);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		await expect(page.locator('body')).not.toContainText('Authentication is required.');
	}
});
