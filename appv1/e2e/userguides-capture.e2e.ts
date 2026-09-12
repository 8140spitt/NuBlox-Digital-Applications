import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OWNER_EMAIL = 'e2e-owner@example.test';
const OWNER_PASSWORD = 'NuBlox-E2E-Password-2026!';
const OWNER_ORGANISATION = 'NuBlox E2E Organisation';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(currentDir, '../../docs/userguides/screenshots');

async function signInAsOwner(page: Page) {
	await page.goto('/signin');
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await capture(page, '01-sign-in.png');

	await page.getByLabel('Email', { exact: true }).fill(OWNER_EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(OWNER_PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await capture(page, '02-select-organisation.png');

	await page.getByRole('button', { name: new RegExp(OWNER_ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function capture(page: Page, name: string) {
	await page.waitForLoadState('networkidle');
	await page.setViewportSize({ width: 1600, height: 1000 });
	await page.screenshot({ path: path.join(screenshotsDir, name), fullPage: true });
}

async function selectFirstNonEmptyOption(select: Locator) {
	const values = await select
		.locator('option')
		.evaluateAll((options) =>
			options
				.map((option) => (option as HTMLOptionElement).value)
				.filter((value) => value && value.trim().length > 0)
		);
	if (values.length === 0) throw new Error('No selectable options were found.');
	await select.selectOption(values[0]);
}

test.skip(
	process.env.USERGUIDE_CAPTURE !== '1',
	'Set USERGUIDE_CAPTURE=1 to run screenshot capture.'
);

test('capture core user guide screenshots', async ({ page }) => {
	await mkdir(screenshotsDir, { recursive: true });
	await signInAsOwner(page);
	await capture(page, '03-dashboard-home.png');

	const workspaceTools = page.getByLabel('Workspace tools');
	const searchTool = workspaceTools.getByText('Search', { exact: true });
	const createTool = workspaceTools.getByText('Create', { exact: true });

	await searchTool.click();
	await page.getByLabel('Find a workspace').fill('procurement');
	await expect(page.locator('.search-results')).toContainText('Procurement');
	await capture(page, '04-workspace-search.png');
	await searchTool.click();

	await createTool.click();
	await expect(page.locator('.create-popover')).toBeVisible();
	await capture(page, '05-create-menu.png');
	await createTool.click();

	await page.goto('/projects');
	await expect(page.locator('body')).not.toContainText('Internal Server Error');
	await capture(page, '06-projects-workspace.png');

	await page.goto('/documents');
	await expect(page.locator('body')).not.toContainText('Internal Server Error');
	await capture(page, '07-documents-workspace.png');

	await page.goto('/finance');
	await expect(page.getByRole('heading', { name: 'Finance', level: 1 })).toBeVisible();
	await capture(page, '08-finance-workspace.png');

	await page.goto('/more');
	await expect(page.getByRole('heading', { name: 'More workspaces', level: 1 })).toBeVisible();
	await capture(page, '09-more-workspaces.png');

	await page.getByRole('link', { name: /Enterprise search/ }).click();
	await expect(page).toHaveURL(/\/search$/);
	await expect(page.getByRole('heading', { name: 'Enterprise search', level: 1 })).toBeVisible();
	await page.getByLabel('Search term').fill('project');
	await capture(page, '10-enterprise-search.png');

	await page.goto('/portal/manage');
	await expect(page.getByRole('heading', { name: 'Manage sharing' })).toBeVisible();
	await selectFirstNonEmptyOption(page.getByLabel('Project', { exact: true }));
	await capture(page, '11-portal-manage-sharing.png');

	for (const [route, image] of [
		['/my-work', '12-my-work.png'],
		['/projects', '13-projects.png'],
		['/crm', '14-crm-customers.png'],
		['/crm/opportunities', '15-crm-opportunities.png'],
		['/commercial/estimates', '16-commercial-estimates.png'],
		['/commercial/quotations', '17-commercial-quotations.png'],
		['/purchasing', '18-purchasing.png'],
		['/contracts', '19-contracts.png'],
		['/commercial/cost-control', '20-project-cost-control.png'],
		['/commercial/valuations', '21-valuations.png'],
		['/people', '22-people.png'],
		['/schedule', '23-schedule.png'],
		['/time', '24-time.png'],
		['/site', '25-site-quality-safety.png'],
		['/assets', '26-assets-facilities.png'],
		['/finance/invoices', '27-finance-invoices.png'],
		['/finance/payments', '28-finance-payments.png'],
		['/finance/receivables', '29-finance-receivables.png'],
		['/finance/collections', '30-finance-collections.png'],
		['/finance/collections/automation', '31-finance-collections-automation.png'],
		['/finance/credit-control', '32-finance-credit-control.png'],
		['/finance/bad-debt', '33-finance-bad-debt.png'],
		['/finance/tax', '34-finance-tax.png'],
		['/finance/tax-relief', '35-finance-tax-relief.png'],
		['/finance/billing', '36-finance-billing.png'],
		['/finance/accounting', '37-finance-accounting.png'],
		['/finance/accounting/periods', '38-finance-accounting-periods.png'],
		['/finance/accounting/reports', '39-finance-accounting-reports.png'],
		['/finance/accounting/year-end', '40-finance-year-end.png'],
		['/organisation', '41-organisation-settings.png'],
		['/contexts', '42-contexts.png'],
		['/capabilities', '43-capability-registry.png'],
		['/search', '44-enterprise-search-empty.png'],
		['/portal', '45-portal-shared-work.png']
	] as const) {
		await page.goto(route);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		await capture(page, image);
	}
});
