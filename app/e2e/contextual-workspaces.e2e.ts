import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const PROJECT_NUMBER = 'PORTAL-E2E-001';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('project context stays pinned while moving between business functions', async ({ page }) => {
	await signIn(page);
	await page.goto('/my-work');
	await expect(page.getByRole('heading', { name: 'My work', level: 1 })).toBeVisible();

	const projectLink = page.getByRole('link', { name: new RegExp(PROJECT_NUMBER) });
	await expect(projectLink).toBeVisible();
	await projectLink.click();
	await expect(page).toHaveURL(/\/projects\/[^?]+\?project=/);

	const projectUrl = new URL(page.url());
	const projectPublicId = projectUrl.searchParams.get('project');
	expect(projectPublicId).toBeTruthy();

	const projectWorkspace = page.getByRole('navigation', { name: 'Project workspace' });
	await expect(projectWorkspace).toBeVisible();
	await expect(page.getByText(new RegExp(PROJECT_NUMBER)).first()).toBeVisible();

	await projectWorkspace.getByRole('link', { name: 'Documents', exact: true }).click();
	await expect(page).toHaveURL(`/documents?project=${projectPublicId}`);
	await expect(page.getByRole('navigation', { name: 'Project workspace' })).toBeVisible();
	await expect(page.getByText(new RegExp(PROJECT_NUMBER)).first()).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Project workspace' })
		.getByRole('link', { name: 'Commercial', exact: true })
		.click();
	await expect(page).toHaveURL(`/commercial/cost-control?project=${projectPublicId}`);
	await expect(page.getByRole('navigation', { name: 'Project workspace' })).toBeVisible();

	await page
		.getByRole('navigation', { name: 'Project workspace' })
		.getByRole('link', { name: 'Site', exact: true })
		.click();
	await expect(page).toHaveURL(`/site?project=${projectPublicId}`);
	await expect(page.getByRole('navigation', { name: 'Project workspace' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'All projects' })).toBeVisible();
});
