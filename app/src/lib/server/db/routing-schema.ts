import type { ColumnType } from 'kysely';

type Generated<T> =
	T extends ColumnType<infer S, infer I, infer U>
		? ColumnType<S, I | undefined, U>
		: ColumnType<T, T | undefined, T>;

export interface TenantRouteContexts {
	organisation_id: string;
	route_slug: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface PartyRouteContexts {
	organisation_id: string;
	party_id: string;
	route_slug: string;
	created_at: Generated<Date>;
	updated_at: Generated<Date>;
}

export interface RoutingExternalPortalAccessContexts {
	external_access_grant_id: string;
	auth_user_id: string;
	owning_organisation_id: string;
	party_id: string;
}

export interface RoutingDB {
	tenant_route_contexts: TenantRouteContexts;
	party_route_contexts: PartyRouteContexts;
	routing_external_portal_access_contexts: RoutingExternalPortalAccessContexts;
}
