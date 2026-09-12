import type { Reroute } from '@sveltejs/kit';

import { reroutedPathname } from '$lib/routing/route-contract';

/**
 * Keep the public URL contract tenant-first while allowing domain route modules
 * to remain organised independently inside SvelteKit. The browser URL is not
 * rewritten: /nublox/projects resolves the existing /projects route module.
 */
export const reroute: Reroute = ({ url }) => reroutedPathname(url.pathname);
