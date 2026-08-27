import { dev } from '$app/environment';
import { error, json, type RequestHandler } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/database';
import { OrganisationMembershipRepository } from '$lib/server/organisations/membership-repository';
import { ORGANISATION_COOKIE } from '$lib/server/request-context';

type SelectTenantBody = {
	organisationPublicId?: unknown;
};

const UUID_V4ISH_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
	if (!locals.actor) throw error(401, 'Authentication required.');

	let body: SelectTenantBody;
	try {
		body = (await request.json()) as SelectTenantBody;
	} catch {
		throw error(400, 'A valid JSON body is required.');
	}

	const organisationPublicId =
		typeof body.organisationPublicId === 'string' ? body.organisationPublicId.trim() : '';
	if (!UUID_V4ISH_PATTERN.test(organisationPublicId)) {
		throw error(400, 'A valid organisation public ID is required.');
	}

	const membership = await new OrganisationMembershipRepository(
		getDatabase()
	).findActiveMembershipByOrganisationPublicId(locals.actor.userId, organisationPublicId);

	if (!membership?.organisationPublicId) throw error(403, 'Organisation access denied.');

	cookies.set(ORGANISATION_COOKIE, membership.organisationPublicId, {
		httpOnly: true,
		secure: !dev,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24 * 30
	});

	return json({ organisationPublicId: membership.organisationPublicId });
};

export const DELETE: RequestHandler = async ({ cookies }) => {
	cookies.delete(ORGANISATION_COOKIE, { path: '/' });
	return new Response(null, { status: 204 });
};
