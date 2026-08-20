import { randomUUID } from 'node:crypto';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required for Slice 4 browser fixture seeding.');

const ORGANISATION = 'NuBlox E2E Organisation';
const VIEWER_ROLE = 'E2E Viewer Role';
export const E2E_SUPPLIER = 'NuBlox E2E Supplier';

const db = await mysql.createConnection(databaseUrl);
try {
	const [[organisation]] = await db.query(
		'SELECT id FROM organisations WHERE legal_name = ? LIMIT 1',
		[ORGANISATION]
	);
	if (!organisation)
		throw new Error('E2E organisation fixture must be seeded before Slice 4 fixture.');
	const organisationId = String(organisation.id);

	await db.execute(
		`DELETE rolePermission
		 FROM role_permissions AS rolePermission
		 INNER JOIN organisation_roles AS role
		   ON role.id = rolePermission.organisation_role_id
		  AND role.organisation_id = rolePermission.organisation_id
		 INNER JOIN permissions AS permission
		   ON permission.id = rolePermission.permission_id
		 WHERE rolePermission.organisation_id = ?
		   AND role.name = ?
		   AND permission.permission_key = 'commercial.cost_control.view'`,
		[organisationId, VIEWER_ROLE]
	);

	const [[supplierRole]] = await db.query(
		`SELECT id FROM party_role_types WHERE code = 'supplier' AND is_active = 1 LIMIT 1`
	);
	if (!supplierRole)
		throw new Error('Supplier CRM role type is required for Slice 4 browser fixture.');

	const supplierPublicId = randomUUID();
	const [party] = await db.execute(
		`INSERT INTO parties
		 (organisation_id, public_id, party_kind, account_owner_member_id, status)
		 VALUES (?, ?, 'organisation', NULL, 'active')`,
		[organisationId, supplierPublicId]
	);
	const supplierPartyId = String(party.insertId);
	await db.execute(
		`INSERT INTO party_organisations
		 (party_id, organisation_id, legal_name, trading_name)
		 VALUES (?, ?, ?, ?)`,
		[supplierPartyId, organisationId, `${E2E_SUPPLIER} Ltd`, E2E_SUPPLIER]
	);
	await db.execute(
		`INSERT INTO party_email_addresses
		 (organisation_id, party_id, email, label, is_primary, is_verified, verified_at)
		 VALUES (?, ?, 'supplier-e2e@example.test', 'Commercial', 1, 0, NULL)`,
		[organisationId, supplierPartyId]
	);
	await db.execute(
		`INSERT INTO party_role_assignments
		 (organisation_id, party_id, party_role_type_id, is_active)
		 VALUES (?, ?, ?, 1)`,
		[organisationId, supplierPartyId, supplierRole.id]
	);

	console.log(`Seeded Slice 4 supplier fixture ${E2E_SUPPLIER}.`);
} finally {
	await db.end();
}
