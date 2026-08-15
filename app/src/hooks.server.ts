import type { Handle } from '@sveltejs/kit';
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

	const response = await resolve(event);
	response.headers.set(CORRELATION_HEADER, event.locals.correlationId);

	return response;
};
