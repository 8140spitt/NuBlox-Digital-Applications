import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe.configure({ mode: 'serial' });

test('owner creates and filters a CRM organisation through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/crm');

	await page.getByLabel('Legal name').fill('E2E Customer Ltd');
	await page.getByLabel('Trading name').fill('E2E Customer');
	await page.getByLabel('Primary email').fill('customer-e2e@example.test');
	await page.getByLabel('Primary phone').fill('+442071234567');
	await page.getByRole('button', { name: 'Create CRM record' }).click();

	await expect(page).toHaveURL(/\/crm\/[0-9a-f-]+$/i);
	await expect(page.getByText('E2E Customer Ltd', { exact: true }).first()).toBeVisible();

	await page.goto('/crm');
	await page.getByLabel('Search').fill('E2E Customer Ltd');
	await page.getByRole('button', { name: 'Filter' }).click();
	await expect(page.getByRole('link', { name: /E2E Customer Ltd/ })).toBeVisible();
});

test('owner creates an opportunity and estimate through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/crm/opportunities');

	await page.getByLabel('Title').fill('E2E Office Refurbishment');
	await page.getByLabel('Primary customer').selectOption({ label: 'E2E Customer Ltd' });
	await page.getByLabel('Pipeline stage').selectOption({ label: /Lead/ });
	await page.getByLabel('Estimated value').fill('125000.00');
	await page.getByLabel('Currency').fill('GBP');
	await page.getByLabel('Expected close date').fill('2026-12-18');
	await page.getByLabel('Description').fill('Browser-created commercial opportunity.');
	await page.getByRole('button', { name: 'Create opportunity' }).click();

	await expect(page).toHaveURL(/\/crm\/opportunities\/[0-9a-f-]+$/i);
	await expect(page.getByText('E2E Office Refurbishment', { exact: true }).first()).toBeVisible();

	await page.goto('/commercial/estimates');
	await page
		.getByLabel('CRM opportunity')
		.selectOption({ label: /E2E Office Refurbishment · E2E Customer Ltd/ });
	await page.getByLabel('Estimate title').fill('E2E Office Refurbishment Estimate');
	await page.getByLabel('Currency').fill('GBP');
	await page.getByLabel('Notes').fill('Created by full browser acceptance validation.');
	await page.getByRole('button', { name: 'Create estimate' }).click();

	await expect(page).toHaveURL(/\/commercial\/estimates\/[0-9a-f-]+$/i);
	await expect(page.getByText('E2E Office Refurbishment Estimate', { exact: true }).first()).toBeVisible();
});
