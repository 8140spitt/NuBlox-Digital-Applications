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

test('personal contexts are discoverable, favouritable and record recent opens', async ({ page }) => {
	await signIn(page);
	await page.goto('/more');
	await expect(page.getByRole('link', { name: /Contexts/ })).toBeVisible();
	await page.getByRole('link', { name: /Contexts/ }).click();
	await expect(page).toHaveURL(/\/contexts$/);
	await expect(page.getByRole('heading', { name: 'Contexts', level: 1 })).toBeVisible();
	await expect(page.getByText(ORGANISATION, { exact: true })).toBeVisible();

	const organisationCard = page.locator('.context-card').filter({ hasText: ORGANISATION });
	await organisationCard.getByRole('button', { name: 'Favourite', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'Favourites', level: 2 })).toBeVisible();
	await expect(
		page.locator('.shortcut-panel').filter({ hasText: 'Favourites' }).getByText(ORGANISATION)
	).toBeVisible();

	await organisationCard.getByRole('link', { name: 'Open', exact: true }).click();
	await expect(page).toHaveURL(/\/organisation$/);
	await page.goto('/contexts');
	await expect(
		page.locator('.shortcut-panel').filter({ hasText: 'Recent' }).getByText(ORGANISATION)
	).toBeVisible();
});
