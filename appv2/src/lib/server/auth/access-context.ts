import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

export type InternalAccessContext = {
	organisationId: string;
	organisationPublicId: string;
	organisationName: string;
	memberId: string;
	memberPublicId: string;
};

type InternalAccessRow = RowDataPacket & {
	organisationId: string | number;
	organisationPublicId: string;
	organisationName: string;
	memberId: string | number;
	memberPublicId: string;
};

function mapInternalAccessRow(row: InternalAccessRow): InternalAccessContext {
	return {
		organisationId: row.organisationId.toString(),
		organisationPublicId: row.organisationPublicId,
		organisationName: row.organisationName,
		memberId: row.memberId.toString(),
		memberPublicId: row.memberPublicId
	};
}

export async function listActiveInternalAccessContexts(
	authUserId: string
): Promise<InternalAccessContext[]> {
	const [rows] = await getPool().execute<InternalAccessRow[]>(
		`SELECT organisation.id AS organisationId,
				organisation.public_id AS organisationPublicId,
				COALESCE(NULLIF(organisation.trading_name, ''), organisation.legal_name) AS organisationName,
				member.id AS memberId,
				member.public_id AS memberPublicId
		 FROM auth_user_links auth_link
		 JOIN users user
		   ON user.id = auth_link.user_id
		  AND user.status = 'active'
		 JOIN organisation_members member
		   ON member.user_id = user.id
		  AND member.status = 'active'
		 JOIN organisations organisation
		   ON organisation.id = member.organisation_id
		  AND organisation.status = 'active'
		 WHERE auth_link.auth_user_id = ?
		 ORDER BY organisation.legal_name ASC, organisation.id ASC`,
		[authUserId]
	);

	return rows.map(mapInternalAccessRow);
}

export async function resolveActiveInternalTenant(
	authUserId: string,
	organisationPublicId: string
): Promise<InternalAccessContext | null> {
	const [rows] = await getPool().execute<InternalAccessRow[]>(
		`SELECT organisation.id AS organisationId,
				organisation.public_id AS organisationPublicId,
				COALESCE(NULLIF(organisation.trading_name, ''), organisation.legal_name) AS organisationName,
				member.id AS memberId,
				member.public_id AS memberPublicId
		 FROM auth_user_links auth_link
		 JOIN users user
		   ON user.id = auth_link.user_id
		  AND user.status = 'active'
		 JOIN organisation_members member
		   ON member.user_id = user.id
		  AND member.status = 'active'
		 JOIN organisations organisation
		   ON organisation.id = member.organisation_id
		  AND organisation.status = 'active'
		 WHERE auth_link.auth_user_id = ?
		   AND organisation.public_id = ?
		 LIMIT 1`,
		[authUserId, organisationPublicId]
	);

	const row = rows[0];
	return row ? mapInternalAccessRow(row) : null;
}
