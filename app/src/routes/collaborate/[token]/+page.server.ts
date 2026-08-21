import { dev } from '$app/environment';
import { error, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { ensureAssetsMaintenanceStandardRoleDefaults } from '$lib/server/assets/assets-maintenance-bootstrap';
import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { PROJECT_COLLABORATION_SIGNUP_COOKIE } from '$lib/server/auth/project-collaboration-cookie';
import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { ensureInformationStandardRoleDefaults } from '$lib/server/information/information-bootstrap';
import {
	OrganisationBootstrapService,
	OrganisationBootstrapValidationError
} from '$lib/server/organisations/bootstrap-service';
import {
	ProjectCollaborationInvitationAccessError,
	ProjectCollaborationInvitationService,
	ProjectCollaborationInvitationValidationError
} from '$lib/server/projects/project-collaboration-invitation-service';
import { ensurePortalCollaborationStandardRoleDefaults } from '$lib/server/portal/portal-collaboration-bootstrap';
import { ensureProcurementCommercialStandardRoleDefaults } from '$lib/server/procurement/procurement-commercial-bootstrap';
import { ORGANISATION_COOKIE } from '$lib/server/request-context';
import { ensureSiteQualitySafetyStandardRoleDefaults } from '$lib/server/site/site-quality-safety-bootstrap';
import { ensureWorkforceStandardRoleDefaults } from '$lib/server/workforce/workforce-bootstrap';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

function collaborationFailure(cause: unknown) {
	if (
		cause instanceof ProjectCollaborationInvitationAccessError ||
		cause instanceof ProjectCollaborationInvitationValidationError ||
		cause instanceof OrganisationBootstrapValidationError
	) {
		return fail(400, { message: cause.message });
	}
	throw cause;
}

function setOrganisationCookie(cookies: Parameters<Actions[string]>[0]['cookies'], publicId: string) {
	cookies.set(ORGANISATION_COOKIE, publicId, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});
}

function clearSignupCookies(cookies: Parameters<Actions[string]>[0]['cookies']) {
	cookies.delete(PROJECT_COLLABORATION_SIGNUP_COOKIE, { path: '/' });
	cookies.delete(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE, { path: '/' });
	cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
}

export const load: PageServerLoad = async ({ params, locals, cookies }) => {
	const service = new ProjectCollaborationInvitationService(getDatabase());
	const invitation = await service.getPendingInvitation(params.token);
	if (!invitation) throw error(404, 'This project collaboration invitation is invalid or has expired.');

	const remainingSeconds = Math.max(
		60,
		Math.floor((invitation.expiresAt.getTime() - Date.now()) / 1000)
	);
	cookies.set(PROJECT_COLLABORATION_SIGNUP_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	const actor = actorFromLocals(locals);
	let currentOrganisation: { publicId: string; name: string; canAccept: boolean } | null = null;
	if (actor && locals.tenant.organisationPublicId) {
		const organisation = await getDatabase()
			.selectFrom('organisations')
			.select(['public_id', 'legal_name', 'trading_name'])
			.where('id', '=', actor.organisationId)
			.where('status', '=', 'active')
			.executeTakeFirst();
		if (organisation) {
			const decision = await new PermissionService(getDatabase()).decide(actor, 'organisation.manage');
			currentOrganisation = {
				publicId: organisation.public_id,
				name: organisation.trading_name?.trim() || organisation.legal_name,
				canAccept: decision.allowed
			};
		}
	}

	return {
		invitation: {
			...invitation,
			expiresAt: invitation.expiresAt.toISOString()
		},
		actor: locals.actor
			? { displayName: locals.actor.displayName, email: locals.actor.email }
			: null,
		emailMatchesActor:
			Boolean(locals.actor) &&
			normaliseEmail(locals.actor?.email ?? '') === normaliseEmail(invitation.email),
		currentOrganisation,
		returnTo: `/collaborate/${encodeURIComponent(params.token)}`
	};
};

export const actions: Actions = {
	acceptCurrent: async ({ params, locals, cookies }) => {
		const actor = actorFromLocals(locals);
		if (!actor || !locals.actor) return fail(401, { message: 'Sign in and select an organisation first.' });
		try {
			const projectPublicId = await new ProjectCollaborationInvitationService(
				getDatabase()
			).acceptExistingOrganisation(params.token, actor, locals.actor.email);
			if (!locals.tenant.organisationPublicId) throw error(409, 'Select an organisation first.');
			setOrganisationCookie(cookies, locals.tenant.organisationPublicId);
			clearSignupCookies(cookies);
			throw redirect(
				303,
				`/projects/${encodeURIComponent(projectPublicId)}?project=${encodeURIComponent(projectPublicId)}`
			);
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'status' in cause && 'location' in cause) throw cause;
			return collaborationFailure(cause);
		}
	},

	createOrganisation: async ({ params, locals, cookies }) => {
		if (!locals.actor) return fail(401, { message: 'Sign in before creating the invited organisation.' });
		const db = getDatabase();
		const collaboration = new ProjectCollaborationInvitationService(db);
		const invitation = await collaboration.getPendingInvitation(params.token);
		if (!invitation) return fail(404, { message: 'This invitation is no longer available.' });
		if (normaliseEmail(locals.actor.email) !== normaliseEmail(invitation.email)) {
			return fail(403, { message: 'This invitation is addressed to a different verified email address.' });
		}

		try {
			const created = await new OrganisationBootstrapService(db).createForExistingUser(
				{ userId: locals.actor.userId, correlationId: locals.correlationId },
				{
					legalName: invitation.crmLegalName,
					tradingName: invitation.crmTradingName,
					defaultTimezone: 'Europe/London',
					defaultCurrencyCode: 'GBP'
				}
			);
			await Promise.all([
				ensureWorkforceStandardRoleDefaults(db, created.organisationId),
				ensureInformationStandardRoleDefaults(db, created.organisationId),
				ensureProcurementCommercialStandardRoleDefaults(db, created.organisationId),
				ensureSiteQualitySafetyStandardRoleDefaults(db, created.organisationId),
				ensureAssetsMaintenanceStandardRoleDefaults(db, created.organisationId),
				ensurePortalCollaborationStandardRoleDefaults(db, created.organisationId)
			]);
			const projectPublicId = await collaboration.acceptExistingOrganisation(
				params.token,
				{
					organisationId: created.organisationId,
					userId: created.userId,
					memberId: created.memberId,
					correlationId: locals.correlationId
				},
				locals.actor.email
			);
			setOrganisationCookie(cookies, created.organisationPublicId);
			clearSignupCookies(cookies);
			throw redirect(
				303,
				`/projects/${encodeURIComponent(projectPublicId)}?project=${encodeURIComponent(projectPublicId)}`
			);
		} catch (cause) {
			if (cause && typeof cause === 'object' && 'status' in cause && 'location' in cause) throw cause;
			return collaborationFailure(cause);
		}
	}
};
