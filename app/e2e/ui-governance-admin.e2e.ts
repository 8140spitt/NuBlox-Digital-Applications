import { expect, test, type Response } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

function isProfileUpdateResponse(response: Response) {
	return (
		response.request().method() === 'POST' &&
		new URL(response.url()).pathname === '/organisation/profile'
	);
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
	const profileIsValid = await profileForm.evaluate(
		(form) => (form as HTMLFormElement).checkValidity()
	);
	expect(profileIsValid).toBe(true);

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
