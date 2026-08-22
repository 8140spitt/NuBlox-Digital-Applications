import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { getDatabase } from '$lib/server/db/database';
import { TenantAccessError } from '$lib/server/kernel/errors';
import {
	MemberPermissionOverrideNotFoundError,
	MemberPermissionOverrideService,
	MemberPermissionOverrideValidationError
} from '$lib/server/organisations/member-permission-override-service';

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

function overrideFailure(cause: unknown) {
	if (cause instanceof MemberPermissionOverrideNotFoundError) {
		return fail(404, { overrideError: cause.message });
	}
	if (cause instanceof MemberPermissionOverrideValidationError) {
		return fail(400, { overrideError: cause.message });
	}
	if (cause instanceof TenantAccessError) {
		return fail(403, { overrideError: cause.message });
	}
	throw cause;
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	try {
		const data = await new MemberPermissionOverrideService(getDatabase()).load(actor);
		return {
			organisation: {
				publicId: data.organisation.publicId,
				legalName: data.organisation.legalName
			},
			members: data.members.map(({ id, userId: _userId, ...member }) => ({
				...member,
				isCurrent: id === actor.memberId
			})),
			permissions: data.permissions.map(({ id: _id, ...permission }) => permission),
			overrides: data.overrides
		};
	} catch (cause) {
		if (cause instanceof TenantAccessError) throw error(403, cause.message);
		throw cause;
	}
};

export const actions: Actions = {
	setOverride: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new MemberPermissionOverrideService(getDatabase()).setOverride(actor, {
				memberPublicId: stringField(formData, 'memberPublicId'),
				permissionKey: stringField(formData, 'permissionKey'),
				effect: stringField(formData, 'effect'),
				reason: stringField(formData, 'reason')
			});
		} catch (cause) {
			return overrideFailure(cause);
		}
		redirect(303, '/organisation/permissions');
	},
	removeOverride: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		const formData = await request.formData();
		try {
			await new MemberPermissionOverrideService(getDatabase()).removeOverride(actor, {
				memberPublicId: stringField(formData, 'memberPublicId'),
				permissionKey: stringField(formData, 'permissionKey')
			});
		} catch (cause) {
			return overrideFailure(cause);
		}
		redirect(303, '/organisation/permissions');
	}
};
