import { expect, test, type Response } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

function isProfileUpdateResponse(response: Response) {
	const requestMethod = response.request().method();
	const responsePathname = new URL(response.url()).pathname;
	return requestMethod === 'POST' && responsePathname === '/organisation/profile';
}

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test('owner configures and transitions accounting periods through the browser', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/finance/accounting/periods');

	const yearForm = page.locator('form[action="?/createFinancialYear"]');
	await yearForm.getByLabel('Code').fill('FY2027');
	await yearForm.getByLabel('Name').fill('E2E Financial Year 2027');
	await yearForm.getByLabel('Starts').fill('2027-01-01');
	await yearForm.getByLabel('Ends').fill('2027-12-31');
	await yearForm.getByRole('button', { name: 'Create financial year' }).click();
	await expect(
		page.locator('strong').filter({ hasText: 'FY2027 · E2E Financial Year 2027' }).first()
	).toBeVisible();

	const periodForm = page.locator('form[action="?/createPeriod"]');
	await periodForm
		.getByLabel('Financial year')
		.selectOption({ label: 'FY2027 · E2E Financial Year 2027' });
	await periodForm.getByLabel('Period number').fill('1');
	await periodForm.getByLabel('Name').fill('January 2027');
	await periodForm.getByLabel('Starts').fill('2027-01-01');
	await periodForm.getByLabel('Ends').fill('2027-01-31');
	await periodForm.getByRole('button', { name: 'Create period' }).click();
	await expect(page.getByText('1 · January 2027', { exact: true })).toBeVisible();

	let transitionForm = page.locator('form[action="?/softClose"]');
	await transitionForm.getByPlaceholder('Close reason').fill('E2E soft close');
	await transitionForm.getByRole('button', { name: 'Soft close' }).click();
	await expect(page.getByText('soft closed', { exact: true }).first()).toBeVisible();

	transitionForm = page.locator('form[action="?/hardClose"]');
	await transitionForm.getByPlaceholder('Hard-close reason').fill('E2E hard close');
	await transitionForm.getByRole('button', { name: 'Hard close' }).click();
	await expect(page.getByText('hard closed', { exact: true }).first()).toBeVisible();

	transitionForm = page.locator('form[action="?/reopen"]');
	await transitionForm.getByPlaceholder('Reopen reason').fill('E2E reopen authority');
	await transitionForm.getByRole('button', { name: 'Reopen' }).click();
	await expect(page.getByText('open', { exact: true }).first()).toBeVisible();
});

test('owner creates a role and controls an invitation through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/organisation');

	await page.getByText('Create organisation role', { exact: true }).click();
	const roleForm = page.locator('form[action="?/createRole"]');
	await roleForm.getByLabel('Name').fill('E2E Read Only');
	await roleForm.getByLabel('Description').fill('Browser acceptance read-only role.');
	await roleForm.getByLabel(/crm\.view/).check();
	await roleForm.getByRole('button', { name: 'Create role' }).click();
	await expect(page.getByText('E2E Read Only', { exact: true }).first()).toBeVisible();

	const inviteForm = page.locator('form[action="?/invite"]');
	await inviteForm.getByLabel('Email').fill('invitee-ui@example.test');
	await inviteForm.getByLabel(/E2E Read Only/).check();
	await inviteForm.getByRole('button', { name: 'Send invitation' }).click();
	await expect(page.getByText('invitee-ui@example.test', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Revoke' }).click();
	await expect(page.getByText('Revoked', { exact: true }).first()).toBeVisible();
});

test('organisation settings expose every governed Domain 1 workspace', async ({ page }) => {
	await signIn(page);
	await page.goto('/organisation');

	const navigation = page.getByRole('navigation', { name: 'Organisation settings' });
	await expect(navigation.getByRole('link', { name: 'Access & roles' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Organisation profile' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Legal identity' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Locations' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Teams' })).toBeVisible();
	await expect(navigation.getByRole('link', { name: 'Permission exceptions' })).toBeVisible();

	await navigation.getByRole('link', { name: 'Locations' }).click();
	await expect(page).toHaveURL(/\/organisation\/locations$/);
	await expect(page.getByRole('heading', { name: 'Locations', level: 1 })).toBeVisible();
});

test('owner maintains the canonical organisation profile through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/organisation');
	await page.getByRole('link', { name: 'Organisation profile' }).click();
	await expect(page).toHaveURL(/\/organisation\/profile$/);

	const profileForm = page.locator('form').filter({
		has: page.getByRole('button', { name: 'Save organisation profile' })
	});
	await expect(profileForm.getByLabel('Legal name')).toHaveValue(ORGANISATION);
	await expect(profileForm.getByLabel('Default timezone')).toHaveValue('Europe/London');
	await expect(profileForm.getByLabel('Default currency')).toHaveValue('GBP');

	async function saveProfile() {
		const responsePromise = page.waitForResponse(isProfileUpdateResponse);
		await profileForm.getByRole('button', { name: 'Save organisation profile' }).click();
		const response = await responsePromise;
		expect(response.status()).toBe(303);
		await expect(page).toHaveURL(/\/organisation\/profile\?updated=1$/);
		await expect(page.getByRole('status')).toHaveText('Organisation profile updated.');
	}

	await profileForm.getByLabel('Trading name').fill('NuBlox E2E Trading Name');
	await saveProfile();
	await expect(profileForm.getByLabel('Trading name')).toHaveValue('NuBlox E2E Trading Name');

	await profileForm.getByLabel('Trading name').fill('');
	await saveProfile();
	await expect(profileForm.getByLabel('Trading name')).toHaveValue('');
});

test('owner maintains canonical legal identifiers through the browser', async ({ page }) => {
	await signIn(page);
	await page.goto('/organisation');
	await page.getByRole('link', { name: 'Legal identity' }).click();
	await expect(page).toHaveURL(/\/organisation\/identity$/);

	const addForm = page.locator('form[action="?/addIdentifier"]');
	await addForm.getByLabel('Identifier type').fill('vat_number');
	await addForm.getByLabel('Identifier value').fill('GB999999973');
	await addForm.getByLabel('Issuing country').fill('GB');
	await addForm.getByRole('button', { name: 'Add identifier' }).click();

	const identifiersPanel = page.locator('section[aria-labelledby="registered-heading"]');
	await expect(identifiersPanel.getByText('vat_number', { exact: true })).toBeVisible();
	await expect(identifiersPanel.getByText('GB999999973', { exact: true })).toBeVisible();
	await expect(identifiersPanel.getByText('GB', { exact: true })).toBeVisible();

	await identifiersPanel.getByRole('button', { name: 'Remove' }).click();
	await expect(identifiersPanel.getByText('GB999999973', { exact: true })).toHaveCount(0);
	await expect(
		identifiersPanel.getByText('No legal or regulatory identifiers have been recorded.')
	).toBeVisible();
});

test('owner controls explicit member permission exceptions through the browser', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/organisation');
	await page.getByRole('link', { name: 'Permission exceptions' }).click();
	await expect(page).toHaveURL(/\/organisation\/permissions$/);

	const overrideForm = page.locator('form[action="?/setOverride"]');
	const memberSelect = overrideForm.locator('select[name="memberPublicId"]');
	const viewerOption = memberSelect.locator('option', { hasText: 'NuBlox E2E Viewer' });
	const viewerPublicId = await viewerOption.getAttribute('value');
	expect(viewerPublicId).not.toBeNull();
	await memberSelect.selectOption(viewerPublicId ?? '');
	await overrideForm.locator('input[name="permissionKey"]').fill('crm.party.manage');
	await overrideForm.locator('select[name="effect"]').selectOption('deny');
	await overrideForm.locator('textarea[name="reason"]').fill('E2E explicit deny exception.');
	await overrideForm.getByRole('button', { name: 'Set permission exception' }).click();

	const overridesPanel = page.locator('section[aria-labelledby="current-overrides-heading"]');
	await expect(overridesPanel.getByText('NuBlox E2E Viewer', { exact: true })).toBeVisible();
	await expect(overridesPanel.getByText('crm.party.manage', { exact: true })).toBeVisible();
	await expect(overridesPanel.getByText('deny', { exact: true })).toBeVisible();
	await expect(overridesPanel.getByText('Ongoing', { exact: true })).toBeVisible();
	await expect(
		overridesPanel.getByText('E2E explicit deny exception.', { exact: true })
	).toBeVisible();

	await overridesPanel.getByRole('button', { name: 'Remove' }).click();
	await expect(
		overridesPanel.getByText('E2E explicit deny exception.', { exact: true })
	).toHaveCount(0);
	await expect(
		overridesPanel.getByText('No explicit member permission exceptions are configured.')
	).toBeVisible();
});
