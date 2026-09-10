import { expect, test, type Page } from '@playwright/test';

const EMAIL = 'e2e-owner@example.test';
const PASSWORD = 'NuBlox-E2E-Password-2026!';
const ORGANISATION = 'NuBlox E2E Organisation';
const OWNER = 'NuBlox E2E Owner';

async function signIn(page: Page) {
	await page.goto('/signin');
	await page.getByLabel('Email', { exact: true }).fill(EMAIL);
	await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await expect(page).toHaveURL(/\/select-organisation$/, { timeout: 15_000 });
	await page.getByRole('button', { name: new RegExp(ORGANISATION) }).click();
	await expect(page).toHaveURL(/\/dashboard$/, { timeout: 15_000 });
}

function section(page: Page, label: string) {
	return page.locator('summary').filter({ hasText: label });
}

test('F02 governs authority, board decisions, policy and ethics as one enterprise thread', async ({
	page
}) => {
	await signIn(page);
	await page.goto('/governance');
	await expect(page.getByRole('heading', { name: 'Corporate governance', level: 1 })).toBeVisible();

	const framework = page.locator('form[action="?/createFramework"]');
	await framework.getByLabel('Framework code').fill('F02-E2E');
	await framework.getByLabel('Title').fill('F02 E2E Corporate Governance Framework');
	await framework.getByLabel('Effective from').fill('2026-01-01');
	await framework
		.getByLabel('Purpose')
		.fill('Govern enterprise authority, decisions, policy obligations and ethical accountability.');
	await framework
		.getByLabel('Governance principles')
		.fill(
			'Authority is explicit, decisions are attributable, evidence is immutable and ethics is reviewable.'
		);
	await framework.getByLabel('Accountable owner').selectOption({ label: OWNER });
	await framework.getByRole('button', { name: 'Create governance draft' }).click();
	await expect(page.getByText('F02-E2E · version 1')).toBeVisible();

	await section(page, 'Add governance body').click();
	const body = page.locator('form[action="?/addBody"]');
	await body.getByLabel('Body code').fill('BOARD-E2E');
	await body.getByLabel('Body type').selectOption('board');
	await body.getByLabel('Title').fill('Enterprise Board');
	await body.getByLabel('Quorum').fill('1');
	await body.getByLabel('Chair').selectOption({ label: OWNER });
	await body
		.getByLabel('Mandate')
		.fill('Exercise reserved enterprise authority and oversee governed corporate decisions.');
	await body.getByRole('button', { name: 'Add governance body' }).click();
	await expect(page.getByRole('heading', { name: 'Enterprise Board' })).toBeVisible();

	await section(page, 'Appoint governance-body member').click();
	const appointment = page.locator('form[action="?/appointMember"]');
	await appointment
		.getByLabel('Governance body')
		.selectOption({ label: 'BOARD-E2E · Enterprise Board' });
	await appointment.getByLabel('Member', { exact: true }).selectOption({ label: OWNER });
	await appointment.getByLabel('Governance role').selectOption('chair');
	await appointment.getByLabel('Appointed on').fill('2026-01-01');
	await appointment.getByRole('button', { name: 'Appoint member' }).click();
	await expect(page.getByText(`${OWNER} · chair · voting`)).toBeVisible();

	await section(page, 'Add delegation-of-authority rule').click();
	const authority = page.locator('form[action="?/addAuthorityRule"]');
	await authority.getByLabel('Authority code').fill('BOARD-PROGRAMME-APPROVAL');
	await authority
		.getByLabel('Authority body')
		.selectOption({ label: 'BOARD-E2E · Enterprise Board' });
	await authority.getByLabel('Subject domain').fill('governance');
	await authority.getByLabel('Action key').fill('governance.programme.approve');
	await authority.getByLabel('Maximum amount').fill('1000000');
	await authority.getByLabel('Currency').fill('GBP');
	await authority.getByLabel('Effective from').fill('2026-01-01');
	await authority
		.getByLabel('Authority description')
		.fill('Board approval authority for enterprise governance programmes up to GBP 1,000,000.');
	await authority.getByRole('button', { name: 'Add authority rule' }).click();
	await expect(page.getByText('BOARD-PROGRAMME-APPROVAL')).toBeVisible();

	await page.getByRole('button', { name: 'Approve governance framework version 1' }).click();
	await expect(page.getByText('Approved governance constitution')).toBeVisible();

	await section(page, 'Create governed policy').click();
	const policy = page.locator('form[action="?/createPolicy"]');
	await policy.getByLabel('Policy code').fill('ETHICS-E2E');
	await policy.getByLabel('Policy title').fill('Ethics & Conflicts Policy');
	await policy.getByLabel('Category').selectOption('ethics');
	await policy.getByLabel('Approval body').selectOption({ label: 'Enterprise Board' });
	await policy.getByLabel('Policy owner').selectOption({ label: OWNER });
	await policy.getByLabel('Effective from').fill('2026-09-08');
	await policy.getByLabel('Review due on').fill('2027-09-08');
	await policy
		.getByLabel('Scope')
		.fill('All enterprise decision makers, employees and appointed governance-body members.');
	await policy
		.getByLabel('Policy text')
		.fill(
			'Conflicts must be declared, independently reviewed and managed before affected decisions are taken.'
		);
	await policy.getByRole('button', { name: 'Create policy draft' }).click();
	await expect(page.getByRole('heading', { name: 'Ethics & Conflicts Policy' })).toBeVisible();

	const policyArticle = page.locator('article').filter({ hasText: 'ETHICS-E2E · v1' });
	const policyPublicId = await policyArticle
		.locator('input[name="policyPublicId"]')
		.first()
		.inputValue();
	await policyArticle.getByRole('button', { name: 'Approve policy version 1' }).click();
	await expect(page.getByText('ETHICS-E2E · v1').first()).toBeVisible();
	await page.getByRole('button', { name: 'Acknowledge policy' }).click();

	await section(page, 'Create governance meeting').click();
	const meeting = page.locator('form[action="?/createMeeting"]');
	await meeting
		.getByLabel('Governance body')
		.selectOption({ label: 'BOARD-E2E · Enterprise Board' });
	await meeting.getByLabel('Meeting code').fill('BOARD-E2E-001');
	await meeting.getByLabel('Meeting type').selectOption('scheduled');
	await meeting.getByLabel('Scheduled date/time').fill('2026-09-09T10:00');
	await meeting.getByLabel('Meeting title').fill('September Enterprise Board');
	await meeting.getByLabel('Location / channel').fill('Boardroom / governed hybrid meeting');
	await meeting.getByRole('button', { name: 'Create meeting' }).click();
	await expect(page.getByRole('heading', { name: 'September Enterprise Board' })).toBeVisible();

	await section(page, 'Record attendance').click();
	const attendance = page.locator('form[action="?/setAttendance"]');
	await attendance.getByLabel('Attendee').selectOption({ label: OWNER });
	await attendance.getByLabel('Attendance').selectOption('present');
	await attendance.getByRole('button', { name: 'Record attendance' }).click();
	await expect(page.getByText(`${OWNER} · present · voting`)).toBeVisible();

	await section(page, 'Add agenda item').click();
	const agenda = page.locator('form[action="?/addAgendaItem"]');
	await agenda.getByLabel('Agenda number').fill('1');
	await agenda.getByLabel('Item type').selectOption('decision');
	await agenda.getByLabel('Agenda title').fill('Approve governance assurance programme');
	await agenda.getByLabel('Authority action key').fill('governance.programme.approve');
	await agenda.getByLabel('Source domain').fill('governance');
	await agenda.getByLabel('Source record type').fill('governance_policy');
	await agenda.getByLabel('Source public ID').fill(policyPublicId);
	await agenda.getByLabel('Decision amount').fill('500000');
	await agenda.getByLabel('Currency').fill('GBP');
	await agenda
		.getByLabel('Agenda description')
		.fill('Approve the enterprise assurance programme implementing the approved ethics policy.');
	await agenda.getByRole('button', { name: 'Add agenda item' }).click();
	await expect(page.getByText('1. Approve governance assurance programme')).toBeVisible();

	await page.getByRole('button', { name: 'Convene meeting and prove quorum' }).click();
	await expect(page.getByText(/BOARD-E2E-001.*convened/)).toBeVisible();

	const decision = page.locator('form[action="?/recordDecision"]');
	await decision.getByLabel('Decision code').fill('RES-E2E-001');
	await decision.getByLabel('Outcome').selectOption('approved');
	await decision
		.getByLabel('Resolution')
		.fill('The Board approves the governance assurance programme within delegated authority.');
	await decision.getByRole('button', { name: 'Record governed decision' }).click();
	await expect(page.getByText('RES-E2E-001 · approved')).toBeVisible();
	await expect(page.getByText(/Authority proven by rule/)).toBeVisible();

	await section(page, 'Add decision action').click();
	const action = page.locator('form[action="?/createAction"]');
	await action.getByLabel('Action code').fill('ACT-E2E-001');
	await action.getByLabel('Action title').fill('Publish assurance operating procedure');
	await action.getByLabel('Owner').selectOption({ label: OWNER });
	await action.getByLabel('Due date').fill('2026-10-01');
	await action.getByLabel('Source domain').fill('governance');
	await action.getByLabel('Source record type').fill('governance_policy');
	await action.getByLabel('Source public ID').fill(policyPublicId);
	await action
		.getByLabel('Action description')
		.fill('Publish the operating procedure and retain evidence against the Board decision.');
	await action.getByRole('button', { name: 'Create action' }).click();
	await expect(page.getByText('ACT-E2E-001 · Publish assurance operating procedure')).toBeVisible();

	await page
		.getByPlaceholder('Completion evidence')
		.fill('Procedure GOV-ASSURE-01 published and communicated.');
	await page.getByRole('button', { name: 'Complete action' }).click();
	await expect(page.getByText(/ACT-E2E-001.*completed/)).toBeVisible();

	const closeMeeting = page.locator('form[action="?/closeMeeting"]');
	await closeMeeting
		.getByLabel('Approved minutes')
		.fill(
			'Quorum was proven. The assurance programme was approved within the Board delegation of authority.'
		);
	await closeMeeting.getByRole('button', { name: 'Close meeting with minutes' }).click();
	await expect(page.getByText('Closed minutes')).toBeVisible();

	await section(page, 'Declare conflict of interest').click();
	const conflict = page.locator('form[action="?/declareConflict"]');
	await conflict
		.getByLabel('Related policy')
		.selectOption({ label: 'ETHICS-E2E · Ethics & Conflicts Policy' });
	await conflict.getByLabel('Declaration type').selectOption('potential');
	await conflict.getByLabel('Conflict subject').fill('Supplier assurance relationship');
	await conflict.getByLabel('Declared on').fill('2026-09-08');
	await conflict
		.getByLabel('Details')
		.fill('A family connection exists with a supplier that may participate in assurance work.');
	await conflict.getByRole('button', { name: 'Declare conflict' }).click();
	await expect(page.getByText('Supplier assurance relationship')).toBeVisible();

	const conflictArticle = page
		.locator('article')
		.filter({ hasText: 'Supplier assurance relationship' });
	await conflictArticle
		.getByLabel('Review outcome')
		.fill('Potential conflict confirmed and manageable.');
	await conflictArticle
		.getByLabel('Management action')
		.fill('Declarant recused from supplier selection and evaluation.');
	await conflictArticle.getByLabel('Close after review').check();
	await conflictArticle.getByRole('button', { name: 'Record conflict review' }).click();
	await expect(page.getByText('closed', { exact: true }).first()).toBeVisible();

	await section(page, 'Raise ethics case').click();
	const ethics = page.locator('form[action="?/createEthicsCase"]');
	await ethics.getByLabel('Case code').fill('ETH-E2E-001');
	await ethics
		.getByLabel('Related policy')
		.selectOption({ label: 'ETHICS-E2E · Ethics & Conflicts Policy' });
	await ethics.getByLabel('Case subject').fill('Undeclared hospitality concern');
	await ethics.getByLabel('Severity').selectOption('medium');
	await ethics.getByLabel('Case owner').selectOption({ label: OWNER });
	await ethics
		.getByLabel('Description')
		.fill('A hospitality event requires review against the approved ethics policy.');
	await ethics.getByRole('button', { name: 'Raise ethics case' }).click();
	await expect(page.getByText('ETH-E2E-001')).toBeVisible();

	const ethicsArticle = page.locator('article').filter({ hasText: 'ETH-E2E-001' });
	await ethicsArticle
		.getByLabel('Resolution')
		.fill('Evidence reviewed, disclosure completed and no further action required.');
	await ethicsArticle.getByRole('button', { name: 'Resolve ethics case' }).click();
	await expect(page.getByText('resolved', { exact: true }).first()).toBeVisible();

	const approvedPolicy = page.locator('article').filter({ hasText: 'ETHICS-E2E · v1' });
	await approvedPolicy.getByRole('button', { name: 'Create policy revision' }).click();
	await expect(page.getByText('ETHICS-E2E · v2')).toBeVisible();
	await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();

	await page.getByRole('button', { name: 'Create framework revision' }).click();
	await expect(page.getByText('F02-E2E · version 2')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Enterprise Board' })).toBeVisible();
	await expect(page.getByText('BOARD-PROGRAMME-APPROVAL')).toBeVisible();
});
