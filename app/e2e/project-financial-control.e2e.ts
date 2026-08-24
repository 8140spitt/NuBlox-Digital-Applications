import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
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

test('owner snapshots project financial position and approves reconciled cash flow', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-FIN-${suffix}`;
	const projectName = `Financial control ${suffix}`;
	const costCode = `FIN-${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm.getByLabel(/Description/).fill('Browser acceptance project financial control.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(
		`/commercial/cost-control?project=${encodeURIComponent(projectPublicId)}#create-cost-code`
	);
	const costCodePanel = page.locator('#create-cost-code');
	await costCodePanel.getByLabel('Cost category').selectOption('material');
	await costCodePanel.getByLabel('Cost code').fill(costCode);
	await costCodePanel.getByLabel('Name').fill('Forecast materials');
	await costCodePanel.getByRole('button', { name: 'Create cost code' }).click();
	await expect(page).toHaveURL(
		new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`)
	);

	const budgetPanel = page.locator('#create-budget');
	await budgetPanel.getByLabel('Cost code').selectOption({ label: `${costCode} · Forecast materials` });
	await budgetPanel.getByLabel('Budget name').fill(`Forecast baseline ${suffix}`);
	await budgetPanel.getByLabel('Budget amount').fill('5000.00');
	await budgetPanel.getByRole('button', { name: 'Create budget draft' }).click();
	await expect(page).toHaveURL(
		new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`)
	);
	let budgetCard = page
		.locator('#budget-register .budget-card')
		.filter({ hasText: `Forecast baseline ${suffix}` });
	await budgetCard.getByRole('button', { name: 'Approve baseline budget' }).click();
	await expect(page).toHaveURL(
		new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`)
	);
	budgetCard = page
		.locator('#budget-register .budget-card')
		.filter({ hasText: `Forecast baseline ${suffix}` });
	await expect(budgetCard.getByText('approved', { exact: true })).toBeVisible();

	await page.goto(`/projects/${projectPublicId}/financials`);
	await expect(page.getByRole('heading', { name: 'Project financial control', level: 1 })).toBeVisible();
	await expect(page.locator('.metrics article').filter({ hasText: 'Control budget' })).toContainText(
		'£5,000.00'
	);

	const periodForm = page.locator('#create-financial-period');
	await periodForm.getByLabel('Period label').fill(`August ${suffix}`);
	await periodForm.getByLabel('Start').fill('2026-08-01');
	await periodForm.getByLabel('End').fill('2026-08-31');
	await periodForm.getByRole('button', { name: 'Create reporting period' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/financials`);
	await expect(page.locator('.period-list').getByText(`August ${suffix}`, { exact: true })).toBeVisible();

	const forecastForm = page.locator('#create-financial-forecast');
	await forecastForm.getByLabel('Open reporting period').selectOption({ label: `August ${suffix}` });
	await forecastForm.getByLabel('Forecast project revenue').fill('7500.00');
	await forecastForm.getByRole('button', { name: 'Create forecast snapshot' }).click();
	await expect(page).toHaveURL(/\/financials\?forecast=[0-9a-f-]+$/i);
	const forecastPublicId = new URL(page.url()).searchParams.get('forecast')!;
	await expect(page.getByRole('heading', { name: 'Forecast V1', level: 2 })).toBeVisible();
	await expect(
		page.locator('.forecast-metrics article').filter({ hasText: 'Forecast to complete' })
	).toContainText('£5,000.00');
	await expect(
		page.locator('.forecast-metrics article').filter({ hasText: 'Forecast margin' })
	).toContainText('£2,500.00');

	const cashForm = page.locator('#cash-flow-plan form[action="?/addCashFlow"]');
	await cashForm.getByLabel('Date').fill('2026-09-30');
	await cashForm.getByLabel('Direction').selectOption('outflow');
	await cashForm.getByLabel('Category').selectOption('material');
	await cashForm.getByLabel('Cost code (optional)').selectOption({ label: `${costCode} · Forecast materials` });
	await cashForm.getByLabel('Amount').fill('5000.00');
	await cashForm.getByLabel('Cash-flow commentary').fill('Completion materials forecast.');
	await cashForm.getByRole('button', { name: 'Add cash-flow line' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/financials?forecast=${forecastPublicId}`);
	await expect(page.locator('.cash-metrics article').filter({ hasText: 'Outflow vs FTC' })).toContainText(
		'Reconciled'
	);

	await page.getByRole('button', { name: 'Approve & lock forecast' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/financials?forecast=${forecastPublicId}`);
	await expect(page.getByText('approved', { exact: true }).first()).toBeVisible();
	await expect(page.locator('.cash-metrics article').filter({ hasText: 'Planned outflow' })).toContainText(
		'£5,000.00'
	);
	await expect(page.locator('.forecast-line')).toContainText('EAC £5,000.00');
});
