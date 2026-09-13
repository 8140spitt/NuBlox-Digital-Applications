const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TenantAppPath = `/${string}/app`;
export type AppDashboardPath = `/${string}/app/dashboard`;
export type AppMyWorkPath = `/${string}/app/my-work`;
export type AppFunctionsPath = `/${string}/app/functions`;
export type AppProjectsPath = `/${string}/app/projects`;
export type AppSignInPath = `/${string}/app/auth/signin${string}`;
export type AppInvitePath = `/${string}/app/auth/invite/${string}`;
export type PortalPath = `/${string}/portal/${string}`;
export type PortalDashboardPath = `/${string}/portal/${string}/dashboard`;
export type PortalProjectsPath = `/${string}/portal/${string}/projects`;
export type PortalActionsPath = `/${string}/portal/${string}/actions`;
export type PortalSignInPath = `/${string}/portal/${string}/auth/signin${string}`;

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

function safeLocalPath(value: string | null | undefined): string | null {
	if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
	return value;
}

function withReturnTo(base: string, returnTo: string | null): string {
	return returnTo ? `${base}?returnTo=${encodeURIComponent(returnTo)}` : base;
}

export function appPath(tenant: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const suffix = normalisePath(path);
	const base = `/${tenantSlug}/app`;
	return suffix ? `${base}/${suffix}` : base;
}

export function portalPath(tenant: string, crmParty: string, path = ''): string {
	const tenantSlug = requireRouteSlug(tenant, 'Tenant');
	const crmPartySlug = requireRouteSlug(crmParty, 'CRM Party');
	const suffix = normalisePath(path);
	const base = `/${tenantSlug}/portal/${crmPartySlug}`;
	return suffix ? `${base}/${suffix}` : base;
}

export function safeTenantAppReturnTo(
	value: string | null | undefined,
	tenant: string
): string | null {
	const candidate = safeLocalPath(value);
	if (!candidate) return null;

	const base = appPath(tenant);
	if (candidate !== base && !candidate.startsWith(`${base}/`)) return null;
	if (candidate === `${base}/auth` || candidate.startsWith(`${base}/auth/`)) return null;
	return candidate;
}

export function safePortalReturnTo(
	value: string | null | undefined,
	tenant: string,
	crmParty: string
): string | null {
	const candidate = safeLocalPath(value);
	if (!candidate) return null;

	const base = portalPath(tenant, crmParty);
	if (candidate !== base && !candidate.startsWith(`${base}/`)) return null;
	if (candidate === `${base}/auth` || candidate.startsWith(`${base}/auth/`)) return null;
	return candidate;
}

export function appSignInPath(tenant: string, returnTo?: string | null): AppSignInPath {
	const base = appPath(tenant, 'auth/signin');
	return withReturnTo(base, safeTenantAppReturnTo(returnTo, tenant)) as AppSignInPath;
}

export function appInvitePath(tenant: string, token: string): AppInvitePath {
	const cleanToken = token.trim();
	if (!cleanToken) throw new Error('Invitation token is required.');
	return appPath(tenant, `auth/invite/${cleanToken}`) as AppInvitePath;
}

export function portalSignInPath(
	tenant: string,
	crmParty: string,
	returnTo?: string | null
): PortalSignInPath {
	const base = portalPath(tenant, crmParty, 'auth/signin');
	return withReturnTo(base, safePortalReturnTo(returnTo, tenant, crmParty)) as PortalSignInPath;
}

export const routes = {
	start: '/start',
	register: '/register',
	verifyEmail: '/verify-email',
	app: (tenant: string): TenantAppPath => appPath(tenant) as TenantAppPath,
	appSignIn: appSignInPath,
	appForgotPassword: (tenant: string): string => appPath(tenant, 'auth/forgot-password'),
	appResetPassword: (tenant: string): string => appPath(tenant, 'auth/reset-password'),
	appVerifyEmail: (tenant: string): string => appPath(tenant, 'auth/verify-email'),
	appNoAccess: (tenant: string): string => appPath(tenant, 'auth/no-access'),
	appInvite: appInvitePath,
	dashboard: (tenant: string): AppDashboardPath => appPath(tenant, 'dashboard') as AppDashboardPath,
	myWork: (tenant: string): AppMyWorkPath => appPath(tenant, 'my-work') as AppMyWorkPath,
	functions: (tenant: string): AppFunctionsPath => appPath(tenant, 'functions') as AppFunctionsPath,
	projects: (tenant: string): AppProjectsPath => appPath(tenant, 'projects') as AppProjectsPath,
	portal: (tenant: string, crmParty: string): PortalPath =>
		portalPath(tenant, crmParty) as PortalPath,
	portalSignIn,
	portalForgotPassword: (tenant: string, crmParty: string): string =>
		portalPath(tenant, crmParty, 'auth/forgot-password'),
	portalResetPassword: (tenant: string, crmParty: string): string =>
		portalPath(tenant, crmParty, 'auth/reset-password'),
	portalVerifyEmail: (tenant: string, crmParty: string): string =>
		portalPath(tenant, crmParty, 'auth/verify-email'),
	portalNoAccess: (tenant: string, crmParty: string): string =>
		portalPath(tenant, crmParty, 'auth/no-access'),
	portalDashboard: (tenant: string, crmParty: string): PortalDashboardPath =>
		portalPath(tenant, crmParty, 'dashboard') as PortalDashboardPath,
	portalProjects: (tenant: string, crmParty: string): PortalProjectsPath =>
		portalPath(tenant, crmParty, 'projects') as PortalProjectsPath,
	portalActions: (tenant: string, crmParty: string): PortalActionsPath =>
		portalPath(tenant, crmParty, 'actions') as PortalActionsPath
} as const;
