import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationLocationNotFoundError,
	OrganisationLocationService,
	OrganisationLocationValidationError
} from '$lib/server/organisations/organisation-location-service';

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

function locationInput(formData: FormData) {
	return {
		name: stringField(formData, 'name'),
		locationType: stringField(formData, 'locationType'),
		timezone: stringField(formData, 'timezone') || null,
		address: {
			line1: stringField(formData, 'line1'),
			line2: stringField(formData, 'line2'),
			line3: stringField(formData, 'line3'),
			locality: stringField(formData, 'locality'),
			city: stringField(formData, 'city'),
			region: stringField(formData, 'region'),
			postalCode: stringField(formData, 'postalCode'),
			countryCode: stringField(formData, 'countryCode')
		}
	};
}

function locationFailure(cause: unknown) {
	if (cause instanceof OrganisationLocationValidationError) {
		return fail(400, { locationError: cause.message });
	}
	if (cause instanceof OrganisationLocationNotFoundError) {
		return fail(404, { locationError: cause.message });
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, { locationError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	try {
		const data = await new OrganisationLocationService(getDatabase()).load(actor);
		return {
			organisation: {
				publicId: data.organisation.publicId,
				legalName: data.organisation.legalName
			},
			locations: data.locations.map(({ id: _id, address, ...location }) => ({
				...location,
				address: address ? (({ id: _addressId, ...publicAddress }) => publicAddress)(address) : null
			}))
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw error(403, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	createLocation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new OrganisationLocationService(getDatabase()).createLocation(
				actor,
				locationInput(formData)
			);
		} catch (cause) {
			return locationFailure(cause);
		}
		redirect(303, '/organisation/locations');
	},
	updateLocation: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		const publicId = stringField(formData, 'locationPublicId');
		try {
			await new OrganisationLocationService(getDatabase()).updateLocation(actor, publicId, {
				...locationInput(formData),
				isActive: formData.has('isActive')
			});
		} catch (cause) {
			return locationFailure(cause);
		}
		redirect(303, '/organisation/locations');
	}
};
