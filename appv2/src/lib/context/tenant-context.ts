import { isRouteSlug } from '$lib/routing/route-contract';

export type TenantContext = {
	slug: string;
	displayName: string;
};

function titleCaseSegment(segment: string): string {
	return segment ? `${segment[0]?.toUpperCase() ?? ''}${segment.slice(1)}` : segment;
}

export function tenantDisplayName(slug: string): string {
	return slug.split('-').map(titleCaseSegment).join(' ');
}

export function tenantContextFromRoute(slug: string): TenantContext | null {
	if (!isRouteSlug(slug)) return null;
	return {
		slug,
		displayName: tenantDisplayName(slug)
	};
}
