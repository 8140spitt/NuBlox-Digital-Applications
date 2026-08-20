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

async function optionValueContaining(select: import('@playwright/test').Locator, text: string) {
	const option = select.locator('option').filter({ hasText: text }).first();
	await expect(option).toHaveCount(1);
	const value = await option.getAttribute('value');
	expect(value).toBeTruthy();
	return value!;
}

test('owner registers an asset and completes reactive, planned, service and compliance lifecycle', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const facilityCode = `FAC-${suffix}`;
	const facilityName = `Operations campus ${suffix}`;
	const typeCode = `DB-${suffix}`;
	const typeName = `Distribution board ${suffix}`;
	const assetTag = `ASSET-${suffix}`;
	const assetName = `Main LV board ${suffix}`;
	const requestTitle = `Breaker trip ${suffix}`;
	const planName = `Annual LV inspection ${suffix}`;
	const planTask = `Inspect LV terminations ${suffix}`;
	const requirementCode = `ELEC-${suffix}`;
	const requirementName = `LV periodic inspection ${suffix}`;

	await page.goto('/assets#create-facility');
	await expect(page.getByRole('heading', { name: 'Assets & facilities', level: 1 })).toBeVisible();
	const facilityPanel = page.locator('#create-facility');
	await facilityPanel.getByLabel('Facility code').fill(facilityCode);
	await facilityPanel.getByLabel('Facility name').fill(facilityName);
	await facilityPanel.getByLabel('Timezone').fill('Europe/London');
	await facilityPanel.getByRole('button', { name: 'Create facility' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	await expect(page.locator('#facility-register .record-card').filter({ hasText: facilityName })).toBeVisible();

	const buildingPanel = page.locator('#create-building');
	await buildingPanel.getByLabel('Facility').selectOption({ label: `${facilityCode} · ${facilityName}` });
	await buildingPanel.getByLabel('Building code').fill(`BLDG-${suffix}`);
	await buildingPanel.getByLabel('Building name').fill(`Main building ${suffix}`);
	await buildingPanel.getByRole('button', { name: 'Add building' }).click();
	await expect(page).toHaveURL(/\/assets$/);

	const typePanel = page.locator('#create-asset-type');
	await typePanel.getByLabel('Category').selectOption('electrical');
	await typePanel.getByLabel('Type code').fill(typeCode);
	await typePanel.getByLabel('Type name').fill(typeName);
	await typePanel.getByRole('button', { name: 'Create asset type' }).click();
	await expect(page).toHaveURL(/\/assets$/);

	const assetPanel = page.locator('#create-asset');
	await assetPanel.getByLabel('Facility').selectOption({ label: `${facilityCode} · ${facilityName}` });
	const assetTypeSelect = assetPanel.getByLabel('Asset type');
	await assetTypeSelect.selectOption(await optionValueContaining(assetTypeSelect, typeName));
	await assetPanel.getByLabel('Asset tag').fill(assetTag);
	await assetPanel.getByLabel('Asset name').fill(assetName);
	await assetPanel.getByLabel('Criticality').selectOption('high');
	await assetPanel.getByRole('button', { name: 'Register asset' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	await expect(page.locator('#asset-register .asset-card').filter({ hasText: assetTag })).toContainText('active');

	const requestPanel = page.locator('#create-maintenance-request');
	await requestPanel.getByLabel('Facility').selectOption({ label: `${facilityCode} · ${facilityName}` });
	await requestPanel.getByLabel('Affected asset').selectOption({ label: `${assetTag} · ${assetName}` });
	await requestPanel.getByLabel('Type').selectOption('fault');
	await requestPanel.getByLabel('Priority').selectOption('urgent');
	await requestPanel.getByLabel('Title').fill(requestTitle);
	await requestPanel.getByLabel('Description').fill('Intermittent outgoing breaker trip requires investigation.');
	await requestPanel.getByRole('button', { name: 'Report request' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	let requestCard = page.locator('#maintenance-request-register .request-card').filter({ hasText: requestTitle });
	await expect(requestCard.getByText('new', { exact: true })).toBeVisible();
	await requestCard.getByLabel('Asset').selectOption({ label: `${assetTag} · ${assetName}` });
	await requestCard.getByRole('button', { name: 'Create reactive work order' }).click();
	await expect(page).toHaveURL(/\/assets$/);

	let workOrder = page.locator('#work-order-register .work-order-card').filter({ hasText: requestTitle }).first();
	await expect(workOrder.getByText('open', { exact: true })).toBeVisible();
	const contractor = workOrder.getByLabel('Contractor');
	await contractor.selectOption(await optionValueContaining(contractor, 'NuBlox E2E Supplier'));
	await workOrder.getByRole('button', { name: 'Assign contractor' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	workOrder = page.locator('#work-order-register .work-order-card').filter({ hasText: requestTitle }).first();
	await expect(workOrder).toContainText('NuBlox E2E Supplier');
	await workOrder.getByLabel('Completion summary').fill('Breaker tested, termination remade and circuit restored.');
	await workOrder.getByRole('button', { name: 'Complete work order' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	workOrder = page.locator('#work-order-register .work-order-card').filter({ hasText: requestTitle }).first();
	await expect(workOrder.getByText('completed', { exact: true })).toBeVisible();

	const servicePanel = page.locator('#create-service-event');
	await servicePanel.getByLabel('Asset').selectOption({ label: `${assetTag} · ${assetName}` });
	const completedOrder = servicePanel.getByLabel('Completed work order');
	await completedOrder.selectOption(await optionValueContaining(completedOrder, requestTitle));
	await servicePanel.getByLabel('Service type').selectOption('reactive_repair');
	await servicePanel.getByLabel('Performed at').fill('2026-08-20T14:00');
	await servicePanel.getByLabel('Result').selectOption('completed');
	await servicePanel.getByLabel('Condition').selectOption('good');
	await servicePanel.getByLabel('Notes').fill('Functional and thermal checks passed.');
	await servicePanel.getByRole('button', { name: 'Record service event' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	await expect(page.locator('#service-history .service-card').filter({ hasText: assetTag }).first()).toContainText('completed');

	const planPanel = page.locator('#create-maintenance-plan');
	await planPanel.getByLabel('Facility').selectOption({ label: `${facilityCode} · ${facilityName}` });
	await planPanel.getByLabel('Asset').selectOption({ label: `${assetTag} · ${assetName}` });
	await planPanel.getByLabel('Plan type').selectOption('ppm');
	await planPanel.getByLabel('Plan name').fill(planName);
	await planPanel.getByLabel('Task title').fill(planTask);
	await planPanel.getByLabel('Every').fill('12');
	await planPanel.getByLabel('Unit').selectOption('month');
	await planPanel.getByRole('button', { name: 'Create active maintenance plan' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	const planCard = page.locator('#maintenance-plan-register .record-card').filter({ hasText: planName });
	await expect(planCard).toContainText('active');
	await planCard.getByLabel('Asset').selectOption({ label: `${assetTag} · ${assetName}` });
	await planCard.getByRole('button', { name: 'Generate work order' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	const plannedOrder = page.locator('#work-order-register .work-order-card').filter({ hasText: planTask }).first();
	await expect(plannedOrder.getByText('open', { exact: true })).toBeVisible();

	const requirementPanel = page.locator('#create-compliance-requirement');
	await requirementPanel.getByLabel('Category').selectOption('electrical');
	await requirementPanel.getByLabel('Requirement code').fill(requirementCode);
	await requirementPanel.getByLabel('Name').fill(requirementName);
	await requirementPanel.getByLabel('Requirement text').fill('Inspect LV distribution equipment and record condition.');
	await requirementPanel.getByLabel('Interval').fill('12');
	await requirementPanel.getByLabel('Unit').selectOption('month');
	await requirementPanel.getByRole('button', { name: 'Publish version 1' }).click();
	await expect(page).toHaveURL(/\/assets$/);

	const assignPanel = page.locator('#assign-compliance');
	await assignPanel.getByLabel('Asset').selectOption({ label: `${assetTag} · ${assetName}` });
	const requirementSelect = assignPanel.getByLabel('Requirement');
	await requirementSelect.selectOption(await optionValueContaining(requirementSelect, requirementName));
	await assignPanel.getByRole('button', { name: 'Assign requirement' }).click();
	await expect(page).toHaveURL(/\/assets$/);

	const eventPanel = page.locator('#record-compliance-event');
	const assignmentSelect = eventPanel.getByLabel('Assignment');
	await assignmentSelect.selectOption(await optionValueContaining(assignmentSelect, assetTag));
	await eventPanel.getByLabel('Performed at').fill('2026-08-20T14:30');
	await eventPanel.getByLabel('Outcome').selectOption('pass');
	await eventPanel.getByLabel('Findings').fill('Inspection passed with no defects.');
	await eventPanel.getByRole('button', { name: 'Record compliance event' }).click();
	await expect(page).toHaveURL(/\/assets$/);
	await expect(page.locator('#compliance-register .compliance-event').filter({ hasText: requirementName }).first()).toContainText('pass');
});
