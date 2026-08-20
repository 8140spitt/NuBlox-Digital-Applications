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

test('owner records and closes controlled site, quality and safety workflows through the browser', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-SITE-${suffix}`;
	const projectName = `Field operations ${suffix}`;
	const siteCode = `SITE-${suffix}`;
	const siteName = `Main works ${suffix}`;
	const diarySummary = `Field diary ${suffix}`;
	const templateCode = `CHK-${suffix}`;
	const templateName = `Containment checklist ${suffix}`;
	const inspectionTitle = `Containment inspection ${suffix}`;
	const defectTitle = `Support spacing defect ${suffix}`;
	const safetyTitle = `Access route observation ${suffix}`;

	await page.goto('/projects#create-project');
	await page.getByLabel('Project number').fill(projectNumber);
	await page.getByLabel('Project name').fill(projectName);
	await page
		.getByLabel(/Description/)
		.fill('Browser acceptance project for site, quality and safety.');
	await page.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);
	const projectPublicId = new URL(page.url()).pathname.split('/').at(-1)!;
	const siteUrl = new RegExp(`/site\\?project=${projectPublicId}$`);

	await page.goto(`/site?project=${encodeURIComponent(projectPublicId)}#create-site`);
	await expect(
		page.getByRole('heading', { name: 'Site, quality & safety', level: 1 })
	).toBeVisible();
	const sitePanel = page.locator('#create-site');
	await sitePanel.getByLabel('Site code').fill(siteCode);
	await sitePanel.getByLabel('Site name').fill(siteName);
	await sitePanel.getByLabel('Timezone').fill('Europe/London');
	await sitePanel.getByRole('button', { name: 'Create project site' }).click();
	await expect(page).toHaveURL(siteUrl);
	await expect(
		page.locator('#site-register .record-card').filter({ hasText: siteName })
	).toBeVisible();

	const diaryPanel = page.locator('#create-diary');
	await diaryPanel.getByLabel('Site').selectOption({ label: `${siteCode} · ${siteName}` });
	await diaryPanel.getByLabel('Diary date').fill('2026-08-20');
	await diaryPanel.getByLabel('Shift').fill('Day shift');
	await diaryPanel.getByLabel('Summary').fill(diarySummary);
	await diaryPanel
		.getByLabel('Activity description')
		.fill('Installed containment to the east corridor.');
	await diaryPanel.getByLabel('Location').fill('Level 02 east corridor');
	await diaryPanel.getByLabel('Progress %').fill('60');
	await diaryPanel.getByRole('button', { name: 'Create diary draft' }).click();
	await expect(page).toHaveURL(siteUrl);
	let diaryCard = page.locator('#diary-register .diary-card').filter({ hasText: diarySummary });
	await expect(diaryCard.getByText('draft', { exact: true })).toBeVisible();
	await diaryCard.getByRole('button', { name: 'Submit diary' }).click();
	await expect(page).toHaveURL(siteUrl);
	diaryCard = page.locator('#diary-register .diary-card').filter({ hasText: diarySummary });
	await expect(diaryCard.getByText('submitted', { exact: true })).toBeVisible();
	await diaryCard.getByRole('button', { name: 'Approve diary' }).click();
	await expect(page).toHaveURL(siteUrl);
	diaryCard = page.locator('#diary-register .diary-card').filter({ hasText: diarySummary });
	await expect(diaryCard.getByText('approved', { exact: true })).toBeVisible();

	const templatePanel = page.locator('#create-template');
	await templatePanel.getByLabel('Template code').fill(templateCode);
	await templatePanel.getByLabel('Template name').fill(templateName);
	await templatePanel.getByLabel('Description').fill('Controlled browser acceptance checklist.');
	await templatePanel.getByLabel('Checklist prompts').fill('Containment securely fixed');
	await templatePanel.getByRole('button', { name: 'Publish checklist v1' }).click();
	await expect(page).toHaveURL(siteUrl);
	await expect(
		page.locator('#template-register .record-card').filter({ hasText: templateName })
	).toContainText('published');

	const inspectionPanel = page.locator('#create-inspection');
	await inspectionPanel.getByLabel('Site').selectOption({ label: `${siteCode} · ${siteName}` });
	const checklistSelect = inspectionPanel.getByLabel('Checklist');
	await checklistSelect.selectOption(await optionValueContaining(checklistSelect, templateName));
	await inspectionPanel.getByLabel('Inspection title').fill(inspectionTitle);
	await inspectionPanel.getByLabel('Location').fill('Level 02 east corridor');
	await inspectionPanel.getByRole('button', { name: 'Start inspection' }).click();
	await expect(page).toHaveURL(siteUrl);
	let inspectionCard = page
		.locator('#inspection-register .inspection-card')
		.filter({ hasText: inspectionTitle });
	await expect(inspectionCard.getByText('in_progress', { exact: true })).toBeVisible();
	const checkItem = inspectionCard.locator('.check-item').first();
	await checkItem.getByLabel('Result').selectOption('pass');
	await checkItem.getByLabel('Comments').fill('Fixings comply with the issued checklist.');
	await checkItem.getByRole('button', { name: 'Record check' }).click();
	await expect(page).toHaveURL(siteUrl);
	inspectionCard = page
		.locator('#inspection-register .inspection-card')
		.filter({ hasText: inspectionTitle });
	await expect(inspectionCard.locator('.result-pass')).toContainText('pass');
	await inspectionCard.getByRole('button', { name: 'Complete inspection' }).click();
	await expect(page).toHaveURL(siteUrl);
	inspectionCard = page
		.locator('#inspection-register .inspection-card')
		.filter({ hasText: inspectionTitle });
	await expect(inspectionCard.getByText('completed', { exact: true })).toBeVisible();

	const defectPanel = page.locator('#create-defect');
	await defectPanel.getByLabel('Site').selectOption({ label: `${siteCode} · ${siteName}` });
	await defectPanel.getByLabel('Severity').selectOption('medium');
	await defectPanel.getByLabel('Title').fill(defectTitle);
	await defectPanel
		.getByLabel('Description')
		.fill('Add one containment support at the corridor transition.');
	await defectPanel.getByLabel('Location').fill('Level 02 corridor transition');
	await defectPanel.getByRole('button', { name: 'Raise defect' }).click();
	await expect(page).toHaveURL(siteUrl);
	let defectCard = page.locator('#defect-register .defect-card').filter({ hasText: defectTitle });
	await expect(defectCard.getByText('open', { exact: true })).toBeVisible();
	await defectCard.getByRole('button', { name: 'Close defect' }).click();
	await expect(page).toHaveURL(siteUrl);
	defectCard = page.locator('#defect-register .defect-card').filter({ hasText: defectTitle });
	await expect(defectCard.getByText('closed', { exact: true })).toBeVisible();

	const safetyPanel = page.locator('#create-safety-observation');
	await safetyPanel.getByLabel('Site').selectOption({ label: `${siteCode} · ${siteName}` });
	await safetyPanel.getByLabel('Occurred at').fill('2026-08-20T12:30');
	await safetyPanel.getByLabel('Category').selectOption('condition');
	await safetyPanel.getByLabel('Title').fill(safetyTitle);
	await safetyPanel
		.getByLabel('Description')
		.fill('Temporary lead crossed the pedestrian access route.');
	await safetyPanel.getByLabel('Location').fill('Level 01 access route');
	await safetyPanel
		.getByLabel('Immediate action taken')
		.fill('Lead moved clear pending protected reroute.');
	await safetyPanel.getByRole('button', { name: 'Report observation' }).click();
	await expect(page).toHaveURL(siteUrl);
	let safetyCard = page.locator('#safety-register .safety-card').filter({ hasText: safetyTitle });
	await expect(safetyCard.getByText('reported', { exact: true })).toBeVisible();
	await safetyCard.locator('summary').filter({ hasText: 'Add safety action' }).click();
	await safetyCard.getByLabel('Action type').selectOption('corrective');
	await safetyCard
		.getByLabel('Action', { exact: true })
		.fill('Install a protected temporary cable route.');
	await safetyCard.getByRole('button', { name: 'Create safety action' }).click();
	await expect(page).toHaveURL(siteUrl);
	safetyCard = page.locator('#safety-register .safety-card').filter({ hasText: safetyTitle });
	await expect(safetyCard.getByText('action', { exact: true })).toBeVisible();
	await safetyCard.getByLabel('Completion note').fill('Protected route installed and checked.');
	await safetyCard.getByRole('button', { name: 'Complete action' }).click();
	await expect(page).toHaveURL(siteUrl);
	safetyCard = page.locator('#safety-register .safety-card').filter({ hasText: safetyTitle });
	await expect(safetyCard.getByText('completed', { exact: true })).toBeVisible();
	await safetyCard.getByRole('button', { name: 'Close safety event' }).click();
	await expect(page).toHaveURL(siteUrl);
	safetyCard = page.locator('#safety-register .safety-card').filter({ hasText: safetyTitle });
	await expect(safetyCard.getByText('closed', { exact: true })).toBeVisible();
});
