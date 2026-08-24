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

test('enterprise search is discoverable and returns only authorised record results', async ({ page }) => {
	await signIn(page);
	await page.goto('/more');
	await page.getByRole('link', { name: /Enterprise search/ }).click();
	await expect(page).toHaveURL(/\/search$/);
	await expect(page.getByRole('heading', { name: 'Enterprise search', level: 1 })).toBeVisible();
	await expect(
		page.getByText('Results are filtered by your active organisation, project scope and effective permissions.')
	).toBeVisible();

	await page.getByLabel('Search term').fill('zz-no-authorised-record');
	await page.getByRole('button', { name: 'Search', exact: true }).click();
	await expect(page).toHaveURL(/\/search\?q=zz-no-authorised-record$/);
	await expect(page.getByText(/No authorised records matched/)).toBeVisible();
});
