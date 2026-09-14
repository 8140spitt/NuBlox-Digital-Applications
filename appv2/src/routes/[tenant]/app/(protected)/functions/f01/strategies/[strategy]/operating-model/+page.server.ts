import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import { getAuth } from '$lib/server/auth/auth';
import {
	addOperatingModelAccountability,
	getOperatingModelWorkspace,
	linkInitiativeToOperatingModel,
	type OperatingModelAccountabilityType,
	type OperatingModelChangeRole
} from '$lib/server/strategy/operating-foresight-service';
import { StrategyAccessError, StrategyValidationError } from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

async function actorFor(request: Request, params: { tenant: string }, returnTo: string) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) redirect(303, routes.appSignIn(params.tenant, returnTo));
	const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
	if (!access) redirect(303, routes.appNoAccess(params.tenant));
	return {
		access,
		actor: {
			organisationId: access.organisationId,
			userId: access.userId,
			memberId: access.memberId
		}
	};
}

function text(data: FormData, key: string): string {
	return String(data.get(key) ?? '').trim();
}

export const load: PageServerLoad = async ({ parent, params }) => {
	const { tenant } = await parent();
	try {
		return {
			workspace: await getOperatingModelWorkspace({
				organisationId: tenant.organisationId,
				memberId: tenant.memberId,
				frameworkPublicId: params.strategy
			})
		};
	} catch (cause) {
		if (cause instanceof StrategyAccessError) error(404, cause.message);
		throw cause;
	}
};

export const actions = {
	addAccountability: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await addOperatingModelAccountability({
				actor,
				frameworkPublicId: params.strategy,
				componentPublicId: text(data, 'componentPublicId'),
				accountabilityType: text(data, 'accountabilityType') as OperatingModelAccountabilityType,
				positionLabel: text(data, 'positionLabel'),
				memberPublicId: text(data, 'memberPublicId') || null,
				notes: text(data, 'notes') || null
			});
			redirect(303, routes.strategyOperatingModel(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	},
	linkInitiative: async ({ request, params, url }) => {
		const data = await request.formData();
		const { actor } = await actorFor(request, params, `${url.pathname}${url.search}`);
		try {
			await linkInitiativeToOperatingModel({
				actor,
				frameworkPublicId: params.strategy,
				componentPublicId: text(data, 'componentPublicId'),
				initiativePublicId: text(data, 'initiativePublicId'),
				changeRole: text(data, 'changeRole') as OperatingModelChangeRole
			});
			redirect(303, routes.strategyOperatingModel(params.tenant, params.strategy));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) return fail(400, { formError: cause.message });
			if (cause instanceof StrategyAccessError) return fail(403, { formError: cause.message });
			throw cause;
		}
	}
} satisfies Actions;
