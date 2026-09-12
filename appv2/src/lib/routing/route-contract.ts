const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TenantDashboardPath = `/${string}/dashboard`;
export type TenantMyWorkPath = `/${string}/my-work`;
export type TenantFunctionsPath = `/${string}/functions`;
export type PortalLoginPath = `/${string}/portal/${string}/login`;
export type PortalDashboardPath = `/${string}/portal/${string}/dashboard`;
export type PortalActionsPath = `/${string}/portal/${string}/actions`;

export function isRouteSlug(value: string): boolean {
	return ROUTE_SLUG_PATTERN.test(value);
}

function requireRouteSlug(value: string, label: string): string {
	if (!isRouteSlug(value)) {
		throw new Error(`${label} must be a lowercase kebab-case route slug.`);
	}
	return value;
}

function normalisePath(path: string): string {
	return path
		.split('/')
		.filter(Boolean)
		.map((segment) => encodeURIComponent(segment))
		.join('/');
}

export function tenantPath(tenant: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const suffix = normalisePath(path);
	return suffix ? `/${tenantSlug}/${suffix}` : `/${tenantSlug}`;
}

export function portalPath(tenant: string, party: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const partySlug = requireRouteSlug(party, 'Party');
	const suffix = normalisePath(path);
	const base = `/${tenantSlug}/portal/${partySlug}`;
	return suffix ? `${base}/${suffix}` : base;
}

export const routes = {
	dashboard: (tenant: string): TenantDashboardPath =>
		tenantPath(tenant, 'dashboard') as TenantDashboardPath,
	myWork: (tenant: string): TenantMyWorkPath => tenantPath(tenant, 'my-work') as TenantMyWorkPath,
	functions: (tenant: string): TenantFunctionsPath =>
		tenantPath(tenant, 'functions') as TenantFunctionsPath,
	portalLogin: (tenant: string, party: string): PortalLoginPath =>
		portalPath(tenant, party, 'login') as PortalLoginPath,
	portalDashboard: (tenant: string, party: string): PortalDashboardPath =>
		portalPath(tenant, party, 'dashboard') as PortalDashboardPath,
	portalActions: (tenant: string, party: string): PortalActionsPath =>
		portalPath(tenant, party, 'actions') as PortalActionsPath
} as const;
