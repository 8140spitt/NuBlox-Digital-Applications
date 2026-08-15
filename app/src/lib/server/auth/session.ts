import type { RequestEvent } from '@sveltejs/kit';
import type { Actor } from '$lib/types/request-context';

export async function getSessionActor(_event: RequestEvent): Promise<Actor | null> {
	// Session resolution is intentionally centralized at the request boundary.
	return null;
}
