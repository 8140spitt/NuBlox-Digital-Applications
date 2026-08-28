import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const PROJECT_PUBLIC_ID = '33333333-3333-4333-8333-333333333333';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('project financials expose the procurement settlement digital thread', async ({ page }) => {
	await signIn(page);
	await page.goto(`/projects/${PROJECT_PUBLIC_ID}/financials/settlement`);
	await expect(
		page.getByRole('heading', { name: 'Procurement settlement', level: 1 })
	).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Project financial workspaces' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Financial control' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Procurement settlement' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Supplier payments' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Bank reconciliation' })).toBeVisible();
	await expect(page.getByText(/Project actual cost remains receipt-based/)).toBeVisible();
});
