import { resolve as resolveKitPath } from '$app/paths';
import type { Pathname, ResolvedPathname } from '$app/types';

type PathnameWithSearchOrHash = Pathname | `${Pathname}?${string}` | `${Pathname}#${string}`;

const resolveKnownPath = resolveKitPath as (pathname: PathnameWithSearchOrHash) => ResolvedPathname;

/**
 * Resolve a canonical NuBlox internal path while keeping SvelteKit base-path handling
 * and the eslint navigation contract in one place.
 *
 * Route helpers and server load data are the authority for path construction. This
 * boundary deliberately accepts their serialized string form, rejects external or
 * protocol-relative values, then narrows once for SvelteKit's generated route type.
 */
export function resolveInternalPath(pathname: string): ResolvedPathname {
	if (!pathname.startsWith('/') || pathname.startsWith('//')) {
		throw new Error('NuBlox internal navigation requires an absolute local pathname.');
	}

	return resolveKnownPath(pathname as PathnameWithSearchOrHash);
}
