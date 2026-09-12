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

test('F05 governs portfolio, need, idea, investment and lifecycle design', async ({ page }) => {
	await signIn(page);
	await page.goto('/product-service');
	await expect(
		page.getByRole('heading', { name: 'Product, Service & Innovation command centre', level: 1 })
	).toBeVisible();
	await expect(page.getByText('F05 · Product, Service & Innovation Management')).toBeVisible();

	const portfolio = page.locator('form[action="?/createPortfolio"]');
	await portfolio.getByLabel('Code').fill('F05-E2E');
	await portfolio.getByLabel('Title').fill('E2E Product & Service Portfolio');
	await portfolio.getByLabel('Type').selectOption('service');
	await portfolio.getByLabel('Priority').selectOption('high');
	await portfolio.getByLabel('Owner').selectOption({ label: OWNER });
	await portfolio
		.getByLabel('Strategic thesis')
		.fill('Turn validated built-environment needs into governed service innovation.');
	await portfolio.getByRole('button', { name: 'Create portfolio' }).click();
	await expect(page.getByText('F05-E2E · E2E Product & Service Portfolio')).toBeVisible();

	const offering = page.locator('form[action="?/createOffering"]');
	await offering
		.getByLabel('Portfolio')
		.selectOption({ label: 'F05-E2E · E2E Product & Service Portfolio' });
	await offering.getByLabel('Code').fill('OFFER-E2E');
	await offering.getByLabel('Title').fill('E2E Lifecycle Assurance Service');
	await offering.getByLabel('Type').selectOption('service');
	await offering.getByLabel('Owner').selectOption({ label: OWNER });
	await offering
		.getByLabel('Value proposition')
		.fill('Provide a controlled evidence thread from need through launch and lifecycle review.');
	await offering.getByRole('button', { name: 'Create offering' }).click();
	await expect(page.getByText('OFFER-E2E · E2E Lifecycle Assurance Service')).toBeVisible();

	const need = page.locator('form[action="?/createNeed"]');
	await need.getByLabel('Portfolio').selectOption({ label: 'F05-E2E' });
	await need.getByLabel('Code').fill('NEED-E2E');
	await need.getByLabel('Title').fill('Governed lifecycle evidence');
	await need.getByLabel('Need type').selectOption('customer');
	await need.getByLabel('Source domain').fill('crm');
	await need.getByLabel('Source reference').fill('E2E customer discovery');
	await need.getByLabel('Evidence').selectOption('validated');
	await need.getByLabel('Urgency').selectOption('high');
	await need.getByLabel('Owner').selectOption({ label: OWNER });
	await need
		.getByLabel('Need statement')
		.fill('Customers need auditable lifecycle decisions linked to controlled evidence.');
	await need.getByRole('button', { name: 'Capture need' }).click();
	await expect(page.getByText('NEED-E2E · Governed lifecycle evidence')).toBeVisible();

	const idea = page.locator('form[action="?/createIdea"]');
	await idea.locator('select[name="portfolioPublicId"]').selectOption({ label: 'F05-E2E' });
	await idea.locator('select[name="needPublicId"]').selectOption({ label: /NEED-E2E/ });
	await idea.locator('input[name="ideaCode"]').fill('IDEA-E2E');
	await idea.locator('input[name="title"]').fill('Lifecycle assurance concept');
	await idea.locator('select[name="ideaType"]').selectOption('new_service');
	await idea
		.locator('textarea[name="problemStatement"]')
		.fill('Lifecycle evidence is fragmented across functions.');
	await idea
		.locator('textarea[name="proposedValue"]')
		.fill('Create a governed cross-domain lifecycle control thread.');
	await idea.locator('input[name="provenance"]').fill('customer_discovery');
	await idea.locator('select[name="ownerMemberId"]').selectOption({ label: OWNER });
	await idea.getByRole('button', { name: 'Submit idea' }).click();
	await expect(page.getByText('IDEA-E2E · Lifecycle assurance concept')).toBeVisible();

	const score = page
		.locator('form[action="?/scoreIdea"]')
		.filter({ has: page.locator('input[value]') })
		.first();
	await score.locator('input[name="strategicFit"]').fill('90');
	await score.locator('input[name="customerValue"]').fill('90');
	await score.locator('input[name="feasibility"]').fill('80');
	await score.locator('input[name="commercialValue"]').fill('80');
	await score.locator('input[name="risk"]').fill('20');
	await score.getByRole('button', { name: 'Score idea' }).click();

	const businessCase = page.locator('form[action="?/createBusinessCase"]');
	await businessCase.locator('select[name="ideaPublicId"]').selectOption({ label: /IDEA-E2E/ });
	await businessCase
		.locator('select[name="offeringPublicId"]')
		.selectOption({ label: /OFFER-E2E/ });
	await businessCase.locator('input[name="businessCaseCode"]').fill('BC-E2E');
	await businessCase.locator('input[name="title"]').fill('Lifecycle assurance investment case');
	await businessCase.locator('input[name="currencyCode"]').fill('GBP');
	await businessCase.locator('input[name="investmentCost"]').fill('100000');
	await businessCase.locator('input[name="annualRevenueOrValue"]').fill('300000');
	await businessCase.locator('input[name="expectedBenefitValue"]').fill('200000');
	await businessCase.locator('input[name="paybackMonths"]').fill('8');
	await businessCase
		.locator('textarea[name="riskSummary"]')
		.fill('Controlled implementation and adoption risk.');
	await businessCase.locator('textarea[name="recommendation"]').fill('Proceed to governed design.');
	await businessCase.getByRole('button', { name: 'Create business case' }).click();
	await expect(page.getByText(/BC-E2E v1/)).toBeVisible();

	const approval = page
		.locator('form[action="?/approveBusinessCase"]')
		.filter({ hasText: 'Approve' })
		.first();
	await approval.getByRole('button', { name: /Approve/ }).click();

	await page.goto('/product-service/lifecycle');
	await expect(
		page.getByRole('heading', { name: 'Product & Service lifecycle control', level: 1 })
	).toBeVisible();
	for (const heading of [
		'F05.05 · Product/service design',
		'F05.06 · Development',
		'F05.07 · Launch management',
		'F05.08 · Lifecycle management',
		'F05.09 · Product retirement',
		'F05.10 · Innovation management'
	]) {
		await expect(page.getByRole('heading', { name: heading })).toBeVisible();
	}

	const design = page.locator('form[action="?/createDesign"]');
	await design.locator('select[name="offeringPublicId"]').selectOption({ label: /OFFER-E2E/ });
	await design.locator('select[name="businessCasePublicId"]').selectOption({ label: /BC-E2E/ });
	await design.locator('input[name="designCode"]').fill('DES-E2E');
	await design.locator('input[name="title"]').fill('E2E lifecycle service design');
	await design.locator('select[name="ownerMemberId"]').selectOption({ label: OWNER });
	await design.locator('textarea[name="designBrief"]').fill('Controlled service lifecycle design.');
	await design.locator('textarea[name="customerOutcomes"]').fill('Auditable lifecycle decisions.');
	await design
		.locator('textarea[name="functionalRequirements"]')
		.fill('Govern each lifecycle gate with evidence.');
	await design
		.locator('textarea[name="acceptanceCriteria"]')
		.fill('Design review passes and approval is attributable.');
	await design.getByRole('button', { name: 'Create design' }).click();
	await expect(page.getByText(/DES-E2E v1/)).toBeVisible();

	const review = page.locator('form[action="?/addDesignReview"]');
	await review.locator('select[name="designPublicId"]').selectOption({ label: /DES-E2E/ });
	await review.locator('input[name="reviewCode"]').fill('REV-E2E');
	await review.locator('select[name="reviewType"]').selectOption('gate');
	await review.locator('select[name="outcome"]').selectOption('pass');
	await review.locator('input[name="reviewDate"]').fill('2026-09-12');
	await review.locator('select[name="reviewerMemberId"]').selectOption({ label: OWNER });
	await review
		.locator('textarea[name="findings"]')
		.fill('Design satisfies the governed lifecycle gate.');
	await review.getByRole('button', { name: 'Record review' }).click();

	const designCard = page.locator('article').filter({ hasText: 'DES-E2E v1' });
	await designCard.getByRole('button', { name: 'Approve reviewed design' }).click();
	await expect(designCard.getByText('approved')).toBeVisible();
});
