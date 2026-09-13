import { error, fail, redirect } from '@sveltejs/kit';
import { routes } from '$lib/routing/route-contract';
import { getAuth } from '$lib/server/auth/auth';
import { resolveActiveInternalTenant } from '$lib/server/auth/access-context';
import {
	createStrategyFramework,
	getStrategyWorkspace,
	StrategyAccessError,
	StrategyValidationError
} from '$lib/server/strategy/f01-service';
import type { Actions, PageServerLoad } from './$types';

function text(formData: FormData, key: string): string {
	return String(formData.get(key) ?? '').trim();
}

export const load: PageServerLoad = async ({ parent }) => {
	const { tenant } = await parent();
	try {
		const workspace = await getStrategyWorkspace({
			organisationId: tenant.organisationId,
			memberId: tenant.memberId
		});
		if (!workspace.permissions.canManage) {
			error(403, 'You do not have authority to create enterprise strategy.');
		}
		return { permissions: workspace.permissions };
	} catch (cause) {
		if (cause instanceof StrategyAccessError) {
			error(404, 'Strategy & Enterprise Planning is not available in this scope.');
		}
		throw cause;
	}
};

export const actions = {
	create: async ({ request, params, url }) => {
		const formData = await request.formData();
		const values = {
			title: text(formData, 'title'),
			horizonStart: text(formData, 'horizonStart'),
			horizonEnd: text(formData, 'horizonEnd'),
			purpose: text(formData, 'purpose'),
			vision: text(formData, 'vision'),
			mission: text(formData, 'mission')
		};

		const errors: Record<string, string> = {};
		if (!values.title) errors.title = 'Enter a clear name for this strategy cycle.';
		if (!values.horizonStart) errors.horizonStart = 'Choose the start of the planning horizon.';
		if (!values.horizonEnd) errors.horizonEnd = 'Choose the end of the planning horizon.';
		if (values.horizonStart && values.horizonEnd && values.horizonEnd < values.horizonStart) {
			errors.horizonEnd = 'The horizon must end on or after its start date.';
		}
		if (!values.purpose)
			errors.purpose = 'State why the organisation exists and the value it creates.';
		if (!values.vision)
			errors.vision = 'Describe the future state this strategy is intended to achieve.';

		if (Object.keys(errors).length > 0) {
			return fail(400, { values, errors, formError: '' });
		}

		const session = await getAuth().api.getSession({ headers: request.headers });
		if (!session) {
			redirect(303, routes.appSignIn(params.tenant, `${url.pathname}${url.search}`));
		}
		const access = await resolveActiveInternalTenant(session.user.id, params.tenant);
		if (!access) redirect(303, routes.appNoAccess(params.tenant));

		try {
			const created = await createStrategyFramework({
				actor: {
					organisationId: access.organisationId,
					userId: access.userId,
					memberId: access.memberId
				},
				...values
			});
			redirect(303, routes.strategyFramework(access.organisationRouteSlug, created.publicId));
		} catch (cause) {
			if (cause instanceof StrategyValidationError) {
				return fail(400, { values, errors, formError: cause.message });
			}
			if (cause instanceof StrategyAccessError) {
				return fail(403, { values, errors, formError: cause.message });
			}
			throw cause;
		}
	}
} satisfies Actions;
