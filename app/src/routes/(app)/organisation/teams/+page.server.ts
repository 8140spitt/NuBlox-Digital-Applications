import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	OrganisationTeamNotFoundError,
	OrganisationTeamService,
	OrganisationTeamValidationError
} from '$lib/server/organisations/organisation-team-service';

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

function stringList(formData: FormData, name: string): string[] {
	return formData
		.getAll(name)
		.filter((value): value is string => typeof value === 'string')
		.map((value) => value.trim())
		.filter(Boolean);
}

function teamFailure(cause: unknown) {
	if (cause instanceof OrganisationTeamNotFoundError) {
		return fail(404, { teamError: cause.message });
	}
	if (cause instanceof OrganisationTeamValidationError) {
		return fail(400, { teamError: cause.message });
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, { teamError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	try {
		const data = await new OrganisationTeamService(getDatabase()).load(actor);
		return {
			organisation: {
				publicId: data.organisation.publicId,
				legalName: data.organisation.legalName
			},
			teams: data.teams,
			members: data.members.map(({ id: _id, ...member }) => member)
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw error(403, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	createTeam: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new OrganisationTeamService(getDatabase()).createTeam(actor, {
				name: stringField(formData, 'name'),
				description: stringField(formData, 'description'),
				memberPublicIds: stringList(formData, 'memberPublicId')
			});
		} catch (cause) {
			return teamFailure(cause);
		}
		redirect(303, '/organisation/teams');
	},
	updateTeam: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new OrganisationTeamService(getDatabase()).updateTeam(actor, {
				teamPublicId: stringField(formData, 'teamPublicId'),
				name: stringField(formData, 'name'),
				description: stringField(formData, 'description'),
				isActive: formData.has('isActive'),
				memberPublicIds: stringList(formData, 'memberPublicId')
			});
		} catch (cause) {
			return teamFailure(cause);
		}
		redirect(303, '/organisation/teams');
	}
};
