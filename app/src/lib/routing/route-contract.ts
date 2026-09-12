export const TENANT_APP_ROOTS = new Set([
	'assets',
	'capabilities',
	'commercial',
	'contexts',
	'contracts',
	'corporate-development',
	'crm',
	'dashboard',
	'documents',
	'finance',
	'functions',
	'governance',
	'more',
	'my-work',
	'organisation',
	'people',
	'performance',
	'product-service',
	'projects',
	'purchasing',
	'schedule',
	'search',
	'site',
	'strategy',
	'time'
]);

const ROUTE_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,95}$/;

export type CanonicalRouteContext =
	| { kind: 'tenant'; tenantSlug: string; appPath: string }
	| { kind: 'tenant-login'; tenantSlug: string }
	| { kind: 'portal-manage'; tenantSlug: string; appPath: string }
	| {
			kind: 'portal';
			tenantSlug: string;
			partySlug: string;
			portalPath: string;
	  };

export function isRouteSlug(value: string): boolean {
	return ROUTE_SLUG_PATTERN.test(value);
}

export function normaliseRouteSlug(value: string, fallback: string): string {
	const normalised = value
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.slice(0, 80);
	return (
		normalised ||
		fallback
			.replace(/[^a-z0-9]+/gi, '')
			.toLowerCase()
			.slice(0, 80) ||
		'context'
	);
}

export function tenantPath(tenantSlug: string, href: string): string {
	if (!isRouteSlug(tenantSlug)) throw new Error('Invalid tenant route slug.');
	if (!href) return `/${tenantSlug}/dashboard`;
	if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;
	if (href.startsWith('#') || href.startsWith('?')) return `/${tenantSlug}/dashboard${href}`;
	const path = href.startsWith('/') ? href : `/${href}`;
	if (path === `/${tenantSlug}` || path.startsWith(`/${tenantSlug}/`)) return path;
	return `/${tenantSlug}${path}`;
}

export function portalPath(
	tenantSlug: string,
	partySlug: string,
	path: string = '/dashboard'
): string {
	if (!isRouteSlug(tenantSlug) || !isRouteSlug(partySlug)) {
		throw new Error('Invalid portal route context.');
	}
	const suffix = path.startsWith('/') ? path : `/${path}`;
	return `/${tenantSlug}/portal/${partySlug}${suffix}`;
}

export function portalLoginPath(tenantSlug: string, partySlug: string): string {
	return portalPath(tenantSlug, partySlug, '/login');
}

export function portalDashboardPath(tenantSlug: string, partySlug: string): string {
	return portalPath(tenantSlug, partySlug, '/dashboard');
}

export function parseCanonicalRoute(pathname: string): CanonicalRouteContext | null {
	const segments = pathname.split('/').filter(Boolean).map(decodeURIComponent);
	if (segments.length === 0) return null;
	const tenantSlug = segments[0]?.toLowerCase() ?? '';
	if (!isRouteSlug(tenantSlug)) return null;

	if (segments.length === 1) {
		return { kind: 'tenant', tenantSlug, appPath: '/dashboard' };
	}
	if (segments[1] === 'login') return { kind: 'tenant-login', tenantSlug };
	if (segments[1] === 'portal') {
		if (segments[2] === 'manage') {
			return {
				kind: 'portal-manage',
				tenantSlug,
				appPath: `/portal/${segments.slice(2).map(encodeURIComponent).join('/')}`
			};
		}
		const partySlug = segments[2]?.toLowerCase() ?? '';
		if (!isRouteSlug(partySlug)) return null;
		const portalPathname = `/${segments.slice(3).map(encodeURIComponent).join('/')}`;
		return {
			kind: 'portal',
			tenantSlug,
			partySlug,
			portalPath: portalPathname === '/' ? '/dashboard' : portalPathname
		};
	}

	if (!TENANT_APP_ROOTS.has(segments[1] ?? '')) return null;
	return {
		kind: 'tenant',
		tenantSlug,
		appPath: `/${segments.slice(1).map(encodeURIComponent).join('/')}`
	};
}

export function reroutedPathname(pathname: string): string | undefined {
	const route = parseCanonicalRoute(pathname);
	if (!route) return undefined;
	if (route.kind === 'tenant-login') return '/signin';
	if (route.kind === 'tenant' || route.kind === 'portal-manage') return route.appPath;

	if (route.portalPath === '/login') return '/signin';
	if (route.portalPath === '/dashboard' || route.portalPath === '/actions') return '/portal';
	if (route.portalPath.startsWith('/supplier-quotes/')) {
		return `/portal${route.portalPath}`;
	}
	if (route.portalPath.startsWith('/project-actions/')) {
		return `/portal${route.portalPath}`;
	}
	return '/portal';
}

export function isLegacyTenantAppPath(pathname: string): boolean {
	const first = pathname.split('/').filter(Boolean)[0] ?? '';
	return TENANT_APP_ROOTS.has(first) || pathname === '/portal/manage';
}
