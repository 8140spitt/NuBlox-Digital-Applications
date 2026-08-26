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

test('owner governs a project change from identification to closure', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-CHANGE-${suffix}`;
	const projectName = `Change control ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm
		.getByLabel(/Description/)
		.fill('Browser acceptance for controlled project change governance.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/changes`);
	await expect(
		page.getByRole('heading', { name: 'Controlled project change', level: 1 })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Project changes', level: 2 })).toBeVisible();

	const raiseForm = page.locator('form[action="?/createChange"]');
	await raiseForm.getByLabel('Change type').selectOption('client_request');
	await raiseForm.getByLabel('Title').fill('Add enhanced acoustic lining');
	await raiseForm
		.getByLabel('Description')
		.fill('Client request affects partition scope, programme, cost and design information.');
	await raiseForm.getByRole('button', { name: 'Raise change' }).click();

	await expect(
		page.getByRole('heading', { name: 'Add enhanced acoustic lining', level: 2 })
	).toBeVisible();
	await expect(page.locator('.change-list').getByText(/CHG-\d+/)).toBeVisible();
	await expect(page.getByText('identified', { exact: true }).first()).toBeVisible();

	const assessmentForm = page.locator('form[action="?/saveAssessment"]');
	await assessmentForm.getByLabel('Scope impact').selectOption('confirmed');
	await assessmentForm
		.getByLabel('Assessment')
		.nth(0)
		.fill('Partition build-up changes in the affected rooms.');
	await assessmentForm.getByLabel('Programme impact').selectOption('potential');
	await assessmentForm
		.getByLabel('Assessment')
		.nth(1)
		.fill('Material lead time could move second-fix dates.');
	await assessmentForm.getByLabel('Cost impact').selectOption('confirmed');
	await assessmentForm
		.getByLabel('Assessment')
		.nth(2)
		.fill('Additional acoustic board and labour are required.');
	await assessmentForm.getByLabel('Contract impact').selectOption('potential');
	await assessmentForm
		.getByLabel('Assessment')
		.nth(3)
		.fill('Client variation evidence is required.');
	await assessmentForm.getByLabel('Information impact').selectOption('confirmed');
	await assessmentForm
		.getByLabel('Assessment')
		.nth(4)
		.fill('Partition drawings and specification need revision.');
	await assessmentForm.getByLabel('Estimated cost delta').fill('4500.00');
	await assessmentForm.getByLabel('Currency').fill('GBP');
	await assessmentForm.getByLabel('Estimated time delta (days)').fill('2.00');
	await assessmentForm.getByRole('button', { name: 'Save impact assessment' }).click();

	await expect(page.getByRole('heading', { name: 'Assessment v1', level: 3 })).toBeVisible();
	await expect(page.getByText('4500.00', { exact: false })).toBeVisible();
	await page.getByRole('button', { name: 'Submit assessment for decision' }).click();
	await expect(page.getByText('under review', { exact: true }).first()).toBeVisible();

	const decisionForm = page.locator('form[action="?/decideChange"]');
	await decisionForm.getByLabel('Decision').selectOption('accepted_with_conditions');
	await decisionForm
		.getByLabel('Rationale')
		.fill('Proceed to preserve client value and coordinate the revised technical solution.');
	await decisionForm
		.getByLabel('Conditions')
		.fill('Revised information must be issued before installation and commercial change recorded.');
	await decisionForm.getByRole('button', { name: 'Record decision' }).click();
	await expect(page.getByText('accepted', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('accepted with conditions', { exact: true })).toBeVisible();

	const implementationForm = page.locator('form[action="?/recordImplementation"]');
	await implementationForm.getByLabel('Implemented on').fill('2026-08-26');
	await implementationForm
		.getByLabel('Implementation evidence')
		.fill('Scope, programme, commercial position and revised design information were updated.');
	await implementationForm.getByRole('button', { name: 'Record as implemented' }).click();
	await expect(page.getByText('implemented', { exact: true }).first()).toBeVisible();
	await expect(
		page.getByText(
			'Scope, programme, commercial position and revised design information were updated.'
		)
	).toBeVisible();

	await page.getByRole('button', { name: 'Close change' }).click();
	await expect(page.getByText('closed', { exact: true }).first()).toBeVisible();
});
