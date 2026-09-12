import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import {
	resolveNativeCapabilityRegistry,
	summariseCapabilityRegistry
} from '$lib/navigation/capability-registry';
import {
	resolveTenantAppNavigation,
	resolveTenantProjectContextNavigation,
	resolveTenantQuickActions,
	resolveTenantWorkspaceDirectory
} from '$lib/navigation/tenant-navigation';
import { tenantPath } from '$lib/routing/route-contract';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';
import { NotificationService } from '$lib/server/notifications/notification-service';
import { OrganisationRepository } from '$lib/server/organisations/organisation-repository';
import { ensureStandardRolePermissionDefaults } from '$lib/server/organisations/standard-role-reconciliation';
import { ProjectWorkspaceService } from '$lib/server/projects/project-workspace-service';

function returnTo(pathname: string): string {
	return `/signin?returnTo=${encodeURIComponent(pathname)}`;
}

function projectPublicIdFromUrl(url: URL): string | null {
	const selected = url.searchParams.get('project')?.trim();
	if (selected) return selected;
	const match = /\/projects\/([^/]+)(?:\/.*)?$/.exec(url.pathname);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.actor) throw redirect(303, returnTo(url.pathname));
	if (
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.organisationPublicId ||
		!locals.tenant.routeSlug ||
		!locals.tenant.memberId
	) {
		throw redirect(303, '/select-organisation');
	}

	const tenantSlug = locals.tenant.routeSlug;
	const db = getDatabase();
	const actorContext = {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
	await ensureStandardRolePermissionDefaults(db, locals.tenant.organisationId);
	const [organisation, allowedPermissionKeys] = await Promise.all([
		new OrganisationRepository(db).findActiveById(locals.tenant.organisationId),
		new PermissionService(db).listAllowedPermissionKeys(actorContext)
	]);
	if (!organisation) throw redirect(303, '/select-organisation');

	const notifications = await new NotificationService(db).listForMember(actorContext, 12);
	const capabilityRegistry = resolveNativeCapabilityRegistry(allowedPermissionKeys);
	const workspaceDirectory = resolveTenantWorkspaceDirectory(tenantSlug, allowedPermissionKeys);
	if (allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('product_service.'))) {
		workspaceDirectory.unshift({
			id: 'product-service-innovation',
			label: 'Product, Service & Innovation',
			items: [
				{
					id: 'product-service',
					label: 'Product, Service & Innovation',
					href: tenantPath(tenantSlug, '/product-service'),
					description:
						'Portfolio strategy, customer needs, ideation, investment cases and product/service lifecycle control.'
				}
			]
		});
	}
	if (allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('governance.'))) {
		workspaceDirectory.unshift({
			id: 'corporate-governance',
			label: 'Corporate governance',
			items: [
				{
					id: 'governance',
					label: 'Corporate governance',
					href: tenantPath(tenantSlug, '/governance'),
					description:
						'Boards, committees, business authority, meetings, decisions, policy and ethics with controlled evidence.'
				}
			]
		});
	}
	if (allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('strategy.'))) {
		workspaceDirectory.unshift({
			id: 'enterprise-planning',
			label: 'Strategy & enterprise planning',
			items: [
				{
					id: 'strategy',
					label: 'Strategy & enterprise planning',
					href: tenantPath(tenantSlug, '/strategy'),
					description:
						'Purpose, environmental analysis, strategic choices and objectives with controlled versioning.'
				},
				{
					id: 'enterprise-performance',
					label: 'Enterprise performance',
					href: tenantPath(tenantSlug, '/performance'),
					description:
						'Performance frameworks, executive reporting, variance intervention, benchmarking and benefits realisation.'
				},
				{
					id: 'corporate-development',
					label: 'Corporate development',
					href: tenantPath(tenantSlug, '/corporate-development'),
					description:
						'Opportunity pipeline, valuation, due diligence, transactions, integration, divestiture and strategic partnerships.'
				}
			]
		});
	}

	const requestedProjectPublicId = projectPublicIdFromUrl(url);
	let projectContext: {
		publicId: string;
		projectNumber: string;
		name: string;
		status: string;
		links: ReturnType<typeof resolveTenantProjectContextNavigation>;
	} | null = null;

	if (requestedProjectPublicId) {
		try {
			const workspace = await new ProjectWorkspaceService(db).getWorkspace(
				actorContext,
				requestedProjectPublicId
			);
			const links = resolveTenantProjectContextNavigation(
				tenantSlug,
				allowedPermissionKeys,
				workspace.project.publicId
			);
			if (
				allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('project.rida.'))
			) {
				const ridaLink = {
					id: 'rida',
					label: 'RIDA',
					href: tenantPath(
						tenantSlug,
						`/projects/${encodeURIComponent(workspace.project.publicId)}/rida`
					)
				};
				const progressIndex = links.findIndex((link) => link.id === 'progress');
				links.splice(progressIndex >= 0 ? progressIndex + 1 : links.length, 0, ridaLink);
			}
			if (
				allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('project.change.'))
			) {
				const changeLink = {
					id: 'change',
					label: 'Change',
					href: tenantPath(
						tenantSlug,
						`/projects/${encodeURIComponent(workspace.project.publicId)}/changes`
					)
				};
				const ridaIndex = links.findIndex((link) => link.id === 'rida');
				links.splice(ridaIndex >= 0 ? ridaIndex + 1 : links.length, 0, changeLink);
			}
			projectContext = {
				publicId: workspace.project.publicId,
				projectNumber: workspace.project.projectNumber,
				name: workspace.project.name,
				status: workspace.project.status,
				links
			};
		} catch (cause) {
			if (!(cause instanceof RecordNotFoundError) && !(cause instanceof TenantAccessError)) {
				throw cause;
			}
		}
	}

	return {
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		organisation: {
			publicId: organisation.publicId,
			name: organisation.tradingName ?? organisation.legalName,
			routeSlug: tenantSlug
		},
		navigation: resolveTenantAppNavigation(tenantSlug, allowedPermissionKeys),
		workspaceDirectory,
		quickActions: resolveTenantQuickActions(tenantSlug, allowedPermissionKeys),
		capabilityRegistry,
		capabilitySummary: summariseCapabilityRegistry(capabilityRegistry),
		notifications,
		projectContext
	};
};
