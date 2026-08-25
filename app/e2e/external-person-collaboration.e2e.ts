import { expect, test } from '@playwright/test';

const EXTERNAL_PERSON_EMAIL = 'e2e-external-person@example.test';
const EXTERNAL_PERSON_PASSWORD = 'NuBlox-E2E-External-Person-2026!';
const PROJECT_NUMBER = 'PORTAL-E2E-001';
const PROJECT_NAME = 'Portal collaboration project';

test('a verified external person with no organisation membership signs straight into project-scoped portal access', async ({
	page
}) => {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EXTERNAL_PERSON_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(EXTERNAL_PERSON_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/portal$/, { timeout: 15_000 });
	await expect(page.getByRole('heading', { name: 'Your shared projects' })).toBeVisible();
	await expect(
		page.getByText(
			'Project access has been granted to you personally. You do not need a NuBlox organisation, and your employer or CRM affiliation is not mapped to a platform organisation.'
		)
	).toBeVisible();
	await expect(page.getByText(PROJECT_NUMBER, { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: PROJECT_NAME })).toBeVisible();
	await expect(page.getByText('Project roles: Engineer', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Create organisation' })).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
});
