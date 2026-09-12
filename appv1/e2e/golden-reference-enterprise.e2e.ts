import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const CLIENT = 'Northstar Property Holdings';
const SUPPLIER = 'Apex Building Services';
const PROJECT_NUMBER = 'REF-RIVERSIDE-001';
const PROJECT_NAME = 'Northstar Riverside Campus';
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

test('golden reference enterprise context is available to the owner', async ({ page }) => {
	await signIn(page);

	await page.goto('/crm');
	await expect(page.getByText(CLIENT, { exact: true }).first()).toBeVisible();
	await expect(page.getByText(SUPPLIER, { exact: true }).first()).toBeVisible();

	await page.goto('/projects');
	const referenceProject = page.locator('a.project-card').filter({ hasText: PROJECT_NUMBER });
	await expect(referenceProject).toContainText(PROJECT_NAME);
	await expect(referenceProject).toContainText('Active');
	await referenceProject.click();

	await expect(page).toHaveURL(new RegExp(`/projects/${PROJECT_PUBLIC_ID}$`));
	await expect(page.getByRole('heading', { name: PROJECT_NAME, level: 1 })).toBeVisible();
});
