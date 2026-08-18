import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for browser fixture seeding.');

export const E2E_EMAIL = 'e2e-owner@example.test';
export const E2E_PASSWORD = 'NuBlox-E2E-Password-2026!';
export const E2E_ORGANISATION = 'NuBlox E2E Organisation';

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

	console.log(`Seeded authenticated browser fixture for ${E2E_EMAIL}.`);
} finally {
	await db.end();
}
