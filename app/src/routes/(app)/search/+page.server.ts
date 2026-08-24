import type { PageServerLoad } from './$types';

import type { TenantActorContext } from '$lib/server/auth/tenant-actor-context';
import {
	EnterpriseSearchService,
	EnterpriseSearchValidationError
} from '$lib/server/search/enterprise-search-service';

function actorFromLocals(locals: App.Locals): TenantActorContext | null {
	if (!locals.actor || !locals.tenant.organisationId || !locals.tenant.memberId) return null;
	return {
		organisationId: locals.tenant.organisationId,
		userId: locals.actor.userId,
		memberId: locals.tenant.memberId,
		correlationId: locals.correlationId
	};
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const query = url.searchParams.get('q')?.trim() ?? '';
	const actor = actorFromLocals(locals);
	if (!actor || query.length < 2) {
		return {
			query,
			searched: query.length >= 2,
			results: [],
			searchError: null
		};
	}

	try {
		return {
			query,
			searched: true,
			results: await new EnterpriseSearchService().search(actor, query, 30),
			searchError: null
		};
	} catch (cause) {
		if (cause instanceof EnterpriseSearchValidationError) {
			return {
				query,
				searched: true,
				results: [],
				searchError: cause.message
			};
		}
		throw cause;
	}
};
