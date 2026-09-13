import { describe, expect, it } from 'vitest';
import {
	appInvitePath,
	appPath,
	appSignInPath,
	isRouteSlug,
	portalPath,
	portalSignInPath,
	routes,
	safePortalReturnTo,
	safeTenantAppReturnTo
} from './route-contract';

describe('NuBlox V2 tenant-first route contract', () => {
	it('accepts stable lowercase route slugs and public ids', () => {
		expect(isRouteSlug('nublox')).toBe(true);
		expect(isRouteSlug('perspective-bc')).toBe(true);
		expect(isRouteSlug('891aaaf5-aa43-4923-8197-a9753c000a87')).toBe(true);
	});

	it('rejects route slugs unsuitable for canonical URLs', () => {
		expect(isRouteSlug('Perspective BC')).toBe(false);
		expect(isRouteSlug('perspective_bc')).toBe(false);
		expect(isRouteSlug('')).toBe(false);
	});

	it('keeps new-tenant onboarding outside any tenant boundary', () => {
		expect(routes.start).toBe('/start');
		expect(routes.register).toBe('/register');
		expect(routes.verifyEmail).toBe('/verify-email');
	});

	it('builds tenant-first internal application URLs', () => {
		expect(appPath('nublox')).toBe('/nublox/app');
		expect(appPath('nublox', 'projects/PRJ-001')).toBe('/nublox/app/projects/PRJ-001');
		expect(routes.dashboard('nublox')).toBe('/nublox/app/dashboard');
		expect(routes.myWork('nublox')).toBe('/nublox/app/my-work');
		expect(routes.projects('nublox')).toBe('/nublox/app/projects');
		expect(routes.functions('nublox')).toBe('/nublox/app/functions');
		expect(routes.designSystem('nublox')).toBe('/nublox/app/design-system');
	});

	it('builds the F01 strategy workspace inside the active tenant', () => {
		expect(routes.strategy('perspective-bc')).toBe('/perspective-bc/app/functions/f01');
		expect(routes.strategyNew('perspective-bc')).toBe('/perspective-bc/app/functions/f01/new');
		expect(routes.strategyFramework('perspective-bc', 'framework-public-id')).toBe(
			'/perspective-bc/app/functions/f01/strategies/framework-public-id'
		);
		expect(routes.strategyAnalysis('perspective-bc', 'framework-public-id')).toBe(
			'/perspective-bc/app/functions/f01/strategies/framework-public-id/analysis'
		);
		expect(
			routes.strategyAnalysisNew('perspective-bc', 'framework-public-id', 'evidence')
		).toBe(
			'/perspective-bc/app/functions/f01/strategies/framework-public-id/analysis/new/evidence'
		);
		expect(routes.strategyPlanning('perspective-bc', 'framework-public-id')).toBe(
			'/perspective-bc/app/functions/f01/strategies/framework-public-id/planning'
		);
		expect(
			routes.strategyPlanningNew('perspective-bc', 'framework-public-id', 'objective')
		).toBe(
			'/perspective-bc/app/functions/f01/strategies/framework-public-id/planning/new/objective'
		);
		expect(() => routes.strategyFramework('perspective-bc', '')).toThrow(/Strategy/);
	});

	it('builds explicit tenant-scoped authentication URLs', () => {
		expect(routes.appSignIn('nublox')).toBe('/nublox/app/auth/signin');
		expect(appSignInPath('nublox', '/nublox/app/projects')).toBe(
			'/nublox/app/auth/signin?returnTo=%2Fnublox%2Fapp%2Fprojects'
		);
		expect(routes.appForgotPassword('nublox')).toBe('/nublox/app/auth/forgot-password');
		expect(routes.appResetPassword('nublox')).toBe('/nublox/app/auth/reset-password');
		expect(routes.appNoAccess('nublox')).toBe('/nublox/app/auth/no-access');
		expect(appInvitePath('nublox', 'abc/123')).toBe('/nublox/app/auth/invite/abc%2F123');
		expect(() => appInvitePath('nublox', '')).toThrow(/Invitation token/);
	});

	it('builds tenant-first CRM Party portal URLs', () => {
		expect(portalPath('nublox', 'perspectivebc')).toBe('/nublox/portal/perspectivebc');
		expect(portalPath('nublox', 'perspectivebc', 'rfqs/RFQ-001')).toBe(
			'/nublox/portal/perspectivebc/rfqs/RFQ-001'
		);
		expect(routes.portalDashboard('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/dashboard'
		);
		expect(routes.portalProjects('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/projects'
		);
		expect(routes.portalActions('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/actions'
		);
	});

	it('binds the public portal sign-in route helper to the canonical implementation', () => {
		expect(routes.portalSignIn).toBe(portalSignInPath);
		expect(routes.portalSignIn('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/auth/signin'
		);
	});

	it('builds portal sign-in inside the exact tenant and CRM Party context', () => {
		expect(routes.portalSignIn('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/auth/signin'
		);
		expect(
			portalSignInPath('nublox', 'perspectivebc', '/nublox/portal/perspectivebc/projects')
		).toBe(
			'/nublox/portal/perspectivebc/auth/signin?returnTo=%2Fnublox%2Fportal%2Fperspectivebc%2Fprojects'
		);
	});

	it('never carries a return destination across tenant boundaries', () => {
		const invitation = appInvitePath('nublox', 'invite-token');
		expect(safeTenantAppReturnTo('/nublox/app/projects', 'nublox')).toBe('/nublox/app/projects');
		expect(safeTenantAppReturnTo(invitation, 'nublox')).toBe(invitation);
		expect(safeTenantAppReturnTo('/other/app/auth/invite/invite-token', 'nublox')).toBeNull();
		expect(safeTenantAppReturnTo('/other/app/projects', 'nublox')).toBeNull();
		expect(safeTenantAppReturnTo('/nublox/app/auth/signin', 'nublox')).toBeNull();
		expect(safeTenantAppReturnTo('https://example.com', 'nublox')).toBeNull();
		expect(appSignInPath('nublox', '/other/app/dashboard')).toBe('/nublox/app/auth/signin');
	});

	it('never carries a return destination across CRM Party boundaries', () => {
		expect(
			safePortalReturnTo('/nublox/portal/perspectivebc/projects', 'nublox', 'perspectivebc')
		).toBe('/nublox/portal/perspectivebc/projects');
		expect(
			safePortalReturnTo('/nublox/portal/another-party/projects', 'nublox', 'perspectivebc')
		).toBeNull();
		expect(
			safePortalReturnTo('/other/portal/perspectivebc/projects', 'nublox', 'perspectivebc')
		).toBeNull();
	});

	it('does not silently normalise invalid tenant or CRM Party identity', () => {
		expect(() => appPath('NuBlox', 'dashboard')).toThrow(/Tenant/);
		expect(() => portalPath('nublox', 'Perspective BC', 'dashboard')).toThrow(/CRM Party/);
	});
});