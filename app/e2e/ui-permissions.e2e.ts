import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-viewer@example.test';
const PASSWORD = 'NuBlox-E2E-Viewer-2026!';
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

test('read-only member can view workspaces without receiving mutation controls', async ({
	page
}) => {
	await signIn(page);

	const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
	await expect(primaryNavigation.getByRole('link', { name: 'CRM', exact: true })).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Commercial', exact: true })
	).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Projects', exact: true })
	).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Contracts', exact: true })
	).toBeVisible();
	await expect(
		primaryNavigation.getByRole('link', { name: 'Schedule', exact: true }).first()
	).toBeVisible();
	await expect(primaryNavigation.getByRole('link', { name: 'Time', exact: true })).toBeVisible();
	await expect(primaryNavigation.getByRole('link', { name: 'People', exact: true })).toBeVisible();
	await expect(primaryNavigation.getByRole('link', { name: 'Finance', exact: true })).toBeVisible();
	await expect(page.locator('.topbar').getByText('Create', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Notifications' })).toBeDisabled();

	await page.goto('/crm');
	await expect(page.getByRole('heading', { name: 'CRM', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create CRM record' })).toHaveCount(0);

	await page.goto('/commercial/estimates');
	await expect(
		page.getByRole('heading', { name: 'Estimates', exact: true, level: 1 })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create estimate' })).toHaveCount(0);

	await page.goto('/contracts');
	await expect(
		page.getByRole('heading', { name: 'Contracts', exact: true, level: 1 })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Form contract' })).toHaveCount(0);

	await page.goto('/people');
	await expect(page.getByRole('heading', { name: 'People', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add workforce member' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Create assignment' })).toHaveCount(0);

	await page.goto('/schedule');
	await expect(
		page.getByRole('heading', { name: 'Schedule', exact: true, level: 1 })
	).toBeVisible();
	await expect(page.getByRole('button', { name: 'Schedule work' })).toHaveCount(0);
	await expect(page.getByText('My schedule', { exact: true })).toBeVisible();

	await page.goto('/time');
	await expect(page.getByRole('heading', { name: 'Time', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create timesheet' })).toHaveCount(0);
	await expect(page.getByText('NuBlox E2E Viewer', { exact: true })).toBeVisible();

	await page.goto('/finance/accounting/periods');
	await expect(page.getByRole('heading', { name: 'Accounting periods', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create financial year' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Soft close' })).toHaveCount(0);
});
