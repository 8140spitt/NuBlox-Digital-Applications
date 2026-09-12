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

test('owner records and approves governed progress against a schedule-baseline activity', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-PRG-${suffix}`;
	const projectName = `Progress controls ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm
		.getByLabel(/Description/)
		.fill('Browser acceptance project progress and earned-value foundation.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/plan`);
	const wbsForm = page.locator('form[action="?/createWbs"]');
	await wbsForm.getByLabel('WBS code').fill('3.1');
	await wbsForm.getByLabel('Name').fill('Measured works');
	await wbsForm.getByRole('button', { name: 'Create WBS node' }).click();

	const activityForm = page.locator('form[action="?/createActivity"]');
	await activityForm.getByLabel('WBS node').selectOption({ label: '3.1 · Measured works' });
	await activityForm.getByLabel('Type').selectOption('activity');
	await activityForm.getByLabel('Activity code').fill('P100');
	await activityForm.getByLabel('Name').fill('Install measured scope');
	await activityForm.getByLabel('Planned start').fill('2026-09-01');
	await activityForm.getByLabel('Planned finish').fill('2026-09-10');
	await activityForm.getByLabel('Duration (days)').fill('10');
	await activityForm.getByRole('button', { name: 'Create activity / milestone' }).click();
	await expect(page.getByRole('cell', { name: 'P100' })).toBeVisible();

	const baselineForm = page.locator('form[action="?/captureBaseline"]');
	await baselineForm.getByLabel('Baseline name').fill('Progress contract programme');
	await baselineForm.getByRole('button', { name: 'Capture baseline' }).click();
	await expect(page.getByText('Progress contract programme', { exact: true })).toBeVisible();

	await page.goto(`/projects/${projectPublicId}/progress`);
	await expect(
		page.getByRole('heading', { name: 'Progress & earned value', level: 1 })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Progress periods', level: 2 })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Earned-value baselines', level: 2 })
	).toBeVisible();

	const periodForm = page.locator('form[action="?/createPeriod"]');
	await periodForm.getByLabel('Label').fill('September status 1');
	await periodForm.getByLabel('Data date').fill('2026-09-05');
	await periodForm.getByRole('button', { name: 'Create progress period' }).click();
	await expect(page).toHaveURL(/\/progress\?period=/);

	const activityCard = page
		.locator('.activity-card')
		.filter({ hasText: 'P100 · Install measured scope' });
	const progressForm = activityCard.locator('form[action="?/recordProgress"]');
	await progressForm.getByLabel('Method').selectOption('manual_percent');
	await progressForm.getByLabel('% complete').fill('40');
	await progressForm.getByLabel('Actual start').fill('2026-09-01');
	await progressForm.getByLabel('Remaining days').fill('6');
	await progressForm
		.getByLabel('Commentary')
		.fill('Measured physical progress from site evidence.');
	await progressForm.getByRole('button', { name: 'Save progress' }).click();
	await expect(activityCard).toContainText('40.0%');

	await page
		.locator('form[action="?/submitPeriod"]')
		.getByRole('button', { name: 'Submit period' })
		.click();
	await expect(page.getByRole('button', { name: 'Approve & lock' })).toBeVisible();
	await page
		.locator('form[action="?/approvePeriod"]')
		.getByRole('button', { name: 'Approve & lock' })
		.click();
	await expect(page.getByText(/September status 1.*approved/)).toBeVisible();
	await expect(activityCard.locator('form[action="?/recordProgress"]')).toHaveCount(0);
	await expect(activityCard).toContainText('Measured physical progress from site evidence.');
});
