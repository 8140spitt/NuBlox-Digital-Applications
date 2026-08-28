import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

import {
	resolveNativeCapabilityRegistry,
	summariseCapabilityRegistry
} from '$lib/navigation/capability-registry';
import {
	resolveAppNavigation,
	resolveProjectContextNavigation,
	resolveQuickActions,
	resolveWorkspaceDirectory
} from '$lib/navigation/app-navigation';
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
	const match = /^\/projects\/([^/]+)(?:\/.*)?$/.exec(url.pathname);
	return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.actor) throw redirect(303, returnTo(url.pathname));
	if (
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.organisationPublicId ||
		!locals.tenant.memberId
	) {
		throw redirect(303, '/select-organisation');
	}

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
	const requestedProjectPublicId = projectPublicIdFromUrl(url);
	let projectContext: {
		publicId: string;
		projectNumber: string;
		name: string;
		status: string;
		links: ReturnType<typeof resolveProjectContextNavigation>;
	} | null = null;

	if (requestedProjectPublicId) {
		try {
			const workspace = await new ProjectWorkspaceService(db).getWorkspace(
				actorContext,
				requestedProjectPublicId
			);
			const links = resolveProjectContextNavigation(
				allowedPermissionKeys,
				workspace.project.publicId
			);
			if (
				allowedPermissionKeys.some((permissionKey) => permissionKey.startsWith('project.rida.'))
			) {
				const ridaLink = {
					id: 'rida',
					label: 'RIDA',
					href: `/projects/${encodeURIComponent(workspace.project.publicId)}/rida`
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
					href: `/projects/${encodeURIComponent(workspace.project.publicId)}/changes`
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
			if (!(cause instanceof RecordNotFoundError) && !(cause instanceof TenantAccessError))
				throw cause;
		}
	}

	return {
		actor: {
			displayName: locals.actor.displayName,
			email: locals.actor.email
		},
		organisation: {
			publicId: organisation.publicId,
			name: organisation.tradingName ?? organisation.legalName
		},
		navigation: resolveAppNavigation(allowedPermissionKeys),
		workspaceDirectory: resolveWorkspaceDirectory(allowedPermissionKeys),
		quickActions: resolveQuickActions(allowedPermissionKeys),
		capabilityRegistry,
		capabilitySummary: summariseCapabilityRegistry(capabilityRegistry),
		notifications,
		projectContext
	};
};
