import { expect, test } from '@playwright/test';

const appUrl = 'http://127.0.0.1:4173';

test('sign-in exposes password recovery', async ({ page }) => {
	await page.goto(`${appUrl}/signin`);

	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
		'href',
		'/forgot-password'
	);
});

test('password reset request uses a non-enumerating confirmation', async ({ page }) => {
	await page.route('**/api/auth/request-password-reset', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ status: true })
		});
	});

	await page.goto(`${appUrl}/forgot-password`);
	await page.getByLabel('Email').fill('stephen@example.test');
	await page.getByRole('button', { name: 'Send reset link' }).click();

	await expect(page.getByRole('status')).toContainText(
		'If a NuBlox account exists for stephen@example.test'
	);
});

test('reset page rejects mismatched passwords before calling the auth API', async ({ page }) => {
	let resetRequests = 0;
	await page.route('**/api/auth/reset-password', async (route) => {
		resetRequests += 1;
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ status: true })
		});
	});

	await page.goto(`${appUrl}/reset-password?token=test-token`);
	await page.getByLabel('New password').fill('NewPassword-1234');
	await page.getByLabel('Confirm new password').fill('Different-Password-1234');
	await page.getByRole('button', { name: 'Update password' }).click();

	await expect(page.getByRole('alert')).toHaveText('The passwords do not match.');
	expect(resetRequests).toBe(0);
});

test('successful reset returns to sign-in with confirmation', async ({ page }) => {
	await page.route('**/api/auth/reset-password', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ status: true })
		});
	});

	await page.goto(`${appUrl}/reset-password?token=test-token`);
	await page.getByLabel('New password').fill('NewPassword-1234');
	await page.getByLabel('Confirm new password').fill('NewPassword-1234');
	await page.getByRole('button', { name: 'Update password' }).click();

	await expect(page).toHaveURL(`${appUrl}/signin?reset=1`);
	await expect(page.getByText('Password updated. Sign in with your new password.')).toBeVisible();
});

test('invalid reset token offers a new recovery request', async ({ page }) => {
	await page.goto(`${appUrl}/reset-password?error=INVALID_TOKEN`);

	await expect(page.getByRole('alert')).toContainText('invalid or has expired');
	await expect(page.getByRole('link', { name: 'Request a new reset link' })).toHaveAttribute(
		'href',
		'/forgot-password'
	);
});
