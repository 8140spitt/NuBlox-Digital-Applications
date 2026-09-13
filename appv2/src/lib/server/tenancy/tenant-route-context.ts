import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

type TenantRouteRow = RowDataPacket & {
	routeSlug: string;
	organisationId: string | number;
	organisationPublicId: string;
	displayName: string;
};

export type TenantRouteContext = {
	routeSlug: string;
	organisationId: string;
	organisationPublicId: string;
	displayName: string;
};

function mapRow(row: TenantRouteRow): TenantRouteContext {
	return {
		routeSlug: row.routeSlug,
		organisationId: row.organisationId.toString(),
		organisationPublicId: row.organisationPublicId,
		displayName: row.displayName
	};
}

const tenantRouteSelect = `SELECT route_context.route_slug AS routeSlug,
				organisation.id AS organisationId,
				organisation.public_id AS organisationPublicId,
				COALESCE(NULLIF(TRIM(organisation.trading_name), ''), organisation.legal_name) AS displayName
		 FROM organisations organisation
		 JOIN tenant_route_contexts route_context
		   ON route_context.organisation_id = organisation.id`;

export async function getTenantRouteContextByOrganisationPublicId(
	organisationPublicId: string
): Promise<TenantRouteContext | null> {
	const [rows] = await getPool().execute<TenantRouteRow[]>(
		`${tenantRouteSelect}
		 WHERE organisation.public_id = ?
		 LIMIT 1`,
		[organisationPublicId]
	);

	return rows[0] ? mapRow(rows[0]) : null;
}

export async function getActiveTenantRouteContextBySlug(
	routeSlug: string
): Promise<TenantRouteContext | null> {
	const [rows] = await getPool().execute<TenantRouteRow[]>(
		`${tenantRouteSelect}
		 WHERE route_context.route_slug = ?
		   AND organisation.status = 'active'
		 LIMIT 1`,
		[routeSlug]
	);

	return rows[0] ? mapRow(rows[0]) : null;
}
