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
	await page.getByLabel('Pipeline stage').selectOption({ index: 1 });
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
		.selectOption({ label: 'E2E Office Refurbishment · E2E Customer Ltd' });
	await page.getByLabel('Estimate title').fill('E2E Office Refurbishment Estimate');
	await page.getByLabel('Currency').fill('GBP');
	await page.getByLabel('Notes').fill('Created by full browser acceptance validation.');
	await page.getByRole('button', { name: 'Create estimate' }).click();

	await expect(page).toHaveURL(/\/commercial\/estimates\/[0-9a-f-]+$/i);
	await expect(
		page.getByText('E2E Office Refurbishment Estimate', { exact: true }).first()
	).toBeVisible();
});

test('owner takes commercial evidence through project and executed contract', async ({ page }) => {
	await signIn(page);
	await page.goto('/commercial/estimates');
	await page.getByRole('link', { name: /E2E Office Refurbishment Estimate/ }).click();

	await page.getByLabel('Description').fill('Office refurbishment works');
	await page.getByLabel('Quantity').fill('1');
	await page.getByLabel('Sell unit rate').fill('125000.00');
	await page.getByRole('button', { name: 'Add estimate line' }).click();
	await expect(page.getByText('Office refurbishment works', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Finalise version 1' }).click();
	await expect(page.getByRole('button', { name: 'Create quotation' })).toBeVisible();
	await page.getByLabel('Quotation title').fill('E2E Office Refurbishment Quotation');
	await page.getByLabel('Customer reference').fill('E2E-PO-001');
	await page.getByLabel('Valid until').fill('2026-12-31');
	await page.getByRole('button', { name: 'Create quotation' }).click();

	await expect(page).toHaveURL(/\/commercial\/quotations\/[0-9a-f-]+$/i);
	await page.getByLabel('Recipient name').fill('E2E Customer');
	await page.getByLabel('Recipient email').fill('customer-e2e@example.test');
	await page.getByLabel('Issue note').fill('Issued by browser acceptance validation.');
	await page.getByRole('button', { name: 'Issue quotation version 1' }).click();

	await page.getByLabel('Response').selectOption('accepted');
	await page.getByLabel('Respondent name').fill('E2E Customer');
	await page.getByLabel('Respondent email').fill('customer-e2e@example.test');
	await page.getByRole('button', { name: 'Record response' }).click();
	await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible();

	await page.goto('/commercial/quotations');
	await page.getByRole('link', { name: 'Project conversion' }).click();
	await page.getByRole('button', { name: 'Create project from accepted quotation' }).click();
	await expect(page.getByText('Conversion complete', { exact: true })).toBeVisible();

	await page.goto('/contracts');
	await page.getByRole('link', { name: 'Form contract' }).click();
	await page.getByLabel('Customer reference').fill('E2E-CONTRACT-001');
	await page.getByRole('button', { name: 'Create draft contract' }).click();

	await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]+$/i);
	await page.getByLabel('Recipient email').fill('customer-e2e@example.test');
	await page.getByLabel('Note').fill('Contract issued by browser acceptance validation.');
	await page.getByRole('button', { name: 'Issue contract' }).click();

	await page.getByLabel('Executed at').fill('2026-08-19T10:00');
	await page.getByLabel('Signatory name').fill('E2E Customer Signatory');
	await page.getByLabel('Signatory email').fill('customer-e2e@example.test');
	await page.getByLabel('Signing role').fill('Director');
	await page.getByRole('button', { name: 'Record execution' }).click();
	await expect(page.getByText('Executed', { exact: true })).toBeVisible();
});
