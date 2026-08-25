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

test('owner governs project risks, issues, decisions and linked Work Kernel actions', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-RIDA-${suffix}`;
	const projectName = `RIDA controls ${suffix}`;

	await page.goto('/projects#create-project');
	const projectForm = page.locator('form[action="?/create"]');
	await projectForm.getByLabel('Project number').fill(projectNumber);
	await projectForm.getByLabel('Project name').fill(projectName);
	await projectForm
		.getByLabel(/Description/)
		.fill('Browser acceptance for governed project RIDA controls.');
	await projectForm.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;

	await page.goto(`/projects/${projectPublicId}/rida`);
	await expect(
		page.getByRole('heading', { name: 'Risks, issues, decisions & actions', level: 1 })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Risk register', level: 2 })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Action register', level: 2 })).toBeVisible();

	const riskForm = page.locator('form[action="?/createItem"]').filter({ hasText: 'Raise risk' });
	await riskForm.getByLabel('Title').fill('Tower crane lead time');
	await riskForm.getByLabel('Direction').selectOption('threat');
	await riskForm.getByLabel('Probability (1–5)').fill('4');
	await riskForm.getByLabel('Impact (1–5)').fill('5');
	await riskForm.getByLabel('Response strategy').selectOption('reduce');
	await riskForm
		.getByLabel('Response plan')
		.fill('Secure alternate crane supplier and preserve float.');
	await riskForm.getByRole('button', { name: 'Raise risk' }).click();

	const riskCard = page.locator('.register-card').filter({ hasText: 'Tower crane lead time' });
	await expect(riskCard).toContainText('R-001');
	await expect(riskCard).toContainText('20 (4 × 5)');
	await expect(page.getByText('Open risks').locator('..')).toContainText('1');

	await riskCard.getByText('Add follow-up action').click();
	const actionForm = riskCard.locator('form[action="?/createAction"]');
	await actionForm.getByLabel('Action').fill('Confirm alternate crane reservation');
	await actionForm
		.getByLabel('Description')
		.fill('Obtain written reservation and mobilisation date.');
	await actionForm.getByLabel('Priority').selectOption('high');
	await actionForm.getByLabel('Due date').fill('2026-09-01');
	await actionForm.getByRole('button', { name: 'Create action' }).click();
	await expect(
		page.getByRole('cell', { name: 'Confirm alternate crane reservation' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'Action register', level: 2 }).locator('..')
	).toContainText('1 linked actions');

	const issueForm = page.locator('form[action="?/createItem"]').filter({ hasText: 'Raise issue' });
	await issueForm.getByLabel('Title').fill('Temporary power shortfall');
	await issueForm.getByLabel('Severity').selectOption('high');
	await issueForm.getByLabel('Impact').fill('Commissioning activities cannot run concurrently.');
	await issueForm.getByLabel('Resolution plan').fill('Add temporary distribution capacity.');
	await issueForm.getByRole('button', { name: 'Raise issue' }).click();
	await expect(
		page.locator('.register-card').filter({ hasText: 'Temporary power shortfall' })
	).toContainText('I-001');

	const decisionForm = page
		.locator('form[action="?/createItem"]')
		.filter({ hasText: 'Propose decision' });
	await decisionForm.getByLabel('Decision required').fill('Approve revised facade sequence');
	await decisionForm.getByLabel('Context').fill('Protect the weather-tight milestone.');
	await decisionForm.getByLabel('Decision required by').fill('2026-09-03');
	await decisionForm.getByRole('button', { name: 'Propose decision' }).click();

	const decisionCard = page
		.locator('.register-card')
		.filter({ hasText: 'Approve revised facade sequence' });
	await expect(decisionCard).toContainText('D-001');
	const authoritativeDecision = decisionCard.locator('form[action="?/decideItem"]');
	await authoritativeDecision
		.getByLabel('Outcome')
		.fill('Proceed with the revised facade sequence.');
	await authoritativeDecision
		.getByLabel('Rationale')
		.fill('The sequence protects the approved milestone without changing control budget.');
	await authoritativeDecision
		.getByRole('button', { name: 'Record authoritative decision' })
		.click();
	await expect(decisionCard).toContainText('decided');
	await expect(decisionCard).toContainText('Proceed with the revised facade sequence.');
});
