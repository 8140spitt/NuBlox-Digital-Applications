import { error as httpError, fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { CrmService, CrmValidationError } from '$lib/server/crm/crm-service';
import type { CrmPartyStatus } from '$lib/server/crm/crm-repository';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

function parseStatus(value: FormDataEntryValue | null): CrmPartyStatus | null {
	return value === 'active' || value === 'inactive' || value === 'archived' ? value : null;
}

function mutationFailure(error: unknown, field: string) {
	if (error instanceof CrmValidationError) return fail(400, { [field]: error.message });
	if (error instanceof RecordNotFoundError) return fail(404, { [field]: 'CRM record not found.' });
	if (error instanceof TenantAccessError)
		return fail(403, { [field]: 'You do not have permission to manage this CRM record.' });
	throw error;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const actor = actorFromLocals(locals);
	if (!actor) throw httpError(401, 'Authentication and organisation context are required.');
	try {
		return await new CrmService(getDatabase()).getPartyWorkspace(actor, params.partyPublicId);
	} catch (error) {
		if (error instanceof RecordNotFoundError || error instanceof TenantAccessError) {
			throw httpError(404, 'CRM record not found.');
		}
		throw error;
	}
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { updateError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		const status = parseStatus(data.get('status'));
		if (!status) return fail(400, { updateError: 'Choose a valid CRM status.' });
		try {
			await new CrmService(getDatabase()).updateParty(actor, {
				partyPublicId: params.partyPublicId,
				status,
				honorific: String(data.get('honorific') ?? ''),
				givenNames: String(data.get('givenNames') ?? ''),
				familyName: String(data.get('familyName') ?? ''),
				preferredName: String(data.get('preferredName') ?? ''),
				legalName: String(data.get('legalName') ?? ''),
				tradingName: String(data.get('tradingName') ?? ''),
				primaryEmail: String(data.get('primaryEmail') ?? ''),
				primaryPhone: String(data.get('primaryPhone') ?? ''),
				roleCodes: data.getAll('roleCode').map(String)
			});
		} catch (error) {
			return mutationFailure(error, 'updateError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}`);
	},

	linkPlatformOrganisation: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, {
				platformLinkError: 'Authentication and organisation context are required.'
			});
		const data = await request.formData();
		try {
			await new CrmService(getDatabase()).linkPlatformOrganisation(actor, {
				partyPublicId: params.partyPublicId,
				organisationPublicId: String(data.get('organisationPublicId') ?? '')
			});
		} catch (error) {
			return mutationFailure(error, 'platformLinkError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#nublox-link`);
	},

	unlinkPlatformOrganisation: async ({ locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, {
				platformLinkError: 'Authentication and organisation context are required.'
			});
		try {
			await new CrmService(getDatabase()).unlinkPlatformOrganisation(actor, params.partyPublicId);
		} catch (error) {
			return mutationFailure(error, 'platformLinkError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#nublox-link`);
	},

	createContact: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, { contactError: 'Authentication and organisation context are required.' });
		const data = await request.formData();
		try {
			await new CrmService(getDatabase()).createOrganisationContact(actor, params.partyPublicId, {
				honorific: String(data.get('honorific') ?? ''),
				givenNames: String(data.get('givenNames') ?? ''),
				familyName: String(data.get('familyName') ?? ''),
				preferredName: String(data.get('preferredName') ?? ''),
				primaryEmail: String(data.get('primaryEmail') ?? ''),
				primaryPhone: String(data.get('primaryPhone') ?? ''),
				jobTitle: String(data.get('jobTitle') ?? ''),
				department: String(data.get('department') ?? ''),
				isPrimaryContact: data.get('isPrimaryContact') === 'on'
			});
		} catch (error) {
			return mutationFailure(error, 'contactError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#contacts`);
	},

	linkContact: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, {
				linkContactError: 'Authentication and organisation context are required.'
			});
		const data = await request.formData();
		try {
			await new CrmService(getDatabase()).linkExistingOrganisationContact(actor, {
				organisationPartyPublicId: params.partyPublicId,
				personPartyPublicId: String(data.get('personPartyPublicId') ?? ''),
				jobTitle: String(data.get('jobTitle') ?? ''),
				department: String(data.get('department') ?? ''),
				isPrimaryContact: data.get('isPrimaryContact') === 'on'
			});
		} catch (error) {
			return mutationFailure(error, 'linkContactError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#contacts`);
	},

	endContact: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, {
				contactActionError: 'Authentication and organisation context are required.'
			});
		const data = await request.formData();
		try {
			await new CrmService(getDatabase()).endOrganisationContact(
				actor,
				params.partyPublicId,
				String(data.get('personPartyPublicId') ?? '')
			);
		} catch (error) {
			return mutationFailure(error, 'contactActionError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#contacts`);
	},

	makePrimaryContact: async ({ request, locals, params }) => {
		const actor = actorFromLocals(locals);
		if (!actor)
			return fail(401, {
				contactActionError: 'Authentication and organisation context are required.'
			});
		const data = await request.formData();
		try {
			await new CrmService(getDatabase()).makePrimaryOrganisationContact(
				actor,
				params.partyPublicId,
				String(data.get('personPartyPublicId') ?? '')
			);
		} catch (error) {
			return mutationFailure(error, 'contactActionError');
		}
		throw redirect(303, `/crm/${encodeURIComponent(params.partyPublicId)}#contacts`);
	}
};
