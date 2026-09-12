import { building } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { getAuth } from '$lib/server/auth/auth';

export const handle: Handle = async ({ event, resolve }) => {
	if (building) return resolve(event);

	return svelteKitHandler({
		event,
		resolve,
		auth: getAuth(),
		building
	});
};
