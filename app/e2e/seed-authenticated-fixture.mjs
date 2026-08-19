import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for browser fixture seeding.');

export const E2E_EMAIL = 'e2e-owner@example.test';
export const E2E_PASSWORD = 'NuBlox-E2E-Password-2026!';
export const E2E_ORGANISATION = 'NuBlox E2E Organisation';
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
		'INSERT INTO organisations (public_id, legal_name, status) VALUES (?, ?, ?)',
		[organisationPublicId, E2E_ORGANISATION, 'active']
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

	console.log(`Seeded authenticated browser fixtures for ${E2E_EMAIL} and ${E2E_VIEWER_EMAIL}.`);
} finally {
	await db.end();
}
