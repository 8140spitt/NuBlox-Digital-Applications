import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for external collaboration seeding.');

export const EXTERNAL_PERSON_EMAIL = 'e2e-external-person@example.test';
export const EXTERNAL_PERSON_PASSWORD = 'NuBlox-E2E-External-Person-2026!';
export const EXTERNAL_PERSON_NAME = 'NuBlox E2E External Person';
export const EXTERNAL_PROJECT_NUMBER = 'PORTAL-E2E-001';
export const EXTERNAL_PROJECT_NAME = 'Portal collaboration project';

function id(result) {
	if (result.insertId === undefined) throw new Error('Expected inserted ID.');
	return String(result.insertId);
}

const db = await mysql.createConnection(databaseUrl);
try {
	const now = new Date('2026-08-25T17:30:00.000Z');
	const [[ownerOrganisation]] = await db.query(
		`SELECT id FROM organisations WHERE legal_name = 'NuBlox E2E Organisation' LIMIT 1`
	);
	if (!ownerOrganisation) throw new Error('Authenticated E2E owner organisation is required.');
	const ownerOrganisationId = String(ownerOrganisation.id);
	const [[ownerMember]] = await db.query(
		`SELECT om.id
		 FROM organisation_members om
		 INNER JOIN users u ON u.id = om.user_id
		 WHERE om.organisation_id = ? AND u.display_name = 'NuBlox E2E Owner'
		 LIMIT 1`,
		[ownerOrganisationId]
	);
	if (!ownerMember) throw new Error('Authenticated E2E owner member is required.');
	const ownerMemberId = String(ownerMember.id);
	const [[project]] = await db.query(
		`SELECT id, public_id FROM projects WHERE project_number = ? LIMIT 1`,
		[EXTERNAL_PROJECT_NUMBER]
	);
	if (!project) throw new Error('Portal E2E project is required.');
	const projectId = String(project.id);

	const platformUserPublicId = randomUUID();
	const authUserId = randomUUID();
	const [platformUser] = await db.execute(
		'INSERT INTO users (public_id, display_name, status) VALUES (?, ?, ?)',
		[platformUserPublicId, EXTERNAL_PERSON_NAME, 'active']
	);
	const platformUserId = id(platformUser);
	await db.execute(
		`INSERT INTO auth_users
		(id, display_name, email, email_verified, image, created_at, updated_at)
		VALUES (?, ?, ?, 1, NULL, ?, ?)`,
		[authUserId, EXTERNAL_PERSON_NAME, EXTERNAL_PERSON_EMAIL, now, now]
	);
	await db.execute(
		`INSERT INTO auth_accounts
		(id, provider_account_id, provider_id, auth_user_id, access_token, refresh_token, id_token,
		 access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
		VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
		[randomUUID(), authUserId, authUserId, await hashPassword(EXTERNAL_PERSON_PASSWORD), now, now]
	);
	await db.execute('INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)', [
		authUserId,
		platformUserId
	]);

	const personPartyPublicId = randomUUID();
	const [personParty] = await db.execute(
		`INSERT INTO parties
		(organisation_id, public_id, party_kind, account_owner_member_id, status)
		VALUES (?, ?, 'person', ?, 'active')`,
		[ownerOrganisationId, personPartyPublicId, ownerMemberId]
	);
	const personPartyId = id(personParty);
	await db.execute(
		`INSERT INTO party_persons
		(party_id, organisation_id, honorific, given_names, family_name, preferred_name)
		VALUES (?, ?, NULL, 'External', 'Person', 'External')`,
		[personPartyId, ownerOrganisationId]
	);

	const collaboratorPublicId = randomUUID();
	const [collaborator] = await db.execute(
		`INSERT INTO project_external_collaborators
		(public_id, project_id, owning_organisation_id, crm_person_party_id, crm_organisation_party_id,
		 auth_user_id, invite_email, status, invited_by_member_id, joined_at, left_at)
		VALUES (?, ?, ?, ?, NULL, ?, ?, 'active', ?, ?, NULL)`,
		[
			collaboratorPublicId,
			projectId,
			ownerOrganisationId,
			personPartyId,
			authUserId,
			EXTERNAL_PERSON_EMAIL,
			ownerMemberId,
			now
		]
	);
	const collaboratorId = id(collaborator);
	const [[engineerRole]] = await db.query(
		`SELECT id FROM project_role_types WHERE role_key = 'engineer' AND is_active = 1 LIMIT 1`
	);
	if (!engineerRole) throw new Error('Engineer project role is required.');
	await db.execute(
		`INSERT INTO project_external_collaborator_roles
		(project_id, project_external_collaborator_id, project_role_type_id)
		VALUES (?, ?, ?)`,
		[projectId, collaboratorId, engineerRole.id]
	);

	const [[membershipCount]] = await db.query(
		`SELECT COUNT(*) AS count FROM organisation_members WHERE user_id = ?`,
		[platformUserId]
	);
	if (Number(membershipCount.count) !== 0) {
		throw new Error('External person fixture must not have an organisation membership.');
	}

	console.log(`Seeded no-tenant external collaborator ${EXTERNAL_PERSON_EMAIL}.`);
} finally {
	await db.end();
}
