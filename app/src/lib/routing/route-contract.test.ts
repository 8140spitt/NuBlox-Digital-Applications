import { describe, expect, it } from 'vitest';

import {
	isLegacyTenantAppPath,
	isTenantRouteSlug,
	parseCanonicalRoute,
	portalDashboardPath,
	portalLoginPath,
	reroutedPathname,
	tenantPath
} from './route-contract';

describe('tenant-first route contract', () => {
	it('builds canonical internal tenant URLs', () => {
		expect(tenantPath('nublox', '/dashboard')).toBe('/nublox/dashboard');
		expect(tenantPath('nublox', '/projects/project-1?view=plan')).toBe(
			'/nublox/projects/project-1?view=plan'
		);
	});

	it('builds the CRM-party portal login and dashboard URLs', () => {
		expect(portalLoginPath('nublox', 'perspectivebc')).toBe('/nublox/portal/perspectivebc/login');
		expect(portalDashboardPath('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/dashboard'
		);
	});

	it('parses an external CRM-party route without losing public context', () => {
		expect(parseCanonicalRoute('/nublox/portal/perspectivebc/dashboard')).toEqual({
			kind: 'portal',
			tenantSlug: 'nublox',
			partySlug: 'perspectivebc',
			portalPath: '/dashboard'
		});
	});

	it('reroutes canonical URLs to their existing SvelteKit domain modules', () => {
		expect(reroutedPathname('/nublox/dashboard')).toBe('/dashboard');
		expect(reroutedPathname('/nublox/portal/perspectivebc/login')).toBe('/signin');
		expect(reroutedPathname('/nublox/portal/perspectivebc/dashboard')).toBe('/portal');
		expect(reroutedPathname('/nublox/portal/perspectivebc/supplier-quotes/work-1')).toBe(
			'/portal/supplier-quotes/work-1'
		);
	});

	it('recognises legacy internal app paths that must canonicalise into a tenant URL', () => {
		expect(isLegacyTenantAppPath('/projects')).toBe(true);
		expect(isLegacyTenantAppPath('/finance/invoices')).toBe(true);
		expect(isLegacyTenantAppPath('/portal/manage')).toBe(true);
		expect(isLegacyTenantAppPath('/signin')).toBe(false);
	});

	it('never interprets system, public or legacy application roots as tenant slugs', () => {
		const reservedPaths = [
			'/signin',
			'/forgot-password',
			'/reset-password',
			'/start',
			'/select-organisation',
			'/invite/token',
			'/collaborate/token',
			'/network/invite/token',
			'/api/health',
			'/portal',
			'/web',
			'/dashboard',
			'/projects'
		];

		for (const path of reservedPaths) {
			expect(parseCanonicalRoute(path)).toBeNull();
			expect(reroutedPathname(path)).toBeUndefined();
		}
		expect(isTenantRouteSlug('signin')).toBe(false);
		expect(isTenantRouteSlug('projects')).toBe(false);
		expect(isTenantRouteSlug('tenant-projects')).toBe(true);
		expect(isTenantRouteSlug('nublox')).toBe(true);
	});
});
