const ROUTE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type TenantAppPath = `/${string}/app`;
export type AppDashboardPath = `/${string}/app/dashboard`;
export type AppMyWorkPath = `/${string}/app/my-work`;
export type AppFunctionsPath = `/${string}/app/functions`;
export type AppProjectsPath = `/${string}/app/projects`;
export type AppDesignSystemPath = `/${string}/app/design-system`;
export type AppLifecyclePath = `/${string}/app/lifecycle`;
export type AppLifecycleTemplatePath = `/${string}/app/lifecycle/${string}`;
export type AppStrategyPath = `/${string}/app/functions/f01`;
export type AppStrategyNewPath = `/${string}/app/functions/f01/new`;
export type AppStrategyFrameworkPath = `/${string}/app/functions/f01/strategies/${string}`;
export type AppStrategyManagePath =
	`/${string}/app/functions/f01/strategies/${string}/manage/${string}/${string}`;
export type StrategyManageRecordKind =
	| 'framework'
	| 'evidence'
	| 'factor'
	| 'assumption'
	| 'option'
	| 'theme'
	| 'objective'
	| 'plan'
	| 'initiative'
	| 'requirement'
	| 'handoff'
	| 'kpi'
	| 'review'
	| 'decision';
export type AppStrategyAnalysisPath = `/${string}/app/functions/f01/strategies/${string}/analysis`;
export type AppStrategyAnalysisNewPath =
	`/${string}/app/functions/f01/strategies/${string}/analysis/new/${string}`;
export type AppStrategyPlanningPath = `/${string}/app/functions/f01/strategies/${string}/planning`;
export type AppStrategyPlanningNewPath =
	`/${string}/app/functions/f01/strategies/${string}/planning/new/${string}`;
export type AppStrategyBusinessPlanningPath =
	`/${string}/app/functions/f01/strategies/${string}/business-planning`;
export type AppStrategyBusinessPlanningNewPath =
	`/${string}/app/functions/f01/strategies/${string}/business-planning/new/${string}`;
export type AppStrategyOperatingModelPath =
	`/${string}/app/functions/f01/strategies/${string}/operating-model`;
export type AppStrategyOperatingModelNewPath =
	`/${string}/app/functions/f01/strategies/${string}/operating-model/new`;
export type AppStrategyPerformancePath =
	`/${string}/app/functions/f01/strategies/${string}/performance`;
export type AppStrategyPerformanceNewPath =
	`/${string}/app/functions/f01/strategies/${string}/performance/new/${string}`;
export type AppStrategyReviewPath = `/${string}/app/functions/f01/strategies/${string}/review`;
export type AppStrategyReviewNewPath =
	`/${string}/app/functions/f01/strategies/${string}/review/new/${string}`;
export type AppStrategyForesightPath =
	`/${string}/app/functions/f01/strategies/${string}/foresight`;
export type AppStrategyForesightNewPath =
	`/${string}/app/functions/f01/strategies/${string}/foresight/new`;
export type StrategyAnalysisRecordKind = 'evidence' | 'factor' | 'assumption';
export type StrategyPlanningRecordKind = 'option' | 'theme' | 'objective';
export type StrategyBusinessPlanningRecordKind = 'plan' | 'initiative' | 'requirement' | 'handoff';
export type StrategyPerformanceRecordKind = 'kpi';
export type StrategyReviewRecordKind = 'review' | 'decision';
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

function requiredSegment(value: string, label: string): string {
	const normalized = value.trim();
	if (!normalized) throw new Error(`${label} is required.`);
	return encodeURIComponent(normalized);
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

	const authBase = `${base}/auth`;
	const inviteBase = `${authBase}/invite/`;
	if (
		candidate === authBase ||
		(candidate.startsWith(`${authBase}/`) && !candidate.startsWith(inviteBase))
	) {
		return null;
	}
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
	return `${appPath(tenant, 'auth/invite')}/${encodeURIComponent(cleanToken)}` as AppInvitePath;
}

export function portalSignInPath(
	tenant: string,
	crmParty: string,
	returnTo?: string | null
): PortalSignInPath {
	const base = portalPath(tenant, crmParty, 'auth/signin');
	return withReturnTo(base, safePortalReturnTo(returnTo, tenant, crmParty)) as PortalSignInPath;
}

function strategyBase(tenant: string, strategyPublicId: string): string {
	return `${appPath(tenant, 'functions/f01/strategies')}/${requiredSegment(strategyPublicId, 'Strategy')}`;
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
	designSystem: (tenant: string): AppDesignSystemPath =>
		appPath(tenant, 'design-system') as AppDesignSystemPath,
	lifecycle: (tenant: string): AppLifecyclePath => appPath(tenant, 'lifecycle') as AppLifecyclePath,
	lifecycleTemplate: (tenant: string, templatePublicId: string): AppLifecycleTemplatePath =>
		`${appPath(tenant, 'lifecycle')}/${requiredSegment(templatePublicId, 'Lifecycle template')}` as AppLifecycleTemplatePath,
	strategy: (tenant: string): AppStrategyPath => appPath(tenant, 'functions/f01') as AppStrategyPath,
	strategyNew: (tenant: string): AppStrategyNewPath =>
		appPath(tenant, 'functions/f01/new') as AppStrategyNewPath,
	strategyFramework: (tenant: string, strategyPublicId: string): AppStrategyFrameworkPath =>
		strategyBase(tenant, strategyPublicId) as AppStrategyFrameworkPath,
	strategyManage: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyManageRecordKind,
		recordPublicId: string
	): AppStrategyManagePath =>
		`${strategyBase(tenant, strategyPublicId)}/manage/${requiredSegment(recordKind, 'Record kind')}/${requiredSegment(recordPublicId, 'Record')}` as AppStrategyManagePath,
	strategyAnalysis: (tenant: string, strategyPublicId: string): AppStrategyAnalysisPath =>
		`${strategyBase(tenant, strategyPublicId)}/analysis` as AppStrategyAnalysisPath,
	strategyAnalysisNew: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyAnalysisRecordKind
	): AppStrategyAnalysisNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/analysis/new/${recordKind}` as AppStrategyAnalysisNewPath,
	strategyPlanning: (tenant: string, strategyPublicId: string): AppStrategyPlanningPath =>
		`${strategyBase(tenant, strategyPublicId)}/planning` as AppStrategyPlanningPath,
	strategyPlanningNew: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyPlanningRecordKind
	): AppStrategyPlanningNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/planning/new/${recordKind}` as AppStrategyPlanningNewPath,
	strategyBusinessPlanning: (
		tenant: string,
		strategyPublicId: string
	): AppStrategyBusinessPlanningPath =>
		`${strategyBase(tenant, strategyPublicId)}/business-planning` as AppStrategyBusinessPlanningPath,
	strategyBusinessPlanningNew: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyBusinessPlanningRecordKind
	): AppStrategyBusinessPlanningNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/business-planning/new/${recordKind}` as AppStrategyBusinessPlanningNewPath,
	strategyOperatingModel: (
		tenant: string,
		strategyPublicId: string
	): AppStrategyOperatingModelPath =>
		`${strategyBase(tenant, strategyPublicId)}/operating-model` as AppStrategyOperatingModelPath,
	strategyOperatingModelNew: (
		tenant: string,
		strategyPublicId: string
	): AppStrategyOperatingModelNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/operating-model/new` as AppStrategyOperatingModelNewPath,
	strategyPerformance: (tenant: string, strategyPublicId: string): AppStrategyPerformancePath =>
		`${strategyBase(tenant, strategyPublicId)}/performance` as AppStrategyPerformancePath,
	strategyPerformanceNew: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyPerformanceRecordKind
	): AppStrategyPerformanceNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/performance/new/${recordKind}` as AppStrategyPerformanceNewPath,
	strategyReview: (tenant: string, strategyPublicId: string): AppStrategyReviewPath =>
		`${strategyBase(tenant, strategyPublicId)}/review` as AppStrategyReviewPath,
	strategyReviewNew: (
		tenant: string,
		strategyPublicId: string,
		recordKind: StrategyReviewRecordKind
	): AppStrategyReviewNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/review/new/${recordKind}` as AppStrategyReviewNewPath,
	strategyForesight: (tenant: string, strategyPublicId: string): AppStrategyForesightPath =>
		`${strategyBase(tenant, strategyPublicId)}/foresight` as AppStrategyForesightPath,
	strategyForesightNew: (tenant: string, strategyPublicId: string): AppStrategyForesightNewPath =>
		`${strategyBase(tenant, strategyPublicId)}/foresight/new` as AppStrategyForesightNewPath,
	portal: (tenant: string, crmParty: string): PortalPath =>
		portalPath(tenant, crmParty) as PortalPath,
	portalSignIn: portalSignInPath,
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
