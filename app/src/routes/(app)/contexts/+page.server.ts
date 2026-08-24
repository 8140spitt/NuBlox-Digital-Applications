import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	ContextShortcutService,
	type ContextShortcut
} from '$lib/server/contexts/context-shortcut-service';
import type { ContextKind } from '$lib/server/contexts/context-preference-repository';
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

function contextKind(value: FormDataEntryValue | null): ContextKind | null {
	return value === 'organisation' || value === 'project' || value === 'facility' || value === 'asset'
		? value
		: null;
}

function booleanValue(value: FormDataEntryValue | null): boolean {
	return value === 'true' || value === '1' || value === 'on';
}

export const load: PageServerLoad = async ({ locals }) => {
	const actor = actorFromLocals(locals);
	if (!actor) {
		return { items: [], pinned: [], favourites: [], recent: [] } satisfies {
			items: ContextShortcut[];
			pinned: ContextShortcut[];
			favourites: ContextShortcut[];
			recent: ContextShortcut[];
		};
	}
	return new ContextShortcutService(getDatabase()).getCentre(actor);
};

export const actions: Actions = {
	preference: async ({ request, locals }) => {
		const actor = actorFromLocals(locals);
		if (!actor) return fail(401, { error: 'Authentication and organisation context are required.' });

		const data = await request.formData();
		const kind = contextKind(data.get('kind'));
		const publicId = String(data.get('publicId') ?? '').trim();
		if (!kind || !/^[0-9a-f-]{36}$/i.test(publicId)) {
			return fail(400, { error: 'A valid context is required.' });
		}

		try {
			await new ContextShortcutService(getDatabase()).setPreference(actor, {
				kind,
				publicId,
				isFavourite: booleanValue(data.get('isFavourite')),
				isPinned: booleanValue(data.get('isPinned'))
			});
			return { success: true };
		} catch (error) {
			if (error instanceof RecordNotFoundError || error instanceof TenantAccessError) {
				return fail(404, { error: 'That context is no longer available to you.' });
			}
			throw error;
		}
	}
};
