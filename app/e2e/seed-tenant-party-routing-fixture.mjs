import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for tenant-party routing seeding.');

const EXTERNAL_EMAIL = 'e2e-external-person@example.test';
const EXTERNAL_PASSWORD = 'external-person-test';
const TENANT_SLUG = 'nublox';
const PARTY_SLUG = 'perspectivebc';
const PARTY_NAME = 'Perspective BC';
const PROJECT_NUMBER = 'PORTAL-E2E-001';

function insertedId(result) {
	if (result.insertId === undefined) throw new Error('Expected inserted ID.');
	return String(result.insertId);
}

const db = await mysql.createConnection(databaseUrl);
try {
	const now = new Date('2026-08-25T17:35:00.000Z');
	const [[owner]] = await db.query(
		`SELECT id FROM organisations WHERE legal_name = 'NuBlox E2E Organisation' LIMIT 1`
	);
	if (!owner) throw new Error('NuBlox E2E owner organisation is required.');
	const organisationId = String(owner.id);

	await db.execute(
		`UPDATE tenant_route_contexts SET route_slug = ? WHERE organisation_id = ?`,
		[TENANT_SLUG, organisationId]
	);

	const [[ownerMember]] = await db.query(
		`SELECT om.id
		 FROM organisation_members om
		 INNER JOIN users u ON u.id = om.user_id
		 WHERE om.organisation_id = ? AND u.display_name = 'NuBlox E2E Owner'
		 LIMIT 1`,
		[organisationId]
	);
	if (!ownerMember) throw new Error('NuBlox E2E owner member is required.');
	const ownerMemberId = String(ownerMember.id);

	const [[externalIdentity]] = await db.query(
		`SELECT au.id AS auth_user_id
		 FROM auth_users au
		 WHERE au.email = ?
		 LIMIT 1`,
		[EXTERNAL_EMAIL]
	);
	if (!externalIdentity) throw new Error('External E2E identity is required.');
	const authUserId = String(externalIdentity.auth_user_id);
	await db.execute(
		`UPDATE auth_accounts
		 SET password = ?
		 WHERE auth_user_id = ? AND provider_id = 'credential'`,
		[await hashPassword(EXTERNAL_PASSWORD), authUserId]
	);

	const companyPublicId = randomUUID();
	const [companyInsert] = await db.execute(
		`INSERT INTO parties
		(organisation_id, public_id, party_kind, account_owner_member_id, status)
		VALUES (?, ?, 'organisation', ?, 'active')`,
		[organisationId, companyPublicId, ownerMemberId]
	);
	const companyPartyId = insertedId(companyInsert);
	await db.execute(
		`INSERT INTO party_organisations
		(party_id, organisation_id, legal_name, trading_name)
		VALUES (?, ?, ?, ?)`,
		[companyPartyId, organisationId, PARTY_NAME, PARTY_NAME]
	);
	await db.execute(
		`INSERT INTO party_route_contexts (organisation_id, party_id, route_slug)
		VALUES (?, ?, ?)`,
		[organisationId, companyPartyId, PARTY_SLUG]
	);

	const [[project]] = await db.query(
		`SELECT id, public_id FROM projects WHERE project_number = ? LIMIT 1`,
		[PROJECT_NUMBER]
	);
	if (!project) throw new Error('Portal E2E project is required.');
	const projectId = String(project.id);
	const projectPublicId = String(project.public_id);

	const [collaboratorUpdate] = await db.execute(
		`UPDATE project_external_collaborators
		 SET crm_organisation_party_id = ?
		 WHERE project_id = ? AND auth_user_id = ? AND status = 'active'`,
		[companyPartyId, projectId, authUserId]
	);
	if (Number(collaboratorUpdate.affectedRows) !== 1) {
		throw new Error('Expected one active external collaborator to bind to Perspective BC.');
	}

	await db.execute(
		`INSERT INTO external_access_grants
		(public_id, owning_organisation_id, auth_user_id, invitation_id, context_type, context_public_id,
		 resource_type, resource_public_id, capability_key, valid_from, valid_until, revoked_at,
		 created_by_member_id)
		VALUES (?, ?, ?, NULL, 'project', ?, 'project', ?, 'project.view', ?, NULL, NULL, ?)`,
		[randomUUID(), organisationId, authUserId, projectPublicId, projectPublicId, now, ownerMemberId]
	);

	console.log(`Seeded canonical portal /${TENANT_SLUG}/portal/${PARTY_SLUG}.`);
} finally {
	await db.end();
}
