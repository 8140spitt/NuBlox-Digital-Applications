import { expect, test } from '@playwright/test';

const EXTERNAL_PERSON_EMAIL = 'e2e-external-person@example.test';
const EXTERNAL_PERSON_PASSWORD = 'external-person-test';
const PROJECT_NUMBER = 'PORTAL-E2E-001';
const PROJECT_NAME = 'Portal collaboration project';
const PORTAL_LOGIN = '/nublox/portal/perspectivebc/login';
const PORTAL_DASHBOARD = '/nublox/portal/perspectivebc/dashboard';

test('a verified external person signs into the CRM-party scoped portal without tenant membership', async ({
	page
}) => {
	await page.goto(PORTAL_LOGIN);
	await expect(page).toHaveURL(new RegExp(`${PORTAL_LOGIN}$`));
	await page.getByLabel('Email', { exact: true }).fill(EXTERNAL_PERSON_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(EXTERNAL_PERSON_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(new RegExp(`${PORTAL_DASHBOARD}$`), { timeout: 15_000 });
	await expect(page.getByRole('heading', { name: 'Your shared work', level: 1 })).toBeVisible();
	await expect(page.getByText('Perspective BC', { exact: true }).first()).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Projects shared with you personally' })
	).toBeVisible();
	await expect(
		page.getByText('External access is deny-by-default.', { exact: true })
	).toBeVisible();
	await expect(page.getByText(PROJECT_NUMBER, { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: PROJECT_NAME })).toBeVisible();
	await expect(page.getByText('Roles: Engineer', { exact: true })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Create organisation' })).toHaveCount(0);
	await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
});
