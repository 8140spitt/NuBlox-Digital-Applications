import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';

import { auth } from '$lib/server/auth/better-auth';
import { getSessionActor } from '$lib/server/auth/session';
import {
	CORRELATION_HEADER,
	resolveCorrelationId,
	resolveTenantContext
} from '$lib/server/request-context';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.correlationId = resolveCorrelationId(event);
	event.locals.actor = await getSessionActor(event);
	event.locals.tenant = await resolveTenantContext(event);

	return svelteKitHandler({
		event,
		resolve: async (resolvedEvent) => {
			const response = await resolve(resolvedEvent);
			response.headers.set(CORRELATION_HEADER, event.locals.correlationId);
			return response;
		},
		auth,
		building
	});
};
