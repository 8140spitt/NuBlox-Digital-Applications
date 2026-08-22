import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { PermissionService } from '$lib/server/capabilities/permission-service';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationProfileValidationError,
	OrganisationService
} from '$lib/server/organisations/organisation-service';

type LocalsLike = {
	actor: { userId: string } | null;
	tenant: {
		membershipVerified: boolean;
		organisationId: string | null;
		memberId: string | null;
	};
	correlationId: string;
};

function actorFromLocals(locals: LocalsLike): TenantActorContext {
	if (
		!locals.actor ||
		!locals.tenant.membershipVerified ||
		!locals.tenant.organisationId ||
		!locals.tenant.memberId
	) {
		throw error(401, 'An active organisation membership is required.');
	}
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function stringField(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	const db = getDatabase();
	const decision = await new PermissionService(db).decide(actor, 'organisation.manage');
	if (!decision.allowed) {
		throw error(403, 'You do not have organisation profile management access.');
	}

	const organisation = await new OrganisationService(db).getCurrentOrganisation(actor);
	return {
		profile: {
			publicId: organisation.publicId,
			legalName: organisation.legalName,
			tradingName: organisation.tradingName,
			defaultTimezone: organisation.defaultTimezone,
			defaultCurrencyCode: organisation.defaultCurrencyCode
		},
		profileSuccess:
			url.searchParams.get('updated') === '1' ? 'Organisation profile updated.' : null
	};
};

export const actions: Actions = {
	update: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		const service = new OrganisationService(getDatabase());
		try {
			await service.updateCurrentOrganisationProfile(actor, {
				legalName: stringField(formData, 'legalName'),
				tradingName: stringField(formData, 'tradingName'),
				defaultTimezone: stringField(formData, 'defaultTimezone'),
				defaultCurrencyCode: stringField(formData, 'defaultCurrencyCode')
			});
		} catch (cause) {
			if (cause instanceof OrganisationProfileValidationError) {
				return fail(400, { profileError: cause.message });
			}
			if (cause instanceof TenantAccessError) {
				return fail(403, { profileError: cause.message });
			}
			throw cause;
		}
		redirect(303, '/organisation/profile?updated=1');
	}
};
