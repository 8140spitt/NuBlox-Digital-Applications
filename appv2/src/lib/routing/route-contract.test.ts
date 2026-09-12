import { describe, expect, it } from 'vitest';
import { appPath, isRouteSlug, portalPath, routes } from './route-contract';

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

	it('builds app-scoped internal tenant URLs', () => {
		expect(appPath('nublox', 'projects/PRJ-001')).toBe('/app/nublox/projects/PRJ-001');
		expect(routes.dashboard('nublox')).toBe('/app/nublox/dashboard');
		expect(routes.myWork('nublox')).toBe('/app/nublox/my-work');
		expect(routes.projects('nublox')).toBe('/app/nublox/projects');
	});

	it('builds CRM-party-scoped connected portal URLs', () => {
		expect(portalPath('nublox', 'perspectivebc', 'rfqs/RFQ-001')).toBe(
			'/portal/nublox/perspectivebc/rfqs/RFQ-001'
		);
		expect(routes.portalLogin('nublox', 'perspectivebc')).toBe(
			'/portal/nublox/perspectivebc/login'
		);
		expect(routes.portalDashboard('nublox', 'perspectivebc')).toBe(
			'/portal/nublox/perspectivebc/dashboard'
		);
		expect(routes.portalProjects('nublox', 'perspectivebc')).toBe(
			'/portal/nublox/perspectivebc/projects'
		);
	});

	it('does not silently normalise invalid tenant or CRM Party identity', () => {
		expect(() => appPath('NuBlox', 'dashboard')).toThrow(/Tenant/);
		expect(() => portalPath('nublox', 'Perspective BC', 'dashboard')).toThrow(/CRM Party/);
	});
});
