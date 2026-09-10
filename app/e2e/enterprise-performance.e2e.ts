import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const OWNER = 'NuBlox E2E Owner';

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('F03 exposes a governed enterprise performance command centre', async ({ page }) => {
	await signIn(page);
	await page.goto('/performance');
	await expect(
		page.getByRole('heading', { name: 'Performance command centre', level: 1 })
	).toBeVisible();
	await expect(page.getByText('F03 · Enterprise Performance Management')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Performance framework', level: 2 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Operate the performance cycle', level: 2 })).toBeVisible();

	const form = page.locator('form[action="?/createFramework"]');
	await form.getByLabel('Code').fill('F03-E2E');
	await form.getByLabel('Title').fill('F03 E2E Performance Framework');
	await form
		.getByLabel('Purpose')
		.fill('Operate enterprise performance through one governed evidence chain.');
	await form
		.getByLabel('Scope')
		.fill('Executive KPIs, reporting, intervention, review, benchmarking and benefits.');
	await form.getByLabel('Cadence').selectOption('monthly');
	await form.getByLabel('Owner').selectOption({ label: OWNER });
	await form.getByLabel('Effective from').fill('2026-01-01');
	await form.getByRole('button', { name: 'Create framework' }).click();

	await expect(page.getByRole('heading', { name: 'F03 E2E Performance Framework' })).toBeVisible();
	await expect(page.getByText('F03-E2E', { exact: false }).first()).toBeVisible();
	await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();
});
