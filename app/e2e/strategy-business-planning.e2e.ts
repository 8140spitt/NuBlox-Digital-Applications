import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = ['NuBlox', 'E2E', 'Password', '2026!'].join('-');
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

test('F01 business plan governs objective through operating model to approved revision evidence', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/strategy');

	const createStrategy = page.locator('form[action="?/createFramework"]');
	await createStrategy.getByLabel('Framework code').fill('PLAN-E2E');
	await createStrategy.getByLabel('Title').fill('2027–2030 Planning Strategy');
	await createStrategy.getByLabel('Horizon start').fill('2027-01-01');
	await createStrategy.getByLabel('Horizon end').fill('2030-12-31');
	await createStrategy
		.getByLabel('Purpose')
		.fill('Convert strategy into accountable enterprise execution.');
	await createStrategy
		.getByLabel('Vision')
		.fill('Operate a coherent strategy-to-performance system.');
	await createStrategy
		.getByLabel('Mission')
		.fill('Govern objectives, plans, operating model and execution as one thread.');
	await createStrategy.getByRole('button', { name: 'Create strategy draft' }).click();

	await page.getByText('Add environmental factor', { exact: true }).click();
	const factor = page.locator('form[action="?/addEnvironmentFactor"]');
	await factor.getByLabel('Scope').selectOption('external');
	await factor.getByLabel('Dimension').selectOption('market');
	await factor.getByLabel('Direction').selectOption('opportunity');
	await factor.getByLabel('Title').fill('Integrated enterprise demand');
	await factor
		.getByLabel('Analysis')
		.fill('Customers expect joined-up enterprise delivery evidence.');
	await factor.getByRole('button', { name: 'Add factor' }).click();

	await page.getByText('Add strategic option', { exact: true }).click();
	const option = page.locator('form[action="?/addOption"]');
	await option.getByLabel('Option title').fill('Scale integrated operating model');
	await option
		.getByLabel('Description')
		.fill('Translate strategic intent into funded cross-functional execution.');
	await option.getByLabel('Priority rank').fill('1');
	await option.getByRole('button', { name: 'Add option' }).click();
	const decision = page.locator('form[action="?/decideOption"]');
	await decision.getByRole('combobox').selectOption('selected');
	await decision.getByPlaceholder('Decision rationale').fill('Best path to enterprise continuity.');
	await decision.getByRole('button', { name: 'Record decision' }).click();

	await page.getByText('Add strategic objective', { exact: true }).click();
	const objective = page.locator('form[action="?/addObjective"]');
	await objective.getByLabel('Objective code').fill('OBJ-PLAN-01');
	await objective.getByLabel('Priority rank').fill('1');
	await objective.getByLabel('Title').fill('Implement target enterprise operating model');
	await objective
		.getByLabel('Description')
		.fill('Mobilise accountable initiatives against approved strategic intent.');
	await objective.getByLabel('Target date').fill('2028-12-31');
	await objective.getByRole('button', { name: 'Add objective' }).click();
	await page.getByRole('button', { name: 'Approve version 1' }).click();
	await expect(page.getByText('Approved strategy version')).toBeVisible();

	await page.getByRole('link', { name: 'Business planning & operating model →' }).click();
	await expect(page).toHaveURL(/\/strategy\/planning/);
	await expect(
		page.getByRole('heading', { name: 'Business planning & operating model', level: 1 })
	).toBeVisible();
	const createPlan = page.locator('form[action="?/createPlan"]');
	await createPlan.getByLabel('Approved strategy').selectOption({ label: /PLAN-E2E · v1/ });
	await createPlan.getByLabel('Plan code').fill('BP-E2E-2027');
	await createPlan.getByLabel('Title').fill('2027 E2E Enterprise Business Plan');
	await createPlan.getByLabel('Period start').fill('2027-01-01');
	await createPlan.getByLabel('Period end').fill('2027-12-31');
	await createPlan.getByLabel('Currency').fill('GBP');
	await createPlan.getByLabel('Planned revenue').fill('150000000');
	await createPlan.getByLabel('Planned operating expenditure').fill('110000000');
	await createPlan.getByLabel('Planned capital expenditure').fill('15000000');
	await createPlan
		.getByLabel('Plan narrative')
		.fill(
			'Execute approved strategy through funded initiatives and an accountable target operating model.'
		);
	await createPlan.getByRole('button', { name: 'Create business-plan draft' }).click();
	await expect(page.getByText('BP-E2E-2027 · version 1')).toBeVisible();

	await page.getByText('Add strategic initiative', { exact: true }).click();
	const initiative = page.locator('form[action="?/addInitiative"]');
	await initiative.getByLabel('Strategic objective').selectOption({ label: /OBJ-PLAN-01/ });
	await initiative.getByLabel('Initiative code').fill('INIT-E2E-01');
	await initiative.getByLabel('Priority rank').fill('1');
	await initiative.getByLabel('Currency').fill('GBP');
	await initiative.getByLabel('Initiative title').fill('Mobilise integrated enterprise delivery');
	await initiative
		.getByLabel('Target outcome')
		.fill('Cross-functional teams execute approved strategy through shared canonical records.');
	await initiative
		.getByLabel('Benefit statement')
		.fill('Faster decisions with less duplicated enterprise data.');
	await initiative.getByLabel('Start date').fill('2027-01-15');
	await initiative.getByLabel('End date').fill('2027-11-30');
	await initiative.getByLabel('Planned investment').fill('3000000');
	await initiative.getByLabel('Planned FTE').fill('20');
	await initiative.getByRole('button', { name: 'Add initiative' }).click();
	await expect(
		page.getByRole('heading', { name: 'Mobilise integrated enterprise delivery' })
	).toBeVisible();

	await page.getByText('Add initiative milestone', { exact: true }).click();
	const milestone = page.locator('form[action="?/addMilestone"]');
	await milestone.getByLabel('Milestone code').fill('MS-E2E-01');
	await milestone.getByLabel('Title').fill('Target model mobilised');
	await milestone.getByLabel('Target date').fill('2027-06-30');
	await milestone.getByRole('button', { name: 'Add milestone' }).click();
	await expect(page.getByText(/MS-E2E-01 · Target model mobilised/)).toBeVisible();

	await page.getByText('Add operating-model component', { exact: true }).click();
	const component = page.locator('form[action="?/addComponent"]');
	await component.getByLabel('Component code').fill('CAP-E2E-01');
	await component.getByLabel('Component type').selectOption('business_capability');
	await component.getByLabel('Component title').fill('Integrated enterprise delivery');
	await component
		.getByLabel('Current state')
		.fill('Function-led handoffs and duplicated reporting.');
	await component
		.getByLabel('Target state')
		.fill('Value streams coordinate through canonical records and explicit accountability.');
	await component.getByRole('button', { name: 'Add target component' }).click();
	await expect(page.getByRole('heading', { name: 'Integrated enterprise delivery' })).toBeVisible();

	await page.getByText('Add business accountability', { exact: true }).click();
	const accountability = page.locator('form[action="?/addAccountability"]');
	await accountability.getByLabel('Accountability').selectOption('accountable');
	await accountability.getByLabel('Business position label').fill('Chief Operating Officer');
	await accountability
		.getByLabel('Notes')
		.fill('Business accountability does not grant access authority.');
	await accountability.getByRole('button', { name: 'Add accountability' }).click();
	await expect(page.getByText('Chief Operating Officer')).toBeVisible();

	await page.getByText('Link initiative to operating model', { exact: true }).click();
	const changeLink = page.locator('form[action="?/linkInitiativeComponent"]');
	await changeLink.getByLabel('Change role').selectOption('transform');
	await changeLink.getByRole('button', { name: 'Link change' }).click();
	await expect(page.getByText('INIT-E2E-01 → transform')).toBeVisible();

	await page.getByRole('button', { name: 'Approve plan version 1' }).click();
	await expect(page.getByText('Approved business-plan evidence')).toBeVisible();
	await page.getByRole('button', { name: 'Create plan revision' }).click();
	await expect(page.getByText('BP-E2E-2027 · version 2')).toBeVisible();
	await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Mobilise integrated enterprise delivery' })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Integrated enterprise delivery' })).toBeVisible();
	await expect(page.getByText('Chief Operating Officer')).toBeVisible();
});
