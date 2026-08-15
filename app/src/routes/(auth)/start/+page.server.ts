import { dev } from '$app/environment';
import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import { ORGANISATION_BOOTSTRAP_SIGNUP_COOKIE } from '$lib/server/auth/bootstrap-cookie';
import { INVITATION_SIGNUP_COOKIE } from '$lib/server/auth/invitation-cookie';
import { getDatabase } from '$lib/server/db/database';
import {
	OrganisationBootstrapService,
	OrganisationBootstrapValidationError
} from '$lib/server/organisations/bootstrap-service';
import { ORGANISATION_COOKIE } from '$lib/server/request-context';

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
			const created = await new OrganisationBootstrapService(getDatabase()).createForExistingUser(
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
