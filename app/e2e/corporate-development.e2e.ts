import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const OWNER = 'NuBlox E2E Owner';

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('F04 creates a corporate-development opportunity and valuation', async ({ page }) => {
	await signIn(page);
	await page.goto('/corporate-development');
	await expect(page.getByRole('heading', { name: 'Corporate Development command centre', level: 1 })).toBeVisible();
	await expect(page.getByText('F04 · Corporate Development & M&A')).toBeVisible();

	const opportunity = page.locator('form[action="?/createOpportunity"]');
	await opportunity.getByLabel('Code').fill('F04-E2E');
	await opportunity.getByLabel('Title').fill('E2E strategic acquisition');
	await opportunity.getByLabel('Deal type').selectOption('acquisition');
	await opportunity.getByLabel('Target / partner').fill('E2E Target Ltd');
	await opportunity.getByLabel('Owner').selectOption({ label: OWNER });
	await opportunity.getByLabel('Priority').selectOption('high');
	await opportunity.getByLabel('Identified on').fill('2026-09-10');
	await opportunity.getByLabel('Strategic thesis').fill('Acquire capability that accelerates the governed enterprise strategy.');
	await opportunity.getByLabel('Strategic rationale').fill('Adds capability, improves market position and creates measurable enterprise value.');
	await opportunity.getByRole('button', { name: 'Create opportunity' }).click();

	await expect(page.getByRole('heading', { name: 'E2E strategic acquisition', level: 2 })).toBeVisible();
	await expect(page.getByText('E2E Target Ltd', { exact: false }).first()).toBeVisible();

	const valuation = page.locator('form[action="?/createValuation"]');
	await valuation.getByLabel('Code').fill('VAL-E2E');
	await valuation.getByLabel('Title').fill('Initial investment case');
	await valuation.getByLabel('Valuation date').fill('2026-09-10');
	await valuation.getByLabel('Currency').fill('GBP');
	await valuation.getByLabel('Method').selectOption('dcf');
	await valuation.getByLabel('EV low').fill('9000000');
	await valuation.getByLabel('EV base').fill('10000000');
	await valuation.getByLabel('EV high').fill('11500000');
	await valuation.getByLabel('Equity base').fill('8500000');
	await valuation.getByLabel('Recommendation').fill('Proceed to due diligence subject to downside protection and governance approval.');
	await valuation.getByRole('button', { name: 'Create valuation' }).click();

	await expect(page.getByText('VAL-E2E v1', { exact: false })).toBeVisible();
	await expect(page.getByText('10000000', { exact: false })).toBeVisible();
});
