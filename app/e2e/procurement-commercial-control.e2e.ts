import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const SUPPLIER = 'NuBlox E2E Supplier';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function optionValueContaining(
	select: import('@playwright/test').Locator,
	text: string
): Promise<string> {
	const option = select.locator('option').filter({ hasText: text }).first();
	await expect(option).toHaveCount(1);
	const value = await option.getAttribute('value');
	expect(value).toBeTruthy();
	return value!;
}

test('owner procures, commits, values and controls project cost through the browser', async ({ page }) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-COM-${suffix}`;
	const projectName = `Commercial control ${suffix}`;
	const packageTitle = `Containment procurement ${suffix}`;
	const rfqTitle = `Containment enquiry ${suffix}`;
	const poTitle = `Containment purchase order ${suffix}`;
	const costCode = `MAT-${suffix}`;
	const variationTitle = `Additional supports ${suffix}`;

	await page.goto('/projects#create-project');
	await page.getByLabel('Project number').fill(projectNumber);
	await page.getByLabel('Project name').fill(projectName);
	await page
		.getByLabel(/Description/)
		.fill('Browser acceptance project for procurement and project commercial control.');
	await page.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto('/purchasing#create-package');
	const packagePanel = page.locator('#create-package');
	await packagePanel.locator('select[name="projectPublicId"]').selectOption(projectPublicId);
	await packagePanel.locator('select[name="packageTypeCode"]').selectOption({ index: 1 });
	await packagePanel.getByLabel('Package title').fill(packageTitle);
	await packagePanel.getByLabel('Description').fill('Containment material and installation requirement.');
	await packagePanel.locator('select[name="salesItemTypeId"]').selectOption({ index: 1 });
	await packagePanel.getByLabel('Requirement description').fill('Galvanised containment installation package');
	await packagePanel.getByLabel('Quantity').fill('10');
	await packagePanel.getByLabel('Target unit cost').fill('120.00');
	await packagePanel.getByRole('button', { name: 'Create procurement package' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	const packageCard = page.locator('#package-register .record-card').filter({ hasText: packageTitle });
	await expect(packageCard).toBeVisible();
	const packageNumber = (await packageCard.locator('.reference').textContent())!.trim();

	const rfqPanel = page.locator('#create-rfq');
	const packageSelect = rfqPanel.locator('select[name="packagePublicId"]');
	const packagePublicId = await optionValueContaining(packageSelect, packageTitle);
	await packageSelect.selectOption(packagePublicId);
	await rfqPanel.getByLabel('RFQ title').fill(rfqTitle);
	await rfqPanel.getByLabel('Response deadline').fill('2026-09-01T12:00');
	await rfqPanel.getByRole('button', { name: 'Create RFQ draft' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	let rfqCard = page.locator('#rfq-register .rfq-card').filter({ hasText: rfqTitle });
	await expect(rfqCard.getByText('draft', { exact: true })).toBeVisible();
	await rfqCard.getByLabel('Supplier').selectOption({ label: SUPPLIER });
	await rfqCard.getByRole('button', { name: 'Issue enquiry' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	rfqCard = page.locator('#rfq-register .rfq-card').filter({ hasText: rfqTitle });
	await expect(rfqCard.getByText('issued', { exact: true })).toBeVisible();
	await expect(rfqCard).toContainText(packageNumber);

	const poPanel = page.locator('#create-po');
	await poPanel.locator('select[name="projectPublicId"]').selectOption(projectPublicId);
	await poPanel.getByLabel('Supplier').selectOption({ label: SUPPLIER });
	await poPanel.locator('select[name="purchaseOrderTypeCode"]').selectOption({ index: 1 });
	await poPanel.locator('select[name="packagePublicId"]').selectOption(packagePublicId);
	await poPanel.getByLabel('Purchase-order title').fill(poTitle);
	await poPanel.getByLabel('Supplier reference').fill(`SUP-${suffix}`);
	await poPanel.locator('select[name="salesItemTypeId"]').selectOption({ index: 1 });
	await poPanel.getByLabel('Order line description').fill('Galvanised containment installation package');
	await poPanel.getByLabel('Quantity').fill('10');
	await poPanel.getByLabel('Unit rate').fill('125.00');
	await poPanel.getByRole('button', { name: 'Create purchase-order draft' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	let poCard = page.locator('#po-register .po-card').filter({ hasText: poTitle });
	await expect(poCard.getByText('draft', { exact: true })).toBeVisible();
	const purchaseOrderNumber = (await poCard.locator('.reference').textContent())!.trim();
	await poCard.getByRole('button', { name: 'Approve purchase order' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	poCard = page.locator('#po-register .po-card').filter({ hasText: poTitle });
	await expect(poCard.getByText('approved', { exact: true })).toBeVisible();
	await poCard.getByRole('button', { name: 'Issue purchase order' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);
	poCard = page.locator('#po-register .po-card').filter({ hasText: poTitle });
	await expect(poCard.getByText('issued', { exact: true })).toBeVisible();
	await expect(poCard).toContainText('£1,250.00');
	await poCard.locator('summary').filter({ hasText: 'Record receipt' }).click();
	await poCard.getByLabel('Quantity received').fill('4');
	await poCard.getByLabel('Supplier delivery reference').fill(`DN-${suffix}`);
	await poCard.getByRole('button', { name: 'Record confirmed receipt' }).click();
	await expect(page).toHaveURL(/\/purchasing$/);

	await page.goto(`/commercial/cost-control?project=${encodeURIComponent(projectPublicId)}#create-cost-code`);
	const costCodePanel = page.locator('#create-cost-code');
	await costCodePanel.getByLabel('Cost category').selectOption('material');
	await costCodePanel.getByLabel('Cost code').fill(costCode);
	await costCodePanel.getByLabel('Name').fill('Containment materials');
	await costCodePanel.getByRole('button', { name: 'Create cost code' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));

	const budgetPanel = page.locator('#create-budget');
	await budgetPanel.getByLabel('Cost code').selectOption({ label: `${costCode} · Containment materials` });
	await budgetPanel.getByLabel('Budget name').fill(`Approved baseline ${suffix}`);
	await budgetPanel.getByLabel('Budget amount').fill('5000.00');
	await budgetPanel.getByRole('button', { name: 'Create budget draft' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));
	let budgetCard = page.locator('#budget-register .budget-card').filter({ hasText: `Approved baseline ${suffix}` });
	await budgetCard.getByRole('button', { name: 'Approve baseline budget' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));
	budgetCard = page.locator('#budget-register .budget-card').filter({ hasText: `Approved baseline ${suffix}` });
	await expect(budgetCard.getByText('approved', { exact: true })).toBeVisible();

	const commitmentCard = page
		.locator('#commitment-register .commitment-card')
		.filter({ hasText: purchaseOrderNumber });
	await commitmentCard.getByLabel('Cost code').selectOption({ label: `${costCode} · Containment materials` });
	await commitmentCard.getByRole('button', { name: 'Classify full line' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));

	const variationPanel = page.locator('#create-variation');
	await variationPanel.getByLabel('Variation type').selectOption('supplier_change');
	await variationPanel.getByLabel('Commercial side').selectOption('cost');
	await variationPanel.getByLabel('Cost code').selectOption({ label: `${costCode} · Containment materials` });
	const poSelect = variationPanel.locator('select[name="purchaseOrderPublicId"]');
	await poSelect.selectOption(await optionValueContaining(poSelect, purchaseOrderNumber));
	await variationPanel.getByLabel('Variation title').fill(variationTitle);
	await variationPanel.getByLabel('Description').fill('Additional containment supports required by coordination.');
	await variationPanel.getByLabel('Quantity').fill('2');
	await variationPanel.getByLabel('Unit rate').fill('125.00');
	await variationPanel.getByRole('button', { name: 'Create variation draft' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));
	let variationCard = page.locator('#variation-register .variation-card').filter({ hasText: variationTitle });
	await variationCard.getByRole('button', { name: 'Issue variation' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));
	variationCard = page.locator('#variation-register .variation-card').filter({ hasText: variationTitle });
	await variationCard.locator('summary').filter({ hasText: 'Record decision' }).click();
	await variationCard.getByLabel('Decision').selectOption('accepted');
	await variationCard.getByRole('button', { name: 'Record variation decision' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/cost-control\\?project=${projectPublicId}$`));

	await expect(page.locator('.metrics article').filter({ hasText: 'Approved baseline budget' })).toContainText('£5,000.00');
	await expect(page.locator('.metrics article').filter({ hasText: 'Issued PO commitment' })).toContainText('£1,250.00');
	await expect(page.locator('.metrics article').filter({ hasText: 'Cost-code classified' })).toContainText('£1,250.00');
	await expect(page.locator('.metrics article').filter({ hasText: 'Accepted receipt cost' })).toContainText('£500.00');
	await expect(page.locator('.metrics article').filter({ hasText: 'Approved change' })).toContainText('£250.00');

	await page.goto(`/commercial/valuations?project=${encodeURIComponent(projectPublicId)}#create-valuation`);
	const valuationPanel = page.locator('#create-valuation');
	const valuationPo = valuationPanel.locator('select[name="purchaseOrderPublicId"]');
	await valuationPo.selectOption(await optionValueContaining(valuationPo, purchaseOrderNumber));
	await valuationPanel.getByLabel('Cost code').selectOption({ label: `${costCode} · Containment materials` });
	await valuationPanel.getByLabel('Valuation date').fill('2026-08-20');
	await valuationPanel.getByLabel('Gross value to date').fill('500.00');
	await valuationPanel.getByLabel('Description').fill('Supplier application for installed containment to date.');
	await valuationPanel.getByRole('button', { name: 'Create supplier application' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/valuations\\?project=${projectPublicId}$`));
	let valuationCard = page.locator('#valuation-register .valuation-card').filter({ hasText: purchaseOrderNumber });
	await expect(valuationCard).toContainText('£500.00');
	await valuationCard.getByRole('button', { name: 'Submit application' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/valuations\\?project=${projectPublicId}$`));
	valuationCard = page.locator('#valuation-register .valuation-card').filter({ hasText: purchaseOrderNumber });
	await expect(valuationCard.getByText('submitted', { exact: true })).toBeVisible();
	await valuationCard.getByRole('button', { name: 'Assess application' }).click();
	await expect(page).toHaveURL(new RegExp(`/commercial/valuations\\?project=${projectPublicId}$`));
	valuationCard = page.locator('#valuation-register .valuation-card').filter({ hasText: purchaseOrderNumber });
	await expect(valuationCard.getByText('assessed', { exact: true })).toBeVisible();
});
