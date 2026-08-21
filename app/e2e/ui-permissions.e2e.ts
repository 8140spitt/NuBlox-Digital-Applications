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

test('read-only member can navigate context-first workspaces without receiving mutation controls', async ({
	page
}) => {
	await signIn(page);

	const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
	for (const label of [
		'Home',
		'My work',
		'Projects',
		'Customers',
		'Suppliers',
		'Assets',
		'Finance',
		'Portal',
		'More'
	]) {
		await expect(primaryNavigation.getByRole('link', { name: label, exact: true })).toBeVisible();
	}
	for (const specialistLabel of ['Documents', 'Project cost control', 'Valuations', 'People', 'Site, quality & safety']) {
		await expect(
			primaryNavigation.getByRole('link', { name: specialistLabel, exact: true })
		).toHaveCount(0);
	}
	await expect(page.locator('.topbar').getByText('Create', { exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Notifications' })).toBeDisabled();

	await page.goto('/more');
	await expect(page.getByRole('heading', { name: 'More workspaces', level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: /Documents/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Project cost control/ })).toHaveCount(0);
	await expect(page.getByRole('link', { name: /Valuations/ })).toHaveCount(0);

	await page.goto('/crm');
	await expect(page.getByRole('heading', { name: 'CRM', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create CRM record' })).toHaveCount(0);

	await page.goto('/commercial/estimates');
	await expect(page.getByRole('heading', { name: 'Estimates', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create estimate' })).toHaveCount(0);

	await page.goto('/documents');
	await expect(
		page.getByRole('heading', { name: 'Documents & information', exact: true, level: 1 })
	).toBeVisible();
	await expect(page.locator('#create-document')).toHaveCount(0);
	await expect(page.locator('#create-rfi')).toHaveCount(0);
	await expect(page.locator('#create-submittal')).toHaveCount(0);
	await expect(page.locator('#create-instruction')).toHaveCount(0);
	await expect(page.getByRole('button', { name: /Issue/ })).toHaveCount(0);

	await page.goto('/purchasing');
	await expect(page.getByRole('heading', { name: 'Purchasing', exact: true, level: 1 })).toBeVisible();
	await expect(page.locator('#create-package')).toHaveCount(0);
	await expect(page.locator('#create-rfq')).toHaveCount(0);
	await expect(page.locator('#create-po')).toHaveCount(0);
	await expect(
		page.getByRole('button', {
			name: /Approve purchase order|Issue purchase order|Record confirmed receipt/
		})
	).toHaveCount(0);

	await page.goto('/commercial/cost-control');
	await expect(page.getByRole('heading', { name: 'Project cost control', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByText('Commercial cost control is restricted', { exact: true })).toBeVisible();
	await expect(page.locator('#create-cost-code')).toHaveCount(0);
	await expect(page.locator('#create-budget')).toHaveCount(0);
	await expect(page.locator('#create-variation')).toHaveCount(0);

	await page.goto('/commercial/valuations');
	await expect(page.getByRole('heading', { name: 'Valuations', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByText('Commercial valuations are restricted', { exact: true })).toBeVisible();
	await expect(page.locator('#create-valuation')).toHaveCount(0);

	await page.goto('/contracts');
	await expect(page.getByRole('heading', { name: 'Contracts', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Form contract' })).toHaveCount(0);

	await page.goto('/people');
	await expect(page.getByRole('heading', { name: 'People', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Add workforce member' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Create assignment' })).toHaveCount(0);

	await page.goto('/schedule');
	await expect(page.getByRole('heading', { name: 'Schedule', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Schedule work' })).toHaveCount(0);
	await expect(page.getByText('My schedule', { exact: true })).toBeVisible();

	await page.goto('/time');
	await expect(page.getByRole('heading', { name: 'Time', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create timesheet' })).toHaveCount(0);
	await expect(page.locator('.identity-card').getByText('NuBlox E2E Viewer', { exact: true })).toBeVisible();

	await page.goto('/site');
	await expect(page.getByRole('heading', { name: 'Site, quality & safety', exact: true, level: 1 })).toBeVisible();
	await expect(page.locator('#create-site')).toHaveCount(0);
	await expect(page.locator('#create-diary')).toHaveCount(0);
	await expect(page.locator('#create-template')).toHaveCount(0);
	await expect(page.locator('#create-inspection')).toHaveCount(0);
	await expect(page.locator('#create-defect')).toHaveCount(0);
	await expect(page.locator('#create-ncr')).toHaveCount(0);
	await expect(page.locator('#create-safety-observation')).toHaveCount(0);

	await page.goto('/assets');
	await expect(page.getByRole('heading', { name: 'Assets & facilities', exact: true, level: 1 })).toBeVisible();
	await expect(page.locator('#create-facility')).toHaveCount(0);
	await expect(page.locator('#create-building')).toHaveCount(0);
	await expect(page.locator('#create-level')).toHaveCount(0);
	await expect(page.locator('#create-space')).toHaveCount(0);
	await expect(page.locator('#create-asset-type')).toHaveCount(0);
	await expect(page.locator('#create-asset')).toHaveCount(0);
	await expect(page.locator('#create-maintenance-request')).toHaveCount(0);
	await expect(page.locator('#create-maintenance-plan')).toHaveCount(0);

	await page.goto('/finance/accounting/periods');
	await expect(page.getByRole('heading', { name: 'Accounting periods', level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Create financial year' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Soft close' })).toHaveCount(0);

	await page.goto('/portal');
	await expect(page.getByRole('heading', { name: 'Shared work' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Manage sharing' })).toHaveCount(0);
});
