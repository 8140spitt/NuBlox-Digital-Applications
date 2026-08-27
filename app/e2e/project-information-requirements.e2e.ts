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

test('owner creates and governs a project information requirement workspace', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-INFO-${suffix}`;
	const projectName = `Information governance ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm
		.getByLabel(/Description/)
		.fill('Browser acceptance for governed project information requirements and CDE evidence.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/information`);
	await expect(page.getByRole('heading', { name: 'Information requirements', level: 1 })).toBeVisible();
	await expect(page.getByText('Controlled register')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open CDE register' })).toBeVisible();

	const createPanel = page.getByText('Create requirement', { exact: true });
	await expect(createPanel).toBeVisible();
	const createForm = page.locator('form[action="?/createRequirement"]');
	await createForm.getByLabel('Requirement code').fill(`PIR-${suffix}`);
	await createForm.getByLabel('Type').selectOption('PIR');
	await createForm.getByLabel('Title').fill('Coordinated design information');
	await createForm
		.getByLabel('Description')
		.fill('Provide coordinated design information through the controlled project CDE.');
	await createForm.getByLabel('Required by').fill('2026-09-30');
	await createForm.getByRole('button', { name: 'Create draft requirement' }).click();

	await expect(page.getByRole('heading', { name: 'Coordinated design information', level: 2 })).toBeVisible();
	await expect(page.getByText(`PIR-${suffix}`, { exact: true }).first()).toBeVisible();
	await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'RACI assignments', level: 3 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Controlled information evidence', level: 3 })).toBeVisible();
	await expect(page.getByText('Approve controlled requirement')).toBeVisible();
});