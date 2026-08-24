import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signInAsOwner(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('owner creates native portfolio and programme structure from Projects', async ({ page }) => {
	await signInAsOwner(page);
	await page.goto('/projects');

	await expect(
		page.getByRole('heading', { name: 'Portfolio & programme structure', level: 2 })
	).toBeVisible();
	await expect(page.getByText('Portfolio → Programme → Project')).toBeVisible();

	const suffix = Date.now().toString().slice(-7);
	const portfolioNumber = `E2E-PORT-${suffix}`;
	const portfolioName = `E2E Capital Portfolio ${suffix}`;
	const programmeNumber = `E2E-PROG-${suffix}`;
	const programmeName = `E2E Delivery Programme ${suffix}`;

	const portfolioForm = page.locator('form[action="?/createPortfolio"]');
	await portfolioForm.getByLabel('Portfolio number').fill(portfolioNumber);
	await portfolioForm.getByLabel('Portfolio name').fill(portfolioName);
	await portfolioForm.getByRole('button', { name: 'Create portfolio' }).click();
	await expect(page.getByRole('heading', { name: portfolioName, level: 3 })).toBeVisible();

	const programmeForm = page.locator('form[action="?/createProgramme"]');
	await programmeForm.getByLabel('Programme number').fill(programmeNumber);
	await programmeForm.getByLabel('Programme name').fill(programmeName);
	await programmeForm
		.getByLabel('Portfolio')
		.selectOption({ label: `${portfolioNumber} · ${portfolioName}` });
	await programmeForm.getByRole('button', { name: 'Create programme' }).click();

	const portfolioCard = page.locator('.portfolio-card').filter({ hasText: portfolioName });
	await expect(portfolioCard).toContainText(programmeNumber);
	await expect(portfolioCard).toContainText(programmeName);
	await expect(page.locator('body')).not.toContainText('Internal Server Error');
});
