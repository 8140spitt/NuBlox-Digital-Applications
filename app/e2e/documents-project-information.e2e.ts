import { expect, test } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';

async function signIn(page: import('@playwright/test').Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/);
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
}

test('owner controls document revision, RFI, submittal and instruction records through the UI', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-INFO-${suffix}`;
	const projectName = `Information acceptance ${suffix}`;
	const documentNumber = `E2E-A-${suffix}`;
	const documentTitle = `Containment coordination plan ${suffix}`;
	const rfiNumber = `RFI-${suffix}`;
	const submittalNumber = `SUB-${suffix}`;
	const instructionNumber = `PI-${suffix}`;

	await page.goto('/projects#create-project');
	await page.getByLabel('Project number').fill(projectNumber);
	await page.getByLabel('Project name').fill(projectName);
	await page
		.getByLabel(/Description/)
		.fill('Browser acceptance project for controlled documents and project information.');
	await page.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);

	await page.goto('/documents#create-document');
	const documentPanel = page.locator('#create-document');
	await documentPanel
		.getByLabel('Project')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await documentPanel.getByLabel('Document type').selectOption({ label: 'Drawing' });
	await documentPanel.getByLabel('Document number').fill(documentNumber);
	await documentPanel.getByLabel('Title').fill(documentTitle);
	await documentPanel.getByLabel('Discipline code').fill('E');
	await documentPanel.getByLabel('Classification code').fill('EF_70_20');
	await documentPanel.getByLabel('Initial revision').fill('P01');
	await documentPanel.getByLabel('Suitability').fill('S3');
	await documentPanel.getByLabel('Purpose').selectOption({ label: 'review · For review' });
	await documentPanel.getByRole('button', { name: 'Create document' }).click();
	await expect(page).toHaveURL(/\/documents$/);

	let documentCard = page.locator('.document-card').filter({ hasText: documentNumber });
	await expect(documentCard.getByRole('heading', { name: documentTitle, level: 3 })).toBeVisible();
	await expect(documentCard.getByText('P01', { exact: true })).toBeVisible();
	await expect(documentCard.getByText('draft', { exact: true })).toBeVisible();
	await documentCard.getByRole('button', { name: 'Issue P01' }).click();
	await expect(page).toHaveURL(/\/documents$/);

	documentCard = page.locator('.document-card').filter({ hasText: documentNumber });
	await expect(documentCard.getByText('issued', { exact: true })).toBeVisible();
	const newRevision = documentCard.locator('.new-revision');
	await newRevision.locator('summary').click();
	await newRevision.getByLabel('Revision code').fill('P02');
	await newRevision.getByLabel('Revision title').fill(`${documentTitle} coordinated`);
	await newRevision.getByLabel('Suitability').fill('S4');
	await newRevision.getByLabel('Purpose').selectOption({ label: 'approval · For approval' });
	await newRevision.getByRole('button', { name: 'Create revision' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	await expect(
		page.locator('.document-card').filter({ hasText: documentNumber }).getByText('P02', { exact: true })
	).toBeVisible();

	const rfiPanel = page.locator('#create-rfi');
	await rfiPanel.getByLabel('Project').selectOption({ label: `${projectNumber} · ${projectName}` });
	await rfiPanel.getByLabel('RFI number').fill(rfiNumber);
	await rfiPanel.getByLabel('Priority').selectOption('high');
	await rfiPanel.getByLabel('Subject').fill(`Riser clearance ${suffix}`);
	await rfiPanel
		.getByLabel('Question')
		.fill('Confirm the coordinated service clearance at the riser.');
	await rfiPanel.getByRole('button', { name: 'Create RFI draft' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	let rfiCard = page.locator('#rfi-register .workflow-card').filter({ hasText: rfiNumber });
	await rfiCard.getByRole('button', { name: 'Open RFI' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	rfiCard = page.locator('#rfi-register .workflow-card').filter({ hasText: rfiNumber });
	await rfiCard.locator('summary').filter({ hasText: 'Record response' }).click();
	await rfiCard
		.getByLabel('Response')
		.fill('Maintain 150 mm clear separation from the coordinated service zone.');
	await rfiCard.getByRole('button', { name: 'Record final response' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	rfiCard = page.locator('#rfi-register .workflow-card').filter({ hasText: rfiNumber });
	await rfiCard.getByRole('button', { name: 'Close RFI' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	await expect(
		page.locator('#rfi-register .workflow-card').filter({ hasText: rfiNumber }).getByText('closed', { exact: true })
	).toBeVisible();

	const submittalPanel = page.locator('#create-submittal');
	await submittalPanel
		.getByLabel('Project')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await submittalPanel.getByLabel('Submittal number').fill(submittalNumber);
	await submittalPanel.getByLabel('Type').selectOption({ label: 'Technical submittal' });
	await submittalPanel.getByLabel('Title').fill(`Containment submittal ${suffix}`);
	await submittalPanel
		.getByLabel('Document revision (optional)')
		.selectOption({ label: `${documentNumber} · P02 · ${documentTitle}` });
	await submittalPanel.getByRole('button', { name: 'Create submittal draft' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	let submittalCard = page
		.locator('#submittal-register .workflow-card')
		.filter({ hasText: submittalNumber });
	await submittalCard.getByRole('button', { name: 'Submit' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	submittalCard = page
		.locator('#submittal-register .workflow-card')
		.filter({ hasText: submittalNumber });
	await expect(submittalCard.getByText('submitted', { exact: true })).toBeVisible();

	const instructionPanel = page.locator('#create-instruction');
	await instructionPanel
		.getByLabel('Project')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await instructionPanel.getByLabel('Instruction number').fill(instructionNumber);
	await instructionPanel.getByLabel('Type').selectOption({ label: 'Project instruction' });
	await instructionPanel.getByLabel('Subject').fill(`Proceed with coordinated route ${suffix}`);
	await instructionPanel
		.getByLabel('Instruction')
		.fill('Proceed in accordance with the current coordinated containment information.');
	await instructionPanel.getByRole('button', { name: 'Create instruction draft' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	let instructionCard = page
		.locator('#instruction-register .workflow-card')
		.filter({ hasText: instructionNumber });
	await instructionCard.getByRole('button', { name: 'Issue instruction' }).click();
	await expect(page).toHaveURL(/\/documents$/);
	instructionCard = page
		.locator('#instruction-register .workflow-card')
		.filter({ hasText: instructionNumber });
	await expect(instructionCard.getByText('issued', { exact: true })).toBeVisible();
});
