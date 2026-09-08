import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for browser fixture seeding.');

export const E2E_EMAIL = 'e2e-owner@example.test';
export const E2E_PASSWORD = 'NuBlox-E2E-Password-2026!';
export const E2E_ORGANISATION = 'NuBlox E2E Organisation';
export const E2E_STRATEGY_ORGANISATION = 'NuBlox Strategy E2E Organisation';
export const E2E_PERFORMANCE_ORGANISATION = 'NuBlox Performance E2E Organisation';
export const E2E_VIEWER_EMAIL = 'e2e-viewer@example.test';
export const E2E_VIEWER_PASSWORD = 'NuBlox-E2E-Viewer-2026!';

const db = await mysql.createConnection(databaseUrl);
try {
	const platformUserPublicId = randomUUID();
	const authUserId = randomUUID();
	const organisationPublicId = randomUUID();
	const memberPublicId = randomUUID();
	const rolePublicId = randomUUID();
	const now = new Date();

	const [platformUser] = await db.execute(
		'INSERT INTO users (public_id, display_name, status) VALUES (?, ?, ?)',
		[platformUserPublicId, 'NuBlox E2E Owner', 'active']
	);
	const platformUserId = String(platformUser.insertId);

	await db.execute(
		`INSERT INTO auth_users
		(id, display_name, email, email_verified, image, created_at, updated_at)
		VALUES (?, ?, ?, 1, NULL, ?, ?)`,
		[authUserId, 'NuBlox E2E Owner', E2E_EMAIL, now, now]
	);
	await db.execute(
		`INSERT INTO auth_accounts
		(id, provider_account_id, provider_id, auth_user_id, access_token, refresh_token, id_token,
		 access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
		VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
		[randomUUID(), authUserId, authUserId, await hashPassword(E2E_PASSWORD), now, now]
	);
	await db.execute('INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)', [
		authUserId,
		platformUserId
	]);

	const [organisation] = await db.execute(
		`INSERT INTO organisations
		(public_id, legal_name, default_timezone, default_currency_code, status)
		VALUES (?, ?, ?, ?, ?)`,
		[organisationPublicId, E2E_ORGANISATION, 'Europe/London', 'GBP', 'active']
	);
	const organisationId = String(organisation.insertId);

	const [member] = await db.execute(
		`INSERT INTO organisation_members
		(organisation_id, user_id, public_id, status, joined_at)
		VALUES (?, ?, ?, 'active', ?)`,
		[organisationId, platformUserId, memberPublicId, now]
	);
	const memberId = String(member.insertId);

	const [role] = await db.execute(
		`INSERT INTO organisation_roles
		(organisation_id, public_id, name, is_active)
		VALUES (?, ?, 'E2E Owner', 1)`,
		[organisationId, rolePublicId]
	);
	const roleId = String(role.insertId);

	await db.execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
		SELECT ?, ?, id FROM permissions WHERE is_active = 1`,
		[organisationId, roleId]
	);
	await db.execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		VALUES (?, ?, ?)`,
		[organisationId, memberId, roleId]
	);

	const [strategyOrganisation] = await db.execute(
		`INSERT INTO organisations
		(public_id, legal_name, default_timezone, default_currency_code, status)
		VALUES (?, ?, ?, ?, ?)`,
		[randomUUID(), E2E_STRATEGY_ORGANISATION, 'Europe/London', 'GBP', 'active']
	);
	const strategyOrganisationId = String(strategyOrganisation.insertId);
	const [strategyMember] = await db.execute(
		`INSERT INTO organisation_members
		(organisation_id, user_id, public_id, status, joined_at)
		VALUES (?, ?, ?, 'active', ?)`,
		[strategyOrganisationId, platformUserId, randomUUID(), now]
	);
	const strategyMemberId = String(strategyMember.insertId);
	const [strategyRole] = await db.execute(
		`INSERT INTO organisation_roles
		(organisation_id, public_id, name, is_active)
		VALUES (?, ?, 'E2E Strategy Owner', 1)`,
		[strategyOrganisationId, randomUUID()]
	);
	const strategyRoleId = String(strategyRole.insertId);
	await db.execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
		SELECT ?, ?, id FROM permissions WHERE is_active = 1`,
		[strategyOrganisationId, strategyRoleId]
	);
	await db.execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		VALUES (?, ?, ?)`,
		[strategyOrganisationId, strategyMemberId, strategyRoleId]
	);

	const [performanceOrganisation] = await db.execute(
		`INSERT INTO organisations
		(public_id, legal_name, default_timezone, default_currency_code, status)
		VALUES (?, ?, ?, ?, ?)`,
		[randomUUID(), E2E_PERFORMANCE_ORGANISATION, 'Europe/London', 'GBP', 'active']
	);
	const performanceOrganisationId = String(performanceOrganisation.insertId);
	const [performanceMember] = await db.execute(
		`INSERT INTO organisation_members
		(organisation_id, user_id, public_id, status, joined_at)
		VALUES (?, ?, ?, 'active', ?)`,
		[performanceOrganisationId, platformUserId, randomUUID(), now]
	);
	const performanceMemberId = String(performanceMember.insertId);
	const [performanceRole] = await db.execute(
		`INSERT INTO organisation_roles
		(organisation_id, public_id, name, is_active)
		VALUES (?, ?, 'E2E Performance Owner', 1)`,
		[performanceOrganisationId, randomUUID()]
	);
	const performanceRoleId = String(performanceRole.insertId);
	await db.execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
		SELECT ?, ?, id FROM permissions WHERE is_active = 1`,
		[performanceOrganisationId, performanceRoleId]
	);
	await db.execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		VALUES (?, ?, ?)`,
		[performanceOrganisationId, performanceMemberId, performanceRoleId]
	);

	const performancePeriodPublicId = 'F01-PERF-PERIOD-2027-H1';
	const [performanceYear] = await db.execute(
		`INSERT INTO accounting_financial_years
		(organisation_id, public_id, year_code, name, starts_on, ends_on, created_by_member_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[
			performanceOrganisationId,
			'F01-PERF-FY-2027',
			'FY27',
			'F01 Performance FY27',
			'2027-01-01',
			'2027-12-31',
			performanceMemberId
		]
	);
	const performanceYearId = String(performanceYear.insertId);
	const [performancePeriod] = await db.execute(
		`INSERT INTO accounting_periods
		(organisation_id, financial_year_id, public_id, period_number, name, starts_on, ends_on, created_by_member_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			performanceOrganisationId,
			performanceYearId,
			performancePeriodPublicId,
			1,
			'H1 2027',
			'2027-01-01',
			'2027-06-30',
			performanceMemberId
		]
	);

	async function performanceAccount(publicId, code, name, type, normalBalance) {
		const [result] = await db.execute(
			`INSERT INTO accounting_accounts
			(organisation_id, public_id, account_code, name, account_type, normal_balance, created_by_member_id)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[performanceOrganisationId, publicId, code, name, type, normalBalance, performanceMemberId]
		);
		return String(result.insertId);
	}
	const performanceCashId = await performanceAccount('F01-PERF-ACC-CASH', '1000', 'Cash', 'asset', 'debit');
	const performanceRevenueId = await performanceAccount('F01-PERF-ACC-REV', '4000', 'Operating revenue', 'revenue', 'credit');
	const performanceExpenseId = await performanceAccount('F01-PERF-ACC-OPEX', '5000', 'Operating expenditure', 'expense', 'debit');

	async function performanceJournal(number, sourceType, sourcePublicId, amount, fingerprint, lines) {
		const [journal] = await db.execute(
			`INSERT INTO accounting_journal_entries
			(organisation_id, public_id, journal_number, source_type, source_public_id, source_event_at,
			 source_amount, source_fingerprint, accounting_date, currency_code, memo, posted_by_member_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				performanceOrganisationId, randomUUID(), number, sourceType, sourcePublicId,
				new Date('2027-06-30T12:00:00.000Z'), amount, fingerprint, '2027-06-30', 'GBP',
				`F01 canonical KPI source ${number}`, performanceMemberId
			]
		);
		const journalId = String(journal.insertId);
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			await db.execute(
				`INSERT INTO accounting_journal_lines
				(organisation_id, journal_entry_id, accounting_account_id, line_number, description, debit_amount, credit_amount)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				[performanceOrganisationId, journalId, line.accountId, index + 1, line.description, line.debit, line.credit]
			);
		}
	}
	await performanceJournal(
		'F01-PERF-JRN-001',
		'invoice_issue',
		'F01-PERF-REVENUE-SOURCE',
		'1000000.0000',
		'a'.repeat(64),
		[
			{ accountId: performanceCashId, description: 'Canonical cash receipt', debit: '1000000.0000', credit: '0.0000' },
			{ accountId: performanceRevenueId, description: 'Canonical operating revenue', debit: '0.0000', credit: '1000000.0000' }
		]
	);
	await performanceJournal(
		'F01-PERF-JRN-002',
		'accounts_payable_invoice_approval',
		'F01-PERF-EXPENSE-SOURCE',
		'902500.0000',
		'b'.repeat(64),
		[
			{ accountId: performanceExpenseId, description: 'Canonical operating expenditure', debit: '902500.0000', credit: '0.0000' },
			{ accountId: performanceCashId, description: 'Canonical cash outflow', debit: '0.0000', credit: '902500.0000' }
		]
	);

	const viewerUserPublicId = randomUUID();
	const viewerAuthUserId = randomUUID();
	const viewerMemberPublicId = randomUUID();
	const viewerRolePublicId = randomUUID();
	const [viewerUser] = await db.execute(
		'INSERT INTO users (public_id, display_name, status) VALUES (?, ?, ?)',
		[viewerUserPublicId, 'NuBlox E2E Viewer', 'active']
	);
	const viewerUserId = String(viewerUser.insertId);
	await db.execute(
		`INSERT INTO auth_users
		(id, display_name, email, email_verified, image, created_at, updated_at)
		VALUES (?, ?, ?, 1, NULL, ?, ?)`,
		[viewerAuthUserId, 'NuBlox E2E Viewer', E2E_VIEWER_EMAIL, now, now]
	);
	await db.execute(
		`INSERT INTO auth_accounts
		(id, provider_account_id, provider_id, auth_user_id, access_token, refresh_token, id_token,
		 access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
		VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
		[
			randomUUID(),
			viewerAuthUserId,
			viewerAuthUserId,
			await hashPassword(E2E_VIEWER_PASSWORD),
			now,
			now
		]
	);
	await db.execute('INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)', [
		viewerAuthUserId,
		viewerUserId
	]);
	const [viewerMember] = await db.execute(
		`INSERT INTO organisation_members
		(organisation_id, user_id, public_id, status, joined_at)
		VALUES (?, ?, ?, 'active', ?)`,
		[organisationId, viewerUserId, viewerMemberPublicId, now]
	);
	const viewerMemberId = String(viewerMember.insertId);
	const [viewerRole] = await db.execute(
		`INSERT INTO organisation_roles
		(organisation_id, public_id, name, is_active)
		VALUES (?, ?, 'E2E Viewer Role', 1)`,
		[organisationId, viewerRolePublicId]
	);
	const viewerRoleId = String(viewerRole.insertId);
	await db.execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
		SELECT ?, ?, id FROM permissions WHERE is_active = 1 AND permission_key LIKE '%.view'`,
		[organisationId, viewerRoleId]
	);
	await db.execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		VALUES (?, ?, ?)`,
		[organisationId, viewerMemberId, viewerRoleId]
	);

	const [ownerWorker] = await db.execute(
		`INSERT INTO workers
		(organisation_id, public_id, organisation_member_id, worker_number, display_name, status)
		VALUES (?, ?, ?, 'E2E-OWNER', 'NuBlox E2E Owner', 'active')`,
		[organisationId, randomUUID(), memberId]
	);
	const ownerWorkerId = String(ownerWorker.insertId);
	const [viewerWorker] = await db.execute(
		`INSERT INTO workers
		(organisation_id, public_id, organisation_member_id, worker_number, display_name, status)
		VALUES (?, ?, ?, 'E2E-VIEWER', 'NuBlox E2E Viewer', 'active')`,
		[organisationId, randomUUID(), viewerMemberId]
	);
	const viewerWorkerId = String(viewerWorker.insertId);

	const [[employeeEngagement]] = await db.query(
		`SELECT id FROM workforce_engagement_types WHERE code = 'employee' AND is_active = 1 LIMIT 1`
	);
	if (!employeeEngagement) throw new Error('Employee workforce engagement type is required.');
	for (const [workerId, reference, jobTitle] of [
		[ownerWorkerId, 'E2E-OWNER', 'Operations Director'],
		[viewerWorkerId, 'E2E-VIEWER', 'Site Operative']
	]) {
		await db.execute(
			`INSERT INTO worker_engagements
			(organisation_id, worker_id, workforce_engagement_type_id, engagement_reference,
			 job_title, started_on, engagement_status)
			VALUES (?, ?, ?, ?, ?, '2026-01-01', 'active')`,
			[organisationId, workerId, employeeEngagement.id, reference, jobTitle]
		);
	}

	const pipelinePublicId = randomUUID();
	const [pipeline] = await db.execute(
		`INSERT INTO crm_pipelines
		(organisation_id, public_id, name, is_default, is_active)
		VALUES (?, ?, 'Sales', 1, 1)`,
		[organisationId, pipelinePublicId]
	);
	const pipelineId = String(pipeline.insertId);
	for (const stage of [
		['Lead', 10, '10.00'],
		['Qualified', 20, '30.00'],
		['Proposal', 30, '60.00'],
		['Negotiation', 40, '80.00']
	]) {
		await db.execute(
			`INSERT INTO crm_pipeline_stages
			(organisation_id, crm_pipeline_id, name, sort_order, probability_percent, is_active)
			VALUES (?, ?, ?, ?, ?, 1)`,
			[organisationId, pipelineId, stage[0], stage[1], stage[2]]
		);
	}

	console.log(
		`Seeded authenticated browser fixtures for ${E2E_EMAIL} and ${E2E_VIEWER_EMAIL}, including ${E2E_STRATEGY_ORGANISATION} and ${E2E_PERFORMANCE_ORGANISATION}.`
	);
} finally {
	await db.end();
}
