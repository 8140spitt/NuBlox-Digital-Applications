import { dev } from '$app/environment';
import { error, redirect, type Actions } from '@sveltejs/kit';
import { isRouteSlug, routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import {
	acceptOrganisationInvitation,
	getOrganisationInvitation,
	ORGANISATION_INVITATION_COOKIE,
	OrganisationInvitationAccessError
} from '$lib/server/auth/organisation-invitation';
import { TENANT_BOOTSTRAP_COOKIE } from '$lib/server/auth/tenant-bootstrap';
import { getTenantRouteContextByOrganisationPublicId } from '$lib/server/tenancy/tenant-route-context';
import type { PageServerLoad } from './$types';

function normaliseEmail(value: string): string {
	return value.trim().toLowerCase();
}

async function requireInvitationForTenant(token: string, tenant: string) {
	if (!isRouteSlug(tenant)) throw error(404, 'Tenant not found.');
	const invitation = await getOrganisationInvitation(token);
	if (!invitation) throw error(404, 'This invitation is invalid or has expired.');

	const routeContext = await getTenantRouteContextByOrganisationPublicId(
		invitation.organisationPublicId
	);
	if (!routeContext || routeContext.routeSlug !== tenant) {
		throw error(404, 'This invitation does not belong to the requested tenant.');
	}

	return invitation;
}

export const load: PageServerLoad = async ({ params, request, cookies, url }) => {
	const invitation = await requireInvitationForTenant(params.token, params.tenant);

	if (url.searchParams.get('verified') === '1') {
		cookies.delete(ORGANISATION_INVITATION_COOKIE, { path: '/' });
		return {
			verified: true,
			invitation: null,
			user: null,
			canAccept: false,
			tenant: params.tenant,
			signInHref: routes.appSignIn(params.tenant)
		};
	}

	const remainingSeconds = Math.max(
		60,
		Math.floor((invitation.expiresAt.getTime() - Date.now()) / 1000)
	);
	cookies.delete(TENANT_BOOTSTRAP_COOKIE, { path: '/' });
	cookies.set(ORGANISATION_INVITATION_COOKIE, params.token, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: remainingSeconds
	});

	const session = await getAuth().api.getSession({ headers: request.headers });
	const user = session
		? { id: session.user.id, name: session.user.name, email: session.user.email }
		: null;

	return {
		verified: false,
		tenant: params.tenant,
		signInHref: routes.appSignIn(params.tenant),
		verifyEmailHref: routes.appVerifyEmail(params.tenant),
		invitation: {
			organisationName: invitation.organisationName,
			email: invitation.email,
			expiresAt: invitation.expiresAt.toISOString()
		},
		user,
		canAccept:
			Boolean(user) && normaliseEmail(user?.email ?? '') === normaliseEmail(invitation.email)
	};
};

export const actions: Actions = {
	accept: async ({ params, request, cookies }) => {
		const rawToken = params.token;
		if (!rawToken) throw error(400, 'Invitation token is required.');
		await requireInvitationForTenant(rawToken, params.tenant);

		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) throw error(401, 'Sign in before accepting this invitation.');

		try {
			await acceptOrganisationInvitation({
				rawToken,
				authUserId: session.user.id,
				email: session.user.email,
				displayName: session.user.name
			});
			cookies.delete(ORGANISATION_INVITATION_COOKIE, { path: '/' });
		} catch (cause) {
			if (cause instanceof OrganisationInvitationAccessError) throw error(403, cause.message);
			throw cause;
		}

		throw redirect(303, routes.app(params.tenant));
	}
};
