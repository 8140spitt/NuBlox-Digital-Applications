import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = ['NuBlox', 'E2E', 'Password', '2026!'].join('-');
const ORGANISATION = 'NuBlox Performance E2E Organisation';

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

test('F01 performance closes the strategy loop through KPI, review and foresight', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/strategy');

	const createStrategy = page.locator('form[action="?/createFramework"]');
	await createStrategy.getByLabel('Framework code').fill('PERF-E2E');
	await createStrategy.getByLabel('Title').fill('2027–2030 Performance Strategy');
	await createStrategy.getByLabel('Horizon start').fill('2027-01-01');
	await createStrategy.getByLabel('Horizon end').fill('2030-12-31');
	await createStrategy
		.getByLabel('Purpose')
		.fill('Turn approved intent into measurable enterprise outcomes.');
	await createStrategy
		.getByLabel('Vision')
		.fill('See strategy, actual performance and future scenarios as one evidence chain.');
	await createStrategy
		.getByLabel('Mission')
		.fill('Govern targets, actuals, actions, reviews and foresight without duplicate truth.');
	await createStrategy.getByRole('button', { name: 'Create strategy draft' }).click();

	await page.getByText('Add environmental factor', { exact: true }).click();
	const factor = page.locator('form[action="?/addEnvironmentFactor"]');
	await factor.getByLabel('Scope').selectOption('external');
	await factor.getByLabel('Dimension').selectOption('economic');
	await factor.getByLabel('Direction').selectOption('threat');
	await factor.getByLabel('Title').fill('Margin pressure');
	await factor
		.getByLabel('Analysis')
		.fill('Demand and input costs require active performance management.');
	await factor.getByRole('button', { name: 'Add factor' }).click();

	await page.getByText('Add strategic option', { exact: true }).click();
	const option = page.locator('form[action="?/addOption"]');
	await option.getByLabel('Option title').fill('Protect operating margin');
	await option
		.getByLabel('Description')
		.fill('Use integrated cost, revenue and delivery evidence to improve margin.');
	await option.getByLabel('Priority rank').fill('1');
	await option.getByRole('button', { name: 'Add option' }).click();
	const decision = page.locator('form[action="?/decideOption"]');
	await decision.getByRole('combobox').selectOption('selected');
	await decision
		.getByPlaceholder('Decision rationale')
		.fill('Creates an executable strategy-to-performance thread.');
	await decision.getByRole('button', { name: 'Record decision' }).click();

	await page.getByText('Add strategic objective', { exact: true }).click();
	const objective = page.locator('form[action="?/addObjective"]');
	await objective.getByLabel('Objective code').fill('OBJ-PERF-E2E');
	await objective.getByLabel('Priority rank').fill('1');
	await objective.getByLabel('Title').fill('Improve operating margin');
	await objective
		.getByLabel('Description')
		.fill('Increase enterprise operating margin through accountable execution.');
	await objective.getByLabel('Target date').fill('2028-12-31');
	await objective.getByRole('button', { name: 'Add objective' }).click();
	await page.getByRole('button', { name: 'Approve version 1' }).click();
	await expect(page.getByText('Approved strategy version')).toBeVisible();

	await page.getByRole('link', { name: 'Business planning & operating model →' }).click();
	const createPlan = page.locator('form[action="?/createPlan"]');
	await createPlan.getByLabel('Approved strategy').selectOption({ label: 'PERF-E2E · v1 — 2027–2030 Performance Strategy' });
	await createPlan.getByLabel('Plan code').fill('BP-PERF-E2E');
	await createPlan.getByLabel('Title').fill('2027 Performance Business Plan');
	await createPlan.getByLabel('Period start').fill('2027-01-01');
	await createPlan.getByLabel('Period end').fill('2027-12-31');
	await createPlan.getByLabel('Currency').fill('GBP');
	await createPlan.getByLabel('Planned revenue').fill('1000000');
	await createPlan.getByLabel('Planned operating expenditure').fill('880000');
	await createPlan.getByLabel('Planned capital expenditure').fill('50000');
	await createPlan.getByLabel('Plan narrative').fill('Fund the approved strategy and hold the operating model accountable for margin performance.');
	await createPlan.getByRole('button', { name: 'Create business-plan draft' }).click();

	await page.getByText('Add strategic initiative', { exact: true }).click();
	const initiative = page.locator('form[action="?/addInitiative"]');
	await initiative.getByLabel('Strategic objective').selectOption({ label: 'OBJ-PERF-E2E · Improve operating margin' });
	await initiative.getByLabel('Initiative code').fill('INIT-PERF-E2E');
	await initiative.getByLabel('Priority rank').fill('1');
	await initiative.getByLabel('Currency').fill('GBP');
	await initiative.getByLabel('Initiative title').fill('Protect operating margin');
	await initiative.getByLabel('Target outcome').fill('Deliver the approved operating-margin target through controlled enterprise execution.');
	await initiative.getByLabel('Benefit statement').fill('Improved operating margin with traceable financial evidence.');
	await initiative.getByLabel('Start date').fill('2027-01-15');
	await initiative.getByLabel('End date').fill('2027-11-30');
	await initiative.getByLabel('Planned investment').fill('75000');
	await initiative.getByLabel('Planned FTE').fill('6');
	await initiative.getByRole('button', { name: 'Add initiative' }).click();

	await page.getByText('Add operating-model component', { exact: true }).click();
	const component = page.locator('form[action="?/addComponent"]');
	await component.getByLabel('Component code').fill('CAP-PERF-E2E');
	await component.getByLabel('Component type').selectOption('business_capability');
	await component.getByLabel('Component title').fill('Margin performance management');
	await component.getByLabel('Current state').fill('Performance is reviewed after the fact.');
	await component.getByLabel('Target state').fill('Canonical finance actuals drive governed KPI variance and action.');
	await component.getByRole('button', { name: 'Add target component' }).click();

	await page.getByText('Add business accountability', { exact: true }).click();
	const accountability = page.locator('form[action="?/addAccountability"]');
	await accountability.getByLabel('Accountability').selectOption('accountable');
	await accountability.getByLabel('Business position label').fill('Chief Financial Officer');
	await accountability.getByLabel('Notes').fill('Accountable for strategy-to-finance performance evidence.');
	await accountability.getByRole('button', { name: 'Add accountability' }).click();

	await page.getByText('Link initiative to operating model', { exact: true }).click();
	const changeLink = page.locator('form[action="?/linkInitiativeComponent"]');
	await changeLink.getByLabel('Change role').selectOption('transform');
	await changeLink.getByRole('button', { name: 'Link change' }).click();
	await page.getByRole('button', { name: 'Approve plan version 1' }).click();
	await expect(page.getByText('Approved business-plan evidence')).toBeVisible();

	await page.goto('/strategy/performance');
	await page.getByRole('link', { name: /PERF-E2E · v1/ }).click();
	await expect(
		page.getByRole('heading', { name: 'Strategy performance & foresight', level: 1 })
	).toBeVisible();

	const kpi = page.locator('form[action="?/createKpi"]');
	await kpi
		.getByLabel('Strategic objective')
		.selectOption({ label: 'OBJ-PERF-E2E · Improve operating margin' });
	await kpi.getByLabel('KPI code').fill('KPI-PERF-E2E');
	await kpi.getByLabel('KPI title').fill('Operating margin');
	await kpi.getByLabel('Accountable owner').selectOption({ index: 1 });
	await kpi.getByLabel('Unit').fill('%');
	await kpi.getByLabel('Direction').selectOption('higher_is_better');
	await kpi.getByLabel('Aggregation').selectOption('latest');
	await kpi.getByLabel('Baseline').fill('8.5');
	await kpi.getByLabel('Target', { exact: true }).fill('12');
	await kpi.getByLabel('Warning threshold').fill('10');
	await kpi.getByLabel('Critical threshold').fill('9');
	await kpi.getByLabel('Target date').fill('2028-12-31');
	await kpi.getByLabel('Source mode').selectOption('canonical');
	await kpi.getByLabel('Source domain').fill('finance');
	await kpi.getByLabel('Source record type').fill('accounting_report');
	await kpi.getByLabel('Source measure key').fill('operating_margin_percent');
	await kpi
		.getByLabel('KPI description')
		.fill('Operating margin from canonical finance reporting.');
	await kpi.getByRole('button', { name: 'Create KPI draft' }).click();
	await expect(page.getByRole('heading', { name: 'Operating margin' })).toBeVisible();
	await page.getByRole('button', { name: 'Approve KPI version 1' }).click();

	const observation = page.locator('form[action="?/refreshCanonicalObservation"]');
	await observation
		.getByLabel('Canonical KPI')
		.selectOption({ label: 'KPI-PERF-E2E · Operating margin' });
	await observation.getByLabel('Canonical source period').fill('F01-PERF-PERIOD-2027-H1');
	await observation.getByLabel('Forecast value').fill('11.4');
	await observation.getByLabel('Commentary').fill('Canonical finance performance is improving but below target.');
	await observation.getByRole('button', { name: 'Refresh canonical KPI actual' }).click();
	await expect(page.getByText('9.75 %')).toBeVisible();
	await expect(page.getByText(/F01-PERF-PERIOD-2027-H1/)).toBeVisible();
	const sourceLink = page.getByRole('link', { name: 'Open canonical source →' });
	await expect(sourceLink).toHaveAttribute('href', /finance\/accounting\/reports\?period=F01-PERF-PERIOD-2027-H1/);
	await sourceLink.click();
	await expect(page.getByRole('heading', { name: 'Trial balance and financial reports' })).toBeVisible();
	await expect(page.getByText('GBP 97500.0000')).toBeVisible();
	await page.goto('/strategy/performance');
	await page.getByRole('link', { name: /PERF-E2E · v1/ }).click();

	const action = page.locator('form[action="?/createAction"]');
	await action
		.getByLabel('Approved KPI')
		.selectOption({ label: 'KPI-PERF-E2E · Operating margin' });
	await action.getByLabel('Observation').selectOption({ index: 1 });
	await action.getByLabel('Action code').fill('ACT-PERF-E2E');
	await action.getByLabel('Action title').fill('Accelerate cost productivity');
	await action.getByLabel('Action owner').selectOption({ index: 0 });
	await action.getByLabel('Due date').fill('2027-09-30');
	await action
		.getByLabel('Action', { exact: true })
		.fill('Close the margin gap through accountable cost actions.');
	await action.getByRole('button', { name: 'Create corrective action' }).click();
	await expect(page.getByText('ACT-PERF-E2E')).toBeVisible();
	const completion = page.locator('form[action="?/completeAction"]');
	await completion.getByLabel('Completion note').fill('Cost actions approved and mobilised.');
	await completion.getByRole('button', { name: 'Complete' }).click();
	await expect(page.getByText('completed', { exact: true })).toBeVisible();

	const review = page.locator('form[action="?/createReview"]');
	await review.getByLabel('Review code').fill('REV-PERF-E2E');
	await review.getByLabel('Review date').fill('2027-06-30');
	await review.getByLabel('Review title').fill('H1 strategic performance review');
	await review
		.getByLabel('Review summary')
		.fill('Review margin performance and agree corrective action.');
	await review.getByLabel('Decisions').fill('Maintain target and accelerate productivity.');
	await review.getByRole('button', { name: 'Create review draft' }).click();
	const snapshot = page.locator('form[action="?/addReviewKpi"]');
	await snapshot
		.getByLabel('Draft review')
		.selectOption({ label: 'REV-PERF-E2E · H1 strategic performance review' });
	await snapshot
		.getByLabel('Approved KPI')
		.selectOption({ label: 'KPI-PERF-E2E · Operating margin' });
	await snapshot.getByLabel('KPI observation').selectOption({ index: 0 });
	await snapshot.getByLabel('Assessment').selectOption('watch');
	await snapshot.getByLabel('Review commentary').fill('Forecast remains below target.');
	await snapshot.getByRole('button', { name: 'Add KPI snapshot' }).click();
	await expect(page.getByText(/variance -2.25/)).toBeVisible();
	await page.getByRole('button', { name: 'Approve strategic review' }).click();

	const scenario = page.locator('form[action="?/createScenario"]');
	await scenario.getByLabel('Scenario code').fill('SCN-PERF-E2E');
	await scenario.getByLabel('Scenario type').selectOption('downside');
	await scenario.getByLabel('Scenario title').fill('Demand downside');
	await scenario.getByLabel('Horizon start').fill('2027-07-01');
	await scenario.getByLabel('Horizon end').fill('2028-12-31');
	await scenario
		.getByLabel('Scenario narrative')
		.fill('Test margin resilience under weaker demand.');
	await scenario.getByRole('button', { name: 'Create scenario draft' }).click();

	const assumption = page.locator('form[action="?/addScenarioAssumption"]');
	await assumption.getByLabel('Draft scenario').selectOption({ label: 'SCN-PERF-E2E · v1' });
	await assumption.getByLabel('Assumption code').fill('ASSUMP-PERF-E2E');
	await assumption.getByLabel('Assumption title').fill('Revenue demand');
	await assumption.getByLabel('Variable key').fill('revenue_growth_percent');
	await assumption.getByLabel('Unit').fill('%');
	await assumption.getByLabel('Baseline value').fill('5');
	await assumption.getByLabel('Scenario value').fill('-3');
	await assumption.getByLabel('Sensitivity percent').fill('8');
	await assumption
		.getByLabel('Assumption description')
		.fill('Demand growth falls below the approved baseline.');
	await assumption.getByRole('button', { name: 'Add scenario assumption' }).click();

	const projection = page.locator('form[action="?/addScenarioProjection"]');
	await projection.getByLabel('Draft scenario').selectOption({ label: 'SCN-PERF-E2E · v1' });
	await projection
		.getByLabel('Approved KPI')
		.selectOption({ label: 'KPI-PERF-E2E · Operating margin' });
	await projection.getByLabel('Projection date').fill('2028-12-31');
	await projection.getByLabel('Projected value').fill('8.2');
	await projection
		.getByLabel('Projection rationale')
		.fill('Downside demand compresses operating margin.');
	await projection.getByRole('button', { name: 'Add KPI projection' }).click();
	await expect(page.getByText(/8.2 · 2028-12-31/)).toBeVisible();
	await page.getByRole('button', { name: 'Approve scenario version 1' }).click();
	await page.getByRole('button', { name: 'Create scenario revision' }).click();
	const revisedScenario = page
		.locator('article.record-card')
		.filter({ hasText: 'SCN-PERF-E2E · v2 · downside' });
	await expect(revisedScenario).toBeVisible();
	await expect(
		revisedScenario.getByText('ASSUMP-PERF-E2E · Revenue demand', { exact: true })
	).toBeVisible();
	await expect(revisedScenario.getByText(/8.2 · 2028-12-31/)).toBeVisible();
});
