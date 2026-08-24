import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-viewer@example.test';
const PASSWORD = 'NuBlox-E2E-Viewer-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('native capability map exposes all 19 governed domains with permission-filtered routes', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/more');
	await expect(page.getByRole('link', { name: /Capability map/ })).toBeVisible();
	await page.getByRole('link', { name: /Capability map/ }).click();
	await expect(page).toHaveURL(/\/capabilities$/);
	await expect(page.getByRole('heading', { name: 'Native capability map', level: 1 })).toBeVisible();
	await expect(page.locator('.capability-card')).toHaveCount(19);
	await expect(page.getByText('Domain 19', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Data, workflow, analytics, search and intelligence' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Enterprise search', exact: true })).toBeVisible();
	await expect(page.getByText('Domain 10', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Materials, inventory, warehouse, distribution and logistics' })).toBeVisible();
});
