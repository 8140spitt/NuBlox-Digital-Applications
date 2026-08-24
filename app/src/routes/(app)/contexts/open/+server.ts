import { error, redirect, type RequestHandler } from '@sveltejs/kit';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import { ContextShortcutService } from '$lib/server/contexts/context-shortcut-service';
import type { ContextKind } from '$lib/server/contexts/context-preference-repository';
import { getDatabase } from '$lib/server/db/database';
import { RecordNotFoundError, TenantAccessError } from '$lib/server/kernel/errors';

function kindFrom(value: string | null): ContextKind | null {
	return value === 'organisation' ||
		value === 'project' ||
		value === 'facility' ||
		value === 'asset'
		? value
		: null;
}

export const GET: RequestHandler = async ({ locals, url }) => {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) {
		throw error(401, 'Authentication and organisation context are required.');
	}
	const kind = kindFrom(url.searchParams.get('kind'));
	const publicId = url.searchParams.get('id')?.trim() ?? '';
	if (!kind || !/^[0-9a-f-]{36}$/i.test(publicId)) throw error(400, 'A valid context is required.');

	const actor: TenantActorContext = {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};

	try {
		const href = await new ContextShortcutService(getDatabase()).openContext(actor, kind, publicId);
		throw redirect(303, href);
	} catch (cause) {
		if (cause instanceof RecordNotFoundError || cause instanceof TenantAccessError) {
			throw error(404, 'That context is no longer available to you.');
		}
		throw cause;
	}
};
