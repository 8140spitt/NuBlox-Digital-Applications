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

test('My Work exposes the governed Work Kernel without granting read-only mutation controls', async ({
	page
}) => {
	await signIn(page);

	const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
	await primaryNavigation.getByRole('link', { name: 'My work', exact: true }).click();
	await expect(page).toHaveURL(/\/my-work$/);
	await expect(page.getByRole('heading', { name: 'My work', level: 1 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Assigned work', level: 2 })).toBeVisible();
	await expect(
		page.getByText('No active Work Kernel items are assigned directly to you.', { exact: true })
	).toBeVisible();
	await expect(page.locator('form[action="?/transitionWork"]')).toHaveCount(0);
	await expect(page.locator('form[action="?/decideWork"]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Continue in a project', level: 2 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Work queues', level: 2 })).toBeVisible();
});
