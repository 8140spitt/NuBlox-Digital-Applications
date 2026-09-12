const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AppDashboardPath = `/app/${string}/dashboard`;
export type AppMyWorkPath = `/app/${string}/my-work`;
export type AppFunctionsPath = `/app/${string}/functions`;
export type AppProjectsPath = `/app/${string}/projects`;
export type PortalLoginPath = `/portal/${string}/${string}/login`;
export type PortalDashboardPath = `/portal/${string}/${string}/dashboard`;
export type PortalProjectsPath = `/portal/${string}/${string}/projects`;
export type PortalActionsPath = `/portal/${string}/${string}/actions`;

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

export function appPath(tenant: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const suffix = normalisePath(path);
	const base = `/app/${tenantSlug}`;
	return suffix ? `${base}/${suffix}` : base;
}

export function portalPath(tenant: string, crmParty: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const crmPartySlug = requireRouteSlug(crmParty, 'CRM Party');
	const suffix = normalisePath(path);
	const base = `/portal/${tenantSlug}/${crmPartySlug}`;
	return suffix ? `${base}/${suffix}` : base;
}

export const routes = {
	dashboard: (tenant: string): AppDashboardPath => appPath(tenant, 'dashboard') as AppDashboardPath,
	myWork: (tenant: string): AppMyWorkPath => appPath(tenant, 'my-work') as AppMyWorkPath,
	functions: (tenant: string): AppFunctionsPath => appPath(tenant, 'functions') as AppFunctionsPath,
	projects: (tenant: string): AppProjectsPath => appPath(tenant, 'projects') as AppProjectsPath,
	portalLogin: (tenant: string, crmParty: string): PortalLoginPath =>
		portalPath(tenant, crmParty, 'login') as PortalLoginPath,
	portalDashboard: (tenant: string, crmParty: string): PortalDashboardPath =>
		portalPath(tenant, crmParty, 'dashboard') as PortalDashboardPath,
	portalProjects: (tenant: string, crmParty: string): PortalProjectsPath =>
		portalPath(tenant, crmParty, 'projects') as PortalProjectsPath,
	portalActions: (tenant: string, crmParty: string): PortalActionsPath =>
		portalPath(tenant, crmParty, 'actions') as PortalActionsPath
} as const;
