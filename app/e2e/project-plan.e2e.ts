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

test('owner builds a governed WBS schedule network and captures an immutable baseline', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-PLAN-${suffix}`;
	const projectName = `Project controls ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm
		.getByLabel(/Description/)
		.fill('Browser acceptance project for controlled planning.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/plan`);
	await expect(page.getByRole('heading', { name: 'Project plan', level: 1 })).toBeVisible();

	const wbsForm = page.locator('form[action="?/createWbs"]');
	await wbsForm.getByLabel('WBS code').fill('1.1');
	await wbsForm.getByLabel('Name').fill('Substructure');
	await wbsForm.getByLabel('WBS description').fill('Controlled substructure scope.');
	await wbsForm.getByRole('button', { name: 'Create WBS node' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/plan`);
	await expect(page.getByText('1.1', { exact: true }).first()).toBeVisible();

	let activityForm = page.locator('form[action="?/createActivity"]');
	await activityForm.getByLabel('WBS node').selectOption({ label: '1.1 · Substructure' });
	await activityForm.getByLabel('Type').selectOption('activity');
	await activityForm.getByLabel('Activity code').fill('A100');
	await activityForm.getByLabel('Name').fill('Excavate foundations');
	await activityForm.getByLabel('Planned start').fill('2026-09-01');
	await activityForm.getByLabel('Planned finish').fill('2026-09-05');
	await activityForm.getByLabel('Duration (days)').fill('5');
	await activityForm.getByRole('button', { name: 'Create activity / milestone' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/plan`);

	activityForm = page.locator('form[action="?/createActivity"]');
	await activityForm.getByLabel('WBS node').selectOption({ label: '1.1 · Substructure' });
	await activityForm.getByLabel('Type').selectOption('milestone');
	await activityForm.getByLabel('Activity code').fill('M200');
	await activityForm.getByLabel('Name').fill('Foundations complete');
	await activityForm.getByLabel('Planned start').fill('2026-09-05');
	await activityForm.getByLabel('Planned finish').fill('2026-09-05');
	await activityForm.getByLabel('Duration (days)').fill('0');
	await activityForm.getByRole('button', { name: 'Create activity / milestone' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/plan`);
	await expect(page.getByRole('cell', { name: 'A100' })).toBeVisible();
	await expect(page.getByRole('cell', { name: 'M200' })).toBeVisible();

	const dependencyForm = page.locator('form[action="?/addDependency"]');
	await dependencyForm
		.getByLabel('Predecessor')
		.selectOption({ label: 'A100 · Excavate foundations' });
	await dependencyForm
		.getByLabel('Successor')
		.selectOption({ label: 'M200 · Foundations complete' });
	await dependencyForm.getByLabel('Relationship').selectOption('FS');
	await dependencyForm.getByLabel('Lag (days)').fill('0');
	await dependencyForm.getByRole('button', { name: 'Add dependency' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/plan`);
	await expect(page.locator('.dependency-card').filter({ hasText: 'A100' })).toContainText('M200');

	const baselineForm = page.locator('form[action="?/captureBaseline"]');
	await baselineForm.getByLabel('Baseline name').fill('Contract baseline');
	await baselineForm
		.getByLabel('Baseline description')
		.fill('Approved schedule network captured through browser acceptance.');
	await baselineForm.getByRole('button', { name: 'Capture baseline' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/plan`);
	const baselineCard = page.locator('.baseline-card').filter({ hasText: 'Contract baseline' });
	await expect(baselineCard).toBeVisible();
	await expect(baselineCard).toContainText('2 activities/milestones · 1 dependencies');
	await expect(page.locator('.metrics article').filter({ hasText: 'Baselines' })).toContainText(
		'1'
	);
});
