import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

test('verified owner signs in, selects a tenant and opens the complete workspace surface', async ({
	page
}) => {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);

	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);

	await expect(page.getByRole('link', { name: 'NuBlox dashboard' })).toBeVisible();
	const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
	await expect(primaryNavigation.getByRole('link', { name: 'CRM', exact: true })).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Projects', exact: true })
	).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Documents', exact: true })
	).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Schedule', exact: true }).first()
	).toBeVisible();
	await expect(primaryNavigation.getByRole('link', { name: 'Time', exact: true })).toBeVisible();
	await expect(primaryNavigation.getByRole('link', { name: 'People', exact: true })).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Credit control', exact: true })
	).toBeVisible();

	await page.getByText('Search', { exact: true }).click();
	await page.getByLabel('Find a workspace').fill('documents');
	await expect(
		page.locator('.search-results').getByRole('link', { name: /Documents/ })
	).toBeVisible();
	await page.getByLabel('Find a workspace').fill('people');
	await expect(page.locator('.search-results').getByRole('link', { name: /People/ })).toBeVisible();
	await page.getByLabel('Find a workspace').fill('year-end');
	await expect(
		page.locator('.search-results').getByRole('link', { name: /Year-end close/ })
	).toBeVisible();
	await page.getByText('Search', { exact: true }).click();

	await page.getByText('Create', { exact: true }).click();
	const createPopover = page.locator('.create-popover');
	await expect(createPopover.getByRole('link', { name: /CRM record/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Estimate/ })).toBeVisible();
	await expect(createPopover.locator('a[href="/projects"]')).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Controlled document/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /RFI/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Project instruction/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Workforce member/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Scheduled work/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Timesheet/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Contract/ })).toBeVisible();
	await expect(createPopover.getByRole('link', { name: /Invoice/ })).toBeVisible();

	const workspacePaths = [
		'/dashboard',
		'/crm',
		'/crm/opportunities',
		'/commercial/estimates',
		'/commercial/quotations',
		'/projects',
		'/documents',
		'/contracts',
		'/people',
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
