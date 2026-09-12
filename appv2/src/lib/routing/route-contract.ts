const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type AppDashboardPath = `/app/${string}/dashboard`;
export type AppMyWorkPath = `/app/${string}/my-work`;
export type AppFunctionsPath = `/app/${string}/functions`;
export type AppProjectsPath = `/app/${string}/projects`;
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

export function safeReturnTo(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
	if (value === '/auth' || value.startsWith('/auth?')) return null;
	if (value.startsWith('/app/') || value.startsWith('/portal/')) return value;
	return null;
}

export function authPath(returnTo?: string | null): string {
	const destination = safeReturnTo(returnTo);
	return destination ? `/auth?returnTo=${encodeURIComponent(destination)}` : '/auth';
}

export const routes = {
	auth: authPath,
	dashboard: (tenant: string): AppDashboardPath => appPath(tenant, 'dashboard') as AppDashboardPath,
	myWork: (tenant: string): AppMyWorkPath => appPath(tenant, 'my-work') as AppMyWorkPath,
	functions: (tenant: string): AppFunctionsPath => appPath(tenant, 'functions') as AppFunctionsPath,
	projects: (tenant: string): AppProjectsPath => appPath(tenant, 'projects') as AppProjectsPath,
	portalDashboard: (tenant: string, crmParty: string): PortalDashboardPath =>
		portalPath(tenant, crmParty, 'dashboard') as PortalDashboardPath,
	portalProjects: (tenant: string, crmParty: string): PortalProjectsPath =>
		portalPath(tenant, crmParty, 'projects') as PortalProjectsPath,
	portalActions: (tenant: string, crmParty: string): PortalActionsPath =>
		portalPath(tenant, crmParty, 'actions') as PortalActionsPath
} as const;
