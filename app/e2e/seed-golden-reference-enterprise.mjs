import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for golden reference fixture seeding.');

export const GOLDEN_REFERENCE_TENANT = 'NuBlox E2E Organisation';
export const GOLDEN_REFERENCE_CLIENT = 'Northstar Property Holdings';
export const GOLDEN_REFERENCE_SUPPLIER = 'Apex Building Services';
export const GOLDEN_REFERENCE_PROJECT_NUMBER = 'REF-RIVERSIDE-001';
export const GOLDEN_REFERENCE_PROJECT = 'Northstar Riverside Campus';
export const GOLDEN_REFERENCE_PROJECT_PUBLIC_ID = '33333333-3333-4333-8333-333333333333';

const CLIENT_PUBLIC_ID = '11111111-1111-4111-8111-111111111111';
const SUPPLIER_PUBLIC_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_STARTED_ON = '2026-04-01';

async function createOrganisationParty(db, input) {
	const [[roleType]] = await db.query(
		'SELECT id FROM party_role_types WHERE code = ? AND is_active = 1 LIMIT 1',
		[input.roleCode]
	);
	if (!roleType) throw new Error(`Required CRM party role type is missing: ${input.roleCode}.`);

	const [party] = await db.execute(
		`INSERT INTO parties
		 (organisation_id, public_id, party_kind, account_owner_member_id, status)
		 VALUES (?, ?, 'organisation', ?, 'active')`,
		[input.organisationId, input.publicId, input.ownerMemberId]
	);
	const partyId = String(party.insertId);

	await db.execute(
		`INSERT INTO party_organisations
		 (party_id, organisation_id, legal_name, trading_name)
		 VALUES (?, ?, ?, ?)`,
		[partyId, input.organisationId, input.legalName, input.tradingName]
	);
	await db.execute(
		`INSERT INTO party_email_addresses
		 (organisation_id, party_id, email, label, is_primary, is_verified, verified_at)
		 VALUES (?, ?, ?, 'Commercial', 1, 0, NULL)`,
		[input.organisationId, partyId, input.email]
	);
	await db.execute(
		`INSERT INTO party_role_assignments
		 (organisation_id, party_id, party_role_type_id, is_active)
		 VALUES (?, ?, ?, 1)`,
		[input.organisationId, partyId, roleType.id]
	);

	return partyId;
}

const db = await mysql.createConnection(databaseUrl);
try {
	const [[organisation]] = await db.query(
		'SELECT id FROM organisations WHERE legal_name = ? LIMIT 1',
		[GOLDEN_REFERENCE_TENANT]
	);
	if (!organisation) {
		throw new Error('Authenticated E2E tenant must be seeded before the golden reference fixture.');
	}
	const organisationId = String(organisation.id);

	const [[ownerMember]] = await db.query(
		`SELECT member.id
		 FROM organisation_members AS member
		 INNER JOIN organisation_roles AS role
		   ON role.organisation_id = member.organisation_id
		 INNER JOIN member_roles AS memberRole
		   ON memberRole.organisation_id = member.organisation_id
		  AND memberRole.organisation_member_id = member.id
		  AND memberRole.organisation_role_id = role.id
		 WHERE member.organisation_id = ?
		   AND member.status = 'active'
		   AND role.name = 'E2E Owner'
		 LIMIT 1`,
		[organisationId]
	);
	if (!ownerMember) throw new Error('Golden reference fixture requires the E2E Owner member.');
	const ownerMemberId = String(ownerMember.id);

	await createOrganisationParty(db, {
		organisationId,
		ownerMemberId,
		publicId: CLIENT_PUBLIC_ID,
		roleCode: 'client',
		legalName: `${GOLDEN_REFERENCE_CLIENT} plc`,
		tradingName: GOLDEN_REFERENCE_CLIENT,
		email: 'projects@northstar-property.example.test'
	});

	await createOrganisationParty(db, {
		organisationId,
		ownerMemberId,
		publicId: SUPPLIER_PUBLIC_ID,
		roleCode: 'supplier',
		legalName: `${GOLDEN_REFERENCE_SUPPLIER} Ltd`,
		tradingName: GOLDEN_REFERENCE_SUPPLIER,
		email: 'commercial@apex-building.example.test'
	});

	const [project] = await db.execute(
		`INSERT INTO projects
		 (owning_organisation_id, public_id, project_number, name, description, status,
		  created_by_member_id, started_on)
		 VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
		[
			organisationId,
			GOLDEN_REFERENCE_PROJECT_PUBLIC_ID,
			GOLDEN_REFERENCE_PROJECT_NUMBER,
			GOLDEN_REFERENCE_PROJECT,
			'Golden reference project used to prove NuBlox enterprise, project and asset digital-thread journeys.',
			ownerMemberId,
			PROJECT_STARTED_ON
		]
	);
	const projectId = String(project.insertId);

	await db.execute(
		`INSERT INTO project_organisations
		 (project_id, participant_organisation_id, status, invited_by_member_id, joined_at, left_at)
		 VALUES (?, ?, 'active', NULL, ?, NULL)`,
		[projectId, organisationId, PROJECT_STARTED_ON]
	);
	await db.execute(
		`INSERT INTO project_members
		 (project_id, participant_organisation_id, organisation_member_id, status, joined_at, left_at)
		 VALUES (?, ?, ?, 'active', ?, NULL)`,
		[projectId, organisationId, ownerMemberId, PROJECT_STARTED_ON]
	);

	console.log(
		`Seeded golden reference enterprise context: ${GOLDEN_REFERENCE_CLIENT}, ${GOLDEN_REFERENCE_SUPPLIER}, ${GOLDEN_REFERENCE_PROJECT_NUMBER}.`
	);
} finally {
	await db.end();
}
