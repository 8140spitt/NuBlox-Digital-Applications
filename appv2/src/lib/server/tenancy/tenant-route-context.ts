import type { RowDataPacket } from 'mysql2/promise';
import { getPool } from '$lib/server/db/pool';

type TenantRouteRow = RowDataPacket & {
	routeSlug: string;
	organisationId: string | number;
	organisationPublicId: string;
};

export type TenantRouteContext = {
	routeSlug: string;
	organisationId: string;
	organisationPublicId: string;
};

function mapRow(row: TenantRouteRow): TenantRouteContext {
	return {
		routeSlug: row.routeSlug,
		organisationId: row.organisationId.toString(),
		organisationPublicId: row.organisationPublicId
	};
}

export async function getTenantRouteContextByOrganisationPublicId(
	organisationPublicId: string
): Promise<TenantRouteContext | null> {
	const [rows] = await getPool().execute<TenantRouteRow[]>(
		`SELECT route_context.route_slug AS routeSlug,
				organisation.id AS organisationId,
				organisation.public_id AS organisationPublicId
		 FROM organisations organisation
		 JOIN tenant_route_contexts route_context
		   ON route_context.organisation_id = organisation.id
		 WHERE organisation.public_id = ?
		 LIMIT 1`,
		[organisationPublicId]
	);

	return rows[0] ? mapRow(rows[0]) : null;
}
