import { dev } from '$app/environment';
import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { ensureAssetsMaintenanceStandardRoleDefaults } from '$lib/server/assets/assets-maintenance-bootstrap';
import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { getDatabase } from '$lib/server/db/database';
import { ensureInformationStandardRoleDefaults } from '$lib/server/information/information-bootstrap';
import {
	OrganisationBootstrapService,
	OrganisationBootstrapValidationError
} from '$lib/server/organisations/bootstrap-service';
import { ensurePortalCollaborationStandardRoleDefaults } from '$lib/server/portal/portal-collaboration-bootstrap';
import { ensureProcurementCommercialStandardRoleDefaults } from '$lib/server/procurement/procurement-commercial-bootstrap';
import { ensureSiteQualitySafetyStandardRoleDefaults } from '$lib/server/site/site-quality-safety-bootstrap';
import { ORGANISATION_COOKIE } from '$lib/server/request-context';
import { ensureWorkforceStandardRoleDefaults } from '$lib/server/workforce/workforce-bootstrap';

function field(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value : '';
}

export const load: PageServerLoad = async ({ locals }) => ({
	actor: locals.actor
		? {
				displayName: locals.actor.displayName,
				email: locals.actor.email
			}
		: null
});

export const actions: Actions = {
	createOrganisation: async ({ request, locals, cookies }) => {
		if (!locals.actor) throw error(401, 'Sign in before creating an additional organisation.');
		const formData = await request.formData();

		try {
			const db = getDatabase();
			const created = await new OrganisationBootstrapService(db).createForExistingUser(
				{
					userId: locals.actor.userId,
					correlationId: locals.correlationId
				},
				{
					legalName: field(formData, 'legalName'),
					tradingName: field(formData, 'tradingName'),
					defaultTimezone: field(formData, 'defaultTimezone'),
					defaultCurrencyCode: field(formData, 'defaultCurrencyCode')
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

			cookies.set(ORGANISATION_COOKIE, created.organisationPublicId, {
				httpOnly: true,
				secure: !dev,
				sameSite: 'lax',
				path: '/',
				maxAge: 60 * 60 * 24 * 30
			});
			cookies.delete(ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE, { path: '/' });
			cookies.delete(INVITATION_SIGNUP_COOKIE, { path: '/' });
		} catch (cause) {
			if (cause instanceof OrganisationBootstrapValidationError) {
				return fail(400, { message: cause.message });
			}
			throw cause;
		}

		throw redirect(303, '/dashboard');
	}
};
