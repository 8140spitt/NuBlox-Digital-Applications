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

	const workspacePaths = [
		'/dashboard',
		'/crm',
		'/crm/opportunities',
		'/commercial/estimates',
		'/commercial/quotations',
		'/projects',
		'/contracts',
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
