import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for portal browser fixture seeding.');

export const PORTAL_PARTNER_EMAIL = 'e2e-portal-partner@example.test';
export const PORTAL_PARTNER_PASSWORD = 'NuBlox-E2E-Portal-Partner-2026!';
export const PORTAL_PARTNER_ORGANISATION = 'NuBlox E2E Portal Partner';
export const PORTAL_PROJECT_NUMBER = 'PORTAL-E2E-001';
export const PORTAL_PROJECT_NAME = 'Portal collaboration project';
export const PORTAL_RFI_NUMBER = 'PORTAL-RFI-001';
export const PORTAL_SUBMITTAL_NUMBER = 'PORTAL-SUB-001';
export const PORTAL_INSTRUCTION_NUMBER = 'PORTAL-PI-001';
export const PORTAL_DOCUMENT_NUMBER = 'PORTAL-DOC-001';

function id(result) {
	if (result.insertId === undefined) throw new Error('Expected inserted ID.');
	return String(result.insertId);
}

const db = await mysql.createConnection(databaseUrl);
try {
	const now = new Date('2026-08-20T18:45:00.000Z');
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

	const partnerUserPublicId = randomUUID();
	const partnerAuthUserId = randomUUID();
	const partnerOrganisationPublicId = randomUUID();
	const partnerMemberPublicId = randomUUID();
	const partnerRolePublicId = randomUUID();
	const [partnerUser] = await db.execute(
		'INSERT INTO users (public_id, display_name, status) VALUES (?, ?, ?)',
		[partnerUserPublicId, 'NuBlox E2E Portal Partner', 'active']
	);
	const partnerUserId = id(partnerUser);
	await db.execute(
		`INSERT INTO auth_users
		(id, display_name, email, email_verified, image, created_at, updated_at)
		VALUES (?, ?, ?, 1, NULL, ?, ?)`,
		[partnerAuthUserId, 'NuBlox E2E Portal Partner', PORTAL_PARTNER_EMAIL, now, now]
	);
	await db.execute(
		`INSERT INTO auth_accounts
		(id, provider_account_id, provider_id, auth_user_id, access_token, refresh_token, id_token,
		 access_token_expires_at, refresh_token_expires_at, scope, password, created_at, updated_at)
		VALUES (?, ?, 'credential', ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?)`,
		[
			randomUUID(),
			partnerAuthUserId,
			partnerAuthUserId,
			await hashPassword(PORTAL_PARTNER_PASSWORD),
			now,
			now
		]
	);
	await db.execute('INSERT INTO auth_user_links (auth_user_id, user_id) VALUES (?, ?)', [
		partnerAuthUserId,
		partnerUserId
	]);
	const [partnerOrganisation] = await db.execute(
		`INSERT INTO organisations
		(public_id, legal_name, default_timezone, default_currency_code, status)
		VALUES (?, ?, 'Europe/London', 'GBP', 'active')`,
		[partnerOrganisationPublicId, PORTAL_PARTNER_ORGANISATION]
	);
	const partnerOrganisationId = id(partnerOrganisation);
	const [partnerMember] = await db.execute(
		`INSERT INTO organisation_members
		(organisation_id, user_id, public_id, status, joined_at)
		VALUES (?, ?, ?, 'active', ?)`,
		[partnerOrganisationId, partnerUserId, partnerMemberPublicId, now]
	);
	const partnerMemberId = id(partnerMember);
	const [partnerRole] = await db.execute(
		`INSERT INTO organisation_roles
		(organisation_id, public_id, name, is_active)
		VALUES (?, ?, 'Portal Partner', 1)`,
		[partnerOrganisationId, partnerRolePublicId]
	);
	const partnerRoleId = id(partnerRole);
	await db.execute(
		`INSERT INTO role_permissions (organisation_id, organisation_role_id, permission_id)
		SELECT ?, ?, id FROM permissions
		WHERE is_active = 1 AND permission_key IN ('portal.view', 'portal.respond')`,
		[partnerOrganisationId, partnerRoleId]
	);
	await db.execute(
		`INSERT INTO member_roles (organisation_id, organisation_member_id, organisation_role_id)
		VALUES (?, ?, ?)`,
		[partnerOrganisationId, partnerMemberId, partnerRoleId]
	);

	const projectPublicId = randomUUID();
	const [project] = await db.execute(
		`INSERT INTO projects
		(owning_organisation_id, public_id, project_number, name, description, status,
		 created_by_member_id, started_on)
		VALUES (?, ?, ?, ?, ?, 'active', ?, '2026-08-20')`,
		[
			ownerOrganisationId,
			projectPublicId,
			PORTAL_PROJECT_NUMBER,
			PORTAL_PROJECT_NAME,
			'Browser fixture for explicit cross-organisation collaboration.',
			ownerMemberId
		]
	);
	const projectId = id(project);
	for (const [organisationId, memberId] of [
		[ownerOrganisationId, ownerMemberId],
		[partnerOrganisationId, partnerMemberId]
	]) {
		await db.execute(
			`INSERT INTO project_organisations
			(project_id, participant_organisation_id, status, invited_by_member_id, joined_at, left_at)
			VALUES (?, ?, 'active', NULL, ?, NULL)`,
			[projectId, organisationId, now]
		);
		await db.execute(
			`INSERT INTO project_members
			(project_id, participant_organisation_id, organisation_member_id, status, joined_at, left_at)
			VALUES (?, ?, ?, 'active', ?, NULL)`,
			[projectId, organisationId, memberId, now]
		);
	}

	const rfiPublicId = randomUUID();
	await db.execute(
		`INSERT INTO rfis
		(project_id, owning_organisation_id, public_id, rfi_number, subject, question,
		 priority, status, due_at, created_by_member_id, opened_at)
		VALUES (?, ?, ?, ?, 'Confirm external opening size',
		 'Confirm the final coordinated builders work opening size.', 'high', 'open',
		 '2026-08-28 12:00:00', ?, ?)`,
		[projectId, ownerOrganisationId, rfiPublicId, PORTAL_RFI_NUMBER, ownerMemberId, now]
	);

	const [[submittalType]] = await db.query(
		`SELECT id FROM submittal_types WHERE code = 'technical' AND is_active = 1 LIMIT 1`
	);
	if (!submittalType) throw new Error('Technical submittal type is required.');
	const submittalPublicId = randomUUID();
	await db.execute(
		`INSERT INTO submittals
		(project_id, owning_organisation_id, public_id, submittal_number, submittal_type_id,
		 title, status, due_at, submitted_at, created_by_member_id)
		VALUES (?, ?, ?, ?, ?, 'External coordination submittal', 'submitted',
		 '2026-08-30 17:00:00', ?, ?)`,
		[
			projectId,
			ownerOrganisationId,
			submittalPublicId,
			PORTAL_SUBMITTAL_NUMBER,
			submittalType.id,
			now,
			ownerMemberId
		]
	);

	const [[instructionType]] = await db.query(
		`SELECT id FROM instruction_types WHERE code = 'project' AND is_active = 1 LIMIT 1`
	);
	if (!instructionType) throw new Error('Project instruction type is required.');
	const instructionPublicId = randomUUID();
	await db.execute(
		`INSERT INTO project_instructions
		(project_id, issuing_organisation_id, public_id, instruction_number, instruction_type_id,
		 subject, instruction_text, status, issued_by_member_id, issued_at)
		VALUES (?, ?, ?, ?, ?, 'Proceed with coordinated opening',
		 'Proceed using the issued coordination information.', 'issued', ?, ?)`,
		[
			projectId,
			ownerOrganisationId,
			instructionPublicId,
			PORTAL_INSTRUCTION_NUMBER,
			instructionType.id,
			ownerMemberId,
			now
		]
	);

	const [[containerType]] = await db.query(
		`SELECT id FROM information_container_types WHERE code = 'drawing' AND is_active = 1 LIMIT 1`
	);
	if (!containerType) throw new Error('Drawing information container type is required.');
	const containerPublicId = randomUUID();
	const [container] = await db.execute(
		`INSERT INTO information_containers
		(project_id, owning_organisation_id, public_id, information_container_type_id,
		 container_number, title, lifecycle_status, created_by_member_id)
		VALUES (?, ?, ?, ?, ?, 'External coordination drawing', 'active', ?)`,
		[
			projectId,
			ownerOrganisationId,
			containerPublicId,
			containerType.id,
			PORTAL_DOCUMENT_NUMBER,
			ownerMemberId
		]
	);
	const containerId = id(container);
	const versionPublicId = randomUUID();
	await db.execute(
		`INSERT INTO information_container_versions
		(information_container_id, project_id, owning_organisation_id, public_id,
		 revision_code, version_sequence, title_at_version, version_status, created_by_member_id,
		 locked_by_member_id, locked_at)
		VALUES (?, ?, ?, ?, 'C01', 1, 'External coordination drawing', 'issued', ?, ?, ?)`,
		[
			containerId,
			projectId,
			ownerOrganisationId,
			versionPublicId,
			ownerMemberId,
			ownerMemberId,
			now
		]
	);

	console.log(
		`Seeded portal collaboration fixture ${PORTAL_PROJECT_NUMBER} for ${PORTAL_PARTNER_EMAIL}.`
	);
} finally {
	await db.end();
}
