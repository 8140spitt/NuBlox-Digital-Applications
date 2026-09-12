const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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
	dashboard: (tenant: string) => tenantPath(tenant, 'dashboard'),
	myWork: (tenant: string) => tenantPath(tenant, 'my-work'),
	functions: (tenant: string) => tenantPath(tenant, 'functions'),
	portalLogin: (tenant: string, party: string) => portalPath(tenant, party, 'login'),
	portalDashboard: (tenant: string, party: string) => portalPath(tenant, party, 'dashboard'),
	portalActions: (tenant: string, party: string) => portalPath(tenant, party, 'actions')
} as const;
