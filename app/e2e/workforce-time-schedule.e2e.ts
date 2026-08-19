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

test('owner staffs, schedules and records a complete work session through the UI', async ({
	page
}) => {
	await signIn(page);
	const suffix = Date.now().toString().slice(-7);
	const projectNumber = `E2E-WF-${suffix}`;
	const projectName = `Workforce acceptance ${suffix}`;
	const workTitle = `Install containment ${suffix}`;

	await page.goto('/projects#create-project');
	await page.getByLabel('Project number').fill(projectNumber);
	await page.getByLabel('Project name').fill(projectName);
	await page
		.getByLabel(/Description/)
		.fill('Browser acceptance project for workforce scheduling and time.');
	await page.getByRole('button', { name: 'Create project' }).click();
	await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/i);

	await page.goto('/people');
	await expect(page.getByText('NuBlox E2E Owner', { exact: true }).first()).toBeVisible();
	const staffingPanel = page.locator('.action-panel').filter({ hasText: 'Staff a project' });
	await staffingPanel.getByLabel('Worker').selectOption({ label: 'NuBlox E2E Owner' });
	await staffingPanel
		.getByLabel('Project')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await staffingPanel.getByLabel('Starts').fill('2026-08-17');
	await staffingPanel.getByLabel('Planned allocation %').fill('100');
	await staffingPanel.getByRole('button', { name: 'Create assignment' }).click();
	await expect(page).toHaveURL(/\/people$/);
	const staffingRow = page.getByRole('row').filter({ hasText: projectNumber });
	await expect(staffingRow.getByText(projectNumber, { exact: true })).toBeVisible();
	await expect(staffingRow.getByText(projectName, { exact: true })).toBeVisible();

	await page.goto('/schedule');
	const schedulePanel = page.locator('#schedule-work');
	await schedulePanel.getByLabel('Type').selectOption({ label: 'Work session' });
	await schedulePanel.getByLabel('Title').fill(workTitle);
	await schedulePanel
		.getByLabel('Project / job')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await schedulePanel.getByLabel('Workers').selectOption({ label: 'NuBlox E2E Owner' });
	await schedulePanel.getByLabel('Starts').fill('2026-08-20T08:00');
	await schedulePanel.getByLabel('Ends').fill('2026-08-20T16:00');
	await schedulePanel.getByLabel('Timezone').fill('Europe/London');
	await schedulePanel
		.getByLabel('Description')
		.fill('Scheduled project work session from browser acceptance.');
	await schedulePanel.getByRole('button', { name: 'Schedule work' }).click();
	await expect(page).toHaveURL(/\/schedule$/);
	await expect(page.getByRole('heading', { name: workTitle, level: 3 })).toBeVisible();
	await expect(page.getByText(`Project · ${projectName}`, { exact: true })).toBeVisible();

	await page.goto('/time');
	const createTimesheet = page.locator('#new-timesheet');
	await createTimesheet.getByLabel('Period start').fill('2026-08-17');
	await createTimesheet.getByLabel('Period end').fill('2026-08-23');
	await createTimesheet.getByRole('button', { name: 'Create timesheet' }).click();
	await expect(page).toHaveURL(/\/time$/);

	const timesheetCard = page.locator('.timesheet-card').first();
	await timesheetCard.getByText('Add time entry', { exact: true }).click();
	await timesheetCard.getByLabel('Work date').fill('2026-08-20');
	await timesheetCard.getByLabel('Minutes').fill('480');
	await timesheetCard
		.getByLabel('Project / job')
		.selectOption({ label: `${projectNumber} · ${projectName}` });
	await timesheetCard.getByLabel('Assigned work').selectOption({ index: 1 });
	await timesheetCard
		.getByLabel('Description')
		.fill('Installed containment through UI acceptance.');
	await timesheetCard.getByRole('button', { name: 'Add time entry' }).click();
	await expect(page).toHaveURL(/\/time$/);
	await expect(
		page.locator('.timesheet-card').first().getByText(projectName, { exact: true })
	).toBeVisible();
	await expect(
		page.locator('.timesheet-card').first().getByText('8h 0m', { exact: true })
	).toBeVisible();

	await page
		.locator('.timesheet-card')
		.first()
		.getByRole('button', { name: 'Submit timesheet' })
		.click();
	await expect(page).toHaveURL(/\/time$/);
	await expect(
		page.locator('.timesheet-card').first().getByText('submitted', { exact: true })
	).toBeVisible();
	await expect(
		page.locator('.timesheet-card').first().getByText('Add time entry', { exact: true })
	).toHaveCount(0);
});
