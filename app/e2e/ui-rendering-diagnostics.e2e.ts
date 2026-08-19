import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const WORKSPACES = [
	'/dashboard',
	'/crm',
	'/crm/opportunities',
	'/commercial/estimates',
	'/commercial/quotations',
	'/projects',
	'/contracts',
	'/finance/invoices',
	'/finance/payments',
	'/finance/receivables',
	'/finance/collections',
	'/finance/collections/automation',
	'/finance/credit-control',
	'/finance/bad-debt',
	'/finance/tax',
	'/finance/tax-relief',
	'/finance/billing',
	'/finance/accounting',
	'/finance/accounting/periods',
	'/finance/accounting/reports',
	'/finance/accounting/year-end',
	'/organisation'
];

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

function captureFatalBrowserDiagnostics(page: Page) {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') errors.push(`console: ${message.text()}`);
	});
	page.on('response', (response) => {
		if (response.status() >= 500) {
			errors.push(`http ${response.status()}: ${response.url()}`);
		}
	});
	return errors;
}

async function verifyWorkspaceSurface(page: Page, errors: string[]) {
	for (const workspace of WORKSPACES) {
		await page.goto(workspace);
		expect(new URL(page.url()).pathname).toBe(workspace);
		await expect(page.locator('body')).not.toContainText('Internal Server Error');
		const overflow = await page.evaluate(
			() =>
				Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
				window.innerWidth
		);
		expect(
			overflow,
			`unexpected page-level horizontal overflow on ${workspace}`
		).toBeLessThanOrEqual(1);
	}
	expect(errors, errors.join('\n')).toEqual([]);
}

test('desktop workspaces render without browser errors or page overflow', async ({ page }) => {
	const errors = captureFatalBrowserDiagnostics(page);
	await page.setViewportSize({ width: 1440, height: 900 });
	await signIn(page);
	await verifyWorkspaceSurface(page, errors);
});

test('mobile workspaces render without browser errors or page overflow', async ({ page }) => {
	const errors = captureFatalBrowserDiagnostics(page);
	await page.setViewportSize({ width: 390, height: 844 });
	await signIn(page);
	await verifyWorkspaceSurface(page, errors);
});

test('server-side form validation is surfaced visibly to the user', async ({ page }) => {
	await signIn(page);
	await page.goto('/finance/tax');
	await page.getByLabel('Code').fill('E2E_INVALID_TAX');
	await page.getByLabel('Name').fill('E2E Invalid Tax');
	await page.getByLabel('Treatment').selectOption('taxable');
	await page.getByRole('button', { name: 'Add tax category' }).click();
	await expect(page.getByRole('alert')).toBeVisible();
});
