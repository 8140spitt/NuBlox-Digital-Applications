import { describe, expect, it } from 'vitest';
import { isRouteSlug, portalPath, routes, tenantPath } from './route-contract';

describe('NuBlox V2 route contract', () => {
	it('accepts stable lowercase route slugs', () => {
		expect(isRouteSlug('nublox')).toBe(true);
		expect(isRouteSlug('perspective-bc')).toBe(true);
	});

	it('rejects route slugs that are unsuitable for canonical URLs', () => {
		expect(isRouteSlug('Perspective BC')).toBe(false);
		expect(isRouteSlug('perspective_bc')).toBe(false);
		expect(isRouteSlug('')).toBe(false);
	});

	it('builds tenant-first application URLs', () => {
		expect(tenantPath('nublox', 'projects/PRJ-001')).toBe('/nublox/projects/PRJ-001');
		expect(routes.dashboard('nublox')).toBe('/nublox/dashboard');
		expect(routes.myWork('nublox')).toBe('/nublox/my-work');
	});

	it('builds CRM-party-scoped external portal URLs', () => {
		expect(portalPath('nublox', 'perspectivebc', 'rfqs/RFQ-001')).toBe(
			'/nublox/portal/perspectivebc/rfqs/RFQ-001'
		);
		expect(routes.portalLogin('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/login'
		);
		expect(routes.portalDashboard('nublox', 'perspectivebc')).toBe(
			'/nublox/portal/perspectivebc/dashboard'
		);
	});

	it('does not silently normalise invalid tenant or party identity', () => {
		expect(() => tenantPath('NuBlox', 'dashboard')).toThrow(/Tenant/);
		expect(() => portalPath('nublox', 'Perspective BC', 'dashboard')).toThrow(/Party/);
	});
});
