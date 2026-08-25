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

test.describe.configure({ mode: 'serial' });

test('owner creates and filters a CRM organisation through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/crm');

	await page.getByLabel('Legal name').fill('E2E Customer Ltd');
	await page.getByLabel('Trading name').fill('E2E Customer');
	await page.locator('input[name="organisationEmail"]').fill('accounts-e2e@example.test');
	await page.locator('input[name="organisationPhone"]').fill('+442071234567');
	await page.locator('input[name="contactGivenNames"]').fill('Alex');
	await page.locator('input[name="contactFamilyName"]').fill('Customer');
	await page.locator('input[name="contactEmail"]').fill('customer-e2e@example.test');
	await page.locator('input[name="contactPhone"]').fill('+447700900001');
	await page.locator('input[name="contactJobTitle"]').fill('Commercial Director');
	await page.getByLabel('Client', { exact: true }).check();
	await page.getByRole('button', { name: 'Create CRM record' }).click();

	await expect(page).toHaveURL(/\/crm\/[0-9a-f-]+$/i);
	await expect(page.getByRole('heading', { name: 'E2E Customer', level: 1 })).toBeVisible();
	await expect(page.getByText('Alex Customer', { exact: true })).toBeVisible();

	await page.goto('/crm');
	await page.getByLabel('Search').fill('E2E Customer Ltd');
	await page.getByRole('button', { name: 'Filter' }).click();
	await expect(page.getByRole('link', { name: /E2E Customer/ })).toBeVisible();
});

test('owner creates an opportunity and estimate through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/crm/opportunities');

	await page.getByLabel('Title').fill('E2E Office Refurbishment');
	await page.getByLabel('Client organisation').selectOption({ label: 'E2E Customer' });
	await expect(page.getByLabel(/Client contact/)).toContainText('Use CRM primary contact');
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
		.selectOption({ label: 'E2E Office Refurbishment · E2E Customer · GBP' });
	await page.getByRole('button', { name: 'Develop estimate' }).click();

	await expect(page).toHaveURL(/\/commercial\/estimates\/[0-9a-f-]+$/i);
	await expect(page.getByText('E2E Office Refurbishment', { exact: true }).first()).toBeVisible();
});

test('owner takes commercial evidence through executed contract and project mobilisation', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/commercial/estimates');
	await page.getByRole('link', { name: /E2E Office Refurbishment/ }).click();

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
	await page.getByLabel('Recipient name').fill('Alex Customer');
	await page.getByLabel('Recipient email').fill('customer-e2e@example.test');
	await page.getByLabel('Issue note').fill('Issued by browser acceptance validation.');
	await page.getByRole('button', { name: 'Issue quotation version 1' }).click();

	await page.getByLabel('Response').selectOption('accepted');
	await page.getByLabel('Respondent name').fill('Alex Customer');
	await page.getByLabel('Respondent email').fill('customer-e2e@example.test');
	await page.getByRole('button', { name: 'Record response' }).click();
	await expect(page.getByText('Accepted', { exact: true }).first()).toBeVisible();

	await page.goto('/commercial/quotations');
	await page.getByRole('link', { name: 'Project conversion' }).click();
	await expect(page).toHaveURL(/\/contracts\/new\?quotation=[0-9a-f-]+&version=1$/i);
	await page.getByLabel('Customer reference').fill('E2E-CONTRACT-001');
	await page.getByRole('button', { name: 'Form draft contract' }).click();

	await expect(page).toHaveURL(/\/contracts\/[0-9a-f-]+$/i);
	const contractPublicId = page.url().split('/').at(-1);
	expect(contractPublicId).toMatch(/^[0-9a-f-]+$/i);

	await page.getByLabel('Recipient email').fill('customer-e2e@example.test');
	await page.getByLabel('Note').fill('Contract issued by browser acceptance validation.');
	await page.getByRole('button', { name: 'Issue contract' }).click();

	await page.getByLabel('Executed at').fill('2026-08-19T10:00');
	await page.getByLabel('Signatory name').fill('E2E Customer Signatory');
	await page.getByLabel('Signatory email').fill('customer-e2e@example.test');
	await page.getByLabel('Signing role').fill('Director');
	await page.getByRole('button', { name: 'Record execution' }).click();
	await expect(page.getByText('Executed', { exact: true })).toBeVisible();

	await page.goto(`/contracts/${contractPublicId}/mobilise`);
	await page.getByRole('button', { name: 'Mobilise project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	await expect(page.locator('.project-header .status')).toHaveText('Active');
});

test('owner completes invoice, receipt and cash allocation through the browser', async ({
	page
}) => {
	await signIn(page);

	await page.goto('/finance/billing');
	await page.getByLabel('Name').fill('E2E Net 30');
	await page.getByLabel('Days offset').fill('30');
	await page.getByLabel('Make default').check();
	await page.getByRole('button', { name: 'Add payment term' }).click();
	await expect(page.getByText('E2E Net 30', { exact: true }).first()).toBeVisible();

	await page.goto('/finance/tax');
	await page.getByLabel('Code').fill('E2E_VAT20');
	await page.getByLabel('Name').fill('E2E VAT 20');
	await page.getByLabel('Treatment').selectOption('taxable');
	await page.getByLabel('Rate %', { exact: true }).fill('20');
	await page.getByRole('button', { name: 'Add tax category' }).click();
	await expect(page.getByText('E2E VAT 20', { exact: true })).toBeVisible();

	await page.goto('/finance/invoices');
	await page.getByRole('button', { name: 'Create draft invoice' }).click();
	await expect(page).toHaveURL(/\/finance\/invoices\/[0-9a-f-]+$/i);

	await page.getByLabel('Description').fill('Office refurbishment works');
	await page.getByLabel('Quantity').fill('1');
	await page.getByLabel('Unit rate').fill('125000.00');
	const taxSelect = page.getByLabel('Tax');
	const e2eTaxValue = await taxSelect
		.locator('option', { hasText: 'E2E VAT 20' })
		.getAttribute('value');
	expect(e2eTaxValue).not.toBeNull();
	await taxSelect.selectOption(e2eTaxValue ?? '');
	await page.getByRole('button', { name: 'Add line' }).click();
	await expect(page.getByText('Office refurbishment works', { exact: true })).toBeVisible();

	await page.getByLabel('Recipient name').fill('E2E Customer');
	await page.getByLabel('Recipient email').fill('customer-e2e@example.test');
	await page.getByLabel('Issue note').fill('Invoice issued by browser acceptance validation.');
	await page.getByRole('button', { name: 'Issue invoice' }).click();
	await expect(page.getByText('issued', { exact: true }).first()).toBeVisible();

	await page.goto('/finance/payments');
	await page.getByLabel('Payment method').selectOption({ index: 1 });
	await page.getByLabel('Amount').fill('150000.00');
	await page.getByLabel('Currency').fill('GBP');
	await page.getByLabel('Payment reference').fill('E2E-RECEIPT-001');
	await page.getByLabel('Payer').selectOption({ label: 'E2E Customer' });
	await page.getByRole('button', { name: 'Record payment' }).click();
	await expect(page).toHaveURL(/\/finance\/payments\/[0-9a-f-]+$/i);

	await page.getByLabel('Invoice').selectOption({ index: 1 });
	await page.getByLabel('Amount').fill('150000.00');
	await page.getByRole('button', { name: 'Allocate payment' }).click();
	await expect(page.getByText('Active allocation', { exact: true }).first()).toBeVisible();
});
