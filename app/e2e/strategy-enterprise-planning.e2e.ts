import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('F01 strategy moves from intent and analysis to approved immutable evidence and revision', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/strategy');
	await expect(
		page.getByRole('heading', { name: 'Strategy & enterprise planning', level: 1 })
	).toBeVisible();

	const create = page.locator('form[action="?/createFramework"]');
	await create.getByLabel('Framework code').fill('ENTERPRISE-E2E');
	await create.getByLabel('Title').fill('2027–2031 E2E Enterprise Strategy');
	await create.getByLabel('Horizon start').fill('2027-01-01');
	await create.getByLabel('Horizon end').fill('2031-12-31');
	await create.getByLabel('Purpose').fill('Create enduring value through the built environment.');
	await create
		.getByLabel('Vision')
		.fill('Operate one trusted digital thread from enterprise intent to operating asset.');
	await create
		.getByLabel('Mission')
		.fill('Connect customers, projects, assets, people and finance through governed evidence.');
	await create.getByRole('button', { name: 'Create strategy draft' }).click();
	await expect(page.getByText('ENTERPRISE-E2E · version 1')).toBeVisible();
	await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();

	await page.getByText('Add environmental factor', { exact: true }).click();
	const factor = page.locator('form[action="?/addEnvironmentFactor"]');
	await factor.getByLabel('Scope').selectOption('external');
	await factor.getByLabel('Dimension').selectOption('technology');
	await factor.getByLabel('Direction').selectOption('opportunity');
	await factor.getByLabel('Observed on').fill('2026-09-01');
	await factor.getByLabel('Title').fill('Connected asset expectations');
	await factor
		.getByLabel('Analysis')
		.fill('Customers increasingly expect governed information continuity into operations.');
	await factor.getByLabel('Evidence/source reference').fill('E2E market scan');
	await factor.getByLabel('Likelihood (1–5)').fill('5');
	await factor.getByLabel('Impact (1–5)').fill('5');
	await factor.getByRole('button', { name: 'Add factor' }).click();
	await expect(page.getByRole('heading', { name: 'Connected asset expectations' })).toBeVisible();

	await page.getByText('Add strategic option', { exact: true }).click();
	const option = page.locator('form[action="?/addOption"]');
	await option.getByLabel('Option title').fill('Lead with governed digital thread');
	await option
		.getByLabel('Description')
		.fill('Make enterprise-to-asset traceability the differentiating operating model.');
	await option
		.getByLabel('Evaluation summary')
		.fill('High customer value, strategic fit and sector differentiation.');
	await option.getByLabel('Priority rank').fill('1');
	await option.getByRole('button', { name: 'Add option' }).click();
	await expect(
		page.getByRole('heading', { name: 'Lead with governed digital thread' })
	).toBeVisible();

	const decision = page.locator('form[action="?/decideOption"]');
	await decision.getByRole('combobox').selectOption('selected');
	await decision
		.getByPlaceholder('Decision rationale')
		.fill('Best route to differentiated customer value.');
	await decision.getByRole('button', { name: 'Record decision' }).click();
	await expect(
		page.getByText('Decision: Best route to differentiated customer value.')
	).toBeVisible();

	await page.getByText('Add strategic objective', { exact: true }).click();
	const objective = page.locator('form[action="?/addObjective"]');
	await objective.getByLabel('Objective code').fill('OBJ-01');
	await objective.getByLabel('Priority rank').fill('1');
	await objective.getByLabel('Title').fill('Prove enterprise-to-asset continuity');
	await objective
		.getByLabel('Description')
		.fill('Demonstrate traceable business intent through delivery and into operated assets.');
	await objective.getByLabel('Target date').fill('2028-12-31');
	await objective.getByRole('button', { name: 'Add objective' }).click();
	await expect(
		page.getByRole('heading', { name: 'Prove enterprise-to-asset continuity' })
	).toBeVisible();

	await page.getByRole('button', { name: 'Approve version 1' }).click();
	await expect(page.getByText('Approved strategy version')).toBeVisible();
	await expect(page.getByText('approved', { exact: true }).first()).toBeVisible();
	await expect(page.getByText('active', { exact: true }).first()).toBeVisible();

	await page.getByRole('button', { name: 'Create revision' }).click();
	await expect(page.getByText('ENTERPRISE-E2E · version 2')).toBeVisible();
	await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Connected asset expectations' })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Lead with governed digital thread' })
	).toBeVisible();
	await expect(page.getByText('proposed', { exact: true }).first()).toBeVisible();
});
