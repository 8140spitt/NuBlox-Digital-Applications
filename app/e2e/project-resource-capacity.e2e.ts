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

test('owner staffs a project-plan activity and inspects governed capacity', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-RES-${suffix}`;
	const projectName = `Resource capacity ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm.getByLabel(/Description/).fill('Browser acceptance resource-capacity project.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/plan`);
	const wbsForm = page.locator('form[action="?/createWbs"]');
	await wbsForm.getByLabel('WBS code').fill('2.1');
	await wbsForm.getByLabel('Name').fill('Resource-loaded works');
	await wbsForm.getByRole('button', { name: 'Create WBS node' }).click();

	const activityForm = page.locator('form[action="?/createActivity"]');
	await activityForm.getByLabel('WBS node').selectOption({ label: '2.1 · Resource-loaded works' });
	await activityForm.getByLabel('Type').selectOption('activity');
	await activityForm.getByLabel('Activity code').fill('R100');
	await activityForm.getByLabel('Name').fill('Install resource-loaded scope');
	await activityForm.getByLabel('Planned start').fill('2026-09-07');
	await activityForm.getByLabel('Planned finish').fill('2026-09-11');
	await activityForm.getByLabel('Duration (days)').fill('5');
	await activityForm.getByRole('button', { name: 'Create activity / milestone' }).click();
	await expect(page.getByRole('cell', { name: 'R100' })).toBeVisible();

	await page.goto('/people');
	const staffingForm = page.locator('form[action="?/assignProject"]');
	await staffingForm.getByLabel('Worker').selectOption({ label: 'NuBlox E2E Owner' });
	await staffingForm
		.getByLabel('Project')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await staffingForm.getByLabel('Starts').fill('2026-09-01');
	await staffingForm.getByLabel('Ends').fill('2026-09-30');
	await staffingForm.getByLabel('Planned allocation %').fill('50');
	await staffingForm.getByRole('button', { name: 'Create assignment' }).click();
	await expect(page.getByRole('cell', { name: projectNumber })).toBeVisible();

	await page.goto(`/projects/${projectPublicId}/resources`);
	await expect(
		page.getByRole('heading', { name: 'Resource loading & capacity', level: 1 })
	).toBeVisible();
	await expect(page.getByText('NuBlox E2E Owner', { exact: true }).first()).toBeVisible();

	const loadForm = page.locator('form[action="?/createAllocation"]');
	await loadForm
		.getByLabel('Activity')
		.selectOption({ label: /R100 · Install resource-loaded scope/ });
	const resourceSelect = loadForm.getByLabel('Project resource');
	const resourceOption = resourceSelect.locator('option', { hasText: 'NuBlox E2E Owner' });
	const resourceAssignmentPublicId = await resourceOption.getAttribute('value');
	expect(resourceAssignmentPublicId).toBeTruthy();
	await resourceSelect.selectOption(resourceAssignmentPublicId ?? '');
	await loadForm.getByLabel('Planned effort (hours)').fill('20');
	await loadForm.getByLabel('Load start').fill('2026-09-07');
	await loadForm.getByLabel('Load finish').fill('2026-09-11');
	await loadForm.getByLabel('Planning note').fill('Browser acceptance planned demand.');
	await loadForm.getByRole('button', { name: 'Add resource load' }).click();
	await expect(page).toHaveURL(`/projects/${projectPublicId}/resources`);

	const allocation = page.locator('.allocation-card').filter({ hasText: 'R100' });
	await expect(allocation).toContainText('NuBlox E2E Owner');
	await expect(allocation).toContainText('20 h planned effort');
	await expect(page.getByText('Capacity calendar not configured', { exact: true })).toBeVisible();
	await expect(
		page.locator('.summary-grid article').filter({ hasText: 'Planned load' })
	).toContainText('20 h');
	await expect(
		page.locator('.summary-grid article').filter({ hasText: 'Capacity not configured' })
	).toContainText('1');
});
