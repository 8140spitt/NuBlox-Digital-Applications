import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test('owner maintains organisation teams through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/organisation');
	await page.getByRole('link', { name: 'Teams' }).click();
	await expect(page).toHaveURL(/\/organisation\/teams$/);
	await expect(page.getByText('Team membership does not grant permissions.')).toBeVisible();

	const createForm = page.locator('form[action="?/createTeam"]');
	await createForm.getByLabel('Name').fill('E2E Delivery Team');
	await createForm.getByLabel('Description').fill('Browser acceptance organisation team.');
	await createForm.getByRole('checkbox', { name: /NuBlox E2E Viewer/ }).check();
	await createForm.getByRole('button', { name: 'Create team' }).click();

	const team = page.locator('details').filter({ hasText: 'E2E Delivery Team' });
	await expect(team).toBeVisible();
	await expect(team.getByText('1 member', { exact: true })).toBeVisible();
	await team.locator('summary').click();

	const updateForm = team.locator('form[action="?/updateTeam"]');
	await updateForm.getByLabel('Name').fill('E2E Delivery & Controls');
	await updateForm.getByLabel('Team is active').uncheck();
	await updateForm.getByRole('button', { name: 'Save team' }).click();

	const updatedTeam = page.locator('details').filter({ hasText: 'E2E Delivery & Controls' });
	await expect(updatedTeam).toBeVisible();
	await expect(updatedTeam.getByText('Inactive', { exact: true })).toBeVisible();
});
