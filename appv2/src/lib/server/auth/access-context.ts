import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

export type InternalAccessContext = {
	userId: string;
	organisationId: string;
	organisationPublicId: string;
	organisationRouteSlug: string;
	organisationName: string;
	memberId: string;
	memberPublicId: string;
};

type InternalAccessRow = RowDataPacket & {
	userId: string | number;
	organisationId: string | number;
	organisationPublicId: string;
	organisationRouteSlug: string;
	organisationName: string;
	memberId: string | number;
	memberPublicId: string;
};

function mapInternalAccessRow(row: InternalAccessRow): InternalAccessContext {
	return {
		userId: row.userId.toString(),
		organisationId: row.organisationId.toString(),
		organisationPublicId: row.organisationPublicId,
		organisationRouteSlug: row.organisationRouteSlug,
		organisationName: row.organisationName,
		memberId: row.memberId.toString(),
		memberPublicId: row.memberPublicId
	};
}

const ACTIVE_INTERNAL_CONTEXT_SELECT = `SELECT user.id AS userId,
		organisation.id AS organisationId,
		organisation.public_id AS organisationPublicId,
		route_context.route_slug AS organisationRouteSlug,
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
 JOIN tenant_route_contexts route_context
   ON route_context.organisation_id = organisation.id`;

export async function listActiveInternalAccessContexts(
	authUserId: string
): Promise<InternalAccessContext[]> {
	const [rows] = await getPool().execute<InternalAccessRow[]>(
		`${ACTIVE_INTERNAL_CONTEXT_SELECT}
		 WHERE auth_link.auth_user_id = ?
		 ORDER BY organisation.legal_name ASC, organisation.id ASC`,
		[authUserId]
	);

	return rows.map(mapInternalAccessRow);
}

export async function resolveActiveInternalTenant(
	authUserId: string,
	routeSlug: string
): Promise<InternalAccessContext | null> {
	const [rows] = await getPool().execute<InternalAccessRow[]>(
		`${ACTIVE_INTERNAL_CONTEXT_SELECT}
		 WHERE auth_link.auth_user_id = ?
		   AND route_context.route_slug = ?
		 LIMIT 1`,
		[authUserId, routeSlug]
	);

	const row = rows[0];
	return row ? mapInternalAccessRow(row) : null;
}
