import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationIdentifierNotFoundError,
	OrganisationIdentifierValidationError,
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

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	const service = new OrganisationService(getDatabase());
	try {
		const [organisation, identifiers] = await Promise.all([
			service.getCurrentOrganisation(actor),
			service.listCurrentOrganisationIdentifiers(actor)
		]);
		return {
			organisation: {
				publicId: organisation.publicId,
				legalName: organisation.legalName
			},
			identifiers
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw error(403, cause.message);
		throw cause;
	}
};

function identifierFailure(cause: unknown) {
	if (cause instanceof OrganisationIdentifierValidationError) {
		return fail(400, { identifierError: cause.message });
	}
	if (cause instanceof OrganisationIdentifierNotFoundError) {
		return fail(404, { identifierError: cause.message });
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, { identifierError: cause.message });
	}
	throw cause;
}

export const actions: Actions = {
	addIdentifier: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new OrganisationService(getDatabase()).addCurrentOrganisationIdentifier(actor, {
				identifierType: stringField(formData, 'identifierType'),
				identifierValue: stringField(formData, 'identifierValue'),
				issuingCountryCode: stringField(formData, 'issuingCountryCode') || null
			});
		} catch (cause) {
			return identifierFailure(cause);
		}
		redirect(303, '/organisation/identity');
	},
	removeIdentifier: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new OrganisationService(getDatabase()).removeCurrentOrganisationIdentifier(actor, {
				identifierType: stringField(formData, 'identifierType'),
				identifierValue: stringField(formData, 'identifierValue')
			});
		} catch (cause) {
			return identifierFailure(cause);
		}
		redirect(303, '/organisation/identity');
	}
};
