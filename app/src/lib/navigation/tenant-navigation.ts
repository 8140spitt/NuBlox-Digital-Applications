import { tenantPath } from '$lib/routing/route-contract';
import {
	resolveAppNavigation,
	resolveProjectContextNavigation,
	resolveQuickActions,
	resolveWorkspaceDirectory,
	type AppNavigationItem,
	type AppNavigationSection,
	type AppQuickAction,
	type ProjectContextNavigationItem
} from './app-navigation';

function contextualHref(tenantSlug: string, href: string): string {
	if (href === '/portal') return tenantPath(tenantSlug, '/portal/manage');
	return tenantPath(tenantSlug, href);
}

function contextualItem(tenantSlug: string, item: AppNavigationItem): AppNavigationItem {
	return {
		...item,
		href: contextualHref(tenantSlug, item.href),
		children: item.children?.map((child) => contextualItem(tenantSlug, child))
	};
}

function contextualSections(
	tenantSlug: string,
	sections: AppNavigationSection[]
): AppNavigationSection[] {
	return sections.map((section) => ({
		...section,
		items: section.items.map((item) => contextualItem(tenantSlug, item))
	}));
}

export function resolveTenantAppNavigation(
	tenantSlug: string,
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	return contextualSections(tenantSlug, resolveAppNavigation(allowedPermissionKeys));
}

export function resolveTenantWorkspaceDirectory(
	tenantSlug: string,
	allowedPermissionKeys: readonly string[]
): AppNavigationSection[] {
	return contextualSections(tenantSlug, resolveWorkspaceDirectory(allowedPermissionKeys));
}

export function resolveTenantProjectContextNavigation(
	tenantSlug: string,
	allowedPermissionKeys: readonly string[],
	projectPublicId: string
): ProjectContextNavigationItem[] {
	return resolveProjectContextNavigation(allowedPermissionKeys, projectPublicId).map((item) => ({
		...item,
		href: contextualHref(tenantSlug, item.href)
	}));
}

export function resolveTenantQuickActions(
	tenantSlug: string,
	allowedPermissionKeys: readonly string[]
): AppQuickAction[] {
	return resolveQuickActions(allowedPermissionKeys).map((action) => ({
		...action,
		href: contextualHref(tenantSlug, action.href)
	}));
}
