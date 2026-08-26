import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CrmOrganisationOnboardingService } from '$lib/server/crm/crm-organisation-onboarding-service';
import type { CrmPartyKind, CrmPartyStatus } from '$lib/server/crm/crm-repository';
import { CrmService, CrmValidationError } from '$lib/server/crm/crm-service';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function parseKind(value: string | null): CrmPartyKind | undefined {
	return value === 'person' || value === 'organisation' ? value : undefined;
}

function parseStatus(value: string | null): CrmPartyStatus | undefined {
	return value === 'active' || value === 'inactive' || value === 'archived' ? value : undefined;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	const search = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
	return new CrmService(getDatabase()).listWorkspace(actor, {
		search: search || undefined,
		kind: parseKind(url.searchParams.get('kind')),
		status: parseStatus(url.searchParams.get('status'))
	});
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { createError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		const rawKind = String(data.get('kind') ?? '');
		if (rawKind !== 'person' && rawKind !== 'organisation') {
			return fail(400, { createError: 'Choose person or organisation.' });
		}

		try {
			const db = getDatabase();
			const party =
				rawKind === 'organisation'
					? await new CrmOrganisationOnboardingService(db).createOrganisation(actor, {
							legalName: String(data.get('legalName') ?? ''),
							tradingName: String(data.get('tradingName') ?? ''),
							organisationEmail: String(data.get('organisationEmail') ?? ''),
							organisationPhone: String(data.get('organisationPhone') ?? ''),
							roleCodes: data.getAll('roleCode').map(String),
							contactHonorific: String(data.get('contactHonorific') ?? ''),
							contactGivenNames: String(data.get('contactGivenNames') ?? ''),
							contactFamilyName: String(data.get('contactFamilyName') ?? ''),
							contactPreferredName: String(data.get('contactPreferredName') ?? ''),
							contactEmail: String(data.get('contactEmail') ?? ''),
							contactPhone: String(data.get('contactPhone') ?? ''),
							contactJobTitle: String(data.get('contactJobTitle') ?? ''),
							contactDepartment: String(data.get('contactDepartment') ?? '')
						})
					: await new CrmService(db).createParty(actor, {
							kind: 'person',
							honorific: String(data.get('honorific') ?? ''),
							givenNames: String(data.get('givenNames') ?? ''),
							familyName: String(data.get('familyName') ?? ''),
							preferredName: String(data.get('preferredName') ?? ''),
							primaryEmail: String(data.get('primaryEmail') ?? ''),
							primaryPhone: String(data.get('primaryPhone') ?? ''),
							roleCodes: data.getAll('roleCode').map(String)
						});
			throw redirect(303, `/crm/${encodeURIComponent(party.publicId)}`);
		} catch (error) {
			if (error instanceof CrmValidationError) return fail(400, { createError: error.message });
			if (error instanceof TenantAccessError) {
				return fail(403, { createError: 'You do not have permission to manage CRM records.' });
			}
			throw error;
		}
	}
};
