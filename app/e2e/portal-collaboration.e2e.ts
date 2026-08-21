import { expect, test, type Locator, type Page } from '@playwright/test';

const OWNER_EMAIL = 'e2e-owner@example.test';
const OWNER_PASSWORD = 'NuBlox-E2E-Password-2026!';
const OWNER_ORGANISATION = 'NuBlox E2E Organisation';
const PARTNER_EMAIL = 'e2e-portal-partner@example.test';
const PARTNER_PASSWORD = 'NuBlox-E2E-Portal-Partner-2026!';
const PARTNER_ORGANISATION = 'NuBlox E2E Portal Partner';
const PROJECT_NUMBER = 'PORTAL-E2E-001';
const PROJECT_NAME = 'Portal collaboration project';
const RFI_NUMBER = 'PORTAL-RFI-001';
const SUBMITTAL_NUMBER = 'PORTAL-SUB-001';
const INSTRUCTION_NUMBER = 'PORTAL-PI-001';
const DOCUMENT_NUMBER = 'PORTAL-DOC-001';

async function signIn(page: Page, email: string, password: string, organisation: string) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(organisation) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

async function selectOptionContaining(select: Locator, text: string) {
	const optionValue = await select.locator('option').filter({ hasText: text }).first().getAttribute('value');
	expect(optionValue).toBeTruthy();
	await select.selectOption(optionValue!);
}

test('owner explicitly shares controlled work and partner completes it through the focused portal', async ({
	page
}) => {
	await signIn(page, OWNER_EMAIL, OWNER_PASSWORD, OWNER_ORGANISATION);
	await page.goto('/portal/manage');
	await expect(page.getByRole('heading', { name: 'Manage sharing' })).toBeVisible();

	const projectSelect = page.getByLabel('Project', { exact: true });
	const projectOption = projectSelect.locator('option').filter({
		hasText: `${PROJECT_NUMBER} · ${PROJECT_NAME}`
	});
	const projectPublicId = await projectOption.getAttribute('value');
	expect(projectPublicId).toBeTruthy();
	await projectSelect.selectOption(projectPublicId!);
	await expect(page).toHaveURL(new RegExp(`/portal/manage\\?project=${projectPublicId}$`));
	await expect(
		page.getByLabel('Who you can share with').getByText(PARTNER_ORGANISATION, { exact: true })
	).toBeVisible();

	const rfiCard = page.locator('.share-card').filter({ hasText: 'Assign an RFI' });
	await selectOptionContaining(rfiCard.getByLabel('RFI'), RFI_NUMBER);
	await rfiCard.getByLabel('Organisation').selectOption({ label: PARTNER_ORGANISATION });
	await rfiCard.getByRole('button', { name: 'Assign RFI' }).click();
	await expect(page).toHaveURL(new RegExp(`/portal/manage\\?project=${projectPublicId}$`));

	const submittalCard = page.locator('.share-card').filter({ hasText: 'Assign a submittal' });
	await selectOptionContaining(submittalCard.getByLabel('Submittal'), SUBMITTAL_NUMBER);
	await submittalCard.getByLabel('Organisation').selectOption({ label: PARTNER_ORGANISATION });
	await submittalCard.getByLabel('Review due').fill('2026-08-30T17:00');
	await submittalCard.getByRole('button', { name: 'Assign review' }).click();
	await expect(page).toHaveURL(new RegExp(`/portal/manage\\?project=${projectPublicId}$`));

	const instructionCard = page.locator('.share-card').filter({ hasText: 'Send an instruction' });
	await selectOptionContaining(instructionCard.getByLabel('Instruction'), INSTRUCTION_NUMBER);
	await instructionCard.getByLabel('Organisation').selectOption({ label: PARTNER_ORGANISATION });
	await instructionCard.getByRole('button', { name: 'Add recipient' }).click();
	await expect(page).toHaveURL(new RegExp(`/portal/manage\\?project=${projectPublicId}$`));

	const transmittalCard = page.locator('.share-card').filter({ hasText: 'Issue a revision' });
	await selectOptionContaining(transmittalCard.getByLabel('Revision'), DOCUMENT_NUMBER);
	await transmittalCard.getByLabel('Organisation').selectOption({ label: PARTNER_ORGANISATION });
	await transmittalCard.getByLabel('Transmittal number').fill('PORTAL-TR-001');
	await transmittalCard.getByLabel('Purpose').fill('For construction');
	await transmittalCard.getByLabel('Subject').fill('Portal collaboration issue');
	await transmittalCard.getByRole('button', { name: 'Issue to portal' }).click();
	await expect(page).toHaveURL(new RegExp(`/portal/manage\\?project=${projectPublicId}$`));

	await page.context().clearCookies();
	await signIn(page, PARTNER_EMAIL, PARTNER_PASSWORD, PARTNER_ORGANISATION);
	await page.goto('/portal');
	await expect(page.getByRole('heading', { name: 'Shared work' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
	await expect(
		page.getByText(`${PROJECT_NUMBER} · ${PROJECT_NAME}`, { exact: false }).first()
	).toBeVisible();

	const partnerRfiCard = page.locator('.work-card').filter({ hasText: RFI_NUMBER });
	await expect(partnerRfiCard).toContainText('Confirm external opening size');
	await partnerRfiCard.getByText('Respond to RFI', { exact: true }).click();
	await partnerRfiCard.getByLabel('Response').fill('Use a 650 × 450 mm coordinated opening.');
	await partnerRfiCard.getByRole('button', { name: 'Send response' }).click();
	await expect(page).toHaveURL(/\/portal$/);
	await expect(page.locator('.work-card').filter({ hasText: RFI_NUMBER })).toHaveCount(0);

	const partnerSubmittalCard = page.locator('.work-card').filter({ hasText: SUBMITTAL_NUMBER });
	await partnerSubmittalCard.getByText('Review submittal', { exact: true }).click();
	await partnerSubmittalCard.getByLabel('Outcome').selectOption('approved_with_comments');
	await partnerSubmittalCard
		.getByLabel('Comments')
		.fill('Coordinate sleeve position before construction release.');
	await partnerSubmittalCard.getByRole('button', { name: 'Submit review' }).click();
	await expect(page.locator('.work-card').filter({ hasText: SUBMITTAL_NUMBER })).toHaveCount(0);

	const partnerInstructionCard = page.locator('.work-card').filter({ hasText: INSTRUCTION_NUMBER });
	await partnerInstructionCard.getByRole('button', { name: 'Acknowledge instruction' }).click();
	await expect(page.locator('.work-card').filter({ hasText: INSTRUCTION_NUMBER })).toHaveCount(0);

	await expect(page.getByText('PORTAL-TR-001', { exact: true })).toBeVisible();
	await expect(page.getByText(DOCUMENT_NUMBER, { exact: true })).toBeVisible();
	await expect(page.getByText('Rev C01 · Issued', { exact: true })).toBeVisible();
});
